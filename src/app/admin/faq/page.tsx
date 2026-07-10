import { requirePagePermission } from "@/lib/permissions";
import { listAllFaqItems } from "@/server/services/faq.service";
import { FaqManager } from "@/components/admin/faq-manager";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  await requirePagePermission("FAQ_MANAGE");
  const items = await listAllFaqItems();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Συχνές Ερωτήσεις (FAQ)</h1>
      <FaqManager items={items} />
    </div>
  );
}
