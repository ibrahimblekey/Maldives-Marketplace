import Link from "next/link";
import styles from "../public.module.css";

/**
 * Anti-scam notice (docs/decisions.md → "Anti-scam"). Guests pay at the
 * property, so any request for money before arrival is a red flag.
 */
export function DepositWarning({ reportHref }: { reportHref?: string }) {
  return (
    <div className={styles.safety} role="note">
      <strong>Stay safe:</strong> you pay the property only when you arrive. Never send a deposit or bank transfer before
      your stay, even if someone asks by message, WhatsApp or email.
      {reportHref && (
        <>
          {" "}
          If anyone asks,{" "}
          <Link href={reportHref} className={styles.link}>
            report this listing
          </Link>
          .
        </>
      )}
    </div>
  );
}
