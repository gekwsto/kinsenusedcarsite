import { NextResponse } from "next/server";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { getImportLogById } from "@/server/services/import.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("IMPORT_LOG_READ");
    const { id } = await params;
    const log = await getImportLogById(id, { includeRawPayload: hasPermission(actor, "IMPORT_RAW_PAYLOAD_READ") });
    if (!log) return NextResponse.json({ error: "Δεν βρέθηκε η εισαγωγή" }, { status: 404 });
    return NextResponse.json(log);
  } catch (error) {
    return handleApiError(error);
  }
}
