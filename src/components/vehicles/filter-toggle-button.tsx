"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// One shared visual/interaction primitive for every full-width toggle
// filter in the /vehicles sidebar — fuel, transmission, vehicle type and
// the single Deals boolean all render through this component, so they
// share one selected/hover/focus design language instead of four
// independently-tuned button implementations. A plain semantic
// `<button type="button">` with `aria-pressed`, not a checkbox or radio —
// each caller decides multi-select vs single-boolean by how it wires
// `selected`/`onToggle`, this component only owns presentation.
export function FilterToggleButton({
  label,
  selected,
  icon: Icon,
  onToggle,
  accessibleLabel,
}: {
  label: string;
  selected: boolean;
  icon?: LucideIcon;
  onToggle: () => void;
  /** Overrides the accessible name when the visible label alone isn't descriptive enough (e.g. the Deals button). */
  accessibleLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={accessibleLabel}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors duration-150 ease-out motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        selected
          ? "border-primary bg-primary font-semibold text-white"
          : "border-border bg-white font-medium text-primary hover:border-primary/40 hover:bg-surface",
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {label}
    </button>
  );
}
