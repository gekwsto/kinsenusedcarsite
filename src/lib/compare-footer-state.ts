// Pure geometry for the floating Compare launcher's relationship with the
// real global Footer (see useFooterAwareCompareState in
// vehicle-comparison-tray.tsx) — kept separate from the observer/DOM
// plumbing that calls it so the actual decision math is directly
// unit-testable with plain numbers.
//
// The model deliberately separates two different quantities that used to
// be conflated into one "requiredLift vs. a total cap" comparison:
//
//  - `baselineLift`: the lift the launcher's NATURAL PAGE-TOP geometry
//    already requires, before the user has scrolled at all. On a short
//    page viewed on a tall viewport, this can legitimately be large (the
//    Footer simply sits close to a launcher anchored near the bottom of
//    a tall viewport) — that is real, unavoidable geometry, not a
//    problem to bound.
//  - `extraLift`: the ADDITIONAL lift beyond that baseline caused by the
//    user actually scrolling further down the page, bringing the Footer
//    genuinely closer. Only this quantity is bounded — a large baseline
//    must never by itself retire the launcher; only excessive further
//    scrolling should.
export type CompareFooterState = "normal" | "avoiding" | "hidden";

export interface CompareFooterStateInput {
  /**
   * The lift required to keep `safeGap` clear of the Footer's *document-space*
   * top edge (i.e. where the Footer would sit relative to the launcher if
   * the page were scrolled all the way to the top) — see
   * calculateFooterDocumentTop below for how this is derived without
   * ever actually scrolling the page. Always `>= 0` after clamping.
   */
  baselineLift: number;
  /**
   * The lift required to keep `safeGap` clear of the Footer's real,
   * *current* (viewport-relative, live) top edge at the current scroll
   * position. Always `>= 0` after clamping.
   */
  currentRequiredLift: number;
  /** The bounded budget for lift beyond the baseline — the only quantity this model ever caps. */
  maxExtraLift: number;
}

export interface CompareFooterStateResult {
  state: CompareFooterState;
  /** The clamped baseline component actually used (mirrors the input, `>= 0`). */
  baselineLift: number;
  /** How much of `currentRequiredLift` exceeds `baselineLift`, bounded by `maxExtraLift` in the returned value (frozen there once "hidden"). */
  extraLift: number;
  /** `baselineLift + extraLift` — the actual upward `translateY` distance to apply while visible (and, frozen, while hidden). */
  visualLift: number;
}

/**
 * Decides the launcher's state from a baseline/current geometry pair:
 *  - `normal`: neither the page's natural geometry nor the current
 *    scroll position require any lift at all.
 *  - `avoiding`: some lift is required — whether from the baseline
 *    alone, from extra scroll, or both — and the *extra* portion is
 *    still within budget. The launcher stays fully visible/interactive.
 *  - `hidden`: the *extra* scroll-driven lift beyond the baseline has
 *    exceeded its bounded budget. `visualLift` freezes at
 *    `baselineLift + maxExtraLift` — it never grows further, no matter
 *    how much deeper the user keeps scrolling.
 *
 * Critically, an arbitrarily large `baselineLift` alone (extraLift == 0)
 * always resolves to a visible state — see the "huge baseline" test case.
 */
export function calculateCompareFooterState({ baselineLift, currentRequiredLift, maxExtraLift }: CompareFooterStateInput): CompareFooterStateResult {
  const safeBaseline = Math.max(0, baselineLift);
  const safeCurrent = Math.max(0, currentRequiredLift);
  const extraLift = Math.max(0, safeCurrent - safeBaseline);

  if (extraLift > maxExtraLift) {
    return { state: "hidden", baselineLift: safeBaseline, extraLift: maxExtraLift, visualLift: safeBaseline + maxExtraLift };
  }
  if (safeBaseline === 0 && extraLift === 0) {
    return { state: "normal", baselineLift: 0, extraLift: 0, visualLift: 0 };
  }
  return { state: "avoiding", baselineLift: safeBaseline, extraLift, visualLift: safeBaseline + extraLift };
}

/**
 * The Footer's top edge in *document* coordinates — i.e. where it would
 * sit relative to the viewport if `scrollY` were 0 — derived purely
 * mathematically, without ever physically scrolling the page.
 * `getBoundingClientRect().top` is viewport-relative (it decreases by
 * exactly the scroll distance as the user scrolls down); adding the
 * current `scrollY` back cancels that out, leaving a value that only
 * changes when the document's real layout changes (Footer content,
 * page content above it, viewport size), never merely from scrolling.
 * This is what makes `baselineLift` (computed from this) stable while
 * the user scrolls, instead of collapsing toward `currentRequiredLift`
 * and erasing the very budget "extraLift" is meant to measure.
 */
export function calculateFooterDocumentTop(footerViewportTop: number, scrollY: number): number {
  return footerViewportTop + scrollY;
}

// The bounded "extra" travel budget — small and mostly viewport-height-
// insensitive, since the height-driven component of the geometry is now
// fully captured by `baselineLift` itself. This only needs to cover "how
// much further should a graceful Footer avoidance be allowed to travel
// once the user actually keeps scrolling" before the launcher retires —
// tuned via real browser testing (see vehicle-comparison-tray-visual.spec.ts
// and this session's own visual verification across the required
// viewport matrix), not the dominant driver of visible movement anymore.
export const COMPARE_FOOTER_MAX_EXTRA_LIFT_MIN = 64;
export const COMPARE_FOOTER_MAX_EXTRA_LIFT_RATIO = 0.08;
export const COMPARE_FOOTER_MAX_EXTRA_LIFT_CAP = 140;

export function calculateCompareFooterMaxExtraLift(viewportHeight: number): number {
  return Math.min(COMPARE_FOOTER_MAX_EXTRA_LIFT_CAP, Math.max(COMPARE_FOOTER_MAX_EXTRA_LIFT_MIN, viewportHeight * COMPARE_FOOTER_MAX_EXTRA_LIFT_RATIO));
}

// Mobile/desktop safe gap (px) kept while avoiding — within the
// 12–20 (mobile) / 16–24 (desktop) target ranges. Same 640px (`sm`)
// breakpoint already used for this control's own responsive sizing.
export const COMPARE_FOOTER_GAP_MOBILE = 16;
export const COMPARE_FOOTER_GAP_DESKTOP = 20;
export const COMPARE_FOOTER_GAP_DESKTOP_BREAKPOINT = 640;

export function calculateCompareFooterGap(viewportWidth: number): number {
  return viewportWidth >= COMPARE_FOOTER_GAP_DESKTOP_BREAKPOINT ? COMPARE_FOOTER_GAP_DESKTOP : COMPARE_FOOTER_GAP_MOBILE;
}
