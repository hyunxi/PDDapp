// Accepts an externally-scraped price and applies it to matching products
// (recording history + firing threshold alerts). Secured with CRON_SECRET so
// only your scraper (GitHub Actions) — or your own scripts — can post prices.
//
// Body: { "goodsId": "123456", "price": 79.9, "originalPrice"?: 129,
//         "inStock"?: true, "title"?: "..." }
// You may also POST { "items": [ {goodsId, price, ...}, ... ] } to batch.

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { ingestPrice } from "@/lib/monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  if (!config.cronSecret) return true; // dev convenience only
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${config.cronSecret}`) return true;
  return req.nextUrl.searchParams.get("secret") === config.cronSecret;
}

interface IngestItem {
  goodsId?: string;
  price?: number;
  originalPrice?: number | null;
  inStock?: boolean;
  title?: string | null;
}

function normalize(item: IngestItem): { goodsId: string; price: number; originalPrice: number | null; inStock: boolean; title: string | null } | null {
  const goodsId = String(item.goodsId ?? "").trim();
  const price = Number(item.price);
  if (!goodsId || !Number.isFinite(price) || price <= 0) return null;
  return {
    goodsId,
    price,
    originalPrice: item.originalPrice != null ? Number(item.originalPrice) : null,
    inStock: item.inStock ?? true,
    title: item.title ?? null,
  };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rawItems: IngestItem[] = Array.isArray(body.items) ? body.items : [body];
  const items = rawItems.map(normalize).filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length === 0) {
    return NextResponse.json(
      { error: "provide goodsId and a positive price (or an items[] array)" },
      { status: 400 },
    );
  }

  let matched = 0;
  let alerted = 0;
  for (const item of items) {
    const outcomes = await ingestPrice(item.goodsId, item);
    matched += outcomes.length;
    alerted += outcomes.filter((o) => o.alerted).length;
  }

  return NextResponse.json({ received: items.length, matched, alerted });
}
