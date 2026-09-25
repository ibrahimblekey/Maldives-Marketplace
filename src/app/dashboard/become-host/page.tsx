import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRoleOrRedirect } from "@/server/auth/page-guards";
import { getHostProfile } from "@/server/services/host-service";
import { ActionForm } from "../_components/action-form";
import { HostProfileFields } from "../_components/host-profile-fields";
import { becomeHostAction } from "./actions";
import styles from "../ui.module.css";

export default async function BecomeHostPage() {
  const session = await requireRoleOrRedirect(["TRAVELER", "HOST"], "/dashboard/become-host");
  if (await getHostProfile(session.user.id)) redirect("/dashboard/host");

  return (
    <div>
      <Link href="/dashboard" className={styles.backLink}>
        ← Back to dashboard
      </Link>
      <h1 className={styles.pageTitle}>Become a host</h1>
      <p className={styles.pageHint}>
        List your guesthouse, hotel or villa. Fill in a few details about you, then add your property. Our team
        reviews every listing before it goes live.
      </p>
      <section className={styles.section}>
        <ActionForm action={becomeHostAction} submitLabel="Continue as a host" pendingLabel="Setting up...">
          <HostProfileFields />
        </ActionForm>
      </section>
    </div>
  );
}
