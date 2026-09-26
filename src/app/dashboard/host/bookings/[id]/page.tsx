import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/server/auth/page-guards";
import { AUTO_COMPLETE_AFTER_DAYS, getBookingFor } from "@/server/services/booking-service";
import { NotFoundError } from "@/server/services/errors";
import { todayInMaldives } from "@/lib/stay-pricing";
import { ActionForm } from "../../../_components/action-form";
import { BookingDetails } from "../../../_components/booking-details";
import { ConfirmButton } from "../../../_components/confirm-button";
import { hostCancelBookingAction, markStayOutcomeAction } from "../actions";
import styles from "../../../ui.module.css";

export default async function HostBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireHost(`/dashboard/host/bookings/${id}`);

  let booking;
  try {
    booking = await getBookingFor({ userId: session.user.id, role: session.user.role }, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  if (booking.property.hostProfile.userId !== session.user.id) notFound();

  const today = todayInMaldives();
  const upcoming = booking.status === "CONFIRMED" && booking.checkInDate > today;
  const outcomeDeadline = new Date(booking.checkOutDate.getTime() + AUTO_COMPLETE_AFTER_DAYS * 86_400_000);
  const canMark =
    !booking.commissionStatement &&
    booking.checkInDate <= today &&
    (booking.status === "CONFIRMED" || ((booking.status === "COMPLETED" || booking.status === "NO_SHOW") && today < outcomeDeadline));

  return (
    <div>
      <Link href="/dashboard/host/bookings" className={styles.backLink}>
        ← Bookings
      </Link>
      {booking.status === "CANCELLED" && (
        <div className={styles.noticeWarn} role="status">
          <p>
            <strong>This booking is cancelled.</strong> The room is bookable again for these dates.
          </p>
        </div>
      )}
      <BookingDetails booking={booking} audience="host" />

      {canMark && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Did the guest stay?</h2>
          <p className={styles.sectionHint}>
            Commission is only charged for stays. If you don&rsquo;t answer within {AUTO_COMPLETE_AFTER_DAYS} days of check-out,
            the stay is counted as completed. False no-shows are checked against guest reviews and can lead to removal.
          </p>
          <div className={styles.buttonRow}>
            {booking.status !== "COMPLETED" && (
              <ConfirmButton action={markStayOutcomeAction.bind(null, booking.id, "COMPLETED")} label="Guest stayed" variant="button" />
            )}
            {booking.status !== "NO_SHOW" && (
              <ConfirmButton
                action={markStayOutcomeAction.bind(null, booking.id, "NO_SHOW")}
                label="Guest didn't show up"
                variant="buttonSecondary"
                confirm="Mark as a no-show?"
              />
            )}
          </div>
        </section>
      )}

      {upcoming && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cancel this booking</h2>
          <p className={styles.sectionHint}>
            Only cancel if you really can&rsquo;t host the guest. They&rsquo;ll see your reason. Frequent cancellations can get a
            listing removed.
          </p>
          <ActionForm action={hostCancelBookingAction.bind(null, booking.id)} submitLabel="Cancel booking" pendingLabel="Cancelling..." variant="danger">
            <label className={styles.label}>
              Reason for the guest
              <textarea className={styles.textarea} name="reason" required minLength={10} maxLength={500} rows={3} />
            </label>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
