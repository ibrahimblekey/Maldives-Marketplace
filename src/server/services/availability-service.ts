import { prisma } from "@/lib/db";
import { todayInMaldives } from "@/lib/stay-pricing";
import { NotFoundError, UserFacingError } from "./errors";

/**
 * Host availability: blocking physical rooms for dates (maintenance, a
 * booking taken elsewhere…) and a day-by-day view of free rooms.
 * A block uses the same convention as bookings: [startDate, endDate), so a
 * block ending on the 12th leaves the night of the 12th free.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const GRID_DAYS = 28;
const MAX_BLOCK_DAYS = 366;

async function loadOwnedProperty(hostUserId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, hostProfile: { userId: hostUserId } },
    select: { id: true, status: true },
  });
  if (!property) throw new NotFoundError("Property");
  if (property.status === "SUSPENDED") throw new UserFacingError("This listing is suspended.");
  return property;
}

export async function getAvailability(hostUserId: string, propertyId: string, from: Date) {
  await loadOwnedProperty(hostUserId, propertyId);
  const until = new Date(from.getTime() + GRID_DAYS * DAY_MS);
  const days = Array.from({ length: GRID_DAYS }, (_, i) => new Date(from.getTime() + i * DAY_MS));

  const rooms = await prisma.room.findMany({
    where: { propertyId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      inventoryUnits: {
        where: { isActive: true },
        select: {
          id: true,
          bookingUnits: {
            where: { status: { not: "CANCELLED" }, checkInDate: { lt: until }, checkOutDate: { gt: from } },
            select: { checkInDate: true, checkOutDate: true },
          },
          availabilityBlocks: {
            where: { startDate: { lt: until }, endDate: { gt: from } },
            select: { startDate: true, endDate: true },
          },
        },
      },
    },
  });

  const grid = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    total: room.inventoryUnits.length,
    days: days.map((day) => {
      let booked = 0;
      let blocked = 0;
      for (const unit of room.inventoryUnits) {
        if (unit.bookingUnits.some((b) => b.checkInDate <= day && day < b.checkOutDate)) booked += 1;
        else if (unit.availabilityBlocks.some((b) => b.startDate <= day && day < b.endDate)) blocked += 1;
      }
      return { date: day, booked, blocked, free: room.inventoryUnits.length - booked - blocked };
    }),
  }));

  const blocks = await prisma.roomAvailabilityBlock.findMany({
    where: { roomInventoryUnit: { room: { propertyId } }, endDate: { gt: todayInMaldives() } },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, startDate: true, endDate: true, reason: true, roomInventoryUnit: { select: { room: { select: { name: true } } } } },
  });

  return { days, grid, blocks };
}

export async function addBlock(
  hostUserId: string,
  propertyId: string,
  input: { roomId: string; startDate: Date; endDate: Date; count: number; reason?: string }
) {
  await loadOwnedProperty(hostUserId, propertyId);
  if (input.startDate < todayInMaldives()) throw new UserFacingError("You can't block dates in the past.");
  if (input.endDate <= input.startDate) throw new UserFacingError("The last blocked night can't be before the first.");
  if ((input.endDate.getTime() - input.startDate.getTime()) / DAY_MS > MAX_BLOCK_DAYS) {
    throw new UserFacingError("Block at most one year at a time.");
  }

  await prisma.$transaction(async (tx) => {
    // Same lock as a booking of this room type, so a block and a booking can't grab the same room at once.
    await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${input.roomId} FOR UPDATE`;
    const room = await tx.room.findFirst({ where: { id: input.roomId, propertyId, isActive: true }, select: { id: true } });
    if (!room) throw new NotFoundError("Room");

    const units = await tx.roomInventoryUnit.findMany({
      where: { roomId: room.id, isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingUnits: {
          where: { status: { not: "CANCELLED" }, checkInDate: { lt: input.endDate }, checkOutDate: { gt: input.startDate } },
          select: { id: true },
        },
        availabilityBlocks: {
          where: { startDate: { lt: input.endDate }, endDate: { gt: input.startDate } },
          select: { id: true },
        },
      },
    });
    const free = units.filter((u) => u.bookingUnits.length === 0 && u.availabilityBlocks.length === 0);
    if (free.length < input.count) {
      throw new UserFacingError(
        free.length === 0
          ? "No rooms of this type are free for all of those nights (they're booked or already blocked)."
          : `Only ${free.length} room(s) of this type are free for all of those nights.`
      );
    }
    await tx.roomAvailabilityBlock.createMany({
      data: free.slice(0, input.count).map((u) => ({
        roomInventoryUnitId: u.id,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason || null,
      })),
    });
  });
}

export async function removeBlock(hostUserId: string, propertyId: string, blockId: string) {
  await loadOwnedProperty(hostUserId, propertyId);
  const result = await prisma.roomAvailabilityBlock.deleteMany({
    where: { id: blockId, roomInventoryUnit: { room: { propertyId } } },
  });
  if (result.count === 0) throw new NotFoundError("Block");
}
