import { Prisma, type Property, type PropertyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slugify";
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  type PoliciesInput,
  type PropertyBasicsInput,
  type RoomInput,
  type SeasonalPriceInput,
} from "@/lib/validation/property";
import { NotFoundError, UserFacingError } from "./errors";
import { assertHostNotSuspended } from "./moderation-service";

/**
 * Host-side business rules for property listings.
 *
 * Every exported function takes the signed-in user's id and loads the
 * property through `hostProfile.userId`, so a host can only ever read or
 * change their own listings — whatever property/room/photo id the browser
 * sends. The server actions in src/app/dashboard/host/properties/actions.ts
 * only establish "is this a HOST"; ownership is enforced here.
 *
 * Listing lifecycle:
 *   DRAFT ──submit──▶ PENDING_APPROVAL ──admin approves──▶ APPROVED
 *     ▲                 │        │
 *     └───withdraw──────┘        └──admin rejects──▶ REJECTED ──submit──▶ …
 *
 * What a host may change, by status:
 *   DRAFT / REJECTED   everything, directly.
 *   PENDING_APPROVAL   nothing (withdraw first) — the admin is reviewing it.
 *   APPROVED           prices, room counts, rooms, amenities, policies and
 *                      distances: directly, no review.
 *                      Name, description, photos: held as a change request
 *                      (pendingName / pendingDescription / photo status)
 *                      while the approved version stays live.
 *                      Property type, island, address: locked.
 *   SUSPENDED          nothing.
 */

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Loading + permission helpers
// ---------------------------------------------------------------------------

async function loadOwned(userId: string, propertyId: string, db: Tx | typeof prisma = prisma) {
  const property = await db.property.findFirst({
    where: { id: propertyId, hostProfile: { userId } },
  });
  if (!property) throw new NotFoundError("Property");
  return property;
}

export function canEdit(status: PropertyStatus) {
  return status === "DRAFT" || status === "REJECTED" || status === "APPROVED";
}

function assertEditable(property: Pick<Property, "status">) {
  if (property.status === "PENDING_APPROVAL") {
    throw new UserFacingError(
      "This listing is waiting for admin review, so it can't be changed right now. Withdraw it from review first if you need to edit it."
    );
  }
  if (property.status === "SUSPENDED") {
    throw new UserFacingError("This listing is suspended. Contact support to make changes.");
  }
}

async function requireHostProfileId(userId: string) {
  const profile = await prisma.hostProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new UserFacingError("Fill in your host details before listing a property.");
  return profile.id;
}

async function uniquePropertySlug(name: string) {
  const base = slugify(name) || "property";
  let candidate = base;
  for (let suffix = 2; ; suffix += 1) {
    const existing = await prisma.property.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
  }
}

async function assertTypeAndIslandExist(propertyTypeId: string, islandId: string) {
  const [type, island] = await Promise.all([
    prisma.propertyType.findUnique({ where: { id: propertyTypeId }, select: { id: true } }),
    prisma.island.findUnique({ where: { id: islandId }, select: { id: true } }),
  ]);
  if (!type) throw new UserFacingError("Select a valid property type.");
  if (!island) throw new UserFacingError("Select a valid island.");
}

async function assertAmenitiesExist(amenityIds: string[]) {
  const unique = [...new Set(amenityIds)];
  if (unique.length === 0) return unique;
  const found = await prisma.amenity.count({ where: { id: { in: unique } } });
  if (found !== unique.length) throw new UserFacingError("One of the selected amenities no longer exists. Reload the page.");
  return unique;
}

/**
 * Keeps `changesSubmittedAt` in sync with whether an approved listing has
 * anything waiting for review. Called after every edit to reviewed content;
 * it always moves the timestamp forward, which is what lets the admin
 * screen refuse to approve a version the admin didn't actually see.
 */
async function syncChangeRequest(tx: Tx, propertyId: string) {
  const property = await tx.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { pendingName: true, pendingDescription: true },
  });
  const pendingPhotos = await tx.propertyImage.count({
    where: { propertyId, status: { not: "LIVE" } },
  });
  const hasChanges = property.pendingName !== null || property.pendingDescription !== null || pendingPhotos > 0;
  await tx.property.update({
    where: { id: propertyId },
    data: hasChanges
      ? { changesSubmittedAt: new Date(), changesRejectionReason: null }
      : { changesSubmittedAt: null },
  });
}

