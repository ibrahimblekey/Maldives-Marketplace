import Link from "next/link";
import { requireAdmin } from "@/server/auth/page-guards";
import { listStatements, PAYMENT_TERMS_DAYS, recentBillableMonths, unbilledSummary } from "@/server/services/commission-service";
import { todayInMaldives } from "@/lib/stay-pricing";
import { ActionForm } from "../../_components/action-form";
import { formatDate, formatMoney } from "../../_components/format";
import { generateStatementsAction } from "./actions";
import styles from "../../ui.module.css";

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const FILTERS = [
  { value: "due", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

export default async function AdminStatementsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin("/dashboard/admin/statements");
  const { show } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === show) ? (show as Filter) : "due";
  const [statements, unbilled] = await Promise.all([listStatements(filter), unbilledSummary()]);
  const today = todayInMaldives();
  const months = recentBillableMonths();

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Commission statements</h1>
      <p className={styles.pageHint}>
        Guests pay hosts at the property; hosts pay the platform its commission monthly. Statements are due {PAYMENT_TERMS_DAYS}{" "}
        days after they&rsquo;re created. While a statement is overdue, that host&rsquo;s listings are hidden from search.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Create this month&rsquo;s statements</h2>
        <p className={styles.sectionHint}>
          Not billed yet:{" "}
          {unbilled.length === 0
            ? "nothing. There are no completed stays waiting to be billed."
            : unbilled.map((u) => `${u.count} stay${u.count === 1 ? "" : "s"}, ${formatMoney(u.commission, u.currency)} commission`).join("; ")}
          . Do this once at the start of each month for the month that just ended.
        </p>
        <ActionForm action={generateStatementsAction} submitLabel="Create statements" pendingLabel="Creating...">
          <label className={styles.label}>
            Month
            <select className={styles.select} name="month" defaultValue={months[0].toISOString().slice(0, 7)}>
              {months.map((m) => (
                <option key={m.toISOString()} value={m.toISOString().slice(0, 7)}>
                  {monthName.format(m)}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </section>

      <nav className={styles.steps} aria-label="Filter statements">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/dashboard/admin/statements?show=${f.value}`} className={filter === f.value ? styles.stepActive : styles.step}>
            {f.label}
          </Link>
        ))}
      </nav>
      <section className={styles.section}>
        {statements.length === 0 ? (
          <p className={styles.empty}>No statements here.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Month</th>
                  <th>Stays</th>
                  <th>Commission</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => {
                  const overdue = s.status === "DUE" && s.dueDate < today;
                  return (
                    <tr key={s.id}>
                      <td>
                        {s.hostProfile.businessName}
                        <div className={styles.muted}>{s.hostProfile.user.email}</div>
                      </td>
                      <td>{monthName.format(s.periodStart)}</td>
                      <td>{s.bookingCount}</td>
                      <td>{formatMoney(s.commissionAmount, s.currency)}</td>
                      <td>
                        <span className={s.status === "PAID" ? styles.badgeAPPROVED : overdue ? styles.badgeREJECTED : styles.badgePENDING_APPROVAL}>
                          {s.status === "PAID" ? "Paid" : overdue ? `Overdue (due ${formatDate(s.dueDate)})` : `Due ${formatDate(s.dueDate)}`}
                        </span>
                      </td>
                      <td>
                        <Link className={styles.link} href={`/dashboard/admin/statements/${s.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
