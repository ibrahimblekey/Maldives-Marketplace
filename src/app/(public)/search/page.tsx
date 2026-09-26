import type { Metadata } from "next";
import Link from "next/link";
import { MEAL_PLANS, MEAL_PLAN_LABELS } from "@/lib/validation/property";
import { toIsoDate, todayInMaldives } from "@/lib/stay-pricing";
import { getSearchOptions, searchListings, type SearchSort } from "@/server/services/listing-search-service";
import { ListingCard } from "../_components/listing-card";
import { parseSearchParams, searchHref, stayQuery, type RawSearchParams } from "../_components/search-params";
import { SearchForm } from "../_components/search-form";
import { plural } from "../_components/format";
import styles from "../public.module.css";

export const metadata: Metadata = { title: "Search stays · Maldives Marketplace" };

const SORTS: { value: SearchSort; label: string }[] = [
  { value: "recommended", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const { criteria, dateError, values } = parseSearchParams(raw);
  const [options, found] = await Promise.all([getSearchOptions(), searchListings(criteria)]);

  const place = [...options.atolls, ...options.atolls.flatMap((a) => a.islands)].find(
    (p) => p.slug === (criteria.islandSlug ?? criteria.atollSlug)
  );
  const nights = criteria.stay?.nights;
  const cardQuery = stayQuery(values);
  const selectedAmenities = new Set(criteria.amenitySlugs);

  return (
    <div className={styles.container}>
      <SearchForm
        atolls={options.atolls}
        values={values}
        today={toIsoDate(todayInMaldives())}
        compact
      />

      <div className={styles.resultsLayout}>
        {/* Filters: a second GET form carrying the main search's values along. */}
        <form action="/search" className={styles.filters}>
          <input type="hidden" name="where" value={values.where} />
          <input type="hidden" name="checkIn" value={values.checkIn} />
          <input type="hidden" name="checkOut" value={values.checkOut} />
          <input type="hidden" name="guests" value={values.guests} />
          <input type="hidden" name="sort" value={criteria.sort} />

          <div>
            <div className={styles.filterTitle}>Room price per night (USD, before taxes)</div>
            <div className={styles.priceRow}>
              <input className={styles.input} type="number" name="minPrice" min={0} placeholder="Min" defaultValue={criteria.minPrice ?? ""} aria-label="Minimum price" />
              –
              <input className={styles.input} type="number" name="maxPrice" min={0} placeholder="Max" defaultValue={criteria.maxPrice ?? ""} aria-label="Maximum price" />
            </div>
          </div>

          <label>
            <div className={styles.filterTitle}>Property type</div>
            <select className={styles.select} name="type" defaultValue={criteria.propertyTypeSlug ?? ""}>
              <option value="">Any type</option>
              {options.propertyTypes.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className={styles.filterTitle}>Meals</div>
            <select className={styles.select} name="meal" defaultValue={criteria.mealPlan ?? ""}>
              <option value="">Any</option>
              {MEAL_PLANS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_PLAN_LABELS[m]}
                </option>
              ))}
            </select>
          </label>

          <fieldset style={{ border: "none" }}>
            <legend className={styles.filterTitle}>Amenities</legend>
            {options.amenities.map((a) => (
              <label key={a.slug} className={styles.checkbox}>
                <input type="checkbox" name="amenity" value={a.slug} defaultChecked={selectedAmenities.has(a.slug)} />
                {a.name}
              </label>
            ))}
          </fieldset>

          <button type="submit" className={styles.filterButton}>
            Apply filters
          </button>
          <Link href={searchHref({ where: values.where, checkIn: values.checkIn || undefined, checkOut: values.checkOut || undefined, guests: values.guests }, {})} className={styles.link} style={{ textAlign: "center", fontSize: "0.875rem" }}>
            Clear filters
          </Link>
        </form>

        <div>
          {dateError && <p className={styles.notice}>{dateError} Showing all dates instead.</p>}
          <div className={styles.resultsHeader}>
            <h1 className={styles.sectionTitle} style={{ margin: 0 }}>
              {plural(found.total, "stay")} {place ? `in ${place.name}` : "in the Maldives"}
              {nights ? ` · ${plural(nights, "night")}` : ""}
              {criteria.guests > 1 ? ` · ${criteria.guests} guests` : ""}
            </h1>
            <nav className={styles.sortLinks} aria-label="Sort">
              {SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={searchHref(raw, { sort: s.value === "recommended" ? undefined : s.value, page: undefined })}
                  className={criteria.sort === s.value ? styles.sortLinkActive : styles.sortLink}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </div>
          {(criteria.minPrice !== undefined || criteria.maxPrice !== undefined) && (
            <p className={styles.muted} style={{ fontSize: "0.875rem", marginBottom: 12 }}>
              Price filter compares prices in USD. Stays priced in other currencies are hidden while it&rsquo;s on.
            </p>
          )}

          {found.results.length === 0 ? (
            <div className={styles.empty}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>No stays match your search.</p>
              <p>Try other dates, fewer filters, or search the whole Maldives.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {found.results.map((listing) => (
                <ListingCard key={listing.id} listing={listing} query={cardQuery} nights={nights} />
              ))}
            </div>
          )}

          {found.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Pages">
              {found.page > 1 && (
                <Link className={styles.sortLink} href={searchHref(raw, { page: String(found.page - 1) })}>
                  ← Previous
                </Link>
              )}
              <span className={styles.muted}>
                Page {found.page} of {found.totalPages}
              </span>
              {found.page < found.totalPages && (
                <Link className={styles.sortLink} href={searchHref(raw, { page: String(found.page + 1) })}>
                  Next →
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
