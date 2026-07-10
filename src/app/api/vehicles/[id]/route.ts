import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeVehicle } from "@/server/services/vehicle.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        froze: false,
        isDeleted: false,
      },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // plate/vin are admin-only fields and must never leak into the public response.
    const { plate, vin, ...publicVehicle } = serializeVehicle(vehicle);
    void plate;
    void vin;

    return NextResponse.json(publicVehicle, { status: 200 });
  } catch (error) {
    console.error("GET /api/vehicles/[id] failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
