"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/server/auth/page-guards";
import { suspendHost, unsuspendHost } from "@/server/services/moderation-service";
import { userMessageFor } from "@/server/services/errors";
import { notifyHostSuspension, notifyVerificationReviewed } from "@/server/email/notifications";
import {
  approveHostVerification,
  deleteHostDocuments,
  rejectHostVerification,
  revokeHostVerification,
} from "@/server/services/verification-service";
import { deleteVerificationDocuments } from "@/server/storage/document-storage";
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

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function approveVerificationAction(
  hostProfileId: string,
  reviewedVersion: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAdmin(`/dashboard/admin/hosts/${hostProfileId}`);
  try {
    await approveHostVerification(session.user.id, hostProfileId, reviewedVersion, formData.get("phoneConfirmedByCall") === "on");
  } catch (err) {
    return { error: userMessageFor(err, "approve-verification") };
  }
  after(() => notifyVerificationReviewed(hostProfileId, "approved"));
  refresh();
  return { error: null, message: "Host verified. Their approved listings are visible to travelers now." };
}

export async function rejectVerificationAction(
  hostProfileId: string,
  reviewedVersion: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAdmin(`/dashboard/admin/hosts/${hostProfileId}`);
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: "Tell the host what to fix (at least 10 characters). They will see it." };
  const replace = formData.getAll("replaceDocumentId").map(String);
  try {
    const refs = await rejectHostVerification(session.user.id, hostProfileId, reviewedVersion, reason.slice(0, 1000), replace);
    after(() => deleteVerificationDocuments(refs));
  } catch (err) {
    return { error: userMessageFor(err, "reject-verification") };
  }
  after(() => notifyVerificationReviewed(hostProfileId, "rejected"));
  refresh();
  return { error: null, message: "Sent back to the host with your note." };
}

export async function revokeVerificationAction(hostProfileId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin(`/dashboard/admin/hosts/${hostProfileId}`);
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: "Give a reason of at least 10 characters. The host will see it." };
  try {
    await revokeHostVerification(session.user.id, hostProfileId, reason.slice(0, 1000));
  } catch (err) {
    return { error: userMessageFor(err, "revoke-verification") };
  }
  after(() => notifyVerificationReviewed(hostProfileId, "revoked"));
  refresh();
  return { error: null, message: "Verification removed. Their listings are hidden until they're verified again." };
}

export async function deleteDocumentsAction(hostProfileId: string): Promise<ActionState> {
  const session = await requireAdmin(`/dashboard/admin/hosts/${hostProfileId}`);
  try {
    const refs = await deleteHostDocuments(session.user.id, hostProfileId);
    after(() => deleteVerificationDocuments(refs));
  } catch (err) {
    return { error: userMessageFor(err, "delete-documents") };
  }
  refresh();
  return { error: null };
}
