import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFavoriteIds } from "@/server/services/favorite.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const ids = await listFavoriteIds(session.user.id);
    return NextResponse.json({ ids }, { status: 200 });
  } catch (error) {
    console.error("GET /api/favorites/ids failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
