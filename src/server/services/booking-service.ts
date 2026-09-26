import { Prisma, type BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  centsToAmount,
  priceBreakdown,
  quoteStay,
  toCents,
  todayInMaldives,
  type Stay,
} from "@/lib/stay-pricing";
import { getPlatformSettings, ratesForProperty } from "./settings-service";
import { NotFoundError, UserFacingError } from "./errors";

/**
 * Bookings: pay at the property, confirmed instantly.
 *
 * Money: the guest pays the host on arrival, so no money moves through the
 * platform. Every booking stores a price snapshot (total, commission,
 * host's share) fixed at booking time; completed stays are later billed to
 * the host monthly (commission-service.ts).
 *
 * Status lifecycle:
 *   CONFIRMED ──guest or host cancels before check-in──▶ CANCELLED
 *   CONFIRMED ──host, after check-out──▶ COMPLETED ("guest stayed") or NO_SHOW
 *   CONFIRMED ──7 days after check-out, host did nothing──▶ COMPLETED (automatic)
 * Only COMPLETED stays are charged commission.
 *
 * Double booking: a booking claims specific physical rooms
 * (BookingRoomUnit). Room-type bookings are serialised with a row lock, and
 * the database's EXCLUDE constraint (init migration) refuses any
 * overlapping claim on the same physical room regardless — that is the
 * real guarantee. BookingRoomUnit.status must mirror Booking.status (the
 * constraint ignores CANCELLED rows), so every status change here updates
 * both in one transaction.
 */

/** After this many days past check-out, a stay the host didn't mark counts as completed. */
export const AUTO_COMPLETE_AFTER_DAYS = 7;
const MAX_ROOMS_PER_BOOKING = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

/**
 * Commission in cents, rounded to the cent. Charged on the room price only,
 * never on the service charge (staff) or taxes (government); see
 * docs/decisions.md. The rate comes from Admin → Settings.
 */
export function commissionCents(roomCents: number, percent: string) {
  return Math.round((roomCents * toCents(percent)) / 10_000);
}

// ---------------------------------------------------------------------------
// Availability (the same rule search uses — see listing-search-service.ts)
// ---------------------------------------------------------------------------

async function freeUnitIds(db: Tx | typeof prisma, roomId: string, stay: Stay) {
  const units = await db.roomInventoryUnit.findMany({
    where: { roomId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      bookingUnits: {
        where: { status: { not: "CANCELLED" }, checkInDate: { lt: stay.checkOut }, checkOutDate: { gt: stay.checkIn } },
        select: { id: true },
      },
      availabilityBlocks: {
        where: { startDate: { lt: stay.checkOut }, endDate: { gt: stay.checkIn } },
        select: { id: true },
      },
    },
  });
  return units.filter((u) => u.bookingUnits.length === 0 && u.availabilityBlocks.length === 0).map((u) => u.id);
}

/**
 * Hosts whose listings may be shown and booked: not suspended by an admin,
 * and no overdue commission bill. Used by search, property pages and
 * booking, so a suspension takes effect everywhere immediately.
 */
export function hostInGoodStanding(now = new Date()): Prisma.HostProfileWhereInput {
  return {
    suspendedAt: null,
    commissionStatements: { none: { status: "DUE", dueDate: { lt: todayInMaldives(now) } } },
  };
}

// ---------------------------------------------------------------------------
// Creating a booking
// ---------------------------------------------------------------------------

async function loadBookableRoom(db: Tx | typeof prisma, propertySlug: string, roomId: string) {
  const room = await db.room.findFirst({
    where: {
      id: roomId,
      isActive: true,
      property: { slug: propertySlug, status: "APPROVED", hostProfile: hostInGoodStanding() },
    },
    include: {
      seasonalPrices: true,
      property: {
        select: {
          id: true,
          name: true,
          slug: true,
          listingType: true,
          serviceChargePercent: true,
          greenTaxTier: true,
          hostProfile: { select: { userId: true } },
        },
      },
    },
  });
  if (!room) throw new NotFoundError("Room");
  return room;
}

/**
 * Green tax is a US-dollar amount, so tourist properties must price in USD
 * (docs/decisions.md → "Tax rules"). Private rentals may use any currency.
 */
export function currencyProblem(listingType: string, currency: string) {
  return listingType === "TOURIST_PROPERTY" && currency !== "USD"
    ? "This property's prices aren't in US dollars yet, so it can't be booked right now."
    : null;
}

