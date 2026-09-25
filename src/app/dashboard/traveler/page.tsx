import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import styles from "../dashboard.module.css";

/**
 * Protected traveler route. This page is the real authorization check for
 * this route — proxy.ts only handles the "not logged in at all" case.
 * A HOST or ADMIN hitting this URL directly is redirected away here, not
 * just hidden from a nav menu.
 */
export default async function TravelerDashboardPage() {
  let session;
  try {
    session = await requireRole(["TRAVELER"]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login?callbackUrl=/dashboard/traveler");
    }
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw err;
  }

  return (
    <div className={styles.card}>
      <h1>Traveler dashboard</h1>
      <p>Welcome, {session.user.name}.</p>
      <p>
        This is a placeholder for booking history, favorites, and profile
        management — built in a later milestone. What matters here is that
        only accounts with the TRAVELER role can reach this page.
      </p>
      <p style={{ marginTop: 16 }}>
        <Link href="/dashboard/become-host" style={{ color: "#0e7c86", fontWeight: 600 }}>
          Own a guesthouse, hotel or villa? Become a host →
        </Link>
      </p>
    </div>
  );
}
