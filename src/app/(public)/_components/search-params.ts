import type { MealPlan } from "@prisma/client";
import { MEAL_PLANS } from "@/lib/validation/property";
import { parseStay } from "@/lib/stay-pricing";
import type { SearchCriteria, SearchSort } from "@/server/services/listing-search-service";

/**
 * Turns the search page's URL (?where=island:maafushi&checkIn=...) into
 * validated search criteria. Everything in a URL is user-editable, so
 * anything malformed is simply ignored rather than trusted.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const slug = (v: string | undefined) => (v && /^[a-z0-9-]{1,120}$/.test(v) ? v : undefined);

function wholeNumber(v: string | undefined, min: number, max: number) {
  if (!v || !/^\d{1,6}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

export const MAX_GUESTS = 30;

export function parseSearchParams(raw: RawSearchParams) {
  const where = first(raw.where) ?? "";
  const [kind, whereSlug] = where.split(":");
  const { stay, error: dateError } = parseStay(first(raw.checkIn), first(raw.checkOut));
  const sort = first(raw.sort);
  const mealPlan = first(raw.meal);

  const criteria: SearchCriteria = {
    atollSlug: kind === "atoll" ? slug(whereSlug) : undefined,
    islandSlug: kind === "island" ? slug(whereSlug) : undefined,
    stay,
    guests: wholeNumber(first(raw.guests), 1, MAX_GUESTS) ?? 1,
    propertyTypeSlug: slug(first(raw.type)),
    amenitySlugs: all(raw.amenity).map(slug).filter((s): s is string => !!s).slice(0, 20),
    mealPlan: MEAL_PLANS.includes(mealPlan as MealPlan) ? (mealPlan as MealPlan) : undefined,
    minPrice: wholeNumber(first(raw.minPrice), 0, 1_000_000),
    maxPrice: wholeNumber(first(raw.maxPrice), 0, 1_000_000),
    sort: (["recommended", "price_asc", "price_desc"] as SearchSort[]).includes(sort as SearchSort)
      ? (sort as SearchSort)
      : "recommended",
    page: wholeNumber(first(raw.page), 1, 10_000) ?? 1,
  };

  return {
    criteria,
    dateError,
    // Echoed back into the forms so the traveler sees what they searched for.
    values: {
      where,
      checkIn: stay ? first(raw.checkIn)! : "",
      checkOut: stay ? first(raw.checkOut)! : "",
      guests: String(criteria.guests),
    },
  };
}

/** The same URL with some parameters changed (undefined removes one). Used for sort/page links. */
export function searchHref(raw: RawSearchParams, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (key in changes) continue;
    for (const v of all(value)) params.append(key, v);
  }
  for (const [key, value] of Object.entries(changes)) if (value !== undefined) params.set(key, value);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** Keeps the traveler's dates/guests when they open a property. */
export function stayQuery(values: { checkIn: string; checkOut: string; guests: string }) {
  const params = new URLSearchParams();
  if (values.checkIn && values.checkOut) {
    params.set("checkIn", values.checkIn);
    params.set("checkOut", values.checkOut);
  }
  if (values.guests !== "1") params.set("guests", values.guests);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
