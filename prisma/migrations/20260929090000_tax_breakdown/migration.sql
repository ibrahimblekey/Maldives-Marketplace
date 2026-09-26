-- Tax breakdown (docs/decisions.md → "Tax rules"): admin-editable rates,
-- per-property tax settings, and a stored breakdown on every booking.
-- Hand-written like the earlier milestone migrations.

CREATE TYPE "ListingType" AS ENUM ('TOURIST_PROPERTY', 'PRIVATE_RENTAL');
CREATE TYPE "GreenTaxTier" AS ENUM ('STANDARD', 'HIGHER');

ALTER TABLE "Property"
  ADD COLUMN "listingType" "ListingType" NOT NULL DEFAULT 'TOURIST_PROPERTY',
  ADD COLUMN "serviceChargePercent" DECIMAL(5,2),
  ADD COLUMN "greenTaxTier" "GreenTaxTier" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "Booking"
  ADD COLUMN "listingTypeSnapshot" "ListingType",
  ADD COLUMN "serviceChargePercent" DECIMAL(5,2),
  ADD COLUMN "serviceChargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tgstPercent" DECIMAL(5,2),
  ADD COLUMN "tgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "greenTaxPerNight" DECIMAL(10,2),
  ADD COLUMN "greenTaxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "greenTaxGuests" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "localGuests" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "infantGuests" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "tgstPercent" DECIMAL(5,2) NOT NULL,
    "greenTaxStandardUsd" DECIMAL(10,2) NOT NULL,
    "greenTaxHigherUsd" DECIMAL(10,2) NOT NULL,
    "defaultServiceChargePercent" DECIMAL(5,2) NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" TEXT
);

-- Starting values from the owner's tax rules; editable in Admin → Settings.
INSERT INTO "PlatformSettings" ("id", "tgstPercent", "greenTaxStandardUsd", "greenTaxHigherUsd", "defaultServiceChargePercent", "commissionPercent")
VALUES ('default', 17, 6, 12, 10, 10)
ON CONFLICT DO NOTHING;
