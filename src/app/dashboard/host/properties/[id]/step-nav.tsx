"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../../../ui.module.css";

const STEPS = [
  { slug: "basics", label: "1. Basics" },
  { slug: "rooms", label: "2. Rooms & prices" },
  { slug: "amenities", label: "3. Amenities" },
  { slug: "policies", label: "4. Policies" },
  { slug: "photos", label: "5. Photos" },
  { slug: "review", label: "6. Review & submit" },
  { slug: "availability", label: "Availability" },
];

export function StepNav({ propertyId, isLive }: { propertyId: string; isLive: boolean }) {
  const pathname = usePathname();
  const base = `/dashboard/host/properties/${propertyId}`;
  return (
    <nav aria-label="Listing steps">
      <ul className={styles.steps}>
        {STEPS.map((step) => {
          const href = `${base}/${step.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const label = isLive && step.slug === "review" ? "6. Overview" : step.label;
          return (
            <li key={step.slug}>
              <Link href={href} className={active ? styles.stepActive : styles.step} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
