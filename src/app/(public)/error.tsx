"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicStatusState } from "@/components/status/public-status-state";

// Catches genuine unexpected runtime/infrastructure failures thrown by any
// public page or the data it loads (e.g. getPublicVehicleBySlug rejecting
// on a real DB error) — never a missing-resource case, which resolves via
// notFound()/not-found.tsx instead. Rendered in place of (public)/layout.tsx's
// `children`, so Header/Footer stay mounted and usable. Must be a Client
// Component per the App Router error.tsx contract.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // No app-wide logger/monitoring exists yet (see src/lib/api-error.ts,
    // which also just console.errors before responding) — this mirrors that,
    // and never renders error.message/error.stack to the visitor.
    console.error(error);
  }, [error]);

  return (
    <PublicStatusState
      icon={RefreshCw}
      eyebrow="Κάτι δεν πήγε όπως αναμενόταν"
      title="Δεν μπορέσαμε να ολοκληρώσουμε την ενέργεια"
      description="Παρουσιάστηκε ένα προσωρινό πρόβλημα. Μπορείτε να δοκιμάσετε ξανά."
      primaryAction={
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={reset}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Δοκιμάστε ξανά
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
