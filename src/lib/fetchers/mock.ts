// A deterministic-ish mock fetcher for development and demos.
//
// It synthesizes a believable Pinduoduo-style price for any goodsId so the full
// monitoring pipeline (history, thresholds, alerts) works end to end with no
// network access. The price drifts over time and occasionally dips, so a
// threshold set near the baseline will genuinely trigger.

import { FetchResult, PriceFetcher, success } from "./types";

function seedFrom(goodsId: string): number {
  // Simple deterministic 32-bit hash (FNV-1a).
  let h = 0x811c9dc5;
  for (let i = 0; i < goodsId.length; i++) {
    h ^= goodsId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MockFetcher implements PriceFetcher {
  readonly name = "mock";

  constructor(
    private readonly periodSeconds = 600,
    private readonly jitter = 0.06,
  ) {}

  baselinePrice(goodsId: string): number {
    const seed = seedFrom(goodsId);
    // Baseline somewhere in a plausible CNY range: 9.90 – 309.90.
    return Math.round((9.9 + (seed % 30000) / 100) * 100) / 100;
  }

  async fetch(goodsId: string): Promise<FetchResult> {
    const seed = seedFrom(goodsId);
    const base = this.baselinePrice(goodsId);

    // Slow sinusoidal drift of +/-15% around the baseline, with a per-item
    // phase offset so different products move independently.
    const phase = ((seed % 1000) / 1000) * 2 * Math.PI;
    const t = (Date.now() / 1000 / this.periodSeconds) * 2 * Math.PI;
    const drift = 0.15 * Math.sin(t + phase);

    // Per-call random jitter, reseeded each minute so values move between checks.
    const rng = mulberry32(seed ^ Math.floor(Date.now() / 60000));
    const noise = (rng() * 2 - 1) * this.jitter;

    const price = Math.max(0.01, Math.round(base * (1 + drift + noise) * 100) / 100);
    const originalPrice = Math.round(base * 1.4 * 100) / 100;
    const inStock = rng() > 0.02; // 2% chance of an out-of-stock blip

    return success(price, {
      originalPrice,
      title: `[mock] ${goodsId}`,
      inStock,
      raw: { baseline: base, drift: Math.round(drift * 1e4) / 1e4 },
    });
  }
}
