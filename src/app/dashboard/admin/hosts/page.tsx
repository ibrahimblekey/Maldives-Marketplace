import Link from "next/link";
import { requireAdmin } from "@/server/auth/page-guards";
import { listHosts } from "@/server/services/moderation-service";
import { formatDateTime } from "../../_components/format";
import styles from "../../ui.module.css";

const FILTERS = [
  { value: "all", label: "All hosts" },
  { value: "reported", label: "With open reports" },
  { value: "suspended", label: "Suspended" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

export default async function AdminHostsPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  await requireAdmin("/dashboard/admin/hosts");
  const { show, q } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === show) ? (show as Filter) : "all";
  const search = q?.trim().slice(0, 100) || undefined;
  const hosts = await listHosts(filter, search);

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Hosts</h1>
      <p className={styles.pageHint}>Everyone who lists properties. Open a host to see their listings, bookings and reports, or to suspend them.</p>

      <form className={styles.buttonRow} style={{ marginBottom: 12 }}>
        <input className={styles.input} style={{ maxWidth: 320 }} name="q" defaultValue={search} placeholder="Search name, email or phone" />
        <input type="hidden" name="show" value={filter} />
        <button className={styles.buttonSecondary} type="submit">
          Search
        </button>
      </form>
      <nav className={styles.steps} aria-label="Filter hosts">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/dashboard/admin/hosts?show=${f.value}`} className={filter === f.value ? styles.stepActive : styles.step}>
            {f.label}
          </Link>
        ))}
      </nav>

      <section className={styles.section}>
        {hosts.length === 0 ? (
          <p className={styles.empty}>No hosts found.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Contact</th>
                  <th>Listings</th>
                  <th>Open reports</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {h.businessName}
                      <div className={styles.muted}>{h.user.name}</div>
                    </td>
                    <td>
                      {h.user.email}
                      <div className={styles.muted}>{h.contactPhone}</div>
                    </td>
                    <td>
                      {h.liveListings} live / {h._count.properties}
                    </td>
                    <td>{h.openReports > 0 ? <span className={styles.badgeREJECTED}>{h.openReports}</span> : "0"}</td>
                    <td>
                      {h.suspendedAt ? (
                        <span className={styles.badgeSUSPENDED} title={`Since ${formatDateTime(h.suspendedAt)}`}>
                          Suspended
                        </span>
                      ) : (
                        <span className={styles.badgeAPPROVED}>Active</span>
                      )}
                    </td>
                    <td>
                      <Link className={styles.link} href={`/dashboard/admin/hosts/${h.id}`}>
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
