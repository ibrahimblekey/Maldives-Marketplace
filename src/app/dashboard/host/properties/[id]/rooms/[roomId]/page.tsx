import Link from "next/link";
import { notFound } from "next/navigation";
import { getWizardOptions } from "@/server/services/property-service";
import { ActionForm } from "../../../../../_components/action-form";
import { ConfirmButton } from "../../../../../_components/confirm-button";
import { formatDate, formatMoney } from "../../../../../_components/format";
import {
  addSeasonalPriceAction,
  deleteRoomAction,
  deleteSeasonalPriceAction,
  updateRoomAction,
} from "../../../actions";
import { RoomFields } from "../../../room-fields";
import { loadHostProperty } from "../../load";
import styles from "../../../../../ui.module.css";

export default async function EditRoomPage({ params }: { params: Promise<{ id: string; roomId: string }> }) {
  const { id, roomId } = await params;
  const [{ property, editable }, { amenities }] = await Promise.all([loadHostProperty(id), getWizardOptions()]);
  const room = property.rooms.find((r) => r.id === roomId);
  if (!room) notFound();
  const roomsPath = `/dashboard/host/properties/${property.id}/rooms`;

  return (
    <>
      <section className={styles.section}>
        <Link href={roomsPath} className={styles.backLink}>
          ← Back to rooms
        </Link>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{room.name}</h2>
          {editable && (
            <ConfirmButton
              action={deleteRoomAction.bind(null, property.id, room.id)}
              label="Delete room type"
              variant="linkDanger"
              confirm={`Delete "${room.name}" and its seasonal prices?`}
            />
          )}
        </div>
        <ActionForm action={updateRoomAction.bind(null, property.id, room.id)} submitLabel="Save room type" disabled={!editable}>
          <fieldset className={styles.fieldset} disabled={!editable}>
            <RoomFields
              amenities={amenities}
              initial={{
                name: room.name,
                description: room.description,
                maxOccupancy: room.maxOccupancy,
                bedConfiguration: room.bedConfiguration,
                sizeSqm: room.sizeSqm === null ? null : Math.round(room.sizeSqm),
                mealPlan: room.mealPlan,
                basePrice: room.basePrice.toString(),
                currency: room.currency,
                minStayNights: room.minStayNights,
                maxStayNights: room.maxStayNights,
                extraGuestFee: room.extraGuestFee?.toString() ?? null,
                extraBedFee: room.extraBedFee?.toString() ?? null,
                unitCount: room.inventoryUnits.length,
                amenityIds: room.amenities.map((a) => a.amenityId),
              }}
            />
          </fieldset>
        </ActionForm>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Seasonal prices</h2>
        <p className={styles.sectionHint}>
          A different nightly price for specific dates, in {room.currency}. Outside these dates the normal price of{" "}
          {formatMoney(room.basePrice, room.currency)} applies. Both dates are included.
        </p>
        {room.seasonalPrices.length === 0 ? (
          <p className={styles.empty}>No seasonal prices.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Season</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Price / night</th>
                  <th>Min. nights</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {room.seasonalPrices.map((sp) => (
                  <tr key={sp.id}>
                    <td>{sp.name ?? "—"}</td>
                    <td>{formatDate(sp.startDate)}</td>
                    <td>{formatDate(sp.endDate)}</td>
                    <td>{formatMoney(sp.pricePerNight, room.currency)}</td>
                    <td>{sp.minStayNights ?? "—"}</td>
                    <td>
                      {editable && (
                        <ConfirmButton
                          action={deleteSeasonalPriceAction.bind(null, property.id, room.id, sp.id)}
                          label="Delete"
                          variant="linkDanger"
                          confirm="Delete this season?"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editable && (
          <>
            <h3 className={styles.subTitle}>Add a seasonal price</h3>
            <ActionForm
              action={addSeasonalPriceAction.bind(null, property.id, room.id)}
              submitLabel="Add seasonal price"
              pendingLabel="Adding..."
              resetOnSuccess
            >
              <label className={styles.label}>
                Season name (optional)
                <input className={styles.input} name="name" maxLength={80} placeholder="e.g. Peak season" />
              </label>
              <div className={styles.row}>
                <label className={styles.label}>
                  From
                  <input className={styles.input} name="startDate" type="date" required />
                </label>
                <label className={styles.label}>
                  To
                  <input className={styles.input} name="endDate" type="date" required />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>
                  Price per night ({room.currency})
                  <input className={styles.input} name="pricePerNight" type="number" required min={0.01} step={0.01} inputMode="decimal" />
                </label>
                <label className={styles.label}>
                  Minimum nights (optional)
                  <input className={styles.input} name="minStayNights" type="number" min={1} max={365} step={1} />
                </label>
              </div>
            </ActionForm>
          </>
        )}
      </section>
    </>
  );
}
