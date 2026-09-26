import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { centsToAmount, toCents, todayInMaldives } from "@/lib/stay-pricing";
import { autoCompletePastStays } from "./booking-service";
import { NotFoundError, UserFacingError } from "./errors";

/**
 * Monthly commission bills ("statements").
 *
 * Guests pay hosts directly at the property, so the platform bills each
 * host afterwards. An admin generates the bills for a finished month: each
 * host gets one statement per currency covering every COMPLETED stay that
 * checked out before the end of that month and hasn't been billed yet
 * (stays marked late roll into the next month's bill, never billed twice).
 * The commission billed is the snapshot stored on each booking when it was
 * made. Cancelled and no-show bookings are never billed.
 *
 * A statement is due PAYMENT_TERMS_DAYS after it's generated. While a
 * statement is overdue, the host's listings are hidden from search and
 * can't be booked (hostInGoodStanding in booking-service.ts) until an admin
 * marks it paid.
 */

export const PAYMENT_TERMS_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** First day of the month containing `date` (UTC calendar dates). */
export function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function nextMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** "2026-09" -> first day of that month, only for months that have ended. */
export function parseBillableMonth(value: string): Date | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const start = new Date(`${value}-01T00:00:00Z`);
  return start < monthStart(todayInMaldives()) ? start : null;
}

/** The last `count` finished months, newest first, for the admin's picker. */
export function recentBillableMonths(count = 12) {
  const current = monthStart(todayInMaldives());
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1 - i, 1)));
}

/** Completed stays not billed yet, grouped by host and currency — what the next bills would contain. */
export async function unbilledSummary() {
  await autoCompletePastStays();
  const rows = await prisma.booking.groupBy({
    by: ["currency"],
    where: { status: "COMPLETED", commissionStatementId: null },
    _count: { _all: true },
    _sum: { commissionAmount: true },
  });
  return rows.map((r) => ({ currency: r.currency, count: r._count._all, commission: r._sum.commissionAmount }));
}

export async function generateStatements(adminUserId: string, periodStart: Date) {
  await autoCompletePastStays();
  const periodEnd = nextMonthStart(periodStart);
  const dueDate = new Date(todayInMaldives().getTime() + PAYMENT_TERMS_DAYS * DAY_MS);

  return prisma.$transaction(async (tx) => {
    const bookings = await tx.booking.findMany({
      where: { status: "COMPLETED", commissionStatementId: null, checkOutDate: { lt: periodEnd } },
      select: {
        id: true,
        currency: true,
        totalAmount: true,
        commissionAmount: true,
        property: { select: { hostProfileId: true } },
      },
    });

    const groups = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const key = `${b.property.hostProfileId}|${b.currency}`;
      groups.set(key, [...(groups.get(key) ?? []), b]);
    }

    let created = 0;
    let skipped = 0;
    for (const [key, items] of groups) {
      const [hostProfileId, currency] = key.split("|");
      const exists = await tx.commissionStatement.findUnique({
        where: {
          hostProfileId_periodStart_currency: {
            hostProfileId,
            periodStart,
            currency: currency as (typeof items)[number]["currency"],
          },
        },
        select: { id: true },
      });
      if (exists) {
        skipped += 1; // already billed for this month; these stays go on next month's bill
        continue;
      }
      const statement = await tx.commissionStatement.create({
        data: {
          hostProfileId,
          periodStart,
          currency: items[0].currency,
          bookingCount: items.length,
          bookingsTotal: centsToAmount(items.reduce((sum, b) => sum + toCents(b.totalAmount), 0)),
          commissionAmount: centsToAmount(items.reduce((sum, b) => sum + toCents(b.commissionAmount), 0)),
          dueDate,
        },
      });
      // Only claim bookings still unbilled — never move one between bills.
      const claimed = await tx.booking.updateMany({
        where: { id: { in: items.map((b) => b.id) }, commissionStatementId: null, status: "COMPLETED" },
        data: { commissionStatementId: statement.id },
      });
      if (claimed.count !== items.length) {
        throw new UserFacingError("Bookings changed while the bills were being generated. Please try again.");
      }
      created += 1;
    }

    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "COMMISSION_STATEMENTS_GENERATED",
        targetType: "CommissionStatement",
        targetId: periodStart.toISOString().slice(0, 7),
        metadata: { created, skipped, bookings: bookings.length },
      },
    });
    return { created, skipped };
  });
}

const statementInclude = {
  hostProfile: { select: { businessName: true, contactPhone: true, user: { select: { email: true } } } },
} satisfies Prisma.CommissionStatementInclude;

export async function listStatements(filter: "due" | "overdue" | "paid" | "all") {
  const today = todayInMaldives();
  const where: Prisma.CommissionStatementWhereInput =
    filter === "due"
      ? { status: "DUE" }
      : filter === "overdue"
        ? { status: "DUE", dueDate: { lt: today } }
        : filter === "paid"
          ? { status: "PAID" }
          : {};
  return prisma.commissionStatement.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: statementInclude,
    take: 300,
  });
}

export async function listHostStatements(hostUserId: string) {
  return prisma.commissionStatement.findMany({
    where: { hostProfile: { userId: hostUserId } },
    orderBy: { periodStart: "desc" },
    include: {
      bookings: {
        orderBy: { checkOutDate: "asc" },
        select: {
          id: true,
          bookingReference: true,
          checkInDate: true,
          checkOutDate: true,
          totalAmount: true,
          commissionAmount: true,
          property: { select: { name: true } },
        },
      },
    },
  });
}

export async function getStatementForAdmin(id: string) {
  const statement = await prisma.commissionStatement.findUnique({
    where: { id },
    include: {
      ...statementInclude,
      bookings: {
        orderBy: { checkOutDate: "asc" },
        select: {
          id: true,
          bookingReference: true,
          checkInDate: true,
          checkOutDate: true,
          totalAmount: true,
          commissionAmount: true,
          property: { select: { name: true } },
        },
      },
    },
  });
  if (!statement) throw new NotFoundError("Statement");
  return statement;
}

export async function markStatementPaid(adminUserId: string, id: string, note: string) {
  await prisma.$transaction(async (tx) => {
    const result = await tx.commissionStatement.updateMany({
      where: { id, status: "DUE" },
      data: { status: "PAID", paidAt: new Date(), markedPaidById: adminUserId, paymentNote: note || null },
    });
    if (result.count === 0) throw new UserFacingError("This statement is already marked as paid.");
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "COMMISSION_STATEMENT_PAID",
        targetType: "CommissionStatement",
        targetId: id,
        metadata: { note },
      },
    });
  });
}

/** Where hosts send their commission. Set COMMISSION_PAYMENT_INSTRUCTIONS in Vercel to your bank details. */
export function paymentInstructions() {
  return (
    process.env.COMMISSION_PAYMENT_INSTRUCTIONS?.trim() ||
    "Our team will contact you with bank transfer details. Include the statement month and your business name as the payment reference."
  );
}
