import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleOrRedirect } from "@/server/auth/page-guards";
import { getBookingFor } from "@/server/services/booking-service";
import { NotFoundError } from "@/server/services/errors";
import { todayInMaldives } from "@/lib/stay-pricing";
import { ActionForm } from "../../../_components/action-form";
import { BookingDetails } from "../../../_components/booking-details";
import { cancelTripAction } from "../../actions";
import styles from "../../../ui.module.css";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ booked?: string }>;
}) {
  const [{ id }, { booked }] = await Promise.all([params, searchParams]);
  const session = await requireRoleOrRedirect(["TRAVELER"], `/dashboard/traveler/trips/${id}`);

  let booking;
  try {
    booking = await getBookingFor({ userId: session.user.id, role: session.user.role }, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  // A traveler only ever sees their own trips here (getBookingFor also lets
  // a host see bookings at their property, but hosts aren't TRAVELERs).
  if (booking.guestId !== session.user.id) notFound();

  const canCancel = booking.status === "CONFIRMED" && booking.checkInDate > todayInMaldives();

  return (
    <div>
      <Link href="/dashboard/traveler" className={styles.backLink}>
        ← My trips
      </Link>
      {booked && booking.status === "CONFIRMED" && (
        <div className={styles.noticeSuccess} role="status">
          <p>
            <strong>You&rsquo;re booked!</strong> Your booking reference is <strong>{booking.bookingReference}</strong>.
            The property has your booking. Pay them directly when you arrive.
          </p>
        </div>
      )}
      {booking.status === "CANCELLED" && (
        <div className={styles.noticeWarn} role="status">
          <p>
            <strong>This booking is cancelled.</strong> Nothing more to do. The room has been released.
          </p>
        </div>
      )}
      <BookingDetails booking={booking} audience="guest" />
      {booking.status === "CONFIRMED" && (
        <div className={styles.noticeWarn} role="note">
          <p>
            <strong>Stay safe:</strong> you pay the property only when you arrive. Never send a deposit or bank transfer before
            your stay, even if someone asks by message, WhatsApp or email. If anyone does,{" "}
            <Link className={styles.link} href={`/stays/${booking.property.slug}/report`}>
              report the listing
            </Link>
            .
          </p>
        </div>
      )}

      {canCancel && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cancel this booking</h2>
          <p className={styles.sectionHint}>Please cancel as early as possible so the host can offer the room to someone else.</p>
          <ActionForm action={cancelTripAction.bind(null, booking.id)} submitLabel="Cancel booking" pendingLabel="Cancelling..." variant="danger">
            <label className={styles.label}>
              Reason (optional)
              <input className={styles.input} name="reason" maxLength={500} />
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" name="confirm" required />
              Yes, cancel my booking
            </label>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
