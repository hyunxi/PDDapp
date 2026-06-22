"""A deterministic-ish mock fetcher for local development and demos.

It synthesizes a believable Pinduoduo-style price for any ``goods_id`` so the
full monitoring pipeline (history, thresholds, alerts) works end to end without
any network access. The price drifts over time and occasionally dips, so
thresholds set near the baseline will genuinely trigger.
"""

from __future__ import annotations

import hashlib
import math
import random
import time

from .base import FetchResult, PriceFetcher


def _seed_from(goods_id: str) -> int:
    digest = hashlib.sha256(goods_id.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


class MockFetcher(PriceFetcher):
    name = "mock"

    def __init__(self, *, period_seconds: float = 600.0, jitter: float = 0.06) -> None:
        # period_seconds: how long a full up/down price cycle takes.
        # jitter: random noise as a fraction of the baseline price.
        self.period_seconds = period_seconds
        self.jitter = jitter

    def baseline_price(self, goods_id: str) -> float:
        seed = _seed_from(goods_id)
        # Baseline somewhere in a plausible CNY range: 9.90 – 309.90.
        base = 9.9 + (seed % 30000) / 100.0
        return round(base, 2)

    def fetch(self, goods_id: str, url: str = "") -> FetchResult:
        seed = _seed_from(goods_id)
        base = self.baseline_price(goods_id)

        # Slow sinusoidal drift of +/- 15% around the baseline, with a per-item
        # phase offset so different products move independently.
        phase = (seed % 1000) / 1000.0 * 2 * math.pi
        t = time.time() / self.period_seconds * 2 * math.pi
        drift = 0.15 * math.sin(t + phase)

        # Per-call random jitter.
        rng = random.Random(seed ^ int(time.time()))
        noise = rng.uniform(-self.jitter, self.jitter)

        price = round(base * (1 + drift + noise), 2)
        price = max(price, 0.01)
        original = round(base * 1.4, 2)  # pretend there's a "list price"
        in_stock = rng.random() > 0.02  # 2% chance of an out-of-stock blip

        return FetchResult.success(
            price=price,
            original_price=original,
            title=f"[mock] {goods_id}",
            in_stock=in_stock,
            raw={"baseline": base, "drift": round(drift, 4)},
        )
