-- Host property listing milestone.
--
-- Hand-written (not the raw `prisma migrate dev` output) on purpose: the
-- init migration contains hand-written SQL Prisma's schema language can't
-- express (the booking-overlap EXCLUDE constraint and its generated
-- `stayRange` column, custom index names). A generated diff would try to
-- "undo" those, so this file adds only what this milestone needs.

-- Photo review state (see PropertyImageStatus in schema.prisma).
CREATE TYPE "PropertyImageStatus" AS ENUM ('LIVE', 'PENDING_ADD', 'PENDING_REMOVE');

ALTER TABLE "PropertyImage"
  ADD COLUMN "status" "PropertyImageStatus" NOT NULL DEFAULT 'LIVE';

-- Submission timestamp + change requests on approved listings.
ALTER TABLE "Property"
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "pendingName" TEXT,
  ADD COLUMN "pendingDescription" TEXT,
  ADD COLUMN "changesSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "changesRejectionReason" TEXT;

CREATE INDEX "Property_changesSubmittedAt_idx" ON "Property"("changesSubmittedAt");

-- Default property types and amenities, so the listing wizard works on a
-- fresh production database without anyone having to run the seed script.
-- Same names/slugs as prisma/seed.ts; ON CONFLICT keeps this safe to run
-- on a database that was already seeded.
INSERT INTO "PropertyType" ("id", "name", "slug") VALUES
  (gen_random_uuid()::text, 'Guesthouse', 'guesthouse'),
  (gen_random_uuid()::text, 'Hotel', 'hotel'),
  (gen_random_uuid()::text, 'Resort', 'resort'),
  (gen_random_uuid()::text, 'Boutique Hotel', 'boutique-hotel'),
  (gen_random_uuid()::text, 'Villa', 'villa'),
  (gen_random_uuid()::text, 'Apartment', 'apartment'),
  (gen_random_uuid()::text, 'Homestay', 'homestay')
ON CONFLICT DO NOTHING;

INSERT INTO "Amenity" ("id", "name", "slug", "category") VALUES
  (gen_random_uuid()::text, 'Wi-Fi', 'wi-fi', 'General'),
  (gen_random_uuid()::text, 'Air conditioning', 'air-conditioning', 'General'),
  (gen_random_uuid()::text, 'Breakfast', 'breakfast', 'General'),
  (gen_random_uuid()::text, 'Restaurant', 'restaurant', 'General'),
  (gen_random_uuid()::text, 'Swimming pool', 'swimming-pool', 'General'),
  (gen_random_uuid()::text, 'Beach access', 'beach-access', 'General'),
  (gen_random_uuid()::text, 'Private beach', 'private-beach', 'General'),
  (gen_random_uuid()::text, 'Spa', 'spa', 'General'),
  (gen_random_uuid()::text, 'Gym', 'gym', 'General'),
  (gen_random_uuid()::text, 'Laundry', 'laundry', 'General'),
  (gen_random_uuid()::text, 'Airport transfer', 'airport-transfer', 'General'),
  (gen_random_uuid()::text, 'Bicycle rental', 'bicycle-rental', 'Activities'),
  (gen_random_uuid()::text, 'Water sports', 'water-sports', 'Activities'),
  (gen_random_uuid()::text, 'Diving', 'diving', 'Activities'),
  (gen_random_uuid()::text, 'Surfing', 'surfing', 'Activities'),
  (gen_random_uuid()::text, 'Family rooms', 'family-rooms', 'General')
ON CONFLICT DO NOTHING;
