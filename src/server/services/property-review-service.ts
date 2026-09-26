import type { Prisma, PropertyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MIN_PHOTOS } from "@/lib/validation/property";
import { NotFoundError, StaleReviewError, UserFacingError } from "./errors";
import { discardChangeRequest, propertyDetailInclude, type PropertyDetail } from "./property-service";

/**
 * Admin review of property listings: approving/rejecting new listings, and
 * approving/rejecting change requests on already-live listings (see the
 * lifecycle notes at the top of property-service.ts).
 *
 * Every decision is tied to the exact version the admin looked at: the
 * review page sends back the `submittedAt` / `changesSubmittedAt` timestamp
 * it rendered, and the decision is refused (StaleReviewError) if the host
 * has resubmitted or edited since. Every decision is recorded in
 * AdminAuditLog.
 */

const listInclude = {
  island: { select: { name: true, atoll: { select: { name: true } } } },
  propertyType: { select: { name: true } },
  hostProfile: { select: { businessName: true } },
} as const;

export async function listReviewQueues() {
  const [newListings, changeRequests] = await Promise.all([
    prisma.property.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { submittedAt: "asc" },
      include: listInclude,
    }),
    prisma.property.findMany({
      where: { status: "APPROVED", changesSubmittedAt: { not: null } },
      orderBy: { changesSubmittedAt: "asc" },
      include: listInclude,
    }),
  ]);
  return { newListings, changeRequests };
}

export async function listAllProperties(status?: PropertyStatus) {
  return prisma.property.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    include: listInclude,
    take: 200,
  });
}

export async function getPropertyForAdmin(propertyId: string): Promise<PropertyDetail> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: propertyDetailInclude,
  });
  if (!property) throw new NotFoundError("Property");
  return property;
}

function sameInstant(a: Date | null, iso: string) {
  return a !== null && a.getTime() === new Date(iso).getTime();
}

// ---------------------------------------------------------------------------
// Tax settings (admin check/correction; docs/decisions.md → "Tax rules")
// ---------------------------------------------------------------------------

export async function updatePropertyTaxSettings(
  adminUserId: string,
  propertyId: string,
  input: { listingType: "TOURIST_PROPERTY" | "PRIVATE_RENTAL"; greenTaxTier: "STANDARD" | "HIGHER"; serviceChargePercent?: string }
) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.property.findUnique({
      where: { id: propertyId },
      select: { listingType: true, greenTaxTier: true, serviceChargePercent: true },
    });
    if (!before) throw new NotFoundError("Property");
    if (input.listingType === "TOURIST_PROPERTY") {
      const nonUsd = await tx.room.count({ where: { propertyId, currency: { not: "USD" } } });
      if (nonUsd > 0) {
        throw new UserFacingError("This listing has rooms priced in other currencies. Tourist properties must price in USD; ask the host to change them first.");
      }
    }
    const isTourist = input.listingType === "TOURIST_PROPERTY";
    await tx.property.update({
      where: { id: propertyId },
      data: {
        listingType: input.listingType,
        greenTaxTier: isTourist ? input.greenTaxTier : "STANDARD",
        serviceChargePercent: isTourist ? (input.serviceChargePercent ?? null) : null,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "PROPERTY_TAX_SETTINGS_UPDATED",
        targetType: "Property",
        targetId: propertyId,
        metadata: {
          before: { ...before, serviceChargePercent: before.serviceChargePercent?.toString() ?? null },
          after: input,
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// New listings
// ---------------------------------------------------------------------------

export async function approveListing(adminUserId: string, propertyId: string, reviewedVersion: string) {
  await prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundError("Property");
    if (property.status !== "PENDING_APPROVAL" || !sameInstant(property.submittedAt, reviewedVersion)) {
      throw new StaleReviewError();
    }
    const host = await tx.hostProfile.findUnique({ where: { id: property.hostProfileId }, select: { suspendedAt: true } });
    if (host?.suspendedAt) {
      throw new UserFacingError("This host is suspended. Unsuspend them on the Hosts page before approving their listing.");
    }
    const now = new Date();
    const result = await tx.property.updateMany({
      where: { id: propertyId, status: "PENDING_APPROVAL", submittedAt: property.submittedAt },
      data: {
        status: "APPROVED",
        isVerified: true,
        approvedAt: now,
        approvedByAdminId: adminUserId,
        rejectionReason: null,
      },
    });
    if (result.count === 0) throw new StaleReviewError();
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "PROPERTY_APPROVED",
        targetType: "Property",
        targetId: propertyId,
        metadata: { name: property.name },
      },
    });
  });
}

