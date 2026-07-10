import { requirePagePermission } from "@/lib/permissions";
import { listLeads } from "@/server/services/lead.service";
import { LeadsFilterBar } from "@/components/admin/leads-filter-bar";
import { LeadsTable } from "@/components/admin/leads-table";

export const dynamic = "force-dynamic";

interface AdminLeadsPageProps {
  searchParams: Promise<{
    status?: string;
    interestType?: string;
    vehicleId?: string;
    page?: string;
  }>;
}

export default async function AdminLeadsPage({ searchParams }: AdminLeadsPageProps) {
  await requirePagePermission("LEAD_READ");
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await listLeads({
    status: sp.status,
    interestType: sp.interestType,
    vehicleId: sp.vehicleId,
    page,
    pageSize: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Leads</h1>
      <LeadsFilterBar />
      <LeadsTable
        leads={result.items.map((lead) => ({
          id: lead.id,
          createdAt: lead.createdAt,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          message: lead.message,
          interestType: lead.interestType,
          status: lead.status,
          internalNotes: lead.internalNotes,
          vehicle: lead.vehicle,
        }))}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  );
}
