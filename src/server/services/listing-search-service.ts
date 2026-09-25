import { Prisma, type MealPlan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { quoteStay, toCents, type Stay, type StayQuote } from "@/lib/stay-pricing";

/**
 * Public (traveler-facing) reads of property listings: search results and
 * property pages. Nothing here needs a signed-in user.
 *
 * What the public may see — enforced here, in one place:
 * - Only APPROVED properties. Drafts, pending, rejected and suspended
 *   listings don't exist as far as travelers are concerned.
 * - Only the approved version of reviewed content: `name`/`description`
 *   (never `pendingName`/`pendingDescription`) and photos that are LIVE or
 *   PENDING_REMOVE (still live until an admin approves the removal) — never
 *   PENDING_ADD.
 * - Only active room types, counting only active physical rooms.
 * - No host contact details (those come with a booking, later).
 *
 * Availability for a stay = active rooms of a type, minus rooms with an
 * overlapping non-cancelled booking (the same rule as the database's
 * no-double-booking constraint), minus rooms the host has blocked.
 *
 * Search filters location/type/amenities/meal plan in the database, then
 * prices and availability in memory. That's simple and exact, and fine for
 * hundreds of listings; if the catalogue grows into the thousands, move the
 * availability/price step into SQL.
 */

export const PAGE_SIZE = 12;
const PUBLIC_PHOTO = { status: { in: ["LIVE", "PENDING_REMOVE"] } } satisfies Prisma.PropertyImageWhereInput;

/** A listing can appear in search: approved, with at least one bookable room. */
const SEARCHABLE = {
  status: "APPROVED",
  rooms: { some: { isActive: true, inventoryUnits: { some: { isActive: true } } } },
} satisfies Prisma.PropertyWhereInput;

export type SearchSort = "recommended" | "price_asc" | "price_desc";

export type SearchCriteria = {
  atollSlug?: string;
  islandSlug?: string;
  stay: Stay | null;
  guests: number;
  propertyTypeSlug?: string;
  amenitySlugs: string[];
  mealPlan?: MealPlan;
  /** Whole USD per night. Price filters only compare USD-priced rooms. */
  minPrice?: number;
  maxPrice?: number;
  sort: SearchSort;
  page: number;
};

const publicRoomInclude = {
  inventoryUnits: { where: { isActive: true }, select: { id: true } },
  seasonalPrices: { orderBy: { startDate: "asc" } },
  amenities: { include: { amenity: true }, orderBy: { amenity: { name: "asc" } } },
} satisfies Prisma.RoomInclude;

type PublicRoom = Prisma.RoomGetPayload<{ include: typeof publicRoomInclude }>;

export type RoomOffer = {
  room: PublicRoom;
  totalRooms: number;
  /** Rooms free for the whole stay (equals totalRooms when there are no dates). */
  roomsLeft: number;
  quote: StayQuote | null;
  bookable: boolean;
  /** Price used for "from" and price filtering: per-night average for a stay, else base price. */
  nightlyCents: number;
};

/** Units (by id) that are booked or blocked for any night of the stay. */
async function unavailableUnitIds(unitIds: string[], stay: Stay): Promise<Set<string>> {
  if (unitIds.length === 0) return new Set();
  const [booked, blocked] = await Promise.all([
    prisma.bookingRoomUnit.findMany({
      where: {
        roomInventoryUnitId: { in: unitIds },
        status: { not: "CANCELLED" },
        checkInDate: { lt: stay.checkOut },
        checkOutDate: { gt: stay.checkIn },
      },
      select: { roomInventoryUnitId: true },
    }),
    prisma.roomAvailabilityBlock.findMany({
      where: {
        roomInventoryUnitId: { in: unitIds },
        startDate: { lt: stay.checkOut },
        endDate: { gt: stay.checkIn },
      },
      select: { roomInventoryUnitId: true },
    }),
  ]);
  return new Set([...booked, ...blocked].map((r) => r.roomInventoryUnitId));
}

function buildOffers(rooms: PublicRoom[], stay: Stay | null, unavailable: Set<string>): RoomOffer[] {
  return rooms
    .filter((room) => room.inventoryUnits.length > 0)
    .map((room) => {
      const totalRooms = room.inventoryUnits.length;
      const roomsLeft = stay ? room.inventoryUnits.filter((u) => !unavailable.has(u.id)).length : totalRooms;
      const quote = stay ? quoteStay(room, stay) : null;
      return {
        room,
        totalRooms,
        roomsLeft,
        quote,
        bookable: roomsLeft > 0 && !quote?.stayRuleProblem,
        nightlyCents: quote ? quote.averageNightlyCents : toCents(room.basePrice),
      };
    });
}

/** Can the bookable rooms, together, sleep the whole party? */
function sleepsParty(offers: RoomOffer[], guests: number) {
  return offers.filter((o) => o.bookable).reduce((sum, o) => sum + o.roomsLeft * o.room.maxOccupancy, 0) >= guests;
}

function cheapest(offers: RoomOffer[]) {
  const bookable = offers.filter((o) => o.bookable);
  // Prefer USD so prices compare across listings; other currencies only if that's all there is.
  const pool = bookable.some((o) => o.room.currency === "USD")
    ? bookable.filter((o) => o.room.currency === "USD")
    : bookable;
  return pool.reduce<RoomOffer | null>((best, o) => (!best || o.nightlyCents < best.nightlyCents ? o : best), null);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchResult = {
  id: string;
  slug: string;
  name: string;
  propertyType: string;
  island: string;
  atoll: string;
  distanceFromBeachMeters: number | null;
  coverUrl: string | null;
  amenities: string[];
  fromNightlyCents: number;
  fromTotalCents: number | null;
  currency: string;
  roomsLeft: number | null;
};

export async function searchListings(criteria: SearchCriteria) {
  const where: Prisma.PropertyWhereInput = {
    ...SEARCHABLE,
    AND: [
      ...(criteria.islandSlug ? [{ island: { slug: criteria.islandSlug } }] : []),
      ...(criteria.atollSlug ? [{ island: { atoll: { slug: criteria.atollSlug } } }] : []),
      ...(criteria.propertyTypeSlug ? [{ propertyType: { slug: criteria.propertyTypeSlug } }] : []),
      // Every selected amenity must be present.
      ...criteria.amenitySlugs.map((slug) => ({ amenities: { some: { amenity: { slug } } } })),
      ...(criteria.mealPlan ? [{ rooms: { some: { isActive: true, mealPlan: criteria.mealPlan } } }] : []),
    ],
  };

  const properties = await prisma.property.findMany({
    where,
    orderBy: { approvedAt: "desc" },
    include: {
      island: { include: { atoll: true } },
      propertyType: true,
      images: { where: PUBLIC_PHOTO, orderBy: { sortOrder: "asc" }, take: 1 },
      amenities: { include: { amenity: true }, orderBy: { amenity: { name: "asc" } } },
      rooms: {
        where: { isActive: true, ...(criteria.mealPlan ? { mealPlan: criteria.mealPlan } : {}) },
        include: publicRoomInclude,
      },
    },
  });

  const unavailable = criteria.stay
    ? await unavailableUnitIds(
        properties.flatMap((p) => p.rooms.flatMap((r) => r.inventoryUnits.map((u) => u.id))),
        criteria.stay
      )
    : new Set<string>();

  const results: SearchResult[] = [];
  for (const p of properties) {
    const offers = buildOffers(p.rooms, criteria.stay, unavailable);
    if (!sleepsParty(offers, criteria.guests)) continue;
    const best = cheapest(offers);
    if (!best) continue;

    const priceFiltered = criteria.minPrice !== undefined || criteria.maxPrice !== undefined;
    if (priceFiltered) {
      if (best.room.currency !== "USD") continue;
      if (criteria.minPrice !== undefined && best.nightlyCents < criteria.minPrice * 100) continue;
      if (criteria.maxPrice !== undefined && best.nightlyCents > criteria.maxPrice * 100) continue;
    }

    results.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      propertyType: p.propertyType.name,
      island: p.island.name,
      atoll: p.island.atoll.name,
      distanceFromBeachMeters: p.distanceFromBeachMeters,
      coverUrl: p.images[0]?.url ?? null,
      amenities: p.amenities.map((a) => a.amenity.name),
      fromNightlyCents: best.nightlyCents,
      fromTotalCents: best.quote?.totalCents ?? null,
      currency: best.room.currency,
      roomsLeft: criteria.stay ? offers.filter((o) => o.bookable).reduce((n, o) => n + o.roomsLeft, 0) : null,
    });
  }

  if (criteria.sort !== "recommended") {
    const direction = criteria.sort === "price_asc" ? 1 : -1;
    // USD listings are compared by price; any non-USD listings go last.
    results.sort((a, b) => {
      const aUsd = a.currency === "USD" ? 0 : 1;
      const bUsd = b.currency === "USD" ? 0 : 1;
      return aUsd - bUsd || direction * (a.fromNightlyCents - b.fromNightlyCents);
    });
  }

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, criteria.page), totalPages);
  return {
    total: results.length,
    page,
    totalPages,
    results: results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}

