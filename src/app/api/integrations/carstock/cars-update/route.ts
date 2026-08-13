import { NextRequest, NextResponse } from "next/server";
import { carStockUpdatePayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockUpdate } from "@/server/services/import.service";
import { isCarStockAuthorized } from "@/lib/carstock-auth";
import { emptyFailedCarStockResponse } from "@/lib/carstock-response";

/**
 * UPDATE ONLY. Accepts a collection of cars validated by
 * carStockUpdatePayloadSchema — a dedicated STRICT schema (not the loose,
 * partial-friendly CREATE schema): every CarStock-owned key must be present
 * in each item (value may be `null` for most of them, but the key itself
 * cannot be missing), and maker/model/versionName must be non-blank. Any
 * item missing a required key, or with a blank maker/model/versionName,
 * fails validation and the WHOLE request is rejected with 400 — before any
 * database mutation happens (per-item validation isn't reachable here; see
 * processCarStockUpdate in import.service.ts). Never creates a vehicle —
 * each item is matched to an existing Vehicle strictly by carId ->
 * externalCarId (never VIN), and every CarStock-owned scalar field is fully
 * replaced. See applyCarStockFullUpdate in vehicle.service.ts for the exact
 * field-by-field semantics.
 *
 * Returns the shared CarStockBatchResponse envelope (see
 * src/lib/carstock-response.ts) — `results[]` is the per-carId source of
 * truth. A syntactically valid, authenticated batch always returns HTTP
 * 200, even when one or more carIds weren't found (`failed > 0`,
 * `ok: false`); successfully-updated items in the same batch remain
 * committed. Non-2xx is reserved for request-level failures.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 500 });
    }

    if (!isCarStockAuthorized(request)) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawItems = Array.isArray(body) ? body : body?.items;

    const parsed = carStockUpdatePayloadSchema.safeParse(rawItems);
    if (!parsed.success) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 400 });
    }

    const { log, errors, ...batchResponse } = await processCarStockUpdate(parsed.data);

    return NextResponse.json(batchResponse, { status: 200 });
  } catch (error) {
    console.error("PUT /api/integrations/carstock/cars-update failed", error);
    return NextResponse.json(emptyFailedCarStockResponse(), { status: 500 });
  }
}
