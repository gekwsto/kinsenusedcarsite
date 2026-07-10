import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { updateLeadSchema } from "@/lib/validators/lead.schema";
import { getLeadById, updateLead } from "@/server/services/lead.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("LEAD_READ");
    const { id } = await params;
    const lead = await getLeadById(id);
    if (!lead) return NextResponse.json({ error: "Δεν βρέθηκε το lead" }, { status: 404 });
    return NextResponse.json(lead);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("LEAD_UPDATE");
    const { id } = await params;
    const body = await req.json();
    const input = updateLeadSchema.parse(body);
    const lead = await updateLead(id, input);
    return NextResponse.json(lead);
  } catch (error) {
    return handleApiError(error);
  }
}
