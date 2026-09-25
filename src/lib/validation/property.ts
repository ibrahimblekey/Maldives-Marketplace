import { z } from "zod";

/**
 * Input schemas for the host property-listing wizard. Every server action
 * parses FormData through one of these — nothing from the browser is
 * trusted, including values a normal form would never send (HTML `min`/
 * `max`/`required` attributes are a convenience, not a check).
 */

export const MIN_PHOTOS = 5;
export const MAX_PHOTOS = 30;
export const MIN_DESCRIPTION_LENGTH = 50;

export const CURRENCIES = ["USD", "MVR", "EUR", "GBP", "INR"] as const;
export const MEAL_PLANS = ["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD", "ALL_INCLUSIVE"] as const;

export const MEAL_PLAN_LABELS: Record<(typeof MEAL_PLANS)[number], string> = {
  ROOM_ONLY: "Room only",
  BREAKFAST: "Breakfast included",
  HALF_BOARD: "Half board (breakfast + dinner)",
  FULL_BOARD: "Full board (all meals)",
  ALL_INCLUSIVE: "All inclusive",
};

/** Empty form fields arrive as "" — treat them as "not provided". */
const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const optionalText = (max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, `${label} is too long (max ${max} characters)`).optional()
  );

const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ message: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .optional()
  );

const requiredInt = (min: number, max: number, label: string) =>
  z.coerce
    .number({ message: `${label} is required` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

// Money is kept as a string all the way to Prisma's Decimal — never parsed
// into a JS float, which can't represent most cent values exactly.
const moneyPattern = /^\d{1,8}(\.\d{1,2})?$/;
const money = (label: string) =>
  z
    .string()
    .trim()
    .regex(moneyPattern, `${label} must be an amount like 120 or 120.50`)
    .refine((v) => Number(v) > 0, `${label} must be more than 0`);
const optionalMoney = (label: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().regex(moneyPattern, `${label} must be an amount like 20 or 20.50`).optional()
  );

const nameSchema = z
  .string()
  .trim()
  .min(3, "Property name must be at least 3 characters")
  .max(120, "Property name is too long (max 120 characters)");

const descriptionSchema = z
  .string()
  .trim()
  .min(MIN_DESCRIPTION_LENGTH, `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`)
  .max(5000, "Description is too long (max 5000 characters)");

/** Wizard step 1 — everything needed to create the property row. */
export const propertyBasicsSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  propertyTypeId: z.string().trim().min(1, "Select a property type"),
  islandId: z.string().trim().min(1, "Select an island"),
  address: optionalText(300, "Address"),
  distanceFromBeachMeters: optionalInt(0, 100000, "Distance from the beach"),
  distanceFromHarborMeters: optionalInt(0, 100000, "Distance from the harbour"),
});
export type PropertyBasicsInput = z.infer<typeof propertyBasicsSchema>;

export const roomInputSchema = z
  .object({
    name: z.string().trim().min(2, "Room name must be at least 2 characters").max(100, "Room name is too long"),
    description: optionalText(2000, "Room description"),
    maxOccupancy: requiredInt(1, 50, "Maximum guests"),
    bedConfiguration: optionalText(100, "Beds"),
    sizeSqm: optionalInt(1, 10000, "Room size"),
    mealPlan: z.enum(MEAL_PLANS, { message: "Select a meal plan" }),
    basePrice: money("Nightly price"),
    currency: z.enum(CURRENCIES, { message: "Select a currency" }),
    minStayNights: optionalInt(1, 365, "Minimum nights"),
    maxStayNights: optionalInt(1, 365, "Maximum nights"),
    extraGuestFee: optionalMoney("Extra guest fee"),
    extraBedFee: optionalMoney("Extra bed fee"),
    unitCount: requiredInt(1, 500, "Number of rooms"),
    amenityIds: z.array(z.string()).max(100).default([]),
  })
  .refine((r) => !r.minStayNights || !r.maxStayNights || r.maxStayNights >= r.minStayNights, {
    message: "Maximum nights can't be less than minimum nights",
  });
export type RoomInput = z.infer<typeof roomInputSchema>;

const isoDate = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required`);

export const seasonalPriceSchema = z
  .object({
    name: optionalText(80, "Season name"),
    startDate: isoDate("Start date"),
    endDate: isoDate("End date"),
    pricePerNight: money("Seasonal price"),
    minStayNights: optionalInt(1, 365, "Minimum nights"),
  })
  .refine((s) => s.endDate >= s.startDate, { message: "End date can't be before the start date" });
export type SeasonalPriceInput = z.infer<typeof seasonalPriceSchema>;

const time = (label: string) =>
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} must be a time like 14:00`);

export const policiesSchema = z.object({
  checkInTime: time("Check-in time"),
  checkOutTime: time("Check-out time"),
  freeCancellationDays: optionalInt(0, 365, "Free cancellation days"),
  refundPercentageAfter: optionalInt(0, 100, "Refund percentage"),
  description: optionalText(3000, "Cancellation details"),
  childrenPolicy: optionalText(1000, "Children policy"),
  extraBedPolicy: optionalText(1000, "Extra bed policy"),
  petsAllowed: z.boolean(),
  smokingAllowed: z.boolean(),
});
export type PoliciesInput = z.infer<typeof policiesSchema>;

export const reviewDecisionReasonSchema = z
  .string()
  .trim()
  .min(10, "Give the host a reason of at least 10 characters so they know what to fix")
  .max(2000, "Reason is too long (max 2000 characters)");
