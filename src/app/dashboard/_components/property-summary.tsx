import { MEAL_PLAN_LABELS } from "@/lib/validation/property";
import type { PropertyDetail } from "@/server/services/property-service";
import { formatDate, formatDistance, formatMoney } from "./format";
import styles from "../ui.module.css";

/**
 * Read-only view of a whole listing, used by the host's review step and
 * the admin review page. For a live listing it shows what travelers see
 * now — the approved name/description and photos, not pending edits
 * (those are shown separately as a change request).
 */
export function PropertySummary({ property }: { property: PropertyDetail }) {
  const isLive = property.status === "APPROVED";
  const photos = property.images.filter((i) => !isLive || i.status !== "PENDING_ADD");
  const policy = property.cancellationPolicy;

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Basics</h2>
        <dl className={styles.summaryGrid} style={{ marginTop: 12 }}>
          <dt>Name</dt>
          <dd>{property.name}</dd>
          <dt>Type</dt>
          <dd>{property.propertyType.name}</dd>
          <dt>Location</dt>
          <dd>
            {property.island.name}, {property.island.atoll.name}
            {property.address ? ` · ${property.address}` : ""}
          </dd>
          <dt>To the beach</dt>
          <dd>{formatDistance(property.distanceFromBeachMeters)}</dd>
          <dt>To the harbour</dt>
          <dd>{formatDistance(property.distanceFromHarborMeters)}</dd>
          <dt>Description</dt>
          <dd>{property.description}</dd>
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Rooms &amp; prices</h2>
        {property.rooms.length === 0 ? (
          <p className={styles.empty}>No room types.</p>
        ) : (
          property.rooms.map((room) => (
            <div key={room.id} style={{ marginTop: 16 }}>
              <h3 className={styles.subTitle} style={{ marginTop: 0 }}>
                {room.name} · {room.inventoryUnits.length} room{room.inventoryUnits.length === 1 ? "" : "s"}
              </h3>
              <dl className={styles.summaryGrid}>
                <dt>Price per night</dt>
                <dd>{formatMoney(room.basePrice, room.currency)}</dd>
                <dt>Guests</dt>
                <dd>Up to {room.maxOccupancy}</dd>
                <dt>Meals</dt>
                <dd>{MEAL_PLAN_LABELS[room.mealPlan]}</dd>
                {room.bedConfiguration && (
                  <>
                    <dt>Beds</dt>
                    <dd>{room.bedConfiguration}</dd>
                  </>
                )}
                {(room.minStayNights || room.maxStayNights) && (
                  <>
                    <dt>Stay length</dt>
                    <dd>
                      {room.minStayNights ? `min ${room.minStayNights} nights` : ""}
                      {room.minStayNights && room.maxStayNights ? ", " : ""}
                      {room.maxStayNights ? `max ${room.maxStayNights} nights` : ""}
                    </dd>
                  </>
                )}
                {room.seasonalPrices.length > 0 && (
                  <>
                    <dt>Seasonal prices</dt>
                    <dd>
                      {room.seasonalPrices
                        .map(
                          (sp) =>
                            `${sp.name ? `${sp.name}: ` : ""}${formatDate(sp.startDate)} to ${formatDate(sp.endDate)}, ${formatMoney(sp.pricePerNight, room.currency)}`
                        )
                        .join("\n")}
                    </dd>
                  </>
                )}
                {room.amenities.length > 0 && (
                  <>
                    <dt>In-room</dt>
                    <dd>{room.amenities.map((a) => a.amenity.name).join(", ")}</dd>
                  </>
                )}
                {room.description && (
                  <>
                    <dt>Description</dt>
                    <dd>{room.description}</dd>
                  </>
                )}
              </dl>
            </div>
          ))
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Amenities</h2>
        {property.amenities.length === 0 ? (
          <p className={styles.empty}>None selected.</p>
        ) : (
          <div className={styles.chips} style={{ marginTop: 12 }}>
            {property.amenities.map((a) => (
              <span key={a.amenityId} className={styles.badge}>
                {a.amenity.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Policies</h2>
        <dl className={styles.summaryGrid} style={{ marginTop: 12 }}>
          <dt>Check-in / out</dt>
          <dd>
            {property.checkInTime ?? "—"} / {property.checkOutTime ?? "—"}
          </dd>
          <dt>Cancellation</dt>
          <dd>
            {!policy
              ? "—"
              : `${policy.freeCancellationDays !== null ? `Free up to ${policy.freeCancellationDays} days before check-in` : "No free cancellation"}; ${policy.refundPercentageAfter ?? 0}% refund after that.${policy.description ? `\n${policy.description}` : ""}`}
          </dd>
          <dt>Pets / smoking</dt>
          <dd>
            {policy ? `${policy.petsAllowed ? "Pets allowed" : "No pets"} · ${policy.smokingAllowed ? "Smoking allowed" : "No smoking"}` : "—"}
          </dd>
          {policy?.childrenPolicy && (
            <>
              <dt>Children</dt>
              <dd>{policy.childrenPolicy}</dd>
            </>
          )}
          {policy?.extraBedPolicy && (
            <>
              <dt>Extra beds</dt>
              <dd>{policy.extraBedPolicy}</dd>
            </>
          )}
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Photos ({photos.length})</h2>
        <div className={styles.photoGrid} style={{ marginTop: 12 }}>
          {photos.map((image, index) => (
            <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className={styles.photoCard}>
              {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: host-uploaded photos, no optimisation needed in the dashboard */}
              <img className={styles.photo} src={image.url} alt={`Photo ${index + 1}`} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

/** Pending name/description/photo edits on a live listing, side by side with what's live now. */
export function ChangeRequestSummary({ property }: { property: PropertyDetail }) {
  const added = property.images.filter((i) => i.status === "PENDING_ADD");
  const removed = property.images.filter((i) => i.status === "PENDING_REMOVE");

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Edits waiting for review</h2>
      {property.pendingName !== null && (
        <>
          <h3 className={styles.subTitle}>Name</h3>
          <div className={styles.diff}>
            <div className={styles.diffCol}>
              <div className={styles.diffLabel}>Live now</div>
              {property.name}
            </div>
            <div className={styles.diffCol}>
              <div className={styles.diffLabel}>Proposed</div>
              {property.pendingName}
            </div>
          </div>
        </>
      )}
      {property.pendingDescription !== null && (
        <>
          <h3 className={styles.subTitle}>Description</h3>
          <div className={styles.diff}>
            <div className={styles.diffCol}>
              <div className={styles.diffLabel}>Live now</div>
              {property.description}
            </div>
            <div className={styles.diffCol}>
              <div className={styles.diffLabel}>Proposed</div>
              {property.pendingDescription}
            </div>
          </div>
        </>
      )}
      {added.length > 0 && (
        <>
          <h3 className={styles.subTitle}>New photos ({added.length})</h3>
          <div className={styles.photoGrid}>
            {added.map((image) => (
              <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className={styles.photoCardPending}>
                {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: host-uploaded photos */}
                <img className={styles.photo} src={image.url} alt="New photo" />
              </a>
            ))}
          </div>
        </>
      )}
      {removed.length > 0 && (
        <>
          <h3 className={styles.subTitle}>Photos to remove ({removed.length})</h3>
          <div className={styles.photoGrid}>
            {removed.map((image) => (
              <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className={styles.photoCardRemoving}>
                {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: host-uploaded photos */}
                <img className={styles.photo} src={image.url} alt="Photo to remove" />
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
