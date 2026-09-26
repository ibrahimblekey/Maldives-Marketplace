import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MEAL_PLAN_LABELS } from "@/lib/validation/property";
import { parseStay, toIsoDate } from "@/lib/stay-pricing";
import { freeCancellationUntil, previewBooking } from "@/server/services/booking-service";
import { NotFoundError } from "@/server/services/errors";
import { prisma } from "@/lib/db";
import { formatCents, plural } from "../../../_components/format";
import type { RawSearchParams } from "../../../_components/search-params";
import { createBookingAction } from "./actions";
import { BookingForm } from "./booking-form";
import { DepositWarning } from "../../../_components/deposit-warning";
import styles from "../../../public.module.css";

export const metadata: Metadata = { title: "Confirm your booking · Maldives Marketplace" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const roomId = first(raw.room) ?? "";
  const checkIn = first(raw.checkIn) ?? "";
  const checkOut = first(raw.checkOut) ?? "";
  const guests = Math.min(50, Math.max(1, Number(first(raw.guests)) || 1));
  const backToStay = `/stays/${slug}?checkIn=${checkIn}&checkOut=${checkOut}#rooms`;

  const session = await auth();
  if (!session?.user) {
    const here = `/stays/${slug}/book?room=${encodeURIComponent(roomId)}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(here)}`);
  }

  const { stay, error } = parseStay(checkIn, checkOut);
  if (!stay) {
    return (
      <div className={styles.container}>
        <div className={styles.empty} style={{ marginTop: 32 }}>
          <p>{error ?? "Choose your dates first."}</p>
          <p style={{ marginTop: 12 }}>
            <Link className={styles.link} href={`/stays/${slug}`}>
              ← Back to the property
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (session.user.role !== "TRAVELER") {
    return (
      <div className={styles.container}>
        <div className={styles.empty} style={{ marginTop: 32 }}>
          <p style={{ fontWeight: 600 }}>Bookings are made from a traveler account.</p>
          <p style={{ marginTop: 8 }}>
            You&rsquo;re signed in as a {session.user.role.toLowerCase().replace("_", " ")}. Sign out and sign in with a
            traveler account (or create one) to book.
          </p>
        </div>
      </div>
    );
  }

  let preview;
  try {
    preview = await previewBooking(slug, roomId, stay);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { room, quote, roomsLeft, rates, currencyProblem } = preview;
  const [policy, user] = await Promise.all([
    prisma.cancellationPolicy.findUnique({ where: { propertyId: room.property.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
  ]);
  const freeUntil = freeCancellationUntil(stay.checkIn, policy?.freeCancellationDays);
  const unavailable =
    currencyProblem ?? quote.stayRuleProblem ?? (roomsLeft === 0 ? "Sorry, this room is no longer available for your dates." : null);

  return (
    <div className={styles.container}>
      <p className={styles.breadcrumbs}>
        <Link href={backToStay}>← Back to {room.property.name}</Link>
      </p>
      <h1 className={styles.propertyTitle}>Confirm your booking</h1>

      <div className={styles.propertyLayout} style={{ marginTop: 20 }}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{room.property.name}</h2>
          <dl className={styles.policyList}>
            <dt>Room</dt>
            <dd>
              {room.name} · {MEAL_PLAN_LABELS[room.mealPlan]}
            </dd>
            <dt>Check-in</dt>
            <dd>{longDate.format(stay.checkIn)}</dd>
            <dt>Check-out</dt>
            <dd>{longDate.format(stay.checkOut)}</dd>
            <dt>Length</dt>
            <dd>{plural(stay.nights, "night")}</dd>
            {rates.listingType === "PRIVATE_RENTAL" && (
              <>
                <dt>Who can stay</dt>
                <dd>
                  <span className={styles.localsBadge}>Maldivians &amp; residents only</span>
                </dd>
              </>
            )}
            <dt>Room price per room</dt>
            <dd>
              {formatCents(quote.totalCents, room.currency)} for {plural(stay.nights, "night")}
              {quote.nights.some((n) => n.season) &&
                `\n${quote.nights.map((n) => `${toIsoDate(n.date)}: ${formatCents(n.cents, room.currency)}${n.season ? ` (${n.season})` : ""}`).join("\n")}`}
            </dd>
            <dt>Payment</dt>
            <dd>Pay the property directly on arrival.</dd>
            <dt>Cancellation</dt>
            <dd>
              {freeUntil
                ? freeUntil > new Date()
                  ? `Free cancellation until ${longDate.format(freeUntil)}.`
                  : "The free cancellation period for these dates has already passed."
                : "This property doesn't offer free cancellation."}
              {freeUntil ? ` After that: ${policy?.refundPercentageAfter ?? 0}% refund.` : ""}
              {policy?.description ? `\n${policy.description}` : ""}
            </dd>
          </dl>
          <div style={{ marginTop: 16 }}>
            <DepositWarning reportHref={`/stays/${slug}/report`} />
          </div>
        </section>

        <aside className={`${styles.panel} ${styles.bookingBox}`}>
          {unavailable ? (
            <>
              <p className={styles.roomUnavailable}>{unavailable}</p>
              <p style={{ marginTop: 12 }}>
                <Link className={styles.link} href={backToStay}>
                  Choose other dates or rooms
                </Link>
              </p>
            </>
          ) : (
            <BookingForm
              action={createBookingAction.bind(null, slug, room.id, checkIn, checkOut)}
              perRoomCents={quote.totalCents}
              nights={stay.nights}
              rates={rates}
              currency={room.currency}
              roomsLeft={roomsLeft}
              maxOccupancy={room.maxOccupancy}
              initialGuests={guests}
              defaultName={user?.name ?? ""}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
