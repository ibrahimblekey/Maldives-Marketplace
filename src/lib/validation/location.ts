import { z } from "zod";

/**
 * Admin-only input schemas for the location hierarchy
 * (Country -> Atoll -> Island). Country is not editable through this
 * milestone's admin UI — the platform launches with a single country
 * (Maldives, seeded once) and there's no product requirement yet to manage
 * more, so exposing a Country CRUD screen would be complexity with no use.
 * Atoll and Island are what admins actually need to maintain, per the
 * project brief's "database-driven, not hard-coded" location requirement.
 */

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name is too long (max 100 characters)");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description is too long (max 2000 characters)")
  .optional()
  .or(z.literal(""));

export const atollInputSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});
export type AtollInput = z.infer<typeof atollInputSchema>;

// Maldives' latitude/longitude range, generously bounded — catches obvious
// typos (e.g. swapped fields, a stray extra digit) without being a precise
// geofence.
const latitudeSchema = z.coerce
  .number()
  .min(-90)
  .max(90)
  .optional()
  .or(z.literal("").transform(() => undefined));

const longitudeSchema = z.coerce
  .number()
  .min(-180)
  .max(180)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const islandInputSchema = z.object({
  name: nameSchema,
  atollId: z.string().trim().min(1, "Select an atoll"),
  description: descriptionSchema,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
export type IslandInput = z.infer<typeof islandInputSchema>;
