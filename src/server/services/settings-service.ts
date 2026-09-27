import type { GreenTaxTier, ListingType, PlatformSettings } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { TaxRates } from "@/lib/stay-pricing";
import { UserFacingError } from "./errors";

/**
 * Admin-editable platform settings (Admin → Settings): T-GST rate, green
 * tax amounts, default service charge and default commission. Starting
 * values come from the migration; see docs/decisions.md → "Tax rules" and
 * "Commission". Bookings copy the values they used, so changes here only
 * affect bookings made afterwards.
 */

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const settings = await prisma.platformSettings.findUnique({ where: { id: "default" } });
  if (!settings) throw new Error("Platform settings are missing. Run the database migrations.");
  return settings;
}

export type SettingsInput = {
  tgstPercent: string;
  greenTaxStandardUsd: string;
  greenTaxHigherUsd: string;
  defaultServiceChargePercent: string;
  commissionPercent: string;
};

export async function updatePlatformSettings(adminUserId: string, input: SettingsInput) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.platformSettings.findUnique({ where: { id: "default" } });
    if (!before) throw new UserFacingError("Settings are missing.");
    await tx.platformSettings.update({ where: { id: "default" }, data: { ...input, updatedByUserId: adminUserId } });
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action: "SETTINGS_UPDATED",
        targetType: "PlatformSettings",
        targetId: "default",
        metadata: {
          before: {
            tgstPercent: before.tgstPercent.toString(),
            greenTaxStandardUsd: before.greenTaxStandardUsd.toString(),
            greenTaxHigherUsd: before.greenTaxHigherUsd.toString(),
            defaultServiceChargePercent: before.defaultServiceChargePercent.toString(),
            commissionPercent: before.commissionPercent.toString(),
          },
          after: input,
        },
      },
    });
  });
}

/** The rates that apply to one property right now. */
export function ratesForProperty(
  property: { listingType: ListingType; serviceChargePercent: { toString(): string } | null; greenTaxTier: GreenTaxTier },
  settings: PlatformSettings
): TaxRates {
  return {
    listingType: property.listingType,
    serviceChargePercent: (property.serviceChargePercent ?? settings.defaultServiceChargePercent).toString(),
    tgstPercent: settings.tgstPercent.toString(),
    greenTaxPerNight: (property.greenTaxTier === "HIGHER" ? settings.greenTaxHigherUsd : settings.greenTaxStandardUsd).toString(),
  };
}
