import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  requireRole,
  ForbiddenError,
  UnauthenticatedError,
} from "@/server/auth/authorize";
import { getAtoll, NotFoundError } from "@/server/services/location-service";
import { updateAtollAction } from "../../../actions";
import { AtollForm } from "../../../atoll-form";
import styles from "../../../locations.module.css";

export default async function EditAtollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await requireRole(["ADMIN", "SUPER_ADMIN"]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect(`/login?callbackUrl=/dashboard/admin/locations/atolls/${id}/edit`);
    }
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw err;
  }

  let atoll;
  try {
    atoll = await getAtoll(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const boundAction = updateAtollAction.bind(null, id);

  return (
    <div>
      <Link href="/dashboard/admin/locations" className={styles.backLink}>
        ← Back to locations
      </Link>
      <h1 className={styles.pageTitle}>Edit atoll</h1>
      <p className={styles.pageHint}>{atoll._count.islands} island(s) currently under this atoll.</p>

      <section className={styles.section}>
        <AtollForm
          action={boundAction}
          initialValues={{ name: atoll.name, description: atoll.description }}
          title={atoll.name}
          submitLabel="Save changes"
          pendingLabel="Saving..."
        />
      </section>
    </div>
  );
}
