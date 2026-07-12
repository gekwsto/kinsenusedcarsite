"use client";

import * as React from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { NavigationLoader, type NavigationLoaderPhase } from "@/components/layout/navigation-loader";

// The provider's own state additionally tracks "idle" (no overlay rendered
// at all) and "booting" (the initial-document-load state, visually
// identical to "visible" — see the render at the bottom of this file);
// NavigationLoaderPhase (the presentational component's prop type) only
// covers the three states it's actually rendered for.
type ProviderPhase = "idle" | "booting" | NavigationLoaderPhase;

// Why this exists: `loading.tsx` Suspense boundaries are NOT a reliable
// signal that a client-side navigation has started. React only shows a
// `loading.tsx` fallback if the destination segment actually suspends —
// a prefetched (or already-cached) route can commit synchronously and never
// render its fallback at all. So `loading.tsx` alone cannot guarantee a
// visible loader on every internal navigation.
//
// This provider is the single source of truth instead. It owns one global
// booting/entering/visible/exiting/idle overlay state, driven by three
// independent signals:
//   1. The initial "booting" state — the literal, deterministic initial
//      value of `phase` on both the server render and the first client
//      render, so the exact same loader DOM exists before and after
//      hydration (no mismatch, no second loader created post-mount). It
//      clears itself shortly after the document finishes loading — see
//      the boot effect below.
//   2. `startNavigation()` — called proactively by NavigationLink (on
//      click) and the popstate listener (Back/Forward), *before* the
//      navigation itself is asked to happen. This is what guarantees the
//      overlay shows even for instant, prefetched navigations.
//   3. pathname/search-param commit — detected via a small inner watcher
//      component, this is what ends a navigation under normal conditions.
// A route-level `loading.tsx` mounting is a *fourth*, optional signal (via
// NavigationFallbackSignal) used only to keep the overlay open a little
// longer when a segment is genuinely still suspended after the URL commits
// (or, during boot, while the initial page itself is still suspended).
const MIN_VISIBLE_MS = 180;
const INITIAL_MIN_VISIBLE_MS = 220;
const EXIT_DURATION_MS = 120;
const FAIL_SAFE_MS = 10000;

// The initial boot "navigation" always owns token 0 — tokenRef starts at 0
// and every real navigation increments it before use, so token 0 can never
// collide with a real navigation. Reusing the exact same token-checked
// requestComplete/beginExit machinery for boot means a client navigation
// that starts *during* boot automatically supersedes and safely cancels the
// boot completion (startNavigation() already clears every pending timer
// before scheduling its own) — no separate boot-vs-navigation race exists.
const BOOT_TOKEN = 0;

// The two things a caller can ever mean by "change the URL":
//   - "page-navigation": a real destination change. Owns the global loader.
//   - "url-state-sync": the same page reflecting different query-string
//     state (filters, sort, pagination). Must never own the global loader.
// `navigate`/`replace` are the page-navigation API; `syncUrlState` is the
// url-state-sync API. The method the caller picks *is* the typed intent —
// there is no separate boolean to thread through every filter control.
export type NavigationIntent = "page-navigation" | "url-state-sync";

interface NavigationTransitionContextValue {
  /** Show the overlay immediately. Safe to call redundantly. */
  startNavigation: () => void;
  /** router.push wrapped with startNavigation(). Real page navigation only. */
  navigate: (href: string, options?: { scroll?: boolean }) => void;
  /** router.replace wrapped with startNavigation(). Real page navigation only. */
  replace: (href: string, options?: { scroll?: boolean }) => void;
  /**
   * Same-page URL/search-param synchronization (filters, sort, pagination)
   * that must never activate the global full-screen loader. Runs inside
   * `React.startTransition` so Next.js keeps the current page content
   * visible while the new server data streams in, instead of blocking on
   * it — the router call itself is what supplies last-write-wins request
   * ordering (a newer call always supersedes an older in-flight one).
   */
  syncUrlState: (href: string, options?: { method?: "push" | "replace" }) => void;
  /** Called by NavigationFallbackSignal when a loading.tsx boundary mounts. */
  notifyFallbackMount: () => void;
  /** Called by NavigationFallbackSignal when a loading.tsx boundary unmounts. */
  notifyFallbackUnmount: () => void;
}

const NavigationTransitionContext = React.createContext<NavigationTransitionContextValue | null>(null);

export function useNavigationTransition() {
  return React.useContext(NavigationTransitionContext);
}

