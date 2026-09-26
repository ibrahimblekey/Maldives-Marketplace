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
        Add each kind of room you offer, how many of it you have, and its nightly price.{" "}
        {property.listingType === "TOURIST_PROPERTY"
          ? "Enter prices in US dollars, before service charge and taxes: the site adds them and shows guests the full breakdown."
          : "Private rental: enter your final price; no taxes are added."} Open a room type to add
        seasonal prices (e.g. a higher price over New Year). Prices and room counts can be changed at any time, even
        after your listing is live.
      </p>

      {property.rooms.some((r) => r.needsPriceReview) && (
        <div className={styles.noticeWarn}>
          <p>
            <strong>Please check your prices.</strong> Room prices are now entered before service charge and taxes, and the
            site adds them for guests. Open each room marked &ldquo;check price&rdquo;, correct the price if it included taxes,
            and click Save.
          </p>
        </div>
      )}
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
                  <td>
                    {room.name}
                    {room.needsPriceReview && (
                      <>
                        {" "}
                        <span className={styles.badgePENDING_APPROVAL}>check price</span>
                      </>
                    )}
                  </td>
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
