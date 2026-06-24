// Store / remove a browser Web Push subscription.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface IncomingSub {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: NextRequest) {
  const sub: IncomingSub = await req.json().catch(() => ({}));
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const sub: IncomingSub = await req.json().catch(() => ({}));
  if (!sub.endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
  return NextResponse.json({ ok: true });
}
