import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toggleFavoriteSchema } from "@/lib/validators/favorite.schema";
import { toggleFavorite } from "@/server/services/favorite.service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = toggleFavoriteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await toggleFavorite(session.user.id, parsed.data.vehicleId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/favorites/toggle failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