/** What the booking page shows before the traveler confirms. */
export async function previewBooking(propertySlug: string, roomId: string, stay: Stay) {
  const [room, settings] = await Promise.all([loadBookableRoom(prisma, propertySlug, roomId), getPlatformSettings()]);
  const quote = quoteStay(room, stay);
  const roomsLeft = (await freeUnitIds(prisma, roomId, stay)).length;
  return {
    room,
    quote,
    rates: ratesForProperty(room.property, settings),
    currencyProblem: currencyProblem(room.property.listingType, room.currency),
    roomsLeft: Math.min(roomsLeft, MAX_ROOMS_PER_BOOKING),
  };
}

export type CreateBookingInput = {
  propertySlug: string;
  roomId: string;
  stay: Stay;
  numRooms: number;
  numGuests: number;
  /** Guests who are Maldivian citizens or residents (no green tax). */
  localGuests: number;
  /** Visitors under 2 (no green tax). */
  infantGuests: number;
  guestName: string;
  contactPhone: string;
  specialRequests?: string;
  /** The total the traveler was shown (with taxes), in cents. Refused if the real price differs. */
  expectedTotalCents: number;
};

async function nextBookingReference(tx: Tx) {
  const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('booking_reference_seq') AS n`;
  return `MV-${todayInMaldives().getUTCFullYear()}-${String(n).padStart(6, "0")}`;
}

function isOverlapViolation(err: unknown) {
  // Postgres exclusion_violation (23P01), surfaced through the pg adapter.
  const text = err instanceof Error ? `${err.message} ${JSON.stringify((err as { meta?: unknown }).meta ?? {})}` : "";
  return text.includes("23P01") || text.includes("no_overlapping_unit_bookings");
}

export async function createBooking(guestUserId: string, input: CreateBookingInput) {
  if (input.stay.checkIn < todayInMaldives()) throw new UserFacingError("Check-in can't be in the past.");
  if (input.numRooms < 1 || input.numRooms > MAX_ROOMS_PER_BOOKING) throw new UserFacingError("Choose how many rooms to book.");

  try {
    return await prisma.$transaction(async (tx) => {
      // One booking at a time per room type: the second of two simultaneous
      // bookings waits here, then sees the first one's rooms as taken.
      await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${input.roomId} FOR UPDATE`;

      const room = await loadBookableRoom(tx, input.propertySlug, input.roomId);
      if (room.property.hostProfile.userId === guestUserId) {
        throw new UserFacingError("You can't book your own property.");
      }
      if (input.numGuests < 1 || input.numGuests > room.maxOccupancy * input.numRooms) {
        throw new UserFacingError(
          `${input.numRooms} × ${room.name} sleeps at most ${room.maxOccupancy * input.numRooms} guests. Add a room or reduce the number of guests.`
        );
      }

      const isPrivateRental = room.property.listingType === "PRIVATE_RENTAL";
      if (input.localGuests < 0 || input.infantGuests < 0 || input.localGuests + input.infantGuests > input.numGuests) {
        throw new UserFacingError("The numbers of Maldivian/resident guests and children under 2 don't add up to your total guests.");
      }
      if (isPrivateRental && input.localGuests !== input.numGuests) {
        throw new UserFacingError("This private rental is for Maldivians and residents only.");
      }
      const currencyIssue = currencyProblem(room.property.listingType, room.currency);
      if (currencyIssue) throw new UserFacingError(currencyIssue);

      const quote = quoteStay(room, input.stay);
      if (quote.stayRuleProblem) throw new UserFacingError(quote.stayRuleProblem);
      const settings = await getPlatformSettings();
      const rates = ratesForProperty(room.property, settings);
      const price = priceBreakdown(quote.totalCents, input.numRooms, input.stay.nights, rates, {
        guests: input.numGuests,
        localGuests: input.localGuests,
        infantGuests: isPrivateRental ? 0 : input.infantGuests,
      });
      if (price.totalCents !== input.expectedTotalCents) {
        throw new UserFacingError("The price for these dates has just changed. Please check the new price and confirm again.");
      }

      const free = await freeUnitIds(tx, room.id, input.stay);
      if (free.length < input.numRooms) {
        throw new UserFacingError(
          free.length === 0
            ? "Sorry, this room was just booked by someone else for these dates."
            : `Sorry, only ${free.length} of these rooms are still available for your dates.`
        );
      }

      const commissionPercent = settings.commissionPercent.toString();
      const commission = commissionCents(price.roomCents, commissionPercent);
      const booking = await tx.booking.create({
        data: {
          bookingReference: await nextBookingReference(tx),
          guestId: guestUserId,
          propertyId: room.property.id,
          roomId: room.id,
          checkInDate: input.stay.checkIn,
          checkOutDate: input.stay.checkOut,
          numGuests: input.numGuests,
          numRooms: input.numRooms,
          subtotalAmount: centsToAmount(price.roomCents),
          serviceChargeAmount: centsToAmount(price.serviceChargeCents),
          tgstAmount: centsToAmount(price.tgstCents),
          greenTaxAmount: centsToAmount(price.greenTaxCents),
          taxAmount: centsToAmount(price.tgstCents + price.greenTaxCents),
          totalAmount: centsToAmount(price.totalCents),
          listingTypeSnapshot: room.property.listingType,
          serviceChargePercent: isPrivateRental ? null : rates.serviceChargePercent,
          tgstPercent: isPrivateRental ? null : rates.tgstPercent,
          greenTaxPerNight: isPrivateRental ? null : rates.greenTaxPerNight,
          greenTaxGuests: price.greenTaxGuests,
          localGuests: input.localGuests,
          infantGuests: isPrivateRental ? 0 : input.infantGuests,
          currency: room.currency,
          commissionRateSnapshot: commissionPercent,
          commissionAmount: centsToAmount(commission),
          // What the host keeps: room + service charge − commission. Taxes are
          // collected by the host on behalf of the government.
          hostPayoutAmount: centsToAmount(price.roomCents + price.serviceChargeCents - commission),
          status: "CONFIRMED",
          paymentStatus: "PENDING", // paid to the host at the property
          specialRequests: input.specialRequests || null,
          contactPhone: input.contactPhone,
          guests: { create: { fullName: input.guestName, isPrimary: true } },
          roomUnits: {
            create: free.slice(0, input.numRooms).map((unitId) => ({
              roomInventoryUnitId: unitId,
              checkInDate: input.stay.checkIn,
              checkOutDate: input.stay.checkOut,
              status: "CONFIRMED" as const,
            })),
          },
        },
      });
      return booking;
    });
  } catch (err) {
    if (isOverlapViolation(err)) {
      throw new UserFacingError("Sorry, this room was just booked by someone else for these dates.");
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

async function setStatus(tx: Tx, bookingId: string, status: BookingStatus, extra: Prisma.BookingUpdateInput = {}) {
  await tx.booking.update({ where: { id: bookingId }, data: { status, ...extra } });
  await tx.bookingRoomUnit.updateMany({ where: { bookingId }, data: { status } });
}

/**
 * Marks stays the host never marked as completed, once they're
 * AUTO_COMPLETE_AFTER_DAYS past check-out. Cheap and idempotent, so it runs
 * whenever bookings or statements are looked at instead of needing a
 * scheduled job.
 */
export async function autoCompletePastStays(now = new Date()) {
  const cutoff = new Date(todayInMaldives(now).getTime() - AUTO_COMPLETE_AFTER_DAYS * DAY_MS);
  const stale = await prisma.booking.findMany({
    where: { status: "CONFIRMED", checkOutDate: { lte: cutoff } },
    select: { id: true },
  });
  if (stale.length === 0) return 0;
  const ids = stale.map((b) => b.id);
  await prisma.$transaction([
    prisma.booking.updateMany({ where: { id: { in: ids }, status: "CONFIRMED" }, data: { status: "COMPLETED" } }),
    prisma.bookingRoomUnit.updateMany({ where: { bookingId: { in: ids } }, data: { status: "COMPLETED" } }),
  ]);
  return ids.length;
}

async function cancel(bookingId: string, byUserId: string, reason: string, where: Prisma.BookingWhereInput) {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id: bookingId, ...where } });
    if (!booking) throw new NotFoundError("Booking");
    if (booking.status !== "CONFIRMED") throw new UserFacingError("Only an upcoming, confirmed booking can be cancelled.");
    if (booking.checkInDate <= todayInMaldives()) {
      throw new UserFacingError("This stay has already started, so it can't be cancelled here. Contact support.");
    }
    await setStatus(tx, bookingId, "CANCELLED", {
      cancelledAt: new Date(),
      cancelledByUserId: byUserId,
      cancellationReason: reason,
    });
  });
}

