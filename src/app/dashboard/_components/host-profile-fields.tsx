import styles from "../ui.module.css";

/** Host details inputs, shared by "Become a host" and "Edit host details". */
export function HostProfileFields({
  initial,
  locked = false,
}: {
  initial?: { businessName: string; contactPhone: string; businessRegistrationNumber: string | null };
  /** Business name and phone can't change while verification is under review or approved. */
  locked?: boolean;
}) {
  return (
    <>
      {locked && (
        <>
          {/* Disabled inputs aren't submitted; send the unchanged values so the other fields can still be saved. */}
          <input type="hidden" name="businessName" value={initial?.businessName} />
          <input type="hidden" name="contactPhone" value={initial?.contactPhone} />
        </>
      )}
      <label className={styles.label}>
        Business or host name
        <span className={styles.help}>Shown to travelers, e.g. &ldquo;Sunset Guesthouse&rdquo; or your own name.</span>
        <input className={styles.input} name={locked ? undefined : "businessName"} required minLength={2} maxLength={120} disabled={locked} defaultValue={initial?.businessName} />
      </label>
      <label className={styles.label}>
        Contact phone
        <span className={styles.help}>Only used by our team to contact you. Include the country code.</span>
        <input className={styles.input} name={locked ? undefined : "contactPhone"} type="tel" required placeholder="+960 777 1234" disabled={locked} defaultValue={initial?.contactPhone} />
      </label>
      <label className={styles.label}>
        Business registration number (optional)
        <input className={styles.input} name="businessRegistrationNumber" maxLength={60} defaultValue={initial?.businessRegistrationNumber ?? ""} />
      </label>
    </>
  );
}
