"""Pydantic schemas for the JSON API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    goods_id: str = Field(..., min_length=1, max_length=255)
    url: str = ""
    threshold_price: float = Field(..., gt=0)
    fetcher: str = "mock"


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    threshold_price: float | None = Field(default=None, gt=0)
    fetcher: str | None = None
    active: bool | None = None


class PriceHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    price: float | None
    original_price: float | None
    in_stock: bool
    ok: bool
    error: str | None
    fetched_at: datetime


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    goods_id: str
    url: str
    threshold_price: float
    fetcher: str
    active: bool
    last_price: float | None
    last_original_price: float | None
    last_in_stock: bool
    last_checked_at: datetime | None
    last_error: str | None
    is_below_threshold: bool
    created_at: datetime