export function cancelAsGuest(guestUserId: string, bookingId: string, reason: string) {
  return cancel(bookingId, guestUserId, reason || "Cancelled by guest", { guestId: guestUserId });
}

export function cancelAsHost(hostUserId: string, bookingId: string, reason: string) {
  return cancel(bookingId, hostUserId, reason, { property: { hostProfile: { userId: hostUserId } } });
}

/** Host's after-check-out answer: did the guest stay? */
export async function markStayOutcome(hostUserId: string, bookingId: string, outcome: "COMPLETED" | "NO_SHOW") {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, property: { hostProfile: { userId: hostUserId } } },
    });
    if (!booking) throw new NotFoundError("Booking");
    if (booking.commissionStatementId) {
      throw new UserFacingError("This stay has already been billed, so it can't be changed. Contact support.");
    }
    if (!["CONFIRMED", "COMPLETED", "NO_SHOW"].includes(booking.status)) {
      throw new UserFacingError("This booking was cancelled.");
    }
    if (booking.checkInDate > todayInMaldives()) {
      throw new UserFacingError("You can mark the outcome once the guest's check-in day has arrived.");
    }
    const cutoff = new Date(booking.checkOutDate.getTime() + AUTO_COMPLETE_AFTER_DAYS * DAY_MS);
    if (booking.status !== "CONFIRMED" && todayInMaldives() >= cutoff) {
      throw new UserFacingError(`The outcome can only be changed within ${AUTO_COMPLETE_AFTER_DAYS} days of check-out.`);
    }
    await setStatus(tx, bookingId, outcome);
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const bookingListInclude = {
  property: { select: { name: true, slug: true, island: { select: { name: true, atoll: { select: { name: true } } } } } },
  room: { select: { name: true } },
  guest: { select: { name: true, email: true } },
  guests: { where: { isPrimary: true }, select: { fullName: true } },
} satisfies Prisma.BookingInclude;