export async function rejectListing(
  adminUserId: string,
  propertyId: string,
  reviewedVersion: string,
  reason: string
) {
  await prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundError("Property");
    if (property.status !== "PENDING_APPROVAL" || !sameInstant(property.submittedAt, reviewedVersion)) {
      throw new StaleReviewError();
    }
    const result = await tx.property.updateMany({
      where: { id: propertyId, status: "PENDING_APPROVAL", submittedAt: property.submittedAt },
      data: { status: "REJECTED", rejectionReason: reason },
    });
    if (result.count === 0) throw new StaleReviewError();
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "PROPERTY_REJECTED",
        targetType: "Property",
        targetId: propertyId,
        metadata: { name: property.name, reason },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Change requests on live listings
// ---------------------------------------------------------------------------

async function lockChangeRequest(
  tx: Prisma.TransactionClient,
  propertyId: string,
  reviewedVersion: string
) {
  // Row lock: the host's edits to this listing wait until the decision is
  // written, so nothing can slip in between the check and the update.
  await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} FOR UPDATE`;
  const property = await tx.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new NotFoundError("Property");
  if (property.status !== "APPROVED" || !sameInstant(property.changesSubmittedAt, reviewedVersion)) {
    throw new StaleReviewError();
  }
  return property;
}

/** Applies the change request. Returns photo URLs to delete from storage. */
export async function approveChanges(
  adminUserId: string,
  propertyId: string,
  reviewedVersion: string
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const property = await lockChangeRequest(tx, propertyId, reviewedVersion);

    const removed = await tx.propertyImage.findMany({
      where: { propertyId, status: "PENDING_REMOVE" },
      select: { url: true },
    });
    const added = await tx.propertyImage.count({ where: { propertyId, status: "PENDING_ADD" } });
    await tx.propertyImage.deleteMany({ where: { propertyId, status: "PENDING_REMOVE" } });
    await tx.propertyImage.updateMany({
      where: { propertyId, status: "PENDING_ADD" },
      data: { status: "LIVE" },
    });
    const livePhotos = await tx.propertyImage.count({ where: { propertyId } });
    if (livePhotos < MIN_PHOTOS) {
      throw new UserFacingError(`Approving this would leave fewer than ${MIN_PHOTOS} photos. Reject it instead.`);
    }

    await tx.property.update({
      where: { id: propertyId },
      data: {
        name: property.pendingName ?? property.name,
        description: property.pendingDescription ?? property.description,
        pendingName: null,
        pendingDescription: null,
        changesSubmittedAt: null,
        changesRejectionReason: null,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "PROPERTY_CHANGES_APPROVED",
        targetType: "Property",
        targetId: propertyId,
        metadata: {
          previousName: property.name,
          newName: property.pendingName ?? property.name,
          descriptionChanged: property.pendingDescription !== null,
          photosAdded: added,
          photosRemoved: removed.length,
        },
      },
    });
    return removed.map((r) => r.url);
  });
}

/** Rejects the change request; the live listing is untouched. Returns photo URLs to delete. */
export async function rejectChanges(
  adminUserId: string,
  propertyId: string,
  reviewedVersion: string,
  reason: string
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const property = await lockChangeRequest(tx, propertyId, reviewedVersion);
    const urls = await discardChangeRequest(tx, propertyId);
    await tx.property.update({ where: { id: propertyId }, data: { changesRejectionReason: reason } });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "PROPERTY_CHANGES_REJECTED",
        targetType: "Property",
        targetId: propertyId,
        metadata: { name: property.name, reason },
      },
    });
    return urls;
  });
}
