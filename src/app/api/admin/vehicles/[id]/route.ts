import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { vehicleAdminUpdateSchema } from "@/lib/validators/vehicle.schema";
import { getAdminVehicleById, softDeleteVehicle, updateVehicle } from "@/server/services/vehicle.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("VEHICLE_READ");
    const { id } = await params;
    const vehicle = await getAdminVehicleById(id);
    if (!vehicle) return NextResponse.json({ error: "Δεν βρέθηκε το όχημα" }, { status: 404 });
    return NextResponse.json(vehicle);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("VEHICLE_UPDATE");
    const { id } = await params;
    const body = await req.json();
    const input = vehicleAdminUpdateSchema.parse(body);
    const vehicle = await updateVehicle(id, input);
    if (!vehicle) return NextResponse.json({ error: "Δεν βρέθηκε το όχημα" }, { status: 404 });
    return NextResponse.json(vehicle);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("VEHICLE_DELETE");
    const { id } = await params;
    await softDeleteVehicle(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
