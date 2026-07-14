"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Button } from "@/components/ui/button";
import { useVehicleComparison } from "@/components/providers/vehicle-comparison-provider";

interface ComparisonIncompleteStateProps {
  reason: "count" | "unavailable";
}

const REASON_COPY: Record<ComparisonIncompleteStateProps["reason"], string> = {
  count: "Για να δείτε τη σύγκριση χρειάζονται ακριβώς 3 επιλεγμένα οχήματα.",
  unavailable: "Ένα ή περισσότερα από τα επιλεγμένα οχήματα δεν είναι πλέον διαθέσιμα.",
};

// Rendered whenever /compare's `vehicles` query doesn't resolve to exactly
// 3 real, currently-public vehicles — a mistyped/truncated/stale shared
// link, or a link to vehicles that were later frozen/deleted. Never renders
// a partial matrix (task requirement) — this is the only thing this route
// shows in that case.
export function ComparisonIncompleteState({ reason }: ComparisonIncompleteStateProps) {
  const { openSidebar } = useVehicleComparison();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-primary">Η σύγκριση δεν είναι έτοιμη</h1>
      <p className="text-ink-muted">{REASON_COPY[reason]}</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline">
          <Link href="/vehicles">Επιστροφή στα αυτοκίνητα</Link>
        </Button>
        <Button type="button" variant="primary" onClick={(event) => openSidebar(event.currentTarget)}>
          Άνοιγμα επιλογών σύγκρισης
        </Button>
      </div>
    </div>
  );
}
