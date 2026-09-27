"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/page-guards";
import { settingsSchema } from "@/lib/validation/settings";
import { updatePlatformSettings } from "@/server/services/settings-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../../_components/action-state";

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin("/dashboard/admin/settings");
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    await updatePlatformSettings(session.user.id, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "save-settings") };
  }
  revalidatePath("/", "layout");
  return { error: null, message: "Saved. New rates apply to bookings made from now on; existing bookings keep theirs." };
}
