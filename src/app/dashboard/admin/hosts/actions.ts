"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/server/auth/page-guards";
import { suspendHost, unsuspendHost } from "@/server/services/moderation-service";
import { userMessageFor } from "@/server/services/errors";
import { notifyHostSuspension } from "@/server/email/notifications";
import type { ActionState } from "../../_components/action-state";

function refresh() {
  revalidatePath("/dashboard/admin", "layout");
  revalidatePath("/", "layout"); // search + property pages drop/restore this host's listings
}

export async function suspendHostAction(hostProfileId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin(`/dashboard/admin/hosts/${hostProfileId}`);
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: "Give a reason of at least 10 characters. The host will see it." };
  try {
    await suspendHost(session.user.id, hostProfileId, reason.slice(0, 1000));
  } catch (err) {
    return { error: userMessageFor(err, "suspend-host") };
  }
  after(() => notifyHostSuspension(hostProfileId, true));
  refresh();
  return { error: null, message: "Host suspended. Their listings are hidden from travelers now." };
}

export async function unsuspendHostAction(hostProfileId: string): Promise<ActionState> {
  const session = await requireAdmin(`/dashboard/admin/hosts/${hostProfileId}`);
  try {
    await unsuspendHost(session.user.id, hostProfileId);
  } catch (err) {
    return { error: userMessageFor(err, "unsuspend-host") };
  }
  after(() => notifyHostSuspension(hostProfileId, false));
  refresh();
  return { error: null };
}
