import { Skeleton } from "@/components/ui/skeleton";

export function VehicleCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-white shadow-soft">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="mt-1 h-9 w-full" />
      </div>
    </div>
  );
}
