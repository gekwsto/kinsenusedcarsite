import { NextRequest, NextResponse } from "next/server";
import { getActiveDisplayVehicles } from "@/server/services/vehicle.service";

function isAuthorized(request: NextRequest): boolean {
  const apiKey = process.env.CARSTOCK_API_KEY;
  if (!apiKey) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  return token === apiKey;
}

// Spec calls for POST even though this only reads data; body is unused.
export async function POST(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const items = await getActiveDisplayVehicles();
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("POST /api/integrations/carstock/display-cars failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
