import type { Metadata } from "next";
import { CarFront } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicStatusState } from "@/components/status/public-status-state";

export const metadata: Metadata = {
  title: "Το όχημα δεν είναι διαθέσιμο",
  robots: { index: false, follow: false },
};

// Rendered when getPublicVehicleBySlug (src/server/services/vehicle.service.ts)
// resolves to null — bad slug, soft-deleted, or frozen/non-public — see
// vehicles/[slug]/page.tsx's `if (!vehicle) notFound()`. Deliberately does
// not distinguish *why* the vehicle is unavailable; a genuine lookup
// failure (DB/infra error) is never routed here since that function throws
// rather than returning null, which the nearest error.tsx handles instead.
export default function VehicleNotFound() {
  return (
    <PublicStatusState
      icon={CarFront}
      eyebrow="Όχημα μη διαθέσιμο"
      title="Το όχημα που αναζητάτε δεν είναι πλέον διαθέσιμο"
      description="Μπορεί να έχει αφαιρεθεί, να μην είναι πλέον διαθέσιμο ή ο σύνδεσμος να έχει αλλάξει."
      primaryAction={
        <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
          <Link href="/vehicles">Δείτε όλα τα οχήματα</Link>
        </Button>
      }
      secondaryAction={
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link href="/">Επιστροφή στην αρχική</Link>
        </Button>
      }
    />
  );
}
