// Fetcher registry — maps a fetcher name to a singleton instance.

import { MockFetcher } from "./mock";
import { PinduoduoFetcher } from "./pdd";
import { PriceFetcher } from "./types";

const registry: Record<string, PriceFetcher> = {};

function register(f: PriceFetcher) {
  registry[f.name] = f;
}

register(new MockFetcher());
register(new PinduoduoFetcher());

export function availableFetchers(): string[] {
  return Object.keys(registry).sort();
}

/**
 * Return the fetcher registered under `name`, falling back to the mock fetcher
 * for unknown names so a bad config value never takes the whole monitor down.
 */
export function getFetcher(name: string): PriceFetcher {
  return registry[name] ?? registry["mock"];
}

export * from "./types";
