"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { VehicleCard, type VehicleCardVehicle } from "@/components/vehicles/vehicle-card";
import { cn } from "@/lib/utils";

const AUTOPLAY_INTERVAL_MS = 5000;

// The same viewport tiers Tailwind itself uses (sm/lg/2xl) — "how many
// cards are visible" tracks the exact same breakpoints as every other
// responsive layout on the site (see VehicleGrid's grid-cols-1 sm:...
// lg:...), just expressed as flex-basis fractions instead of grid columns.
// Ordered widest-first so the `.find()` below returns the first tier the
// current width actually qualifies for.
const VISIBLE_COUNT_TIERS = [
  { minWidth: 1536, count: 4 }, // 2xl — large desktop
  { minWidth: 1024, count: 3 }, // lg — laptop/desktop
  { minWidth: 640, count: 2 }, // sm — tablet
  { minWidth: 0, count: 1 }, // mobile
];

function getVisibleCount(width: number): number {
  return (VISIBLE_COUNT_TIERS.find((tier) => width >= tier.minWidth) ?? VISIBLE_COUNT_TIERS[VISIBLE_COUNT_TIERS.length - 1]!).count;
}

// SSR-safe: matches VehicleCarousel's first client render exactly (mobile,
// 1 visible) so there is no hydration mismatch, then the effect below
// corrects it to the real viewport width immediately after mount.
function useVisibleCount(): number {
  const [count, setCount] = React.useState(1);

  React.useEffect(() => {
    const update = () => setCount(getVisibleCount(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

export function VehicleCarousel({ vehicles }: { vehicles: VehicleCardVehicle[] }) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const visibleCount = useVisibleCount();
  const shouldReduceMotion = useReducedMotion();
  const maxIndex = Math.max(0, vehicles.length - visibleCount);
  const pageCount = Math.max(1, Math.ceil(vehicles.length / visibleCount));

  const [index, setIndex] = React.useState(0);
  // Two independent reasons autoplay can be paused, kept as separate state
  // rather than one shared boolean: hover/focus is transient and automatic
  // (moving the mouse away or blurring resumes it), while the play/pause
  // button is an explicit, persistent user choice. Sharing one boolean
  // made clicking the button while the pointer was still over the
  // carousel (the only way to click it) immediately re-toggled by the
  // hover handler that fires on the same interaction, so the button
  // appeared to do nothing.
  const [isHoverPaused, setIsHoverPaused] = React.useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = React.useState(false);
  const isPaused = isHoverPaused || isManuallyPaused;
  // The autoplay interval (below) reads this ref instead of depending on
  // `isPaused` directly, so pausing/resuming never tears down and
  // recreates the interval — it only flips a flag the *already-running*
  // interval checks on its next tick. Tearing down and recreating a
  // `setInterval` on every pause/resume (the previous design) meant each
  // resume effectively restarted a fresh 5s countdown from that exact
  // instant, so it was only ever a single missed/delayed effect run away
  // from looking "stuck" for one whole interval — this removes that
  // effect-recreation timing entirely.
  const isPausedRef = React.useRef(isPaused);
  React.useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  // A manual scroll (swipe/drag/trackpad) is real input just like the
  // buttons — this ref lets the debounced scroll-resync effect tell
  // whether the scroll it's reacting to came from the user (resync index)
  // or from our own scrollToIndex call (already correct, skip).
  const isProgrammaticScrollRef = React.useRef(false);
  const scrollSettleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const canScroll = vehicles.length > visibleCount;

  const scrollToIndex = React.useCallback(
    (nextIndex: number) => {
      const track = trackRef.current;
      const clamped = Math.max(0, Math.min(nextIndex, maxIndex));
      setIndex(clamped);
      if (!track) return;
      const child = track.children[clamped] as HTMLElement | undefined;
      if (!child) return;
      isProgrammaticScrollRef.current = true;
      track.scrollTo({ left: child.offsetLeft, behavior: shouldReduceMotion ? "auto" : "smooth" });
    },
    [maxIndex, shouldReduceMotion],
  );

  // Clamp the current index whenever the viewport crosses a breakpoint and
  // fewer cards now fit (e.g. resizing from desktop down to tablet) — a
  // stale index could otherwise point past the now-shorter valid range.
  // Synchronizing to this external signal (a resize-driven prop-like
  // value, not React state) is exactly what this effect is for; the
  // resulting re-render is the correction itself, not an avoidable cascade.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (index > maxIndex) scrollToIndex(maxIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxIndex]);

  // Keeps the dot indicator honest after a manual swipe/drag/trackpad
  // scroll — the one input method that changes scroll position without
  // going through scrollToIndex. Debounced so it reads the final resting
  // position once the scroll (native momentum included) has settled,
  // rather than firing dozens of times mid-gesture.
  const handleScroll = React.useCallback(() => {
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    if (scrollSettleTimeoutRef.current) clearTimeout(scrollSettleTimeoutRef.current);
    scrollSettleTimeoutRef.current = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      let closest = 0;
      let closestDistance = Infinity;
      for (let i = 0; i < track.children.length; i++) {
        const child = track.children[i] as HTMLElement;
        const distance = Math.abs(child.offsetLeft - track.scrollLeft);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = i;
        }
      }
      setIndex(Math.max(0, Math.min(closest, maxIndex)));
    }, 120);
  }, [maxIndex]);

  React.useEffect(() => () => {
    if (scrollSettleTimeoutRef.current) clearTimeout(scrollSettleTimeoutRef.current);
  }, []);

  // Autoplay — advances a full "page" (visibleCount cards) at a time,
  // wrapping back to the start. Disabled outright under
  // prefers-reduced-motion (no timer is even created, not just visually
  // suppressed), while paused, or when everything already fits on screen.
  React.useEffect(() => {
    if (shouldReduceMotion || !canScroll) return;
    const id = setInterval(() => {
      if (isPausedRef.current) return;
      setIndex((current) => {
        const next = current + visibleCount > maxIndex ? 0 : current + visibleCount;
        scrollToIndex(next);
        return next;
      });
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [shouldReduceMotion, canScroll, visibleCount, maxIndex, scrollToIndex]);

  const activePage = Math.min(pageCount - 1, Math.round(index / visibleCount));

  if (vehicles.length === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Επιλεγμένα οχήματα"
      className="relative scroll-mt-[var(--kinsen-header-offset)]"
      onMouseEnter={() => setIsHoverPaused(true)}
      onMouseLeave={() => setIsHoverPaused(false)}
      onFocusCapture={() => setIsHoverPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsHoverPaused(false);
      }}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:gap-6 2xl:gap-7"
      >
        {vehicles.map((vehicle, i) => (
          <div key={vehicle.id} className="flex-none basis-full snap-start sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4">
            <VehicleCard vehicle={vehicle} priority={i < 3} variant="featured" />
          </div>
        ))}
      </div>

      {canScroll && (
        <>
          <button
            type="button"
            onClick={() => scrollToIndex(index - visibleCount)}
            disabled={index === 0}
            aria-label="Προηγούμενα οχήματα"
            className="absolute left-0 top-[112px] z-10 hidden -translate-x-1/2 scroll-mt-[var(--kinsen-header-offset)] items-center justify-center rounded-full border border-border bg-white p-2 text-ink shadow-card transition-opacity hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(index + visibleCount)}
            disabled={index >= maxIndex}
            aria-label="Επόμενα οχήματα"
            className="absolute right-0 top-[112px] z-10 hidden translate-x-1/2 scroll-mt-[var(--kinsen-header-offset)] items-center justify-center rounded-full border border-border bg-white p-2 text-ink shadow-card transition-opacity hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2" role="tablist" aria-label="Σελίδες οχημάτων">
              {Array.from({ length: pageCount }).map((_, page) => (
                <button
                  key={page}
                  type="button"
                  role="tab"
                  aria-selected={page === activePage}
                  aria-label={`Σελίδα ${page + 1} από ${pageCount}`}
                  onClick={() => scrollToIndex(page * visibleCount)}
                  className={cn(
                    "h-2 scroll-mt-[var(--kinsen-header-offset)] rounded-full transition-[width,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    page === activePage ? "w-6 bg-primary" : "w-2 bg-border hover:bg-ink-muted",
                  )}
                />
              ))}
            </div>

            {!shouldReduceMotion && (
              <button
                type="button"
                onClick={() => setIsManuallyPaused((p) => !p)}
                aria-label={isManuallyPaused ? "Συνέχιση αυτόματης εναλλαγής" : "Παύση αυτόματης εναλλαγής"}
                aria-pressed={isManuallyPaused}
                className="inline-flex h-7 w-7 scroll-mt-[var(--kinsen-header-offset)] items-center justify-center rounded-full border border-border text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {isManuallyPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
