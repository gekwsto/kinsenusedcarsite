import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { updateFaqSchema } from "@/lib/validators/faq.schema";
import { deleteFaqItem, updateFaqItem } from "@/server/services/faq.service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("FAQ_MANAGE");
    const { id } = await params;
    const body = await req.json();
    const input = updateFaqSchema.parse(body);
    const item = await updateFaqItem(id, {
      ...input,
      category: input.category ?? undefined,
    });
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("FAQ_MANAGE");
    const { id } = await params;
    await deleteFaqItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
