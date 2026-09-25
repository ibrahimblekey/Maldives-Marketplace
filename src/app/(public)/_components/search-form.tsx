import Form from "next/form";
import { MAX_GUESTS } from "./search-params";
import styles from "../public.module.css";

type Atoll = { slug: string; name: string; islands: { slug: string; name: string }[] };

/**
 * Where / dates / guests search box. A plain GET form (via next/form for
 * client-side navigation), so it works without JavaScript and every search
 * is a shareable URL. `extra` carries the current filters when the form is
 * reused on the results page.
 */
export function SearchForm({
  atolls,
  values,
  today,
  compact = false,
  extra,
}: {
  atolls: Atoll[];
  values: { where: string; checkIn: string; checkOut: string; guests: string };
  today: string;
  compact?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <Form action="/search" className={compact ? styles.searchBarCompact : styles.searchBar}>
      <label className={styles.field}>
        Where
        <select name="where" className={styles.select} defaultValue={values.where}>
          <option value="">Anywhere in the Maldives</option>
          {atolls.map((atoll) => (
            <optgroup key={atoll.slug} label={atoll.name}>
              <option value={`atoll:${atoll.slug}`}>All of {atoll.name}</option>
              {atoll.islands.map((island) => (
                <option key={island.slug} value={`island:${island.slug}`}>
                  {island.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Check-in
        <input type="date" name="checkIn" className={styles.input} min={today} defaultValue={values.checkIn} />
      </label>
      <label className={styles.field}>
        Check-out
        <input type="date" name="checkOut" className={styles.input} min={today} defaultValue={values.checkOut} />
      </label>
      <label className={styles.field}>
        Guests
        <input type="number" name="guests" className={styles.input} min={1} max={MAX_GUESTS} defaultValue={values.guests} />
      </label>
      {extra}
      <button type="submit" className={styles.searchButton}>
        Search
      </button>
    </Form>
  );
}
