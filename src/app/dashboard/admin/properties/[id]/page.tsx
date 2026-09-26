import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/page-guards";
import { NotFoundError } from "@/server/services/errors";
import { getPropertyForAdmin } from "@/server/services/property-review-service";
import { ActionForm } from "../../../_components/action-form";
import { ConfirmButton } from "../../../_components/confirm-button";
import { formatDateTime } from "../../../_components/format";
import { ChangeRequestSummary, PropertySummary } from "../../../_components/property-summary";
import { StatusBadge } from "../../../_components/status-badge";
import {
  approveChangesAction,
  approveListingAction,
  rejectChangesAction,
  rejectListingAction,
} from "../actions";
import styles from "../../../ui.module.css";

function ReasonField({ placeholder }: { placeholder: string }) {
  return (
    <label className={styles.label}>
      Reason (the host will see this)
      <textarea className={styles.textarea} name="reason" required minLength={10} maxLength={2000} rows={3} placeholder={placeholder} />
    </label>
  );
}

export default async function AdminPropertyReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/dashboard/admin/properties/${id}`);

  let property;
  try {
    property = await getPropertyForAdmin(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const host = property.hostProfile;
  const pendingNew = property.status === "PENDING_APPROVAL" && property.submittedAt;
  const pendingChanges = property.status === "APPROVED" && property.changesSubmittedAt;

  return (
    <div>
      <Link href="/dashboard/admin/properties" className={styles.backLink}>
        ← Back to listings
      </Link>
      <div className={styles.sectionHeader}>
        <h1 className={styles.pageTitle}>{property.name}</h1>
        <StatusBadge status={property.status} hasPendingChanges={property.changesSubmittedAt !== null} />
      </div>
      <p className={styles.pageHint}>
        Host:{" "}
        <Link className={styles.link} href={`/dashboard/admin/hosts/${property.hostProfileId}`}>
          {host.businessName}
        </Link>{" "}
        ({host.user.name}, {host.user.email}, {host.contactPhone}){host.suspendedAt ? " · SUSPENDED" : ""}
        {property.approvedAt && ` · First approved ${formatDateTime(property.approvedAt)}`}
      </p>

      {pendingNew && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Decision</h2>
          <p className={styles.sectionHint}>
            Submitted {formatDateTime(property.submittedAt)}. Check the listing below, then approve it or send it back
            with a reason.
          </p>
          <div className={styles.buttonRow} style={{ marginBottom: 20 }}>
            <ConfirmButton
              action={approveListingAction.bind(null, property.id, pendingNew.toISOString())}
              label="Approve and publish"
              pendingLabel="Approving..."
              variant="button"
              confirm="Publish this listing?"
            />
          </div>
          <ActionForm
            action={rejectListingAction.bind(null, property.id, pendingNew.toISOString())}
            submitLabel="Reject with reason"
            pendingLabel="Rejecting..."
            variant="danger"
          >
            <ReasonField placeholder="e.g. Please add photos of the bathrooms and check the price for the Family Room." />
          </ActionForm>
        </section>
      )}

      {pendingChanges && (
        <>
          <ChangeRequestSummary property={property} />
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Decision on these edits</h2>
            <p className={styles.sectionHint}>
              Approving replaces the live name/description/photos with the proposed ones. Rejecting keeps the live
              listing exactly as it is.
            </p>
            <div className={styles.buttonRow} style={{ marginBottom: 20 }}>
              <ConfirmButton
                action={approveChangesAction.bind(null, property.id, pendingChanges.toISOString())}
                label="Approve edits"
                pendingLabel="Approving..."
                variant="button"
                confirm="Apply these edits to the live listing?"
              />
            </div>
            <ActionForm
              action={rejectChangesAction.bind(null, property.id, pendingChanges.toISOString())}
              submitLabel="Reject edits with reason"
              pendingLabel="Rejecting..."
              variant="danger"
            >
              <ReasonField placeholder="e.g. The new photos are blurry. Please upload sharper ones." />
            </ActionForm>
          </section>
        </>
      )}

      {property.status === "REJECTED" && property.rejectionReason && (
        <div className={styles.noticeError}>
          <p>Rejected with reason: &ldquo;{property.rejectionReason}&rdquo;</p>
        </div>
      )}

      <h2 className={styles.sectionTitle} style={{ margin: "8px 0 16px" }}>
        {property.status === "APPROVED" ? "Live listing" : "Listing"}
      </h2>
      <PropertySummary property={property} />
    </div>
  );
}
