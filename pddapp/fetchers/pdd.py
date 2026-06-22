"""Placeholder for a real Pinduoduo price fetcher.

This is intentionally not implemented. Pinduoduo offers no open, unauthenticated
price API, and its consumer site/app is protected by aggressive anti-bot
measures (the ``anti_content`` request signature, device fingerprinting, sliding
captchas, etc.). There are two realistic ways to populate this class:

1. **Official affiliate API — Duoduo Jinbao / 多多进宝 (recommended, stable, legal).**
   Register at https://open.pinduoduo.com, obtain ``client_id`` / ``client_secret``
   and a promotion ``pid``, then call ``pdd.ddk.goods.detail`` (or
   ``pdd.ddk.goods.search``) and read ``min_group_price`` / ``min_normal_price``.
   Add the credentials to ``Settings`` and sign requests with the platform's
   MD5 ``sign`` scheme.

2. **Headless-browser scraping (brittle).** Drive the product page with Playwright,
   solve/avoid the anti-bot challenge, and parse the embedded ``window.rawData``
   / ``__NEXT_DATA__`` JSON. Expect frequent breakage.

Until one of those is wired up, products using ``fetcher="pdd"`` will record a
clear error on each check instead of crashing the monitor.
"""

from __future__ import annotations

from .base import FetchResult, PriceFetcher


class PinduoduoFetcher(PriceFetcher):
    name = "pdd"

    def fetch(self, goods_id: str, url: str = "") -> FetchResult:
        return FetchResult.failure(
            "Real Pinduoduo fetcher is not configured. Supply Duoduo Jinbao "
            "(开放平台) API credentials or implement a scraper in "
            "pddapp/fetchers/pdd.py. See the module docstring for guidance."
        )
