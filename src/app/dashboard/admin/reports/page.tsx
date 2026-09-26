import Link from "next/link";
import { requireAdmin } from "@/server/auth/page-guards";
import { listReports, REPORT_REASON_LABELS } from "@/server/services/moderation-service";
import { ActionForm } from "../../_components/action-form";
import { formatDateTime } from "../../_components/format";
import { closeReportAction } from "./actions";
import styles from "../../ui.module.css";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin("/dashboard/admin/reports");
  const { show } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === show) ? (show as Filter) : "open";
  const reports = await listReports(filter);

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Listing reports</h1>
      <p className={styles.pageHint}>
        Reports from travelers. For a likely scam, open the host and suspend them first; their listings disappear immediately.
        Then close the report here.
      </p>
      <nav className={styles.steps} aria-label="Filter reports">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/dashboard/admin/reports?show=${f.value}`} className={filter === f.value ? styles.stepActive : styles.step}>
            {f.label}
          </Link>
        ))}
      </nav>

      {reports.length === 0 && (
        <section className={styles.section}>
          <p className={styles.empty}>No reports here.</p>
        </section>
      )}
      {reports.map((r) => {
        const urgent = r.reason === "ASKED_TO_PAY_OUTSIDE" || r.reason === "SCAM_OR_FRAUD";
        return (
          <section key={r.id} className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {urgent && r.status === "OPEN" ? "⚠️ " : ""}
                {r.property.name}
              </h2>
              <span className={r.status === "OPEN" ? styles.badgeREJECTED : styles.badge}>{r.status.toLowerCase()}</span>
            </div>
            <dl className={styles.summaryGrid} style={{ marginTop: 8 }}>
              <dt>Reason</dt>
              <dd>{REPORT_REASON_LABELS[r.reason]}</dd>
              <dt>Details</dt>
              <dd>{r.details}</dd>
              <dt>Reported</dt>
              <dd>
                {formatDateTime(r.createdAt)} · {r.reporterEmail ?? (r.reporterUserId ? "signed-in traveler" : "anonymous")}
              </dd>
              <dt>Host</dt>
              <dd>
                <Link className={styles.link} href={`/dashboard/admin/hosts/${r.property.hostProfile.id}`}>
                  {r.property.hostProfile.businessName}
                </Link>
                {r.property.hostProfile.suspendedAt ? " (suspended)" : ""} ·{" "}
                <Link className={styles.link} href={`/dashboard/admin/properties/${r.property.id}`}>
                  listing
                </Link>{" "}
                · {r.property._count.reports} report{r.property._count.reports === 1 ? "" : "s"} in total
              </dd>
              {r.status !== "OPEN" && (
                <>
                  <dt>Closed</dt>
                  <dd>
                    {formatDateTime(r.resolvedAt)}
                    {r.resolutionNote ? `: “${r.resolutionNote}”` : ""}
                  </dd>
                </>
              )}
            </dl>
            {r.status === "OPEN" && (
              <div style={{ marginTop: 16 }}>
                <ActionForm action={closeReportAction.bind(null, r.id)} submitLabel="Close report" pendingLabel="Saving..." variant="secondary">
                  <div className={styles.row}>
                    <label className={styles.checkbox}>
                      <input type="radio" name="outcome" value="RESOLVED" required defaultChecked /> Action taken
                    </label>
                    <label className={styles.checkbox}>
                      <input type="radio" name="outcome" value="DISMISSED" required /> Nothing wrong found
                    </label>
                  </div>
                  <label className={styles.label}>
                    Note for the record (optional)
                    <input className={styles.input} name="note" maxLength={1000} placeholder="e.g. Host suspended, guest contacted" />
                  </label>
                </ActionForm>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
