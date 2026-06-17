// Cloudflare Pages Function: economic calendar via Financial Modeling Prep (FMP).
// Endpoint: /api/calendar   (add ?debug=1 to inspect what FMP returned)
//
// Needs an env var FMP_API_KEY (free key at financialmodelingprep.com, 250 req/day).
// FMP economic-calendar times are UTC. Cached ~30 min at the edge.

function ymd(d){ return d.toISOString().slice(0,10); }

async function tryFetch(url){
  try{
    const r = await fetch(url, { cf:{ cacheTtl:1800, cacheEverything:true } });
    const txt = await r.text();
    let arr=null, parsed=false, err;
    try{
      const j = JSON.parse(txt);
      if(Array.isArray(j)){ arr=j; parsed=true; }
      else if(j && (j["Error Message"]||j.message)){ err = j["Error Message"]||j.message; }
    }catch(e){}
    return { status:r.status, ct:(r.headers.get("content-type")||""), parsed:parsed,
             count:parsed?arr.length:0, sample:parsed?"":txt.slice(0,180), err:err, events:parsed?arr:[] };
  }catch(e){ return { status:0, error:String(e), events:[] }; }
}

export async function onRequest(context){
  const wantDebug = new URL(context.request.url).searchParams.get("debug")==="1";
  const key = context.env.FMP_API_KEY;
  if(!key){ return json({ events:[], _debug: wantDebug ? { note:"FMP_API_KEY is not set in Cloudflare." } : undefined }, 0); }

  const now=new Date();
  const from=new Date(now.getTime()-3*86400000);
  const to=new Date(now.getTime()+30*86400000);
  const qs="from="+ymd(from)+"&to="+ymd(to)+"&apikey="+encodeURIComponent(key);
  const urls=[
    "https://financialmodelingprep.com/stable/economic-calendar?"+qs,
    "https://financialmodelingprep.com/api/v3/economic_calendar?"+qs
  ];

  const dbg=[]; let raw=[];
  for(let i=0;i<urls.length;i++){
    const res=await tryFetch(urls[i]);
    dbg.push({ host:urls[i].split("?")[0], status:res.status, ct:res.ct, parsed:res.parsed, count:res.count, sample:res.sample, err:res.err, error:res.error });
    if(res.events && res.events.length){ raw=res.events; break; }
  }

  const seen={}, events=[];
  raw.forEach(function(e){
    const t=Math.floor(new Date(String(e.date||"").replace(" ","T")+"Z").getTime()/1000);
    if(!t || isNaN(t)) return;
    const cur=e.currency||e.country||"";
    const title=e.event||e.title||"";
    const k=t+"|"+cur+"|"+title;
    if(seen[k]) return; seen[k]=1;
    events.push({
      t:t,
      currency:cur,
      impact:(e.impact||e.importance||""),
      title:title,
      forecast:(e.estimate!=null?e.estimate:(e.forecast!=null?e.forecast:"")),
      previous:(e.previous!=null?e.previous:""),
      actual:(e.actual!=null?e.actual:"")
    });
  });
  events.sort(function(a,b){return a.t-b.t;});

  const body={ events:events };
  if(wantDebug) body._debug=dbg;
  return json(body, events.length?1800:0);
}

function json(obj, cacheSeconds){
  return new Response(JSON.stringify(obj), {
    headers:{ "content-type":"application/json; charset=utf-8",
      "cache-control": cacheSeconds ? ("public, max-age="+cacheSeconds) : "no-store" }
  });
}
