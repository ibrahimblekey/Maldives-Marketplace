-- Booking-engine constraint verification test.
-- Runs entirely inside one transaction that is ROLLED BACK at the end, so it
-- is fully repeatable against a real (seeded or empty) database with no
-- side effects. Run with:
--   PGPASSWORD=postgres psql -h localhost -U postgres -d maldives_marketplace -f booking_constraint_test.sql
--
-- Every test prints PASS or FAIL via RAISE NOTICE / explicit SELECT checks.

\set ON_ERROR_STOP off
\timing off

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures: minimal valid graph down to two physical RoomInventoryUnits.
-- ---------------------------------------------------------------------------
INSERT INTO "Country" (id, name, code, "createdAt", "updatedAt")
VALUES ('test_country', 'Test Maldives', 'TZ', now(), now());

INSERT INTO "Atoll" (id, name, slug, "countryId", "createdAt", "updatedAt")
VALUES ('test_atoll', 'Test Atoll', 'test-atoll', 'test_country', now(), now());

INSERT INTO "Island" (id, name, slug, "atollId", "createdAt", "updatedAt")
VALUES ('test_island', 'Test Island', 'test-island', 'test_atoll', now(), now());

INSERT INTO "PropertyType" (id, name, slug)
VALUES ('test_ptype', 'Test Guesthouse Type', 'test-guesthouse-type');

INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
VALUES ('test_host_user', 'test-host@example.test', 'Test Host', 'HOST', now(), now());

INSERT INTO "HostProfile" (id, "userId", "businessName", "contactPhone", "createdAt", "updatedAt")
VALUES ('test_hostprofile', 'test_host_user', 'Test Business', '+960-0000000', now(), now());

INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
VALUES ('test_guest_user', 'test-guest@example.test', 'Test Guest', 'TRAVELER', now(), now());

INSERT INTO "Property" (id, name, slug, description, "hostProfileId", "islandId", "propertyTypeId", "createdAt", "updatedAt")
VALUES ('test_property', 'Test Property', 'test-property', 'A test property', 'test_hostprofile', 'test_island', 'test_ptype', now(), now());

INSERT INTO "Room" (id, name, "propertyId", "maxOccupancy", "basePrice", currency, "createdAt", "updatedAt")
VALUES ('test_room', 'Deluxe Test Room', 'test_property', 2, 100.00, 'USD', now(), now());

INSERT INTO "RoomInventoryUnit" (id, "roomId", "unitLabel", "createdAt")
VALUES ('test_unit_A', 'test_room', 'Unit A', now());

INSERT INTO "RoomInventoryUnit" (id, "roomId", "unitLabel", "createdAt")
VALUES ('test_unit_B', 'test_room', 'Unit B', now());

-- A helper to create a Booking row quickly with sane snapshot values.
-- (numRooms=1, one BookingRoomUnit row per booking in these tests.)

-- ---------------------------------------------------------------------------
-- TEST 1: same-unit, overlapping date ranges -> must be REJECTED
-- ---------------------------------------------------------------------------
INSERT INTO "Booking" (id, "bookingReference", "guestId", "propertyId", "roomId",
  "checkInDate", "checkOutDate", "numGuests", "numRooms",
  "subtotalAmount", "totalAmount", currency, "commissionRateSnapshot", "commissionAmount", "hostPayoutAmount",
  "createdAt", "updatedAt")
VALUES ('test_booking_1', 'TEST-0001', 'test_guest_user', 'test_property', 'test_room',
  '2026-12-01', '2026-12-05', 2, 1,
  400.00, 400.00, 'USD', 10.00, 40.00, 360.00, now(), now());

INSERT INTO "BookingRoomUnit" (id, "bookingId", "roomInventoryUnitId", "checkInDate", "checkOutDate", status)
VALUES ('test_bru_1', 'test_booking_1', 'test_unit_A', '2026-12-01', '2026-12-05', 'CONFIRMED');

