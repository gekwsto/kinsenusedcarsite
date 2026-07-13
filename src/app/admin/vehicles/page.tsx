import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission } from "@/lib/permissions";
import { listAdminVehicles } from "@/server/services/vehicle.service";
import { Button } from "@/components/ui/button";
import { VehiclesFilterBar } from "@/components/admin/vehicles-filter-bar";
import { VehiclesTable } from "@/components/admin/vehicles-table";

export const dynamic = "force-dynamic";

interface AdminVehiclesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    maker?: string;
    fuel?: string;
    transmissionType?: string;
    page?: string;
  }>;
}

export default async function AdminVehiclesPage({ searchParams }: AdminVehiclesPageProps) {
  await requirePagePermission("VEHICLE_READ");
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await listAdminVehicles({
    search: sp.search,
    status: sp.status as "active" | "frozen" | "deleted" | "offer" | undefined,
    maker: sp.maker,
    fuel: sp.fuel,
    transmissionType: sp.transmissionType,
    page,
    pageSize: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Οχήματα</h1>
        <Button asChild>
          <Link href="/admin/vehicles/new">
            <Plus className="h-4 w-4" />
            Νέο Όχημα
          </Link>
        </Button>
      </div>

      <VehiclesFilterBar />

      <VehiclesTable
        vehicles={result.items.map((v) => ({
          id: v.id,
          slug: v.slug,
          maker: v.maker,
          versionName: v.versionName,
          yearRelease: v.yearRelease,
          price: v.price,
          km: v.km,
          offer: v.offer,
          froze: v.froze,
          isDeleted: v.isDeleted,
        }))}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  );
}
