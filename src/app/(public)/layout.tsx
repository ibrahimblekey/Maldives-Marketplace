import Link from "next/link";
import { auth } from "@/lib/auth";
import styles from "./public.module.css";

/** Shell for traveler-facing pages. Public: no sign-in needed to browse. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" className={styles.brand}>
            Maldives <span>Marketplace</span>
          </Link>
          <nav className={styles.nav}>
            <Link href="/search" className={styles.navLink}>
              All stays
            </Link>
            {session?.user ? (
              <Link href="/dashboard" className={styles.navButton}>
                My dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={styles.navLink}>
                  Sign in
                </Link>
                <Link href="/register" className={styles.navButton}>
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.container}>
          Guesthouses, hotels and villas across the Maldives, checked by our team before they go live.{" "}
          <Link href="/dashboard/become-host" className={styles.link}>
            List your property
          </Link>
        </div>
      </footer>
    </div>
  );
}
