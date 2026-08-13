/**
 * Isomorphic (server AND browser) realtime types — no server-only imports
 * here, since PublicRealtimeProvider (a Client Component) needs the exact
 * same PublicRealtimeScope/PublicRealtimeEvent shapes the server publishes.
 *
 * This event is an INVALIDATION NOTIFICATION ONLY. It tells a connected
 * browser "relevant public data changed, re-read authoritative state" — it
 * never carries the changed record itself. PostgreSQL remains the single
 * source of truth; the browser always re-fetches through the normal Server
 * Component data path (router.refresh()), never from the event payload.
 * Keep this contract small and stable — see src/server/realtime/broker.ts
 * for why: this shape is also the seam a future cross-process transport
 * (Redis, etc.) would need to preserve unchanged.
 */

export const PUBLIC_REALTIME_SCOPES = [
  "home",
  "vehicles",
  "vehicle-details",
  "favorites",
  "compare",
  "faq",
  "financing",
  "warranty",
  "contact",
  "all-public",
] as const;

export type PublicRealtimeScope = (typeof PUBLIC_REALTIME_SCOPES)[number];

/**
 * A small, deliberately coarse domain vocabulary — one type per kind of
 * authoritative change, not one per field or per API route.
 * `system.resync` is reserved for a possible future explicit
 * "force every connected client to reconcile" signal; nothing currently
 * publishes it; the browser's own reconnect-triggered reconciliation
 * (see PublicRealtimeProvider) covers today's actual requirement without it.
 */
export const PUBLIC_REALTIME_EVENT_TYPES = [
  "vehicles.changed",
  "content.changed",
  "faq.changed",
  "settings.changed",
  "system.resync",
] as const;

export type PublicRealtimeEventType = (typeof PUBLIC_REALTIME_EVENT_TYPES)[number];

export interface PublicRealtimeEvent {
  /** Bumped only if this wire contract itself needs a breaking change. */
  version: 1;
  /** Server-generated, opaque — never derived from any DB primary key. */
  id: string;
  type: PublicRealtimeEventType;
  scopes: PublicRealtimeScope[];
  /** ISO-8601, server clock — informational only, never used for ordering/replay. */
  occurredAt: string;
}
