import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KINSEN_CTA_BUTTON_CLASSNAME } from "@/components/ui/kinsen-cta-button";
import { VehicleCarousel } from "@/components/vehicles/vehicle-carousel";
import { getFeaturedVehicles } from "@/server/services/vehicle.service";
import { resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";
import { cn } from "@/lib/utils";

export async function FeaturedVehicles() {
  const vehicles = await getFeaturedVehicles(6);
  if (vehicles.length === 0) return null;

  const resolvedVehicles = await resolveVehicleImagesForList(vehicles);

  return (
    <section className="container-page mb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">Επιλεγμένα Οχήματα</h2>
        {/* Same static Kinsen corporate CTA as "Σύνδεση" (see
            kinsen-cta-button.tsx) — a compact section-header sizing of its
            own, same navy/border/radius language. */}
        <Button
          asChild
          variant="primary"
          size="sm"
          className={cn(KINSEN_CTA_BUTTON_CLASSNAME, "rounded-md px-4 text-sm sm:px-5 sm:text-[15px] lg:px-6 lg:text-base")}
        >
          <Link href="/vehicles">
            <span className="inline-flex items-center gap-1.5">
              Δείτε όλα
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </Button>
      </div>
      <VehicleCarousel vehicles={resolvedVehicles} />
    </section>
  );
}
