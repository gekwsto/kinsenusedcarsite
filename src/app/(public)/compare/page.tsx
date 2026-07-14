import type { Metadata } from "next";
import { getPublicVehiclesByIds } from "@/server/services/vehicle.service";
import { resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";
import { isComparisonEligible, parseComparisonIdsFromSearchParam, reorderVehiclesByIds } from "@/lib/vehicle-comparison";
import { ComparisonIncompleteState } from "@/components/vehicles/comparison-incomplete-state";
import { ComparisonMatrix, type ComparisonPageVehicle } from "@/components/vehicles/comparison-matrix";

// User-generated (query-driven) and not meant to be indexed per-combination
// — see task requirement — never a canonical URL, never structured data.
export const metadata: Metadata = {
  title: "Σύγκριση Αυτοκινήτων | Kinsen",
  robots: { index: false, follow: false },
};

interface ComparePageSearchParams {
  vehicles?: string;
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<ComparePageSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const ids = parseComparisonIdsFromSearchParam(resolvedSearchParams.vehicles);

  if (!isComparisonEligible(ids.length)) {
    return (
      <div className="container-page">
        <ComparisonIncompleteState reason="count" />
      </div>
    );
  }

  const items = await getPublicVehiclesByIds(ids);
  const ordered = reorderVehiclesByIds(items, ids);

  if (ordered.length !== ids.length) {
    return (
      <div className="container-page">
        <ComparisonIncompleteState reason="unavailable" />
      </div>
    );
  }

  const withImages = await resolveVehicleImagesForList(ordered);
  const vehicles: ComparisonPageVehicle[] = withImages.map((vehicle) => ({
    id: vehicle.id,
    slug: vehicle.slug,
    maker: vehicle.maker,
    versionName: vehicle.versionName,
    yearRelease: vehicle.yearRelease ?? null,
    typeOfCar: vehicle.typeOfCar ?? null,
    color: vehicle.color ?? null,
    fuel: vehicle.fuel ?? null,
    cc: vehicle.cc ?? null,
    hp: vehicle.hp ?? null,
    transmissionType: vehicle.transmissionType ?? null,
    km: vehicle.km ?? null,
    offer: vehicle.offer,
    price: vehicle.price ?? null,
    monthlyPrice: vehicle.monthlyPrice ?? null,
    imageUrl: vehicle.images[0]?.url ?? "",
  }));

  return (
    <div className="container-page">
      <ComparisonMatrix vehicles={vehicles} />
    </div>
  );
}
