/** Display helpers shared by host and admin screens. Times shown in Maldives time. */

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Indian/Maldives",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export function formatDateTime(value: Date | null | undefined) {
  return value ? dateTime.format(value) : "—";
}

/** For @db.Date columns, which are stored as midnight UTC. */
export function formatDate(value: Date) {
  return dateOnly.format(value);
}

export function formatMoney(amount: { toString(): string } | null | undefined, currency: string) {
  if (amount === null || amount === undefined) return "—";
  return `${currency} ${Number(amount.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDistance(meters: number | null) {
  if (meters === null) return "—";
  return meters >= 1000 ? `${(meters / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} km` : `${meters} m`;
}
