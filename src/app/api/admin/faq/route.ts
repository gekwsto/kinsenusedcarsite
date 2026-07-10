import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { createFaqSchema } from "@/lib/validators/faq.schema";
import { createFaqItem, listAllFaqItems } from "@/server/services/faq.service";

export async function GET() {
  try {
    await requirePermission("FAQ_MANAGE");
    const items = await listAllFaqItems();
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("FAQ_MANAGE");
    const body = await req.json();
    const input = createFaqSchema.parse(body);
    const item = await createFaqItem({
      question: input.question,
      answer: input.answer,
      category: input.category ?? undefined,
      sortOrder: input.sortOrder,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
