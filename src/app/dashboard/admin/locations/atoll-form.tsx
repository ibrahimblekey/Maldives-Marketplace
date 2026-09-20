"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "./actions";
import styles from "./locations.module.css";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={styles.button} type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

type AtollFormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function AtollForm({
  action,
  initialValues,
  title,
  submitLabel,
  pendingLabel,
}: {
  action: AtollFormAction;
  initialValues?: { name: string; description: string | null };
  title: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null });

  return (
    <form className={styles.form} action={formAction}>
      <p className={styles.formTitle}>{title}</p>

      <label className={styles.label}>
        Atoll name
        <input
          className={styles.input}
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={100}
          defaultValue={initialValues?.name}
          placeholder="e.g. Kaafu Atoll"
        />
      </label>

      <label className={styles.label}>
        Description (optional)
        <textarea
          className={styles.textarea}
          name="description"
          maxLength={2000}
          defaultValue={initialValues?.description ?? ""}
          placeholder="Shown on the atoll's destination page later"
        />
      </label>

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}
