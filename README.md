# Plintascope: multi-timeframe market view

*It shows you the levels. It won't tell you the future.*

Opens to one screen that does the top-down read for you: automatic support &
resistance zones, a trend strip across six timeframes, momentum (RSI) stated as
a condition (never a "buy/sell"), and clickable news markers that explain what a
release *is*. They never predict direction.

The S&R, trend, and momentum are computed live from real prices. The news
markers are example events for now; a live economic calendar is the next piece.

## What's in here

```
index.html                 the whole app (no build step)
functions/api/candles.js   hidden-key proxy to Twelve Data (Cloudflare Function)
README.md                  this file
```

## Going live (Cloudflare Pages)

1. **Get a free data key.** Sign up at https://twelvedata.com and copy your API
   key. The free tier is 8 calls/min, 800/day, plenty for one person.

2. **Put this folder on Cloudflare Pages.** Either push it to a GitHub repo and
   connect it in the Cloudflare dashboard (Pages → Create → Connect to Git), or
   drag the folder into Pages → Create → Direct Upload. No build command, no
   output directory needed. It's a static site with one function.

3. **Add your key as an environment variable.** In your Pages project:
   Settings → Environment variables → add `TWELVE_DATA_KEY` = *your key*.
   Redeploy once after adding it.

That's it. Before the key is set, the page shows clearly-labelled **sample data**
so it never looks broken. The moment the key is in place, it switches to live
prices.

## Data budget

Each load pulls the 30m base chart plus the five other timeframes for the trend
strip, about six calls. The daily/4H change slowly, so you don't need to hammer
Refresh; a personal day of normal use stays far under the 800/day free limit.

## Naming

The brand is **Plintascope** (plintascope.com).

## License

MIT. Free and open source. Use it, fork it, make it better. It's yours.

Developed by **Wael Alebrahim** ·
[X](https://x.com/walebrahim_X) ·
[LinkedIn](https://www.linkedin.com/in/waelalebrahim) ·
[GitHub](https://github.com/waelalebrahim) ·
[Website](https://waelalebrahim.com/)
