import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RegisterInput } from "@/lib/validation/auth";

/**
 * Business logic for creating accounts. Kept separate from the route
 * handler so it can be reused (e.g. by an admin-created-user flow later)
 * without duplicating the hashing/role rules.
 */

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

// bcrypt cost factor. 12 is a reasonable default in 2026: expensive enough
// to resist offline brute-forcing, cheap enough not to bottleneck the server.
const BCRYPT_COST_FACTOR = 12;

/**
 * Registers a new TRAVELER account.
 *
 * Role is hard-coded to TRAVELER here — it is never accepted as input from
 * the client, by design. There is no code path from this function that can
 * produce a HOST, ADMIN, or SUPER_ADMIN account:
 * - HOST accounts are created via the (future) host onboarding flow, which
 *   still starts a user as TRAVELER and separately creates a HostProfile
 *   pending verification.
 * - ADMIN/SUPER_ADMIN accounts are never self-service; they're created
 *   directly in the database (see prisma/seed.ts) or by another admin.
 */
export async function registerTraveler(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: "TRAVELER",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  } catch (err) {
    // The findUnique check above is a fast, friendly path — this catch is
    // the real guarantee. Two concurrent requests for the same email can
    // both pass the check above; the database's unique constraint on
    // User.email is what actually prevents a duplicate, and P2002 is
    // Prisma's error code for a violated unique constraint.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailAlreadyRegisteredError();
    }
    throw err;
  }
}
