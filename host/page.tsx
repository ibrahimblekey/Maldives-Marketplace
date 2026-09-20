import { redirect } from "next/navigation";
import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import styles from "../dashboard.module.css";

/** Protected host route — only the HOST role may reach this page. */
export default async function HostDashboardPage() {
  let session;
  try {
    session = await requireRole(["HOST"]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login?callbackUrl=/dashboard/host");
    }
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw err;
  }

  return (
    <div className={styles.card}>
      <h1>Host dashboard</h1>
      <p>Welcome, {session.user.name}.</p>
      <p>
        This is a placeholder for property and room management — built in a
        later milestone, after host onboarding/verification exists. What
        matters here is that only accounts with the HOST role can reach this
        page.
      </p>
    </div>
  );
}
