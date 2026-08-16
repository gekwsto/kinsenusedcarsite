"use client";

import * as React from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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
        "group relative inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        showLabel
          ? [
              // Reuses the shared `Button` "outline" variant's own CSS
              // (buttonVariants) as its base — the same shared button
              // system as every other premium CTA on the site — rather
              // than a fully one-off class string, then layers on only the
              // behavior this control actually needs on top: an
              // always-present 1px border (only its *color* changes on
              // hover, so the border never appears/disappears and never
              // shifts layout), a restrained navy hover/active treatment
              // (never cyan — the comparison control stays in the same
              // deep-navy family as every other primary interaction), and
              // color-only transitions (no scale/transform) so hovering
              // never nudges surrounding layout.
              // Tighter padding below `sm:` — at the narrowest phone widths
              // (~320px) the title + this button + the favorite button all
              // share one row (see vehicle-pricing-section.tsx), and the
              // wider sm:px-5 padding this button uses at rest tipped that
              // row into horizontal overflow (measured: 13px past a 320px
              // viewport). px-3 reclaims exactly that without touching the
              // roomier tablet/desktop treatment.
              buttonVariants({ variant: "outline", size: "md" }),
              "h-11 gap-1.5 px-3 font-bold shadow-soft transition-[color,background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none sm:gap-2 sm:px-5",
              "hover:border-primary/30 hover:bg-primary/5 hover:shadow-card",
              active && "border-primary/40 bg-primary/[0.08]",
            ]
          : [
              "rounded-full bg-white/90 shadow-soft backdrop-blur transition-[transform,background-color] duration-200 ease-out hover:scale-105 hover:bg-primary/5 motion-reduce:transition-none",
              size === "sm" ? "h-8 w-8" : "h-10 w-10",
              active && "bg-primary/10",
            ],
        className,
      )}
    >
      <Scale
        className={cn(
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
          active ? "text-primary" : "text-ink-muted",
          // Comparison never turns cyan — hover and the selected state both
          // stay inside the deep-navy family, only Favorite's liked state
          // uses cyan.
          showLabel && !active && "transition-colors duration-200 ease-out group-hover:text-primary motion-reduce:transition-none",
          !showLabel && !active && "transition-colors duration-200 ease-out hover:text-primary motion-reduce:transition-none",
        )}
      />
      {showLabel && (
        <span
          className={cn(
            active
              ? "text-primary"
              : "text-ink transition-colors duration-200 ease-out group-hover:text-primary motion-reduce:transition-none",
          )}
        >
          {active ? "Στη σύγκριση" : "Σύγκριση"}
        </span>
      )}

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
