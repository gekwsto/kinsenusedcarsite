import * as React from "react";

/**
 * The one authoritative scroll target for `/vehicles` — sits at the top of
 * the filters+grid row (src/app/(public)/vehicles/page.tsx) so scrolling to
 * it reveals both the top of the filter panel and the first row of results
 * at once. Every control that can materially change the committed result
 * set (filters, sort, pagination) scrolls here through the one hook below —
 * never through a component-local scrollIntoView/scrollTo of its own.
 */
export const VEHICLE_RESULTS_START_ID = "vehicles-results-start";

// A scroll position already within a few pixels of the target shouldn't
// trigger a redundant corrective animation — real scroll positions (and
// sub-pixel layout rounding) are essentially never exactly 0.
const SCROLL_TOLERANCE_PX = 16;

// Distance-aware duration, clamped so a huge footer-to-top scroll still
// finishes briskly and a short hop doesn't linger. Measured against a
// ~1500px footer-to-results distance landing around 320ms, which reads as
// smooth without feeling sluggish.
const MIN_DURATION_MS = 220;
const MAX_DURATION_MS = 420;
const DURATION_PER_PX = 0.12;

// Right after a pagination click, something outside this hook's control
// (measured via temporary instrumentation, since removed — not caused by a
// duplicate scroll call, a long main-thread task, browser scroll anchoring,
// or focus-follows-click: all four were tested and ruled out directly)
// nudges the document to an unrelated position once, within roughly the
// first 150ms, and does not touch it again afterward. Rather than chase
// that external mechanism further, the animation below keeps re-asserting
// its own final position for a short bounded window after its eased curve
// completes, so it always wins the (one-time, not repeating) conflict
// instead of occasionally losing to it.
const SETTLE_GUARD_MS = 350;
const SETTLE_EPSILON_PX = 1;

const INTERRUPT_KEYS = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "]);

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Shared across every component using the hook (filters, sort, pagination)
// so a newer request from *any* of them supersedes an older still-running
// animation toward the same anchor — not just repeated calls from the same
// component.
let activeGeneration = 0;

/**
 * Returns a stable callback: call it after any user-initiated action that
 * commits a materially different vehicle result set (a filter toggle,
 * clear, sort change, or pagination click). It scrolls the document to the
 * results-start anchor *only* if the document is currently scrolled below
 * that position — never downward, never when already at/above it. External
 * URL restoration (Back/Forward, hydration, a shared link, the searchParams
 * -> local-draft sync effect) simply never calls this, so it never runs for
 * those.
 *
 * Uses a small self-contained requestAnimationFrame loop rather than native
 * `scrollIntoView({behavior:"smooth"})`: native smooth-scroll continuously
 * re-tracks the *live* position of the target element, and on `/vehicles`
 * the target's surrounding DOM (the vehicle grid) gets its cards swapped
 * for a new page's differently-keyed set right as the animation is
 * mid-flight — measured (via temporary instrumentation, since removed) to
 * cause the browser to abandon and restart its own trajectory, producing a
 * visible jump followed by a ~100ms dead pause before a second deceleration
 * phase, in both dev and production. Capturing the start/target Y once and
 * driving `window.scrollTo(0, y)` ourselves every frame is immune to that:
 * the destination is fixed for the lifetime of the animation regardless of
 * what mounts or unmounts inside the grid while it runs.
 */
