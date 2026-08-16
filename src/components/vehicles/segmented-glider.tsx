"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The shared visual system behind every vehicle-detail two-option segmented
 * control (Χαρακτηριστικά/Έξτρα εξοπλισμός, Leasing/Αγορά): one continuous
 * deep-navy glider that physically slides between two options, rather than
 * each option independently toggling its own background. Both consumers
 * keep fully independent state/behavior — this only centralizes the shared
 * measurement math and glider markup so the two controls can never visually
 * drift apart.
 *
 * Both tones are the same approved Kinsen navy family used by the primary
 * CTA system (`primary`/`primary-dark`, see kinsen-cta-button.tsx) rather
 * than a one-off hex — "a" (the first/left option) is `primary`, "b" (the
 * second/right option) one shade darker, `primary-dark`, so the two options
 * still read as subtly distinct without reaching for a different hue
 * (previously a teal pair, `#0f96a7`/`#00707d` — removed). The shadow is
 * the same restrained `shadow-soft` token used across the rest of the site
 * instead of a bespoke tinted glow.
 */
export type GliderTone = "a" | "b";

const TONE_CLASSNAME: Record<GliderTone, string> = {
  a: "bg-primary shadow-soft",
  b: "bg-primary-dark shadow-soft",
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
 * (tone) — never `left`, so it never triggers a page-level reflow. Render
 * this as the first child of a `position: relative` track, before the two
 * option buttons/triggers (which must sit on `relative z-10` so they paint
 * above it).
 *
 * Previously carried a one-shot diagonal light-sweep highlight on top of
 * the tone fill (remounted per switch via a `sweepKey` prop) — removed:
 * against a solid navy fill it read as a stray white streak/seam crossing
 * the pill mid-transition rather than a polished highlight, so the glider
 * is now just the plain animated tone fill with nothing layered on top of
 * it. `rect`/`tone` are the only two things that ever change here.
 */
export function SegmentedGlider({ rect, tone }: { rect: GliderRect | null; tone: GliderTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-1 left-0 rounded-full transition-[transform,width,background-color,box-shadow] duration-[300ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        TONE_CLASSNAME[tone],
        rect ? "opacity-100" : "opacity-0",
      )}
      style={rect ? { transform: `translateX(${rect.left}px)`, width: `${rect.width}px` } : undefined}
    />
  );
}
