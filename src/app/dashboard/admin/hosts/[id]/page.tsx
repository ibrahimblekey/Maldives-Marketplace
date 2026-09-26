import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/page-guards";
import { getHostForAdmin, REPORT_REASON_LABELS } from "@/server/services/moderation-service";
import { NotFoundError } from "@/server/services/errors";
import { ActionForm } from "../../../_components/action-form";
import { ConfirmButton } from "../../../_components/confirm-button";
import { formatDate, formatDateTime, formatMoney } from "../../../_components/format";
import { StatusBadge } from "../../../_components/status-badge";
import { suspendHostAction, unsuspendHostAction } from "../actions";
import styles from "../../../ui.module.css";

export default async function AdminHostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/dashboard/admin/hosts/${id}`);
  let data;
  try {
    data = await getHostForAdmin(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { host, upcomingBookings, suspendedBy } = data;
  const reports = host.properties.flatMap((p) => p.reports.map((r) => ({ ...r, propertyName: p.name })));

  return (
    <div>
      <Link href="/dashboard/admin/hosts" className={styles.backLink}>
        ← Hosts
      </Link>
      <div className={styles.sectionHeader}>
        <h1 className={styles.pageTitle}>{host.businessName}</h1>
        {host.suspendedAt ? <span className={styles.badgeSUSPENDED}>Suspended</span> : <span className={styles.badgeAPPROVED}>Active</span>}
      </div>
      <p className={styles.pageHint}>
        {host.user.name} · {host.user.email} · {host.contactPhone}
        {host.businessRegistrationNumber ? ` · Reg. ${host.businessRegistrationNumber}` : ""} · Joined {formatDate(host.user.createdAt)}
      </p>

      {host.suspendedAt ? (
        <section className={styles.section}>
          <div className={styles.noticeError}>
            <p>
              <strong>Suspended</strong> since {formatDateTime(host.suspendedAt)}
              {suspendedBy ? ` by ${suspendedBy.name}` : ""}. Their listings are hidden from travelers and can&rsquo;t be booked.
            </p>
            {host.suspensionReason && <p>Reason: &ldquo;{host.suspensionReason}&rdquo;</p>}
          </div>
          <ConfirmButton
            action={unsuspendHostAction.bind(null, host.id)}
            label="Unsuspend this host"
            variant="buttonSecondary"
            confirm="Make their approved listings visible and bookable again?"
          />
        </section>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Suspend this host</h2>
          <p className={styles.sectionHint}>
            Takes effect immediately: all their listings disappear from search and can&rsquo;t be booked, and they can&rsquo;t
            submit new ones. The host is emailed the reason. Existing bookings are <strong>not</strong> cancelled; check the list
            below and contact those guests if needed.
          </p>
          <ActionForm action={suspendHostAction.bind(null, host.id)} submitLabel="Suspend host" pendingLabel="Suspending..." variant="danger">
            <label className={styles.label}>
              Reason (the host will see this)
              <textarea
                className={styles.textarea}
                name="reason"
                required
                minLength={10}
                maxLength={1000}
                rows={3}
                placeholder="e.g. Guests reported being asked for a deposit by bank transfer."
              />
            </label>
          </ActionForm>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Listings ({host.properties.length})</h2>
        {host.properties.length === 0 ? (
          <p className={styles.empty}>No listings.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {host.properties.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className={styles.link} href={`/dashboard/admin/properties/${p.id}`}>
                        {p.name}
                      </Link>
                      <div className={styles.muted}>{p.island.name}</div>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                      {host.suspendedAt && p.status === "APPROVED" && (
                        <div className={styles.muted}>hidden while the host is suspended</div>
                      )}
                    </td>
                    <td className={styles.muted}>{p.reports.length} report{p.reports.length === 1 ? "" : "s"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className={styles.empty}>No reports about this host&rsquo;s listings.</p>
        ) : (
          <ul className={styles.checklist}>
            {reports.map((r) => (
              <li key={r.id}>
                <span className={r.status === "OPEN" ? styles.badgeREJECTED : styles.badge}>{r.status.toLowerCase()}</span>{" "}
                {formatDate(r.createdAt)} · {r.propertyName}: {REPORT_REASON_LABELS[r.reason]}
              </li>
            ))}
          </ul>
        )}
        <Link className={styles.link} href="/dashboard/admin/reports">
          Go to all reports →
        </Link>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Upcoming bookings ({upcomingBookings.length})</h2>
        {upcomingBookings.length === 0 ? (
          <p className={styles.empty}>None.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {upcomingBookings.map((b) => (
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
                    <td>
                      {b.guest.name}
                      <div className={styles.muted}>{b.guest.email}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {host.commissionStatements.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Unpaid statements</h2>
          <ul className={styles.checklist}>
            {host.commissionStatements.map((s) => (
              <li key={s.id}>
                <Link className={styles.link} href={`/dashboard/admin/statements/${s.id}`}>
                  {formatMoney(s.commissionAmount, s.currency)}, due {formatDate(s.dueDate)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
