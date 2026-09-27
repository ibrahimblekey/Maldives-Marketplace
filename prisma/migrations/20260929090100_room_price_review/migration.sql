-- Rooms that existed before the tax breakdown were priced with taxes
-- included. Flag them so their hosts re-enter the price before taxes.
ALTER TABLE "Room" ADD COLUMN "needsPriceReview" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Room" SET "needsPriceReview" = true;
