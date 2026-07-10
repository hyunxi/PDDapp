# Pinduoduo price scraper (best-effort, free)

Pinduoduo has no free public price API, and its site blocks scrapers that aren't
logged in / run from datacenter IPs. Vercel also can't run a browser. So this
scraper runs on **GitHub Actions** (free, and it *can* run a real Chromium
browser), reads your watched products from the app, tries to extract each price,
and posts results to the app's secured `/api/ingest` endpoint.

> ⚠️ **Best-effort, not guaranteed.** PDD actively fights automated browsers and
> changes its pages. Some products (or all) may return no price, especially
> without a login cookie. When it can't get a price it logs why and skips —
> it never posts a fake number. Expect to tweak `scrape.mjs` over time.

## How the pieces fit

```
GitHub Actions (scheduled)  →  scraper/scrape.mjs (Playwright/Chromium)
   → reads GET /api/products (products with fetcher = "external")
   → opens each PDD page, extracts the price
   → POST /api/ingest  (Bearer CRON_SECRET)
   → app records price + fires threshold alert
```

## Setup (once)

1. **Mark products for scraping.** In the app, add/edit the products you want
   real prices for and set their **Fetcher** to **`external`**. Put the PDD
   share link (or a `goods.html?goods_id=…` URL) in the product's **URL** field
   if you have it — it scrapes more reliably than a bare goods id.

2. **Add repository secrets** on GitHub: repo → **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**:
   - `APP_URL` — your deployed app, e.g. `https://pd-dapp.vercel.app`
   - `CRON_SECRET` — the same value you set in Vercel
   - `PDD_COOKIE` — *(optional but strongly recommended)* your logged-in PDD
     cookie string (see below)

3. **Enable Actions** if prompted (repo → **Actions** tab → enable workflows).

4. **Run it manually** the first time: **Actions** tab → **Scrape Pinduoduo
   prices** → **Run workflow**. Open the run's logs to see, per product, whether
   a price was found. After that it runs automatically every 30 minutes.

## Getting your `PDD_COOKIE` (big reliability boost)

PDD hides prices from anonymous visitors, so scraping with *your* logged-in
session works far better:

1. On a **desktop browser**, log in at <https://mobile.yangkeduo.com>.
2. Open DevTools (F12) → **Network** tab → refresh → click the first request →
   **Request Headers** → copy the entire **`cookie:`** value.
3. Paste that string as the `PDD_COOKIE` repo secret.

Cookies expire, so if scraping starts failing later, refresh this value.

## Test without the browser

You can push a price by hand to confirm the app side works (replace the secret):

```bash
curl -X POST "$APP_URL/api/ingest" \
  -H "authorization: Bearer YOUR_CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"goodsId":"YOUR_GOODS_ID","price":79.9}'
```

Then open that product in the app — you'll see the price and (if below your
threshold) an alert. This same endpoint is your fallback if browser scraping is
blocked: anything that can send an HTTP POST (a phone shortcut, a userscript in
your logged-in browser) can feed prices in.
