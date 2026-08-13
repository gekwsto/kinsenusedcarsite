import { NextRequest, NextResponse } from "next/server";
import { createRealtimeSseStream, SSE_HEADERS } from "@/server/realtime/sse";

// Node runtime (not Edge) — the in-memory broker is a plain Node module
// singleton (see src/server/realtime/broker.ts) and needs to run in the
// same process as the rest of the app's mutation code for pub/sub to work
// at all. Never statically cached/optimized — every connection is a live,
// per-request stream.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated SSE endpoint — ONE stream per connected browser
 * tab (see PublicRealtimeProvider, mounted once in the public layout).
 * Never carries authoritative Vehicle/PageContent/FAQ/SiteSettings data,
 * only small invalidation events (see src/lib/realtime/types.ts) telling
 * the browser to re-read PostgreSQL via router.refresh(). All the actual
 * stream/heartbeat/cleanup logic lives in server/realtime/sse.ts so it's
 * unit-testable; this file only wires it to the real request/response.
 */
export async function GET(request: NextRequest) {
  const stream = createRealtimeSseStream({ signal: request.signal });
  return new NextResponse(stream, { headers: SSE_HEADERS });
}
