// Cloudflare Pages Function: proxies Financial Modeling Prep (FMP) so the API key
// stays hidden. Emits the same shape the frontend already parses, so index.html
// needs no changes:  { status:"ok", values:[ {datetime, open, high, low, close, volume}, ... ] }
//
// Endpoint: /api/candles?symbol=EUR/USD&interval=30min&outputsize=120
// Uses the SAME env var as the calendar:  FMP_API_KEY  (Settings -> Variables).
//
// Notes that matter:
//  - FMP intraday timestamps are New York time; the frontend treats datetime as
//    UTC (it appends "Z"). So we convert NY -> UTC here, DST-aware, before emitting.
//  - FMP daily lives on a different endpoint and returns a date with no time;
//    we emit it as "YYYY-MM-DD 00:00:00" so the frontend parses it as midnight UTC.
//  - FMP returns newest-first; the frontend sorts ascending itself, so order is fine.
//    We slice to outputsize (most recent N) to mirror the old behavior.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const symbolRaw = url.searchParams.get("symbol") || "EUR/USD";
  const interval  = url.searchParams.get("interval") || "30min";
  let   outputsize = parseInt(url.searchParams.get("outputsize") || "120", 10);
  if (!Number.isFinite(outputsize) || outputsize < 1) outputsize = 120;
  if (outputsize > 5000) outputsize = 5000;

  const key = env.FMP_API_KEY;
  if (!key) {
    return json({ status: "error", code: "no_key", message: "FMP_API_KEY is not set." }, 0);
  }

  // FMP symbols have no slash: EUR/USD -> EURUSD, XAU/USD -> XAUUSD.
  const symbol = symbolRaw.replace(/\//g, "").toUpperCase();

  // Map the frontend's interval names to FMP's.
  const INTRADAY = { "1min":"1min", "5min":"5min", "15min":"15min", "30min":"30min", "1h":"1hour", "4h":"4hour" };
  const isDaily = (interval === "1day");
  const fmpInterval = INTRADAY[interval];

  if (!isDaily && !fmpInterval) {
    return json({ status: "error", code: "bad_interval", message: "Unsupported interval: " + interval }, 0);
  }

  const api = isDaily
    ? `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`
    : `https://financialmodelingprep.com/stable/historical-chart/${fmpInterval}?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;

  // Edge-cache each interval for a sensible window. With FMP Starter there is no
  // daily credit cap, so this is now about edge speed and load, not survival, but
  // it still means repeat loads inside the window don't re-hit FMP.
  const EDGE_TTL = {
    "1day": 300, "4h": 240, "1h": 180, "30min": 120, "15min": 90, "5min": 60, "1min": 45
  };
  const edge = EDGE_TTL[interval] || 60;

  try {
    const res = await fetch(api, {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": edge, "400-499": 30, "500-599": 5 }
      }
    });

    let data;
    try { data = await res.json(); }
    catch (e) { return json({ status:"error", code:"bad_json", message:"FMP returned non-JSON." }, 0); }

    // FMP success = a non-empty array. Anything else (e.g. {"Error Message":...},
    // upgrade notice, empty) is treated as an error so the frontend shows sample
    // data instead of breaking, and we never cache the error in the browser.
    if (!Array.isArray(data) || !data.length) {
      const msg = (data && (data["Error Message"] || data.error || data.message)) || "No data returned.";
      return json({ status:"error", code:"fmp_error", message:String(msg) }, 0);
    }

    const values = isDaily ? mapDaily(data, outputsize) : mapIntraday(data, outputsize);
    if (!values.length) {
      return json({ status:"error", code:"empty", message:"No usable candles." }, 0);
    }
    return json({ status:"ok", values: values }, Math.min(edge, 20));
  } catch (err) {
    return json({ status: "error", code: "fetch_failed", message: String(err) }, 0);
  }
}

// ----- adapters: FMP rows -> Twelve-Data-shaped {datetime, open, high, low, close, volume} -----

function mapIntraday(rows, n) {
  const out = [];
  for (let i = 0; i < rows.length && out.length < n; i++) {
    const r = rows[i];
    if (!r || r.date == null) continue;
    const utc = nyToUTC(r.date);          // FMP intraday "date" is New York time
    if (!utc) continue;
    out.push({
      datetime: utc,                      // "YYYY-MM-DD HH:MM:SS" in UTC
      open:  r.open,  high: r.high,
      low:   r.low,   close: r.close,
      volume: r.volume
    });
  }
  return out;
}

function mapDaily(rows, n) {
  const out = [];
  for (let i = 0; i < rows.length && out.length < n; i++) {
    const r = rows[i];
    if (!r || !r.date) continue;
    // Daily "date" is a plain date like "2026-06-18"; emit midnight UTC so the
    // frontend's +"Z" yields a valid instant. Keep the full OHLC FMP provides.
    out.push({
      datetime: String(r.date).slice(0,10) + " 00:00:00",
      open:  r.open,  high: r.high,
      low:   r.low,   close: r.close,
      volume: r.volume
    });
  }
  return out;
}

// ----- New York -> UTC, DST-aware -----
// Returns a "YYYY-MM-DD HH:MM:SS" string in UTC, or null if unparseable.
function nyToUTC(s) {
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const y=+m[1], mo=+m[2], d=+m[3], h=+m[4], mi=+m[5], se=+(m[6]||0);
  // Interpret the wall-clock as if it were UTC, then subtract NY's offset at that
  // instant to get the true UTC instant. (Off by at most the 1-hour DST-switch
  // window, which for forex falls on the weekend gap.)
  const wallAsUTC = Date.UTC(y, mo-1, d, h, mi, se);
  const offMin = nyOffsetMinutes(new Date(wallAsUTC)); // minutes NY is ahead of UTC (negative)
  const trueUTC = new Date(wallAsUTC - offMin*60000);
  return fmtUTC(trueUTC);
}

// Minutes that America/New_York is ahead of UTC at the given instant (negative).
function nyOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  });
  const p = {};
  dtf.formatToParts(date).forEach(function(x){ p[x.type] = x.value; });
  let hh = p.hour === "24" ? 0 : +p.hour; // some engines emit 24 for midnight
  const asUTC = Date.UTC(+p.year, +p.month-1, +p.day, hh, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

function fmtUTC(d) {
  function p(n){ return String(n).padStart(2,"0"); }
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth()+1) + "-" + p(d.getUTCDate()) +
         " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds());
}

function json(obj, cacheSeconds) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}
