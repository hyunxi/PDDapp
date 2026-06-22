"""ORM models: watched products, their price history, and alert log."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Product(Base):
    """A Pinduoduo product being watched for a price threshold."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # PDD goods identifier and/or share URL. The mock fetcher derives a stable
    # baseline price from this string; a real fetcher would parse it.
    goods_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    url: Mapped[str] = mapped_column(Text, default="")
    threshold_price: Mapped[float] = mapped_column(Float, nullable=False)
    fetcher: Mapped[str] = mapped_column(String(32), default="mock")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Snapshot of the most recent check (denormalized for fast dashboard render).
    last_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_original_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Alert de-duplication: True while price has been continuously at/below
    # threshold. We only fire an alert on the transition into this state.
    is_below_threshold: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    history: Mapped[list["PriceHistory"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="PriceHistory.fetched_at.desc()",
    )
    alerts: Mapped[list["AlertLog"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="AlertLog.created_at.desc()",
    )


class PriceHistory(Base):
    """A single observed price point for a product."""

    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    original_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    product: Mapped["Product"] = relationship(back_populates="history")


class AlertLog(Base):
    """Record of an alert that was dispatched when a threshold was crossed."""

    __tablename__ = "alert_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    price: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_price: Mapped[float] = mapped_column(Float, nullable=False)
    channels: Mapped[str] = mapped_column(String(255), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    product: Mapped["Product"] = relationship(back_populates="alerts")
