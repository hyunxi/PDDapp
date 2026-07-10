// Best-effort Pinduoduo price scraper.
//
// Runs on GitHub Actions (which can run a real Chromium browser, unlike Vercel).
// For each product in your app whose fetcher is "external", it opens the PDD
// product page, extracts the price, and POSTs it to your app's /api/ingest.
//
// Env:
//   APP_URL      e.g. https://pd-dapp.vercel.app   (required)
//   CRON_SECRET  same value as in Vercel            (required)
//   PDD_COOKIE   your logged-in PDD cookie string   (optional but strongly
//                recommended — PDD hides prices from anonymous visitors)
//
// IMPORTANT: PDD actively fights automated browsers. This is best-effort. When
// it can't get a price it logs why and moves on; it never posts a fake price.

import { chromium } from "playwright";

const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET || "";
const PDD_COOKIE = process.env.PDD_COOKIE || "";

if (!APP_URL || !CRON_SECRET) {
  console.error("Missing APP_URL or CRON_SECRET env vars.");
  process.exit(1);
}

function productUrl(p) {
  if (p.url && /^https?:\/\//.test(p.url)) return p.url;
  return `https://mobile.yangkeduo.com/goods.html?goods_id=${encodeURIComponent(p.goodsId)}`;
}

function parseCookies(raw) {
  // "a=1; b=2" -> [{name,value,domain,path}]
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      return { name, value, domain: ".yangkeduo.com", path: "/" };
    })
    .filter((c) => c.name);
}

// Runs in the page. Digs through PDD's embedded data + DOM for a price (yuan).
function extractPriceInPage() {
  const yuan = (fen) => Math.round(fen) / 100;

  // 1) window.rawData — the richest source when present. Prices are in fen.
  try {
    const rd = window.rawData || window.__NEXT_DATA__ || null;
    if (rd) {
      const goods =
        rd?.store?.initDataObj?.goods ||
        rd?.props?.pageProps?.goods ||
        rd?.goods ||
        null;
      const candidates = [
        goods?.minGroupPrice,
        goods?.minOnSaleGroupPrice,
        goods?.minNormalPrice,
        goods?.minOnSaleNormalPrice,
        goods?.marketPrice,
      ].filter((n) => typeof n === "number" && n > 0);
      if (candidates.length) {
        return { price: yuan(Math.min(...candidates)), source: "rawData" };
      }
    }
  } catch (e) {
    /* fall through */
  }

  // 2) Any embedded JSON blob with a *GroupPrice / minPrice field (fen).
  try {
    const html = document.documentElement.innerHTML;
    const m = html.match(/"min(?:OnSale)?GroupPrice"\s*:\s*(\d+)/);
    if (m) return { price: yuan(Number(m[1])), source: "regex-fen" };
  } catch (e) {
    /* fall through */
  }

  // 3) Visible price text like ￥79.9 (already yuan).
  try {
    const text = document.body ? document.body.innerText : "";
    const m = text.match(/[￥¥]\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    if (m) return { price: Number(m[1]), source: "dom-text" };
  } catch (e) {
    /* fall through */
  }

  return null;
}

async function main() {
  // Fetch the product list from the app (public endpoint).
  const res = await fetch(`${APP_URL}/api/products`);
  if (!res.ok) {
    console.error(`Could not load products: HTTP ${res.status}`);
    process.exit(1);
  }
  const all = await res.json();
  const targets = all.filter((p) => p.active && p.fetcher === "external");

  if (targets.length === 0) {
    console.log('No products with fetcher "external" to scrape. Nothing to do.');
    return;
  }
  console.log(`Scraping ${targets.length} product(s)…`);

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "zh-CN",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  if (PDD_COOKIE) {
    try {
      await context.addCookies(parseCookies(PDD_COOKIE));
    } catch (e) {
      console.warn("Could not set PDD_COOKIE:", e.message);
    }
  }

  const results = [];
  for (const p of targets) {
    const url = productUrl(p);
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500); // let embedded data hydrate
      const found = await page.evaluate(extractPriceInPage);
      if (found && Number.isFinite(found.price) && found.price > 0) {
        console.log(`✓ ${p.name} [${p.goodsId}] → ¥${found.price} (${found.source})`);
        results.push({ goodsId: p.goodsId, price: found.price, title: p.name });
      } else {
        console.warn(
          `✗ ${p.name} [${p.goodsId}] → no price found (likely a login wall or ` +
            `anti-bot page). ${PDD_COOKIE ? "" : "Set PDD_COOKIE to improve this."}`,
        );
      }
    } catch (e) {
      console.warn(`✗ ${p.name} [${p.goodsId}] → error: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  if (results.length === 0) {
    console.log("No prices scraped this run.");
    return;
  }

  const post = await fetch(`${APP_URL}/api/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ items: results }),
  });
  const summary = await post.json().catch(() => ({}));
  console.log(`Ingest → HTTP ${post.status}`, summary);
  if (!post.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
