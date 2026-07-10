import type { ContactMessageStatus } from "@prisma/client";
import { requirePagePermission } from "@/lib/permissions";
import { listContactMessages } from "@/server/services/contact.service";
import { ContactMessagesTable } from "@/components/admin/contact-messages-table";

export const dynamic = "force-dynamic";

interface AdminContactMessagesPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminContactMessagesPage({ searchParams }: AdminContactMessagesPageProps) {
  await requirePagePermission("CONTACT_MESSAGE_READ");
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await listContactMessages({
    status: sp.status as ContactMessageStatus | undefined,
    page,
    pageSize: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Μηνύματα Επικοινωνίας</h1>
      <ContactMessagesTable
        messages={result.items}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  );
}
