"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { initialActionState, type ActionState } from "./action-state";
import styles from "../ui.module.css";

/**
 * A form wired to a server action, with the pending state, the action's
 * error/success message, and a submit button built in. The fields
 * themselves are passed as children, so pages stay server components.
 *
 * Submission goes through onSubmit rather than <form action> on purpose:
 * React resets a <form action> form after every submission, which would
 * wipe everything the host typed whenever the server rejects the input.
 * Browser-side `required`/`min`/`max` checks still run first either way.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving...",
  resetOnSuccess = false,
  variant = "primary",
  className,
  disabled = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  /** Read-only mode (e.g. a listing locked for review): the button is disabled. */
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && !state.error && state.message) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const buttonClass =
    variant === "danger" ? styles.buttonDanger : variant === "secondary" ? styles.buttonSecondary : styles.button;

  return (
    <form
      ref={formRef}
      className={className ?? styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {!state.error && state.message && (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      )}
      <div>
        <button className={buttonClass} type="submit" disabled={pending || disabled}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
