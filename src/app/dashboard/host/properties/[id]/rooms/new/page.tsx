import Link from "next/link";
import { redirect } from "next/navigation";
import { getWizardOptions } from "@/server/services/property-service";
import { ActionForm } from "../../../../../_components/action-form";
import { createRoomAction } from "../../../actions";
import { RoomFields } from "../../../room-fields";
import { loadHostProperty } from "../../load";
import styles from "../../../../../ui.module.css";

export default async function NewRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ property, editable }, { amenities }] = await Promise.all([loadHostProperty(id), getWizardOptions()]);
  const roomsPath = `/dashboard/host/properties/${property.id}/rooms`;
  if (!editable) redirect(roomsPath);

  return (
    <section className={styles.section}>
      <Link href={roomsPath} className={styles.backLink}>
        ← Back to rooms
      </Link>
      <h2 className={styles.sectionTitle}>Add a room type</h2>
      <p className={styles.sectionHint}>You can add seasonal prices after saving.</p>
      <ActionForm action={createRoomAction.bind(null, property.id)} submitLabel="Add room type" pendingLabel="Adding...">
        <RoomFields amenities={amenities} />
      </ActionForm>
    </section>
  );
}
