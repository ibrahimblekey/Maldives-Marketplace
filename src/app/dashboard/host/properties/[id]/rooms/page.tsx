import Link from "next/link";
import { MEAL_PLAN_LABELS } from "@/lib/validation/property";
import { formatMoney } from "../../../../_components/format";
import { loadHostProperty } from "../load";
import styles from "../../../../ui.module.css";

export default async function RoomsStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { property, editable } = await loadHostProperty(id);
  const base = `/dashboard/host/properties/${property.id}`;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Rooms &amp; prices</h2>
        {editable && (
          <Link className={styles.button} href={`${base}/rooms/new`}>
            + Add a room type
          </Link>
        )}
      </div>
      <p className={styles.sectionHint}>
        Add each kind of room you offer, how many of it you have, and its nightly price. Enter prices that already include
        TGST, Green Tax and any service charge: guests pay exactly the price shown. Open a room type to add
        seasonal prices (e.g. a higher price over New Year). Prices and room counts can be changed at any time, even
        after your listing is live.
      </p>

      {property.rooms.length === 0 ? (
        <p className={styles.empty}>No room types yet. Add at least one to continue.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Room type</th>
                <th>Rooms</th>
                <th>Guests</th>
                <th>Price / night</th>
                <th>Meals</th>
                <th>Seasons</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {property.rooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.name}</td>
                  <td>{room.inventoryUnits.length}</td>
                  <td>{room.maxOccupancy}</td>
                  <td>{formatMoney(room.basePrice, room.currency)}</td>
                  <td className={styles.muted}>{MEAL_PLAN_LABELS[room.mealPlan]}</td>
                  <td>{room.seasonalPrices.length}</td>
                  <td>
                    <Link className={styles.link} href={`${base}/rooms/${room.id}`}>
                      {editable ? "Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 20 }}>
        <Link className={styles.buttonSecondary} href={`${base}/amenities`}>
          Next: Amenities →
        </Link>
      </p>
    </section>
  );
}
