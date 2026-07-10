import { requirePagePermission } from "@/lib/permissions";
import { getSiteSettings } from "@/server/services/settings.service";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePagePermission("SETTINGS_READ");
  const settings = await getSiteSettings();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Ρυθμίσεις</h1>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
