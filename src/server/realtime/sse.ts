import { getRealtimeBroker, type RealtimeBroker } from "@/server/realtime/broker";
import type { PublicRealtimeEvent } from "@/lib/realtime/types";

/**
 * SERVER-ONLY. The actual stream-building logic behind
 * GET /api/realtime/events (src/app/api/realtime/events/route.ts), split
 * out so it's directly unit-testable — the route file itself stays a thin
 * wrapper, matching every other route in this project.
 */

export const SSE_RETRY_HINT_MS = 3000;
export const DEFAULT_HEARTBEAT_MS = 25_000;

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disables response buffering on an nginx (or nginx-compatible) reverse
  // proxy for THIS route only — see the Dockerfile/docker-compose.yml audit
  // note in the final report; no proxy config lives in this repo (the app
  // container joins an external `proxy` network), so this response header
  // is the one config surface this codebase can actually control.
  "X-Accel-Buffering": "no",
};

/** Only ever a `public-change` SSE frame — never a raw/arbitrary object. */
export function encodeSsePublicChangeEvent(event: PublicRealtimeEvent): string {
  return `id: ${event.id}\nevent: public-change\ndata: ${JSON.stringify(event)}\n\n`;
}

export interface CreateRealtimeSseStreamOptions {
  /** Aborts when the browser disconnects (Next.js wires this to the real connection). */
  signal: AbortSignal;
  /** Defaults to the shared process-wide broker; overridable for tests. */
  broker?: RealtimeBroker;
  /** Defaults to ~25s; overridable for tests so they don't wait 25s. */
  heartbeatMs?: number;
}

/**
 * One SSE stream per browser connection: subscribes to the broker,
 * forwards every published event as a `public-change` frame, and sends a
 * periodic bare-comment heartbeat to keep the connection alive through
 * intermediary infrastructure. On abort (client disconnect) or stream
 * cancellation, unsubscribes from the broker and clears the heartbeat
 * timer — every connection cleans up completely, leaving no listener or
 * timer behind.
 */
export function createRealtimeSseStream(options: CreateRealtimeSseStreamOptions): ReadableStream<Uint8Array> {
  const broker = options.broker ?? getRealtimeBroker();
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The controller can already be closed if the client disconnected
          // between a broker/heartbeat tick and this call landing — cleanup()
          // (driven by the abort listener below) owns tearing everything
          // down, so there is nothing else to do here.
        }
      };

      const cleanup = () => {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      if (options.signal.aborted) {
        cleanup();
        return;
      }

      safeEnqueue(`retry: ${SSE_RETRY_HINT_MS}\n\n`);

      unsubscribe = broker.subscribe((event) => {
        safeEnqueue(encodeSsePublicChangeEvent(event));
      });

      heartbeatTimer = setInterval(() => {
        // A bare SSE comment — never routed through the broker, never
        // parseable as a `public-change` event, so it can never trigger a
        // browser refresh. Its only job is keeping the connection alive
        // through proxies/load balancers that would otherwise time out an
        // idle stream. Deliberately not logged (see "Observability" — a
        // 20-30s heartbeat would otherwise be pure production noise).
        safeEnqueue(": heartbeat\n\n");
      }, heartbeatMs);

      options.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      // Belt-and-suspenders: if the platform calls cancel() instead of (or
      // in addition to) firing the abort event, cleanup still happens.
      // Idempotent — safe to run twice.
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });
}
