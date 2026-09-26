"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyBookingCancelled } from "@/server/email/notifications";
import { requireRoleOrRedirect } from "@/server/auth/page-guards";
import { cancelAsGuest } from "@/server/services/booking-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../_components/action-state";

export async function cancelTripAction(bookingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRoleOrRedirect(["TRAVELER"], "/dashboard/traveler");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  try {
    await cancelAsGuest(session.user.id, bookingId, reason);
  } catch (err) {
    return { error: userMessageFor(err, "cancel-trip") };
  }
  after(() => notifyBookingCancelled(bookingId, "guest"));
  revalidatePath("/dashboard/traveler", "layout");
  return { error: null, message: "Your booking has been cancelled." };
}
