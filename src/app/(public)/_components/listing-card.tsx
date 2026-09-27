import Link from "next/link";
import type { SearchResult } from "@/server/services/listing-search-service";
import { formatCents, plural } from "./format";
import styles from "../public.module.css";

export function ListingCard({ listing, query, nights }: { listing: SearchResult; query: string; nights?: number }) {
  return (
    <Link href={`/stays/${listing.slug}${query}`} className={styles.card}>
      {listing.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- host photos from Blob storage; plain <img> keeps image-optimisation costs at zero
        <img className={styles.cardImage} src={listing.coverUrl} alt="" loading="lazy" />
      ) : (
        <span className={styles.cardImage} />
      )}
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{listing.name}</span>
        <span className={styles.cardMeta}>
          {listing.propertyType} · {listing.island}, {listing.atoll}
        </span>
        {listing.distanceFromBeachMeters !== null && (
          <span className={styles.cardMeta}>{listing.distanceFromBeachMeters} m to the beach</span>
        )}
        {listing.listingType === "PRIVATE_RENTAL" && <span className={styles.localsBadge}>Maldivians &amp; residents only</span>}
        <span className={styles.cardPrice}>
          {listing.fromTotalCents !== null && nights ? (
            <>
              <strong>{formatCents(listing.fromTotalCents, listing.currency)}</strong> for {plural(nights, "night")}
              <br />
              <span className={styles.taxNote}>
                {listing.listingType === "PRIVATE_RENTAL"
                  ? "final price, no taxes"
                  : `incl. service charge & T-GST · + green tax ${formatCents(listing.greenTaxPerNightCents, "USD")} per visitor per night`}
              </span>
            </>
          ) : (
            <>
              from <strong>{formatCents(listing.fromNightlyCents, listing.currency)}</strong> / night
              {listing.listingType !== "PRIVATE_RENTAL" && (
                <>
                  <br />
                  <span className={styles.taxNote}>+ service charge &amp; taxes</span>
                </>
              )}
            </>
          )}
        </span>
        {listing.roomsLeft !== null && listing.roomsLeft <= 3 && (
          <span className={styles.scarcity}>Only {plural(listing.roomsLeft, "room")} left for your dates</span>
        )}
      </span>
    </Link>
  );
}
