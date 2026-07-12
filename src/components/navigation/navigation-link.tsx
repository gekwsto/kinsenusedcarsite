"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavigationTransition, type NavigationIntent } from "@/components/providers/navigation-transition-provider";

type NextLinkProps = React.ComponentProps<typeof Link>;

interface NavigationLinkProps extends NextLinkProps {
  /**
   * "page-navigation" (default) — a real destination change, owns the
   * global loader, exactly as before.
   * "url-state-sync" — the link only changes query-string state on the
   * *current* page (pagination is the only current user). Routed through
   * the provider's silent syncUrlState instead, so it never shows the
   * global loader; the click is fully handled here (preventDefault) rather
   * than falling through to next/link's own default navigation.
   */
  intent?: NavigationIntent;
}

// Drop-in replacement for next/link's `Link`. Renders the exact same
// element with the exact same props — prefetching, accessibility, keyboard
// activation, open-in-new-tab, everything — and only *adds* one thing: right
// before a genuine internal, same-tab, unmodified-click navigation is about
// to happen, it tells NavigationTransitionProvider to show the loader (or,
// for `intent="url-state-sync"`, to silently sync the URL instead).
//
// It deliberately does nothing (falls through to plain Link behavior) for:
// external origins, non-http(s) protocols (mailto:, tel:), download links,
// target !== "_self", modified clicks (Cmd/Ctrl/Shift/Alt/middle-click),
// already-prevented events, and clicks that don't actually change the
// committed pathname+search (same-route or hash-only links).
export const NavigationLink = React.forwardRef<HTMLAnchorElement, NavigationLinkProps>(function NavigationLink(
  { href, onClick, target, download, intent = "page-navigation", ...rest },
  ref,
) {
  const transition = useNavigationTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (event.defaultPrevented) return;
    if (!transition) return;
    if (download !== undefined && download !== false) return;
    if (target && target !== "_self") return;
    if (event.button !== 0) return; // not the primary mouse button
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const hrefString =
      typeof href === "string"
        ? href
        : `${href.pathname ?? ""}${href.search ?? ""}${href.hash ?? ""}`;
    if (!hrefString) return;

    let url: URL;
    try {
      url = new URL(hrefString, window.location.href);
    } catch {
      return;
    }

    if (url.origin !== window.location.origin) return; // external
    if (url.protocol !== "http:" && url.protocol !== "https:") return; // mailto:, tel:, etc.

    const currentSearch = searchParams.toString();
    const sameRoute = url.pathname === pathname && url.search.replace(/^\?/, "") === currentSearch;
    if (sameRoute) return; // same destination (including hash-only on this page)

    if (intent === "url-state-sync") {
      // Handled entirely here — next/link's own default navigation must
      // not also fire, or the URL would be updated twice.
      event.preventDefault();
      transition.syncUrlState(hrefString, { method: "push" });
      return;
    }

    transition.startNavigation();
  };

  return <Link ref={ref} href={href} target={target} download={download} onClick={handleClick} {...rest} />;
});
