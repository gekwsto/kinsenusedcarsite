"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, Scale } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { KINSEN_CTA_BUTTON_CLASSNAME } from "@/components/ui/kinsen-cta-button";
import { useVehicleComparison } from "@/components/providers/vehicle-comparison-provider";
import { useCookieConsent } from "@/components/providers/cookie-consent-provider";
import { cn, formatEuro, formatKm, FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";
import {
  calculateCompareFooterState,
  calculateFooterDocumentTop,
  calculateCompareFooterMaxExtraLift,
  calculateCompareFooterGap,
  type CompareFooterState,
} from "@/lib/compare-footer-state";
import type { VehicleComparisonSummary } from "@/lib/vehicle-comparison";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function useIsDesktopViewport(): boolean {
  // This hook is called unconditionally on every render of
  // VehicleComparisonTray, including the server-side render pass — a
  // `return null` later in that component does NOT stop its hooks from
  // running first, so the initializer itself must survive SSR (no
  // `window` global there) even though the component's rendered *output*
  // is always null until hydration resolves. `typeof window` is the safe
  // check; the real value is corrected by the effect below immediately
  // after mount, before this ever produces visible output (VehicleComparisonTray
  // still renders null on the client's first pass too, since `isHydrated`
  // itself starts false — so this never causes a hydration mismatch).
  const [isDesktop, setIsDesktop] = React.useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_MEDIA_QUERY).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleChange = () => setIsDesktop(mql.matches);
    handleChange();
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

/** `min`/`max` are always MIN_COMPARISON_VEHICLES/MAX_COMPARISON_VEHICLES, passed in from context rather than imported directly so this stays consistent with whatever canCompare/comparisonUrl actually decided. */
function progressCopy(count: number, min: number, max: number): string {
  if (count === 0) return "Προσθέστε αυτοκίνητα για να ξεκινήσετε τη σύγκριση.";
  if (count < min) {
    const remaining = min - count;
    return `Προσθέστε ακόμη ${remaining} αυτοκίνητ${remaining === 1 ? "ο" : "α"} για σύγκριση.`;
  }
  if (count < max) return "Μπορείτε να δείτε τη σύγκριση ή να προσθέσετε ακόμη ένα αυτοκίνητο.";
  return "Τα αυτοκίνητα είναι έτοιμα για σύγκριση.";
}

function ComparisonSlot({ index, vehicle, onRemove }: { index: number; vehicle: VehicleComparisonSummary | undefined; onRemove: (id: string) => void }) {
  if (!vehicle) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface/60 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-white text-xs font-semibold text-ink-muted">
          {index + 1}
        </div>
        <p className="text-sm text-ink-muted">Προσθέστε ακόμη ένα αυτοκίνητο</p>
      </div>
    );
  }

  const title = `${vehicle.maker} ${vehicle.versionName}`;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 shadow-soft">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface">
        <Image src={vehicle.imageUrl ?? FALLBACK_VEHICLE_IMAGE} alt={title} fill sizes="56px" className="object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/vehicles/${vehicle.slug}`} className="block truncate text-sm font-semibold text-ink hover:text-primary">
          {title}
        </Link>
        <p className="truncate text-xs text-ink-muted">
          {[vehicle.yearRelease ?? null, vehicle.km !== null ? formatKm(vehicle.km) : null].filter(Boolean).join(" · ") || "—"}
        </p>
        <p className="text-sm font-bold text-ink">
          {vehicle.monthlyPrice ? `Από ${formatEuro(vehicle.monthlyPrice)}` : vehicle.price ? formatEuro(vehicle.price) : "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(vehicle.id)}
        aria-label={`Αφαίρεση ${title} από τη σύγκριση`}
        className="shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function PanelBody({ titleId, onClose }: { titleId: string; onClose?: () => void }) {
  const { selectedVehicles, selectedCount, maxVehicles, minVehicles, removeVehicle, clearVehicles, canCompare, comparisonUrl } = useVehicleComparison();
  const slots = Array.from({ length: maxVehicles }, (_, index) => selectedVehicles[index]);

  return (
    <>
      {/* `flex-wrap` (not a fixed breakpoint-specific stacked layout) is
          the safety net for the narrowest phones: if "Εκκαθάριση όλων"
          doesn't fit beside the title on one line, it wraps to its own
          line below instead of colliding with anything — correct at any
          width without hardcoding when that happens, and unaffected by
          future label/font-size changes. On desktop (`onClose` passed),
          the close button is a genuine flex sibling of "Εκκαθάριση
          όλων" in the same reserved action cluster — not an absolutely
          positioned overlay — so the two can never occupy the same space.
          On mobile, the Sheet's own built-in close button is a separate,
          fixed `right-4 top-4` element outside this component's control
          (shared across every Sheet consumer in the app, intentionally
          untouched here); `pr-8` reserves enough clearance for its actual
          footprint so this row's own content never reaches under it. */}
      <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2", !onClose && "pr-8")}>
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold text-primary">
            Σύγκριση οχημάτων
          </h2>
          <p className="text-sm font-semibold text-ink-muted">
            {selectedCount}/{maxVehicles} επιλεγμένα
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearVehicles}
              className="rounded-md px-2 py-1.5 text-sm font-semibold text-ink-muted underline-offset-2 hover:bg-surface hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Εκκαθάριση όλων
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Κλείσιμο σύγκρισης"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {slots.map((vehicle, index) => (
          <ComparisonSlot key={vehicle?.id ?? `empty-${index}`} index={index} vehicle={vehicle} onRemove={removeVehicle} />
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-3 text-sm text-ink-muted">{progressCopy(selectedCount, minVehicles, maxVehicles)}</p>
        {/* Same static Kinsen corporate CTA as "Σύνδεση" (see
            kinsen-cta-button.tsx) — full-width, this panel's own
            comfortable height. `disabled:opacity-50
            disabled:pointer-events-none` (already on the shared Button
            base) keeps the disabled branch below from reading as
            interactive. */}
        {canCompare && comparisonUrl ? (
          <Button asChild variant="primary" className={cn(KINSEN_CTA_BUTTON_CLASSNAME, "h-14 w-full rounded-md text-base")}>
            <Link href={comparisonUrl}>Δείτε τη σύγκριση</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            disabled
            aria-disabled="true"
            className={cn(KINSEN_CTA_BUTTON_CLASSNAME, "h-14 w-full rounded-md text-base")}
          >
            Δείτε τη σύγκριση
          </Button>
        )}
      </div>
    </>
  );
}

