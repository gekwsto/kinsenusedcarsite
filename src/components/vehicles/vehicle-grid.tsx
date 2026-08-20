import { VehicleCard, type VehicleCardVariant, type VehicleCardVehicle } from "@/components/vehicles/vehicle-card";
import { VehicleCardSkeleton } from "@/components/vehicles/vehicle-card-skeleton";

// `[@media(min-width:2200px)]:grid-cols-4` is a deliberate true-large-
// desktop tier, not `2xl:` (which starts at 1536px — far too early here,
// well inside normal laptop/desktop widths where 3 columns is the
// approved layout). Paired with `.container-wide`'s matching 2320px cap
// at the same breakpoint (globals.css) so the shell is wide enough for a
// genuinely comfortable fourth card (~430px) rather than squeezing four
// cards into the same width three used to fill. Both grids below must
// stay in sync — the skeleton is what renders during the initial loading
// state, so a mismatched column count there would visibly reflow once
// real data replaces it.
export function VehicleGrid({
  vehicles,
  cardVariant = "default",
}: {
  vehicles: VehicleCardVehicle[];
  cardVariant?: VehicleCardVariant;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6 2xl:gap-7 [@media(min-width:2200px)]:grid-cols-4">
      {vehicles.map((vehicle, index) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 3} variant={cardVariant} />
      ))}
    </div>
  );
}

export function VehicleGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6 2xl:gap-7 [@media(min-width:2200px)]:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <VehicleCardSkeleton key={index} />
      ))}
    </div>
  );
}