// Isolated so `useSearchParams()` (which requires a Suspense boundary per
// Next.js) never forces the rest of the app — or the overlay itself — into
// suspense. It renders nothing; it only reports when the committed
// pathname + search string changes.
function RouteChangeWatcher({ onRouteSettled }: { onRouteSettled: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;

  React.useEffect(() => {
    onRouteSettled();
    // Intentionally keyed only on the committed route, not on the
    // (stable) onRouteSettled callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}

export function NavigationTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Literal, deterministic initial value — identical on the server render
  // and the first client render, so the server-rendered loader DOM is
  // exactly what hydration reconciles against. No `typeof window` check, no
  // effect-only visibility, no second loader introduced post-mount.
  const [phase, setPhase] = React.useState<ProviderPhase>("booting");

  // Monotonically increasing navigation identity. Every timer/callback below
  // checks its captured token against tokenRef.current before acting, so a
  // stale callback from an older, superseded navigation (including the
  // initial boot, which owns token 0) can never affect the overlay for a
  // newer one.
  const tokenRef = React.useRef(BOOT_TOKEN);
  const phaseRef = React.useRef<ProviderPhase>("booting");
  const navStartRef = React.useRef(0);
  const fallbackDepthRef = React.useRef(0);
  const minVisibleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterRafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearMinVisibleTimer = () => {
    if (minVisibleTimerRef.current) {
      clearTimeout(minVisibleTimerRef.current);
      minVisibleTimerRef.current = null;
    }
  };
  const clearExitTimer = () => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };
  const clearFailSafeTimer = () => {
    if (failSafeTimerRef.current) {
      clearTimeout(failSafeTimerRef.current);
      failSafeTimerRef.current = null;
    }
  };
  const clearEnterRaf = () => {
    if (enterRafRef.current !== null) {
      cancelAnimationFrame(enterRafRef.current);
      enterRafRef.current = null;
    }
  };

  const beginExit = React.useCallback((token: number) => {
    if (tokenRef.current !== token) return; // superseded — ignore
    clearMinVisibleTimer();
    setPhase("exiting");
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      if (tokenRef.current !== token) return;
      setPhase("idle");
    }, EXIT_DURATION_MS);
  }, []);

  const requestComplete = React.useCallback(
    (token: number, minVisibleMs: number = MIN_VISIBLE_MS) => {
      if (tokenRef.current !== token) return; // superseded — ignore
      if (fallbackDepthRef.current > 0) return; // a loading.tsx is still mounted; wait for it to unmount
      const elapsed = Date.now() - navStartRef.current;
      if (elapsed >= minVisibleMs) {
        beginExit(token);
        return;
      }
      clearMinVisibleTimer();
      minVisibleTimerRef.current = setTimeout(() => {
        minVisibleTimerRef.current = null;
        beginExit(token);
      }, minVisibleMs - elapsed);
    },
    [beginExit],
  );

  const startNavigation = React.useCallback(() => {
    const token = ++tokenRef.current;
    clearMinVisibleTimer();
    clearExitTimer();
    clearFailSafeTimer();
    clearEnterRaf();
    fallbackDepthRef.current = 0;
    navStartRef.current = Date.now();
    setPhase("entering");
    // Flip to "visible" one frame later so the opacity/transform transition
    // in globals.css actually has an initial state to animate *from* —
    // mounting directly into the "visible" state would skip the transition.
    enterRafRef.current = requestAnimationFrame(() => {
      enterRafRef.current = null;
      setPhase((current) => (current === "entering" ? "visible" : current));
    });
    failSafeTimerRef.current = setTimeout(() => {
      failSafeTimerRef.current = null;
      // Belt-and-suspenders only: clears a navigation that never committed a
      // URL (e.g. a network failure). Does nothing for a newer navigation.
      requestComplete(token);
    }, FAIL_SAFE_MS);
  }, [requestComplete]);

  // Initial document boot. Runs once per mount (the provider itself only
  // ever mounts once, at the app root). Deliberately does not use
  // `startNavigation()` — boot owns the fixed token 0 rather than
  // incrementing tokenRef, so a real navigation that happens to start while
  // booting is still in progress is a strictly *newer* token and safely
  // supersedes it (startNavigation() already clears every pending timer
  // before scheduling its own).
  React.useEffect(() => {
    navStartRef.current = Date.now();

    const finishBoot = () => requestComplete(BOOT_TOKEN, INITIAL_MIN_VISIBLE_MS);

    let loadListenerAttached = false;
    if (document.readyState === "complete") {
      finishBoot();
    } else {
      window.addEventListener("load", finishBoot, { once: true });
      loadListenerAttached = true;
    }

    // Belt-and-suspenders only, same as a real navigation's fail-safe: in
    // case `load` never fires (a hung subresource) this still clears the
    // loader instead of leaving it stuck forever. requestComplete's own
    // token check means this is a no-op once a real navigation (a strictly
    // newer token) has taken over.
    failSafeTimerRef.current = setTimeout(() => {
      failSafeTimerRef.current = null;
      requestComplete(BOOT_TOKEN, INITIAL_MIN_VISIBLE_MS);
    }, FAIL_SAFE_MS);

    // Under React Strict Mode's dev-only double-invoke, this cleanup runs
    // immediately after the first (throwaway) setup — removing that `load`
    // listener before the real event can ever reach it, and clearing that
    // first fail-safe timer — so only the second (kept) setup's listener
    // and timer survive to do anything for real.
    return () => {
      if (loadListenerAttached) window.removeEventListener("load", finishBoot);
      clearFailSafeTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = React.useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      startNavigation();
      router.push(href, options);
    },
    [router, startNavigation],
  );

  const replace = React.useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      startNavigation();
      router.replace(href, options);
    },
    [router, startNavigation],
  );

  // Deliberately does NOT call startNavigation() — the global loader's
  // phase state is left completely untouched, so it's structurally
  // impossible for a filter/sort/pagination change on the current page to
  // activate it, no matter how slow the resulting server render is.
  // `React.startTransition` (not `useTransition`) is enough here: it has no
  // component-local `isPending` to expose, but Next's router already reads
  // "am I inside a transition?" to decide whether to keep the current page
  // visible while the new one streams in, which is the actual behavior
  // this needs — not a spinner.
  const syncUrlState = React.useCallback(
    (href: string, options?: { method?: "push" | "replace" }) => {
      React.startTransition(() => {
        if (options?.method === "push") {
          router.push(href, { scroll: false });
        } else {
          router.replace(href, { scroll: false });
        }
      });
    },
    [router],
  );

  const notifyFallbackMount = React.useCallback(() => {
    fallbackDepthRef.current += 1;
    // The destination isn't actually ready — undo an exit that was started
    // (or completed) on the mistaken assumption that the URL commit meant
    // the page was done.
    clearExitTimer();
    clearMinVisibleTimer();
    setPhase((current) => (current === "idle" ? current : current === "exiting" ? "visible" : current));
  }, []);

  const notifyFallbackUnmount = React.useCallback(() => {
    fallbackDepthRef.current = Math.max(0, fallbackDepthRef.current - 1);
    if (fallbackDepthRef.current === 0 && phaseRef.current !== "idle") {
      requestComplete(tokenRef.current, tokenRef.current === BOOT_TOKEN ? INITIAL_MIN_VISIBLE_MS : MIN_VISIBLE_MS);
    }
  }, [requestComplete]);

  // Stable identity so RouteChangeWatcher's effect (keyed only on the route)
  // always calls the current logic without needing `phase` in its own deps.
  const handleRouteSettled = React.useCallback(() => {
    if (phaseRef.current === "idle") return;
    requestComplete(tokenRef.current, tokenRef.current === BOOT_TOKEN ? INITIAL_MIN_VISIBLE_MS : MIN_VISIBLE_MS);
  }, [requestComplete]);

  // Browser Back / Forward. One listener, added once.
  React.useEffect(() => {
    const handlePopState = () => {
      startNavigation();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [startNavigation]);

  React.useEffect(() => {
    return () => {
      clearMinVisibleTimer();
      clearExitTimer();
      clearFailSafeTimer();
      clearEnterRaf();
    };
  }, []);

  const contextValue = React.useMemo<NavigationTransitionContextValue>(
    () => ({ startNavigation, navigate, replace, syncUrlState, notifyFallbackMount, notifyFallbackUnmount }),
    [startNavigation, navigate, replace, syncUrlState, notifyFallbackMount, notifyFallbackUnmount],
  );

  return (
    <NavigationTransitionContext.Provider value={contextValue}>
      <React.Suspense fallback={null}>
        <RouteChangeWatcher onRouteSettled={handleRouteSettled} />
      </React.Suspense>
      {/* "booting" renders the exact same visible loader as "visible" — it's
          a distinct provider-state name only so the boot completion path
          (token 0, INITIAL_MIN_VISIBLE_MS) is kept separate from ordinary
          client-navigation completion. There is never a second component
          or a second DOM root involved. */}
      {phase !== "idle" && <NavigationLoader phase={phase === "booting" ? "visible" : phase} />}
      {children}
    </NavigationTransitionContext.Provider>
  );
}
