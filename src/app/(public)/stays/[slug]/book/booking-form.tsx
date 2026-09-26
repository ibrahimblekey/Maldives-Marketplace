"use client";

import { startTransition, useActionState, useState } from "react";
import { initialActionState, type ActionState } from "@/app/dashboard/_components/action-state";
import styles from "../../../public.module.css";

function money(cents: number, currency: string) {
  const amount = cents / 100;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Booking details form; keeps the total in step with the number of rooms chosen. */
export function BookingForm({
  action,
  perRoomCents,
  currency,
  roomsLeft,
  maxOccupancy,
  initialGuests,
  defaultName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  perRoomCents: number;
  currency: string;
  roomsLeft: number;
  maxOccupancy: number;
  initialGuests: number;
  defaultName: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const suggestedRooms = Math.min(roomsLeft, Math.max(1, Math.ceil(initialGuests / maxOccupancy)));
  const [rooms, setRooms] = useState(suggestedRooms);

  return (
    <form
      className={styles.bookForm}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <div className={styles.bookRow}>
        <label className={styles.field}>
          Rooms
          <select name="numRooms" className={styles.select} value={rooms} onChange={(e) => setRooms(Number(e.target.value))}>
            {Array.from({ length: roomsLeft }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Guests
          <input
            type="number"
            name="numGuests"
            className={styles.input}
            min={1}
            max={maxOccupancy * rooms}
            defaultValue={Math.min(initialGuests, maxOccupancy * suggestedRooms)}
            required
          />
        </label>
      </div>
      <p className={styles.muted} style={{ fontSize: "0.875rem" }}>
        Each room sleeps up to {maxOccupancy}.
      </p>
      <label className={styles.field}>
        Lead guest&rsquo;s full name
        <input name="guestName" className={styles.input} required minLength={2} maxLength={120} defaultValue={defaultName} />
      </label>
      <label className={styles.field}>
        Phone (with country code)
        <input name="contactPhone" type="tel" className={styles.input} required placeholder="+44 7700 900123" />
      </label>
      <label className={styles.field}>
        Special requests (optional)
        <textarea name="specialRequests" className={styles.input} rows={3} maxLength={1000} placeholder="e.g. arrival by the 4pm speedboat, a cot for a baby" />
      </label>
      <label className={styles.checkbox}>
        <input type="checkbox" name="agree" required />
        I&rsquo;ve read the cancellation policy and house rules.
      </label>

      <div className={styles.bookTotal}>
        <span>
          Total to pay at the property
          <br />
          <span className={styles.muted} style={{ fontSize: "0.8125rem" }}>
            Includes all taxes and charges
          </span>
        </span>
        <strong>{money(perRoomCents * rooms, currency)}</strong>
      </div>

      {state.error && (
        <p className={styles.roomUnavailable} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.searchButton} disabled={pending}>
        {pending ? "Confirming..." : "Confirm booking"}
      </button>
      <p className={styles.muted} style={{ fontSize: "0.8125rem", textAlign: "center" }}>
        Nothing is charged now. You pay the property directly when you arrive.
      </p>
    </form>
  );
}