// The cookie banner's real rendered height varies a lot with viewport
// width (its Greek copy wraps to 2-3 lines on narrow phones — measured up
// to ~380px tall at 390px width) — a guessed fixed pixel offset undershot
// this badly and let the collapsed control sit underneath the banner.
// Measuring the actual element is the only reliable way to always clear
// it — but a one-time measurement on mount plus a `resize` listener still
// missed one real case (proven by a captured Firefox E2E failure
// screenshot): if the banner's own web font hasn't finished loading yet
// at the moment of that first measurement, its Greek text can wrap to
// fewer lines under the fallback font than it does once Manrope swaps in,
// so the initial height is measured too short and never re-measured
// (font swap fires no `resize` event). A ResizeObserver on the banner
// element itself re-measures on *any* height change — font swap, text
// reflow, viewport change, or its own entrance transition completing —
// without needing to enumerate every possible cause individually.
function useCookieBannerClearance(bannerVisible: boolean): number {
  const [clearance, setClearance] = React.useState(16);

  React.useEffect(() => {
    if (!bannerVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClearance(16);
      return;
    }

    const banner = document.querySelector('[role="region"][aria-label="Ειδοποίηση για cookies"]');
    if (!banner) return;

    const measure = () => setClearance(banner.getBoundingClientRect().height + 16);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => observer.disconnect();
  }, [bannerVisible]);

  return clearance;
}

// The extra downward "settle" nudge (px) composed on top of the current
// visual lift only while fully hidden — see useFooterAwareCompareState
// below for how the two combine into one transform.
const COMPARE_HIDE_SETTLE_PX = 8;

