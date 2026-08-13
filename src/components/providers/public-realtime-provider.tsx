"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { isPublicRealtimeEventRelevant } from "@/lib/realtime/route-scopes";
import { createRealtimeRefreshCoordinator } from "@/lib/realtime/refresh-coalescer";
import type { PublicRealtimeEvent } from "@/lib/realtime/types";

const SSE_ENDPOINT = "/api/realtime/events";

/**
 * Mounted exactly once, in the public layout (src/app/(public)/layout.tsx)
 * — owns the single shared EventSource connection for the whole public
 * site, the same "exactly one instance" rule NavigationTransitionProvider
 * already documents (see src/app/providers.tsx). Renders nothing; it is
 * pure realtime wiring, not UI.
 *
 * Never receives authoritative data — every event is only a signal to
 * re-read PostgreSQL for the CURRENT route via router.refresh(), which
 * preserves the URL (including any filter/pagination search params) and
 * scroll position by construction: it re-fetches Server Component data for
 * the route already committed, it does not navigate. The refresh is
 * wrapped in React.startTransition() rather than the useTransition() hook,
 * since this component has no local `isPending` to expose — same reasoning
 * NavigationTransitionProvider's syncUrlState already uses for the same
 * "refresh without a URL change" case. router.refresh() never changes the
 * URL, so it can't trigger that provider's own navigation-loader overlay
 * either — the two systems are naturally independent.
 */
export function PublicRealtimeProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = React.useRef(pathname);

  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    // Whether this EventSource has ever reached `open` before. Reused across
    // however many browser-driven reconnects happen for the lifetime of this
    // one connection object — see the reconnect-reconciliation comment below.
    let hasConnectedBefore = false;

    const coordinator = createRealtimeRefreshCoordinator(() => {
      React.startTransition(() => {
        router.refresh();
      });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") coordinator.onVisible();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const source = new EventSource(SSE_ENDPOINT);

    const handleOpen = () => {
      if (hasConnectedBefore) {
        // This in-memory architecture has no durable event history (see
        // src/server/realtime/broker.ts) — anything published while
        // disconnected is simply lost. `open` firing again means the
        // browser's native EventSource just reconnected after a drop (a
        // temporary network blip, or this single Next.js process
        // restarting), so one reconciliation refresh re-reads current
        // PostgreSQL state to catch up on whatever was missed. Deliberately
        // NOT done on the very first connection after initial page load —
        // that data is already fresh from the original Server Component render.
        //
        // Visibility-aware: a reconnect while the tab is hidden must NOT
        // force an immediate refresh (that would defeat the hidden-tab
        // optimization the same way a normal hidden event would) — it only
        // marks the coordinator dirty, and the existing onVisible() path
        // fires the single catch-up refresh once the tab is actually shown.
        coordinator.reconcile(document.visibilityState !== "hidden");
      }
      hasConnectedBefore = true;
    };
    source.addEventListener("open", handleOpen);

    const handlePublicChange = (messageEvent: MessageEvent<string>) => {
      let parsed: PublicRealtimeEvent;
      try {
        parsed = JSON.parse(messageEvent.data);
      } catch {
        return; // malformed event — ignore rather than crash the tab
      }
      if (!isPublicRealtimeEventRelevant(parsed.scopes, pathnameRef.current)) return;

      if (document.visibilityState === "hidden") {
        coordinator.notifyRelevantEventHidden();
      } else {
        coordinator.notifyRelevantEventVisible();
      }
    };
    source.addEventListener("public-change", handlePublicChange as EventListener);

    // Connection failures degrade quietly: native EventSource retries
    // automatically using the server's `retry:` hint (see server/realtime/sse.ts),
    // and the site remains fully usable without realtime in the meantime —
    // no error UI, no retry loop of our own to build or maintain.
    source.onerror = () => {};

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("public-change", handlePublicChange as EventListener);
      source.close();
      coordinator.dispose();
    };
  }, [router]);

  return null;
}
