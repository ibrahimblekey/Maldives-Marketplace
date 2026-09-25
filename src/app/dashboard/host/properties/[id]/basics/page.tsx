import { getWizardOptions } from "@/server/services/property-service";
import { ActionForm } from "../../../../_components/action-form";
import { saveBasicsAction } from "../../actions";
import { BasicsFields } from "../../basics-fields";
import { loadHostProperty } from "../load";
import styles from "../../../../ui.module.css";

export default async function BasicsStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ property, editable, isLive }, options] = await Promise.all([loadHostProperty(id), getWizardOptions()]);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Basics</h2>
      <p className={styles.sectionHint}>
        {isLive
          ? "Name and description changes go to our team for review before travelers see them. Distances save immediately."
          : "Name, type, location and description."}
      </p>
      {isLive && (property.pendingName || property.pendingDescription) && (
        <div className={styles.noticeWarn}>
          <p>
            You&rsquo;re editing a version that&rsquo;s waiting for review. Travelers currently see the name &ldquo;
            {property.name}&rdquo;{property.pendingDescription ? " and the previous description" : ""}.
          </p>
        </div>
      )}
      <ActionForm action={saveBasicsAction.bind(null, property.id)} submitLabel={isLive ? "Save" : "Save and continue"}>
        <input type="hidden" name="isLive" value={isLive ? "1" : "0"} />
        <fieldset className={styles.fieldset} disabled={!editable}>
          <BasicsFields
            options={options}
            locationLocked={isLive}
            initial={{
              name: property.pendingName ?? property.name,
              description: property.pendingDescription ?? property.description,
              propertyTypeId: property.propertyTypeId,
              islandId: property.islandId,
              address: property.address,
              distanceFromBeachMeters: property.distanceFromBeachMeters,
              distanceFromHarborMeters: property.distanceFromHarborMeters,
            }}
          />
        </fieldset>
      </ActionForm>
    </section>
  );
}
