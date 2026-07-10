import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { exportLeadsToCsv } from "@/server/services/lead.service";

export async function GET(req: Request) {
  try {
    await requirePermission("LEAD_READ");
    const { searchParams } = new URL(req.url);

    const csv = await exportLeadsToCsv({
      status: searchParams.get("status") ?? undefined,
      interestType: searchParams.get("interestType") ?? undefined,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
