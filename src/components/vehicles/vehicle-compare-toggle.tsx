"use client";

import * as React from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVehicleComparison } from "@/components/providers/vehicle-comparison-provider";
import type { VehicleComparisonSummary } from "@/lib/vehicle-comparison";

interface VehicleCompareToggleProps {
  vehicle: VehicleComparisonSummary;
  className?: string;
  size?: "sm" | "md";
  /** Shows the "Σύγκριση" text label next to the icon — used where space allows (vehicle-detail page). Cards stay icon-only. */
  showLabel?: boolean;
}

const NOT_SELECTED_LABEL = "Προσθήκη στη σύγκριση";
const SELECTED_LABEL = "Αφαίρεση από τη σύγκριση";

// Reuses the FavoriteButton visual pattern (event.preventDefault +
// stopPropagation, since cards are <Link>s) but is not the same component
// — comparison has its own 3-state icon (active/inactive) and its own
// dependency-free tooltip (no Tooltip primitive exists in
// src/components/ui/, and installing one is out of scope), built from a
// plain absolutely-positioned <span role="tooltip"> shown on hover *and*
// keyboard focus (group-focus-visible), linked via aria-describedby so
// assistive tech announces it too — not just a native `title` attribute.
export function VehicleCompareToggle({ vehicle, className, size = "md", showLabel = false }: VehicleCompareToggleProps) {
  const { isSelected, toggleVehicle, isHydrated } = useVehicleComparison();
  const reactId = React.useId();
  const tooltipId = `compare-tooltip-${reactId}`;

  // Before hydration, real selection state is unknown — render as
  // "not selected" (matches the server-rendered/first-paint state exactly)
  // so there is no hydration mismatch, same pattern as the cookie-consent
  // banner's `resolved` gate.
  const active = isHydrated && isSelected(vehicle.id);
  const label = active ? SELECTED_LABEL : NOT_SELECTED_LABEL;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    toggleVehicle(vehicle, event.currentTarget);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={label}
      aria-describedby={tooltipId}
      className={cn(
        "group relative inline-flex items-center justify-center gap-1.5 rounded-full bg-white/90 shadow-soft backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        showLabel ? "h-11 rounded-lg px-4 text-sm font-medium" : size === "sm" ? "h-8 w-8" : "h-10 w-10",
        active && "bg-primary/10",
        className,
      )}
    >
      <Scale className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5", active ? "text-primary" : "text-ink-muted")} />
      {showLabel && <span className={active ? "text-primary" : "text-ink"}>{active ? "Στη σύγκριση" : "Σύγκριση"}</span>}

      {!showLabel && (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-soft transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          {label}
        </span>
      )}
    </button>
  );
}
