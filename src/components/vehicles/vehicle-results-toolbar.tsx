import { SortSelect } from "@/components/vehicles/sort-select";
import type { VehicleSort } from "@/lib/validators/vehicle.schema";

// Server Component — no client hooks of its own. `totalResults` is the
// same Prisma `count` that already drives pagination (see
// listPublicVehicles) and `currentSort` is the already-validated
// `filters.sort` from vehicles/page.tsx, so both are plain serializable
// values crossing the Server → Client boundary; only <SortSelect>, the one
// piece that actually needs interactivity, is a Client Component.
const RESULT_COUNT_FORMATTER = new Intl.NumberFormat("el-GR");

export function VehicleResultsToolbar({
  totalResults,
  currentSort,
}: {
  totalResults: number;
  currentSort: VehicleSort;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p
        className="text-sm text-primary/70"
        aria-label={`${RESULT_COUNT_FORMATTER.format(totalResults)} διαθέσιμα οχήματα`}
      >
        <span className="font-medium">Αποτελέσματα:</span>{" "}
        <span className="text-base font-semibold text-primary">{RESULT_COUNT_FORMATTER.format(totalResults)}</span>
      </p>
      <SortSelect currentSort={currentSort} />
    </div>
  );
}
