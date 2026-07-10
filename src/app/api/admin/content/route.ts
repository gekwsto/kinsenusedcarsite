import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { getAllPageContent } from "@/server/services/content.service";

export async function GET() {
  try {
    await requirePermission("CONTENT_READ");
    const content = await getAllPageContent();
    return NextResponse.json(content);
  } catch (error) {
    return handleApiError(error);
  }
}
