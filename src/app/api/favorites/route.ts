import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFavoriteVehicles } from "@/server/services/favorite.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const items = await listFavoriteVehicles(session.user.id);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("GET /api/favorites failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
