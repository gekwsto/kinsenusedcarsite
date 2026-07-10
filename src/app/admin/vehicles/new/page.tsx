import { requirePagePermission } from "@/lib/permissions";
import { VehicleForm } from "@/components/admin/vehicle-form";

export default async function NewVehiclePage() {
  await requirePagePermission("VEHICLE_CREATE");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Νέο Όχημα</h1>
      <VehicleForm mode="create" />
    </div>
  );
}
