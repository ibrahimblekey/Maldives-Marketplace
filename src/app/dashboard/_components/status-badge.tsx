import type { PropertyStatus } from "@prisma/client";
import styles from "../ui.module.css";

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Waiting for review",
  APPROVED: "Live",
  REJECTED: "Changes needed",
  SUSPENDED: "Suspended",
};

export function StatusBadge({ status, hasPendingChanges }: { status: PropertyStatus; hasPendingChanges?: boolean }) {
  return (
    <span className={styles.rowActions}>
      <span className={styles[`badge${status}`]}>{STATUS_LABELS[status]}</span>
      {hasPendingChanges && <span className={styles.badgeChanges}>Edits waiting for review</span>}
    </span>
  );
}
