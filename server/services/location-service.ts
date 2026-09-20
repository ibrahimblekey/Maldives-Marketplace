import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slugify";
import type { AtollInput, IslandInput } from "@/lib/validation/location";

/**
 * Business logic for the admin "Locations" screens (Country -> Atoll ->
 * Island). Kept separate from the server actions in
 * src/app/dashboard/admin/locations/actions.ts the same way user-service.ts
 * is kept separate from the register route: actions.ts only checks
 * "is this caller allowed to do this at all", this file owns "is this
 * change valid and consistent".
 */

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found.`);
    this.name = "NotFoundError";
  }
}

export class DuplicateNameError extends Error {
  constructor(what: string, name: string) {
    super(`A ${what} named "${name}" already exists.`);
    this.name = "DuplicateNameError";
  }
}

export class HasDependentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HasDependentsError";
  }
}

export class NoCountryConfiguredError extends Error {
  constructor() {
    super(
      "No country is configured yet. Run the database seed script once " +
        "(npm run db:seed) before adding atolls — it creates the Maldives " +
        "country record every atoll belongs to."
    );
    this.name = "NoCountryConfiguredError";
  }
}

/**
 * Generates a slug from `name` and, if it collides with a different
 * existing row, appends -2, -3, ... until it's free. `excludeId` lets an
 * update check uniqueness against every row except the one being edited.
 */
async function uniqueSlug(
  model: { findUnique: (args: { where: { slug: string } }) => Promise<{ id: string } | null> },
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name) || "location";
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const existing = await model.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

// ---------------------------------------------------------------------------
// Atolls
// ---------------------------------------------------------------------------

export async function listAtolls() {
  return prisma.atoll.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { islands: true } } },
  });
}

export async function getAtoll(id: string) {
  const atoll = await prisma.atoll.findUnique({
    where: { id },
    include: { _count: { select: { islands: true } } },
  });
  if (!atoll) throw new NotFoundError("Atoll");
  return atoll;
}

export async function createAtoll(input: AtollInput) {
  const country = await prisma.country.findFirst({ orderBy: { createdAt: "asc" } });
  if (!country) throw new NoCountryConfiguredError();

  const slug = await uniqueSlugForAtoll(input.name);

  try {
    return await prisma.atoll.create({
      data: {
        name: input.name,
        slug,
        description: input.description || null,
        countryId: country.id,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateNameError("atoll", input.name);
    }
    throw err;
  }
}

export async function updateAtoll(id: string, input: AtollInput) {
  const existing = await prisma.atoll.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Atoll");

  const slug =
    existing.name === input.name ? existing.slug : await uniqueSlugForAtoll(input.name, id);

  try {
    return await prisma.atoll.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: input.description || null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateNameError("atoll", input.name);
    }
    throw err;
  }
}

export async function deleteAtoll(id: string) {
  const atoll = await prisma.atoll.findUnique({
    where: { id },
    include: { _count: { select: { islands: true } } },
  });
  if (!atoll) throw new NotFoundError("Atoll");

  if (atoll._count.islands > 0) {
    throw new HasDependentsError(
      `"${atoll.name}" has ${atoll._count.islands} island${
        atoll._count.islands === 1 ? "" : "s"
      } under it. Delete or move those islands first.`
    );
  }

  try {
    await prisma.atoll.delete({ where: { id } });
  } catch (err) {
    // Defense in depth: the count check above should already prevent this,
    // but the database's own onDelete: Restrict is the real guarantee if a
    // race ever slips past it (see prisma/migrations/.../migration.sql).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new HasDependentsError(`"${atoll.name}" still has islands under it.`);
    }
    throw err;
  }
}

function uniqueSlugForAtoll(name: string, excludeId?: string) {
  return uniqueSlug(prisma.atoll, name, excludeId);
}

// ---------------------------------------------------------------------------
// Islands
// ---------------------------------------------------------------------------

export async function listIslands(atollId?: string) {
  return prisma.island.findMany({
    where: atollId ? { atollId } : undefined,
    orderBy: [{ atoll: { name: "asc" } }, { name: "asc" }],
    include: {
      atoll: { select: { id: true, name: true } },
      _count: { select: { properties: true } },
    },
  });
}

export async function getIsland(id: string) {
  const island = await prisma.island.findUnique({
    where: { id },
    include: {
      atoll: { select: { id: true, name: true } },
      _count: { select: { properties: true } },
    },
  });
  if (!island) throw new NotFoundError("Island");
  return island;
}

async function assertAtollExists(atollId: string) {
  const atoll = await prisma.atoll.findUnique({ where: { id: atollId }, select: { id: true } });
  if (!atoll) throw new NotFoundError("Atoll");
}

export async function createIsland(input: IslandInput) {
  await assertAtollExists(input.atollId);
  const slug = await uniqueSlugForIsland(input.name);

  try {
    return await prisma.island.create({
      data: {
        name: input.name,
        slug,
        description: input.description || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        atollId: input.atollId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateNameError("island", input.name);
    }
    throw err;
  }
}

export async function updateIsland(id: string, input: IslandInput) {
  const existing = await prisma.island.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Island");
  await assertAtollExists(input.atollId);

  const slug =
    existing.name === input.name ? existing.slug : await uniqueSlugForIsland(input.name, id);

  try {
    return await prisma.island.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: input.description || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        atollId: input.atollId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateNameError("island", input.name);
    }
    throw err;
  }
}

export async function deleteIsland(id: string) {
  const island = await prisma.island.findUnique({
    where: { id },
    include: { _count: { select: { properties: true } } },
  });
  if (!island) throw new NotFoundError("Island");

  if (island._count.properties > 0) {
    throw new HasDependentsError(
      `"${island.name}" has ${island._count.properties} propert${
        island._count.properties === 1 ? "y" : "ies"
      } listed on it. Those must be removed or moved first.`
    );
  }

  try {
    await prisma.island.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new HasDependentsError(`"${island.name}" still has properties on it.`);
    }
    throw err;
  }
}

function uniqueSlugForIsland(name: string, excludeId?: string) {
  return uniqueSlug(prisma.island, name, excludeId);
}
