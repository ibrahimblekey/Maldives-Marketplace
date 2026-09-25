import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 no longer reads the database URL from schema.prisma — it lives
 * here instead. `dotenv/config` loads a local .env file during development;
 * on Vercel, DATABASE_URL comes from the project's Environment Variables.
 *
 * The URL is read with process.env (not Prisma's env() helper) so that
 * `prisma generate` still works in places where no database is configured —
 * generating the client doesn't need a connection, only migrations do.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
