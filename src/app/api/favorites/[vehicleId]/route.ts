import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { removeFavorite } from "@/server/services/favorite.service";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { vehicleId } = await params;
    await removeFavorite(session.user.id, vehicleId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/favorites/[vehicleId] failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
