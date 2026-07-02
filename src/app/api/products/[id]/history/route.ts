import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const history = await prisma.priceHistory.findMany({
    where: { productId: id },
    orderBy: { fetchedAt: "desc" },
    take: 500,
  });
  return NextResponse.json(history);
}
