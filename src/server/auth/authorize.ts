import { auth } from "@/lib/auth";

/**
 * The real authorization boundary. Every protected server component,
 * route handler, and server action calls one of these directly — never
 * relies on proxy.ts (see the comment there for why).
 *
 * These re-check the session on the server for every call. They deliberately
 * do NOT trust anything passed in from the client (a role in a request body,
 * a hidden form field, etc.).
 */

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to do that.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type Role = "TRAVELER" | "HOST" | "ADMIN" | "SUPER_ADMIN";

/** Throws if there is no signed-in user. Returns the session otherwise. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthenticatedError();
  }
  return session;
}

/**
 * Throws if there is no signed-in user, or if their role is not one of
 * `allowedRoles`. SUPER_ADMIN is not implicitly granted access to
 * HOST/TRAVELER-only routes — list every role a route should allow
 * explicitly, so permissions stay easy to audit by reading the call site.
 */
export async function requireRole(allowedRoles: Role[]) {
  const session = await requireUser();
  const role = session.user.role as Role;

  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError();
  }

  return session;
}
