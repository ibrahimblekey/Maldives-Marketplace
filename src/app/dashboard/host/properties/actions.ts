"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHost } from "@/server/auth/page-guards";
import {
  policiesSchema,
  propertyBasicsSchema,
  roomInputSchema,
  seasonalPriceSchema,
} from "@/lib/validation/property";
import * as propertyService from "@/server/services/property-service";
import { userMessageFor } from "@/server/services/errors";
import { deletePropertyPhotos } from "@/server/storage/photo-storage";
import type { ActionState } from "../../_components/action-state";

/**
 * Server actions for the host listing wizard.
 *
 * Each one re-checks the HOST role itself (a server action can be called
 * directly, not only from the page that renders it), validates its input
 * with zod, and then calls property-service, which enforces that the
 * property actually belongs to the signed-in host. Ids arrive via .bind()
 * from the page — they are treated as untrusted input like everything else.
 */

const HOST_HOME = "/dashboard/host";
const propertyPath = (id: string) => `/dashboard/host/properties/${id}`;

function refresh(propertyId: string) {
  revalidatePath(propertyPath(propertyId), "layout");
  revalidatePath(HOST_HOME);
}

function firstIssue(error: { issues: { message: string }[] }) {
  return { error: error.issues[0]?.message ?? "Invalid input." };
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
};

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

function basicsFrom(formData: FormData) {
  return {
    name: text(formData, "name") ?? "",
    description: text(formData, "description") ?? "",
    propertyTypeId: text(formData, "propertyTypeId") ?? "",
    islandId: text(formData, "islandId") ?? "",
    address: text(formData, "address"),
    distanceFromBeachMeters: text(formData, "distanceFromBeachMeters"),
    distanceFromHarborMeters: text(formData, "distanceFromHarborMeters"),
  };
}

export async function createPropertyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireHost(`${HOST_HOME}/properties/new`);
  const parsed = propertyBasicsSchema.safeParse(basicsFrom(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  let propertyId: string;
  try {
    propertyId = (await propertyService.createProperty(session.user.id, parsed.data)).id;
  } catch (err) {
    return { error: userMessageFor(err, "create-property") };
  }
  revalidatePath(HOST_HOME);
  redirect(`${propertyPath(propertyId)}/rooms`);
}

// On a live listing, type/island/address are locked (their inputs are
// disabled, so the browser doesn't send them) — validate only the rest.
const liveBasicsSchema = propertyBasicsSchema.pick({
  name: true,
  description: true,
  distanceFromBeachMeters: true,
  distanceFromHarborMeters: true,
});

export async function saveBasicsAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  const isLive = formData.get("isLive") === "1";
  const parsed = (isLive ? liveBasicsSchema : propertyBasicsSchema).safeParse(basicsFrom(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  let changeRequested: boolean;
  try {
    changeRequested = await propertyService.updateBasics(session.user.id, propertyId, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "save-basics") };
  }
  refresh(propertyId);
  if (!isLive) redirect(`${propertyPath(propertyId)}/rooms`);
  return {
    error: null,
    message: changeRequested
      ? "Saved. Your new name/description has been sent for review. Travelers keep seeing the current version until it's approved."
      : "Saved.",
  };
}

// ---------------------------------------------------------------------------
// Rooms + seasonal prices
// ---------------------------------------------------------------------------

function roomFrom(formData: FormData) {
  return {
    name: text(formData, "name") ?? "",
    description: text(formData, "description"),
    maxOccupancy: text(formData, "maxOccupancy"),
    bedConfiguration: text(formData, "bedConfiguration"),
    sizeSqm: text(formData, "sizeSqm"),
    mealPlan: text(formData, "mealPlan"),
    basePrice: text(formData, "basePrice") ?? "",
    currency: text(formData, "currency"),
    minStayNights: text(formData, "minStayNights"),
    maxStayNights: text(formData, "maxStayNights"),
    extraGuestFee: text(formData, "extraGuestFee"),
    extraBedFee: text(formData, "extraBedFee"),
    unitCount: text(formData, "unitCount"),
    amenityIds: formData.getAll("amenityIds").filter((v): v is string => typeof v === "string"),
  };
}

export async function createRoomAction(propertyId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  const parsed = roomInputSchema.safeParse(roomFrom(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    await propertyService.createRoom(session.user.id, propertyId, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "create-room") };
  }
  refresh(propertyId);
  redirect(`${propertyPath(propertyId)}/rooms`);
}

export async function updateRoomAction(
  propertyId: string,
  roomId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  const parsed = roomInputSchema.safeParse(roomFrom(formData));
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    await propertyService.updateRoom(session.user.id, propertyId, roomId, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "update-room") };
  }
  refresh(propertyId);
  return { error: null, message: "Saved. Prices and room counts take effect immediately." };
}

export async function deleteRoomAction(propertyId: string, roomId: string): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    await propertyService.deleteRoom(session.user.id, propertyId, roomId);
  } catch (err) {
    return { error: userMessageFor(err, "delete-room") };
  }
  refresh(propertyId);
  redirect(`${propertyPath(propertyId)}/rooms`);
}

