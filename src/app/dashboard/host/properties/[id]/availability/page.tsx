import Link from "next/link";
import { getAvailability, GRID_DAYS } from "@/server/services/availability-service";
import { parseIsoDate, toIsoDate, todayInMaldives } from "@/lib/stay-pricing";
import { ActionForm } from "../../../../_components/action-form";
import { ConfirmButton } from "../../../../_components/confirm-button";
import { formatDate } from "../../../../_components/format";
import { loadHostProperty } from "../load";
import { addBlockAction, removeBlockAction } from "./actions";
import styles from "../../../../ui.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", day: "numeric", timeZone: "UTC" });

export default async function AvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, { from: fromParam }] = await Promise.all([params, searchParams]);
  const { session, property } = await loadHostProperty(id);
  const today = todayInMaldives();
  const requested = parseIsoDate(fromParam);
  const from = requested && requested >= today ? requested : today;
  const { days, grid, blocks } = await getAvailability(session.user.id, property.id, from);
  const base = `/dashboard/host/properties/${property.id}/availability`;

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Rooms free per night</h2>
          <span className={styles.rowActions}>
            {from > today && (
              <Link className={styles.link} href={`${base}?from=${toIsoDate(new Date(Math.max(today.getTime(), from.getTime() - GRID_DAYS * DAY_MS)))}`}>
                ← Earlier
              </Link>
            )}
            <Link className={styles.link} href={`${base}?from=${toIsoDate(new Date(from.getTime() + GRID_DAYS * DAY_MS))}`}>
              Later →
            </Link>
          </span>
        </div>
        <p className={styles.sectionHint}>
          {formatDate(days[0])} to {formatDate(days[days.length - 1])}. Each number is how many rooms are still free that night.
          Grey = none free.
        </p>
        {grid.length === 0 ? (
          <p className={styles.empty}>Add a room type first.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.calendar}>
              <thead>
                <tr>
                  <th>Room type</th>
                  {days.map((d) => (
                    <th key={d.toISOString()}>{dayLabel.format(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((room) => (
                  <tr key={room.id}>
                    <td className={styles.calendarRoom}>
                      {room.name}
                      <div className={styles.muted}>{room.total} room{room.total === 1 ? "" : "s"}</div>
                    </td>
                    {room.days.map((d) => (
                      <td
                        key={d.date.toISOString()}
                        className={d.free === 0 ? styles.calendarFull : d.free < room.total ? styles.calendarPartial : styles.calendarFree}
                        title={`${formatDate(d.date)}: ${d.free} free, ${d.booked} booked, ${d.blocked} blocked`}
                      >
                        {d.free}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {grid.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Block dates</h2>
          <p className={styles.sectionHint}>
            Stop rooms from being booked for some nights, for example for maintenance or a booking you took elsewhere.
          </p>
          <ActionForm action={addBlockAction.bind(null, property.id)} submitLabel="Block these nights" pendingLabel="Blocking..." resetOnSuccess>
            <div className={styles.row}>
              <label className={styles.label}>
                Room type
                <select className={styles.select} name="roomId" required defaultValue={grid[0].id}>
                  {grid.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                How many rooms
                <input className={styles.input} type="number" name="count" min={1} max={500} defaultValue={1} required />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>
                First night
                <input className={styles.input} type="date" name="firstNight" min={toIsoDate(today)} required />
              </label>
              <label className={styles.label}>
                Last night
                <input className={styles.input} type="date" name="lastNight" min={toIsoDate(today)} required />
              </label>
            </div>
            <label className={styles.label}>
              Note for yourself (optional)
              <input className={styles.input} name="reason" maxLength={200} placeholder="e.g. repainting" />
            </label>
          </ActionForm>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Current blocks ({blocks.length})</h2>
        {blocks.length === 0 ? (
          <p className={styles.empty}>No blocked dates.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Room type</th>
                  <th>Nights</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.id}>
                    <td>{b.roomInventoryUnit.room.name} (1 room)</td>
                    <td>
                      {formatDate(b.startDate)} to {formatDate(new Date(b.endDate.getTime() - DAY_MS))}
                    </td>
                    <td className={styles.muted}>{b.reason ?? "—"}</td>
                    <td>
                      <ConfirmButton action={removeBlockAction.bind(null, property.id, b.id)} label="Unblock" variant="linkDanger" confirm="Make this room bookable again?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
