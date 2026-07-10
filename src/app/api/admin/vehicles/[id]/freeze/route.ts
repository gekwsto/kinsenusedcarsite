import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { setVehicleFrozen } from "@/server/services/vehicle.service";

const freezeSchema = z.object({ froze: z.coerce.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("VEHICLE_UPDATE");
    const { id } = await params;
    const body = await req.json();
    const { froze } = freezeSchema.parse(body);
    const vehicle = await setVehicleFrozen(id, froze);
    return NextResponse.json(vehicle);
  } catch (error) {
    return handleApiError(error);
  }
}
