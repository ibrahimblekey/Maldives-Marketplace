import styles from "../ui.module.css";

/** Host details inputs, shared by "Become a host" and "Edit host details". */
export function HostProfileFields({
  initial,
}: {
  initial?: { businessName: string; contactPhone: string; businessRegistrationNumber: string | null };
}) {
  return (
    <>
      <label className={styles.label}>
        Business or host name
        <span className={styles.help}>Shown to travelers, e.g. &ldquo;Sunset Guesthouse&rdquo; or your own name.</span>
        <input className={styles.input} name="businessName" required minLength={2} maxLength={120} defaultValue={initial?.businessName} />
      </label>
      <label className={styles.label}>
        Contact phone
        <span className={styles.help}>Only used by our team to contact you. Include the country code.</span>
        <input className={styles.input} name="contactPhone" type="tel" required placeholder="+960 777 1234" defaultValue={initial?.contactPhone} />
      </label>
      <label className={styles.label}>
        Business registration number (optional)
        <input className={styles.input} name="businessRegistrationNumber" maxLength={60} defaultValue={initial?.businessRegistrationNumber ?? ""} />
      </label>
    </>
  );
}