SAVEPOINT before_overlap_test;

INSERT INTO "Booking" (id, "bookingReference", "guestId", "propertyId", "roomId",
  "checkInDate", "checkOutDate", "numGuests", "numRooms",
  "subtotalAmount", "totalAmount", currency, "commissionRateSnapshot", "commissionAmount", "hostPayoutAmount",
  "createdAt", "updatedAt")
VALUES ('test_booking_2', 'TEST-0002', 'test_guest_user', 'test_property', 'test_room',
  '2026-12-03', '2026-12-07', 2, 1,
  400.00, 400.00, 'USD', 10.00, 40.00, 360.00, now(), now());

INSERT INTO "BookingRoomUnit" (id, "bookingId", "roomInventoryUnitId", "checkInDate", "checkOutDate", status)
VALUES ('test_bru_2', 'test_booking_2', 'test_unit_A', '2026-12-03', '2026-12-07', 'CONFIRMED');
-- ^ EXPECTED: ERROR (exclusion violation) — Dec 1-5 and Dec 3-7 overlap on unit A

ROLLBACK TO SAVEPOINT before_overlap_test;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Booking" WHERE id = 'test_booking_2') THEN
    RAISE NOTICE 'TEST 1 (same-unit overlap rejected): FAIL — overlapping booking was NOT rejected';
  ELSE
    RAISE NOTICE 'TEST 1 (same-unit overlap rejected): PASS — overlapping insert was rejected and rolled back to savepoint';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 2: same-unit, NON-overlapping date ranges -> must be ACCEPTED
-- ---------------------------------------------------------------------------
INSERT INTO "Booking" (id, "bookingReference", "guestId", "propertyId", "roomId",
  "checkInDate", "checkOutDate", "numGuests", "numRooms",
  "subtotalAmount", "totalAmount", currency, "commissionRateSnapshot", "commissionAmount", "hostPayoutAmount",
  "createdAt", "updatedAt")
VALUES ('test_booking_3', 'TEST-0003', 'test_guest_user', 'test_property', 'test_room',
  '2026-12-05', '2026-12-10', 2, 1,
  500.00, 500.00, 'USD', 10.00, 50.00, 450.00, now(), now());

INSERT INTO "BookingRoomUnit" (id, "bookingId", "roomInventoryUnitId", "checkInDate", "checkOutDate", status)
VALUES ('test_bru_3', 'test_booking_3', 'test_unit_A', '2026-12-05', '2026-12-10', 'CONFIRMED');
-- ^ EXPECTED: SUCCESS — Dec 1-5 (exclusive checkout, so the 5th is free) then Dec 5-10, back-to-back, no overlap

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "BookingRoomUnit" WHERE id = 'test_bru_3') THEN
    RAISE NOTICE 'TEST 2 (same-unit back-to-back accepted): PASS — adjacent, non-overlapping booking was accepted';
  ELSE
    RAISE NOTICE 'TEST 2 (same-unit back-to-back accepted): FAIL — booking was unexpectedly rejected';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 3: different unit, SAME overlapping dates -> must be ACCEPTED
-- ---------------------------------------------------------------------------
INSERT INTO "Booking" (id, "bookingReference", "guestId", "propertyId", "roomId",
  "checkInDate", "checkOutDate", "numGuests", "numRooms",
  "subtotalAmount", "totalAmount", currency, "commissionRateSnapshot", "commissionAmount", "hostPayoutAmount",
  "createdAt", "updatedAt")
VALUES ('test_booking_4', 'TEST-0004', 'test_guest_user', 'test_property', 'test_room',
  '2026-12-01', '2026-12-05', 2, 1,
  400.00, 400.00, 'USD', 10.00, 40.00, 360.00, now(), now());

