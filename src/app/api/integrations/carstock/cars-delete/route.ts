import { NextRequest, NextResponse } from "next/server";
import { carStockDeleteBodySchema } from "@/lib/validators/carstock.schema";
import { processCarStockDelete } from "@/server/services/import.service";
import { isCarStockAuthorized } from "@/lib/carstock-auth";
import { emptyFailedCarStockResponse } from "@/lib/carstock-response";

/**
 * Bulk SOFT delete. Deliberately POST, not HTTP DELETE: the external
 * CMS/client has unreliable support for a JSON request body on a DELETE
 * request, and this is an integration command endpoint where POST + a JSON
 * body is the compatible choice. The operation itself is unchanged — it
 * remains a pure soft delete, never a physical one. Reuses the exact same
 * Bearer-token contract as POST /cars-updated and PUT /cars-update. Body is
 * either a bare array of carId values (`[123, 456]`, the canonical shape) or
 * `{ carIds: [...] }`. Vehicles are matched strictly by carId ->
 * externalCarId (never VIN) and only `isDeleted` is ever changed — no row is
 * ever physically deleted, and no related VehicleExtra/VehicleImage/Lead
 * rows are touched. A vehicle soft-deleted here can later be brought back
 * via the same carId through POST /cars-updated (RESTORE) — see
 * createVehicleFromCarStock in vehicle.service.ts.
 *
 * Returns the shared CarStockBatchResponse envelope (see
 * src/lib/carstock-response.ts) — every requested carId gets its own
 * SUCCESSFUL result (`deleted`, `already_deleted`, or `not_found`: for
 * DELETE, "no such vehicle" already satisfies the CMS-desired end state, so
 * it is success, not failure — see processCarStockDelete in
 * import.service.ts). A syntactically valid, authenticated batch always
 * returns HTTP 200; non-2xx is reserved for request-level failures.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 500 });
    }

    if (!isCarStockAuthorized(request)) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const parsed = carStockDeleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(emptyFailedCarStockResponse(), { status: 400 });
    }

    const rawCarIds = Array.isArray(parsed.data) ? parsed.data : parsed.data.carIds;
    const { log, ...batchResponse } = await processCarStockDelete(rawCarIds);

    return NextResponse.json(batchResponse, { status: 200 });
  } catch (error) {
    console.error("POST /api/integrations/carstock/cars-delete failed", error);
    return NextResponse.json(emptyFailedCarStockResponse(), { status: 500 });
  }
}
