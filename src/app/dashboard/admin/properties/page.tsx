import Link from "next/link";
import type { PropertyStatus } from "@prisma/client";
import { requireAdmin } from "@/server/auth/page-guards";
import { listAllProperties, listReviewQueues } from "@/server/services/property-review-service";
import { formatDateTime } from "../../_components/format";
import { STATUS_LABELS, StatusBadge } from "../../_components/status-badge";
import styles from "../../ui.module.css";

const DONE_MESSAGES: Record<string, string> = {
  approved: "Listing approved. It's now live.",
  rejected: "Listing rejected. The host can see your reason and resubmit.",
  "changes-approved": "Edits approved. The live listing has been updated.",
  "changes-rejected": "Edits rejected. The live listing is unchanged, and the host can see your reason.",
};

const STATUSES = Object.keys(STATUS_LABELS) as PropertyStatus[];

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; status?: string }>;
}) {
  await requireAdmin("/dashboard/admin/properties");
  const { done, status } = await searchParams;
  const statusFilter = STATUSES.includes(status as PropertyStatus) ? (status as PropertyStatus) : undefined;
  const [{ newListings, changeRequests }, all] = await Promise.all([
    listReviewQueues(),
    listAllProperties(statusFilter),
  ]);

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Back to admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Property listings</h1>
      <p className={styles.pageHint}>Review new listings and edits to live listings. Oldest first.</p>
      {done && DONE_MESSAGES[done] && (
        <div className={styles.noticeSuccess} role="status">
          <p>{DONE_MESSAGES[done]}</p>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>New listings waiting for review ({newListings.length})</h2>
        {newListings.length === 0 ? (
          <p className={styles.empty}>Nothing to review.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Host</th>
                  <th>Location</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {newListings.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <div className={styles.muted}>{p.propertyType.name}</div>
                    </td>
                    <td>{p.hostProfile.businessName}</td>
                    <td className={styles.muted}>
                      {p.island.name}, {p.island.atoll.name}
                    </td>
                    <td className={styles.muted}>{formatDateTime(p.submittedAt)}</td>
                    <td>
                      <Link className={styles.link} href={`/dashboard/admin/properties/${p.id}`}>
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Edits to live listings ({changeRequests.length})</h2>
        <p className={styles.sectionHint}>Name, description and photo changes. The current version stays live until you decide.</p>
        {changeRequests.length === 0 ? (
          <p className={styles.empty}>Nothing to review.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Host</th>
                  <th>Last edited</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {changeRequests.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.hostProfile.businessName}</td>
                    <td className={styles.muted}>{formatDateTime(p.changesSubmittedAt)}</td>
                    <td>
                      <Link className={styles.link} href={`/dashboard/admin/properties/${p.id}`}>
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>All listings</h2>
          <nav className={styles.rowActions}>
            <Link className={styles.link} href="/dashboard/admin/properties" aria-current={!statusFilter ? "page" : undefined}>
              All
            </Link>
            {STATUSES.map((s) => (
              <Link key={s} className={styles.link} href={`/dashboard/admin/properties?status=${s}`} aria-current={statusFilter === s ? "page" : undefined}>
                {STATUS_LABELS[s]}
              </Link>
            ))}
          </nav>
        </div>
        {all.length === 0 ? (
          <p className={styles.empty}>No listings{statusFilter ? " with this status" : ""}.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {all.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.hostProfile.businessName}</td>
                    <td>
                      <StatusBadge status={p.status} hasPendingChanges={p.changesSubmittedAt !== null} />
                    </td>
                    <td className={styles.muted}>{formatDateTime(p.updatedAt)}</td>
                    <td>
                      <Link className={styles.link} href={`/dashboard/admin/properties/${p.id}`}>
                        View
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
