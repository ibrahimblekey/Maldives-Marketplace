"use server";

import { revalidatePath } from "next/cache";
import { requireHost } from "@/server/auth/page-guards";
import { cancelAsHost, markStayOutcome } from "@/server/services/booking-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../../_components/action-state";

const path = (id: string) => `/dashboard/host/bookings/${id}`;

export async function hostCancelBookingAction(bookingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireHost(path(bookingId));
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: "Tell the guest why, in at least 10 characters. They will see this." };
  try {
    await cancelAsHost(session.user.id, bookingId, reason.slice(0, 500));
  } catch (err) {
    return { error: userMessageFor(err, "host-cancel-booking") };
  }
  revalidatePath("/dashboard/host/bookings", "layout");
  return { error: null, message: "Booking cancelled." };
}

export async function markStayOutcomeAction(bookingId: string, outcome: "COMPLETED" | "NO_SHOW"): Promise<ActionState> {
  const session = await requireHost(path(bookingId));
  if (outcome !== "COMPLETED" && outcome !== "NO_SHOW") return { error: "Invalid choice." };
  try {
    await markStayOutcome(session.user.id, bookingId, outcome);
  } catch (err) {
    return { error: userMessageFor(err, "mark-stay") };
  }
  revalidatePath("/dashboard/host/bookings", "layout");
  return { error: null };
}
