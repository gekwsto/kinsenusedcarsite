import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicStatusState } from "@/components/status/public-status-state";

// Shared by both src/app/(public)/not-found.tsx (nested boundary — gets
// Header/Footer for free via the public layout) and the root
// src/app/not-found.tsx (catches URLs that don't match any route at all,
// which Next.js always resolves against the root not-found file regardless
// of route groups) — one copy of the copy/props, two different shells.
export function GeneralNotFoundContent() {
  return (
    <PublicStatusState
      icon={SearchX}
      eyebrow="404"
      title="Η σελίδα δεν βρέθηκε"
      description="Η διεύθυνση μπορεί να έχει αλλάξει ή η σελίδα να μην είναι πλέον διαθέσιμη."
      primaryAction={
        <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
          <Link href="/">Αρχική σελίδα</Link>
        </Button>
      }
      secondaryAction={
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link href="/vehicles">Δείτε τα οχήματα</Link>
        </Button>
      }
    />
  );
}
