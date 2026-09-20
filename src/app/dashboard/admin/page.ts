import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import styles from "../dashboard.module.css";

/** Protected admin route — only ADMIN and SUPER_ADMIN may reach this page. */
export default async function AdminDashboardPage() {
  let session;
  try {
    session = await requireRole(["ADMIN", "SUPER_ADMIN"]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login?callbackUrl=/dashboard/admin");
    }
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw err;
  }

  return (
    <div className={styles.card}>
      <h1>Admin dashboard</h1>
      <p>
        Welcome, {session.user.name} ({session.user.role}).
      </p>
      <p>
        <Link href="/dashboard/admin/locations" style={{ color: "#0e7c86", fontWeight: 600 }}>
          Manage locations →
        </Link>
      </p>
      <p>
        User/host/property/booking management are placeholders for later
        milestones. What matters here is that only ADMIN and SUPER_ADMIN
        accounts can reach this page, and that no user can ever grant
        themselves this role through registration.
      </p>
    </div>
  );
}
