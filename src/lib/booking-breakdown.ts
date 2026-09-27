/**
 * The price lines of a saved booking, from the breakdown stored on it at
 * booking time (never recalculated). Shared by the booking pages and the
 * emails so they always say the same thing.
 */

type Amount = { toString(): string };

export type BookingPriceFields = {
  currency: string;
  subtotalAmount: Amount;
  serviceChargeAmount: Amount;
  serviceChargePercent: Amount | null;
  tgstAmount: Amount;
  tgstPercent: Amount | null;
  greenTaxAmount: Amount;
  greenTaxPerNight: Amount | null;
  greenTaxGuests: number;
  totalAmount: Amount;
  listingTypeSnapshot: "TOURIST_PROPERTY" | "PRIVATE_RENTAL" | null;
  checkInDate: Date;
  checkOutDate: Date;
};

const money = (amount: Amount, currency: string) =>
  `${currency} ${Number(amount.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: Amount) => `${Number(v.toString())}%`;

export function bookingPriceLines(b: BookingPriceFields): [label: string, value: string][] {
  const nights = Math.round((b.checkOutDate.getTime() - b.checkInDate.getTime()) / 86_400_000);
  if (!b.listingTypeSnapshot) {
    // Made before the breakdown existed: prices then included all taxes.
    return [["Total", `${money(b.totalAmount, b.currency)} (taxes included)`]];
  }
  if (b.listingTypeSnapshot === "PRIVATE_RENTAL") {
    return [["Total", `${money(b.totalAmount, b.currency)} (private rental, no taxes)`]];
  }
  const lines: [string, string][] = [["Room", money(b.subtotalAmount, b.currency)]];
  if (b.serviceChargePercent) lines.push([`Service charge ${pct(b.serviceChargePercent)}`, money(b.serviceChargeAmount, b.currency)]);
  if (b.tgstPercent) lines.push([`T-GST ${pct(b.tgstPercent)}`, money(b.tgstAmount, b.currency)]);
  if (b.greenTaxPerNight) {
    lines.push([
      `Green tax (${b.greenTaxGuests} visitor${b.greenTaxGuests === 1 ? "" : "s"} × ${nights} night${nights === 1 ? "" : "s"} × ${money(b.greenTaxPerNight, "USD")})`,
      money(b.greenTaxAmount, b.currency),
    ]);
  }
  lines.push(["Total", money(b.totalAmount, b.currency)]);
  return lines;
}

/** "4 (1 Maldivian/resident, 1 child under 2)" */
export function guestMixLabel(b: { numGuests: number; localGuests: number; infantGuests: number }) {
  const parts = [
    b.localGuests ? `${b.localGuests} Maldivian/resident` : "",
    b.infantGuests ? `${b.infantGuests} child${b.infantGuests === 1 ? "" : "ren"} under 2` : "",
  ].filter(Boolean);
  return parts.length ? `${b.numGuests} (${parts.join(", ")})` : String(b.numGuests);
}
