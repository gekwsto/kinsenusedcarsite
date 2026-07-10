import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { uploadVehicleImage } from "@/lib/images";
import { addVehicleImage } from "@/server/services/vehicle.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("VEHICLE_IMAGE_MANAGE");
    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Δεν δόθηκε αρχείο εικόνας" }, { status: 400 });
    }

    const alt = formData.get("alt");
    const isMain = formData.get("isMain");

    const { url } = await uploadVehicleImage(file, id);
    const image = await addVehicleImage(id, url, {
      alt: typeof alt === "string" && alt.length > 0 ? alt : undefined,
      isMain: isMain === "true",
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
