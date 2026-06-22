import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const goodsId = String(body.goodsId ?? body.goods_id ?? "").trim();
  const thresholdPrice = Number(body.thresholdPrice ?? body.threshold_price);
  const url = String(body.url ?? "").trim();
  const fetcher = String(body.fetcher ?? "") || config.defaultFetcher;

  if (!name || !goodsId || !Number.isFinite(thresholdPrice) || thresholdPrice <= 0) {
    return NextResponse.json(
      { error: "name, goodsId, and a positive thresholdPrice are required" },
      { status: 400 },
    );
  }

  const product = await prisma.product.create({
    data: { name, goodsId, url, fetcher, thresholdPrice },
  });
  return NextResponse.json(product, { status: 201 });
}