export function useVehicleResultsScroll() {
  const pendingFrameRef = React.useRef<number | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const removeInterruptListenersRef = React.useRef<(() => void) | null>(null);
  // Set only while an animation owns the html scroll-behavior override
  // below; stopAnimation restores it on every exit path (natural
  // completion, interruption, or being superseded), not just the happy one.
  const restoreScrollBehaviorRef = React.useRef<(() => void) | null>(null);

  const stopAnimation = React.useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (removeInterruptListenersRef.current) {
      removeInterruptListenersRef.current();
      removeInterruptListenersRef.current = null;
    }
    if (restoreScrollBehaviorRef.current) {
      restoreScrollBehaviorRef.current();
      restoreScrollBehaviorRef.current = null;
    }
  }, []);

  const cancelPending = React.useCallback(() => {
    if (pendingFrameRef.current !== null) {
      cancelAnimationFrame(pendingFrameRef.current);
      pendingFrameRef.current = null;
    }
  }, []);

  // Cancels any pending check or in-flight animation on unmount (e.g.
  // navigating away from /vehicles) so nothing can move the document later.
  React.useEffect(() => {
    return () => {
      cancelPending();
      stopAnimation();
    };
  }, [cancelPending, stopAnimation]);

  return React.useCallback(() => {
    cancelPending(); // the latest request always supersedes an older, not-yet-evaluated one
    pendingFrameRef.current = requestAnimationFrame(() => {
      pendingFrameRef.current = null;
      const el = document.getElementById(VEHICLE_RESULTS_START_ID);
      if (!el) return;

      // Measured once, before the animation starts — never re-read per
      // frame, and never revisited even if the grid's content changes
      // mid-animation.
      const rect = el.getBoundingClientRect();
      const scrollMarginTop = parseFloat(getComputedStyle(el).scrollMarginTop || "0");
      if (rect.top >= scrollMarginTop - SCROLL_TOLERANCE_PX) return; // already at/above target

      const startY = window.scrollY;
      const targetY = Math.max(0, startY + rect.top - scrollMarginTop);
      const distance = startY - targetY;

      stopAnimation(); // supersede any animation already in flight (this or another component)
      if (distance <= 0) return;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const gen = ++activeGeneration;

      const onInterrupt = (event: Event) => {
        if (event.type === "keydown" && !INTERRUPT_KEYS.has((event as KeyboardEvent).key)) return;
        stopAnimation();
      };
      window.addEventListener("wheel", onInterrupt, { passive: true });
      window.addEventListener("touchmove", onInterrupt, { passive: true });
      window.addEventListener("keydown", onInterrupt, { passive: true });
      removeInterruptListenersRef.current = () => {
        window.removeEventListener("wheel", onInterrupt);
        window.removeEventListener("touchmove", onInterrupt);
        window.removeEventListener("keydown", onInterrupt);
      };

      // The project sets a global `scroll-behavior: smooth` on <html>. Any
      // *other* code path that scrolls during this animation without an
      // explicit `behavior` (Next.js's own internal route-focus handling,
      // measured to move the document once, unprompted, shortly after a
      // pagination commit) inherits that smooth behavior, and a browser's
      // native smooth-scroll animation can keep "owning" the scroll
      // position — silently absorbing our own explicit auto/instant calls
      // below — until it finishes on its own. Forcing `auto` inline for the
      // lifetime of this animation removes that inheritance for anyone,
      // not just us, so nothing else can start a competing smooth scroll
      // while we're driving the position ourselves. Restored the moment the
      // animation ends, is interrupted, or is superseded.
      const htmlEl = document.documentElement;
      const previousScrollBehavior = htmlEl.style.scrollBehavior;
      htmlEl.style.scrollBehavior = "auto";
      restoreScrollBehaviorRef.current = () => {
        htmlEl.style.scrollBehavior = previousScrollBehavior;
      };

      // Natural completion (not an interrupt, not superseded) also routes
      // through stopAnimation so every exit path restores scroll-behavior
      // and tears down the interrupt listeners identically.
      const finish = stopAnimation;

      // The same external, one-time interference (see SETTLE_GUARD_MS above)
      // can also land after a *reduced-motion* jump, which is otherwise a
      // single scrollTo call with nothing to correct it — so both paths
      // share this bounded re-assertion phase, not just the eased one.
      const settleStart = performance.now();
      const settle = (now: number) => {
        if (activeGeneration !== gen) {
          finish();
          return;
        }
        if (Math.abs(window.scrollY - targetY) <= SETTLE_EPSILON_PX) {
          finish();
          return;
        }
        if (now - settleStart > SETTLE_GUARD_MS) {
          finish();
          return;
        }
        window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
        animationFrameRef.current = requestAnimationFrame(settle);
      };

      if (prefersReducedMotion) {
        window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
        animationFrameRef.current = requestAnimationFrame(settle);
        return;
      }

      const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, distance * DURATION_PER_PX));
      const startTime = performance.now();

      // behavior:"auto" on every call below for the same reason as the
      // settle phase — each frame is one already-eased step of *our*
      // animation; letting the browser's own CSS-driven smooth-scroll
      // additionally animate toward this constantly-moving per-frame target
      // is what produced the original crawl-then-catch-up stutter.
      const step = (now: number) => {
        if (activeGeneration !== gen) {
          // Superseded by a newer request from this hook or another
          // component's — stop cleanly rather than fight it.
          finish();
          return;
        }
        const progress = Math.min(1, (now - startTime) / duration);
        const y = startY + (targetY - startY) * easeOutCubic(progress);
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        } else {
          animationFrameRef.current = requestAnimationFrame(settle);
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    });
  }, [cancelPending, stopAnimation]);
}
