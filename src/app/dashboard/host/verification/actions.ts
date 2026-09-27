"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireHost } from "@/server/auth/page-guards";
import { licenceDetailsSchema } from "@/lib/validation/verification";
import {
  removeVerificationDocument,
  saveLicenceDetails,
  submitVerification,
  withdrawVerification,
} from "@/server/services/verification-service";
import { userMessageFor } from "@/server/services/errors";
import { deleteVerificationDocuments } from "@/server/storage/document-storage";
import { notifyVerificationSubmitted } from "@/server/email/notifications";
import type { ActionState } from "../../_components/action-state";

const PATH = "/dashboard/host/verification";

export async function saveLicenceDetailsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireHost(PATH);
  const parsed = licenceDetailsSchema.safeParse({
    licenceNumber: formData.get("licenceNumber"),
    licenceBusinessName: formData.get("licenceBusinessName"),
    licenceIslandId: formData.get("licenceIslandId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    await saveLicenceDetails(session.user.id, parsed.data);
  } catch (err) {
    return { error: userMessageFor(err, "save-licence") };
  }
  revalidatePath("/dashboard/host", "layout");
  return { error: null, message: "Licence details saved." };
}

export async function removeDocumentAction(documentId: string): Promise<ActionState> {
  const session = await requireHost(PATH);
  try {
    const ref = await removeVerificationDocument(session.user.id, documentId);
    await deleteVerificationDocuments([ref]);
  } catch (err) {
    return { error: userMessageFor(err, "remove-document") };
  }
  revalidatePath("/dashboard/host", "layout");
  return { error: null };
}

export async function submitVerificationAction(): Promise<ActionState> {
  const session = await requireHost(PATH);
  try {
    await submitVerification(session.user.id);
  } catch (err) {
    return { error: userMessageFor(err, "submit-verification") };
  }
  const userId = session.user.id;
  after(() => notifyVerificationSubmitted(userId));
  revalidatePath("/dashboard/host", "layout");
  return { error: null };
}

export async function withdrawVerificationAction(): Promise<ActionState> {
  const session = await requireHost(PATH);
  try {
    await withdrawVerification(session.user.id);
  } catch (err) {
    return { error: userMessageFor(err, "withdraw-verification") };
  }
  revalidatePath("/dashboard/host", "layout");
  return { error: null };
}
