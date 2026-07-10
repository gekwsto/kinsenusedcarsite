import { NextRequest, NextResponse } from "next/server";
import { getAvailableColors } from "@/server/services/vehicle.service";

function isAuthorized(request: NextRequest): boolean {
  const apiKey = process.env.CARSTOCK_API_KEY;
  if (!apiKey) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  return token === apiKey;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const colors = await getAvailableColors();
    return NextResponse.json({ colors }, { status: 200 });
  } catch (error) {
    console.error("GET /api/integrations/carstock/available-colors failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