/**
 * Throws away an approved listing's pending change request: pending text is
 * cleared, newly added photos are deleted, photos marked for removal are
 * kept. Returns the URLs of photo files that should now be deleted from
 * storage (after the transaction commits). Shared by the host's "discard
 * changes" and the admin's "reject changes".
 */
export async function discardChangeRequest(tx: Tx, propertyId: string): Promise<string[]> {
  const added = await tx.propertyImage.findMany({
    where: { propertyId, status: "PENDING_ADD" },
    select: { url: true },
  });
  await tx.propertyImage.deleteMany({ where: { propertyId, status: "PENDING_ADD" } });
  await tx.propertyImage.updateMany({
    where: { propertyId, status: "PENDING_REMOVE" },
    data: { status: "LIVE" },
  });
  await tx.property.update({
    where: { id: propertyId },
    data: { pendingName: null, pendingDescription: null, changesSubmittedAt: null },
  });
  return added.map((p) => p.url);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listHostProperties(userId: string) {
  return prisma.property.findMany({
    where: { hostProfile: { userId } },
    orderBy: { updatedAt: "desc" },
    include: {
      island: { select: { name: true, atoll: { select: { name: true } } } },
      propertyType: { select: { name: true } },
      images: { where: { status: { not: "PENDING_ADD" } }, orderBy: { sortOrder: "asc" }, take: 1 },
      _count: { select: { rooms: true } },
    },
  });
}

export const propertyDetailInclude = {
  island: { include: { atoll: true } },
  propertyType: true,
  images: { orderBy: { sortOrder: "asc" } },
  amenities: { include: { amenity: true } },
  cancellationPolicy: true,
  rooms: {
    orderBy: { createdAt: "asc" },
    include: {
      inventoryUnits: { where: { isActive: true }, select: { id: true } },
      seasonalPrices: { orderBy: { startDate: "asc" } },
      amenities: { include: { amenity: true } },
    },
  },
  hostProfile: { include: { user: { select: { name: true, email: true } } } },
} satisfies Prisma.PropertyInclude;

export type PropertyDetail = Prisma.PropertyGetPayload<{ include: typeof propertyDetailInclude }>;

export async function getHostProperty(userId: string, propertyId: string): Promise<PropertyDetail> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, hostProfile: { userId } },
    include: propertyDetailInclude,
  });
  if (!property) throw new NotFoundError("Property");
  return property;
}

export async function getWizardOptions() {
  const [propertyTypes, atolls, amenities] = await Promise.all([
    prisma.propertyType.findMany({ orderBy: { name: "asc" } }),
    prisma.atoll.findMany({
      orderBy: { name: "asc" },
      include: { islands: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.amenity.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  return { propertyTypes, atolls, amenities };
}

/** What still blocks a draft from being submitted. Empty = ready. */
export function submissionProblems(property: PropertyDetail): string[] {
  const problems: string[] = [];
  const activeRooms = property.rooms.filter((r) => r.isActive && r.inventoryUnits.length > 0);
  if (activeRooms.length === 0) problems.push("Add at least one room type with at least 1 room.");
  if (!property.checkInTime || !property.checkOutTime || !property.cancellationPolicy) {
    problems.push("Fill in your check-in/check-out times and policies.");
  }
  const photos = property.images.filter((i) => i.status !== "PENDING_REMOVE").length;
  if (photos < MIN_PHOTOS) {
    problems.push(`Upload at least ${MIN_PHOTOS} photos (you have ${photos}).`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Step 1 — basics
// ---------------------------------------------------------------------------

export async function createProperty(userId: string, input: PropertyBasicsInput) {
  const hostProfileId = await requireHostProfileId(userId);
  await assertHostNotSuspended(userId);
  await assertTypeAndIslandExist(input.propertyTypeId, input.islandId);

  for (let attempt = 0; ; attempt += 1) {
    const slug = await uniquePropertySlug(input.name);
    try {
      return await prisma.property.create({
        data: {
          hostProfileId,
          name: input.name,
          slug,
          description: input.description,
          propertyTypeId: input.propertyTypeId,
          islandId: input.islandId,
          listingType: input.listingType,
          address: input.address ?? null,
          distanceFromBeachMeters: input.distanceFromBeachMeters ?? null,
          distanceFromHarborMeters: input.distanceFromHarborMeters ?? null,
        },
      });
    } catch (err) {
      // Two hosts creating the same name at the same moment: retry with the next free slug.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 3) continue;
      throw err;
    }
  }
}

/**
 * Saves step 1. On a live (APPROVED) listing, type/island/address are
 * locked and any name/description difference becomes a change request.
 * Returns true when the save created or updated a change request.
 */
export async function updateBasics(
  userId: string,
  propertyId: string,
  input: Pick<PropertyBasicsInput, "name" | "description" | "distanceFromBeachMeters" | "distanceFromHarborMeters"> &
    Partial<Pick<PropertyBasicsInput, "propertyTypeId" | "islandId" | "address" | "listingType">>
): Promise<boolean> {
  const property = await loadOwned(userId, propertyId);
  assertEditable(property);

  const distances = {
    distanceFromBeachMeters: input.distanceFromBeachMeters ?? null,
    distanceFromHarborMeters: input.distanceFromHarborMeters ?? null,
  };

  if (property.status !== "APPROVED") {
    if (!input.propertyTypeId || !input.islandId) throw new UserFacingError("Select a property type and island.");
    await assertTypeAndIslandExist(input.propertyTypeId, input.islandId);
    if (input.listingType === "TOURIST_PROPERTY") await assertAllRoomsInUsd(propertyId);
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        name: input.name,
        description: input.description,
        propertyTypeId: input.propertyTypeId,
        islandId: input.islandId,
        ...(input.listingType ? { listingType: input.listingType } : {}),
        address: input.address ?? null,
        ...distances,
      },
    });
    return false;
  }

  const pendingName = input.name === property.name ? null : input.name;
  const pendingDescription = input.description === property.description ? null : input.description;
  const reviewedChanged =
    pendingName !== property.pendingName || pendingDescription !== property.pendingDescription;

  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: propertyId },
      data: { ...distances, pendingName, pendingDescription },
    });
    if (reviewedChanged) await syncChangeRequest(tx, propertyId);
  });
  return pendingName !== null || pendingDescription !== null;
}

