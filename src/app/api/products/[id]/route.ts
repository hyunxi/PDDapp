import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.fetcher === "string") data.fetcher = body.fetcher;
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.thresholdPrice != null) {
    const t = Number(body.thresholdPrice);
    if (Number.isFinite(t) && t > 0) data.thresholdPrice = t;
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.product.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
