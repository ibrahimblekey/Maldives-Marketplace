"use client";

import { startTransition, useActionState, useState } from "react";
import { initialActionState, type ActionState } from "./action-state";
import styles from "../ui.module.css";

/**
 * A small button for a field-less server action (delete, withdraw, move a
 * photo…). With `confirm`, the first click asks for one explicit
 * confirmation before anything is sent. Errors show inline.
 */
export function ConfirmButton({
  action,
  label,
  pendingLabel = "Working...",
  confirm,
  variant = "link",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  variant?: "link" | "linkDanger" | "button" | "buttonSecondary" | "buttonDanger";
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  const run = () => {
    setConfirming(false);
    startTransition(() => formAction(new FormData()));
  };

  return (
    <span className={styles.inlineAction}>
      {confirming ? (
        <>
          <span className={styles.muted}>{confirm}</span>
          <button type="button" className={styles.linkDanger} onClick={run}>
            Yes, continue
          </button>
          <button type="button" className={styles.link} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className={styles[variant]}
          disabled={pending}
          onClick={() => (confirm ? setConfirming(true) : run())}
        >
          {pending ? pendingLabel : label}
        </button>
      )}
      {state.error && (
        <span className={styles.error} role="alert">
          {state.error}
        </span>
      )}
    </span>
  );
}
