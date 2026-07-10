// Marker fetcher for products whose price is supplied by the external scraper
// (GitHub Actions → /api/ingest). The scheduled check skips these products, so
// this fetch() is only hit if someone presses "Check now" on one — in which
// case we return a clear explanation rather than a real price.

import { FetchResult, PriceFetcher, failure } from "./types";

export class ExternalFetcher implements PriceFetcher {
  readonly name = "external";

  async fetch(): Promise<FetchResult> {
    return failure(
      "Price is supplied by the external scraper via /api/ingest; it is not " +
        "fetched on demand. Waiting for the next scraper run.",
    );
  }
}
