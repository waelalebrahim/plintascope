// Cloudflare Pages Function: serves the economic calendar (Forex Factory free feed).
// Endpoint: /api/calendar
//
// Source: nfs.faireconomy.media (this week + next week, all currencies).
// Cached hard (30 min at the edge) because the source rate-limits frequent downloads.

const SOURCES = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json"
];

export async function onRequest() {
  try {
    const lists = await Promise.all(SOURCES.map(function (u) {
      return fetch(u, {
        cf: { cacheTtl: 1800, cacheEverything: true },
        headers: { "User-Agent": "Mozilla/5.0 (Plintascope)" }
      })
        .then(function (r) { return r.text(); })
        .then(function (txt) {
          try { const j = JSON.parse(txt); return Array.isArray(j) ? j : []; }
          catch (e) { return []; } // rate-limited responses return HTML, not JSON
        })
        .catch(function () { return []; });
    }));

    const raw = [].concat.apply([], lists);
    const seen = {};
    const events = [];
    raw.forEach(function (e) {
      const t = Math.floor(new Date(e.date).getTime() / 1000);
      if (!t || isNaN(t)) return;
      const k = t + "|" + e.country + "|" + e.title;
      if (seen[k]) return; seen[k] = 1;
      events.push({
        t: t,
        currency: e.country || "",
        impact: e.impact || "",
        title: e.title || "",
        forecast: e.forecast || "",
        previous: e.previous || "",
        actual: (e.actual != null ? e.actual : "")
      });
    });
    events.sort(function (a, b) { return a.t - b.t; });

    return json({ events: events }, 1800);
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
