import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/page-guards";
import { getHostForAdmin, REPORT_REASON_LABELS } from "@/server/services/moderation-service";
import { NotFoundError } from "@/server/services/errors";
import { ActionForm } from "../../../_components/action-form";
import { ConfirmButton } from "../../../_components/confirm-button";
import { formatDate, formatDateTime, formatMoney } from "../../../_components/format";
import { StatusBadge } from "../../../_components/status-badge";
import {
  approveVerificationAction,
  deleteDocumentsAction,
  rejectVerificationAction,
  revokeVerificationAction,
  suspendHostAction,
  unsuspendHostAction,
} from "../actions";
import { documentTypeLabel, VERIFICATION_DOCUMENT_TYPES } from "@/lib/validation/verification";
import { phoneConfirmed, VERIFICATION_STATUS_LABELS } from "@/server/services/verification-service";
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
  const { host, upcomingBookings, suspendedBy, verifiedBy } = data;
  const status = host.verificationStatus;
  const phoneOk = phoneConfirmed(host);
  const sameText = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
  const reports = host.properties.flatMap((p) => p.reports.map((r) => ({ ...r, propertyName: p.name })));

  return (
    <div>
      <Link href="/dashboard/admin/hosts" className={styles.backLink}>
        ← Hosts
      </Link>
      <div className={styles.sectionHeader}>
        <h1 className={styles.pageTitle}>{host.businessName}</h1>
        <span className={styles.rowActions}>
          {status === "APPROVED" ? (
            <span className={styles.badgeAPPROVED}>Verified</span>
          ) : (
            <span className={status === "UNDER_REVIEW" ? styles.badgePENDING_APPROVAL : styles.badgeDRAFT}>{VERIFICATION_STATUS_LABELS[status]}</span>
          )}
          {host.suspendedAt ? <span className={styles.badgeSUSPENDED}>Suspended</span> : <span className={styles.badgeAPPROVED}>Active</span>}
        </span>
      </div>
      <p className={styles.pageHint}>
        {host.user.name} · {host.user.email} · {host.contactPhone}
        {host.businessRegistrationNumber ? ` · Reg. ${host.businessRegistrationNumber}` : ""} · Joined {formatDate(host.user.createdAt)}
      </p>


      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Verification: {VERIFICATION_STATUS_LABELS[status].toLowerCase()}</h2>
        {status === "PENDING" && (
          <p className={styles.sectionHint}>This host hasn&rsquo;t submitted their documents yet. Their listings are hidden until you verify them.</p>
        )}
        {status === "REJECTED" && (
          <p className={styles.sectionHint}>
            Sent back to the host; waiting for them to resubmit. Your note: &ldquo;{host.verificationRejectionReason}&rdquo;
          </p>
        )}
        {status === "APPROVED" && (
          <p className={styles.sectionHint}>
            Verified{host.verifiedAt ? ` on ${formatDateTime(host.verifiedAt)}` : ""}
            {verifiedBy ? ` by ${verifiedBy.name}` : ""}.
          </p>
        )}
        {status === "UNDER_REVIEW" && (
          <p className={styles.sectionHint}>
            Submitted {formatDateTime(host.verificationSubmittedAt)}. Open each document, check the licence&rsquo;s business name and
            island against the listings below, and call the host before approving.
          </p>
        )}

        <dl className={styles.summaryGrid} style={{ marginBottom: 16 }}>
          <dt>Licence number</dt>
          <dd>{host.licenceNumber ?? "—"}</dd>
          <dt>Name on licence</dt>
          <dd>
            {host.licenceBusinessName ?? "—"}
            {host.licenceBusinessName && !sameText(host.licenceBusinessName, host.businessName) && (
              <div className={styles.muted}>Host&rsquo;s business name on the site: {host.businessName}</div>
            )}
          </dd>
          <dt>Island on licence</dt>
          <dd>{host.licenceIsland ? `${host.licenceIsland.name}, ${host.licenceIsland.atoll.name}` : "—"}</dd>
          <dt>Listings</dt>
          <dd>
            {host.properties.length === 0
              ? "None yet"
              : host.properties.map((p) => (
                  <div key={p.id} className={host.licenceIsland?.id === p.island.id ? styles.checkOk : styles.checkMissing}>
                    {p.name} on {p.island.name}
                    {host.licenceIsland && host.licenceIsland.id !== p.island.id ? " (different island from the licence)" : ""}
                  </div>
                ))}
          </dd>
          <dt>Phone</dt>
          <dd>
            {host.contactPhone}{" "}
            {phoneOk ? (
              <span className={styles.muted}>
                confirmed{host.phoneConfirmedMethod === "ADMIN_CALL" ? " by phone call" : " by SMS"}
                {host.phoneConfirmedAt ? ` on ${formatDate(host.phoneConfirmedAt)}` : ""}
              </span>
            ) : (
              <span className={styles.muted}>not confirmed yet</span>
            )}
          </dd>
        </dl>

        <h3 className={styles.subTitle}>Documents</h3>
        {host.verificationDocuments.length === 0 ? (
          <p className={styles.empty}>{status === "APPROVED" ? "Deleted after verification." : "None uploaded."}</p>
        ) : (
          <ul className={styles.checklist}>
            {VERIFICATION_DOCUMENT_TYPES.flatMap((type) =>
              host.verificationDocuments
                .filter((d) => d.documentType === type.key)
                .map((d) => (
                  <li key={d.id}>
                    <strong>{type.label}:</strong>{" "}
                    <a className={styles.link} href={`/api/admin/verification-documents/${d.id}`} target="_blank" rel="noreferrer">
                      Open {d.contentType === "application/pdf" ? "PDF" : "photo"}
                    </a>{" "}
                    <span className={styles.muted}>
                      {d.fileName} · uploaded {formatDate(d.createdAt)}
                    </span>
                  </li>
                ))
            )}
          </ul>
        )}

        {status === "UNDER_REVIEW" && host.verificationSubmittedAt && (
          <>
            <h3 className={styles.subTitle}>Approve</h3>
            <ActionForm
              action={approveVerificationAction.bind(null, host.id, host.verificationSubmittedAt.toISOString())}
              submitLabel="Approve and verify this host"
              pendingLabel="Approving..."
            >
              {!phoneOk && (
                <label className={styles.checkbox}>
                  <input type="checkbox" name="phoneConfirmedByCall" required /> I called {host.contactPhone} and confirmed it&rsquo;s
                  this host&rsquo;s number
                </label>
              )}
            </ActionForm>

            <h3 className={styles.subTitle} style={{ marginTop: 24 }}>
              Send back for changes
            </h3>
            <ActionForm
              action={rejectVerificationAction.bind(null, host.id, host.verificationSubmittedAt.toISOString())}
              submitLabel="Send back to the host"
              pendingLabel="Sending..."
              variant="secondary"
            >
              <label className={styles.label}>
                What should the host fix? (they will see this)
                <textarea
                  className={styles.textarea}
                  name="reason"
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={3}
                  placeholder="e.g. The licence photo is blurry. Please upload a clearer photo."
                />
              </label>
              <fieldset className={styles.fieldset}>
                <legend className={styles.help}>Tick files the host must upload again. They&rsquo;re deleted straight away.</legend>
                {host.verificationDocuments.map((d) => (
                  <label key={d.id} className={styles.checkbox}>
                    <input type="checkbox" name="replaceDocumentId" value={d.id} /> {documentTypeLabel(d.documentType)}: {d.fileName}
                  </label>
                ))}
              </fieldset>
            </ActionForm>
          </>
        )}

        {status === "APPROVED" && (
          <>
            <h3 className={styles.subTitle}>Remove verification</h3>
            <p className={styles.sectionHint}>
              For example, if their licence expires. Their listings are hidden straight away until they submit again and you approve
              them.
            </p>
            <ActionForm action={revokeVerificationAction.bind(null, host.id)} submitLabel="Remove verification" pendingLabel="Removing..." variant="danger">
              <label className={styles.label}>
                Reason (the host will see this)
                <textarea className={styles.textarea} name="reason" required minLength={10} maxLength={1000} rows={2} />
              </label>
            </ActionForm>
          </>
        )}

        {status !== "UNDER_REVIEW" && host.verificationDocuments.length > 0 && (
          <p style={{ marginTop: 16 }}>
            <ConfirmButton
              action={deleteDocumentsAction.bind(null, host.id)}
              label="Delete all of this host's documents"
              variant="linkDanger"
              confirm="Permanently delete every document this host uploaded?"
            />
          </p>
        )}
      </section>

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