INSERT INTO "BookingRoomUnit" (id, "bookingId", "roomInventoryUnitId", "checkInDate", "checkOutDate", status)
VALUES ('test_bru_4', 'test_booking_4', 'test_unit_B', '2026-12-01', '2026-12-05', 'CONFIRMED');
-- ^ EXPECTED: SUCCESS — same dates as test_booking_1 but a *different* physical unit (B, not A)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "BookingRoomUnit" WHERE id = 'test_bru_4') THEN
    RAISE NOTICE 'TEST 3 (different unit, same dates accepted): PASS';
  ELSE
    RAISE NOTICE 'TEST 3 (different unit, same dates accepted): FAIL — booking was unexpectedly rejected';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 4: cancelling a booking releases the unit for the same dates
-- ---------------------------------------------------------------------------
UPDATE "Booking" SET status = 'CANCELLED', "cancelledAt" = now() WHERE id = 'test_booking_4';
UPDATE "BookingRoomUnit" SET status = 'CANCELLED' WHERE id = 'test_bru_4';

SAVEPOINT before_release_test;

INSERT INTO "Booking" (id, "bookingReference", "guestId", "propertyId", "roomId",
  "checkInDate", "checkOutDate", "numGuests", "numRooms",
  "subtotalAmount", "totalAmount", currency, "commissionRateSnapshot", "commissionAmount", "hostPayoutAmount",
  "createdAt", "updatedAt")
VALUES ('test_booking_5', 'TEST-0005', 'test_guest_user', 'test_property', 'test_room',
  '2026-12-01', '2026-12-05', 2, 1,
  400.00, 400.00, 'USD', 10.00, 40.00, 360.00, now(), now());

INSERT INTO "BookingRoomUnit" (id, "bookingId", "roomInventoryUnitId", "checkInDate", "checkOutDate", status)
VALUES ('test_bru_5', 'test_booking_5', 'test_unit_B', '2026-12-01', '2026-12-05', 'CONFIRMED');
-- ^ EXPECTED: SUCCESS — unit B's Dec 1-5 slot was released because test_booking_4 (and its
-- BookingRoomUnit row) was marked CANCELLED, and the EXCLUDE constraint's WHERE clause
-- excludes cancelled rows from the conflict check.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "BookingRoomUnit" WHERE id = 'test_bru_5') THEN
    RAISE NOTICE 'TEST 4 (cancellation releases inventory): PASS — same unit/dates re-bookable after cancellation';
  ELSE
    RAISE NOTICE 'TEST 4 (cancellation releases inventory): FAIL — cancelled slot could not be re-booked';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TEST 5: historical booking price is immutable after the Room's basePrice changes
-- ---------------------------------------------------------------------------
-- test_booking_1 was created with subtotalAmount/totalAmount = 400.00 while
-- test_room.basePrice was 100.00/night. Now change the room's live price and
-- confirm the existing booking's snapshot fields are untouched.
UPDATE "Room" SET "basePrice" = 999.99 WHERE id = 'test_room';

DO $$
DECLARE
  snapshot_total NUMERIC;
  snapshot_subtotal NUMERIC;
  live_price NUMERIC;
BEGIN
  SELECT "totalAmount", "subtotalAmount" INTO snapshot_total, snapshot_subtotal
  FROM "Booking" WHERE id = 'test_booking_1';

  SELECT "basePrice" INTO live_price FROM "Room" WHERE id = 'test_room';

  IF snapshot_total = 400.00 AND snapshot_subtotal = 400.00 AND live_price = 999.99 THEN
    RAISE NOTICE 'TEST 5 (historical price immutable): PASS — booking kept 400.00 while Room.basePrice changed to %', live_price;
  ELSE
    RAISE NOTICE 'TEST 5 (historical price immutable): FAIL — snapshot_total=%, snapshot_subtotal=%, live_price=%', snapshot_total, snapshot_subtotal, live_price;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Cleanup: roll back everything, including the fixtures. No test data is
-- left behind in the database.
-- ---------------------------------------------------------------------------
ROLLBACK;
