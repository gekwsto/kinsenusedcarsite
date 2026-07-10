import { NextResponse } from "next/server";
import type { ContactMessageStatus } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { listContactMessages } from "@/server/services/contact.service";

export async function GET(req: Request) {
  try {
    await requirePermission("CONTACT_MESSAGE_READ");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const result = await listContactMessages({
      status: (status as ContactMessageStatus | null) ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
