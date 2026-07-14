"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { useVehicleComparison } from "@/components/providers/vehicle-comparison-provider";
import { useNavigationTransition } from "@/components/providers/navigation-transition-provider";
import { cn, formatEuro, formatKm, FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";
import {
  COMPARISON_FIELDS,
  COMPARISON_GROUP_LABELS,
  COMPARISON_GROUP_ORDER,
  computeBestValueVehicleIds,
  type ComparisonMatrixVehicle,
} from "@/lib/comparison-fields";

export interface ComparisonPageVehicle extends ComparisonMatrixVehicle {
  slug: string;
  imageUrl: string;
}

// Client component: syncs the provider's selection to this validated,
// exactly-3-real-vehicle URL (see VehicleComparisonProvider's
// syncSelectionFromUrl doc for the full precedence rule), then renders the
// summary header + grouped matrix. page.tsx (server component) only ever
// mounts this once it has already confirmed exactly 3 valid public
// vehicles resolved from the URL's IDs — this component never re-validates
// that itself.
export function ComparisonMatrix({ vehicles }: { vehicles: readonly ComparisonPageVehicle[] }) {
  const { syncSelectionFromUrl, removeVehicle } = useVehicleComparison();
  const router = useRouter();
  const transition = useNavigationTransition();

  const idsKey = vehicles.map((v) => v.id).join(",");
  React.useEffect(() => {
    syncSelectionFromUrl(vehicles.map((v) => v.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const handleRemove = (id: string) => {
    removeVehicle(id);
    // Removing one vehicle always breaks the exact-3 requirement this page
    // needs — task requirement: never render a misleading partial matrix,
    // and never auto-pick a replacement. Sending the visitor back to
    // /vehicles is the direct, explicit next action.
    if (transition) transition.navigate("/vehicles");
    else router.push("/vehicles");
  };

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">Σύγκριση Αυτοκινήτων</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Δείτε δίπλα-δίπλα τα βασικά χαρακτηριστικά των επιλεγμένων οχημάτων.</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-3 gap-4 border-b border-border pb-5">
            {vehicles.map((vehicle) => {
              const title = `${vehicle.maker} ${vehicle.versionName}`;
              return (
                <div key={vehicle.id} className="flex flex-col items-center gap-2 text-center">
                  <div className="relative h-32 w-full overflow-hidden rounded-lg bg-surface">
                    <Image src={vehicle.imageUrl || FALLBACK_VEHICLE_IMAGE} alt={title} fill sizes="240px" className="object-contain" />
                    <button
                      type="button"
                      onClick={() => handleRemove(vehicle.id)}
                      aria-label={`Αφαίρεση ${title} από τη σύγκριση`}
                      className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-ink-muted shadow-soft hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Link href={`/vehicles/${vehicle.slug}`} className="line-clamp-2 text-sm font-semibold text-ink hover:text-primary">
                    {title}
                  </Link>
                  <p className="text-base font-bold text-ink">
                    {vehicle.monthlyPrice ? `Από ${formatEuro(vehicle.monthlyPrice)}` : vehicle.price ? formatEuro(vehicle.price) : "—"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {[vehicle.yearRelease ?? null, vehicle.km !== null ? formatKm(vehicle.km) : null].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              );
            })}
          </div>

          <table className="mt-2 w-full border-collapse text-sm">
            <caption className="sr-only">Πίνακας σύγκρισης χαρακτηριστικών των επιλεγμένων οχημάτων</caption>
            <thead>
              <tr className="sr-only">
                <th scope="col">Χαρακτηριστικό</th>
                {vehicles.map((vehicle) => (
                  <th key={vehicle.id} scope="col">
                    {vehicle.maker} {vehicle.versionName}
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON_GROUP_ORDER.map((group) => {
              const fields = COMPARISON_FIELDS.filter((field) => field.group === group);
              return (
                <tbody key={group} className="border-b border-border">
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={vehicles.length + 1}
                      className="sticky left-0 bg-surface px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-primary"
                    >
                      {COMPARISON_GROUP_LABELS[group]}
                    </th>
                  </tr>
                  {fields.map((field) => {
                    const bestIds = computeBestValueVehicleIds(vehicles, field);
                    return (
                      <tr key={field.id} className="border-t border-border/60">
                        <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-medium text-ink-muted">
                          {field.label}
                        </th>
                        {vehicles.map((vehicle) => {
                          const isBest = bestIds.has(vehicle.id);
                          return (
                            <td key={vehicle.id} className={cn("px-3 py-2.5 text-center text-ink", isBest && "bg-accent/10 font-semibold text-primary")}>
                              {isBest ? (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span>{field.formatValue(field.getValue(vehicle), vehicle)}</span>
                                  {field.bestLabel && (
                                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-dark">
                                      {field.bestLabel}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                field.formatValue(field.getValue(vehicle), vehicle)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted lg:hidden">Σύρετε οριζόντια για να δείτε όλα τα χαρακτηριστικά →</p>

      <div className="mt-8 text-center">
        <Link href="/vehicles" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
          Επιστροφή στα αυτοκίνητα
        </Link>
      </div>
    </div>
  );
}
