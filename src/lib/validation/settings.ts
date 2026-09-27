import { z } from "zod";

const percent = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, `${label} must be a percentage like 17 or 12.5`);
const usd = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,4}(\.\d{1,2})?$/, `${label} must be an amount like 6 or 6.50`);

/** Admin → Settings form. */
export const settingsSchema = z.object({
  tgstPercent: percent("T-GST"),
  greenTaxStandardUsd: usd("Standard green tax"),
  greenTaxHigherUsd: usd("Higher green tax"),
  defaultServiceChargePercent: percent("Default service charge"),
  commissionPercent: percent("Commission"),
});

/** Admin correction of a listing's tax settings. */
export const propertyTaxSchema = z.object({
  listingType: z.enum(["TOURIST_PROPERTY", "PRIVATE_RENTAL"]),
  greenTaxTier: z.enum(["STANDARD", "HIGHER"]),
  serviceChargePercent: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    percent("Service charge").optional()
  ),
});