// Drives the floating launcher's relationship with the real global
// Footer using a baseline/extra model (see calculateCompareFooterState,
// src/lib/compare-footer-state.ts, for the full rationale): the lift the
// page's natural, unscrolled geometry already requires (`baselineLift` —
// on a short page viewed on a tall viewport this can legitimately be
// large, and must never by itself hide the launcher) is computed
// separately from the *additional* lift caused by the user actually
// scrolling further (`extraLift` — small, bounded, the only quantity
// that can ever push the launcher into "hidden"). This hook is only the
// observer/measurement/DOM plumbing around that pure function.
//
// `baselineLift` is derived from the Footer's *document-space* top edge
// (calculateFooterDocumentTop: `rect.top + window.scrollY`) rather than
// by physically scrolling the page to measure it — that value is
// mathematically invariant to the current scroll position (the `+
// scrollY` term exactly cancels the `-scrollY` baked into
// `getBoundingClientRect()` by the browser), so recomputing it on every
// measurement tick is both correct (always reflects the page's real,
// current layout — Footer content changes, viewport resizes, different
// page after a route change) and *stable* while the user merely scrolls
// (it only changes when the underlying layout genuinely changes, per
// section 15/16 of the brief — no separate caching/staleness logic is
// needed for that guarantee, it falls out of the math itself).
//
// Performance: one IntersectionObserver against the Footer gates an
// `isNear` flag sized to the (now small, bounded) `maxExtraLift` budget
// — not the old, potentially-huge total lift — since a short page's
// large baseline already makes the Footer genuinely visible/intersecting
// from the start, the *default* (near-viewport-sized) IntersectionObserver
// already reports "near" correctly for that case with no special-casing.
// While outside that zone, nothing else runs; inside it, a passive,
// rAF-throttled scroll listener re-runs the precise pure-function math.
// `state` (normal/avoiding/hidden) is React state (changes rarely,
// drives aria/class attributes); `visualLift` is written directly to the
// DOM node's own `transform` via ref on every relevant tick — never a
// React re-render per scroll pixel.
//
// `visualLift`'s own CSS transition is asymmetric: while continuously
// tracking the Footer within the *same* state, an *increasing* lift
// (Footer getting closer) snaps instantly rather than animating — the
// Footer itself has no transition of its own, so a fast/large scroll can
// move it well past this control's still-animating position within one
// transition window otherwise. A *decreasing* lift and any actual state
// boundary crossing (normal↔avoiding↔hidden) get the full smooth
// transition. The very first measurement inside each effect run (mount,
// or after a route change / geometry-affecting prop change) is always
// applied instantly regardless — establishing a large baseline should
// read as "that's just where it starts", never as a dramatic travel
// animation (section 20/21 of the brief); `useLayoutEffect` (not
// `useEffect`) ensures that first correction lands before the browser's
// first paint of this component, so there is no flash of the wrong
// (unlifted) position either. This hook only ever mounts client-side
// (VehicleComparisonTray gates on `isHydrated` first), so there is no
// SSR warning risk from using the layout-effect form here.
function useFooterAwareCompareState(button: HTMLButtonElement | null, clearance: number, routeKey: string): CompareFooterState {
  const [state, setState] = React.useState<CompareFooterState>("normal");
  // Persists across effect *recreation* (route changes, clearance changes)
  // — unlike an effect-local variable, which would reset to "normal" on
  // every new run regardless of what React's own `state` actually still
  // is. Without this, a route change landing on "normal" geometry right
  // after a prior route left `state` as "hidden" would compute
  // `result.state !== <freshly-reset-local "normal">` as `false` and
  // never call `setState`, leaving the launcher stuck hidden.
  const currentStateRef = React.useRef<CompareFooterState>("normal");

  React.useLayoutEffect(() => {
    const footer = document.querySelector<HTMLElement>("[data-site-footer]");
    const publicMain = document.querySelector<HTMLElement>("[data-public-main]");
    if (!button || !footer) return;

    let currentVisualLift = 0;
    let rafId: number | null = null;
    let isNear = false;
    let isFirstMeasurement = true;
    let intersectionObserver: IntersectionObserver | null = null;

    const applyVisual = (visualLift: number, nextState: CompareFooterState, smooth: boolean) => {
      const settle = nextState === "hidden" ? COMPARE_HIDE_SETTLE_PX : 0;
      const total = visualLift - settle; // net upward distance; the hide settle nudges it back down slightly while fading
      button.style.transitionDuration = smooth ? "" : "0ms";
      button.style.transform = total !== 0 ? `translateY(${-total}px)` : "";
      currentVisualLift = visualLift;
    };

    const measure = () => {
      rafId = null;
      const viewportHeight = window.innerHeight;
      const safeGap = calculateCompareFooterGap(window.innerWidth);
      const maxExtraLift = calculateCompareFooterMaxExtraLift(viewportHeight);
      const launcherBottom = viewportHeight - parseFloat(getComputedStyle(button).bottom);
      const footerRect = footer.getBoundingClientRect();
      const footerDocumentTop = calculateFooterDocumentTop(footerRect.top, window.scrollY);

      const result = calculateCompareFooterState({
        baselineLift: launcherBottom + safeGap - footerDocumentTop,
        currentRequiredLift: launcherBottom + safeGap - footerRect.top,
        maxExtraLift,
      });

      const stateChanged = result.state !== currentStateRef.current;
      // Continuous same-state tracking only snaps on an *increase*; any
      // actual state change or the very first measurement of this effect
      // run always gets a stable (non-animated) application.
      const smooth = !isFirstMeasurement && (stateChanged || result.visualLift <= currentVisualLift);
      if (stateChanged) {
        currentStateRef.current = result.state;
        setState(result.state);
      }
      applyVisual(result.visualLift, result.state, smooth);
      isFirstMeasurement = false;
    };

    const scheduleMeasure = () => {
      if (!isNear || rafId !== null) return;
      rafId = requestAnimationFrame(measure);
    };

    measure(); // synchronous initial read, before paint (useLayoutEffect) — correct from the very first frame even on a short page with a large baseline.

    const handleScrollOrResize = () => scheduleMeasure();
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });

    const resizeObserver = new ResizeObserver(() => scheduleMeasure());
    resizeObserver.observe(footer);
    resizeObserver.observe(button);

    // The Footer's own size rarely changes, but its *document position*
    // does whenever the public content above it (vehicle list, marketing
    // content) changes height — e.g. a realtime `router.refresh()`, or a
    // route change landing on content whose real size differs from
    // whatever was momentarily still in the DOM at this effect's very
    // first synchronous measurement — with no pathname change, viewport
    // resize, or Footer/button size change of its own. A *separate*
    // observer (rather than folding it into the one above) deliberately
    // bypasses the `isNear` proximity gate: that gate exists purely to
    // skip the continuous scroll-tracking work when nothing is currently
    // relevant, but a genuine content-height change must always be
    // reflected immediately, even while the Footer is currently far from
    // the viewport — otherwise a wrong measurement taken while far away
    // would stay silently stale until the user happened to scroll close
    // enough to reopen the gate on its own.
    let mainResizeObserver: ResizeObserver | null = null;
    if (publicMain) {
      mainResizeObserver = new ResizeObserver(() => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(measure);
      });
      mainResizeObserver.observe(publicMain);
    }

    const createIntersectionObserver = () => {
      intersectionObserver?.disconnect();
      // A modest pre-filter zone sized to the bounded extra-lift budget
      // (plus headroom) — not the (now unbounded) baseline, which the
      // synchronous initial `measure()` above already establishes
      // correctly regardless of this observer's own state. Recreated on
      // resize since `maxExtraLift` is viewport-height-derived.
      const zone = calculateCompareFooterMaxExtraLift(window.innerHeight) + 64;
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          isNear = entry?.isIntersecting ?? false;
          if (isNear) scheduleMeasure();
        },
        { rootMargin: `0px 0px ${zone}px 0px`, threshold: 0 },
      );
      intersectionObserver.observe(footer);
    };
    createIntersectionObserver();

    const handleResize = () => {
      createIntersectionObserver();
      scheduleMeasure();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      mainResizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
    // `routeKey` (the current pathname) is a deliberate dependency, not
    // used inside the effect body — the public layout persists across
    // client-side route changes, so the Footer's own DOM node is not
    // remounted and its *size* may not change between routes even though
    // its *position* does (different page content above it) — a
    // ResizeObserver on the Footer alone cannot see a pure position
    // shift. Recreating this effect (and its synchronous initial
    // `measure()`) on every route change is what re-establishes the
    // correct baseline for whatever page is now actually rendered.
  }, [button, clearance, routeKey]);

  return state;
}

