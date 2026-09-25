/**
 * Pure stay-pricing and availability rules, shared by search results and
 * the property page (and, later, the booking flow — which must quote the
 * exact same numbers the traveler saw).
 *
 * Conventions (same as the database):
 * - Dates are calendar dates, handled as UTC midnight (`@db.Date` columns).
 * - A stay is [checkIn, checkOut): the check-out day is not a night.
 * - A seasonal price covers its start AND end date (both inclusive — that's
 *   what the host screen tells hosts).
 * - Money is summed in integer cents, never floats, and converted back to a
 *   2-decimal string for display.
 */

export const MAX_STAY_NIGHTS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Stay = { checkIn: Date; checkOut: Date; nights: number };

/** "2026-12-24" -> Date at UTC midnight, or null if not a real calendar date. */
export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in the Maldives, as UTC midnight. */
export function todayInMaldives(now = new Date()): Date {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Maldives" }).format(now);
  return new Date(`${iso}T00:00:00Z`);
}

export type StayParseResult = { stay: Stay | null; error: string | null };

/**
 * Validates check-in/check-out from a URL. Either both are given and valid,
 * or the search simply has no dates (error explains why, if any were given).
 */
export function parseStay(checkIn?: string, checkOut?: string, now = new Date()): StayParseResult {
  if (!checkIn && !checkOut) return { stay: null, error: null };
  const start = parseIsoDate(checkIn);
  const end = parseIsoDate(checkOut);
  if (!start || !end) return { stay: null, error: "Choose both a check-in and a check-out date." };
  if (start < todayInMaldives(now)) return { stay: null, error: "Check-in can't be in the past." };
  const nights = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  if (nights < 1) return { stay: null, error: "Check-out must be after check-in." };
  if (nights > MAX_STAY_NIGHTS) {
    return { stay: null, error: `Stays can be at most ${MAX_STAY_NIGHTS} nights.` };
  }
  return { stay: { checkIn: start, checkOut: end, nights }, error: null };
}

export function stayNights(stay: Stay): Date[] {
  return Array.from({ length: stay.nights }, (_, i) => new Date(stay.checkIn.getTime() + i * DAY_MS));
}

export function toCents(amount: { toString(): string }): number {
  const [whole, fraction = ""] = amount.toString().split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(Number(whole)) * 100 + Number((fraction + "00").slice(0, 2)));
}

export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export type PricedRoom = {
  basePrice: { toString(): string };
  minStayNights: number | null;
  maxStayNights: number | null;
  seasonalPrices: {
    name: string | null;
    startDate: Date;
    endDate: Date;
    pricePerNight: { toString(): string };
    minStayNights: number | null;
  }[];
};

export type StayQuote = {
  totalCents: number;
  /** Rounded down to whole cents; only for display ("about X per night"). */
  averageNightlyCents: number;
  nights: { date: Date; cents: number; season: string | null }[];
  /** Why this room type can't be booked for the stay, or null if it can. */
  stayRuleProblem: string | null;
};

/** Price of every night of a stay in one room, applying seasonal prices and stay-length rules. */
export function quoteStay(room: PricedRoom, stay: Stay): StayQuote {
  const base = toCents(room.basePrice);
  let minNights = room.minStayNights ?? 1;

  const nights = stayNights(stay).map((date) => {
    const season = room.seasonalPrices.find((s) => s.startDate <= date && date <= s.endDate);
    if (season?.minStayNights) minNights = Math.max(minNights, season.minStayNights);
    return {
      date,
      cents: season ? toCents(season.pricePerNight) : base,
      season: season ? (season.name ?? "Seasonal price") : null,
    };
  });
  const totalCents = nights.reduce((sum, n) => sum + n.cents, 0);

  let stayRuleProblem: string | null = null;
  if (stay.nights < minNights) stayRuleProblem = `Minimum stay is ${minNights} nights for these dates.`;
  else if (room.maxStayNights && stay.nights > room.maxStayNights) {
    stayRuleProblem = `Maximum stay is ${room.maxStayNights} nights.`;
  }

  return {
    totalCents,
    averageNightlyCents: Math.floor(totalCents / stay.nights),
    nights,
    stayRuleProblem,
  };
}
