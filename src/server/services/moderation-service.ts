import { createHmac } from "node:crypto";
import type { ListingReportReason, ListingReportStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todayInMaldives } from "@/lib/stay-pricing";
import { NotFoundError, UserFacingError } from "./errors";
import { hostInGoodStanding } from "./booking-service";

/**
 * Anti-scam tools (see docs/decisions.md → "Anti-scam"):
 * - Admins can suspend a host immediately. While suspended, all their
 *   listings disappear from search and property pages and can't be booked
 *   (hostInGoodStanding), and they can't create or submit listings.
 *   Existing bookings are NOT cancelled automatically: the admin sees them
 *   and decides, since guests may already be travelling.
 * - Travelers can report a listing, signed in or not. Reports are
 *   rate-limited per IP (stored only as a keyed hash) and per listing.
 * Every admin action here is written to AdminAuditLog.
 */

const HOUR_MS = 60 * 60 * 1000;
const MAX_REPORTS_PER_IP_PER_HOUR = 5;
const MAX_REPORTS_PER_IP_PER_DAY = 20;

export const REPORT_REASON_LABELS: Record<ListingReportReason, string> = {
  ASKED_TO_PAY_OUTSIDE: "The host asked me to pay a deposit or transfer money outside this website",
  SCAM_OR_FRAUD: "I think this is a scam or fraud",
  FAKE_LISTING: "The property doesn't exist, or isn't what the photos show",
  WRONG_INFORMATION: "Wrong information (price, location, facilities…)",
  INAPPROPRIATE: "Offensive or inappropriate content",
  OTHER: "Something else",
};

// ---------------------------------------------------------------------------
// Suspension
// ---------------------------------------------------------------------------

export async function suspendHost(adminUserId: string, hostProfileId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const result = await tx.hostProfile.updateMany({
      where: { id: hostProfileId, suspendedAt: null },
      data: { suspendedAt: new Date(), suspensionReason: reason, suspendedByUserId: adminUserId },
    });
    if (result.count === 0) {
      const exists = await tx.hostProfile.count({ where: { id: hostProfileId } });
      throw exists ? new UserFacingError("This host is already suspended.") : new NotFoundError("Host");
    }
    await tx.adminAuditLog.create({
      data: { adminUserId, action: "HOST_SUSPENDED", targetType: "HostProfile", targetId: hostProfileId, metadata: { reason } },
    });
  });
}

export async function unsuspendHost(adminUserId: string, hostProfileId: string) {
  await prisma.$transaction(async (tx) => {
    const host = await tx.hostProfile.findUnique({ where: { id: hostProfileId }, select: { suspensionReason: true, suspendedAt: true } });
    if (!host) throw new NotFoundError("Host");
    if (!host.suspendedAt) throw new UserFacingError("This host isn't suspended.");
    await tx.hostProfile.update({
      where: { id: hostProfileId },
      data: { suspendedAt: null, suspensionReason: null, suspendedByUserId: null },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "HOST_UNSUSPENDED",
        targetType: "HostProfile",
        targetId: hostProfileId,
        metadata: { previousReason: host.suspensionReason },
      },
    });
  });
}

/** Throws if the host of `userId` is suspended. Used before creating/submitting listings. */
export async function assertHostNotSuspended(userId: string) {
  const host = await prisma.hostProfile.findUnique({ where: { userId }, select: { suspendedAt: true } });
  if (host?.suspendedAt) {
    throw new UserFacingError("Your host account is suspended, so listings can't be created or submitted. Contact support.");
  }
}

// ---------------------------------------------------------------------------
// Admin: hosts
// ---------------------------------------------------------------------------

