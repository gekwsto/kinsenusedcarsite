import { NextRequest, NextResponse } from "next/server";
import { carStockPayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockPayload } from "@/server/services/import.service";

function isAuthorized(request: NextRequest): boolean {
  const apiKey = process.env.CARSTOCK_API_KEY;
  if (!apiKey) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  return token === apiKey;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.CARSTOCK_API_KEY) {
      // Never silently allow requests when the shared secret isn't configured.
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawItems = Array.isArray(body) ? body : body?.items;

    const parsed = carStockPayloadSchema.safeParse(rawItems);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await processCarStockPayload(parsed.data, "carstock");

    return NextResponse.json(
      {
        importLogId: result.log.id,
        status: result.log.status,
        receivedCount: parsed.data.length,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        deletedCount: result.deletedCount,
        frozenCount: result.frozenCount,
        errors: result.errors,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST /api/integrations/carstock/cars-updated failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
