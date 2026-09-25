import Link from "next/link";
import { requireHost } from "@/server/auth/page-guards";
import { getHostProfile } from "@/server/services/host-service";
import { ActionForm } from "../../_components/action-form";
import { HostProfileFields } from "../../_components/host-profile-fields";
import { saveHostProfileAction } from "../actions";
import styles from "../../ui.module.css";

export default async function HostProfilePage() {
  const session = await requireHost("/dashboard/host/profile");
  const profile = await getHostProfile(session.user.id);

  return (
    <div>
      <Link href="/dashboard/host" className={styles.backLink}>
        ← Back to host dashboard
      </Link>
      <h1 className={styles.pageTitle}>Host details</h1>
      <p className={styles.pageHint}>How travelers and our team know you.</p>
      <section className={styles.section}>
        <ActionForm action={saveHostProfileAction} submitLabel="Save details">
          <HostProfileFields initial={profile ?? undefined} />
        </ActionForm>
      </section>
    </div>
  );
}
