import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma Client singleton.
 *
 * Prisma 7 connects through a "driver adapter" — here the standard
 * PostgreSQL one — instead of a built-in engine, so the connection URL is
 * passed in explicitly.
 *
 * Next.js dev mode hot-reloads server modules, which would otherwise create
 * a new PrismaClient (and a new DB connection pool) on every file save.
 * Stashing the instance on `globalThis` in development avoids exhausting
 * the Postgres connection limit.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
