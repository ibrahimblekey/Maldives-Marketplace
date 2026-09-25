import Link from "next/link";
import { getSearchOptions, searchListings } from "@/server/services/listing-search-service";
import { toIsoDate, todayInMaldives } from "@/lib/stay-pricing";
import { ListingCard } from "./_components/listing-card";
import { SearchForm } from "./_components/search-form";
import styles from "./public.module.css";

/** Public home page: search box, browse by atoll, newest stays. */
export default async function HomePage() {
  const [options, newest] = await Promise.all([
    getSearchOptions(),
    searchListings({ stay: null, guests: 1, amenitySlugs: [], sort: "recommended", page: 1 }),
  ]);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.heroTitle}>Find your stay on a local island</h1>
          <p className={styles.heroText}>
            Guesthouses, hotels and villas across the Maldives, every one checked by our team before it goes live.
          </p>
          <SearchForm
            atolls={options.atolls}
            values={{ where: "", checkIn: "", checkOut: "", guests: "2" }}
            today={toIsoDate(todayInMaldives())}
          />
        </div>
      </section>

      <div className={styles.container}>
        {options.atolls.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Browse by atoll</h2>
            <div className={styles.chips}>
              {options.atolls.map((atoll) => (
                <Link key={atoll.slug} href={`/search?where=atoll:${atoll.slug}`} className={styles.chip}>
                  {atoll.name} <span className={styles.chipCount}>{atoll.listingCount}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Newest stays</h2>
          {newest.results.length === 0 ? (
            <p className={styles.empty}>New stays are on their way. Check back soon.</p>
          ) : (
            <>
              <div className={styles.grid}>
                {newest.results.slice(0, 6).map((listing) => (
                  <ListingCard key={listing.id} listing={listing} query="" />
                ))}
              </div>
              {newest.total > 6 && (
                <p style={{ marginTop: 16 }}>
                  <Link href="/search" className={styles.link}>
                    See all {newest.total} stays →
                  </Link>
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
