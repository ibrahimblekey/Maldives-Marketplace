import Link from "next/link";
import { StatusBadge } from "../../../_components/status-badge";
import { formatDateTime } from "../../../_components/format";
import { loadHostProperty } from "./load";
import { StepNav } from "./step-nav";
import styles from "../../../ui.module.css";

export default async function PropertyWizardLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const { property, isLive } = await loadHostProperty(id);

  return (
    <div>
      <Link href="/dashboard/host" className={styles.backLink}>
        ← Back to my properties
      </Link>
      <div className={styles.sectionHeader}>
        <h1 className={styles.pageTitle}>{property.name}</h1>
        <StatusBadge status={property.status} hasPendingChanges={property.changesSubmittedAt !== null} />
      </div>

      <StepNav propertyId={property.id} isLive={isLive} />

      {property.status === "DRAFT" && (
        <div className={styles.notice}>
          <p>
            <strong>Draft</strong>: travelers can&rsquo;t see this listing yet. Work through the steps above in any
            order. Everything is saved as you go. When you&rsquo;re ready, submit it on the last step.
          </p>
        </div>
      )}
      {property.status === "PENDING_APPROVAL" && (
        <div className={styles.noticeWarn}>
          <p>
            <strong>Waiting for review</strong> since {formatDateTime(property.submittedAt)}. Editing is locked while
            our team reviews it. You&rsquo;ll see the result here. Need to change something? Withdraw it on the{" "}
            <Link className={styles.link} href={`/dashboard/host/properties/${property.id}/review`}>
              last step
            </Link>
            .
          </p>
        </div>
      )}
      {property.status === "REJECTED" && (
        <div className={styles.noticeError}>
          <p>
            <strong>Changes needed.</strong> Our team reviewed this listing and asked for the following:
          </p>
          <p>&ldquo;{property.rejectionReason}&rdquo;</p>
          <p>Make the changes, then submit it again on the last step.</p>
        </div>
      )}
      {property.status === "SUSPENDED" && (
        <div className={styles.noticeError}>
          <p>
            <strong>Suspended.</strong> This listing has been taken down by our team. Contact support.
          </p>
        </div>
      )}
      {isLive && (
        <div className={styles.noticeSuccess}>
          <p>
            <strong>Live.</strong> Changes to prices, room counts, amenities and policies take effect immediately.
            Changes to the <strong>name, description or photos</strong> are checked by our team first. Travelers keep
            seeing the current version until they&rsquo;re approved.
          </p>
        </div>
      )}
      {isLive && property.changesSubmittedAt && (
        <div className={styles.noticeWarn}>
          <p>
            <strong>Edits waiting for review</strong> (last change {formatDateTime(property.changesSubmittedAt)}). See
            them, or cancel them, on the{" "}
            <Link className={styles.link} href={`/dashboard/host/properties/${property.id}/review`}>
              Overview
            </Link>{" "}
            step.
          </p>
        </div>
      )}
      {isLive && !property.changesSubmittedAt && property.changesRejectionReason && (
        <div className={styles.noticeError}>
          <p>
            <strong>Your last edits weren&rsquo;t approved</strong>, so the listing was left as it was. Reason:
          </p>
          <p>&ldquo;{property.changesRejectionReason}&rdquo;</p>
        </div>
      )}

      {children}
    </div>
  );
}
