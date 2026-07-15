"use client";

import * as React from "react";
import { formatEuro } from "@/lib/utils";
import { VEHICLE_PRICE_FILTER_MIN, VEHICLE_PRICE_FILTER_MAX, VEHICLE_PRICE_FILTER_STEP } from "@/lib/validators/vehicle.schema";
import { FILTER_RANGE_LABEL_CLASS } from "@/components/vehicles/filter-typography";

// Two overlapping native <input type="range"> elements rather than a
// pointer-coordinate-tracking custom widget — each input already gives us
// full mouse/trackpad/touch/keyboard (arrows, Home/End, Page Up/Down) and
// screen-reader support for free. The CSS below (.kinsen-price-slider in
// globals.css) hides each input's own native track and makes the track
// portion `pointer-events: none`, re-enabling pointer events only on the
// thumb pseudo-element, so a click anywhere on the shared track never gets
// ambiguously claimed by the wrong input — only a direct hit on a thumb
// moves it. No z-index juggling or custom hit-testing required.
//
// Commit timing: React's `onChange` for a range input is aliased to the
// *native* `input` event, so — unlike vanilla DOM `change`, which only
// fires once on release — it fires continuously during drag. There is no
// plain React prop that means "only on release" for a range input, so
// `onChange` here drives only the immediate local visual draft; the actual
// commit is driven by `onMouseUp`/`onTouchEnd`/`onKeyUp` (real
// release/settle signals), reading the already-updated local value at that
// point.
export function PriceRangeSlider({
  minValue,
  maxValue,
  onCommit,
  rangeMin = VEHICLE_PRICE_FILTER_MIN,
  rangeMax = VEHICLE_PRICE_FILTER_MAX,
  rangeStep = VEHICLE_PRICE_FILTER_STEP,
  minAriaLabel = "Ελάχιστη τιμή",
  maxAriaLabel = "Μέγιστη τιμή",
}: {
  /** Draft string value, empty string meaning "at the default bound". */
  minValue: string;
  maxValue: string;
  /**
   * Fired once the interaction settles (pointer release, or a committed
   * keyboard step) — never on every drag pixel. A thumb sitting exactly on
   * its default bound (`rangeMin` for min, `rangeMax` for max) is reported
   * back as an empty string, matching how every other numeric filter field
   * already represents "not set" (see EMPTY_DRAFT in
   * vehicle-filter-provider.tsx), so no separate default-omission logic is
   * needed anywhere downstream.
   */
  onCommit: (min: string, max: string) => void;
  /** Defaults to the purchase-price bounds; pass the Leasing/monthly-price
   * bounds (VEHICLE_MONTHLY_PRICE_FILTER_MIN/MAX/STEP) to reuse this same
   * slider for the "rent" filter instead of duplicating its drag/commit
   * logic. */
  rangeMin?: number;
  rangeMax?: number;
  rangeStep?: number;
  minAriaLabel?: string;
  maxAriaLabel?: string;
}) {
  const committedMin = minValue ? Number(minValue) : rangeMin;
  const committedMax = maxValue ? Number(maxValue) : rangeMax;

  // Local drag draft — updates on every native input event (immediate
  // visual feedback), independent of the canonical filter draft.
  const [localMin, setLocalMin] = React.useState(committedMin);
  const [localMax, setLocalMax] = React.useState(committedMax);

  // Reset the local draft whenever the committed props change from
  // *outside* this component (clear all, chip removal, Back/Forward, a
  // direct URL) so the thumbs never show a stale position. This is React's
  // own documented "adjusting state when a prop changes" pattern — a
  // setState call guarded by comparing against the previous prop value,
  // executed during render — rather than a useEffect, since this repo's
  // lint config (React Compiler's react-hooks/set-state-in-effect rule)
  // flags an unconditional setState-in-effect as a cascading-render risk.
  // See https://react.dev/learn/you-might-not-need-an-effect.
  const [prevMinValue, setPrevMinValue] = React.useState(minValue);
  if (minValue !== prevMinValue) {
    setPrevMinValue(minValue);
    setLocalMin(committedMin);
  }
  const [prevMaxValue, setPrevMaxValue] = React.useState(maxValue);
  if (maxValue !== prevMaxValue) {
    setPrevMaxValue(maxValue);
    setLocalMax(committedMax);
  }

  // Mirrors localMin/localMax for the release handlers below. Kept in sync
  // via an effect (refs may only be written outside of render, per
  // react-hooks/refs) rather than read directly from the handlers'
  // closures, so a commit reads the true settled value even in the
  // extremely narrow case of a release event and a state update landing in
  // the same tick.
  const latestRef = React.useRef({ min: committedMin, max: committedMax });
  React.useEffect(() => {
    latestRef.current = { min: localMin, max: localMax };
  }, [localMin, localMax]);

  const toDraftValue = (value: number, bound: number) => (value === bound ? "" : String(value));

  const commitLatest = () => {
    const { min, max } = latestRef.current;
    onCommit(toDraftValue(min, rangeMin), toDraftValue(max, rangeMax));
  };

  const rangeStartPercent = (localMin / rangeMax) * 100;
  const rangeEndPercent = (localMax / rangeMax) * 100;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={FILTER_RANGE_LABEL_CLASS}>Από</span>
        <span className={FILTER_RANGE_LABEL_CLASS}>Έως</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-bold text-primary">{formatEuro(localMin)}</span>
        <span className="text-base font-bold text-primary">{formatEuro(localMax)}</span>
      </div>

      <div className="kinsen-price-slider relative h-6">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${rangeStartPercent}%`, right: `${100 - rangeEndPercent}%` }}
        />
        <input
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={rangeStep}
          value={localMin}
          aria-label={minAriaLabel}
          aria-valuetext={formatEuro(localMin)}
          onChange={(e) => {
            // Clamp to the other thumb's current value rather than letting
            // the min thumb cross past the max thumb — the active thumb
            // stops at the boundary instead of the two silently swapping
            // identity, which would be disorienting for keyboard users.
            setLocalMin(Math.min(Number(e.currentTarget.value), localMax));
          }}
          onMouseUp={commitLatest}
          onTouchEnd={commitLatest}
          onKeyUp={commitLatest}
          className="absolute inset-0 h-full w-full"
        />
        <input
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={rangeStep}
          value={localMax}
          aria-label={maxAriaLabel}
          aria-valuetext={formatEuro(localMax)}
          onChange={(e) => {
            setLocalMax(Math.max(Number(e.currentTarget.value), localMin));
          }}
          onMouseUp={commitLatest}
          onTouchEnd={commitLatest}
          onKeyUp={commitLatest}
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
