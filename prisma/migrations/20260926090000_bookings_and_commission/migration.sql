-- Bookings milestone: pay-at-property bookings + monthly commission bills.
-- Hand-written (see the note in 20260925074418_host_property_listing): a
-- generated diff would try to undo the init migration's hand-written
-- booking-overlap constraint.

CREATE TYPE "CommissionStatementStatus" AS ENUM ('DUE', 'PAID');

CREATE TABLE "CommissionStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostProfileId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "currency" "Currency" NOT NULL,
    "bookingCount" INTEGER NOT NULL,
    "bookingsTotal" DECIMAL(12,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatementStatus" NOT NULL DEFAULT 'DUE',
    "dueDate" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "markedPaidById" TEXT,
    "paymentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionStatement_hostProfileId_fkey" FOREIGN KEY ("hostProfileId")
      REFERENCES "HostProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommissionStatement_hostProfileId_periodStart_currency_key"
  ON "CommissionStatement"("hostProfileId", "periodStart", "currency");
CREATE INDEX "CommissionStatement_status_dueDate_idx" ON "CommissionStatement"("status", "dueDate");

ALTER TABLE "Booking"
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "commissionStatementId" TEXT,
  ADD CONSTRAINT "Booking_commissionStatementId_fkey" FOREIGN KEY ("commissionStatementId")
    REFERENCES "CommissionStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Booking_commissionStatementId_idx" ON "Booking"("commissionStatementId");

-- Human-friendly booking references (MV-2026-000042) come from this
-- sequence, so two bookings made at the same moment can never collide.
CREATE SEQUENCE "booking_reference_seq" START 1;
