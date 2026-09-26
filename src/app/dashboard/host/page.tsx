import Link from "next/link";
import { prisma } from "@/lib/db";
import { todayInMaldives } from "@/lib/stay-pricing";
import { requireHost } from "@/server/auth/page-guards";
import { getHostProfile } from "@/server/services/host-service";
import { listHostProperties } from "@/server/services/property-service";
import { ActionForm } from "../_components/action-form";
import { HostProfileFields } from "../_components/host-profile-fields";
import { StatusBadge } from "../_components/status-badge";
import { saveHostProfileAction } from "./actions";
import styles from "../ui.module.css";

/** Host home: host details + "My properties". Only the HOST role may reach this page. */
export default async function HostDashboardPage() {
  const session = await requireHost();
  const profile = await getHostProfile(session.user.id);

  if (!profile) {
    return (
      <div>
        <h1 className={styles.pageTitle}>Welcome, {session.user.name}</h1>
        <p className={styles.pageHint}>Before listing a property, tell us a little about you.</p>
        <section className={styles.section}>
          <ActionForm action={saveHostProfileAction} submitLabel="Save and continue">
            <HostProfileFields />
          </ActionForm>
        </section>
      </div>
    );
  }

  const today = todayInMaldives();
  const [properties, upcomingCount, dueCount] = await Promise.all([
    listHostProperties(session.user.id),
    prisma.booking.count({
      where: { property: { hostProfile: { userId: session.user.id } }, status: "CONFIRMED", checkOutDate: { gt: today } },
    }),
    prisma.commissionStatement.count({ where: { hostProfile: { userId: session.user.id }, status: "DUE" } }),
  ]);

  return (
    <div>
      <h1 className={styles.pageTitle}>Host dashboard</h1>
      <p className={styles.pageHint}>
        {profile.businessName} · {profile.contactPhone} ·{" "}
        <Link className={styles.link} href="/dashboard/host/profile">
          Edit host details
        </Link>
      </p>
      {profile.suspendedAt && (
        <div className={styles.noticeError}>
          <p>
            <strong>Your host account is suspended.</strong> Your listings are hidden from travelers and can&rsquo;t be booked,
            and you can&rsquo;t submit new listings. Existing bookings stay in place.
          </p>
          {profile.suspensionReason && <p>Reason: &ldquo;{profile.suspensionReason}&rdquo;</p>}
          <p>If you think this is a mistake, reply to the suspension email to contact our team.</p>
        </div>
      )}
      <div className={styles.buttonRow} style={{ marginBottom: 24 }}>
        <Link className={styles.button} href="/dashboard/host/bookings">
          Bookings{upcomingCount > 0 ? ` (${upcomingCount} upcoming)` : ""}
        </Link>
        <Link className={styles.buttonSecondary} href="/dashboard/host/statements">
          Commission statements{dueCount > 0 ? ` (${dueCount} to pay)` : ""}
        </Link>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>My properties ({properties.length})</h2>
          <Link className={styles.button} href="/dashboard/host/properties/new">
            + List a new property
          </Link>
        </div>
        {properties.length === 0 ? (
          <p className={styles.empty}>
            You haven&rsquo;t listed a property yet. Click &ldquo;List a new property&rdquo; to start. You can save
            and come back any time before submitting it for review.
          </p>
        ) : (
          <div className={styles.cardList}>
            {properties.map((p) => (
              <Link key={p.id} href={`/dashboard/host/properties/${p.id}`} className={styles.propertyCard}>
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- plain <img>: host-uploaded photos, no optimisation needed in the dashboard
                  <img className={styles.thumb} src={p.images[0].url} alt="" />
                ) : (
                  <span className={styles.thumb} />
                )}
                <span className={styles.propertyCardBody}>
                  <span className={styles.propertyCardTitle}>{p.name}</span>
                  <span className={styles.muted} style={{ display: "block", fontSize: "0.875rem", marginBottom: 6 }}>
                    {p.propertyType.name} · {p.island.name}, {p.island.atoll.name} · {p._count.rooms} room type
                    {p._count.rooms === 1 ? "" : "s"}
                  </span>
                  <StatusBadge status={p.status} hasPendingChanges={p.changesSubmittedAt !== null} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
