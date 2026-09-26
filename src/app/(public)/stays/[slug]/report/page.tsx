import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hostInGoodStanding } from "@/server/services/booking-service";
import { REPORT_REASON_LABELS } from "@/server/services/moderation-service";
import { ActionForm } from "@/app/dashboard/_components/action-form";
import { reportListingAction } from "./actions";
import styles from "../../../public.module.css";

export const metadata: Metadata = { title: "Report a listing · Maldives Marketplace", robots: { index: false } };

export default async function ReportListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [property, session] = await Promise.all([
    prisma.property.findFirst({
      where: { slug, status: "APPROVED", hostProfile: hostInGoodStanding() },
      select: { name: true, slug: true },
    }),
    auth(),
  ]);
  if (!property) notFound();

  return (
    <div className={styles.container} style={{ maxWidth: 720 }}>
      <p className={styles.breadcrumbs}>
        <Link href={`/stays/${property.slug}`}>← Back to {property.name}</Link>
      </p>
      <h1 className={styles.propertyTitle}>Report this listing</h1>
      <p className={styles.muted} style={{ margin: "8px 0 20px" }}>
        Something wrong with &ldquo;{property.name}&rdquo;? Tell our team. Reports are confidential: the host doesn&rsquo;t see
        who sent them.
      </p>
      <section className={styles.panel}>
        <ActionForm action={reportListingAction.bind(null, property.slug)} submitLabel="Send report" pendingLabel="Sending..." resetOnSuccess>
          <fieldset style={{ border: "none" }}>
            <legend className={styles.filterTitle}>What&rsquo;s wrong?</legend>
            {Object.entries(REPORT_REASON_LABELS).map(([value, label], i) => (
              <label key={value} className={styles.radio}>
                <input type="radio" name="reason" value={value} required defaultChecked={i === 0} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className={styles.field}>
            Details
            <textarea
              name="details"
              className={styles.input}
              rows={5}
              required
              minLength={15}
              maxLength={3000}
              placeholder="What happened? For a payment request, tell us how you were contacted (WhatsApp, email…) and what was asked."
            />
          </label>
          {!session?.user && (
            <label className={styles.field}>
              Your email (optional, so we can follow up)
              <input name="email" type="email" className={styles.input} maxLength={200} />
            </label>
          )}
        </ActionForm>
      </section>
    </div>
  );
}
