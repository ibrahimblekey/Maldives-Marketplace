import { getWizardOptions } from "@/server/services/property-service";
import { ActionForm } from "../../../../_components/action-form";
import { saveAmenitiesAction } from "../../actions";
import { loadHostProperty } from "../load";
import styles from "../../../../ui.module.css";

export default async function AmenitiesStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ property, editable, isLive }, { amenities }] = await Promise.all([loadHostProperty(id), getWizardOptions()]);
  const selected = new Set(property.amenities.map((a) => a.amenityId));

  const byCategory = new Map<string, typeof amenities>();
  for (const amenity of amenities) {
    const key = amenity.category ?? "Other";
    byCategory.set(key, [...(byCategory.get(key) ?? []), amenity]);
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Amenities</h2>
      <p className={styles.sectionHint}>Tick everything guests can use at your property. Travelers filter search results by these.</p>
      <ActionForm
        action={saveAmenitiesAction.bind(null, property.id)}
        submitLabel={isLive ? "Save" : "Save and continue"}
        disabled={!editable}
      >
        <input type="hidden" name="isLive" value={isLive ? "1" : "0"} />
        <fieldset className={styles.fieldset} disabled={!editable}>
          {[...byCategory.entries()].map(([category, items]) => (
            <div key={category}>
              <h3 className={styles.subTitle}>{category}</h3>
              <div className={styles.checkboxGrid}>
                {items.map((a) => (
                  <label key={a.id} className={styles.checkbox}>
                    <input type="checkbox" name="amenityIds" value={a.id} defaultChecked={selected.has(a.id)} />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      </ActionForm>
    </section>
  );
}
