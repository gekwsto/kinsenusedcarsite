import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/permissions";
import { AppError } from "@/lib/errors";

/**
 * Shared error → HTTP response mapping for admin API routes.
 * Every route handler should call requireAdmin()/requireSuperAdmin()/
 * requirePermission() first and wrap its body in try/catch, passing any
 * caught error to this helper.
 */
export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Μη έγκυρα δεδομένα", fieldErrors: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (error instanceof Error && error.message.startsWith("Unsupported image type")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Σφάλμα διακομιστή" }, { status: 500 });
}
