import type { NextRequest } from "next/server";

/**
 * Single Bearer-token check shared by every CarStock write endpoint (POST
 * create/restore, PUT update, POST soft-delete). Byte-identical to the check
 * each route previously carried locally — extracted only so
 * CREATE/UPDATE/DELETE can never drift into checking the header differently,
 * not to change behavior. Existing CarStock callers keep sending the exact
 * same `Authorization: Bearer <CARSTOCK_API_KEY>` header they always have.
 */
export function isCarStockAuthorized(request: NextRequest): boolean {
  const apiKey = process.env.CARSTOCK_API_KEY;
  if (!apiKey) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  return token === apiKey;
}
