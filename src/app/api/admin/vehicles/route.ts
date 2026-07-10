import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { vehicleAdminSchema } from "@/lib/validators/vehicle.schema";
import { createVehicle, listAdminVehicles } from "@/server/services/vehicle.service";

export async function GET(req: Request) {
  try {
    await requirePermission("VEHICLE_READ");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const result = await listAdminVehicles({
      search: searchParams.get("search") ?? undefined,
      status: (status as "active" | "frozen" | "deleted" | "offer" | null) ?? undefined,
      maker: searchParams.get("maker") ?? undefined,
      fuel: searchParams.get("fuel") ?? undefined,
      transmissionType: searchParams.get("transmissionType") ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("VEHICLE_CREATE");
    const body = await req.json();
    const input = vehicleAdminSchema.parse(body);
    const vehicle = await createVehicle(input);
    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
