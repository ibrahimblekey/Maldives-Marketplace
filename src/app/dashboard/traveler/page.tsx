import Link from "next/link";
import { requireRoleOrRedirect } from "@/server/auth/page-guards";
import { listGuestBookings } from "@/server/services/booking-service";
import { todayInMaldives } from "@/lib/stay-pricing";
import { BookingStatusBadge } from "../_components/booking-details";
import { formatDate, formatMoney } from "../_components/format";
import styles from "../ui.module.css";

/** Traveler home: "My trips". Only the TRAVELER role may reach this page. */
export default async function TravelerDashboardPage() {
  const session = await requireRoleOrRedirect(["TRAVELER"], "/dashboard/traveler");
  const bookings = await listGuestBookings(session.user.id);
  const today = todayInMaldives();
  const upcoming = bookings.filter((b) => b.status === "CONFIRMED" && b.checkOutDate > today).reverse();
  const past = bookings.filter((b) => !upcoming.includes(b));

  const list = (items: typeof bookings, empty: string) =>
    items.length === 0 ? (
      <p className={styles.empty}>{empty}</p>
    ) : (
      <div className={styles.cardList}>
        {items.map((b) => (
          <Link key={b.id} href={`/dashboard/traveler/trips/${b.id}`} className={styles.propertyCard}>
            {b.property.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- host photos from Blob storage
              <img className={styles.thumb} src={b.property.images[0].url} alt="" />
            ) : (
              <span className={styles.thumb} />
            )}
            <span className={styles.propertyCardBody}>
              <span className={styles.propertyCardTitle}>{b.property.name}</span>
              <span className={styles.muted} style={{ display: "block", fontSize: "0.875rem", marginBottom: 6 }}>
                {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)} · {b.numRooms} × {b.room.name} ·{" "}
                {formatMoney(b.totalAmount, b.currency)} · {b.bookingReference}
              </span>
              <BookingStatusBadge status={b.status} />
            </span>
          </Link>
        ))}
      </div>
    );

  return (
    <div>
      <h1 className={styles.pageTitle}>My trips</h1>
      <p className={styles.pageHint}>
        Welcome, {session.user.name}.{" "}
        <Link className={styles.link} href="/search">
          Find a stay →
        </Link>
      </p>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Upcoming ({upcoming.length})</h2>
        {list(upcoming, "No upcoming trips yet.")}
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Past &amp; cancelled ({past.length})</h2>
        {list(past, "Nothing here yet.")}
      </section>
      <p style={{ marginTop: 8 }}>
        <Link href="/dashboard/become-host" className={styles.link}>
          Own a guesthouse, hotel or villa? Become a host →
        </Link>
      </p>
    </div>
  );
}
