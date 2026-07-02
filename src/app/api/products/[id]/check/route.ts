import { NextRequest, NextResponse } from "next/server";
import { checkOne } from "@/lib/monitor";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const outcome = await checkOne(id);
  if (!outcome) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(outcome);
}