export async function listGuestBookings(guestUserId: string) {
  await autoCompletePastStays();
  return prisma.booking.findMany({
    where: { guestId: guestUserId },
    orderBy: { checkInDate: "desc" },
    include: {
      ...bookingListInclude,
      property: { select: { ...bookingListInclude.property.select, images: { where: { status: { in: ["LIVE", "PENDING_REMOVE"] } }, orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
    },
  });
}

export async function listHostBookings(hostUserId: string, filter: "upcoming" | "past" | "cancelled" | "all") {
  await autoCompletePastStays();
  const today = todayInMaldives();
  const where: Prisma.BookingWhereInput = {
    property: { hostProfile: { userId: hostUserId } },
    ...(filter === "upcoming" ? { status: "CONFIRMED", checkOutDate: { gt: today } } : {}),
    ...(filter === "past" ? { status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] }, checkOutDate: { lte: today } } : {}),
    ...(filter === "cancelled" ? { status: "CANCELLED" } : {}),
  };
  return prisma.booking.findMany({
    where,
    orderBy: { checkInDate: filter === "upcoming" ? "asc" : "desc" },
    include: bookingListInclude,
    take: 300,
  });
}

export async function listAllBookings(status?: BookingStatus) {
  await autoCompletePastStays();
  return prisma.booking.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { ...bookingListInclude, property: { select: { ...bookingListInclude.property.select, hostProfile: { select: { businessName: true } } } } },
    take: 300,
  });
}

const bookingDetailInclude = {
  ...bookingListInclude,
  property: {
    select: {
      name: true,
      slug: true,
      address: true,
      checkInTime: true,
      checkOutTime: true,
      island: { select: { name: true, atoll: { select: { name: true } } } },
      cancellationPolicy: true,
      hostProfile: { select: { businessName: true, contactPhone: true, userId: true, user: { select: { email: true } } } },
    },
  },
  room: { select: { name: true, mealPlan: true, maxOccupancy: true } },
  commissionStatement: { select: { id: true, periodStart: true, status: true } },
} satisfies Prisma.BookingInclude;

export type BookingDetail = Prisma.BookingGetPayload<{ include: typeof bookingDetailInclude }>;

/** One booking, for its guest, its host, or an admin — nobody else. */
export async function getBookingFor(
  viewer: { userId: string; role: string },
  bookingId: string
): Promise<BookingDetail> {
  await autoCompletePastStays();
  const isAdmin = viewer.role === "ADMIN" || viewer.role === "SUPER_ADMIN";
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      ...(isAdmin
        ? {}
        : { OR: [{ guestId: viewer.userId }, { property: { hostProfile: { userId: viewer.userId } } }] }),
    },
    include: bookingDetailInclude,
  });
  if (!booking) throw new NotFoundError("Booking");
  return booking;
}

/** Free-cancellation deadline for display, from the property's policy. */
export function freeCancellationUntil(checkIn: Date, freeCancellationDays: number | null | undefined) {
  if (freeCancellationDays === null || freeCancellationDays === undefined) return null;
  return new Date(checkIn.getTime() - freeCancellationDays * DAY_MS);
}
