// Ensures the Prisma CLI has DATABASE_URL and DIRECT_URL during the build.
//
// The Supabase / Vercel Postgres integration injects POSTGRES_PRISMA_URL and
// POSTGRES_URL_NON_POOLING (not DATABASE_URL / DIRECT_URL), which `prisma db push`
// wouldn't otherwise find. This maps whatever is present onto the names the
// schema reads, by appending them to .env (which the Prisma CLI auto-loads and
// which never overrides real environment variables).

import { appendFileSync, existsSync, readFileSync } from "node:fs";

const pooled =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

const direct =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  pooled;

if (!pooled) {
  console.error(
    "[prisma-env] No database connection string found. Set DATABASE_URL, or " +
      "connect the Supabase/Vercel Postgres integration (POSTGRES_PRISMA_URL).",
  );
  process.exit(1);
}

const existing = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const lines = [];
if (!process.env.DATABASE_URL && !/^DATABASE_URL=/m.test(existing)) {
  lines.push(`DATABASE_URL=${pooled}`);
}
if (!process.env.DIRECT_URL && !/^DIRECT_URL=/m.test(existing)) {
  lines.push(`DIRECT_URL=${direct}`);
}

if (lines.length > 0) {
  appendFileSync(".env", `\n${lines.join("\n")}\n`);
  console.log(
    "[prisma-env] Mapped integration DB vars →",
    lines.map((l) => l.split("=")[0]).join(", "),
  );
} else {
  console.log("[prisma-env] DATABASE_URL / DIRECT_URL already present.");
}
