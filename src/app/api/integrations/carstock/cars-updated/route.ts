import { NextRequest, NextResponse } from "next/server";
import { carStockPayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockPayload } from "@/server/services/import.service";

/**
 * The real CarStock client only understands `CreateUmbraccoCarsRoot`:
 * `{ ok: boolean, added: number }`. This is the entire public response
 * contract for this legacy endpoint — success AND error responses alike —
 * so nothing else (importLogId, status, per-item errors, stack traces,
 * DB errors) may ever appear in a response body here. The full internal
 * result is still persisted on every call via processCarStockPayload's
 * ImportLog row, and is available to admins through
 * GET /api/admin/imports and /api/admin/imports/[id].
 */
function carStockResponse(ok: boolean, added: number, status: number) {
  return NextResponse.json({ ok, added }, { status });
}

function isAuthorized(request: NextRequest): boolean {
  const apiKey = process.env.CARSTOCK_API_KEY;
  if (!apiKey) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  return token === apiKey;
}

export async function POST(request: NextRequest) {
  // TEMPORARY diagnostic for the production 403 investigation (used.kinsen.gr
  // returns 403 for the real CarStock caller before this line would ever
  // execute, if the block happens at Cloudflare/Nginx Proxy Manager). Its
  // presence or absence in prod logs is the definitive test for "did this
  // request even reach the Next.js container." Never logs the token value —
  // only presence/shape of the Authorization header. Remove once the 403 is
  // root-caused.
  console.info("[carstock-diagnostic]", {
    pathname: request.nextUrl.pathname,
    hasAuthorizationHeader: request.headers.has("authorization"),
    startsWithBearer: (request.headers.get("authorization") ?? "").startsWith("Bearer "),
    reachedRouteHandler: true,
  });

  try {
    if (!process.env.CARSTOCK_API_KEY) {
      // Never silently allow requests when the shared secret isn't configured.
      return carStockResponse(false, 0, 500);
    }

    if (!isAuthorized(request)) {
      return carStockResponse(false, 0, 401);
    }

    const body = await request.json().catch(() => null);
    const rawItems = Array.isArray(body) ? body : body?.items;

    const parsed = carStockPayloadSchema.safeParse(rawItems);
    if (!parsed.success) {
      return carStockResponse(false, 0, 400);
    }

    // `added` counts only newly inserted Vehicle rows — updates, freezes and
    // deletes are tracked internally (ImportLog) but never surfaced here.
    const result = await processCarStockPayload(parsed.data, "carstock");

    return carStockResponse(true, result.createdCount, 200);
  } catch (error) {
    console.error("POST /api/integrations/carstock/cars-updated failed", error);
    return carStockResponse(false, 0, 500);
  }
}
