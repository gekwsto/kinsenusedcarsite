import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { reorderVehicleImages } from "@/server/services/vehicle.service";

const reorderSchema = z.object({ orderedImageIds: z.array(z.string()).min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("VEHICLE_IMAGE_MANAGE");
    const { id } = await params;
    const body = await req.json();
    const { orderedImageIds } = reorderSchema.parse(body);
    await reorderVehicleImages(id, orderedImageIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
