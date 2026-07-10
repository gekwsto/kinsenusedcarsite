import { Skeleton } from "@/components/ui/skeleton";
import { VehicleGridSkeleton } from "@/components/vehicles/vehicle-grid";

export default function VehiclesLoading() {
  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="hidden shrink-0 lg:block lg:w-72">
          <Skeleton className="h-[600px] w-full rounded-card" />
        </div>
        <div className="flex-1">
          <div className="mb-5 flex justify-end">
            <Skeleton className="h-11 w-64" />
          </div>
          <VehicleGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}
