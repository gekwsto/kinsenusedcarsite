"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { useVehicleComparison } from "@/components/providers/vehicle-comparison-provider";
import { useNavigationTransition } from "@/components/providers/navigation-transition-provider";
import { cn, formatEuro, formatKm, FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";
import { buildComparisonUrl } from "@/lib/vehicle-comparison";
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
// eligible-count (MIN_COMPARISON_VEHICLES..MAX_COMPARISON_VEHICLES) real-
// vehicle URL (see VehicleComparisonProvider's syncSelectionFromUrl doc for
// the full precedence rule), then renders the summary header + grouped
// matrix for however many vehicles (2 or 3) were resolved. page.tsx (server
// component) only ever mounts this once it has already confirmed an
// eligible set of valid public vehicles resolved from the URL's IDs — this
// component never re-validates that itself.
export function ComparisonMatrix({ vehicles }: { vehicles: readonly ComparisonPageVehicle[] }) {
  const { syncSelectionFromUrl, removeVehicle, closeSidebar } = useVehicleComparison();
  const router = useRouter();
  const transition = useNavigationTransition();

  const idsKey = vehicles.map((v) => v.id).join(",");
  React.useEffect(() => {
    syncSelectionFromUrl(vehicles.map((v) => v.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // The desktop comparison tray auto-opens on every add (see
  // VehicleComparisonProvider.addVehicle), and its own "Δείτε τη σύγκριση"
  // CTA is what normally lands a visitor here — so on the ordinary path,
  // the tray is still open, fixed over the right ~420px of the viewport,
  // the moment this page mounts. Left open, it visually covers this page's
  // own rightmost vehicle column (image, title, price, and that vehicle's
  // remove button end up hidden underneath it) — this page IS the full
  // equivalent of what the tray shows in miniature, so once its own matrix
  // is on screen the tray is redundant here. Closing it (not hiding it
  // with CSS) is what actually frees that space; the collapsed pill still
  // lets a visitor reopen it manually if they want. Runs once per mount —
  // this page never needs to re-close a tray the visitor deliberately
  // reopened while already here.
  React.useEffect(() => {
    closeSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemove = (id: string) => {
    removeVehicle(id);
    // Removing one vehicle only breaks eligibility once it drops the
    // selection below MIN_COMPARISON_VEHICLES (e.g. 3 -> 2 stays a valid
    // comparison; 2 -> 1 does not) — task requirement: never render a
    // misleading partial matrix, and never auto-pick a replacement.
    // buildComparisonUrl already encodes that same eligibility rule, so
    // reusing it here (rather than a local length check) keeps this in
    // sync with the provider's own canCompare logic by construction.
    const remainingIds = vehicles.filter((v) => v.id !== id).map((v) => v.id);
    const nextUrl = buildComparisonUrl(remainingIds);
    const destination = nextUrl ?? "/vehicles";
    if (transition) transition.navigate(destination);
    else router.push(destination);
  };

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">Σύγκριση Αυτοκινήτων</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Δείτε δίπλα-δίπλα τα βασικά χαρακτηριστικά των επιλεγμένων οχημάτων.</p>
      </div>

      <div className="overflow-x-auto">
        {/*
          Header and data rows are cells of one <table>, not a separate CSS
          grid above an unrelated table — that split was the root cause of
          the summary cards (and their remove buttons) drifting out of
          alignment with the value columns beneath them: a bare N-column
          grid has no left offset for the row-label column, while the table
          implicitly reserves one via its own sticky <th scope="row">, so
          vehicle N in the grid and vehicle N's data column in the table
          landed at two different horizontal positions. Being literal cells
          of the same table/colgroup makes that structurally impossible —
          the browser's table column-sizing keeps every cell in a column
          the same width across every row, header included, with no
          measurement or synced-scroll-container bookkeeping required.
        */}
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <caption className="sr-only">Πίνακας σύγκρισης χαρακτηριστικών των επιλεγμένων οχημάτων</caption>
          <colgroup>
            {/* Fixed label-column width; the vehicle <col>s below deliberately
                have no width of their own, so table-layout:fixed divides the
                remaining space equally between them — the native mechanism
                for "N equal-width vehicle columns" with no width math, no
                viewport-specific numbers, and no risk of drifting from the
                header's own columns since it's the same <colgroup>. */}
            <col className="w-28 sm:w-40" />
            {vehicles.map((vehicle) => (
              <col key={vehicle.id} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-10 bg-white">
                <span className="sr-only">Χαρακτηριστικό</span>
              </th>
              {vehicles.map((vehicle) => {
                const title = `${vehicle.maker} ${vehicle.versionName}`;
                return (
                  <th key={vehicle.id} scope="col" aria-label={title} className="px-2 pb-5 pt-3 align-top font-normal sm:px-3">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="relative h-32 w-full overflow-hidden rounded-lg bg-surface">
                        <Image src={vehicle.imageUrl || FALLBACK_VEHICLE_IMAGE} alt={title} fill sizes="240px" className="object-contain" />
                        <button
                          type="button"
                          onClick={() => handleRemove(vehicle.id)}
                          aria-label={`Αφαίρεση ${title} από τη σύγκριση`}
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-ink-muted shadow-soft hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
                  </th>
                );
              })}
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

      <p className="mt-3 text-xs text-ink-muted lg:hidden">Σύρετε οριζόντια για να δείτε όλα τα χαρακτηριστικά →</p>

      <div className="mt-8 text-center">
        <Link href="/vehicles" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
          Επιστροφή στα αυτοκίνητα
        </Link>
      </div>
    </div>
  );
}
