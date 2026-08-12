import { NextRequest, NextResponse } from "next/server";
import { carStockUpdatePayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockUpdate } from "@/server/services/import.service";
import { isCarStockAuthorized } from "@/lib/carstock-auth";

/**
 * Same safe-response-shape discipline as POST /cars-updated: only
 * `{ ok, updated }` ever reaches the caller, success or failure alike. Full
 * per-item detail (which carIds updated, which weren't found, raw errors)
 * stays internal via processCarStockUpdate's ImportLog row.
 */
function carStockResponse(ok: boolean, updated: number, status: number) {
  return NextResponse.json({ ok, updated }, { status });
}

/**
 * UPDATE ONLY. Accepts a collection of cars validated by
 * carStockUpdatePayloadSchema — a dedicated STRICT schema (not the loose,
 * partial-friendly CREATE schema): every CarStock-owned key must be present
 * in each item (value may be `null` for most of them, but the key itself
 * cannot be missing), and maker/model/versionName must be non-blank. Any
 * item missing a required key, or with a blank maker/model/versionName,
 * fails validation and the whole request is rejected with 400 — before any
 * database mutation happens. Never creates a vehicle — each item is matched
 * to an existing Vehicle strictly by carId -> externalCarId (never VIN), and
 * every CarStock-owned scalar field is fully replaced. See
 * applyCarStockFullUpdate in vehicle.service.ts for the exact field-by-field
 * semantics.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      return carStockResponse(false, 0, 500);
    }

    if (!isCarStockAuthorized(request)) {
      return carStockResponse(false, 0, 401);
    }

    const body = await request.json().catch(() => null);
    const rawItems = Array.isArray(body) ? body : body?.items;

    const parsed = carStockUpdatePayloadSchema.safeParse(rawItems);
    if (!parsed.success) {
      return carStockResponse(false, 0, 400);
    }

    const result = await processCarStockUpdate(parsed.data);

    return carStockResponse(true, result.updatedCount, 200);
  } catch (error) {
    console.error("PUT /api/integrations/carstock/cars-update failed", error);
    return carStockResponse(false, 0, 500);
  }
}
