-- Host verification: licence details, phone confirmation and document
-- metadata. Hand-written like the earlier milestone migrations (see the
-- note in 20260925074418_host_property_listing).

ALTER TABLE "HostProfile"
  ADD COLUMN "licenceNumber" TEXT,
  ADD COLUMN "licenceBusinessName" TEXT,
  ADD COLUMN "licenceIslandId" TEXT,
  ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "verificationRejectionReason" TEXT,
  ADD COLUMN "phoneConfirmedNumber" TEXT,
  ADD COLUMN "phoneConfirmedMethod" TEXT,
  ADD COLUMN "phoneConfirmedAt" TIMESTAMP(3),
  ADD CONSTRAINT "HostProfile_licenceIslandId_fkey" FOREIGN KEY ("licenceIslandId")
    REFERENCES "Island"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No documents have been stored before this migration; the defaults only
-- exist so the columns can be added, and are dropped straight away.
ALTER TABLE "VerificationDocument"
  ADD COLUMN "fileName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "contentType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sizeBytes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationDocument"
  ALTER COLUMN "fileName" DROP DEFAULT,
  ALTER COLUMN "contentType" DROP DEFAULT,
  ALTER COLUMN "sizeBytes" DROP DEFAULT;
