"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The shared visual system behind every vehicle-detail two-option segmented
 * control (Χαρακτηριστικά/Έξτρα εξοπλισμός, Leasing/Αγορά): one continuous
 * teal glider that physically slides + morphs color between two options,
 * rather than each option independently toggling its own background. Both
 * consumers keep fully independent state/behavior — this only centralizes
 * the shared measurement math and glider markup so the two controls can
 * never visually drift apart.
 *
 * "a" (brighter teal) is always the first/left option's tone, "b" (deeper,
 * richer teal) the second/right option's — matching the finalized
 * Χαρακτηριστικά/Έξτρα εξοπλισμός treatment exactly, reused verbatim rather
 * than re-derived, so both controls read as one design system.
 */
export type GliderTone = "a" | "b";

const TONE_CLASSNAME: Record<GliderTone, string> = {
  a: "bg-[#0f96a7] shadow-[0_6px_16px_rgba(0,137,154,0.30),inset_0_1px_0_rgba(255,255,255,0.35)]",
  b: "bg-[#00707d] shadow-[0_6px_16px_rgba(0,112,125,0.32),inset_0_1px_0_rgba(255,255,255,0.30)]",
};

export interface GliderRect {
  left: number;
  width: number;
}

/**
 * Measures the active option's real rendered box (`offsetLeft`/
 * `offsetWidth` against `containerRef`, which must be `position: relative`
 * — its offset parent) rather than assuming a hardcoded 50/50 split. This
 * keeps the glider pixel-perfect whether the two options happen to be equal
 * width (a `grid-cols-2` control) or intentionally unequal (a compact,
 * content-sized pill), at any viewport, without requiring any change to
 * either consumer's existing sizing.
 */
export function useGliderRect(
  containerRef: React.RefObject<HTMLElement | null>,
  activeRef: React.RefObject<HTMLElement | null>,
  activeKey: string,
): GliderRect | null {
  const [rect, setRect] = React.useState<GliderRect | null>(null);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const target = activeRef.current;
    if (!container || !target) return;
    const measure = () => setRect({ left: target.offsetLeft, width: target.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measures on every active-option change; the refs themselves are stable
  }, [activeKey]);

  return rect;
}

/**
 * The glider itself: an absolutely-positioned overlay animating only
 * `transform`/`width` (position) plus `background-color`/`box-shadow`
 * (tone) — never `left`, so it never triggers a page-level reflow — with a
 * one-shot light-sweep highlight remounted via `sweepKey` on every switch.
 * Render this as the first child of a `position: relative` track, before
 * the two option buttons/triggers (which must sit on `relative z-10` so
 * they paint above it).
 */
export function SegmentedGlider({ rect, tone, sweepKey }: { rect: GliderRect | null; tone: GliderTone; sweepKey: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-1 left-0 rounded-full transition-[transform,width,background-color,box-shadow] duration-[300ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        TONE_CLASSNAME[tone],
        rect ? "opacity-100" : "opacity-0",
      )}
      style={rect ? { transform: `translateX(${rect.left}px)`, width: `${rect.width}px` } : undefined}
    >
      <span key={sweepKey} className="absolute inset-0 overflow-hidden rounded-full">
        <span className="absolute inset-y-0 left-0 w-1/3 animate-tab-glider-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent motion-reduce:hidden" />
      </span>
    </span>
  );
}
