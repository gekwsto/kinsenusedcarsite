"use client";

import * as React from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FILTER_RANGE_LABEL_CLASS } from "@/components/vehicles/filter-typography";

// Radix Select reserves value="" to mean "no selection" internally (an
// item with an empty value throws), so the "no restriction" choice below
// uses this sentinel and is translated to/from the canonical empty-string
// draft convention right at this component's boundary — every other layer
// (draft, URL, chips, server query) still only ever sees "" for "not set".
const UNSET_SENTINEL = "__unset__";

// Shared by the year/mileage/cc/hp filter sections (see VEHICLE_FILTER_RANGES
// in vehicle.schema.ts) — one small typed control instead of four nearly
// identical from/to dropdown-pair blocks. Each selection commits
// immediately (the parent's onMinChange/onMaxChange is expected to route
// into VehicleFilterProvider's setNumericValue, which applies without a
// debounce — a dropdown choice is already a single discrete, explicit
// action, unlike free-typed numeric input).
export function NumericRangeSelect({
  options,
  minValue,
  maxValue,
  minAriaLabel,
  maxAriaLabel,
  minPlaceholder,
  maxPlaceholder,
  formatOption,
  onMinChange,
  onMaxChange,
}: {
  /** Ascending, deduplicated option list — see createNumericRange. */
  options: number[];
  /** Canonical draft string value; "" means "no restriction". */
  minValue: string;
  maxValue: string;
  minAriaLabel: string;
  maxAriaLabel: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  formatOption: (value: number) => string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const minNumeric = minValue ? Number(minValue) : undefined;
  const maxNumeric = maxValue ? Number(maxValue) : undefined;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className={FILTER_RANGE_LABEL_CLASS}>Από</Label>
        <Select value={minValue || UNSET_SENTINEL} onValueChange={(next) => onMinChange(next === UNSET_SENTINEL ? "" : next)}>
          <SelectTrigger
            aria-label={minAriaLabel}
            className={cn("h-11 text-sm", minValue ? "font-medium text-primary" : "text-ink-muted")}
          >
            <SelectValue placeholder={minPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET_SENTINEL}>{minPlaceholder}</SelectItem>
            {options.map((option) => (
              // Once a maximum is chosen, a minimum above it is disabled
              // rather than silently swapped or clamped — the invalid
              // combination simply isn't offered in the first place.
              <SelectItem key={option} value={String(option)} disabled={maxNumeric !== undefined && option > maxNumeric}>
                {formatOption(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className={FILTER_RANGE_LABEL_CLASS}>Έως</Label>
        <Select value={maxValue || UNSET_SENTINEL} onValueChange={(next) => onMaxChange(next === UNSET_SENTINEL ? "" : next)}>
          <SelectTrigger
            aria-label={maxAriaLabel}
            className={cn("h-11 text-sm", maxValue ? "font-medium text-primary" : "text-ink-muted")}
          >
            <SelectValue placeholder={maxPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET_SENTINEL}>{maxPlaceholder}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={String(option)} disabled={minNumeric !== undefined && option < minNumeric}>
                {formatOption(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
