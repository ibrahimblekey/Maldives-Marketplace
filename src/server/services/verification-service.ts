import type { HostVerificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  MAX_FILES_PER_DOCUMENT_TYPE,
  VERIFICATION_DOCUMENT_TYPES,
  documentTypeLabel,
  type LicenceDetailsInput,
  type VerificationDocumentType,
} from "@/lib/validation/verification";
import { NotFoundError, UserFacingError } from "./errors";

/**
 * Host verification (docs/decisions.md → "Host verification" and
 * "Verification documents").
 *
 * Lifecycle of HostProfile.verificationStatus:
 *   PENDING      → the host is filling in licence details and documents
 *   UNDER_REVIEW → submitted; locked for the host (they can withdraw it)
 *   APPROVED     → verified: listings can be shown, "Verified host" badge
 *   REJECTED     → admin asked for changes (or revoked an approval); the
 *                  host edits and resubmits
 * Until a host is APPROVED none of their listings are shown or bookable
 * (hostInGoodStanding in booking-service.ts).
 *
 * The phone number is confirmed by an admin phoning the host (ticked at
 * approval) until an SMS provider is set up.
 *
 * Documents are private: hosts see only their file names, admins open them
 * through a role-checked route and every opening is audit-logged. Rejected
 * and replaced files are deleted straight away; admins can delete the rest
 * when they're no longer needed.
 *
 * Every write locks the host's row first, so a host editing and an admin
 * deciding can't interleave; admin decisions are also tied to the exact
 * submission they looked at (verificationSubmittedAt).
 */

type Tx = Prisma.TransactionClient;

const EDITABLE: HostVerificationStatus[] = ["PENDING", "REJECTED"];

export const VERIFICATION_STATUS_LABELS: Record<HostVerificationStatus, string> = {
  PENDING: "Not submitted",
  UNDER_REVIEW: "Waiting for review",
  APPROVED: "Verified",
  REJECTED: "Changes needed",
  SUSPENDED: "Suspended",
};

/** "+960 777-1234" and "9607771234" are the same number. */
export function samePhone(a: string | null | undefined, b: string | null | undefined) {
  const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
  return digits(a) !== "" && digits(a) === digits(b);
}

export function phoneConfirmed(host: { contactPhone: string; phoneConfirmedNumber: string | null }) {
  return samePhone(host.contactPhone, host.phoneConfirmedNumber);
}

