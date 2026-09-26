import { CURRENCIES, MEAL_PLANS, MEAL_PLAN_LABELS } from "@/lib/validation/property";
import styles from "../../ui.module.css";

type RoomInitial = {
  name: string;
  description: string | null;
  maxOccupancy: number;
  bedConfiguration: string | null;
  sizeSqm: number | null;
  mealPlan: string;
  basePrice: string;
  currency: string;
  minStayNights: number | null;
  maxStayNights: number | null;
  extraGuestFee: string | null;
  extraBedFee: string | null;
  unitCount: number;
  amenityIds: string[];
};

/** Room type fields, shared by "Add room type" and "Edit room type". */
export function RoomFields({
  amenities,
  initial,
}: {
  amenities: { id: string; name: string }[];
  initial?: RoomInitial;
}) {
  const selected = new Set(initial?.amenityIds ?? []);
  return (
    <>
      <label className={styles.label}>
        Room type name
        <span className={styles.help}>e.g. &ldquo;Deluxe Double Room&rdquo; or &ldquo;Beach Villa&rdquo;</span>
        <input className={styles.input} name="name" required minLength={2} maxLength={100} defaultValue={initial?.name} />
      </label>

      <label className={styles.label}>
        Number of rooms of this type
        <span className={styles.help}>
          How many identical rooms you have, e.g. 4 if you have four Deluxe Doubles. Each one can be booked separately.
        </span>
        <input className={styles.input} name="unitCount" type="number" required min={1} max={500} step={1} defaultValue={initial?.unitCount ?? 1} />
      </label>

      <div className={styles.row}>
        <label className={styles.label}>
          Price per night
          <span className={styles.help}>Your full price, including TGST, Green Tax and any service charge. Guests pay exactly this amount.</span>
          <input className={styles.input} name="basePrice" type="number" required min={0.01} step={0.01} inputMode="decimal" defaultValue={initial?.basePrice} placeholder="e.g. 85" />
        </label>
        <label className={styles.label}>
          Currency
          <select className={styles.select} name="currency" required defaultValue={initial?.currency ?? "USD"}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Maximum guests
          <input className={styles.input} name="maxOccupancy" type="number" required min={1} max={50} step={1} defaultValue={initial?.maxOccupancy ?? 2} />
        </label>
        <label className={styles.label}>
          Meal plan
          <select className={styles.select} name="mealPlan" required defaultValue={initial?.mealPlan ?? "BREAKFAST"}>
            {MEAL_PLANS.map((m) => (
              <option key={m} value={m}>
                {MEAL_PLAN_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Beds (optional)
          <input className={styles.input} name="bedConfiguration" maxLength={100} defaultValue={initial?.bedConfiguration ?? ""} placeholder="e.g. 1 king bed" />
        </label>
        <label className={styles.label}>
          Size in m² (optional)
          <input className={styles.input} name="sizeSqm" type="number" min={1} max={10000} step={1} defaultValue={initial?.sizeSqm ?? ""} />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Minimum nights (optional)
          <input className={styles.input} name="minStayNights" type="number" min={1} max={365} step={1} defaultValue={initial?.minStayNights ?? ""} />
        </label>
        <label className={styles.label}>
          Maximum nights (optional)
          <input className={styles.input} name="maxStayNights" type="number" min={1} max={365} step={1} defaultValue={initial?.maxStayNights ?? ""} />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          Extra guest fee per night (optional)
          <input className={styles.input} name="extraGuestFee" type="number" min={0} step={0.01} inputMode="decimal" defaultValue={initial?.extraGuestFee ?? ""} />
        </label>
        <label className={styles.label}>
          Extra bed fee per night (optional)
          <input className={styles.input} name="extraBedFee" type="number" min={0} step={0.01} inputMode="decimal" defaultValue={initial?.extraBedFee ?? ""} />
        </label>
      </div>

      <label className={styles.label}>
        Description (optional)
        <textarea className={styles.textarea} name="description" maxLength={2000} rows={4} defaultValue={initial?.description ?? ""} placeholder="View, bathroom, balcony..." />
      </label>

      {amenities.length > 0 && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>In-room amenities (optional)</legend>
          <div className={styles.checkboxGrid}>
            {amenities.map((a) => (
              <label key={a.id} className={styles.checkbox}>
                <input type="checkbox" name="amenityIds" value={a.id} defaultChecked={selected.has(a.id)} />
                {a.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
