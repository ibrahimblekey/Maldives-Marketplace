"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRoleOrRedirect } from "@/server/auth/page-guards";
import { parseStay } from "@/lib/stay-pricing";
import { createBooking } from "@/server/services/booking-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "@/app/dashboard/_components/action-state";

const bookingFormSchema = z.object({
  numRooms: z.coerce.number().int().min(1, "Choose how many rooms").max(10),
  numGuests: z.coerce.number().int().min(1, "Enter the number of guests").max(50),
  guestName: z.string().trim().min(2, "Enter the lead guest's full name").max(120),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a phone number the host can reach you on, with country code"),
  specialRequests: z.string().trim().max(1000, "Special requests are too long (max 1000 characters)").optional(),
  agree: z.literal("on", { message: "Please confirm you've read the cancellation policy and house rules" }),
});

/**
 * Creates a booking. Only TRAVELER accounts can book. The stay, room and
 * the per-room price the traveler was shown come from .bind() on the page;
 * they're re-validated here and the service recomputes the price itself,
 * refusing the booking if it no longer matches what was shown.
 */
export async function createBookingAction(
  slug: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
  shownPerRoomCents: number,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireRoleOrRedirect(["TRAVELER"], `/stays/${slug}`);
  const { stay, error } = parseStay(checkIn, checkOut);
  if (!stay) return { error: error ?? "Choose your dates again." };

  const parsed = bookingFormSchema.safeParse({
    numRooms: formData.get("numRooms"),
    numGuests: formData.get("numGuests"),
    guestName: formData.get("guestName"),
    contactPhone: formData.get("contactPhone"),
    specialRequests: formData.get("specialRequests") || undefined,
    agree: formData.get("agree"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  let bookingId: string;
  try {
    const booking = await createBooking(session.user.id, {
      propertySlug: slug,
      roomId,
      stay,
      numRooms: parsed.data.numRooms,
      numGuests: parsed.data.numGuests,
      guestName: parsed.data.guestName,
      contactPhone: parsed.data.contactPhone,
      specialRequests: parsed.data.specialRequests,
      expectedTotalCents: shownPerRoomCents * parsed.data.numRooms,
    });
    bookingId = booking.id;
  } catch (err) {
    return { error: userMessageFor(err, "create-booking") };
  }
  redirect(`/dashboard/traveler/trips/${bookingId}?booked=1`);
}
