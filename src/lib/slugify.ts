/**
 * Turns a display name into a URL-safe slug.
 *
 * Used everywhere a model has both a human-readable `name` and a unique
 * `slug` (Atoll, Island, PropertyType, Amenity, and — later — Property).
 * Keeping this in one place means the same rules apply everywhere: lowercase,
 * ASCII letters/numbers/hyphens only, no leading/trailing/doubled hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents (é -> e)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
