import { NextRequest, NextResponse } from "next/server";
import { carStockDeleteBodySchema } from "@/lib/validators/carstock.schema";
import { processCarStockDelete } from "@/server/services/import.service";
import { isCarStockAuthorized } from "@/lib/carstock-auth";

/**
 * `{ ok, deleted }` only — same safe-response-shape discipline as the other
 * two CarStock write endpoints. `deleted` counts only vehicles newly flipped
 * from isDeleted=false -> true; unknown or already-deleted carIds are
 * silently no-ops, which is what makes repeat calls idempotent.
 */
function carStockResponse(ok: boolean, deleted: number, status: number) {
  return NextResponse.json({ ok, deleted }, { status });
}

/**
 * Bulk SOFT delete. Reuses the exact same Bearer-token contract as
 * POST /cars-updated and PUT /cars-update. Body is either a bare array of
 * carId values (`[123, 456]`, the canonical shape) or `{ carIds: [...] }`.
 * Vehicles are matched strictly by carId -> externalCarId (never VIN) and
 * only `isDeleted` is ever changed — no row is ever physically deleted, and
 * no related VehicleExtra/VehicleImage/Lead rows are touched.
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      return carStockResponse(false, 0, 500);
    }

    if (!isCarStockAuthorized(request)) {
      return carStockResponse(false, 0, 401);
    }

    const body = await request.json().catch(() => null);

    const parsed = carStockDeleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return carStockResponse(false, 0, 400);
    }

    const rawIds = Array.isArray(parsed.data) ? parsed.data : parsed.data.carIds;
    const externalCarIds = Array.from(new Set(rawIds.map(String)));

    const result = await processCarStockDelete(externalCarIds);

    return carStockResponse(true, result.deletedCount, 200);
  } catch (error) {
    console.error("DELETE /api/integrations/carstock/cars-delete failed", error);
    return carStockResponse(false, 0, 500);
  }
}
