import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/page-guards";
import { getStatementForAdmin } from "@/server/services/commission-service";
import { NotFoundError } from "@/server/services/errors";
import { todayInMaldives } from "@/lib/stay-pricing";
import { ActionForm } from "../../../_components/action-form";
import { formatDate, formatDateTime, formatMoney } from "../../../_components/format";
import { markStatementPaidAction } from "../actions";
import styles from "../../../ui.module.css";

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function AdminStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/dashboard/admin/statements/${id}`);
  let s;
  try {
    s = await getStatementForAdmin(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const overdue = s.status === "DUE" && s.dueDate < todayInMaldives();

  return (
    <div>
      <Link href="/dashboard/admin/statements" className={styles.backLink}>
        ← Statements
      </Link>
      <h1 className={styles.pageTitle}>
        {s.hostProfile.businessName} · {monthName.format(s.periodStart)}
      </h1>
      <p className={styles.pageHint}>
        {s.hostProfile.contactPhone} · {s.hostProfile.user.email}
      </p>
      <section className={styles.section}>
        <dl className={styles.summaryGrid}>
          <dt>Commission owed</dt>
          <dd>
            <strong>{formatMoney(s.commissionAmount, s.currency)}</strong>
          </dd>
          <dt>Stays</dt>
          <dd>
            {s.bookingCount}, {formatMoney(s.bookingsTotal, s.currency)} paid by guests
          </dd>
          <dt>Status</dt>
          <dd>
            {s.status === "PAID"
              ? `Paid, marked ${formatDateTime(s.paidAt)}${s.paymentNote ? ` (${s.paymentNote})` : ""}`
              : `${overdue ? "OVERDUE, " : ""}due by ${formatDate(s.dueDate)}`}
          </dd>
        </dl>
      </section>

      {s.status === "DUE" && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Record payment</h2>
          <p className={styles.sectionHint}>Once the money is in your account, mark this statement as paid.</p>
          <ActionForm action={markStatementPaidAction.bind(null, s.id)} submitLabel="Mark as paid" pendingLabel="Saving...">
            <label className={styles.label}>
              Payment reference (optional)
              <input className={styles.input} name="note" maxLength={300} placeholder="e.g. BML transfer 12 Oct" />
            </label>
          </ActionForm>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Stays on this statement</h2>
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
                    <Link className={styles.link} href={`/dashboard/admin/bookings/${b.id}`}>
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
    </div>
  );
}
