// Cloudflare Pages Function: proxies Twelve Data so the API key stays hidden.
// Endpoint: /api/candles?symbol=EUR/USD&interval=30min&outputsize=120
//
// Set your key in Cloudflare:  Settings -> Environment variables -> TWELVE_DATA_KEY
// Get a free key at https://twelvedata.com (free tier: 8 calls/min, 800/day).

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const symbol = url.searchParams.get("symbol") || "EUR/USD";
  const interval = url.searchParams.get("interval") || "30min";
  const outputsize = url.searchParams.get("outputsize") || "120";

  const key = env.TWELVE_DATA_KEY;

  // No key yet -> tell the frontend so it can show sample data instead of breaking.
  if (!key) {
    return json({ status: "error", code: "no_key", message: "TWELVE_DATA_KEY is not set." });
  }

  const api =
    "https://api.twelvedata.com/time_series" +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&outputsize=${encodeURIComponent(outputsize)}` +
    `&apikey=${encodeURIComponent(key)}`;

  // Edge-cache each interval for a sensible window. This is the real protector
  // of the daily Twelve Data credit budget: when the same symbol/interval is
  // requested again inside the window, Cloudflare serves its cached copy and
  // does NOT call Twelve Data, so it costs zero credits. Higher timeframes get
  // a longer window because their levels barely move intraday; fast intraday
  // timeframes get a short one so the chart still feels current.
  const EDGE_TTL = {
    "1day": 300, "1week": 600, "1month": 900,
    "4h": 240, "2h": 240, "1h": 180,
    "45min": 120, "30min": 120, "15min": 90, "5min": 60, "1min": 45
  };
  const edge = EDGE_TTL[interval] || 60;

  try {
    // cacheTtlByStatus keeps good data cached for the full window but lets HTTP
    // errors expire fast, so a hiccup never gets stuck on the edge for minutes.
    const res = await fetch(api, {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": edge, "400-499": 30, "500-599": 5 }
      }
    });
    const data = await res.json();
    // Twelve Data returns rate-limit / error notices in the body with a 200
    // status. Never let the browser hold one of those, so the next load retries.
    const isErr = data && (data.status === "error" || data.code === 429 || data.code === 400);
    return json(data, isErr ? 0 : Math.min(edge, 20));
  } catch (err) {
    return json({ status: "error", code: "fetch_failed", message: String(err) });
  }
}

function json(obj, cacheSeconds) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}
