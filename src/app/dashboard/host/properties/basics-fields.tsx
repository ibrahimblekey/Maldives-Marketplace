import { MIN_DESCRIPTION_LENGTH } from "@/lib/validation/property";
import styles from "../../ui.module.css";

type Options = {
  propertyTypes: { id: string; name: string }[];
  atolls: { id: string; name: string; islands: { id: string; name: string }[] }[];
};

/**
 * Step 1 fields. With `locationLocked` (a live listing), property type,
 * island and address are shown but disabled — disabled inputs aren't
 * submitted, and the server ignores those fields for live listings anyway.
 */
export function BasicsFields({
  options,
  initial,
  locationLocked = false,
}: {
  options: Options;
  initial?: {
    name: string;
    description: string;
    propertyTypeId: string;
    islandId: string;
    address: string | null;
    distanceFromBeachMeters: number | null;
    distanceFromHarborMeters: number | null;
  };
  locationLocked?: boolean;
}) {
  return (
    <>
      <label className={styles.label}>
        Property name
        <input className={styles.input} name="name" required minLength={3} maxLength={120} defaultValue={initial?.name} placeholder="e.g. Coral View Guesthouse" />
      </label>

      <label className={styles.label}>
        Description
        <span className={styles.help}>
          What makes your place special: the rooms, the island, what guests can do. At least {MIN_DESCRIPTION_LENGTH} characters.
        </span>
        <textarea className={styles.textarea} name="description" required minLength={MIN_DESCRIPTION_LENGTH} maxLength={5000} rows={8} defaultValue={initial?.description} />
      </label>

      <div className={styles.row}>
        <label className={styles.label}>
          Property type
          <select className={styles.select} name="propertyTypeId" required disabled={locationLocked} defaultValue={initial?.propertyTypeId ?? ""}>
            <option value="" disabled>
              Select a type
            </option>
            {options.propertyTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Island
          <select className={styles.select} name="islandId" required disabled={locationLocked} defaultValue={initial?.islandId ?? ""}>
            <option value="" disabled>
              Select an island
            </option>
            {options.atolls
              .filter((a) => a.islands.length > 0)
              .map((atoll) => (
                <optgroup key={atoll.id} label={atoll.name}>
                  {atoll.islands.map((island) => (
                    <option key={island.id} value={island.id}>
                      {island.name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
      </div>

      <label className={styles.label}>
        Street address (optional)
        <input className={styles.input} name="address" maxLength={300} disabled={locationLocked} defaultValue={initial?.address ?? ""} placeholder="e.g. Majeedhee Magu, near the harbour" />
      </label>
      {locationLocked && (
        <p className={styles.help}>
          Property type, island and address can&rsquo;t be changed on a live listing. Contact support if they&rsquo;re
          wrong.
        </p>
      )}

      <div className={styles.row}>
        <label className={styles.label}>
          Walk to the beach (metres, optional)
          <input className={styles.input} name="distanceFromBeachMeters" type="number" min={0} max={100000} step={1} defaultValue={initial?.distanceFromBeachMeters ?? ""} />
        </label>
        <label className={styles.label}>
          Walk to the harbour/jetty (metres, optional)
          <input className={styles.input} name="distanceFromHarborMeters" type="number" min={0} max={100000} step={1} defaultValue={initial?.distanceFromHarborMeters ?? ""} />
        </label>
      </div>
    </>
  );
}
