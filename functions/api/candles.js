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

  try {
    const res = await fetch(api, { cf: { cacheTtl: 20, cacheEverything: true } });
    const data = await res.json();
    return json(data, 20);
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
