import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";
import { EmptyState } from "@/components/vehicles/empty-state";
import { VehicleFilters } from "@/components/vehicles/vehicle-filters";
import { Pagination } from "@/components/vehicles/pagination";
import { vehicleFilterSchema } from "@/lib/validators/vehicle.schema";
import { listPublicVehicles, getPublicFilterOptions } from "@/server/services/vehicle.service";
import { resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";

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
  const parsed = vehicleFilterSchema.safeParse(flattenSearchParams(rawSearchParams));
  const filters = parsed.success ? parsed.data : vehicleFilterSchema.parse({});

  const [{ items, page, totalPages }, filterOptions] = await Promise.all([
    listPublicVehicles(filters),
    getPublicFilterOptions(),
  ]);
  const resolvedItems = await resolveVehicleImagesForList(items);

  return (
    <div className="container-page py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <VehicleFilters options={filterOptions} />

        <div className="flex-1">
          {resolvedItems.length > 0 ? (
            <>
              <VehicleGrid vehicles={resolvedItems} />
              <Pagination page={page} totalPages={totalPages} searchParams={rawSearchParams} />
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
      </div>
    </div>
  );
}
