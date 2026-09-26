import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { requireAdmin } from "@/server/auth/page-guards";
import { listAllBookings } from "@/server/services/booking-service";
import { BOOKING_STATUS_LABELS, BookingStatusBadge } from "../../_components/booking-details";
import { formatDate, formatDateTime, formatMoney } from "../../_components/format";
import styles from "../../ui.module.css";

const STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"];

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("/dashboard/admin/bookings");
  const { status } = await searchParams;
  const filter = STATUSES.includes(status as BookingStatus) ? (status as BookingStatus) : undefined;
  const bookings = await listAllBookings(filter);

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Bookings</h1>
      <p className={styles.pageHint}>Every booking on the platform, newest first (latest 300).</p>
      <nav className={styles.steps} aria-label="Filter">
        <Link href="/dashboard/admin/bookings" className={!filter ? styles.stepActive : styles.step}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/dashboard/admin/bookings?status=${s}`} className={filter === s ? styles.stepActive : styles.step}>
            {BOOKING_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      <section className={styles.section}>
        {bookings.length === 0 ? (
          <p className={styles.empty}>No bookings.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Property · host</th>
                  <th>Guest</th>
                  <th>Stay</th>
                  <th>Total · commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link className={styles.link} href={`/dashboard/admin/bookings/${b.id}`}>
                        {b.bookingReference}
                      </Link>
                      <div className={styles.muted}>{formatDateTime(b.createdAt)}</div>
                    </td>
                    <td>
                      {b.property.name}
                      <div className={styles.muted}>{b.property.hostProfile.businessName}</div>
                    </td>
                    <td>
                      {b.guest.name}
                      <div className={styles.muted}>{b.guest.email}</div>
                    </td>
                    <td>
                      {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                    </td>
                    <td>
                      {formatMoney(b.totalAmount, b.currency)}
                      <div className={styles.muted}>{formatMoney(b.commissionAmount, b.currency)}</div>
                    </td>
                    <td>
                      <BookingStatusBadge status={b.status} />
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
