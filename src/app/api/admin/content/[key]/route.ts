import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { CONTENT_DEFAULTS, type ContentKey } from "@/lib/content-defaults";
import { CONTENT_SCHEMAS } from "@/lib/validators/content.schema";
import { getPageContent, updatePageContent, resetPageContent } from "@/server/services/content.service";

function isContentKey(key: string): key is ContentKey {
  return key in CONTENT_DEFAULTS;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requirePermission("CONTENT_UPDATE");
    const { key } = await params;
    if (!isContentKey(key)) {
      return NextResponse.json({ error: "Άγνωστο κλειδί περιεχομένου" }, { status: 404 });
    }

    const body = await req.json();
    const schema = CONTENT_SCHEMAS[key];
    const value = schema.parse(body);

    await updatePageContent(key, value);
    const updated = await getPageContent(key);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requirePermission("CONTENT_UPDATE");
    const { key } = await params;
    if (!isContentKey(key)) {
      return NextResponse.json({ error: "Άγνωστο κλειδί περιεχομένου" }, { status: 404 });
    }
    await resetPageContent(key);
    return NextResponse.json({ ok: true, value: CONTENT_DEFAULTS[key] });
  } catch (error) {
    return handleApiError(error);
  }
}
