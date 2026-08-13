import type { PublicRealtimeScope } from "@/lib/realtime/types";

/**
 * The ONE centralized pathname -> scope table (section 29 of the realtime
 * spec) — audited against the actual `src/app/(public)/*` route tree, not
 * guessed. Every entry here is a real, existing public route:
 *   /                 (public)/page.tsx            -> home
 *   /vehicles         (public)/vehicles/page.tsx    -> vehicles
 *   /vehicles/[slug]  (public)/vehicles/[slug]/...  -> vehicle-details
 *   /favorites        (public)/favorites/page.tsx   -> favorites
 *   /compare          (public)/compare/page.tsx     -> compare
 *   /faq              (public)/faq/page.tsx         -> faq
 *   /financing        (public)/financing/page.tsx   -> financing
 *   /warranty         (public)/warranty/page.tsx    -> warranty
 *   /contact          (public)/contact/page.tsx     -> contact
 * /account, /login, /register, /privacy-policy are deliberately absent —
 * none of them render Vehicle/PageContent/FAQ data, so no PAGE-SPECIFIC
 * scope (vehicles, financing, faq, ...) ever needs to reach them. They are
 * still reachable by an `all-public` event, though: PublicRealtimeProvider
 * is mounted for every route inside `(public)/layout.tsx`, which includes
 * these, and that layout also renders shared shell UI (Footer) there — see
 * isPublicRealtimeEventRelevant below, which checks `all-public` BEFORE
 * consulting this table for exactly that reason.
 */
const ROUTE_SCOPE_TABLE: ReadonlyArray<{ test: (pathname: string) => boolean; scopes: PublicRealtimeScope[] }> = [
  { test: (p) => p === "/", scopes: ["home"] },
  { test: (p) => p === "/vehicles", scopes: ["vehicles"] },
  { test: (p) => /^\/vehicles\/[^/]+\/?$/.test(p), scopes: ["vehicle-details"] },
  { test: (p) => p === "/favorites", scopes: ["favorites"] },
  { test: (p) => p === "/compare", scopes: ["compare"] },
  { test: (p) => p === "/faq", scopes: ["faq"] },
  { test: (p) => p === "/financing", scopes: ["financing"] },
  { test: (p) => p === "/warranty", scopes: ["warranty"] },
  { test: (p) => p === "/contact", scopes: ["contact"] },
];

/** The realtime scope(s) the given pathname belongs to — `[]` for any route not in the table above. */
export function matchPublicRealtimeScopes(pathname: string): PublicRealtimeScope[] {
  for (const entry of ROUTE_SCOPE_TABLE) {
    if (entry.test(pathname)) return entry.scopes;
  }
  return [];
}

/**
 * Whether an incoming event's scopes should cause the CURRENT route to
 * refresh.
 *
 * `all-public` is checked FIRST and unconditionally returns true —
 * deliberately BEFORE consulting matchPublicRealtimeScopes(). This matters:
 * PublicRealtimeProvider is mounted once in `(public)/layout.tsx`, which
 * also renders shared shell UI (Footer) on every route inside that layout,
 * including ones with no page-specific realtime scope at all — /login,
 * /register, /account, /privacy-policy (see the ROUTE_SCOPE_TABLE comment
 * above; matchPublicRealtimeScopes() correctly returns [] for these, and
 * that is NOT changed here). A SiteSettings change that affects the Footer
 * must still reach a visitor sitting on /login, even though /login has no
 * entry in the route table — that's exactly what `all-public` means: a
 * global public invalidation, not "every scope a route happens to have".
 * Checking route-specific scopes first would incorrectly gate a truly
 * global event behind having a page-specific scope, which defeats the
 * purpose of `all-public` for exactly the routes that most need it.
 *
 * A non-`all-public` event still requires the route to have at least one
 * matching scope, same as before — route-specific targeting is unchanged.
 */
export function isPublicRealtimeEventRelevant(eventScopes: PublicRealtimeScope[], pathname: string): boolean {
  if (eventScopes.includes("all-public")) return true;
  const routeScopes = matchPublicRealtimeScopes(pathname);
  if (routeScopes.length === 0) return false; // route not in the public realtime table at all, and not an all-public event
  return routeScopes.some((scope) => eventScopes.includes(scope));
}
