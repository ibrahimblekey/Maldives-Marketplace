"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth/page-guards";
import { reviewDecisionReasonSchema } from "@/lib/validation/property";
import * as reviewService from "@/server/services/property-review-service";
import { userMessageFor } from "@/server/services/errors";
import { deletePropertyPhotos } from "@/server/storage/photo-storage";
import type { ActionState } from "../../_components/action-state";

/**
 * Admin decisions on listings. Each action re-checks ADMIN/SUPER_ADMIN
 * itself. `reviewedVersion` is the submittedAt/changesSubmittedAt value the
 * review page was rendered with; the service refuses the decision if the
 * listing has changed since (see property-review-service.ts).
 */

const QUEUE = "/dashboard/admin/properties";

function done(propertyId: string) {
  revalidatePath(QUEUE, "layout");
  revalidatePath(`/dashboard/host/properties/${propertyId}`, "layout");
  revalidatePath("/dashboard/host");
}

export async function approveListingAction(propertyId: string, reviewedVersion: string): Promise<ActionState> {
  const session = await requireAdmin(`${QUEUE}/${propertyId}`);
  try {
    await reviewService.approveListing(session.user.id, propertyId, reviewedVersion);
  } catch (err) {
    return { error: userMessageFor(err, "approve-listing") };
  }
  done(propertyId);
  redirect(`${QUEUE}?done=approved`);
}

export async function rejectListingAction(
  propertyId: string,
  reviewedVersion: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAdmin(`${QUEUE}/${propertyId}`);
  const reason = reviewDecisionReasonSchema.safeParse(formData.get("reason") ?? "");
  if (!reason.success) return { error: reason.error.issues[0]?.message ?? "Invalid reason." };
  try {
    await reviewService.rejectListing(session.user.id, propertyId, reviewedVersion, reason.data);
  } catch (err) {
    return { error: userMessageFor(err, "reject-listing") };
  }
  done(propertyId);
  redirect(`${QUEUE}?done=rejected`);
}

export async function approveChangesAction(propertyId: string, reviewedVersion: string): Promise<ActionState> {
  const session = await requireAdmin(`${QUEUE}/${propertyId}`);
  try {
    const urls = await reviewService.approveChanges(session.user.id, propertyId, reviewedVersion);
    await deletePropertyPhotos(urls);
  } catch (err) {
    return { error: userMessageFor(err, "approve-changes") };
  }
  done(propertyId);
  redirect(`${QUEUE}?done=changes-approved`);
}

export async function rejectChangesAction(
  propertyId: string,
  reviewedVersion: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAdmin(`${QUEUE}/${propertyId}`);
  const reason = reviewDecisionReasonSchema.safeParse(formData.get("reason") ?? "");
  if (!reason.success) return { error: reason.error.issues[0]?.message ?? "Invalid reason." };
  try {
    const urls = await reviewService.rejectChanges(session.user.id, propertyId, reviewedVersion, reason.data);
    await deletePropertyPhotos(urls);
  } catch (err) {
    return { error: userMessageFor(err, "reject-changes") };
  }
  done(propertyId);
  redirect(`${QUEUE}?done=changes-rejected`);
}
