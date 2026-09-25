import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHost } from "@/server/auth/page-guards";
import { getHostProfile } from "@/server/services/host-service";
import { getWizardOptions } from "@/server/services/property-service";
import { ActionForm } from "../../../_components/action-form";
import { createPropertyAction } from "../actions";
import { BasicsFields } from "../basics-fields";
import styles from "../../../ui.module.css";

export default async function NewPropertyPage() {
  const session = await requireHost("/dashboard/host/properties/new");
  if (!(await getHostProfile(session.user.id))) redirect("/dashboard/host");

  const options = await getWizardOptions();
  const hasIslands = options.atolls.some((a) => a.islands.length > 0);

  return (
    <div>
      <Link href="/dashboard/host" className={styles.backLink}>
        ← Back to my properties
      </Link>
      <h1 className={styles.pageTitle}>List a new property</h1>
      <p className={styles.pageHint}>
        Step 1 of 6: the basics. Next you&rsquo;ll add rooms and prices, amenities, policies and photos. You can stop
        at any point and come back later.
      </p>
      <section className={styles.section}>
        {hasIslands && options.propertyTypes.length > 0 ? (
          <ActionForm action={createPropertyAction} submitLabel="Save and continue" pendingLabel="Creating...">
            <BasicsFields options={options} />
          </ActionForm>
        ) : (
          <p className={styles.empty}>
            Listings can&rsquo;t be created yet because no islands have been set up. Please contact support.
          </p>
        )}
      </section>
    </div>
  );
}
