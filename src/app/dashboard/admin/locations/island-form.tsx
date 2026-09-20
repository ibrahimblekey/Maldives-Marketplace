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

type IslandFormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function IslandForm({
  action,
  atolls,
  initialValues,
  title,
  submitLabel,
  pendingLabel,
}: {
  action: IslandFormAction;
  atolls: { id: string; name: string }[];
  initialValues?: {
    name: string;
    atollId: string;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  title: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { error: null });

  return (
    <form className={styles.form} action={formAction}>
      <p className={styles.formTitle}>{title}</p>

      <label className={styles.label}>
        Island name
        <input
          className={styles.input}
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={100}
          defaultValue={initialValues?.name}
          placeholder="e.g. Thulusdhoo"
        />
      </label>

      <label className={styles.label}>
        Atoll
        <select
          className={styles.select}
          name="atollId"
          required
          defaultValue={initialValues?.atollId ?? ""}
        >
          <option value="" disabled>
            Select an atoll
          </option>
          {atolls.map((atoll) => (
            <option key={atoll.id} value={atoll.id}>
              {atoll.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.row}>
        <label className={styles.label}>
          Latitude (optional)
          <input
            className={styles.input}
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            defaultValue={initialValues?.latitude ?? undefined}
            placeholder="e.g. 4.3781"
          />
        </label>
        <label className={styles.label}>
          Longitude (optional)
          <input
            className={styles.input}
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            defaultValue={initialValues?.longitude ?? undefined}
            placeholder="e.g. 73.4919"
          />
        </label>
      </div>

      <label className={styles.label}>
        Description (optional)
        <textarea
          className={styles.textarea}
          name="description"
          maxLength={2000}
          defaultValue={initialValues?.description ?? ""}
          placeholder="Shown on the island's destination page later"
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
