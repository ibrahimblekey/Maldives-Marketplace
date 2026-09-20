import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client singleton.
 *
 * Next.js dev mode hot-reloads server modules, which would otherwise create
 * a new PrismaClient (and a new DB connection pool) on every file save.
 * Stashing the instance on `globalThis` in development avoids exhausting
 * the Postgres connection limit.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
