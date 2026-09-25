"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHost } from "@/server/auth/page-guards";
import { hostProfileInputSchema } from "@/lib/validation/host";
import { becomeHost, getHostProfile, updateHostProfile } from "@/server/services/host-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../_components/action-state";

/** Saves host details: creates them if this host has none yet, otherwise updates them. */
export async function saveHostProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireHost("/dashboard/host/profile");

  const parsed = hostProfileInputSchema.safeParse({
    businessName: formData.get("businessName"),
    contactPhone: formData.get("contactPhone"),
    businessRegistrationNumber: formData.get("businessRegistrationNumber") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    if (await getHostProfile(session.user.id)) {
      await updateHostProfile(session.user.id, parsed.data);
    } else {
      await becomeHost(session.user.id, parsed.data);
    }
  } catch (err) {
    return { error: userMessageFor(err, "host-profile") };
  }
  revalidatePath("/dashboard/host");
  redirect("/dashboard/host");
}
