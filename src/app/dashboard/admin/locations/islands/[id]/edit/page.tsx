import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  requireRole,
  ForbiddenError,
  UnauthenticatedError,
} from "@/server/auth/authorize";
import { getIsland, listAtolls, NotFoundError } from "@/server/services/location-service";
import { updateIslandAction } from "../../../actions";
import { IslandForm } from "../../../island-form";
import styles from "../../../locations.module.css";

export default async function EditIslandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await requireRole(["ADMIN", "SUPER_ADMIN"]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect(`/login?callbackUrl=/dashboard/admin/locations/islands/${id}/edit`);
    }
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw err;
  }

  let island;
  try {
    island = await getIsland(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const atolls = await listAtolls();
  const boundAction = updateIslandAction.bind(null, id);

  return (
    <div>
      <Link href="/dashboard/admin/locations" className={styles.backLink}>
        ← Back to locations
      </Link>
      <h1 className={styles.pageTitle}>Edit island</h1>
      <p className={styles.pageHint}>
        {island._count.properties} propert{island._count.properties === 1 ? "y" : "ies"} currently
        listed on this island.
      </p>

      <section className={styles.section}>
        <IslandForm
          action={boundAction}
          atolls={atolls.map((a: (typeof atolls)[number]) => ({ id: a.id, name: a.name }))}
          initialValues={{
            name: island.name,
            atollId: island.atollId,
            description: island.description,
            latitude: island.latitude,
            longitude: island.longitude,
          }}
          title={island.name}
          submitLabel="Save changes"
          pendingLabel="Saving..."
        />
      </section>
    </div>
  );
}
