import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { removeUploadedImage } from "@/lib/images";
import { removeVehicleImage } from "@/server/services/vehicle.service";
import { prisma } from "@/lib/prisma";

const setMainSchema = z.object({ isMain: z.literal(true) });

/**
 * "Set as main image" has no dedicated service function in vehicle.service.ts
 * (only addVehicleImage/removeVehicleImage/reorderVehicleImages exist), so this
 * handler talks to prisma directly — same pattern as the dashboard's inline
 * aggregate queries. Kept on this route since it addresses the same
 * [id]/images/[imageId] resource as DELETE below.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    await requirePermission("VEHICLE_IMAGE_MANAGE");
    const { id, imageId } = await params;
    const body = await req.json();
    setMainSchema.parse(body);

    const image = await prisma.$transaction(async (tx) => {
      await tx.vehicleImage.updateMany({ where: { vehicleId: id }, data: { isMain: false } });
      return tx.vehicleImage.update({ where: { id: imageId }, data: { isMain: true } });
    });

    return NextResponse.json(image);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    await requirePermission("VEHICLE_IMAGE_MANAGE");
    const { id, imageId } = await params;
    const removed = await removeVehicleImage(id, imageId);

    if (removed?.url) {
      // Best-effort file cleanup — never fail the request over this.
      await removeUploadedImage(removed.url).catch(() => undefined);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
