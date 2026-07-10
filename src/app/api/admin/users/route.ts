import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { createUserSchema } from "@/lib/validators/user.schema";
import { listUsers, createUser } from "@/server/services/user.service";

export async function GET(req: Request) {
  try {
    await requirePermission("USER_READ");
    const { searchParams } = new URL(req.url);

    const result = await listUsers({
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("USER_CREATE");
    const body = await req.json();
    const input = createUserSchema.parse(body);

    const { user, temporaryPassword } = await createUser(actor, input);
    const { passwordHash: _passwordHash, ...safeUser } = user;

    return NextResponse.json({ user: safeUser, temporaryPassword }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
