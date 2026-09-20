"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "./actions";
import styles from "./locations.module.css";

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.linkDanger} type="submit" disabled={pending}>
      {pending ? "Deleting..." : "Confirm delete"}
    </button>
  );
}

/**
 * A delete button that asks for one explicit confirmation click before
 * actually submitting, and shows the service-layer error inline (e.g.
 * "still has islands under it") instead of a generic failed-request state.
 */
export function DeleteButton({
  action,
  itemId,
  itemLabel,
}: {
  action: (id: string, state: ActionState) => Promise<ActionState>;
  itemId: string;
  itemLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const boundAction = action.bind(null, itemId);
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prevState) => boundAction(prevState),
    { error: null }
  );

  if (!confirming) {
    return (
      <button
        type="button"
        className={styles.linkDanger}
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${itemLabel}`}
      >
        Delete
      </button>
    );
  }

  return (
    <form action={formAction} className={styles.rowActions}>
      <span className={styles.muted}>Delete {itemLabel}?</span>
      <ConfirmSubmit />
      <button type="button" className={styles.link} onClick={() => setConfirming(false)}>
        Cancel
      </button>
      {state.error && (
        <span className={styles.error} role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
