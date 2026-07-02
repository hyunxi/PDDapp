// Prisma client singleton. In dev, Next.js hot-reload would otherwise create a
// new client on every change and exhaust connections.

import { PrismaClient } from "@prisma/client";

// Resolve the (pooled) connection string. Supports both a manually-set
// DATABASE_URL and the variable names injected by the Supabase / Vercel Postgres
// integration (POSTGRES_PRISMA_URL / POSTGRES_URL), so the app works out of the
// box whichever way the database was connected.
function resolvePooledDbUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    undefined
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbUrl = resolvePooledDbUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
