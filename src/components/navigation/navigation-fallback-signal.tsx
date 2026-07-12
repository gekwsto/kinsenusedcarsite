"use client";

import * as React from "react";
import { useNavigationTransition } from "@/components/providers/navigation-transition-provider";

// Rendered by every route-level `loading.tsx`. It draws nothing — no logo,
// no overlay, no progress bar, no live region. The one and only visual
// NavigationLoader is owned by NavigationTransitionProvider.
//
// This is a bridge: when a segment is slow enough that Next.js actually
// mounts a real Suspense fallback (as opposed to a prefetched navigation
// that never suspends), this tells the provider "the destination isn't
// ready yet" so it keeps the overlay open past the URL commit instead of
// exiting early. Its unmount (real content has replaced the fallback) lets
// the overlay complete normally.
//
// If rendered without a NavigationTransitionProvider ancestor for any
// reason, `transition` is null and this safely no-ops — it never creates a
// second overlay.
export function NavigationFallbackSignal() {
  const transition = useNavigationTransition();

  React.useEffect(() => {
    if (!transition) return;
    transition.notifyFallbackMount();
    return () => transition.notifyFallbackUnmount();
    // Mount/unmount signal only — intentionally not re-run when the
    // transition object's callbacks are (stably) re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
