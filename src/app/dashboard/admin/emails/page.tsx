import Link from "next/link";
import { requireAdmin } from "@/server/auth/page-guards";
import { prisma } from "@/lib/db";
import { ActionForm } from "../../_components/action-form";
import { formatDateTime } from "../../_components/format";
import { sendTestEmailAction } from "./actions";
import styles from "../../ui.module.css";

const STATUS_CLASS = { SENT: "badgeAPPROVED", QUEUED: "badgePENDING_APPROVAL", SKIPPED: "badge", FAILED: "badgeREJECTED" } as const;

export default async function AdminEmailsPage() {
  await requireAdmin("/dashboard/admin/emails");
  const [emails, counts] = await Promise.all([
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.emailLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const configured = Boolean(process.env.RESEND_API_KEY?.trim());
  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const count = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Emails</h1>
      <p className={styles.pageHint}>
        Booking confirmations, host alerts, listing decisions, statements and daily reminders. {count("SENT")} sent,{" "}
        {count("FAILED")} failed, {count("SKIPPED")} not sent (email not set up).
      </p>

      <div className={configured ? styles.noticeSuccess : styles.noticeWarn}>
        <p>
          <strong>Sending:</strong>{" "}
          {configured
            ? `connected to Resend, sending as ${process.env.EMAIL_FROM?.trim() || "the Resend test address (only delivers to your Resend account's email until you verify a domain)"}.`
            : "not set up. Emails are recorded below but not sent. Add RESEND_API_KEY in Vercel."}
        </p>
        <p>
          <strong>Daily reminders:</strong>{" "}
          {cronConfigured ? "on (run every morning)." : "off. Add CRON_SECRET in Vercel to turn them on."}
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Test your email setup</h2>
        <p className={styles.sectionHint}>Sends a short test email to your own admin email address.</p>
        <ActionForm action={sendTestEmailAction} submitLabel="Send me a test email" pendingLabel="Sending..." />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent emails</h2>
        {emails.length === 0 ? (
          <p className={styles.empty}>No emails yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <td className={styles.muted}>{formatDateTime(e.createdAt)}</td>
                    <td>{e.toEmail}</td>
                    <td>
                      {e.subject}
                      {e.error && e.status === "FAILED" && <div className={styles.error}>{e.error}</div>}
                    </td>
                    <td>
                      <span className={styles[STATUS_CLASS[e.status]]}>{e.status === "SKIPPED" ? "Not sent" : e.status.toLowerCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