// ---------------------------------------------------------------------------
// Property page
// ---------------------------------------------------------------------------

export async function getPublicListing(slug: string, stay: Stay | null) {
  const property = await prisma.property.findFirst({
    where: { slug, status: "APPROVED" },
    // Explicit select, so pending edits and host contact details can't leak
    // into the page by accident.
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      address: true,
      distanceFromBeachMeters: true,
      distanceFromHarborMeters: true,
      checkInTime: true,
      checkOutTime: true,
      island: { select: { name: true, slug: true, atoll: { select: { name: true, slug: true } } } },
      propertyType: { select: { name: true } },
      images: { where: PUBLIC_PHOTO, orderBy: { sortOrder: "asc" }, select: { id: true, url: true, altText: true } },
      amenities: { select: { amenity: { select: { name: true, category: true } } }, orderBy: { amenity: { name: "asc" } } },
      cancellationPolicy: true,
      hostProfile: { select: { businessName: true } },
      rooms: { where: { isActive: true }, orderBy: { basePrice: "asc" }, include: publicRoomInclude },
    },
  });
  if (!property) return null;

  const unavailable = stay
    ? await unavailableUnitIds(property.rooms.flatMap((r) => r.inventoryUnits.map((u) => u.id)), stay)
    : new Set<string>();
  const offers = buildOffers(property.rooms, stay, unavailable);
  return { property, offers, cheapest: cheapest(offers) };
}

/** Atolls and islands that have at least one searchable listing, for the search form. */
export async function getSearchOptions() {
  const [atolls, propertyTypes, amenities] = await Promise.all([
    prisma.atoll.findMany({
      orderBy: { name: "asc" },
      select: {
        slug: true,
        name: true,
        islands: {
          orderBy: { name: "asc" },
          select: {
            slug: true,
            name: true,
            _count: { select: { properties: { where: SEARCHABLE } } },
          },
        },
      },
    }),
    prisma.propertyType.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    prisma.amenity.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }], select: { slug: true, name: true } }),
  ]);
  const withListings = atolls
    .map((a) => ({
      ...a,
      islands: a.islands.filter((i) => i._count.properties > 0),
      listingCount: a.islands.reduce((n, i) => n + i._count.properties, 0),
    }))
    .filter((a) => a.listingCount > 0);
  return { atolls: withListings, propertyTypes, amenities };
}
