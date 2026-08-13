import type { PublicRealtimeEvent } from "@/lib/realtime/types";

/**
 * SERVER-ONLY. Never import this from a Client Component — it exists
 * exclusively so mutation code and the SSE route (src/app/api/realtime/events/route.ts)
 * can fan events out to connected browsers within this ONE Node process.
 *
 * `RealtimeBroker` is the seam a future cross-process transport plugs into.
 * Nothing outside this file (publishers, the SSE route) may depend on how
 * fan-out actually happens — only on `publish`/`subscribe`. Today's
 * implementation, InMemoryRealtimeBroker below, is valid ONLY while this
 * deployment runs as a single Node process: it stores listeners in a
 * module-local Set, which does not exist across multiple Docker replicas,
 * multiple Node workers, PM2 cluster mode, or serverless instances. When
 * this application needs to scale horizontally, replace the broker
 * returned by getRealtimeBroker() with one backed by a cross-process
 * transport (e.g. Redis pub/sub) implementing this exact same interface —
 * publishers, the SSE route, and everything browser-facing stay unchanged.
 */
export type RealtimeListener = (event: PublicRealtimeEvent) => void;

export interface RealtimeBroker {
  publish(event: PublicRealtimeEvent): void;
  /** Returns an unsubscribe function — never exposes the internal listener collection. */
  subscribe(listener: RealtimeListener): () => void;
}

/**
 * One process-local pub/sub broker. Stores LISTENERS, never application/
 * business state: no event history, no replay queue, no persistence. A
 * listener that throws is caught and logged so one broken SSE subscriber
 * can never prevent fan-out to the others, and never corrupts the
 * subscriber set itself.
 */
class InMemoryRealtimeBroker implements RealtimeBroker {
  private readonly listeners = new Set<RealtimeListener>();

  publish(event: PublicRealtimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[realtime] a subscriber threw while handling an event", error);
      }
    }
  }

  subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Test/diagnostic use only — not part of the RealtimeBroker interface business code depends on. */
  get listenerCount(): number {
    return this.listeners.size;
  }
}

// globalThis-backed singleton, same pattern as src/lib/prisma.ts — protects
// against Next.js dev-mode hot-reload re-evaluating this module and
// accidentally constructing a second broker (which would silently split
// SSE subscribers across two independent instances and leak listeners on
// every reload). In production there is exactly one Node process and this
// module is evaluated exactly once, so the globalThis indirection is inert
// there but harmless.
const globalForRealtime = globalThis as unknown as {
  __kinsenRealtimeBroker: RealtimeBroker | undefined;
};

export function getRealtimeBroker(): RealtimeBroker {
  if (!globalForRealtime.__kinsenRealtimeBroker) {
    globalForRealtime.__kinsenRealtimeBroker = new InMemoryRealtimeBroker();
  }
  return globalForRealtime.__kinsenRealtimeBroker;
}

// Exported for tests only (constructing an isolated broker instance rather
// than sharing the process-wide singleton) — business code must always go
// through getRealtimeBroker().
export { InMemoryRealtimeBroker };
