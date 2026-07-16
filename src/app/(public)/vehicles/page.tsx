import type { Metadata } from "next";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Button } from "@/components/ui/button";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";
import { EmptyState } from "@/components/vehicles/empty-state";
import { VehicleFilters } from "@/components/vehicles/vehicle-filters";
import { Pagination } from "@/components/vehicles/pagination";
import { VehicleResultsEndMessage } from "@/components/vehicles/vehicle-results-end-message";
import { VehicleResultsToolbar } from "@/components/vehicles/vehicle-results-toolbar";
import { VehicleFilterProvider } from "@/components/providers/vehicle-filter-provider";
import { computeDraftFromParams, draftsEqual, EMPTY_DRAFT } from "@/lib/vehicle-filter-draft";
import { vehicleFilterSchema } from "@/lib/validators/vehicle.schema";
import { listPublicVehicles, getPublicFilterOptions } from "@/server/services/vehicle.service";
import { resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";
import { VEHICLE_RESULTS_START_ID } from "@/lib/vehicle-results-scroll";

export const metadata: Metadata = {
  title: "Οχήματα",
  description: "Δείτε όλα τα διαθέσιμα μεταχειρισμένα οχήματα της Kinsen με leasing και δανειοδότηση.",
  alternates: { canonical: "/vehicles" },
};

type SearchParams = Record<string, string | string[] | undefined>;

function flattenSearchParams(searchParams: SearchParams): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    flat[key] = Array.isArray(value) ? value[0] ?? "" : value;
  }
  return flat;
}

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const rawSearchParams = await searchParams;
  const flatSearchParams = flattenSearchParams(rawSearchParams);
  const parsed = vehicleFilterSchema.safeParse(flatSearchParams);
  const filters = parsed.success ? parsed.data : vehicleFilterSchema.parse({});
  // Same sidebar-filter fields (maker/fuel/price range/etc.) the client-side
  // VehicleFilterProvider checks for its own `hasActiveFilters` — computed
  // here too so the toolbar's "no filters yet" label can render server-side
  // without waiting on that client context.
  const hasActiveFilters = !draftsEqual(computeDraftFromParams(new URLSearchParams(flatSearchParams)), EMPTY_DRAFT);

  const [{ items, page, totalPages, total }, filterOptions] = await Promise.all([
    listPublicVehicles(filters),
    getPublicFilterOptions(),
  ]);
  const resolvedItems = await resolveVehicleImagesForList(items);
  // The end-of-results section only ever renders alongside a non-empty
  // grid (see the `resolvedItems.length > 0` branch below), so `total > 0`
  // here is mostly a defensive restatement of that — kept explicit because
  // it's the literal documented condition, and it also correctly excludes
  // the edge case where `page` points past the end of a shrunken result
  // set (items empty for this exact page while total is still > 0), which
  // already falls into the EmptyState branch instead.
  const isLastPage = total > 0 && page >= totalPages;

  return (
    <div className="container-wide py-8">
      <div
        id={VEHICLE_RESULTS_START_ID}
        className="grid scroll-mt-[var(--kinsen-header-offset)] grid-cols-1 gap-5 lg:grid-cols-[clamp(300px,23vw,340px)_minmax(0,1fr)] lg:items-start xl:gap-6 xl:grid-cols-[clamp(320px,20vw,360px)_minmax(0,1fr)] 2xl:gap-7 2xl:grid-cols-[clamp(340px,18vw,380px)_minmax(0,1fr)]"
      >
        <VehicleFilterProvider>
          <VehicleFilters options={filterOptions} />

          <div className="min-w-0">
            <VehicleResultsToolbar totalResults={total} currentSort={filters.sort} hasActiveFilters={hasActiveFilters} />
            {resolvedItems.length > 0 ? (
              <>
                <VehicleGrid vehicles={resolvedItems} cardVariant="listing" />
                <Pagination page={page} totalPages={totalPages} searchParams={rawSearchParams} />
                <VehicleResultsEndMessage isLastPage={isLastPage} />
              </>
            ) : (
              <EmptyState
                title="Δεν βρέθηκαν οχήματα"
                description="Δοκιμάστε να αλλάξετε τα φίλτρα ή καθαρίστε τα για να δείτε όλα τα αποτελέσματα."
                action={
                  <Button asChild variant="outline" className="mt-2">
                    <Link href="/vehicles">Καθαρισμός φίλτρων</Link>
                  </Button>
                }
              />
            )}
          </div>
        </VehicleFilterProvider>
      </div>
    </div>
  );
}
