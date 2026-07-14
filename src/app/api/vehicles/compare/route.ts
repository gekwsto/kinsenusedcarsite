import { NextRequest, NextResponse } from "next/server";
import { getPublicVehiclesByIds } from "@/server/services/vehicle.service";
import { resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";
import { MAX_COMPARISON_VEHICLES, parseComparisonIdsFromSearchParam, reorderVehiclesByIds } from "@/lib/vehicle-comparison";
import type { VehicleComparisonSummary } from "@/lib/vehicle-comparison";

// Read-only, public, no authentication — comparison must work for
// anonymous visitors. Never trusts the client's summary data: this is the
// one place that re-resolves the requested IDs against the real database
// (PUBLIC_WHERE visibility filter) and returns only the compact fields the
// sidebar/tray actually render, never admin-only fields (plate/vin) and
// never the full vehicle record.
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  const ids = parseComparisonIdsFromSearchParam(idsParam);

  if (ids.length === 0) {
    return NextResponse.json({ vehicles: [] satisfies VehicleComparisonSummary[] }, { status: 200 });
  }

  if (ids.length > MAX_COMPARISON_VEHICLES) {
    return NextResponse.json({ error: "too_many_ids" }, { status: 400 });
  }

  try {
    const items = await getPublicVehiclesByIds(ids);
    const ordered = reorderVehiclesByIds(items, ids);
    const withImages = await resolveVehicleImagesForList(ordered);

    const vehicles: VehicleComparisonSummary[] = withImages.map((vehicle) => ({
      id: vehicle.id,
      slug: vehicle.slug,
      maker: vehicle.maker,
      versionName: vehicle.versionName,
      yearRelease: vehicle.yearRelease ?? null,
      price: vehicle.price ?? null,
      monthlyPrice: vehicle.monthlyPrice ?? null,
      km: vehicle.km ?? null,
      imageUrl: vehicle.images[0]?.url ?? null,
      fuel: vehicle.fuel ?? null,
      transmissionType: vehicle.transmissionType ?? null,
    }));

    return NextResponse.json({ vehicles }, { status: 200 });
  } catch (error) {
    console.error("GET /api/vehicles/compare failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
