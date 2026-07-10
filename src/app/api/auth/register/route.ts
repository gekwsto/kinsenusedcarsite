import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validators/auth.schema";
import { registerUser, EmailAlreadyRegisteredError } from "@/server/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    try {
      await registerUser(parsed.data);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
