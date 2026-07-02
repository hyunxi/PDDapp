// Core monitoring logic: check products, record history, fire alerts.
//
// The threshold rule is edge-triggered: an alert fires only on the transition
// from "above threshold" to "at/below threshold". While a product stays below,
// it does not re-alert; once it climbs back above, the next dip alerts again.
// This keeps a single price drop from alerting on every scheduler tick.

import type { Product } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./db";
import { getFetcher } from "./fetchers";
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

export async function checkProduct(
  product: Product,
  manager: NotifierManager,
): Promise<CheckOutcome> {
  const fetcher = getFetcher(product.fetcher);

  let result;
  try {
    result = await fetcher.fetch(product.goodsId, product.url);
  } catch (err) {
    result = {
      ok: false,
      inStock: false,
      error: `fetcher crashed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

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
  const products = await prisma.product.findMany({ where: { active: true } });
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
