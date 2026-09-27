import type { BookingStatus } from "@prisma/client";
import { MEAL_PLAN_LABELS } from "@/lib/validation/property";
import { bookingPriceLines, guestMixLabel } from "@/lib/booking-breakdown";
import type { BookingDetail } from "@/server/services/booking-service";
import { freeCancellationUntil } from "@/server/services/booking-service";
import { formatDate, formatDateTime, formatMoney } from "./format";
import styles from "../ui.module.css";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  PAYMENT_PENDING: "Awaiting payment",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Stayed",
  NO_SHOW: "No-show",
};

const BADGE: Record<BookingStatus, string> = {
  PENDING: "badgePENDING_APPROVAL",
  PAYMENT_PENDING: "badgePENDING_APPROVAL",
  CONFIRMED: "badgeAPPROVED",
  CANCELLED: "badgeREJECTED",
  COMPLETED: "badgeChanges",
  NO_SHOW: "badgeSUSPENDED",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <span className={styles[BADGE[status]]}>{BOOKING_STATUS_LABELS[status]}</span>;
}

/**
 * Full booking details. `audience` decides what's shown: the guest sees
 * the host's contact details; the host and admin see the guest's, plus the
 * commission split.
 */
function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{label === "Total" ? <strong>{value}</strong> : value}</dd>
    </>
  );
}

export function BookingDetails({ booking, audience }: { booking: BookingDetail; audience: "guest" | "host" | "admin" }) {
  const policy = booking.property.cancellationPolicy;
  const freeUntil = freeCancellationUntil(booking.checkInDate, policy?.freeCancellationDays);
  const nights = Math.round((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / 86_400_000);
  const leadGuest = booking.guests[0]?.fullName ?? booking.guest.name;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          {booking.property.name} · {booking.bookingReference}
        </h2>
        <BookingStatusBadge status={booking.status} />
      </div>
      <dl className={styles.summaryGrid} style={{ marginTop: 12 }}>
        <dt>Where</dt>
        <dd>
          {booking.property.island.name}, {booking.property.island.atoll.name}
          {booking.property.address ? ` · ${booking.property.address}` : ""}
        </dd>
        <dt>Room</dt>
        <dd>
          {booking.numRooms} × {booking.room.name} · {MEAL_PLAN_LABELS[booking.room.mealPlan]}
        </dd>
        <dt>Check-in</dt>
        <dd>
          {formatDate(booking.checkInDate)}
          {booking.property.checkInTime ? `, from ${booking.property.checkInTime}` : ""}
        </dd>
        <dt>Check-out</dt>
        <dd>
          {formatDate(booking.checkOutDate)}
          {booking.property.checkOutTime ? `, by ${booking.property.checkOutTime}` : ""} ({nights} night{nights === 1 ? "" : "s"})
        </dd>
        <dt>Guests</dt>
        <dd>
          {guestMixLabel(booking)} · lead guest {leadGuest}
        </dd>
        {bookingPriceLines(booking).map(([label, value]) => (
          <PriceRow key={label} label={label} value={value} />
        ))}
        <dt>Payment</dt>
        <dd>Paid to the property on arrival</dd>
        {audience !== "guest" && (
          <>
            <dt>Commission ({Number(booking.commissionRateSnapshot.toString())}% of room)</dt>
            <dd>
              {formatMoney(booking.commissionAmount, booking.currency)}
              {booking.status === "COMPLETED"
                ? booking.commissionStatement
                  ? ` · on the ${booking.commissionStatement.periodStart.toISOString().slice(0, 7)} statement`
                  : " · will be on the next monthly statement"
                : booking.status === "CONFIRMED"
                  ? " · billed after the stay"
                  : " · not charged"}
            </dd>
            <dt>Host keeps (room + service − commission)</dt>
            <dd>{formatMoney(booking.hostPayoutAmount, booking.currency)}</dd>
          </>
        )}
        {audience === "guest" ? (
          <>
            <dt>Host</dt>
            <dd>
              {booking.property.hostProfile.businessName} · {booking.property.hostProfile.contactPhone} ·{" "}
              {booking.property.hostProfile.user.email}
            </dd>
          </>
        ) : (
          <>
            <dt>Guest contact</dt>
            <dd>
              {booking.guest.name} · {booking.contactPhone ?? "—"} · {booking.guest.email}
            </dd>
          </>
        )}
        {booking.specialRequests && (
          <>
            <dt>Special requests</dt>
            <dd>{booking.specialRequests}</dd>
          </>
        )}
        <dt>Cancellation policy</dt>
        <dd>
          {!freeUntil
            ? "No free cancellation."
            : freeUntil > booking.createdAt
              ? `Free cancellation until ${formatDate(freeUntil)}; ${policy?.refundPercentageAfter ?? 0}% refund after that.`
              : `Booked after the free cancellation period ended (${policy?.freeCancellationDays} days before check-in); ${policy?.refundPercentageAfter ?? 0}% refund.`}
        </dd>
        <dt>Booked</dt>
        <dd>{formatDateTime(booking.createdAt)}</dd>
        {booking.status === "CANCELLED" && (
          <>
            <dt>Cancelled</dt>
            <dd>
              {formatDateTime(booking.cancelledAt)}
              {booking.cancellationReason ? ` · “${booking.cancellationReason}”` : ""}
              {booking.cancelledByUserId === booking.guestId ? " (by the guest)" : " (by the host)"}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
