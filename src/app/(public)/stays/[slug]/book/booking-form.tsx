"use client";

import { startTransition, useActionState, useState } from "react";
import { initialActionState, type ActionState } from "@/app/dashboard/_components/action-state";
import { priceBreakdown, type TaxRates } from "@/lib/stay-pricing";
import styles from "../../../public.module.css";

function money(cents: number, currency: string) {
  const amount = cents / 100;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const trimPct = (p: string) => String(Number(p));

/**
 * Booking details form with a live price breakdown. The breakdown uses the
 * same priceBreakdown() as the server, and the total shown is sent along so
 * the server can refuse the booking if its own calculation differs.
 */
export function BookingForm({
  action,
  perRoomCents,
  nights,
  currency,
  rates,
  roomsLeft,
  maxOccupancy,
  initialGuests,
  defaultName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  perRoomCents: number;
  nights: number;
  currency: string;
  rates: TaxRates;
  roomsLeft: number;
  maxOccupancy: number;
  initialGuests: number;
  defaultName: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const isPrivate = rates.listingType === "PRIVATE_RENTAL";
  const suggestedRooms = Math.min(roomsLeft, Math.max(1, Math.ceil(initialGuests / maxOccupancy)));
  const [rooms, setRooms] = useState(suggestedRooms);
  const [guests, setGuests] = useState(Math.min(initialGuests, maxOccupancy * suggestedRooms));
  const [locals, setLocals] = useState(0);
  const [infants, setInfants] = useState(0);

  const mixValid = locals + infants <= guests;
  const price = priceBreakdown(perRoomCents, rooms, nights, rates, {
    guests,
    localGuests: isPrivate ? guests : locals,
    infantGuests: isPrivate ? 0 : infants,
  });
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  return (
    <form
      className={styles.bookForm}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <input type="hidden" name="expectedTotalCents" value={price.totalCents} />
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
            value={guests}
            onChange={(e) => setGuests(num(e.target.value))}
            required
          />
        </label>
      </div>
      <p className={styles.muted} style={{ fontSize: "0.875rem" }}>
        Each room sleeps up to {maxOccupancy}.
      </p>

      {isPrivate ? (
        <label className={styles.checkbox}>
          <input type="checkbox" name="localsOnly" required />
          All guests are Maldivian citizens or residents of the Maldives.
        </label>
      ) : (
        <div className={styles.bookRow}>
          <label className={styles.field}>
            Of these, Maldivians or residents
            <input type="number" name="localGuests" className={styles.input} min={0} max={guests} value={locals} onChange={(e) => setLocals(num(e.target.value))} />
          </label>
          <label className={styles.field}>
            Other guests under 2
            <input type="number" name="infantGuests" className={styles.input} min={0} max={guests} value={infants} onChange={(e) => setInfants(num(e.target.value))} />
          </label>
        </div>
      )}
      {!mixValid && !isPrivate && (
        <p className={styles.roomUnavailable}>Maldivians/residents plus children under 2 can&rsquo;t be more than your total guests.</p>
      )}

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

      <div className={styles.priceBreakdown} aria-live="polite">
        <div className={styles.breakdownRow}>
          <span>
            Room{rooms > 1 ? `s (${rooms})` : ""}, {nights} night{nights === 1 ? "" : "s"}
          </span>
          <span>{money(price.roomCents, currency)}</span>
        </div>
        {!isPrivate && (
          <>
            <div className={styles.breakdownRow}>
              <span>Service charge {trimPct(rates.serviceChargePercent)}%</span>
              <span>{money(price.serviceChargeCents, currency)}</span>
            </div>
            <div className={styles.breakdownRow}>
              <span>T-GST {trimPct(rates.tgstPercent)}%</span>
              <span>{money(price.tgstCents, currency)}</span>
            </div>
            <div className={styles.breakdownRow}>
              <span>
                Green tax {price.greenTaxGuests} × {nights} night{nights === 1 ? "" : "s"} × {money(Math.round(Number(rates.greenTaxPerNight) * 100), "USD")}
              </span>
              <span>{money(price.greenTaxCents, currency)}</span>
            </div>
          </>
        )}
        <div className={styles.bookTotal}>
          <span>Total to pay at the property</span>
          <strong>{money(price.totalCents, currency)}</strong>
        </div>
        <p className={styles.muted} style={{ fontSize: "0.8125rem" }}>
          {isPrivate
            ? "Private rental: the host's price is final, with no service charge or tourism taxes."
            : "Green tax applies to visitors aged 2 and over. Maldivians and residents don't pay it."}
        </p>
      </div>

      {state.error && (
        <p className={styles.roomUnavailable} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.searchButton} disabled={pending || !mixValid}>
        {pending ? "Confirming..." : "Confirm booking"}
      </button>
      <p className={styles.muted} style={{ fontSize: "0.8125rem", textAlign: "center" }}>
        Nothing is charged now. You pay the property directly when you arrive.
      </p>
    </form>
  );
}
