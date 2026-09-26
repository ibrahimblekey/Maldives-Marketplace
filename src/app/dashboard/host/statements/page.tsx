import Link from "next/link";
import { requireHost } from "@/server/auth/page-guards";
import { listHostStatements, paymentInstructions } from "@/server/services/commission-service";
import { todayInMaldives } from "@/lib/stay-pricing";
import { formatDate, formatMoney } from "../../_components/format";
import styles from "../../ui.module.css";

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function HostStatementsPage() {
  const session = await requireHost("/dashboard/host/statements");
  const statements = await listHostStatements(session.user.id);
  const today = todayInMaldives();
  const overdue = statements.some((s) => s.status === "DUE" && s.dueDate < today);

  return (
    <div>
      <Link href="/dashboard/host" className={styles.backLink}>
        ← Host dashboard
      </Link>
      <h1 className={styles.pageTitle}>Commission statements</h1>
      <p className={styles.pageHint}>
        Each month you receive a statement for the platform&rsquo;s commission on the stays completed at your properties.
      </p>
      {overdue && (
        <div className={styles.noticeError}>
          <p>
            <strong>You have an overdue statement.</strong> Your listings are hidden from search and can&rsquo;t be booked until
            it&rsquo;s paid.
          </p>
        </div>
      )}
      <div className={styles.notice}>
        <p>
          <strong>How to pay:</strong> {paymentInstructions()}
        </p>
      </div>

      {statements.length === 0 ? (
        <section className={styles.section}>
          <p className={styles.empty}>No statements yet. Your first one arrives after the month of your first completed stay.</p>
        </section>
      ) : (
        statements.map((s) => {
          const isOverdue = s.status === "DUE" && s.dueDate < today;
          return (
            <section key={s.id} className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {monthName.format(s.periodStart)} · {formatMoney(s.commissionAmount, s.currency)}
                </h2>
                <span className={s.status === "PAID" ? styles.badgeAPPROVED : isOverdue ? styles.badgeREJECTED : styles.badgePENDING_APPROVAL}>
                  {s.status === "PAID" ? `Paid ${formatDate(s.paidAt ?? s.updatedAt)}` : isOverdue ? `Overdue since ${formatDate(s.dueDate)}` : `Due by ${formatDate(s.dueDate)}`}
                </span>
              </div>
              <p className={styles.sectionHint}>
                {s.bookingCount} stay{s.bookingCount === 1 ? "" : "s"}, {formatMoney(s.bookingsTotal, s.currency)} paid by guests.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Booking</th>
                      <th>Property</th>
                      <th>Stay</th>
                      <th>Guest paid</th>
                      <th>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.bookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Link className={styles.link} href={`/dashboard/host/bookings/${b.id}`}>
                            {b.bookingReference}
                          </Link>
                        </td>
                        <td>{b.property.name}</td>
                        <td>
                          {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                        </td>
                        <td>{formatMoney(b.totalAmount, s.currency)}</td>
                        <td>{formatMoney(b.commissionAmount, s.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
