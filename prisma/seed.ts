/**
 * Development seed data.
 *
 * Run with: npm run db:seed
 *
 * Seeds:
 * - Maldives + a handful of real atolls/islands (location hierarchy is
 *   database-driven — this is a starting set, not a hard-coded UI list;
 *   more islands are added the same way later, eventually via the admin panel)
 * - A base set of property types and amenities
 * - One SUPER_ADMIN account for local development/testing
 *
 * This script is intentionally small. It seeds enough for the location
 * hierarchy and admin login to work; it does not create sample properties
 * or bookings, since those features don't exist yet in this milestone.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // --- Location hierarchy ---
  const maldives = await prisma.country.upsert({
    where: { code: "MV" },
    update: {},
    create: { name: "Maldives", code: "MV" },
  });

  const atolls = [
    { name: "Kaafu Atoll", slug: "kaafu-atoll" },
    { name: "Alifu Alifu Atoll", slug: "alifu-alifu-atoll" },
    { name: "Alifu Dhaalu Atoll", slug: "alifu-dhaalu-atoll" },
    { name: "Seenu Atoll (Addu)", slug: "seenu-atoll" },
  ];

  const atollRecords: Record<string, string> = {};
  for (const atoll of atolls) {
    const record = await prisma.atoll.upsert({
      where: { slug: atoll.slug },
      update: {},
      create: { ...atoll, countryId: maldives.id },
    });
    atollRecords[atoll.slug] = record.id;
  }

  const islands = [
    { name: "Thulusdhoo", slug: "thulusdhoo", atollSlug: "kaafu-atoll" },
    { name: "Maafushi", slug: "maafushi", atollSlug: "kaafu-atoll" },
    { name: "Himmafushi", slug: "himmafushi", atollSlug: "kaafu-atoll" },
    { name: "Rasdhoo", slug: "rasdhoo", atollSlug: "alifu-alifu-atoll" },
    { name: "Ukulhas", slug: "ukulhas", atollSlug: "alifu-alifu-atoll" },
    { name: "Dhigurah", slug: "dhigurah", atollSlug: "alifu-dhaalu-atoll" },
    { name: "Fulidhoo", slug: "fulidhoo", atollSlug: "alifu-dhaalu-atoll" },
    { name: "Addu City", slug: "addu-city", atollSlug: "seenu-atoll" },
  ];

  for (const island of islands) {
    await prisma.island.upsert({
      where: { slug: island.slug },
      update: {},
      create: {
        name: island.name,
        slug: island.slug,
        atollId: atollRecords[island.atollSlug],
      },
    });
  }

  // --- Property types ---
  const propertyTypes = [
    "Guesthouse",
    "Hotel",
    "Resort",
    "Boutique Hotel",
    "Villa",
    "Apartment",
    "Homestay",
  ];
  for (const name of propertyTypes) {
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    await prisma.propertyType.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }

  // --- Amenities ---
  const amenities: { name: string; category: string }[] = [
    { name: "Wi-Fi", category: "General" },
    { name: "Air conditioning", category: "General" },
    { name: "Breakfast", category: "General" },
    { name: "Restaurant", category: "General" },
    { name: "Swimming pool", category: "General" },
    { name: "Beach access", category: "General" },
    { name: "Private beach", category: "General" },
    { name: "Spa", category: "General" },
    { name: "Gym", category: "General" },
    { name: "Laundry", category: "General" },
    { name: "Airport transfer", category: "General" },
    { name: "Bicycle rental", category: "Activities" },
    { name: "Water sports", category: "Activities" },
    { name: "Diving", category: "Activities" },
    { name: "Surfing", category: "Activities" },
    { name: "Family rooms", category: "General" },
  ];
  for (const amenity of amenities) {
    const slug = amenity.name.toLowerCase().replace(/\s+/g, "-");
    await prisma.amenity.upsert({
      where: { slug },
      update: {},
      create: { name: amenity.name, slug, category: amenity.category },
    });
  }

  // --- Dev super admin account ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Platform Admin",
      role: "SUPER_ADMIN",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  console.log("Seed complete.");
  console.log(`Dev admin login -> email: ${adminEmail}, password: ${adminPassword}`);
  console.log("Change this password before deploying anywhere real.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
