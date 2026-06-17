# Plintascope: multi-timeframe market view

*It shows you the levels. It won't tell you the future.*

One screen that does the top-down read for you. It marks structure and shows
conditions; it never predicts direction or tells you to buy or sell.

## What it does

- **Real chart engine.** Candlesticks on TradingView's Lightweight Charts:
  pan, zoom, scroll back through history, and a crosshair with an O/H/L/C
  readout. Dark mode and a fullscreen view, both remembered between visits.
- **Multi-timeframe confluence S&R.** Support/resistance isn't guessed from one
  timeframe. The Daily and 4H levels are pulled too, and a zone confirmed across
  timeframes is drawn as a strong (solid) line; a single-timeframe level is light
  (dotted). Each level is tagged with the timeframes it actually sits on.
- **Trend strip.** Direction across six timeframes (D, 4H, 30m, 15m, 5m, 1m) with
  a plain-language alignment read.
- **Momentum (RSI).** Stated as a condition ("stretched", "neutral"), never a
  signal.
- **Fair Value Gaps.** Three-candle imbalances shaded as boxes (green bullish,
  red bearish). Open gaps only; once price trades back through, the gap drops.
  Current-timeframe gaps are solid; Daily/4H gaps are shown subtler with a label.
  Toggle with the **FVG** button.
- **Distance to level.** How many pips price is from the nearest support and
  resistance, always under the price.
- **Live economic calendar.** A lane under the chart with a dot for every
  scheduled event (all currencies), colored by impact. Scroll right to see what's
  coming; click a dot for details. See the note below on data.

## What's in here

```
index.html                  the whole app (no build step)
functions/api/candles.js    hidden-key proxy to Twelve Data (prices)
functions/api/calendar.js   hidden-key proxy to the economic calendar
README.md                   this file
```

## Going live (Cloudflare Pages)

1. **Prices key (required).** Sign up at https://twelvedata.com, copy your API
   key. Free tier (8 calls/min, 800/day) is plenty for one person.

2. **Calendar key (optional).** The news lane reads from Financial Modeling Prep
   (https://financialmodelingprep.com). Note: FMP's economic-calendar endpoint
   currently requires a **paid** plan. Until that key is in place the lane simply
   stays empty; everything else works. No code change is needed when you add it.

3. **Deploy.** Push this folder to a GitHub repo and connect it in Cloudflare
   (Pages → Create → Connect to Git), or drag the folder into Direct Upload. No
   build command, no output directory. `index.html` must sit at the repo root,
   with the `functions` folder beside it (not inside it).

4. **Add keys as environment variables (Secret).** In the Pages project:
   Settings → Variables → add `TWELVE_DATA_KEY` and (optionally) `FMP_API_KEY`.
   Redeploy once after adding or changing a key.

Before the prices key is set, the page shows clearly-labelled **sample data** so
it never looks broken. The moment the key is in place, it switches to live.

## Data budget

Each load pulls the base chart (500 candles) plus the other timeframes for the
trend strip and the Daily/4H confluence and gaps, about six calls. Higher
timeframes change slowly, so it refreshes the base every minute and the rest
every five. Normal personal use stays far under the free limits.

## License

MIT. Free and open source. Use it, fork it, make it better. It's yours.

Developed by **Wael Alebrahim** ·
[X](https://x.com/walebrahim_X) ·
[LinkedIn](https://www.linkedin.com/in/waelalebrahim) ·
[GitHub](https://github.com/waelalebrahim) ·
[Website](https://waelalebrahim.com/)
