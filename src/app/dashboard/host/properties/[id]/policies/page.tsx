import { ActionForm } from "../../../../_components/action-form";
import { savePoliciesAction } from "../../actions";
import { loadHostProperty } from "../load";
import styles from "../../../../ui.module.css";

export default async function PoliciesStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { property, editable, isLive } = await loadHostProperty(id);
  const policy = property.cancellationPolicy;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Policies</h2>
      <p className={styles.sectionHint}>Check-in times, cancellations and house rules. Shown to travelers before they book.</p>
      <ActionForm
        action={savePoliciesAction.bind(null, property.id)}
        submitLabel={isLive ? "Save" : "Save and continue"}
        disabled={!editable}
      >
        <input type="hidden" name="isLive" value={isLive ? "1" : "0"} />
        <fieldset className={styles.fieldset} disabled={!editable}>
          <div className={styles.row}>
            <label className={styles.label}>
              Check-in from
              <input className={styles.input} name="checkInTime" type="time" required defaultValue={property.checkInTime ?? "14:00"} />
            </label>
            <label className={styles.label}>
              Check-out by
              <input className={styles.input} name="checkOutTime" type="time" required defaultValue={property.checkOutTime ?? "12:00"} />
            </label>
          </div>

          <h3 className={styles.subTitle}>Cancellation</h3>
          <div className={styles.row}>
            <label className={styles.label}>
              Free cancellation up to (days before check-in)
              <span className={styles.help}>Leave empty if cancellations are never free.</span>
              <input className={styles.input} name="freeCancellationDays" type="number" min={0} max={365} step={1} defaultValue={policy?.freeCancellationDays ?? 7} />
            </label>
            <label className={styles.label}>
              Refund after that (%)
              <span className={styles.help}>0 means no refund once the free period has passed.</span>
              <input className={styles.input} name="refundPercentageAfter" type="number" min={0} max={100} step={1} defaultValue={policy?.refundPercentageAfter ?? 0} />
            </label>
          </div>
          <label className={styles.label}>
            Cancellation details (optional)
            <textarea className={styles.textarea} name="description" maxLength={3000} rows={3} defaultValue={policy?.description ?? ""} placeholder="Anything else guests should know, e.g. no-show rules" />
          </label>

          <h3 className={styles.subTitle}>House rules</h3>
          <label className={styles.checkbox}>
            <input type="checkbox" name="petsAllowed" defaultChecked={policy?.petsAllowed ?? false} />
            Pets allowed
          </label>
          <label className={styles.checkbox}>
            <input type="checkbox" name="smokingAllowed" defaultChecked={policy?.smokingAllowed ?? false} />
            Smoking allowed
          </label>
          <label className={styles.label}>
            Children (optional)
            <textarea className={styles.textarea} name="childrenPolicy" maxLength={1000} rows={2} defaultValue={policy?.childrenPolicy ?? ""} placeholder="e.g. Children of all ages welcome; under 2 stay free" />
          </label>
          <label className={styles.label}>
            Extra beds (optional)
            <textarea className={styles.textarea} name="extraBedPolicy" maxLength={1000} rows={2} defaultValue={policy?.extraBedPolicy ?? ""} placeholder="e.g. One extra bed available on request in Deluxe rooms" />
          </label>
        </fieldset>
      </ActionForm>
    </section>
  );
}