// ---------------------------------------------------------------------------
// Rooms, room counts, seasonal prices
// ---------------------------------------------------------------------------

/** Green tax is in US dollars, so tourist properties price in USD (docs/decisions.md). */
const USD_ONLY_MESSAGE =
  "Licensed tourist properties must set room prices in US dollars (USD), because green tax is charged in USD.";

async function assertAllRoomsInUsd(propertyId: string) {
  const other = await prisma.room.count({ where: { propertyId, currency: { not: "USD" } } });
  if (other > 0) throw new UserFacingError(`${USD_ONLY_MESSAGE} Change your room prices to USD first.`);
}

function assertCurrencyAllowed(property: Pick<Property, "listingType">, currency: string) {
  if (property.listingType === "TOURIST_PROPERTY" && currency !== "USD") throw new UserFacingError(USD_ONLY_MESSAGE);
}

async function loadOwnedRoom(userId: string, propertyId: string, roomId: string) {
  const property = await loadOwned(userId, propertyId);
  const room = await prisma.room.findFirst({ where: { id: roomId, propertyId } });
  if (!room) throw new NotFoundError("Room");
  return { property, room };
}

/**
 * Brings a room type's number of sellable physical rooms (active
 * RoomInventoryUnits) to `target`. Adding reuses retired units first.
 * Removing deletes units that have never been booked; a unit with booking
 * history is retired (isActive = false) instead, so past bookings keep
 * pointing at a real row.
 */
async function setUnitCount(tx: Tx, roomId: string, target: number) {
  const units = await tx.roomInventoryUnit.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { bookingUnits: true } } },
  });
  const active = units.filter((u) => u.isActive);

  if (active.length < target) {
    let missing = target - active.length;
    const retired = units.filter((u) => !u.isActive).slice(0, missing);
    if (retired.length > 0) {
      await tx.roomInventoryUnit.updateMany({
        where: { id: { in: retired.map((u) => u.id) } },
        data: { isActive: true },
      });
      missing -= retired.length;
    }
    if (missing > 0) {
      await tx.roomInventoryUnit.createMany({ data: Array.from({ length: missing }, () => ({ roomId })) });
    }
  } else if (active.length > target) {
    // Prefer removing never-booked units, newest first.
    const removable = [...active]
      .reverse()
      .sort((a, b) => a._count.bookingUnits - b._count.bookingUnits)
      .slice(0, active.length - target);
    const deletable = removable.filter((u) => u._count.bookingUnits === 0).map((u) => u.id);
    const retire = removable.filter((u) => u._count.bookingUnits > 0).map((u) => u.id);
    if (deletable.length > 0) await tx.roomInventoryUnit.deleteMany({ where: { id: { in: deletable } } });
    if (retire.length > 0) {
      await tx.roomInventoryUnit.updateMany({ where: { id: { in: retire } }, data: { isActive: false } });
    }
  }
}

