-- Anti-scam: host suspension and "Report this listing".
-- Hand-written like the earlier milestone migrations (see the note in
-- 20260925074418_host_property_listing).

ALTER TABLE "HostProfile"
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "suspendedByUserId" TEXT;

CREATE TYPE "ListingReportReason" AS ENUM ('ASKED_TO_PAY_OUTSIDE', 'SCAM_OR_FRAUD', 'FAKE_LISTING', 'WRONG_INFORMATION', 'INAPPROPRIATE', 'OTHER');
CREATE TYPE "ListingReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "ListingReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "reason" "ListingReportReason" NOT NULL,
    "details" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "reporterEmail" TEXT,
    "reporterIpHash" TEXT NOT NULL,
    "status" "ListingReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingReport_propertyId_fkey" FOREIGN KEY ("propertyId")
      REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ListingReport_status_createdAt_idx" ON "ListingReport"("status", "createdAt");
CREATE INDEX "ListingReport_propertyId_idx" ON "ListingReport"("propertyId");
CREATE INDEX "ListingReport_reporterIpHash_createdAt_idx" ON "ListingReport"("reporterIpHash", "createdAt");
