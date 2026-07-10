import { NextRequest, NextResponse } from "next/server";
import { vehicleFilterSchema } from "@/lib/validators/vehicle.schema";
import { listPublicVehicles } from "@/server/services/vehicle.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = vehicleFilterSchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await listPublicVehicles(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("GET /api/vehicles failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
