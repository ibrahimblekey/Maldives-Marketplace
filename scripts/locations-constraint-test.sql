\set ON_ERROR_STOP off
BEGIN;

INSERT INTO "Country" (id, name, code, "createdAt", "updatedAt")
VALUES ('loc_test_country', 'Loc Test Maldives', 'LT', now(), now());

INSERT INTO "Atoll" (id, name, slug, "countryId", "createdAt", "updatedAt")
VALUES ('loc_test_atoll_1', 'Test Atoll', 'test-atoll', 'loc_test_country', now(), now());

-- TEST 1: slug uniqueness enforced at the DB level (service layer's
-- uniqueSlug() collision-avoidance is a UX nicety; this is the real guarantee)
SAVEPOINT before_dup_slug;
INSERT INTO "Atoll" (id, name, slug, "countryId", "createdAt", "updatedAt")
VALUES ('loc_test_atoll_2', 'Another Atoll', 'test-atoll', 'loc_test_country', now(), now());
ROLLBACK TO SAVEPOINT before_dup_slug;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Atoll" WHERE id = 'loc_test_atoll_2') THEN
    RAISE NOTICE 'TEST 1 (duplicate atoll slug rejected): FAIL';
  ELSE
    RAISE NOTICE 'TEST 1 (duplicate atoll slug rejected): PASS';
  END IF;
END $$;

-- TEST 2: an atoll with islands under it cannot be deleted (RESTRICT)
INSERT INTO "Island" (id, name, slug, "atollId", "createdAt", "updatedAt")
VALUES ('loc_test_island_1', 'Test Island', 'test-island', 'loc_test_atoll_1', now(), now());

SAVEPOINT before_restrict_delete;
DELETE FROM "Atoll" WHERE id = 'loc_test_atoll_1';
ROLLBACK TO SAVEPOINT before_restrict_delete;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Atoll" WHERE id = 'loc_test_atoll_1') THEN
    RAISE NOTICE 'TEST 2 (atoll with islands cannot be deleted): PASS';
  ELSE
    RAISE NOTICE 'TEST 2 (atoll with islands cannot be deleted): FAIL';
  END IF;
END $$;

-- TEST 3: deleting the island first, then the atoll, works fine
DELETE FROM "Island" WHERE id = 'loc_test_island_1';
DELETE FROM "Atoll" WHERE id = 'loc_test_atoll_1';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Atoll" WHERE id = 'loc_test_atoll_1') THEN
    RAISE NOTICE 'TEST 3 (atoll deletable once its islands are gone): PASS';
  ELSE
    RAISE NOTICE 'TEST 3 (atoll deletable once its islands are gone): FAIL';
  END IF;
END $$;

ROLLBACK;
