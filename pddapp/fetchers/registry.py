"""Fetcher registry — maps a fetcher name to a singleton instance."""

from __future__ import annotations

from .base import PriceFetcher
from .mock import MockFetcher
from .pdd import PinduoduoFetcher

_REGISTRY: dict[str, PriceFetcher] = {
    MockFetcher.name: MockFetcher(),
    PinduoduoFetcher.name: PinduoduoFetcher(),
}


def available_fetchers() -> list[str]:
    return sorted(_REGISTRY.keys())


def get_fetcher(name: str) -> PriceFetcher:
    """Return the fetcher registered under ``name``.

    Falls back to the mock fetcher for unknown names so a bad config value never
    takes the whole monitor down.
    """
    return _REGISTRY.get(name, _REGISTRY[MockFetcher.name])
