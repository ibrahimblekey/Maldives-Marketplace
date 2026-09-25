import { redirect } from "next/navigation";
import { requireRole, ForbiddenError, UnauthenticatedError, type Role } from "./authorize";

/**
 * requireRole() for server components and server actions: instead of
 * throwing, a logged-out visitor is sent to /login (and back afterwards),
 * and a signed-in user with the wrong role is sent to their own dashboard.
 * Same checks, just without repeating the try/catch in every file.
 */
export async function requireRoleOrRedirect(allowedRoles: Role[], callbackUrl: string) {
  try {
    return await requireRole(allowedRoles);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    if (err instanceof ForbiddenError) redirect("/dashboard");
    throw err;
  }
}

export const requireHost = (callbackUrl = "/dashboard/host") => requireRoleOrRedirect(["HOST"], callbackUrl);

export const requireAdmin = (callbackUrl = "/dashboard/admin") =>
  requireRoleOrRedirect(["ADMIN", "SUPER_ADMIN"], callbackUrl);
