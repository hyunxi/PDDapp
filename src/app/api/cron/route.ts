// Secured endpoint that checks every active product. Trigger it from:
//   • Vercel Cron (vercel.json) — sends "Authorization: Bearer $CRON_SECRET".
//   • Supabase pg_cron + pg_net — pass the same bearer header (see README).
//   • Any external scheduler (cron-job.org, GitHub Actions) with the header
//     OR a ?secret=... query param.

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { checkAll } from "@/lib/monitor";

export const dynamic = "force-dynamic";
// Allow a longer window for many products on one check run.
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  // If no secret is configured, allow (useful for local dev only).
  if (!config.cronSecret) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${config.cronSecret}`) return true;
  const qs = req.nextUrl.searchParams.get("secret");
  return qs === config.cronSecret;
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const outcomes = await checkAll();
  return NextResponse.json({
    checked: outcomes.length,
    alerted: outcomes.filter((o) => o.alerted).length,
    durationMs: Date.now() - started,
    outcomes,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
