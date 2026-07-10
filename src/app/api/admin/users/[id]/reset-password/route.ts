import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { resetUserPassword } from "@/server/services/user.service";

/**
 * Generates a brand-new random temporary password for the target user and
 * returns it once in the response body. Gated by USER_UPDATE (SUPER_ADMIN
 * only) since it's a sensitive account-takeover-adjacent action.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("USER_UPDATE");
    const { id } = await params;
    const { temporaryPassword } = await resetUserPassword(actor, id);
    return NextResponse.json({ temporaryPassword });
  } catch (error) {
    return handleApiError(error);
  }
}