function roomData(input: RoomInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    maxOccupancy: input.maxOccupancy,
    bedConfiguration: input.bedConfiguration ?? null,
    sizeSqm: input.sizeSqm ?? null,
    mealPlan: input.mealPlan,
    basePrice: input.basePrice,
    currency: input.currency,
    minStayNights: input.minStayNights ?? null,
    maxStayNights: input.maxStayNights ?? null,
    extraGuestFee: input.extraGuestFee ?? null,
    extraBedFee: input.extraBedFee ?? null,
  };
}

export async function createRoom(userId: string, propertyId: string, input: RoomInput) {
  const property = await loadOwned(userId, propertyId);
  assertEditable(property);
  assertCurrencyAllowed(property, input.currency);
  const amenityIds = await assertAmenitiesExist(input.amenityIds);

  return prisma.$transaction(async (tx) => {
    const room = await tx.room.create({ data: { propertyId, ...roomData(input) } });
    await setUnitCount(tx, room.id, input.unitCount);
    if (amenityIds.length > 0) {
      await tx.roomAmenity.createMany({ data: amenityIds.map((amenityId) => ({ roomId: room.id, amenityId })) });
    }
    return room;
  });
}

/** Prices, counts and room details are never reviewed — saved directly in every editable status. */
export async function updateRoom(userId: string, propertyId: string, roomId: string, input: RoomInput) {
  const { property } = await loadOwnedRoom(userId, propertyId, roomId);
  assertEditable(property);
  assertCurrencyAllowed(property, input.currency);
  const amenityIds = await assertAmenitiesExist(input.amenityIds);

  await prisma.$transaction(async (tx) => {
    // Saving the room confirms its price is entered the current way (before taxes).
    await tx.room.update({ where: { id: roomId }, data: { ...roomData(input), needsPriceReview: false } });
    await setUnitCount(tx, roomId, input.unitCount);
    await tx.roomAmenity.deleteMany({ where: { roomId } });
    if (amenityIds.length > 0) {
      await tx.roomAmenity.createMany({ data: amenityIds.map((amenityId) => ({ roomId, amenityId })) });
    }
  });
}

export async function deleteRoom(userId: string, propertyId: string, roomId: string) {
  const { property } = await loadOwnedRoom(userId, propertyId, roomId);
  assertEditable(property);

  const bookings = await prisma.booking.count({ where: { roomId } });
  if (bookings > 0) {
    throw new UserFacingError(
      "This room type has bookings, so it can't be deleted. Set its number of rooms to what you still have instead."
    );
  }
  if (property.status === "APPROVED") {
    const otherRooms = await prisma.room.count({ where: { propertyId, isActive: true, id: { not: roomId } } });
    if (otherRooms === 0) {
      throw new UserFacingError("A live listing needs at least one room type. Add another one before deleting this.");
    }
  }
  try {
    await prisma.room.delete({ where: { id: roomId } });
  } catch (err) {
    // A booking created between the count above and this delete: the
    // database's onDelete: Restrict on Booking.roomId is the real guarantee.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new UserFacingError("This room type has bookings, so it can't be deleted.");
    }
    throw err;
  }
}

export async function addSeasonalPrice(
  userId: string,
  propertyId: string,
  roomId: string,
  input: SeasonalPriceInput
) {
  const { property } = await loadOwnedRoom(userId, propertyId, roomId);
  assertEditable(property);

  const startDate = new Date(`${input.startDate}T00:00:00Z`);
  const endDate = new Date(`${input.endDate}T00:00:00Z`);
  const overlapping = await prisma.seasonalPrice.findFirst({
    where: { roomId, startDate: { lte: endDate }, endDate: { gte: startDate } },
  });
  if (overlapping) {
    throw new UserFacingError(
      `These dates overlap "${overlapping.name ?? "another season"}" (${overlapping.startDate
        .toISOString()
        .slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)}). Delete that one first or pick other dates.`
    );
  }
  await prisma.seasonalPrice.create({
    data: {
      roomId,
      name: input.name ?? null,
      startDate,
      endDate,
      pricePerNight: input.pricePerNight,
      minStayNights: input.minStayNights ?? null,
    },
  });
}

