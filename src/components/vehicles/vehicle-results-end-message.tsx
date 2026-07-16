"use client";

import { ArrowRight } from "lucide-react";
import { useVehicleFilterContext } from "@/components/providers/vehicle-filter-provider";

// `isLastPage` is computed server-side in page.tsx from the same
// `total`/`page`/`totalPages` that already drive the grid and pagination —
// plain boolean prop, no extra query. `hasActiveFilters`/`clearFilters`
// come from the shared VehicleFilterProvider (see that file), the exact
// same source the active-filters box uses, so this can never disagree with
// it and reuses its one debounce-safe clear implementation rather than a
// second one.
export function VehicleResultsEndMessage({ isLastPage }: { isLastPage: boolean }) {
  const { hasActiveFilters, clearFilters } = useVehicleFilterContext();

  // Only meaningful once the user has narrowed the list with filters — with
  // no filters applied, this is just the full unfiltered catalog, so "have
  // you seen everything / can't find your car?" would be a non sequitur.
  if (!isLastPage || !hasActiveFilters) return null;

  return (
    <div className="mt-10 mb-12 flex flex-col items-center gap-1.5 text-center">
      <p className="text-lg font-semibold text-primary sm:text-xl">Έχεις δει όλες τις διαθέσιμες επιλογές.</p>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-ink-muted sm:text-base">
        <span>Δεν βρήκες ακόμη το όχημα που αναζητάς;</span>
        <button
          type="button"
          onClick={clearFilters}
          aria-label="Καθαρισμός όλων των φίλτρων"
          className="group inline-flex items-center gap-1 rounded-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <span className="relative">
            Καθαρισμός φίλτρων
            <span
              aria-hidden="true"
              className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-accent transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
            />
          </span>
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none"
          />
        </button>
      </div>
    </div>
  );
}
