import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-error";
import { updateSiteSettingsSchema } from "@/lib/validators/settings.schema";
import { getSiteSettings, updateSiteSetting, type SiteSettings } from "@/server/services/settings.service";

export async function GET() {
  try {
    await requirePermission("SETTINGS_READ");
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    await requirePermission("SETTINGS_UPDATE");
    const body = await req.json();
    const input = updateSiteSettingsSchema.parse(body);

    await Promise.all(
      (Object.keys(input) as (keyof SiteSettings)[]).map((key) => updateSiteSetting(key, input[key])),
    );

    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