function CollapsedControl() {
  const { selectedCount, isSidebarOpen, openSidebar, maxVehicles } = useVehicleComparison();
  const { bannerVisible } = useCookieConsent();
  const clearance = useCookieBannerClearance(bannerVisible);
  const pathname = usePathname();
  const [buttonNode, setButtonNode] = React.useState<HTMLButtonElement | null>(null);
  const footerState = useFooterAwareCompareState(buttonNode, clearance, pathname);
  const hidden = footerState === "hidden";

  // Focus-edge-case safety (section 17 of the brief): if the launcher
  // happened to be the actively focused element at the exact moment it
  // transitions to `aria-hidden`, browsers do not automatically move
  // focus away from a now-hidden-from-the-a11y-tree element — blur it
  // explicitly so keyboard focus never sits invisibly. Never fires during
  // ordinary "avoiding" movement, only the avoiding→hidden edge.
  React.useEffect(() => {
    if (hidden && buttonNode && document.activeElement === buttonNode) {
      buttonNode.blur();
    }
  }, [hidden, buttonNode]);

  if (isSidebarOpen || selectedCount === 0) return null;

  return (
    // A persistent right-anchored utility, not a centered CTA — `fixed`
    // lives directly on the Button, anchored as close to the real
    // viewport edge as is visually safe (`right-*` below), respecting
    // `env(safe-area-inset-right)` on notched/rounded-corner devices —
    // never `left-1/2 -translate-x-1/2` centering. The dynamic
    // cookie-banner clearance (see useCookieBannerClearance above) is
    // this same element's own inline `bottom` — its one normal-state
    // position; useFooterAwareCompareState above composes a bounded
    // upward `transform` on top of it (never touching `bottom` itself)
    // while avoiding, and fades it out only once even that bound isn't
    // enough. `pointer-events-none` + `tabIndex={-1}` + `aria-hidden`
    // while hidden keep it from being clickable or invisibly focusable;
    // all three are cleared the instant the Footer clears the hidden
    // threshold, restoring normal interaction.
    <Button
      ref={setButtonNode}
      type="button"
      variant="primary"
      onClick={(event) => openSidebar(event.currentTarget)}
      aria-label={`Άνοιγμα σύγκρισης οχημάτων, ${selectedCount} από ${maxVehicles} επιλεγμένα`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${clearance}px)` }}
      className={cn(
        KINSEN_CTA_BUTTON_CLASSNAME,
        "fixed z-[45] right-[calc(env(safe-area-inset-right)+6px)] gap-2 rounded-md px-4 text-sm shadow-card transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:h-14 sm:gap-2.5 sm:px-5 sm:text-[15px] md:text-base lg:right-[calc(env(safe-area-inset-right)+8px)] lg:px-6 2xl:h-[58px] 2xl:text-[17px] h-12",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <Scale className="h-4 w-4 lg:h-5 lg:w-5" />
      Σύγκριση οχημάτων · {selectedCount}/{maxVehicles}
    </Button>
  );
}

function DesktopPanel() {
  const { isSidebarOpen, closeSidebar, lastTriggerRef } = useVehicleComparison();
  const shouldReduceMotion = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const wasOpenRef = React.useRef(false);

  // Non-modal panel — no focus trap, page stays interactive — but Escape
  // still collapses it for keyboard users, and focus is deliberately
  // restored to the exact opener on close (never document.activeElement,
  // for the same proven cross-browser reason as CookieConsentProvider).
  React.useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen, closeSidebar]);

  React.useEffect(() => {
    if (isSidebarOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      lastTriggerRef.current?.focus();
    }
  }, [isSidebarOpen, lastTriggerRef]);

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <motion.aside
          ref={panelRef}
          role="complementary"
          aria-labelledby={titleId}
          initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-y-0 right-0 z-[45] hidden w-full max-w-[420px] flex-col overflow-y-auto border-l border-border bg-white p-6 shadow-card lg:flex"
        >
          <PanelBody titleId={titleId} onClose={closeSidebar} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function MobileSheetPanel() {
  const { isSidebarOpen, closeSidebar, lastTriggerRef } = useVehicleComparison();
  const titleId = React.useId();

  return (
    <Sheet open={isSidebarOpen} onOpenChange={(next) => !next && closeSidebar()}>
      <SheetContent
        side="bottom"
        aria-labelledby={titleId}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          lastTriggerRef.current?.focus();
        }}
        className="pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <PanelBody titleId={titleId} />
      </SheetContent>
    </Sheet>
  );
}

export function VehicleComparisonTray() {
  const { isHydrated } = useVehicleComparison();
  const isDesktop = useIsDesktopViewport();

  // Nothing about this tray is ever meaningful before hydration resolves
  // (selection is always empty pre-hydration, matching SSR) — rendering
  // null until then keeps the client's first paint identical to the SSR
  // markup, so there is no hydration mismatch. (useIsDesktopViewport's own
  // useState initializer still runs during SSR regardless of this early
  // return — hook calls always run before a component's return statement
  // is reached — which is exactly why that hook guards its `window` read
  // with `typeof window !== "undefined"` rather than relying on this gate.)
  if (!isHydrated) return null;

  return (
    <>
      {isDesktop ? <DesktopPanel /> : <MobileSheetPanel />}
      <CollapsedControl />
    </>
  );
}
