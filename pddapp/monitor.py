"""Core monitoring logic: check products, record history, fire alerts.

The threshold rule is edge-triggered: an alert fires only on the transition from
"above threshold" to "at/below threshold". While a product stays below, it does
not re-alert; once it climbs back above, the next dip alerts again. This keeps a
single price drop from producing an alert on every scheduler tick.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from .config import settings
from .database import session_scope
from .fetchers import FetchResult, get_fetcher
from .models import AlertLog, PriceHistory, Product
from .models import _utcnow
from .notifiers import Alert, NotifierManager, build_default_manager

logger = logging.getLogger("pddapp.monitor")


@dataclass(slots=True)
class CheckOutcome:
    product_id: int
    product_name: str
    ok: bool
    price: float | None
    below_threshold: bool
    alerted: bool
    channels: list[str]
    error: str | None = None


def check_product(
    session: Session,
    product: Product,
    manager: NotifierManager,
) -> CheckOutcome:
    """Check a single product, persist the result, and alert if newly below."""
    fetcher = get_fetcher(product.fetcher)
    try:
        result = fetcher.fetch(product.goods_id, product.url)
    except Exception as exc:  # noqa: BLE001 - a fetcher must never crash a run
        logger.exception("Fetcher %r raised for product %s", product.fetcher, product.id)
        result = FetchResult.failure(f"fetcher crashed: {exc}")

    now = _utcnow()

    # Always record the observation (success or failure) for history/debugging.
    session.add(
        PriceHistory(
            product_id=product.id,
            price=result.price,
            original_price=result.original_price,
            in_stock=result.in_stock,
            ok=result.ok,
            error=result.error,
            fetched_at=now,
        )
    )
    product.last_checked_at = now
    product.last_error = result.error

    if not result.ok or result.price is None:
        return CheckOutcome(
            product_id=product.id,
            product_name=product.name,
            ok=False,
            price=None,
            below_threshold=product.is_below_threshold,
            alerted=False,
            channels=[],
            error=result.error,
        )

    product.last_price = result.price
    product.last_original_price = result.original_price
    product.last_in_stock = result.in_stock

    now_below = result.price <= product.threshold_price
    was_below = product.is_below_threshold
    product.is_below_threshold = now_below

    alerted = False
    channels: list[str] = []
    # Edge trigger: only alert on the False -> True transition, and only if the
    # item is actually purchasable.
    if now_below and not was_below and result.in_stock:
        alert = Alert(
            product_name=product.name,
            goods_id=product.goods_id,
            url=product.url,
            price=result.price,
            threshold_price=product.threshold_price,
            original_price=result.original_price,
            currency=settings.currency_symbol,
        )
        channels = manager.dispatch(alert)
        alerted = True
        session.add(
            AlertLog(
                product_id=product.id,
                price=result.price,
                threshold_price=product.threshold_price,
                channels=",".join(channels),
                message=alert.subject,
            )
        )
        logger.info(
            "Alert for product %s at %.2f (threshold %.2f) via %s",
            product.id,
            result.price,
            product.threshold_price,
            channels or "no channels",
        )

    return CheckOutcome(
        product_id=product.id,
        product_name=product.name,
        ok=True,
        price=result.price,
        below_threshold=now_below,
        alerted=alerted,
        channels=channels,
    )


def check_all(manager: NotifierManager | None = None) -> list[CheckOutcome]:
    """Check every active product. Used by the scheduler and the API."""
    manager = manager or build_default_manager()
    outcomes: list[CheckOutcome] = []
    with session_scope() as session:
        products = session.query(Product).filter(Product.active.is_(True)).all()
        for product in products:
            outcomes.append(check_product(session, product, manager))
    logger.info("Checked %d product(s)", len(outcomes))
    return outcomes


def check_one(product_id: int, manager: NotifierManager | None = None) -> CheckOutcome | None:
    """Check a single product by id (used by the 'Check now' button)."""
    manager = manager or build_default_manager()
    with session_scope() as session:
        product = session.get(Product, product_id)
        if product is None:
            return None
        return check_product(session, product, manager)
