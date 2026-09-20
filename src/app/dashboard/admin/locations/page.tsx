import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import { listAtolls, listIslands } from "@/server/services/location-service";
import { createAtollAction, createIslandAction, deleteAtollAction, deleteIslandAction } from "./actions";
import { AtollForm } from "./atoll-form";
import { IslandForm } from "./island-form";
import { DeleteButton } from "./delete-button";
import styles from "./locations.module.css";

/**
 * Admin "Locations" management: the Country -> Atoll -> Island hierarchy
 * the whole platform's search/browse experience is built on (see the
 * project brief's location-structure requirement — this data is meant to
 * grow to cover every relevant Maldivian island, not stay a hard-coded
 * handful).
 */
export default async function AdminLocationsPage() {
  try {
    await requireRole(["ADMIN", "SUPER_ADMIN"]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/login?callbackUrl=/dashboard/admin/locations");
    }
    if (err instanceof ForbiddenError) {
      redirect("/dashboard");
    }
    throw err;
  }

  const [atolls, islands] = await Promise.all([listAtolls(), listIslands()]);

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Back to admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Locations</h1>
      <p className={styles.pageHint}>
        Manage the atolls and islands travelers can search and hosts can list properties on. New
        islands appear in search immediately — no code changes needed.
      </p>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Atolls ({atolls.length})</h2>
        </div>
        <p className={styles.sectionHint}>The top level of the location hierarchy.</p>

        {atolls.length === 0 ? (
          <p className={styles.empty}>No atolls yet — add one below.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Islands</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {atolls.map((atoll: (typeof atolls)[number]) => (
                <tr key={atoll.id}>
                  <td>{atoll.name}</td>
                  <td>
                    <span className={styles.badge}>{atoll._count.islands}</span>
                  </td>
                  <td className={styles.muted}>{atoll.description || "—"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link className={styles.link} href={`/dashboard/admin/locations/atolls/${atoll.id}/edit`}>
                        Edit
                      </Link>
                      <DeleteButton action={deleteAtollAction} itemId={atoll.id} itemLabel={atoll.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <AtollForm
          action={createAtollAction}
          title="Add a new atoll"
          submitLabel="Add atoll"
          pendingLabel="Adding..."
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Islands ({islands.length})</h2>
        </div>
        <p className={styles.sectionHint}>Every island belongs to one atoll. Properties belong to an island.</p>

        {islands.length === 0 ? (
          <p className={styles.empty}>
            {atolls.length === 0
              ? "Add an atoll first, then islands can be added under it."
              : "No islands yet — add one below."}
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Atoll</th>
                <th>Properties</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {islands.map((island: (typeof islands)[number]) => (
                <tr key={island.id}>
                  <td>{island.name}</td>
                  <td className={styles.muted}>{island.atoll.name}</td>
                  <td>
                    <span className={styles.badge}>{island._count.properties}</span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link className={styles.link} href={`/dashboard/admin/locations/islands/${island.id}/edit`}>
                        Edit
                      </Link>
                      <DeleteButton action={deleteIslandAction} itemId={island.id} itemLabel={island.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {atolls.length > 0 && (
          <IslandForm
            action={createIslandAction}
            atolls={atolls.map((a: (typeof atolls)[number]) => ({ id: a.id, name: a.name }))}
            title="Add a new island"
            submitLabel="Add island"
            pendingLabel="Adding..."
          />
        )}
      </section>
    </div>
  );
}
