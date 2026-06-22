"""The price-fetcher interface that every data source implements.

Swapping the data source (mock today, real Pinduoduo later) is just a matter of
implementing :class:`PriceFetcher` and registering it in ``registry.py``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(slots=True)
class FetchResult:
    """The outcome of fetching a single product's current price.

    Either ``ok`` is True and ``price`` is populated, or ``ok`` is False and
    ``error`` explains why. Monitoring never raises on a failed fetch — it
    records the error and moves on to the next product.
    """

    ok: bool
    price: float | None = None
    original_price: float | None = None
    title: str | None = None
    in_stock: bool = True
    error: str | None = None
    raw: dict | None = None

    @classmethod
    def success(
        cls,
        price: float,
        *,
        original_price: float | None = None,
        title: str | None = None,
        in_stock: bool = True,
        raw: dict | None = None,
    ) -> "FetchResult":
        return cls(
            ok=True,
            price=price,
            original_price=original_price,
            title=title,
            in_stock=in_stock,
            raw=raw,
        )

    @classmethod
    def failure(cls, error: str) -> "FetchResult":
        return cls(ok=False, error=error)


class PriceFetcher(ABC):
    """Abstract base class for a price data source.

    Implementations should be cheap to construct and safe to reuse across
    checks. ``fetch`` must never raise for an expected "couldn't get the price"
    condition — return ``FetchResult.failure(...)`` instead.
    """

    #: Short stable identifier used in config and the ``products.fetcher`` column.
    name: str = "base"

    @abstractmethod
    def fetch(self, goods_id: str, url: str = "") -> FetchResult:
        """Return the current price for the given Pinduoduo product."""
        raise NotImplementedError
