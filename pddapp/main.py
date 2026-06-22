"""FastAPI application: web dashboard + JSON API, with a background scheduler."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from .config import settings
from .database import get_session, init_db
from .fetchers import available_fetchers
from .models import Product
from .monitor import check_all, check_one
from .notifiers import build_default_manager
from .scheduler import shutdown_scheduler, start_scheduler
from .schemas import ProductCreate, ProductOut, ProductUpdate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

_BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(_BASE_DIR / "templates"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()


app = FastAPI(title="PDDapp — Pinduoduo Price Monitor", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(_BASE_DIR / "static")), name="static")


# --------------------------------------------------------------------------- #
# Web dashboard (HTML)
# --------------------------------------------------------------------------- #
@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request, session: Session = Depends(get_session)):
    products = session.query(Product).order_by(Product.created_at.desc()).all()
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "products": products,
            "fetchers": available_fetchers(),
            "default_fetcher": settings.default_fetcher,
            "currency": settings.currency_symbol,
            "channels": build_default_manager().channel_names,
            "interval": settings.check_interval_seconds,
        },
    )


@app.get("/products/{product_id}", response_class=HTMLResponse)
def product_detail(
    product_id: int, request: Request, session: Session = Depends(get_session)
):
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    history = product.history[:100]
    return templates.TemplateResponse(
        request,
        "product.html",
        {
            "product": product,
            "history": history,
            "alerts": product.alerts[:50],
            "currency": settings.currency_symbol,
        },
    )


@app.post("/products")
def create_product_form(
    name: str = Form(...),
    goods_id: str = Form(...),
    threshold_price: float = Form(...),
    url: str = Form(""),
    fetcher: str = Form(""),
    session: Session = Depends(get_session),
):
    product = Product(
        name=name.strip(),
        goods_id=goods_id.strip(),
        url=url.strip(),
        threshold_price=threshold_price,
        fetcher=(fetcher or settings.default_fetcher),
    )
    session.add(product)
    session.commit()
    return RedirectResponse(url="/", status_code=303)


@app.post("/products/{product_id}/delete")
def delete_product_form(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if product is not None:
        session.delete(product)
        session.commit()
    return RedirectResponse(url="/", status_code=303)


@app.post("/products/{product_id}/toggle")
def toggle_product_form(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if product is not None:
        product.active = not product.active
        session.commit()
    return RedirectResponse(url="/", status_code=303)


@app.post("/products/{product_id}/check")
def check_product_form(product_id: int):
    check_one(product_id)
    return RedirectResponse(url="/", status_code=303)


@app.post("/check-all")
def check_all_form():
    check_all()
    return RedirectResponse(url="/", status_code=303)


# --------------------------------------------------------------------------- #
# JSON API
# --------------------------------------------------------------------------- #
@app.get("/api/products", response_model=list[ProductOut])
def api_list_products(session: Session = Depends(get_session)):
    return session.query(Product).order_by(Product.created_at.desc()).all()


@app.post("/api/products", response_model=ProductOut, status_code=201)
def api_create_product(payload: ProductCreate, session: Session = Depends(get_session)):
    product = Product(
        name=payload.name,
        goods_id=payload.goods_id,
        url=payload.url,
        threshold_price=payload.threshold_price,
        fetcher=payload.fetcher or settings.default_fetcher,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@app.get("/api/products/{product_id}", response_model=ProductOut)
def api_get_product(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/api/products/{product_id}", response_model=ProductOut)
def api_update_product(
    product_id: int, payload: ProductUpdate, session: Session = Depends(get_session)
):
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    session.commit()
    session.refresh(product)
    return product


@app.delete("/api/products/{product_id}", status_code=204)
def api_delete_product(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    session.delete(product)
    session.commit()
    return JSONResponse(status_code=204, content=None)


@app.get("/api/products/{product_id}/history")
def api_product_history(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return [
        {
            "price": h.price,
            "original_price": h.original_price,
            "in_stock": h.in_stock,
            "ok": h.ok,
            "error": h.error,
            "fetched_at": h.fetched_at.isoformat() if h.fetched_at else None,
        }
        for h in product.history[:500]
    ]


@app.post("/api/products/{product_id}/check")
def api_check_product(product_id: int):
    outcome = check_one(product_id)
    if outcome is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return outcome


@app.post("/api/check-all")
def api_check_all():
    return check_all()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
