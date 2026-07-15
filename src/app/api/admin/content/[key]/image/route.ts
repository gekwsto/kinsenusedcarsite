import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { uploadContentImage } from "@/lib/images";
import { CONTENT_DEFAULTS, type ContentKey } from "@/lib/content-defaults";

function isContentKey(key: string): key is ContentKey {
  return key in CONTENT_DEFAULTS;
}

// Uploads only — returns the new file's URL so the admin content editor
// can stage it into its local (unsaved) form state, exactly like typing
// into a text field. The image only actually becomes part of a section's
// content once the editor's existing "Αποθήκευση" action PATCHes the whole
// section (this route never itself writes to PageContent), so uploading a
// new image and then navigating away without saving discards it, same as
// any other unsaved edit here.
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requirePermission("CONTENT_UPDATE");
    const { key } = await params;
    if (!isContentKey(key)) {
      return NextResponse.json({ error: "Άγνωστο κλειδί περιεχομένου" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Δεν δόθηκε αρχείο εικόνας" }, { status: 400 });
    }

    const { url } = await uploadContentImage(file, key);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
