import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/permissions";
import { getAdminVehicleById } from "@/server/services/vehicle.service";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { VehicleImageManager } from "@/components/admin/vehicle-image-manager";
import { VehicleImageSourcePanel } from "@/components/admin/vehicle-image-source-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EditVehiclePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditVehiclePage({ params }: EditVehiclePageProps) {
  await requirePagePermission("VEHICLE_UPDATE");
  const { id } = await params;
  const vehicle = await getAdminVehicleById(id);
  if (!vehicle) notFound();

  const features = Array.isArray(vehicle.features) ? (vehicle.features as string[]) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">
        Επεξεργασία: {vehicle.maker} {vehicle.versionName}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Εικόνες</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleImageManager vehicleId={vehicle.id} images={vehicle.images} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Πηγή Εικόνων</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleImageSourcePanel vin={vehicle.vin} images={vehicle.images} />
        </CardContent>
      </Card>

      <VehicleForm
        mode="edit"
        vehicleId={vehicle.id}
        slug={vehicle.slug}
        defaultValues={{
          externalCarId: vehicle.externalCarId,
          maker: vehicle.maker,
          model: vehicle.model,
          versionName: vehicle.versionName,
          yearRelease: vehicle.yearRelease,
          price: vehicle.price,
          monthlyPrice: vehicle.monthlyPrice,
          km: vehicle.km,
          cc: vehicle.cc,
          hp: vehicle.hp,
          fuel: vehicle.fuel,
          transmissionType: vehicle.transmissionType,
          color: vehicle.color,
          typeOfCar: vehicle.typeOfCar,
          offer: vehicle.offer,
          froze: vehicle.froze,
          isDeleted: vehicle.isDeleted,
          plate: vehicle.plate,
          vin: vehicle.vin,
          description: vehicle.description,
          features,
          seoTitle: vehicle.seoTitle,
          seoDescription: vehicle.seoDescription,
        }}
      />
    </div>
  );
}
