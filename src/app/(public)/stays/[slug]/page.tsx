import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MEAL_PLAN_LABELS } from "@/lib/validation/property";
import { parseStay, toIsoDate, todayInMaldives } from "@/lib/stay-pricing";
import { getPublicListing, type RoomOffer } from "@/server/services/listing-search-service";
import { formatCents, plural } from "../../_components/format";
import { MAX_GUESTS, type RawSearchParams } from "../../_components/search-params";
import styles from "../../public.module.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublicListing(slug, null);
  if (!listing) return { title: "Stay not found · Maldives Marketplace" };
  const { property } = listing;
  return {
    title: `${property.name}, ${property.island.name} · Maldives Marketplace`,
    description: property.description.slice(0, 160),
  };
}

function RoomPrice({ offer, nights }: { offer: RoomOffer; nights?: number }) {
  const currency = offer.room.currency;
  if (!offer.quote) {
    return (
      <div className={styles.roomPrice}>
        <strong>{formatCents(offer.nightlyCents, currency)}</strong>
        <span className={styles.muted}>per night</span>
      </div>
    );
  }
  if (offer.roomsLeft === 0) {
    return (
      <div className={styles.roomPrice}>
        <span className={styles.roomUnavailable}>Sold out for your dates</span>
      </div>
    );
  }
  if (offer.quote.stayRuleProblem) {
    return (
      <div className={styles.roomPrice}>
        <span className={styles.roomUnavailable}>{offer.quote.stayRuleProblem}</span>
      </div>
    );
  }
  const hasSeason = offer.quote.nights.some((n) => n.season);
  return (
    <div className={styles.roomPrice}>
      <strong>{formatCents(offer.quote.totalCents, currency)}</strong>
      <span className={styles.muted}>for {plural(nights ?? 0, "night")}</span>
      {offer.roomsLeft <= 3 && <div className={styles.scarcity}>Only {plural(offer.roomsLeft, "room")} left</div>}
      {hasSeason && (
        <details className={styles.breakdown}>
          <summary>Price per night</summary>
          {offer.quote.nights.map((n) => (
            <div key={n.date.toISOString()}>
              {dayFormat.format(n.date)}: {formatCents(n.cents, currency)}
              {n.season ? ` (${n.season})` : ""}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

export default async function StayPage({ params, searchParams }: Props) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const { stay, error: dateError } = parseStay(first(raw.checkIn), first(raw.checkOut));
  const guestsRaw = Number(first(raw.guests));
  const guests = Number.isInteger(guestsRaw) && guestsRaw >= 1 && guestsRaw <= MAX_GUESTS ? guestsRaw : 1;

  const listing = await getPublicListing(slug, stay);
  if (!listing) notFound();
  const { property, offers, cheapest } = listing;

  const photos = property.images;
  const policy = property.cancellationPolicy;
  const nights = stay?.nights;
  const bookableOffers = offers.filter((o) => o.bookable);
  const capacity = bookableOffers.reduce((n, o) => n + o.roomsLeft * o.room.maxOccupancy, 0);
  const today = toIsoDate(todayInMaldives());

  return (
    <div className={styles.container}>
      <p className={styles.breadcrumbs}>
        <Link href="/search">All stays</Link> ›{" "}
        <Link href={`/search?where=atoll:${property.island.atoll.slug}`}>{property.island.atoll.name}</Link> ›{" "}
        <Link href={`/search?where=island:${property.island.slug}`}>{property.island.name}</Link>
      </p>
      <h1 className={styles.propertyTitle}>{property.name}</h1>
      <p className={styles.muted} style={{ marginTop: 6 }}>
        {property.propertyType.name} · {property.island.name}, {property.island.atoll.name} · Hosted by{" "}
        {property.hostProfile.businessName}
      </p>

      {photos.length > 0 && (
        <div className={styles.gallery}>
          {photos.slice(0, 5).map((photo, i) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- host photos from Blob storage */}
              <img src={photo.url} alt={photo.altText ?? `${property.name}, photo ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
            </a>
          ))}
        </div>
      )}
      {photos.length > 5 && (
        <div className={styles.galleryMore}>
          {photos.slice(5).map((photo, i) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- host photos from Blob storage */}
              <img src={photo.url} alt={photo.altText ?? `${property.name}, photo ${i + 6}`} loading="lazy" />
            </a>
          ))}
        </div>
      )}

      <div className={styles.propertyLayout}>
        <div>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>About this stay</h2>
            <p className={styles.description}>{property.description}</p>
            <div className={styles.facts}>
              {property.distanceFromBeachMeters !== null && <span>🏖 {property.distanceFromBeachMeters} m to the beach</span>}
              {property.distanceFromHarborMeters !== null && <span>⛴ {property.distanceFromHarborMeters} m to the harbour</span>}
              {property.address && <span>📍 {property.address}</span>}
            </div>
          </section>

          <section className={styles.panel} id="rooms">
            <h2 className={styles.panelTitle}>Rooms</h2>
            {dateError && <p className={styles.notice}>{dateError}</p>}
            {!stay && <p className={styles.muted} style={{ marginBottom: 12 }}>Add your dates to see prices and availability for your stay.</p>}
            {stay && guests > 1 && capacity < guests && (
              <p className={styles.notice}>
                For these dates the available rooms sleep {capacity} guests in total, fewer than your {guests}.
              </p>
            )}
            {offers.map((offer) => (
              <div key={offer.room.id} className={styles.roomCard}>
                <div>
                  <div className={styles.roomName}>{offer.room.name}</div>
                  <div className={styles.muted} style={{ fontSize: "0.9375rem" }}>
                    Sleeps {offer.room.maxOccupancy}
                    {offer.room.bedConfiguration ? ` · ${offer.room.bedConfiguration}` : ""}
                    {offer.room.sizeSqm ? ` · ${Math.round(offer.room.sizeSqm)} m²` : ""} ·{" "}
                    {MEAL_PLAN_LABELS[offer.room.mealPlan]}
                  </div>
                  {offer.room.description && (
                    <p style={{ marginTop: 8, fontSize: "0.9375rem", whiteSpace: "pre-wrap" }}>{offer.room.description}</p>
                  )}
                  {offer.room.amenities.length > 0 && (
                    <p className={styles.muted} style={{ marginTop: 6, fontSize: "0.875rem" }}>
                      {offer.room.amenities.map((a) => a.amenity.name).join(" · ")}
                    </p>
                  )}
                  {(offer.room.extraGuestFee || offer.room.extraBedFee) && (
                    <p className={styles.muted} style={{ marginTop: 6, fontSize: "0.8125rem" }}>
                      {offer.room.extraGuestFee && `Extra guest: ${offer.room.currency} ${offer.room.extraGuestFee.toString()}/night. `}
                      {offer.room.extraBedFee && `Extra bed: ${offer.room.currency} ${offer.room.extraBedFee.toString()}/night.`}
                    </p>
                  )}
                </div>
                <RoomPrice offer={offer} nights={nights} />
              </div>
            ))}
          </section>

          {property.amenities.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Amenities</h2>
              <ul className={styles.amenityGrid}>
                {property.amenities.map((a) => (
                  <li key={a.amenity.name}>{a.amenity.name}</li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Policies</h2>
            <dl className={styles.policyList}>
              <dt>Check-in</dt>
              <dd>From {property.checkInTime ?? "—"}</dd>
              <dt>Check-out</dt>
              <dd>By {property.checkOutTime ?? "—"}</dd>
              <dt>Cancellation</dt>
              <dd>
                {!policy
                  ? "—"
                  : `${policy.freeCancellationDays !== null ? `Free cancellation up to ${plural(policy.freeCancellationDays, "day")} before check-in.` : "No free cancellation."} ${policy.refundPercentageAfter ? `${policy.refundPercentageAfter}% refund after that.` : "No refund after that."}${policy.description ? `\n${policy.description}` : ""}`}
              </dd>
              <dt>Children</dt>
              <dd>{policy?.childrenPolicy ?? "Ask the host"}</dd>
              {policy?.extraBedPolicy && (
                <>
                  <dt>Extra beds</dt>
                  <dd>{policy.extraBedPolicy}</dd>
                </>
              )}
              <dt>Pets</dt>
              <dd>{policy?.petsAllowed ? "Allowed" : "Not allowed"}</dd>
              <dt>Smoking</dt>
              <dd>{policy?.smokingAllowed ? "Allowed" : "Not allowed"}</dd>
            </dl>
          </section>
        </div>

        <aside className={`${styles.panel} ${styles.bookingBox}`}>
          {cheapest && (
            <p style={{ marginBottom: 14 }}>
              {stay && cheapest.quote ? (
                <>
                  <span className={styles.bookingPrice}>{formatCents(cheapest.quote.totalCents, cheapest.room.currency)}</span>{" "}
                  <span className={styles.muted}>for {plural(nights!, "night")}, cheapest room</span>
                </>
              ) : (
                <>
                  from <span className={styles.bookingPrice}>{formatCents(cheapest.nightlyCents, cheapest.room.currency)}</span>{" "}
                  <span className={styles.muted}>/ night</span>
                </>
              )}
            </p>
          )}
          {stay && bookableOffers.length === 0 && (
            <p className={styles.roomUnavailable} style={{ marginBottom: 12 }}>
              No rooms available for these dates. Try different dates.
            </p>
          )}
          <form action={`/stays/${property.slug}#rooms`}>
            <label className={styles.field}>
              Check-in
              <input type="date" name="checkIn" className={styles.input} min={today} defaultValue={stay ? toIsoDate(stay.checkIn) : ""} required />
            </label>
            <label className={styles.field}>
              Check-out
              <input type="date" name="checkOut" className={styles.input} min={today} defaultValue={stay ? toIsoDate(stay.checkOut) : ""} required />
            </label>
            <label className={styles.field}>
              Guests
              <input type="number" name="guests" className={styles.input} min={1} max={MAX_GUESTS} defaultValue={guests} />
            </label>
            <button type="submit" className={styles.searchButton}>
              {stay ? "Update prices" : "Check prices"}
            </button>
          </form>
          <p className={styles.soon} style={{ marginTop: 14 }}>
            Online booking is coming soon.
          </p>
        </aside>
      </div>
    </div>
  );
}
