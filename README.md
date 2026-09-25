# Maldives Travel Marketplace

Milestones built so far: project setup, database schema, authentication, and
admin management of the Country → Atoll → Island location hierarchy. No
search, property listings, or booking features yet — see
[Project architecture](#project-architecture) for what's next.

## Locations admin (Atolls & Islands)

Signed in as an ADMIN or SUPER_ADMIN, go to **Dashboard → Manage locations**
(`/dashboard/admin/locations`) to add, edit, and delete atolls and islands.
This is the data search/browse and property listings will be built on later,
so it's deliberately database-driven, not a hard-coded list — adding an
island here means it's immediately usable everywhere else, no code change
needed.

- **Atolls** — name + optional description. Deleting an atoll is blocked
  while it still has islands under it (both by a friendly in-app message
  and, as the real guarantee, the database's own foreign-key `RESTRICT`).
- **Islands** — name, parent atoll, optional description, optional
  latitude/longitude. Deleting an island is blocked the same way while it
  still has properties on it (properties don't exist yet in this milestone,
  but the rule is already in place for when they do).
- Every atoll/island gets a unique, URL-friendly slug generated from its
  name automatically (e.g. "Kaafu Atoll" → `kaafu-atoll`); a name collision
  gets `-2`, `-3`, etc. appended rather than being rejected.
- Every create/edit/delete re-checks the caller is an ADMIN/SUPER_ADMIN on
  the server, independently of the page they're on — the same
  "don't rely only on the page/middleware check" rule the auth milestone
  established (see `src/app/dashboard/admin/locations/actions.ts`).
- Repeatable SQL test for the underlying database guarantees (uniqueness,
  restrict-on-delete): `scripts/locations-constraint-test.sql`, run the
  same way as the booking one — see below.

## Tech stack

- **Next.js 16** (App Router, TypeScript) — frontend + backend in one app
- **PostgreSQL** — relational database
- **Prisma 7** — ORM, schema, and migrations
- **Auth.js (NextAuth v5)** — authentication, currently email/password only
- **Zod** — server-side input validation
- **bcryptjs** — password hashing

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (either installed locally, or via Docker — see below)

## 1. Install dependencies

```bash
npm install
```

## 2. Start PostgreSQL

**Option A — Docker (recommended for most machines):**

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with user `postgres`, password
`postgres`, database `maldives_marketplace` (see `docker-compose.yml`).

**Option B — a local PostgreSQL install:**

Create a database and user matching whatever you put in `DATABASE_URL`
(step 3). For example:

```bash
createdb maldives_marketplace
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string. Default matches the Docker setup above. |
| `AUTH_SECRET` | Random secret for signing sessions. Generate with `openssl rand -base64 32`. **Required** — the app will not start without it. |
| `NEXTAUTH_URL` | Base URL of the app (`http://localhost:3000` in dev). |

Never commit `.env` — it's already in `.gitignore`.

## 4. Run database migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

- `prisma generate` builds the type-safe database client from `prisma/schema.prisma`.
- `prisma migrate deploy` applies the migration in `prisma/migrations/` to your database.

> The initial migration was authored and applied by hand in the development
> sandbox that built this milestone, because that sandbox's network policy
> blocked Prisma's engine-binary CDN (`binaries.prisma.sh`). It was verified
> directly against PostgreSQL (schema, constraints, and indexes all
> confirmed working — see "What was tested" below). On a normal machine
> with internet access, `prisma generate` / `prisma migrate dev` work
> exactly as usual — this is a one-time environment quirk of the build
> sandbox, not a project limitation. If you ever need to add a new
> migration, use `npx prisma migrate dev --name <description>` as normal;
> Prisma will pick up from the existing migration history.

## 5. Seed development data

```bash
npm run db:seed
```

Seeds:

- Maldives + a starter set of atolls/islands (Kaafu, Alifu Alifu, Alifu
  Dhaalu, Addu, with several islands each) — a starting sample, not a
  hard-coded limit; more are added as rows, including later via the admin
  panel, never as new code.
- The base property types (Guesthouse, Hotel, Resort, Villa, ...) and
  amenities (Wi-Fi, Pool, Beach access, ...) used as filter/selection options.
- One `SUPER_ADMIN` account for local testing: `admin@example.com` /
  `ChangeMe123!` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
  in `.env`). **Change or remove this before any real deployment.**

## 6. Start the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Other useful commands

```bash
npm run db:studio     # Prisma Studio — browse/edit the database visually
npm run db:migrate    # create + apply a new migration after schema changes
npm run lint          # ESLint
```

---

## Authentication architecture

- **Provider**: Auth.js (NextAuth v5) with a Credentials provider
  (email + password). Session strategy is JWT (required by the Credentials
  provider — see comments in `src/lib/auth.ts`).
- **Password storage**: bcrypt, cost factor 12. Plaintext passwords are
  never stored or logged.
- **Registration** (`POST /api/auth/register`): validates input with Zod,
  checks for a duplicate email (fast check + a database unique-constraint
  guarantee for the race condition), hashes the password, and creates the
  user with `role` hard-coded to `TRAVELER`. There is no code path — client
  input included — that can create an `ADMIN` or `SUPER_ADMIN` account
  through registration.
- **Login**: handled by Auth.js's Credentials flow
  (`src/lib/auth.ts` → `authorize()`), which re-checks the password with
  bcrypt and returns the same generic failure for "no such user", "wrong
  password", "deactivated account", and "OAuth-only account with no
  password" — this avoids leaking which case applies.
- **Sessions**: JWT, 30-day expiry, `httpOnly` cookie managed by Auth.js.
  The JWT/session callbacks attach the user's `id` and `role`, so role
  checks don't need a database query on every request.
- **Rate limiting**: `src/server/auth/rate-limit.ts`. Backed by the
  `LoginAttempt` table (also serving as an audit trail). Blocks after 5
  failed attempts per email or 20 per IP within 15 minutes. Documented in
  the file as swap-ready for a Redis-backed limiter if the app ever runs
  across multiple instances under heavy auth traffic.
- **OAuth (Google/Apple)**: not implemented yet, by design (per this
  milestone's scope). The `Account` and `Session` Prisma models already
  exist for it — adding a provider later means registering it in
  `src/lib/auth.ts` plus wiring up `@auth/prisma-adapter` (already
  installed), with no schema changes required.

### Roles

`TRAVELER`, `HOST`, `ADMIN`, `SUPER_ADMIN` (see the `UserRole` enum in
`prisma/schema.prisma`). Every self-registered account starts as
`TRAVELER`. Becoming a `HOST` is intended to go through a separate
onboarding/verification flow (not built in this milestone — `HostProfile`
and `VerificationDocument` tables exist and are ready for it).
`ADMIN`/`SUPER_ADMIN` accounts are never self-service; create them directly
(see `prisma/seed.ts` for the pattern) or have an existing admin create one
in a later milestone's admin tooling.

### Authorization — defense in depth

Two layers, and they are **not** interchangeable:

1. **`src/proxy.ts`** (Next.js 16's renamed `middleware.ts`) — an
   *optimistic* redirect for logged-out visitors hitting `/dashboard/*`.
   Fast, but only reads the JWT cookie; it never re-checks the database, and
   it never runs for direct API/server-action calls that don't go through a
   page navigation.
2. **`src/server/auth/authorize.ts`** (`requireUser()` / `requireRole()`) —
   the real check. Every protected page, API route, and (future) server
   action calls this directly and independently. See
   `src/app/dashboard/{traveler,host,admin}/page.tsx` for the pattern: each
   one calls `requireRole([...])` with an explicit role list — nothing is
   ever granted implicitly (e.g. `SUPER_ADMIN` does **not** automatically
   pass a `HOST`-only check; it must be listed if that's intended).

This matches the project's security requirement directly: **authorization
is never based on hiding UI or on the proxy alone.**

---

## Database

Full schema: `prisma/schema.prisma` (extensively commented — read it before
extending it). High-level groups:

| Area | Models |
|---|---|
| Auth & users | `User`, `Account`, `Session`, `VerificationToken`, `LoginAttempt` |
| Host & trust | `HostProfile`, `VerificationDocument` |
| Locations | `Country` → `Atoll` → `Island` (hierarchy, all database-driven) |
| Catalog | `PropertyType`, `Amenity` (lookup tables, not enums — extensible without a migration) |
| Properties & rooms | `Property`, `PropertyImage`, `PropertyAmenity`, `Room`, `RoomImage`, `RoomAmenity` |
| Inventory & pricing | `RoomInventoryUnit`, `RoomAvailabilityBlock`, `SeasonalPrice`, `CancellationPolicy`, `Promotion` |
| Booking engine | `Booking`, `BookingRoomUnit`, `BookingGuest` |
| Money | `Payment`, `Payout` |
| Trust & engagement | `Review`, `Favorite`, `Conversation`, `Message`, `Notification`, `AdminAuditLog` |

Only the **auth & users** group has working application code in this
milestone. Everything else is schema only — created now, deliberately, so
later milestones (locations, property management, booking engine, ...)
build on a stable, already-thought-through structure instead of bolting on
migrations one feature at a time.

### Notable design decisions

- **Physical room inventory**: `Room` is a room *type* (e.g. "Deluxe Double
  Room"); each physical room is a `RoomInventoryUnit` row. A room type with
  5 physical rooms has 5 `RoomInventoryUnit` rows, letting the future
  booking engine sell up to 5 overlapping reservations for that type on the
  same night — one per unit.
- **Double-booking prevention**: enforced by PostgreSQL itself, not just
  application code. `BookingRoomUnit` has a `GENERATED` `daterange` column
  and a `GIST` **EXCLUDE constraint** that makes two non-cancelled bookings
  for the same physical unit with overlapping dates impossible to insert —
  verified directly against Postgres (see "What was tested" below).
- **Price snapshots**: `Booking` stores `subtotalAmount`, `taxAmount`,
  `commissionRateSnapshot`, `commissionAmount`, `hostPayoutAmount`, etc. as
  fixed values at booking time. A later change to a room's price or the
  platform commission rate never alters a historical booking.
- **Payments vs. payouts**: separate tables (`Payment` = guest → platform,
  `Payout` = platform → host), as required. No raw card data is ever
  stored — `Payment.provider` is a free string (not an enum) so a payment
  provider can be added later without a migration, and only a
  `providerTransactionReference` is kept.
- **Currency**: `Booking.currency` is the transaction currency, fixed at
  booking time. A future "display currency" preference (for browsing in
  USD vs. MVR, say) is a presentation-layer concern and never overwrites
  this field.

---

## Project architecture

```
prisma/
  schema.prisma          # database schema (source of truth)
  migrations/             # versioned SQL migrations
  seed.ts                 # dev seed data

src/
  app/
    page.tsx               # landing page
    login/, register/      # auth pages
    dashboard/              # protected, role-specific areas
      traveler/, host/, admin/
    api/auth/
      [...nextauth]/         # Auth.js route handler
      register/               # registration endpoint

  lib/
    auth.ts                 # Auth.js configuration
    db.ts                    # Prisma client singleton
    validation/auth.ts        # Zod schemas (shared client/server-safe rules)

  server/
    auth/
      authorize.ts             # requireUser()/requireRole() — the real authorization layer
      rate-limit.ts             # login/registration rate limiting
    services/
      user-service.ts            # registration business logic

  proxy.ts                  # optimistic route-level redirect (Next.js 16's renamed middleware)
```

Why this shape: `app/` stays thin (pages and routes only); real logic lives
in `server/services/*`, so a route handler and a future server action can
both call `registerTraveler()` without duplicating the password/role rules.
`lib/` holds cross-cutting infrastructure (the database connection, auth
configuration, validation) that both `app/` and `server/` depend on.

---

## What was tested

### Verified directly against PostgreSQL (repeatable, no Prisma Client needed)

All of this was run in the sandbox that built this project, straight
against `psql` — it does not depend on `npx prisma generate` succeeding,
so it's been re-confirmed as part of two separate verification passes:

- All 34 tables, foreign keys, indexes, and the two hand-written `CHECK`
  constraints (`Booking_checkOut_after_checkIn_chk`,
  `Review_ratings_range_chk`) create cleanly from
  `prisma/migrations/20260918000000_init/migration.sql` with no errors.
  Every field, default, nullability rule, and relation in that file was
  compared line-by-line against `prisma/schema.prisma` — they match
  exactly (the two `CHECK` constraints are DB-only and can't be expressed
  in Prisma's schema language; they're now called out in comments above
  `model Booking` and `model Review` so this isn't a silent gap).
- `User.email` unique constraint rejects a duplicate insert (the exact
  condition `EmailAlreadyRegisteredError` handles).
- **The booking engine, via `scripts/booking-constraint-test.sql`** — a
  self-contained, repeatable script (wraps everything in one transaction
  and `ROLLBACK`s at the end, so it leaves no test data behind). Run it
  yourself with:
  ```bash
  PGPASSWORD=postgres psql -h localhost -U postgres -d maldives_marketplace \
    -f scripts/booking-constraint-test.sql
  ```
  All 5 checks pass:
  1. Two overlapping date ranges for the **same** physical unit → rejected
     (the `no_overlapping_unit_bookings` `EXCLUDE` constraint fires).
  2. Two back-to-back (non-overlapping) ranges on the same unit → accepted.
  3. The same overlapping dates on a **different** unit of the same room
     type → accepted (this is what makes multi-unit inventory work).
  4. Cancelling a booking (`status = 'CANCELLED'` on both `Booking` and
     `BookingRoomUnit`) frees its unit/dates for a new booking — confirms
     the `EXCLUDE` constraint's `WHERE status <> 'CANCELLED'` clause
     behaves as intended.
  5. **Historical price immutability**: after creating a booking with a
     $400 snapshot total, the room's live `basePrice` is changed to
     $999.99 — the existing booking's `subtotalAmount`/`totalAmount`
     stay at $400, confirming bookings are never recalculated against a
     property's current price.
- Password hashing: bcrypt hash format, correct password verifies, wrong
  password is rejected.
- Zod validation: invalid email rejected, weak/short passwords rejected,
  valid input accepted, and — specifically for the "no self-service admin"
  requirement — a `role` field included in a registration request is
  silently stripped by the schema and never reaches the service layer.
- `tsc --noEmit` and `eslint` run clean, apart from errors that trace
  entirely to the not-yet-generated Prisma client (expected — see below).

### Three bugs found and fixed during this verification pass

Re-reading every auth-related file end to end (not just spot-checking)
turned up three real issues, all now fixed:

1. **Rate-limited logins showed a misleading error.** `RateLimitError`
   only extended plain `Error`, so `src/app/login/page.tsx` couldn't tell
   "too many attempts" apart from "wrong password" and showed the wrong
   message to a rate-limited user. Fixed by having `RateLimitError` extend
   Auth.js's `CredentialsSignin` with `code = "rate_limited"`, which the
   login page now checks explicitly — while every other failure (no such
   account, wrong password, deactivated account) still shows the same
   generic "Invalid email or password" message, so account existence is
   still never revealed.
2. **Dead code in `src/lib/auth.ts`.** A try/catch around the rate-limit
   check re-threw every error unchanged — functionally identical to no
   try/catch at all. Removed.
3. **Stale comment in `src/proxy.ts`** referenced a route-group path
   (`src/app/(dashboard)/*`) that was never actually used in this project.
   Corrected to point at the real `src/app/dashboard/*` structure.

### What could not be run in this sandbox, and why (confirmed, not assumed)

`npx prisma generate` cannot run in this specific cloud sandbox — this
was re-investigated thoroughly rather than taken on faith:

- The sandbox's outbound network policy allows `registry.npmjs.org` but
  unconditionally blocks `binaries.prisma.sh` (Prisma's engine-binary
  CDN) — confirmed via the proxy's own status endpoint, which logs a
  `403`/"policy denial" on every attempt, for every Prisma CLI version
  tried (7.10.0 and 5.22.0 both), including plain `prisma -v`.
- I tried a genuine workaround before giving up on it: installing the
  official `@prisma/schema-engine-wasm` / `@prisma/prisma-schema-wasm`
  npm packages at the exact matching engine version. This does make one
  internal step (`getConfig`) use WASM instead of a native binary, but
  `generate`/`migrate` still unconditionally try to download the native
  schema-engine binary as a separate step, and fail the same way. I also
  confirmed (via `npm pack`) that no npm-hosted Prisma package bundles the
  actual engine binaries — they're always fetched from
  `binaries.prisma.sh` at install/generate time — so there's no npm-only
  path around this. I reverted the WASM packages afterward since they
  didn't actually enable `generate` to work and would have been
  misleading to leave in `package.json`.
- To characterize the actual blast radius (rather than assume it), I
  booted `npm run dev` anyway. It starts fine. Pages that don't touch the
  database render normally (`/login`, `/register` → `200`). Anything that
  imports the Prisma client fails with
  `Cannot find module '.prisma/client/default'` (the homepage, `/dashboard`,
  `POST /api/auth/register` → all `500`) — exactly the failure you'd
  expect from a missing generated client, and nothing else. There is no
  evidence of any other problem in the application code itself.

**On a machine with normal internet access, this is a non-issue** — `npx
prisma generate` is one command, after which `npm run dev` and the full
manual checklist below should work exactly as written. Please run that
pass yourself before treating end-to-end auth as verified; the sandbox
limitation above is a property of this cloud environment, not of the
code.

### Manual verification checklist (run this after setup)

- [ ] Register a traveler → redirected into `/dashboard/traveler`
- [ ] Log out → redirected to `/login`
- [ ] Log back in with the same credentials → succeeds
- [ ] Attempt login with a wrong password → generic "Invalid email or
      password" error, no hint about which part was wrong
- [ ] Register a second account with the same email → `409`, clear error
- [ ] Visit `/dashboard/host` or `/dashboard/admin` while logged in as the
      traveler → redirected back to `/dashboard` (not shown the page)
- [ ] Visit `/dashboard` while logged out → redirected to `/login`
- [ ] Log in as the seeded `admin@example.com` → lands in
      `/dashboard/admin`
- [ ] Fail login 5+ times in a row for one account → rate-limited response
- [ ] Restart the dev server → existing session cookie still works
      (session persistence)

---

## Known limitations / assumptions in this milestone

- Email verification, password reset, and Google/Apple OAuth are not
  implemented — the schema is ready for all three, per this milestone's
  scope (email/password first, OAuth explicitly deferred).
- The rate limiter is DB-backed and single-instance-appropriate; see the
  comment in `src/server/auth/rate-limit.ts` for the production scaling
  note.
- No property/room/booking UI or APIs yet — by design, per the agreed
  milestone order (database + authentication now; locations, property
  management, and the booking engine are separate, later milestones).

### `npm audit` finding — not suppressed, tracked here

`npm audit` currently reports 4 high-severity advisories. This is a
deliberate, documented decision to leave them as-is for now, not an
oversight — the reasoning is below, and it should be re-evaluated (not just
re-run) whenever Prisma ships a new version.

**Affected dependencies**: `mysql2` (2 advisories — [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr),
auth-plugin downgrade leaking credentials; a related decompression-bomb DoS
advisory) and `deepmerge-ts` ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx),
stack exhaustion on recursive object graphs).

**Why they're transitive**: neither is a dependency this project chose.
`npm ls mysql2` / `npm ls deepmerge-ts` trace both to a single source: the
`prisma` CLI package (`prisma@7.10.0`, a **devDependency**), which bundles
support for introspecting/migrating MySQL, SQL Server, CockroachDB, and
SQLite databases alongside Postgres — `mysql2` is its MySQL driver,
`deepmerge-ts` is a dependency of `@prisma/config` (Prisma's own
config-loader). Neither is a dependency of `@prisma/client` — the package
actually imported by application code at runtime (`npm explain mysql2`
confirms `prisma` is listed only as an *optional* peer of `@prisma/client`,
not a hard dependency).

**Why the affected functionality is not used**: this project's
`datasource db { provider = "postgresql" }` in `prisma/schema.prisma` means
Prisma's MySQL driver code path is never invoked, in development or
production. A production deployment that ships only `@prisma/client` and
the generated client (e.g. `npm ci --omit=dev`) does not even have `prisma`,
`mysql2`, or `deepmerge-ts` on disk — they exist in this repo's
`node_modules` only because `prisma` (the CLI, for running migrations
locally/in CI) is a devDependency.

**Current mitigation**: none required beyond the above, because the
vulnerable code never executes. The alternative — `npm audit fix --force`
— would downgrade to `prisma@6.19.3`, a major-version downgrade that trades
a real, current, actively-maintained ORM version for an unreached
vulnerability. That's a worse trade than leaving the advisory open and
documented.

**What to monitor going forward**: re-run `npm audit` after every
`prisma`/`@prisma/client` version bump, and check whether a newer 7.x (or
later) release has updated its bundled `mysql2`/`deepmerge-ts` versions —
Prisma's own dependency updates will resolve this without any action here.
If this project ever adds a second, MySQL-backed data source, revisit this
decision immediately, since the "unused code path" reasoning would no
longer hold.

## Development workflow

Changes are prepared on a feature branch and merged into `main` via a pull
request; Vercel deploys `main` to production automatically.
