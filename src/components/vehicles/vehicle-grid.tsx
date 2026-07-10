import { VehicleCard, type VehicleCardVehicle } from "@/components/vehicles/vehicle-card";
import { VehicleCardSkeleton } from "@/components/vehicles/vehicle-card-skeleton";

export function VehicleGrid({ vehicles }: { vehicles: VehicleCardVehicle[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle, index) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 3} />
      ))}
    </div>
  );
}

export function VehicleGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <VehicleCardSkeleton key={index} />
      ))}
    </div>
  );
}