export async function listHosts(filter: "all" | "suspended" | "reported", search?: string) {
  const where: Prisma.HostProfileWhereInput = {
    ...(filter === "suspended" ? { suspendedAt: { not: null } } : {}),
    ...(filter === "reported" ? { properties: { some: { reports: { some: { status: "OPEN" } } } } } : {}),
    ...(search
      ? {
          OR: [
            { businessName: { contains: search, mode: "insensitive" } },
            { contactPhone: { contains: search } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const hosts = await prisma.hostProfile.findMany({
    where,
    orderBy: [{ suspendedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { properties: true } },
      properties: { select: { status: true, _count: { select: { reports: { where: { status: "OPEN" } } } } } },
    },
  });
  return hosts.map((h) => ({
    ...h,
    liveListings: h.properties.filter((p) => p.status === "APPROVED").length,
    openReports: h.properties.reduce((n, p) => n + p._count.reports, 0),
  }));
}

export async function getHostForAdmin(hostProfileId: string) {
  const today = todayInMaldives();
  const host = await prisma.hostProfile.findUnique({
    where: { id: hostProfileId },
    include: {
      user: { select: { name: true, email: true, createdAt: true } },
      properties: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          island: { select: { name: true } },
          reports: { orderBy: { createdAt: "desc" }, select: { id: true, reason: true, status: true, createdAt: true } },
        },
      },
      commissionStatements: { where: { status: "DUE" }, select: { id: true, dueDate: true, commissionAmount: true, currency: true } },
    },
  });
  if (!host) throw new NotFoundError("Host");
  const upcomingBookings = await prisma.booking.findMany({
    where: { property: { hostProfileId }, status: "CONFIRMED", checkOutDate: { gt: today } },
    orderBy: { checkInDate: "asc" },
    select: {
      id: true,
      bookingReference: true,
      checkInDate: true,
      checkOutDate: true,
      guest: { select: { name: true, email: true } },
      property: { select: { name: true } },
    },
  });
  const suspendedBy = host.suspendedByUserId
    ? await prisma.user.findUnique({ where: { id: host.suspendedByUserId }, select: { name: true } })
    : null;
  return { host, upcomingBookings, suspendedBy };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** Keyed hash, so stored values can't be turned back into IP addresses. */
function hashIp(ip: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "report-ip-salt").update(ip).digest("hex");
}

export type ReportInput = {
  propertySlug: string;
  reason: ListingReportReason;
  details: string;
  reporterUserId?: string;
  reporterEmail?: string;
  ipAddress: string;
};

export async function submitReport(input: ReportInput) {
  // Only listings the public can currently see can be reported.
  const property = await prisma.property.findFirst({
    where: { slug: input.propertySlug, status: "APPROVED", hostProfile: hostInGoodStanding() },
    select: { id: true },
  });
  if (!property) throw new NotFoundError("Listing");

  const ipHash = hashIp(input.ipAddress);
  const now = Date.now();
  const [lastHour, lastDay, sameListing] = await Promise.all([
    prisma.listingReport.count({ where: { reporterIpHash: ipHash, createdAt: { gte: new Date(now - HOUR_MS) } } }),
    prisma.listingReport.count({ where: { reporterIpHash: ipHash, createdAt: { gte: new Date(now - 24 * HOUR_MS) } } }),
    prisma.listingReport.count({
      where: {
        propertyId: property.id,
        createdAt: { gte: new Date(now - 24 * HOUR_MS) },
        OR: [{ reporterIpHash: ipHash }, ...(input.reporterUserId ? [{ reporterUserId: input.reporterUserId }] : [])],
      },
    }),
  ]);
  if (sameListing > 0) throw new UserFacingError("You've already reported this listing. Our team will look into it.");
  if (lastHour >= MAX_REPORTS_PER_IP_PER_HOUR || lastDay >= MAX_REPORTS_PER_IP_PER_DAY) {
    throw new UserFacingError("Too many reports from your connection. Please try again later.");
  }

  return prisma.listingReport.create({
    data: {
      propertyId: property.id,
      reason: input.reason,
      details: input.details,
      reporterUserId: input.reporterUserId ?? null,
      reporterEmail: input.reporterEmail ?? null,
      reporterIpHash: ipHash,
    },
  });
}

export async function listReports(filter: "open" | "closed" | "all") {
  return prisma.listingReport.findMany({
    where: filter === "open" ? { status: "OPEN" } : filter === "closed" ? { status: { not: "OPEN" } } : {},
    orderBy: { createdAt: filter === "open" ? "asc" : "desc" },
    take: 300,
    include: {
      property: {
        select: {
          id: true,
          name: true,
          slug: true,
          hostProfile: { select: { id: true, businessName: true, suspendedAt: true } },
          _count: { select: { reports: true } },
        },
      },
    },
  });
}

export async function resolveReport(
  adminUserId: string,
  reportId: string,
  status: Exclude<ListingReportStatus, "OPEN">,
  note: string
) {
  await prisma.$transaction(async (tx) => {
    const result = await tx.listingReport.updateMany({
      where: { id: reportId, status: "OPEN" },
      data: { status, resolvedByUserId: adminUserId, resolvedAt: new Date(), resolutionNote: note || null },
    });
    if (result.count === 0) throw new UserFacingError("This report was already closed.");
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: status === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_DISMISSED",
        targetType: "ListingReport",
        targetId: reportId,
        metadata: { note },
      },
    });
  });
}
