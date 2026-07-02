// Placeholder for a real Pinduoduo price fetcher.
//
// This is intentionally not implemented. Pinduoduo offers no open,
// unauthenticated price API, and its consumer site/app is protected by
// aggressive anti-bot measures (the `anti_content` request signature, device
// fingerprinting, sliding captchas, etc.). Two realistic ways to populate it:
//
// 1. Official affiliate API — Duoduo Jinbao / 多多进宝 (recommended, stable, legal).
//    Register at https://open.pinduoduo.com, obtain client_id / client_secret and
//    a promotion pid, then call `pdd.ddk.goods.detail` and read
//    `min_group_price` / `min_normal_price`. Sign requests with the platform's
//    MD5 `sign` scheme. Note: outbound calls from a Vercel serverless function
//    are fine for this.
//
// 2. Headless-browser scraping. Not viable on Vercel's default serverless
//    runtime; would need a hosted browser service (e.g. Browserless) and is
//    brittle against PDD's defenses.
//
// Until one is wired up, products using fetcher="pdd" record a clear error on
// each check instead of crashing the monitor.

import { FetchResult, PriceFetcher, failure } from "./types";

export class PinduoduoFetcher implements PriceFetcher {
  readonly name = "pdd";

  async fetch(): Promise<FetchResult> {
    return failure(
      "Real Pinduoduo fetcher is not configured. Supply Duoduo Jinbao (开放平台) " +
        "API credentials or implement a fetcher in src/lib/fetchers/pdd.ts. " +
        "See the file's header comment for guidance.",
    );
  }
}
