// Core monitoring logic: check products, record history, fire alerts.
//
// The threshold rule is edge-triggered: an alert fires only on the transition
// from "above threshold" to "at/below threshold". While a product stays below,
// it does not re-alert; once it climbs back above, the next dip alerts again.
// This keeps a single price drop from alerting on every scheduler tick.

import type { Product } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./db";
import { FetchResult, getFetcher } from "./fetchers";
import { NotifierManager, buildDefaultManager, makeAlert } from "./notifiers";

export interface CheckOutcome {
  productId: number;
  productName: string;
  ok: boolean;
  price: number | null;
  belowThreshold: boolean;
  alerted: boolean;
  channels: string[];
  error?: string | null;
}

// Products with this fetcher are fed by the external scraper via /api/ingest,
// so the scheduled fetch skips them (it has no way to get their price itself).
export const EXTERNAL_FETCHER = "external";

export async function checkProduct(
  product: Product,
  manager: NotifierManager,
): Promise<CheckOutcome> {
  const fetcher = getFetcher(product.fetcher);

  let result: FetchResult;
  try {
    result = await fetcher.fetch(product.goodsId, product.url);
  } catch (err) {
    result = {
      ok: false,
      inStock: false,
      error: `fetcher crashed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return applyResult(product, result, manager);
}

// Record an observation against a product and fire an edge-triggered alert.
// Shared by the scheduled fetch (checkProduct) and external ingest (ingestPrice).
export async function applyResult(
  product: Product,
  result: FetchResult,
  manager: NotifierManager,
): Promise<CheckOutcome> {
  const now = new Date();

  // Always record the observation (success or failure) for history/debugging.
  await prisma.priceHistory.create({
    data: {
      productId: product.id,
      price: result.price ?? null,
      originalPrice: result.originalPrice ?? null,
      inStock: result.inStock,
      ok: result.ok,
      error: result.error ?? null,
      fetchedAt: now,
    },
  });

  if (!result.ok || result.price == null) {
    await prisma.product.update({
      where: { id: product.id },
      data: { lastCheckedAt: now, lastError: result.error ?? "unknown error" },
    });
    return {
      productId: product.id,
      productName: product.name,
      ok: false,
      price: null,
      belowThreshold: product.isBelowThreshold,
      alerted: false,
      channels: [],
      error: result.error ?? null,
    };
  }

  const price = result.price;
  const nowBelow = price <= product.thresholdPrice;
  const wasBelow = product.isBelowThreshold;

  // Edge trigger: only alert on the false -> true transition, and only if the
  // item is actually purchasable.
  let alerted = false;
  let channels: string[] = [];
  if (nowBelow && !wasBelow && result.inStock) {
    const alert = makeAlert({
      productName: product.name,
      goodsId: product.goodsId,
      url: product.url,
      price,
      thresholdPrice: product.thresholdPrice,
      originalPrice: result.originalPrice ?? null,
    });
    channels = await manager.dispatch(alert);
    alerted = true;
    await prisma.alertLog.create({
      data: {
        productId: product.id,
        price,
        thresholdPrice: product.thresholdPrice,
        channels: channels.join(","),
        message: `Price drop: ${product.name} now ${config.currencySymbol}${price.toFixed(2)}`,
      },
    });
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      lastPrice: price,
      lastOriginalPrice: result.originalPrice ?? null,
      lastInStock: result.inStock,
      lastCheckedAt: now,
      lastError: null,
      isBelowThreshold: nowBelow,
    },
  });

  return {
    productId: product.id,
    productName: product.name,
    ok: true,
    price,
    belowThreshold: nowBelow,
    alerted,
    channels,
  };
}

export async function checkAll(manager?: NotifierManager): Promise<CheckOutcome[]> {
  const mgr = manager ?? buildDefaultManager();
  // Skip externally-fed products — their price arrives via /api/ingest, not a
  // fetcher, so "checking" them here would only record errors.
  const products = await prisma.product.findMany({
    where: { active: true, fetcher: { not: EXTERNAL_FETCHER } },
  });
  const outcomes: CheckOutcome[] = [];
  for (const product of products) {
    outcomes.push(await checkProduct(product, mgr));
  }
  return outcomes;
}

export async function checkOne(
  productId: number,
  manager?: NotifierManager,
): Promise<CheckOutcome | null> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return null;
  return checkProduct(product, manager ?? buildDefaultManager());
}

// Apply an externally-scraped price (from /api/ingest) to every active product
// sharing the given goodsId. Returns one outcome per matched product.
export async function ingestPrice(
  goodsId: string,
  data: { price: number; originalPrice?: number | null; inStock?: boolean; title?: string | null },
  manager?: NotifierManager,
): Promise<CheckOutcome[]> {
  const mgr = manager ?? buildDefaultManager();
  const products = await prisma.product.findMany({
    where: { active: true, goodsId },
  });
  const result: FetchResult = {
    ok: true,
    price: data.price,
    originalPrice: data.originalPrice ?? null,
    inStock: data.inStock ?? true,
    title: data.title ?? null,
  };
  const outcomes: CheckOutcome[] = [];
  for (const product of products) {
    outcomes.push(await applyResult(product, result, mgr));
  }
  return outcomes;
}
