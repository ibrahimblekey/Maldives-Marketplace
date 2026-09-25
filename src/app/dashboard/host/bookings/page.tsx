import Link from "next/link";
import { requireHost } from "@/server/auth/page-guards";
import { listHostBookings } from "@/server/services/booking-service";
import { BookingStatusBadge } from "../../_components/booking-details";
import { formatDate, formatMoney } from "../../_components/format";
import styles from "../../ui.module.css";

const FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past stays" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

export default async function HostBookingsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await requireHost("/dashboard/host/bookings");
  const { show } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === show) ? (show as Filter) : "upcoming";
  const bookings = await listHostBookings(session.user.id, filter);

  return (
    <div>
      <Link href="/dashboard/host" className={styles.backLink}>
        ← Host dashboard
      </Link>
      <h1 className={styles.pageTitle}>Bookings</h1>
      <p className={styles.pageHint}>
        Guests pay you directly when they arrive. After each stay, confirm whether the guest came: stays you don&rsquo;t mark
        within 7 days of check-out count as stayed.
      </p>
      <nav className={styles.steps} aria-label="Filter bookings">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/dashboard/host/bookings?show=${f.value}`} className={filter === f.value ? styles.stepActive : styles.step}>
            {f.label}
          </Link>
        ))}
      </nav>
      <section className={styles.section}>
        {bookings.length === 0 ? (
          <p className={styles.empty}>No bookings here yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Property / room</th>
                  <th>Dates</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.guests[0]?.fullName ?? b.guest.name}
                      <div className={styles.muted}>
                        {b.numGuests} guest{b.numGuests === 1 ? "" : "s"} · {b.bookingReference}
                      </div>
                    </td>
                    <td>
                      {b.property.name}
                      <div className={styles.muted}>
                        {b.numRooms} × {b.room.name}
                      </div>
                    </td>
                    <td>
                      {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                    </td>
                    <td>{formatMoney(b.totalAmount, b.currency)}</td>
                    <td>
                      <BookingStatusBadge status={b.status} />
                    </td>
                    <td>
                      <Link className={styles.link} href={`/dashboard/host/bookings/${b.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
