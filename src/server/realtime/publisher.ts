import { randomUUID } from "crypto";
import { getRealtimeBroker } from "@/server/realtime/broker";
import type { PublicRealtimeEvent, PublicRealtimeEventType, PublicRealtimeScope } from "@/lib/realtime/types";
import type { ContentKey } from "@/lib/content-defaults";

/**
 * SERVER-ONLY. The single entry point every mutation flow uses to announce
 * a public invalidation — never call getRealtimeBroker().publish(...)
 * directly from business code, so there is exactly one place that builds
 * the event envelope (id/version/occurredAt) and exactly one place that
 * guards against a broker failure ever affecting the caller.
 *
 * MUST be called only AFTER the authoritative DB mutation has committed —
 * this announces state that already exists, it is never a command. If
 * publication itself throws (broker bug, serialization issue, etc.), that
 * is swallowed and logged: realtime is a secondary concern, and a
 * publish-time failure must never roll back or fail an otherwise-successful
 * Vehicle/PageContent/FAQ/SiteSettings mutation.
 */
export function publishPublicRealtimeEvent(type: PublicRealtimeEventType, scopes: PublicRealtimeScope[]): void {
  try {
    const event: PublicRealtimeEvent = {
      version: 1,
      id: randomUUID(),
      type,
      scopes,
      occurredAt: new Date().toISOString(),
    };
    getRealtimeBroker().publish(event);
  } catch (error) {
    console.error("[realtime] publish failed — the triggering mutation is unaffected", error);
  }
}

/**
 * A successful authoritative Vehicle mutation (create/update/restore/soft-delete/
 * image change, from either the admin API or CarStock) may affect all of
 * these public surfaces (see vehicle.service.ts / import.service.ts call
 * sites). Correctness matters more than precisely predicting whether a
 * given Vehicle specifically appears in, say, the homepage's featured
 * carousel — one `vehicles.changed` event targets all Vehicle-dependent
 * scopes rather than trying to compute a narrower set.
 */
export const VEHICLE_CHANGE_SCOPES: PublicRealtimeScope[] = [
  "home",
  "vehicles",
  "vehicle-details",
  "favorites",
  "compare",
];

/**
 * The ONE central ContentKey -> scope mapping (section 12 of the realtime
 * spec) — a `Record<ContentKey, ...>` so TypeScript itself enforces
 * exhaustiveness: adding a new key to CONTENT_DEFAULTS (src/lib/content-defaults.ts)
 * without updating this map is a compile error, not a silently-missed scope.
 */
export const CONTENT_KEY_SCOPE_MAP: Record<ContentKey, PublicRealtimeScope> = {
  "home.hero": "home",
  "home.stats": "home",
  "home.howItWorks": "home",
  "home.benefits": "home",
  "financing.hero": "financing",
  "financing.cards": "financing",
  "warranty.hero": "warranty",
  "warranty.cards": "warranty",
  "contact.hero": "contact",
  "faq.hero": "faq",
};
