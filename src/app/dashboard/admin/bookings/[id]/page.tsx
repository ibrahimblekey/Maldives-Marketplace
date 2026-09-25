import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/page-guards";
import { getBookingFor } from "@/server/services/booking-service";
import { NotFoundError } from "@/server/services/errors";
import { BookingDetails } from "../../../_components/booking-details";
import styles from "../../../ui.module.css";

export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin(`/dashboard/admin/bookings/${id}`);
  let booking;
  try {
    booking = await getBookingFor({ userId: session.user.id, role: session.user.role }, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  return (
    <div>
      <Link href="/dashboard/admin/bookings" className={styles.backLink}>
        ← Bookings
      </Link>
      <BookingDetails booking={booking} audience="admin" />
      <p className={styles.muted}>
        Host: {booking.property.hostProfile.businessName} · {booking.property.hostProfile.contactPhone} ·{" "}
        {booking.property.hostProfile.user.email}
      </p>
    </div>
  );
}
