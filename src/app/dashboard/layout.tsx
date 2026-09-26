import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";
import styles from "./dashboard.module.css";

/**
 * Shared shell for all dashboard routes. This layout only confirms a
 * session exists (any signed-in user) — proxy.ts already redirects
 * logged-out visitors before this ever renders, but this server-side check
 * is the real guarantee, not the proxy redirect (see proxy.ts).
 *
 * Which role-specific area a page shows is decided by each page under
 * /dashboard/*, not here — this layout is intentionally role-agnostic.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          Maldives Marketplace
        </Link>
        <div className={styles.headerRight}>
          <span className={styles.userInfo}>
            {session.user.name} · <span className={styles.roleBadge}>{session.user.role}</span>
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