export async function addSeasonalPriceAction(
  propertyId: string,
  roomId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  const parsed = seasonalPriceSchema.safeParse({
    name: text(formData, "name"),
    startDate: text(formData, "startDate") ?? "",
    endDate: text(formData, "endDate") ?? "",
    pricePerNight: text(formData, "pricePerNight") ?? "",
    minStayNights: text(formData, "minStayNights"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    await propertyService.addSeasonalPrice(session.user.id, propertyId, roomId, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "add-seasonal-price") };
  }
  refresh(propertyId);
  return { error: null, message: "Seasonal price added." };
}

export async function deleteSeasonalPriceAction(
  propertyId: string,
  roomId: string,
  seasonalPriceId: string
): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    await propertyService.deleteSeasonalPrice(session.user.id, propertyId, roomId, seasonalPriceId);
  } catch (err) {
    return { error: userMessageFor(err, "delete-seasonal-price") };
  }
  refresh(propertyId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Amenities + policies
// ---------------------------------------------------------------------------

export async function saveAmenitiesAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  const amenityIds = formData.getAll("amenityIds").filter((v): v is string => typeof v === "string");
  if (amenityIds.length > 100) return { error: "Too many amenities selected." };

  try {
    await propertyService.setPropertyAmenities(session.user.id, propertyId, amenityIds);
  } catch (err) {
    return { error: userMessageFor(err, "save-amenities") };
  }
  refresh(propertyId);
  if (formData.get("isLive") !== "1") redirect(`${propertyPath(propertyId)}/policies`);
  return { error: null, message: "Saved." };
}

export async function savePoliciesAction(
  propertyId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  const parsed = policiesSchema.safeParse({
    checkInTime: text(formData, "checkInTime") ?? "",
    checkOutTime: text(formData, "checkOutTime") ?? "",
    freeCancellationDays: text(formData, "freeCancellationDays"),
    refundPercentageAfter: text(formData, "refundPercentageAfter"),
    description: text(formData, "description"),
    childrenPolicy: text(formData, "childrenPolicy"),
    extraBedPolicy: text(formData, "extraBedPolicy"),
    petsAllowed: formData.get("petsAllowed") === "on",
    smokingAllowed: formData.get("smokingAllowed") === "on",
  });
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    await propertyService.savePolicies(session.user.id, propertyId, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "save-policies") };
  }
  refresh(propertyId);
  if (formData.get("isLive") !== "1") redirect(`${propertyPath(propertyId)}/photos`);
  return { error: null, message: "Saved." };
}

// ---------------------------------------------------------------------------
// Photos (uploading goes through the route handler in
// src/app/api/host/properties/[id]/photos/route.ts — files are too big for
// a server action's default body limit)
// ---------------------------------------------------------------------------

export async function removePhotoAction(propertyId: string, imageId: string): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    const url = await propertyService.removePhoto(session.user.id, propertyId, imageId);
    if (url) await deletePropertyPhotos([url]);
  } catch (err) {
    return { error: userMessageFor(err, "remove-photo") };
  }
  refresh(propertyId);
  return { error: null };
}

export async function keepPhotoAction(propertyId: string, imageId: string): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    await propertyService.keepPhoto(session.user.id, propertyId, imageId);
  } catch (err) {
    return { error: userMessageFor(err, "keep-photo") };
  }
  refresh(propertyId);
  return { error: null };
}

export async function movePhotoAction(
  propertyId: string,
  imageId: string,
  direction: "up" | "down" | "cover"
): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  if (direction !== "up" && direction !== "down" && direction !== "cover") return { error: "Invalid move." };
  try {
    await propertyService.movePhoto(session.user.id, propertyId, imageId, direction);
  } catch (err) {
    return { error: userMessageFor(err, "move-photo") };
  }
  refresh(propertyId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Submit / withdraw / discard changes / delete
// ---------------------------------------------------------------------------

export async function submitForReviewAction(propertyId: string): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    await propertyService.submitForReview(session.user.id, propertyId);
  } catch (err) {
    return { error: userMessageFor(err, "submit-property") };
  }
  refresh(propertyId);
  return { error: null };
}

export async function withdrawFromReviewAction(propertyId: string): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    await propertyService.withdrawFromReview(session.user.id, propertyId);
  } catch (err) {
    return { error: userMessageFor(err, "withdraw-property") };
  }
  refresh(propertyId);
  return { error: null };
}

export async function discardChangesAction(propertyId: string): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    const urls = await propertyService.discardChanges(session.user.id, propertyId);
    await deletePropertyPhotos(urls);
  } catch (err) {
    return { error: userMessageFor(err, "discard-changes") };
  }
  refresh(propertyId);
  return { error: null };
}

export async function deletePropertyAction(propertyId: string): Promise<ActionState> {
  const session = await requireHost(propertyPath(propertyId));
  try {
    const urls = await propertyService.deleteProperty(session.user.id, propertyId);
    await deletePropertyPhotos(urls);
  } catch (err) {
    return { error: userMessageFor(err, "delete-property") };
  }
  revalidatePath(HOST_HOME);
  redirect(HOST_HOME);
}
