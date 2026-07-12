import type { Metadata } from "next";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Button } from "@/components/ui/button";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";
import { EmptyState } from "@/components/vehicles/empty-state";
import { auth } from "@/lib/auth";
import { listFavoriteVehicles } from "@/server/services/favorite.service";
import { resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";

export const metadata: Metadata = {
  title: "Αγαπημένα",
  description: "Τα αγαπημένα οχήματα που έχετε αποθηκεύσει στην Kinsen.",
  alternates: { canonical: "/favorites" },
};

export default async function FavoritesPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="container-page py-12">
        <EmptyState
          title="Συνδεθείτε για να δείτε τα αγαπημένα σας"
          description="Αποθηκεύστε τα οχήματα που σας ενδιαφέρουν συνδεόμενοι στον λογαριασμό σας."
          action={
            <Button asChild className="mt-2">
              <Link href="/login?callbackUrl=/favorites">Σύνδεση</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const favoriteVehicles = await listFavoriteVehicles(session.user.id);
  const vehicles = await resolveVehicleImagesForList(favoriteVehicles);

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-2xl font-bold text-ink sm:text-3xl">Τα αγαπημένα μου</h1>

      {vehicles.length > 0 ? (
        <VehicleGrid vehicles={vehicles} />
      ) : (
        <EmptyState
          title="Δεν έχετε αγαπημένα οχήματα ακόμα"
          description="Περιηγηθείτε στα διαθέσιμα οχήματα και αποθηκεύστε αυτά που σας ενδιαφέρουν."
          action={
            <Button asChild className="mt-2">
              <Link href="/vehicles">Δείτε διαθέσιμα οχήματα</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
