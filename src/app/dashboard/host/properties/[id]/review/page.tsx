import { submissionProblems } from "@/server/services/property-service";
import { ConfirmButton } from "../../../../_components/confirm-button";
import { ChangeRequestSummary, PropertySummary } from "../../../../_components/property-summary";
import {
  deletePropertyAction,
  discardChangesAction,
  submitForReviewAction,
  withdrawFromReviewAction,
} from "../../actions";
import { loadHostProperty } from "../load";
import styles from "../../../../ui.module.css";

export default async function ReviewStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { property, isLive } = await loadHostProperty(id);
  const canSubmit = property.status === "DRAFT" || property.status === "REJECTED";
  const problems = submissionProblems(property);

  return (
    <>
      {canSubmit && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Submit for review</h2>
          <p className={styles.sectionHint}>
            Our team checks every new listing before it goes live, usually within 1–2 working days. You can&rsquo;t
            edit it while it&rsquo;s being reviewed.
          </p>
          {problems.length > 0 ? (
            <>
              <p style={{ marginBottom: 8 }}>Before you can submit:</p>
              <ul className={styles.checklist}>
                {problems.map((p) => (
                  <li key={p} className={styles.checkMissing}>
                    {p}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className={styles.checklist}>
              <li className={styles.checkOk}>Everything required is filled in.</li>
            </ul>
          )}
          <div className={styles.buttonRow}>
            {problems.length === 0 && (
              <ConfirmButton
                action={submitForReviewAction.bind(null, property.id)}
                label={property.status === "REJECTED" ? "Resubmit for review" : "Submit for review"}
                pendingLabel="Submitting..."
                variant="button"
              />
            )}
            <ConfirmButton
              action={deletePropertyAction.bind(null, property.id)}
              label="Delete this listing"
              variant="linkDanger"
              confirm="Permanently delete this listing and its photos?"
            />
          </div>
        </section>
      )}

      {property.status === "PENDING_APPROVAL" && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Waiting for review</h2>
          <p className={styles.sectionHint}>
            Need to change something first? Withdrawing puts the listing back into draft. You&rsquo;ll need to submit
            it again afterwards.
          </p>
          <ConfirmButton
            action={withdrawFromReviewAction.bind(null, property.id)}
            label="Withdraw from review"
            variant="buttonSecondary"
            confirm="Withdraw this listing from review?"
          />
        </section>
      )}

      {isLive && property.changesSubmittedAt && (
        <>
          <ChangeRequestSummary property={property} />
          <section className={styles.section}>
            <ConfirmButton
              action={discardChangesAction.bind(null, property.id)}
              label="Cancel these edits"
              variant="buttonSecondary"
              confirm="Throw away these edits and keep the live version?"
            />
          </section>
        </>
      )}

      <h2 className={styles.sectionTitle} style={{ margin: "8px 0 16px" }}>
        {isLive ? "What travelers see" : "Your listing"}
      </h2>
      <PropertySummary property={property} />
    </>
  );
}
