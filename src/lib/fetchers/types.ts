// The price-fetcher interface that every data source implements.
//
// Swapping the data source (mock today, real Pinduoduo later) is just a matter
// of implementing PriceFetcher and registering it in ./index.ts.

export interface FetchResult {
  ok: boolean;
  price?: number | null;
  originalPrice?: number | null;
  title?: string | null;
  inStock: boolean;
  error?: string | null;
  raw?: Record<string, unknown> | null;
}

export interface PriceFetcher {
  /** Short stable identifier used in config and the products.fetcher column. */
  readonly name: string;

  /**
   * Return the current price for a Pinduoduo product. Must never throw for an
   * expected "couldn't get the price" condition — return { ok: false, error }.
   */
  fetch(goodsId: string, url?: string): Promise<FetchResult>;
}

export function success(
  price: number,
  opts: Partial<Omit<FetchResult, "ok" | "price">> = {},
): FetchResult {
  return { ok: true, price, inStock: true, ...opts };
}

export function failure(error: string): FetchResult {
  return { ok: false, inStock: false, error };
}
