import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { updateContactMessageSchema } from "@/lib/validators/contact.schema";
import { updateContactMessageStatus } from "@/server/services/contact.service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("CONTACT_MESSAGE_UPDATE");
    const { id } = await params;
    const body = await req.json();
    const { status } = updateContactMessageSchema.parse(body);
    const message = await updateContactMessageStatus(id, status);
    return NextResponse.json(message);
  } catch (error) {
    return handleApiError(error);
  }
}
