import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { updateUserSchema } from "@/lib/validators/user.schema";
import { setUserActive, updateUserRole } from "@/server/services/user.service";

/**
 * isActive toggles require USER_UPDATE; role changes additionally require
 * USER_ROLE_UPDATE. Both permissions currently map to SUPER_ADMIN only, but
 * are checked separately so a future split (e.g. a role that can toggle
 * activation without granting role changes) doesn't require touching this
 * route again. Self-modification and last-remaining-SUPER_ADMIN guards live
 * in the service layer (user.service.ts), enforced regardless of caller.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = updateUserSchema.parse(body);

    let user;
    if (input.role !== undefined) {
      const actor = await requirePermission("USER_ROLE_UPDATE");
      user = await updateUserRole(actor, id, input.role);
    }
    if (input.isActive !== undefined) {
      const actor = await requirePermission("USER_UPDATE");
      user = await setUserActive(actor, id, input.isActive);
    }

    if (!user) return NextResponse.json({ error: "Δεν δόθηκε καμία αλλαγή" }, { status: 400 });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch (error) {
    return handleApiError(error);
  }
}