export async function deleteSeasonalPrice(userId: string, propertyId: string, roomId: string, seasonalPriceId: string) {
  const { property } = await loadOwnedRoom(userId, propertyId, roomId);
  assertEditable(property);
  const result = await prisma.seasonalPrice.deleteMany({ where: { id: seasonalPriceId, roomId } });
  if (result.count === 0) throw new NotFoundError("Seasonal price");
}

// ---------------------------------------------------------------------------
// Amenities + policies (never reviewed)
// ---------------------------------------------------------------------------

export async function setPropertyAmenities(userId: string, propertyId: string, amenityIds: string[]) {
  const property = await loadOwned(userId, propertyId);
  assertEditable(property);
  const ids = await assertAmenitiesExist(amenityIds);

  await prisma.$transaction([
    prisma.propertyAmenity.deleteMany({ where: { propertyId } }),
    prisma.propertyAmenity.createMany({ data: ids.map((amenityId) => ({ propertyId, amenityId })) }),
  ]);
}

export async function savePolicies(userId: string, propertyId: string, input: PoliciesInput) {
  const property = await loadOwned(userId, propertyId);
  assertEditable(property);

  const policy = {
    freeCancellationDays: input.freeCancellationDays ?? null,
    refundPercentageAfter: input.refundPercentageAfter ?? null,
    description: input.description ?? null,
    childrenPolicy: input.childrenPolicy ?? null,
    extraBedPolicy: input.extraBedPolicy ?? null,
    petsAllowed: input.petsAllowed,
    smokingAllowed: input.smokingAllowed,
  };
  const isTourist = property.listingType === "TOURIST_PROPERTY";
  await prisma.$transaction([
    prisma.property.update({
      where: { id: propertyId },
      data: {
        checkInTime: input.checkInTime,
        checkOutTime: input.checkOutTime,
        // Taxes & charges apply to tourist properties only. Empty = platform default.
        serviceChargePercent: isTourist ? (input.serviceChargePercent ?? null) : null,
        greenTaxTier: isTourist ? input.greenTaxTier : "STANDARD",
      },
    }),
    prisma.cancellationPolicy.upsert({
      where: { propertyId },
      create: { propertyId, ...policy },
      update: policy,
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/** Checked before a file is stored, so a refused upload never costs storage. */
export async function assertCanAddPhoto(userId: string, propertyId: string) {
  const property = await loadOwned(userId, propertyId);
  assertEditable(property);
  const count = await prisma.propertyImage.count({ where: { propertyId, status: { not: "PENDING_REMOVE" } } });
  if (count >= MAX_PHOTOS) throw new UserFacingError(`A listing can have at most ${MAX_PHOTOS} photos.`);
}

/** Records an already-stored photo. On a live listing it joins the change request. */
export async function addPhoto(userId: string, propertyId: string, url: string) {
  const property = await loadOwned(userId, propertyId);
  assertEditable(property);
  const isLive = property.status === "APPROVED";

  return prisma.$transaction(async (tx) => {
    const last = await tx.propertyImage.findFirst({
      where: { propertyId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const image = await tx.propertyImage.create({
      data: {
        propertyId,
        url,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        status: isLive ? "PENDING_ADD" : "LIVE",
      },
    });
    if (isLive) await syncChangeRequest(tx, propertyId);
    return image;
  });
}

async function loadOwnedPhoto(userId: string, propertyId: string, imageId: string) {
  const property = await loadOwned(userId, propertyId);
  assertEditable(property);
  const image = await prisma.propertyImage.findFirst({ where: { id: imageId, propertyId } });
  if (!image) throw new NotFoundError("Photo");
  return { property, image };
}

/**
 * Removes a photo. Returns the URL to delete from storage, or null when
 * the photo is only marked for removal (live listing — the photo stays
 * visible until an admin approves the change).
 */
export async function removePhoto(userId: string, propertyId: string, imageId: string): Promise<string | null> {
  const { property, image } = await loadOwnedPhoto(userId, propertyId, imageId);

  if (property.status !== "APPROVED" || image.status === "PENDING_ADD") {
    await prisma.$transaction(async (tx) => {
      await tx.propertyImage.delete({ where: { id: imageId } });
      if (property.status === "APPROVED") await syncChangeRequest(tx, propertyId);
    });
    return image.url;
  }

  if (image.status === "PENDING_REMOVE") return null;
  const remaining = await prisma.propertyImage.count({
    where: { propertyId, status: { in: ["LIVE", "PENDING_ADD"] } },
  });
  if (remaining - 1 < MIN_PHOTOS) {
    throw new UserFacingError(
      `A listing needs at least ${MIN_PHOTOS} photos. Upload a replacement first, then remove this one.`
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.propertyImage.update({ where: { id: imageId }, data: { status: "PENDING_REMOVE" } });
    await syncChangeRequest(tx, propertyId);
  });
  return null;
}

/** Undoes a pending removal on a live listing. */
export async function keepPhoto(userId: string, propertyId: string, imageId: string) {
  const { image } = await loadOwnedPhoto(userId, propertyId, imageId);
  if (image.status !== "PENDING_REMOVE") return;
  await prisma.$transaction(async (tx) => {
    await tx.propertyImage.update({ where: { id: imageId }, data: { status: "LIVE" } });
    await syncChangeRequest(tx, propertyId);
  });
}

/**
 * Reordering (including picking the cover photo) only rearranges photos
 * that are already there, so it takes effect immediately on every
 * editable listing, without review.
 */
export async function movePhoto(userId: string, propertyId: string, imageId: string, direction: "up" | "down" | "cover") {
  await loadOwnedPhoto(userId, propertyId, imageId);

  await prisma.$transaction(async (tx) => {
    const images = await tx.propertyImage.findMany({
      where: { propertyId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const order = images.map((i) => i.id);
    const index = order.indexOf(imageId);
    if (direction === "cover") {
      order.splice(index, 1);
      order.unshift(imageId);
    } else {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
    }
    for (const [sortOrder, id] of order.entries()) {
      await tx.propertyImage.update({ where: { id }, data: { sortOrder } });
    }
  });
}

// ---------------------------------------------------------------------------
// Submitting, withdrawing, discarding changes, deleting
// ---------------------------------------------------------------------------

export async function submitForReview(userId: string, propertyId: string) {
  await assertHostNotSuspended(userId);
  const property = await getHostProperty(userId, propertyId);
  if (property.status !== "DRAFT" && property.status !== "REJECTED") {
    throw new UserFacingError("Only a draft or rejected listing can be submitted for review.");
  }
  const problems = submissionProblems(property);
  if (problems.length > 0) throw new UserFacingError(`Not ready yet: ${problems.join(" ")}`);

  // Conditional update: if the status changed since it was read above
  // (e.g. a double-click), nothing is written.
  const result = await prisma.property.updateMany({
    where: { id: propertyId, status: { in: ["DRAFT", "REJECTED"] } },
    data: { status: "PENDING_APPROVAL", submittedAt: new Date(), rejectionReason: null },
  });
  if (result.count === 0) throw new UserFacingError("This listing was already submitted.");
}

export async function withdrawFromReview(userId: string, propertyId: string) {
  await loadOwned(userId, propertyId);
  const result = await prisma.property.updateMany({
    where: { id: propertyId, status: "PENDING_APPROVAL" },
    data: { status: "DRAFT", submittedAt: null },
  });
  if (result.count === 0) throw new UserFacingError("This listing isn't waiting for review.");
}

/** Host cancels their own pending change request on a live listing. */
export async function discardChanges(userId: string, propertyId: string): Promise<string[]> {
  const property = await loadOwned(userId, propertyId);
  if (property.status !== "APPROVED") throw new UserFacingError("There are no pending changes to discard.");
  return prisma.$transaction((tx) => discardChangeRequest(tx, propertyId));
}

/**
 * Only never-approved listings (draft/rejected) can be deleted by the host.
 * Returns the photo URLs to delete from storage.
 */
export async function deleteProperty(userId: string, propertyId: string): Promise<string[]> {
  const property = await loadOwned(userId, propertyId);
  if (property.status !== "DRAFT" && property.status !== "REJECTED") {
    throw new UserFacingError(
      property.status === "PENDING_APPROVAL"
        ? "Withdraw this listing from review before deleting it."
        : "Live listings can't be deleted from here. Contact support to take one down."
    );
  }
  const bookings = await prisma.booking.count({ where: { propertyId } });
  if (bookings > 0) throw new UserFacingError("This property has bookings, so it can't be deleted.");

  const images = await prisma.propertyImage.findMany({ where: { propertyId }, select: { url: true } });
  try {
    await prisma.property.delete({ where: { id: propertyId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new UserFacingError("This property has bookings, so it can't be deleted.");
    }
    throw err;
  }
  return images.map((i) => i.url);
}
