// Cloudflare Pages Function: serves the economic calendar (Forex Factory free feed).
// Endpoint: /api/calendar   (add ?debug=1 to see what the upstream returned)
//
// Tries the CDN host first, then the origin, with browser-like headers.
// Cached ~15 min at the edge to respect the source's download rate limit.

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9"
};
const HOSTS = ["https://cdn-nfs.faireconomy.media/", "https://nfs.faireconomy.media/"];

async function grab(url) {
  try {
    const r = await fetch(url, { headers: BROWSER_HEADERS, cf: { cacheTtl: 900, cacheEverything: true } });
    const txt = await r.text();
    let arr = [], parsed = false;
    try { const j = JSON.parse(txt); if (Array.isArray(j)) { arr = j; parsed = true; } } catch (e) {}
    return { url: url, status: r.status, ct: (r.headers.get("content-type") || ""), parsed: parsed, count: arr.length, sample: parsed ? "" : txt.slice(0, 180), events: arr };
  } catch (err) {
    return { url: url, status: 0, error: String(err), events: [] };
  }
}

async function grabWeek(file) {
  const dbg = [];
  for (let i = 0; i < HOSTS.length; i++) {
    const res = await grab(HOSTS[i] + file);
    dbg.push({ url: res.url, status: res.status, ct: res.ct, parsed: res.parsed, count: res.count, sample: res.sample, error: res.error });
    if (res.events.length) return { events: res.events, dbg: dbg };
  }
  return { events: [], dbg: dbg };
}

export async function onRequest(context) {
  const wantDebug = new URL(context.request.url).searchParams.get("debug") === "1";
  try {
    const weeks = await Promise.all([
      grabWeek("ff_calendar_thisweek.json"),
      grabWeek("ff_calendar_nextweek.json")
    ]);
    const raw = [].concat(weeks[0].events, weeks[1].events);
    const seen = {}, events = [];
    raw.forEach(function (e) {
      const t = Math.floor(new Date(e.date).getTime() / 1000);
      if (!t || isNaN(t)) return;
      const k = t + "|" + e.country + "|" + e.title;
      if (seen[k]) return; seen[k] = 1;
      events.push({
        t: t, currency: e.country || "", impact: e.impact || "",
        title: e.title || "", forecast: e.forecast || "",
        previous: e.previous || "", actual: (e.actual != null ? e.actual : "")
      });
    });
    events.sort(function (a, b) { return a.t - b.t; });

    const body = { events: events };
    if (wantDebug) body._debug = { thisweek: weeks[0].dbg, nextweek: weeks[1].dbg };
    return json(body, events.length ? 900 : 0);
  } catch (err) {
    return json({ status: "error", code: "calendar_failed", message: String(err) }, 0);
  }
}

function json(obj, cacheSeconds) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds ? ("public, max-age=" + cacheSeconds) : "no-store"
    }
  });
}
