import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { ArrowRight } from "lucide-react";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";
import { getFeaturedVehicles } from "@/server/services/vehicle.service";
import { resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";

export async function FeaturedVehicles() {
  const vehicles = await getFeaturedVehicles(6);
  if (vehicles.length === 0) return null;

  const resolvedVehicles = await resolveVehicleImagesForList(vehicles);

  return (
    <section className="container-page mb-16">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">Επιλεγμένα Οχήματα</h2>
        <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-sm font-semibold text-detail hover:underline">
          Δείτε όλα <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <VehicleGrid vehicles={resolvedVehicles} cardVariant="featured" />
    </section>
  );
}
