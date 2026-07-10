import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { listLeads } from "@/server/services/lead.service";

export async function GET(req: Request) {
  try {
    await requirePermission("LEAD_READ");
    const { searchParams } = new URL(req.url);

    const result = await listLeads({
      status: searchParams.get("status") ?? undefined,
      interestType: searchParams.get("interestType") ?? undefined,
      vehicleId: searchParams.get("vehicleId") ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
