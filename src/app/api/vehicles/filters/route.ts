import { NextResponse } from "next/server";
import { getPublicFilterOptions } from "@/server/services/vehicle.service";

export async function GET() {
  try {
    const options = await getPublicFilterOptions();
    return NextResponse.json(options, { status: 200 });
  } catch (error) {
    console.error("GET /api/vehicles/filters failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
