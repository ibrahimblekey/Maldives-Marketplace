import Link from "next/link";
import { requireAdmin } from "@/server/auth/page-guards";
import { getPlatformSettings } from "@/server/services/settings-service";
import { prisma } from "@/lib/db";
import { ActionForm } from "../../_components/action-form";
import { formatDateTime } from "../../_components/format";
import { saveSettingsAction } from "./actions";
import styles from "../../ui.module.css";

const num = (v: { toString(): string }) => String(Number(v.toString()));

export default async function AdminSettingsPage() {
  await requireAdmin("/dashboard/admin/settings");
  const settings = await getPlatformSettings();
  const updatedBy = settings.updatedByUserId
    ? await prisma.user.findUnique({ where: { id: settings.updatedByUserId }, select: { name: true } })
    : null;

  return (
    <div>
      <Link href="/dashboard/admin" className={styles.backLink}>
        ← Admin dashboard
      </Link>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageHint}>
        Tax rates and platform rates. Changes apply to bookings made after you save; every existing booking keeps the rates it
        was made with. Last changed {formatDateTime(settings.updatedAt)}
        {updatedBy ? ` by ${updatedBy.name}` : ""}.
      </p>
      <section className={styles.section}>
        <ActionForm action={saveSettingsAction} submitLabel="Save settings">
          <h2 className={styles.sectionTitle}>Taxes (licensed tourist properties)</h2>
          <div className={styles.row}>
            <label className={styles.label}>
              T-GST (%)
              <span className={styles.help}>Charged on room price + service charge.</span>
              <input className={styles.input} name="tgstPercent" required inputMode="decimal" defaultValue={num(settings.tgstPercent)} />
            </label>
            <label className={styles.label}>
              Default service charge (%)
              <span className={styles.help}>Used when a property hasn&rsquo;t set its own.</span>
              <input className={styles.input} name="defaultServiceChargePercent" required inputMode="decimal" defaultValue={num(settings.defaultServiceChargePercent)} />
            </label>
          </div>
          <div className={styles.row}>
            <label className={styles.label}>
              Green tax, standard (USD per visitor per night)
              <input className={styles.input} name="greenTaxStandardUsd" required inputMode="decimal" defaultValue={num(settings.greenTaxStandardUsd)} />
            </label>
            <label className={styles.label}>
              Green tax, higher (USD per visitor per night)
              <input className={styles.input} name="greenTaxHigherUsd" required inputMode="decimal" defaultValue={num(settings.greenTaxHigherUsd)} />
            </label>
          </div>
          <p className={styles.help}>
            Green tax applies to visitors aged 2 and over. Maldivians and residents don&rsquo;t pay it. Private rentals pay no
            T-GST, service charge or green tax.
          </p>
          <h2 className={styles.sectionTitle} style={{ marginTop: 12 }}>
            Platform
          </h2>
          <label className={styles.label}>
            Commission (%)
            <span className={styles.help}>Charged to hosts on the room price only (not on service charge or taxes).</span>
            <input className={styles.input} name="commissionPercent" required inputMode="decimal" defaultValue={num(settings.commissionPercent)} style={{ maxWidth: 200 }} />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
