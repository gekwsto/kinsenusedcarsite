import { NextResponse } from "next/server";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { listImportLogs } from "@/server/services/import.service";

export async function GET(req: Request) {
  try {
    const actor = await requirePermission("IMPORT_LOG_READ");
    const { searchParams } = new URL(req.url);

    const result = await listImportLogs({
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
      includeRawPayload: hasPermission(actor, "IMPORT_RAW_PAYLOAD_READ"),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