async function lockHostByUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "HostProfile" WHERE "userId" = ${userId} FOR UPDATE`;
  const host = await tx.hostProfile.findUnique({ where: { userId } });
  if (!host) throw new UserFacingError("Fill in your host details first.");
  return host;
}

async function lockHostById(tx: Tx, hostProfileId: string) {
  await tx.$queryRaw`SELECT id FROM "HostProfile" WHERE id = ${hostProfileId} FOR UPDATE`;
  const host = await tx.hostProfile.findUnique({ where: { id: hostProfileId } });
  if (!host) throw new NotFoundError("Host");
  return host;
}

function assertEditable(status: HostVerificationStatus) {
  if (status === "UNDER_REVIEW") {
    throw new UserFacingError("Your verification is waiting for review. Withdraw it first if you need to change something.");
  }
  if (!EDITABLE.includes(status)) {
    throw new UserFacingError("You're already verified. Contact support if your licence or documents change.");
  }
}

// ---------------------------------------------------------------------------
// Host side
// ---------------------------------------------------------------------------

const documentSelect = {
  id: true,
  documentType: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  status: true,
  createdAt: true,
} as const;

export async function getHostVerification(userId: string) {
  return prisma.hostProfile.findUnique({
    where: { userId },
    include: {
      licenceIsland: { select: { name: true, atoll: { select: { name: true } } } },
      // fileUrl deliberately not selected: hosts never get a link to the stored files.
      verificationDocuments: { orderBy: { createdAt: "asc" }, select: documentSelect },
    },
  });
}

/** What still blocks submission. Empty = ready. */
export function verificationProblems(host: {
  licenceNumber: string | null;
  licenceBusinessName: string | null;
  licenceIslandId: string | null;
  verificationDocuments: { documentType: string }[];
}): string[] {
  const problems: string[] = [];
  if (!host.licenceNumber || !host.licenceBusinessName || !host.licenceIslandId) {
    problems.push("Fill in your licence details and save them.");
  }
  for (const type of VERIFICATION_DOCUMENT_TYPES) {
    if (!host.verificationDocuments.some((d) => d.documentType === type.key)) {
      problems.push(`Upload your ${type.label.charAt(0).toLowerCase()}${type.label.slice(1)}.`);
    }
  }
  return problems;
}

export async function saveLicenceDetails(userId: string, input: LicenceDetailsInput) {
  await prisma.$transaction(async (tx) => {
    const host = await lockHostByUser(tx, userId);
    assertEditable(host.verificationStatus);
    const island = await tx.island.count({ where: { id: input.licenceIslandId } });
    if (!island) throw new UserFacingError("Select an island from the list.");
    await tx.hostProfile.update({
      where: { id: host.id },
      data: {
        licenceNumber: input.licenceNumber,
        licenceBusinessName: input.licenceBusinessName,
        licenceIslandId: input.licenceIslandId,
      },
    });
  });
}

/** Cheap pre-check before storing an upload. Returns the host profile id. */
export async function assertCanUploadDocument(userId: string, documentType: VerificationDocumentType) {
  const host = await prisma.hostProfile.findUnique({
    where: { userId },
    select: { id: true, verificationStatus: true, _count: { select: { verificationDocuments: { where: { documentType } } } } },
  });
  if (!host) throw new UserFacingError("Fill in your host details first.");
  assertEditable(host.verificationStatus);
  if (host._count.verificationDocuments >= MAX_FILES_PER_DOCUMENT_TYPE) {
    throw new UserFacingError(`You can upload up to ${MAX_FILES_PER_DOCUMENT_TYPE} files for each document. Remove one first.`);
  }
  return host.id;
}

export async function addVerificationDocument(
  userId: string,
  documentType: VerificationDocumentType,
  file: { fileUrl: string; fileName: string; contentType: string; sizeBytes: number }
) {
  return prisma.$transaction(async (tx) => {
    const host = await lockHostByUser(tx, userId);
    assertEditable(host.verificationStatus);
    const count = await tx.verificationDocument.count({ where: { hostProfileId: host.id, documentType } });
    if (count >= MAX_FILES_PER_DOCUMENT_TYPE) {
      throw new UserFacingError(`You can upload up to ${MAX_FILES_PER_DOCUMENT_TYPE} files for each document. Remove one first.`);
    }
    return tx.verificationDocument.create({
      data: { hostProfileId: host.id, documentType, ...file },
      select: documentSelect,
    });
  });
}

/** Removes one of the host's own documents. Returns the storage reference to delete. */
export async function removeVerificationDocument(userId: string, documentId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const host = await lockHostByUser(tx, userId);
    assertEditable(host.verificationStatus);
    const doc = await tx.verificationDocument.findFirst({ where: { id: documentId, hostProfileId: host.id } });
    if (!doc) throw new NotFoundError("Document");
    await tx.verificationDocument.delete({ where: { id: doc.id } });
    return doc.fileUrl;
  });
}

export async function submitVerification(userId: string) {
  await prisma.$transaction(async (tx) => {
    const host = await lockHostByUser(tx, userId);
    assertEditable(host.verificationStatus);
    const documents = await tx.verificationDocument.findMany({ where: { hostProfileId: host.id }, select: { documentType: true } });
    const problems = verificationProblems({ ...host, verificationDocuments: documents });
    if (problems.length > 0) throw new UserFacingError(problems[0]!);
    await tx.hostProfile.update({
      where: { id: host.id },
      data: { verificationStatus: "UNDER_REVIEW", verificationSubmittedAt: new Date(), verificationRejectionReason: null },
    });
  });
}

export async function withdrawVerification(userId: string) {
  await prisma.$transaction(async (tx) => {
    const host = await lockHostByUser(tx, userId);
    if (host.verificationStatus !== "UNDER_REVIEW") throw new UserFacingError("Your verification isn't waiting for review.");
    await tx.hostProfile.update({
      where: { id: host.id },
      data: { verificationStatus: "PENDING", verificationSubmittedAt: null },
    });
  });
}

// ---------------------------------------------------------------------------
// Admin side
// ---------------------------------------------------------------------------

export class StaleVerificationError extends UserFacingError {
  constructor() {
    super("This host changed or withdrew their verification after you opened it. Reload the page and review it again.");
    this.name = "StaleVerificationError";
  }
}

function sameInstant(a: Date | null, iso: string) {
  return a !== null && a.getTime() === new Date(iso).getTime();
}

async function lockSubmission(tx: Tx, hostProfileId: string, reviewedVersion: string) {
  const host = await lockHostById(tx, hostProfileId);
  if (host.verificationStatus !== "UNDER_REVIEW" || !sameInstant(host.verificationSubmittedAt, reviewedVersion)) {
    throw new StaleVerificationError();
  }
  return host;
}

export async function approveHostVerification(
  adminUserId: string,
  hostProfileId: string,
  reviewedVersion: string,
  phoneConfirmedByCall: boolean
) {
  await prisma.$transaction(async (tx) => {
    const host = await lockSubmission(tx, hostProfileId, reviewedVersion);
    const alreadyConfirmed = phoneConfirmed(host);
    if (!alreadyConfirmed && !phoneConfirmedByCall) {
      throw new UserFacingError(`Call the host on ${host.contactPhone} to confirm the number, then tick the box.`);
    }
    const now = new Date();
    await tx.hostProfile.update({
      where: { id: host.id },
      data: {
        verificationStatus: "APPROVED",
        verifiedAt: now,
        verifiedByAdminId: adminUserId,
        verificationRejectionReason: null,
        ...(alreadyConfirmed
          ? {}
          : { phoneConfirmedNumber: host.contactPhone, phoneConfirmedMethod: "ADMIN_CALL", phoneConfirmedAt: now }),
      },
    });
    await tx.verificationDocument.updateMany({
      where: { hostProfileId: host.id },
      data: { status: "APPROVED", reviewedByAdminId: adminUserId, reviewedAt: now },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "HOST_VERIFICATION_APPROVED",
        targetType: "HostProfile",
        targetId: host.id,
        metadata: {
          licenceNumber: host.licenceNumber,
          licenceBusinessName: host.licenceBusinessName,
          phone: host.contactPhone,
          phoneConfirmedByCall: !alreadyConfirmed,
        },
      },
    });
  });
}

/**
 * Sends the submission back to the host. Documents listed in
 * `replaceDocumentIds` are deleted (the host uploads new ones). Returns the
 * storage references to delete.
 */
export async function rejectHostVerification(
  adminUserId: string,
  hostProfileId: string,
  reviewedVersion: string,
  reason: string,
  replaceDocumentIds: string[]
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const host = await lockSubmission(tx, hostProfileId, reviewedVersion);
    const toDelete = await tx.verificationDocument.findMany({
      where: { hostProfileId: host.id, id: { in: replaceDocumentIds } },
      select: { id: true, fileUrl: true, documentType: true },
    });
    await tx.verificationDocument.deleteMany({ where: { id: { in: toDelete.map((d) => d.id) } } });
    await tx.hostProfile.update({
      where: { id: host.id },
      data: { verificationStatus: "REJECTED", verificationRejectionReason: reason },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "HOST_VERIFICATION_REJECTED",
        targetType: "HostProfile",
        targetId: host.id,
        metadata: { reason, deletedDocuments: toDelete.map((d) => documentTypeLabel(d.documentType)) },
      },
    });
    return toDelete.map((d) => d.fileUrl);
  });
}

/** Takes a verified host back to "changes needed": their listings are hidden immediately. */
export async function revokeHostVerification(adminUserId: string, hostProfileId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const host = await lockHostById(tx, hostProfileId);
    if (host.verificationStatus !== "APPROVED") throw new UserFacingError("This host isn't verified.");
    await tx.hostProfile.update({
      where: { id: host.id },
      data: { verificationStatus: "REJECTED", verificationRejectionReason: reason, verifiedAt: null, verifiedByAdminId: null },
    });
    await tx.adminAuditLog.create({
      data: { adminUserId, action: "HOST_VERIFICATION_REVOKED", targetType: "HostProfile", targetId: host.id, metadata: { reason } },
    });
  });
}

/** Deletes all of a host's documents once they're no longer needed. Returns storage references to delete. */
export async function deleteHostDocuments(adminUserId: string, hostProfileId: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const host = await lockHostById(tx, hostProfileId);
    if (host.verificationStatus === "UNDER_REVIEW") {
      throw new UserFacingError("Approve or reject the verification before deleting its documents.");
    }
    const docs = await tx.verificationDocument.findMany({ where: { hostProfileId: host.id }, select: { fileUrl: true } });
    if (docs.length === 0) throw new UserFacingError("This host has no documents stored.");
    await tx.verificationDocument.deleteMany({ where: { hostProfileId: host.id } });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "VERIFICATION_DOCUMENTS_DELETED",
        targetType: "HostProfile",
        targetId: host.id,
        metadata: { count: docs.length },
      },
    });
    return docs.map((d) => d.fileUrl);
  });
}

/** Looks up a document for an admin to open, and records that they opened it. */
export async function openDocumentForAdmin(adminUserId: string, documentId: string) {
  const doc = await prisma.verificationDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new NotFoundError("Document");
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action: "VERIFICATION_DOCUMENT_VIEWED",
      targetType: "VerificationDocument",
      targetId: doc.id,
      metadata: { hostProfileId: doc.hostProfileId, documentType: doc.documentType },
    },
  });
  return doc;
}

export async function countVerificationsWaiting() {
  return prisma.hostProfile.count({ where: { verificationStatus: "UNDER_REVIEW" } });
}
