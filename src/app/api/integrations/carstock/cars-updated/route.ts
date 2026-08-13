import { NextRequest, NextResponse } from "next/server";
import { carStockPayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockPayload } from "@/server/services/import.service";
import { isCarStockAuthorized } from "@/lib/carstock-auth";
import { emptyFailedCarStockResponse } from "@/lib/carstock-response";

/**
 * CREATE / SKIP / RESTORE. A new externalCarId creates a Vehicle; an
 * existing ACTIVE carId (or one repeated within the batch) is skipped —
 * counted as a SUCCESS, since the CMS-desired state "this vehicle exists on
 * the Used Cars site" is already satisfied; an existing SOFT-DELETED carId
 * is restored in place, but ONLY when the item is the complete current
 * CarStock state (see createVehicleFromCarStock and carStockRestoreItemSchema
 * in vehicle.service.ts / carstock.schema.ts) — an incomplete/invalid
 * restore payload is a FAILURE result (`restore_rejected`) and never
 * mutates the Vehicle.
 *
 * Returns the shared CarStockBatchResponse envelope (see
 * src/lib/carstock-response.ts) — `results[]` is the per-carId source of
 * truth; `ok`/the five counters are only a derived summary. A syntactically
 * valid, authenticated batch always returns HTTP 200, even when individual
 * items failed (`failed > 0`, `ok: false`) — successful items in the same
 * batch remain committed. Non-2xx is reserved for request-level failures
 * (missing server config, bad auth, unparseable/malformed body, or an
 * unrecoverable exception) where no trustworthy per-item results exist at
 * all.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      // Never silently allow requests when the shared secret isn't configured.
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 500 });
    }

    if (!isCarStockAuthorized(request)) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawItems = Array.isArray(body) ? body : body?.items;

    const parsed = carStockPayloadSchema.safeParse(rawItems);
    if (!parsed.success) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 400 });
    }

    // `errors`/`log` are internal-only (ImportLog persistence, detailed
    // diagnostics) and must never reach the response body — destructuring
    // them out here, rather than spreading `result` directly into
    // NextResponse.json, is what guarantees that.
    const { log, errors, ...batchResponse } = await processCarStockPayload(parsed.data, "carstock");

    return NextResponse.json(batchResponse, { status: 200 });
  } catch (error) {
    console.error("POST /api/integrations/carstock/cars-updated failed", error);
    return NextResponse.json(emptyFailedCarStockResponse(), { status: 500 });
  }
}
