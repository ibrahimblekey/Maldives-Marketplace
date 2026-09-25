"use server";

import { redirect } from "next/navigation";
import { unstable_update } from "@/lib/auth";
import { requireRoleOrRedirect } from "@/server/auth/page-guards";
import { hostProfileInputSchema } from "@/lib/validation/host";
import { becomeHost } from "@/server/services/host-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../_components/action-state";

/**
 * Turns the signed-in traveler into a host. HOST is also allowed here for
 * the edge case of a host account without host details (e.g. a role set
 * by hand in the database) — becomeHost() refuses if details already exist.
 */
export async function becomeHostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRoleOrRedirect(["TRAVELER", "HOST"], "/dashboard/become-host");

  const parsed = hostProfileInputSchema.safeParse({
    businessName: formData.get("businessName"),
    contactPhone: formData.get("contactPhone"),
    businessRegistrationNumber: formData.get("businessRegistrationNumber") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    await becomeHost(session.user.id, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "become-host") };
  }

  // Re-issue the session cookie so it carries the new HOST role right away
  // (the jwt callback in src/lib/auth.ts re-reads the role from the database).
  await unstable_update({});
  redirect("/dashboard/host");
}
