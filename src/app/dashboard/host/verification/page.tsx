import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHost } from "@/server/auth/page-guards";
import { getWizardOptions } from "@/server/services/property-service";
import { getHostVerification, phoneConfirmed, verificationProblems } from "@/server/services/verification-service";
import { MAX_FILES_PER_DOCUMENT_TYPE, VERIFICATION_DOCUMENT_TYPES } from "@/lib/validation/verification";
import { ActionForm } from "../../_components/action-form";
import { ConfirmButton } from "../../_components/confirm-button";
import { formatDate, formatDateTime } from "../../_components/format";
import { DocumentUploader } from "./document-uploader";
import { removeDocumentAction, saveLicenceDetailsAction, submitVerificationAction, withdrawVerificationAction } from "./actions";
import styles from "../../ui.module.css";

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function HostVerificationPage() {
  const session = await requireHost("/dashboard/host/verification");
  const [host, { atolls }] = await Promise.all([getHostVerification(session.user.id), getWizardOptions()]);
  if (!host) redirect("/dashboard/host");

  const status = host.verificationStatus;
  const editable = status === "PENDING" || status === "REJECTED";
  const problems = verificationProblems(host);
  const phoneOk = phoneConfirmed(host);

  return (
    <div>
      <Link href="/dashboard/host" className={styles.backLink}>
        ← Back to host dashboard
      </Link>
      <h1 className={styles.pageTitle}>Verify your business</h1>
      <p className={styles.pageHint}>
        To keep travelers safe, only verified hosts&rsquo; listings are shown on the site. Send us your tourism licence and a
        few documents; our team checks them, calls you to confirm your phone number, and approves you, usually within 2
        working days.
      </p>

      {status === "PENDING" && (
        <div className={styles.noticeWarn}>
          <p>
            <strong>Not submitted yet.</strong> Your listings stay hidden from travelers until you&rsquo;re verified.
          </p>
        </div>
      )}
      {status === "UNDER_REVIEW" && (
        <div className={styles.notice}>
          <p>
            <strong>Waiting for review</strong> since {formatDateTime(host.verificationSubmittedAt)}. We&rsquo;ll call you on{" "}
            {host.contactPhone} and email you when it&rsquo;s done. Your documents are locked while we review them.
          </p>
          <p>
            <ConfirmButton
              action={withdrawVerificationAction}
              label="Withdraw to make changes"
              confirm="Withdraw? You'll need to submit again afterwards."
            />
          </p>
        </div>
      )}
      {status === "APPROVED" && (
        <div className={styles.noticeSuccess}>
          <p>
            <strong>You&rsquo;re a verified host</strong>
            {host.verifiedAt ? ` since ${formatDate(host.verifiedAt)}` : ""}. Your approved listings are visible to travelers with a
            &ldquo;Verified host&rdquo; badge. If your licence or business details change, contact support.
          </p>
        </div>
      )}
      {(status === "REJECTED" || status === "SUSPENDED") && (
        <div className={styles.noticeError}>
          <p>
            <strong>Changes needed.</strong> Your listings are hidden from travelers until you&rsquo;re verified. Our team&rsquo;s
            note:
          </p>
          <p>&ldquo;{host.verificationRejectionReason ?? "Please contact support."}&rdquo;</p>
          <p>Fix the details or upload new documents below, then submit again.</p>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Your tourism licence</h2>
        <p className={styles.sectionHint}>Copy these exactly as they&rsquo;re written on your Ministry of Tourism licence or permit.</p>
        <ActionForm action={saveLicenceDetailsAction} submitLabel="Save licence details" disabled={!editable}>
          <label className={styles.label}>
            Licence or permit number
            <input
              className={styles.input}
              name="licenceNumber"
              required
              minLength={3}
              maxLength={60}
              disabled={!editable}
              defaultValue={host.licenceNumber ?? ""}
              placeholder="e.g. 123-GH/2024"
            />
          </label>
          <label className={styles.label}>
            Business name on the licence
            <input
              className={styles.input}
              name="licenceBusinessName"
              required
              minLength={2}
              maxLength={160}
              disabled={!editable}
              defaultValue={host.licenceBusinessName ?? ""}
            />
          </label>
          <label className={styles.label}>
            Island on the licence
            <select className={styles.select} name="licenceIslandId" required disabled={!editable} defaultValue={host.licenceIslandId ?? ""}>
              <option value="" disabled>
                Select an island
              </option>
              {atolls
                .filter((a) => a.islands.length > 0)
                .map((atoll) => (
                  <optgroup key={atoll.id} label={atoll.name}>
                    {atoll.islands.map((island) => (
                      <option key={island.id} value={island.id}>
                        {island.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </label>
        </ActionForm>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Documents</h2>
        <p className={styles.sectionHint}>
          Upload a PDF or a clear photo of each document (up to {MAX_FILES_PER_DOCUMENT_TYPE} files each, e.g. front and back).
          Your documents are stored privately: only our verification team can open them, and they&rsquo;re never shown to
          travelers.
        </p>
        {VERIFICATION_DOCUMENT_TYPES.map((type) => {
          const files = host.verificationDocuments.filter((d) => d.documentType === type.key);
          return (
            <div key={type.key} className={styles.fieldset}>
              <h3 className={styles.subTitle}>
                {type.label} {files.length > 0 ? <span className={styles.checkOk} /> : null}
              </h3>
              <p className={styles.help} style={{ marginBottom: 8 }}>
                {type.help}
              </p>
              {files.length > 0 && (
                <ul className={styles.checklist}>
                  {files.map((f) => (
                    <li key={f.id} className={styles.checkOk}>
                      {f.fileName} <span className={styles.muted}>({fileSize(f.sizeBytes)})</span>{" "}
                      {editable && (
                        <ConfirmButton action={removeDocumentAction.bind(null, f.id)} label="Remove" variant="linkDanger" confirm="Remove this file?" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {files.length === 0 && !editable && (
                <p className={styles.muted} style={{ marginBottom: 8 }}>
                  {status === "APPROVED" ? "Checked and deleted after verification." : "Not uploaded."}
                </p>
              )}
              {editable && files.length < MAX_FILES_PER_DOCUMENT_TYPE && (
                <DocumentUploader documentType={type.key} remainingSlots={MAX_FILES_PER_DOCUMENT_TYPE - files.length} />
              )}
            </div>
          );
        })}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Phone number</h2>
        {phoneOk ? (
          <ul className={styles.checklist}>
            <li className={styles.checkOk}>
              {host.contactPhone} confirmed{host.phoneConfirmedAt ? ` on ${formatDate(host.phoneConfirmedAt)}` : ""}.
            </li>
          </ul>
        ) : (
          <p className={styles.sectionHint}>
            Our team will call you on <strong>{host.contactPhone}</strong> to confirm it&rsquo;s your number before approving you.
            {editable && (
              <>
                {" "}
                Wrong number?{" "}
                <Link className={styles.link} href="/dashboard/host/profile">
                  Change it in your host details
                </Link>
                .
              </>
            )}
          </p>
        )}
      </section>

      {editable && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Submit for verification</h2>
          {problems.length > 0 ? (
            <ul className={styles.checklist}>
              {problems.map((p) => (
                <li key={p} className={styles.checkMissing}>
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <ul className={styles.checklist}>
                <li className={styles.checkOk}>Everything required is filled in.</li>
              </ul>
              <ConfirmButton
                action={submitVerificationAction}
                label="Submit for verification"
                pendingLabel="Submitting..."
                variant="button"
                confirm="Submit your licence and documents to our team?"
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
