"use client";

import { ArrowUpDown } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { buildQueryString, buildHref } from "@/lib/query-params";
import { cn } from "@/lib/utils";
import { useNavigationTransition } from "@/components/providers/navigation-transition-provider";
import { useVehicleResultsScroll } from "@/lib/vehicle-results-scroll";
import type { VehicleSort } from "@/lib/validators/vehicle.schema";

const SORT_OPTIONS: { value: VehicleSort; label: string }[] = [
  { value: "recommended", label: "Προτεινόμενα" },
  { value: "price-desc", label: "Τιμή: Υψηλότερη πρώτα" },
  { value: "price-asc", label: "Τιμή: Χαμηλότερη πρώτα" },
  { value: "mileage-asc", label: "Χιλιόμετρα: Λιγότερα πρώτα" },
  { value: "mileage-desc", label: "Χιλιόμετρα: Περισσότερα πρώτα" },
  { value: "engine-asc", label: "Κυβικά: Λιγότερα πρώτα" },
  { value: "engine-desc", label: "Κυβικά: Περισσότερα πρώτα" },
];

// Lives in the results toolbar (src/components/vehicles/vehicle-results-toolbar.tsx),
// not the filter sidebar — sorting reorders the existing matching set, it
// doesn't narrow it, so it's deliberately excluded from the active-filter
// count/chips/clear-all machinery entirely (see VehicleFilterProvider).
export function SortSelect({ currentSort, className }: { currentSort: VehicleSort; className?: string }) {
  const router = useRouter();
  const transition = useNavigationTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestScroll = useVehicleResultsScroll();

  const handleChange = (next: string) => {
    // Same-page sort change — must never activate the global loader.
    // Replace semantics: a rapid sequence of sort changes shouldn't flood
    // history with an entry per click. `buildQueryString` already omits
    // `sort` from the URL entirely when it equals the "recommended"
    // default (DEFAULT_VALUES in query-params.ts), so selecting it back
    // returns to the bare canonical `/vehicles` URL rather than
    // `?sort=recommended`.
    const qs = buildQueryString(searchParams, { sort: next }, { resetPage: true });
    const href = buildHref(pathname, qs);
    if (transition) transition.syncUrlState(href, { method: "replace" });
    else router.replace(href, { scroll: false });
    // A sort change materially reorders the result grid — request the
    // shared results-scroll correction (only actually scrolls if the
    // document is currently below the results-start anchor).
    requestScroll();
  };

  return (
    <Select value={currentSort} onValueChange={handleChange}>
      <SelectTrigger
        aria-label="Ταξινόμηση οχημάτων"
        className={cn(
          "h-11 w-full min-w-[220px] gap-2 border-border px-4 text-sm font-medium text-primary transition-[border-color] duration-200 ease-out hover:border-primary/40 sm:w-auto",
          className,
        )}
      >
        <ArrowUpDown className="h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
