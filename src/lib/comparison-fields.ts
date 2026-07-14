/**
 * Typed comparison-row registry for the `/compare` matrix. Every row is
 * built from a real, currently-published field on the Prisma `Vehicle`
 * model (see prisma/schema.prisma) — there is deliberately no row for
 * warranty, equipment, drive type, emissions/consumption, doors, or seats,
 * because none of those exist in the current schema, and inventing values
 * for a real vehicle comparison would be actively misleading.
 *
 * Pure and framework-agnostic (no React) so best-value/highlight logic is
 * independently unit-testable — see
 * src/server/services/__tests__/comparison-fields.test.ts.
 */

import { formatEuro, formatKm } from "@/lib/utils";

export type ComparisonGroup = "basics" | "engine" | "usage" | "financial";

export const COMPARISON_GROUP_LABELS: Record<ComparisonGroup, string> = {
  basics: "Βασικά στοιχεία",
  engine: "Κινητήρας και απόδοση",
  usage: "Χρήση και κατάσταση",
  financial: "Οικονομικά στοιχεία",
};

export const COMPARISON_GROUP_ORDER: readonly ComparisonGroup[] = ["basics", "engine", "usage", "financial"];

/**
 * "none" fields (e.g. color, fuel type) are never highlighted — there is no
 * objectively "better" color or fuel, only a subjective preference, and
 * subjective fields must never be ranked (task requirement).
 */
export type ComparisonMode = "none" | "lower-is-better" | "higher-is-better" | "newer-is-better";

export interface ComparisonMatrixVehicle {
  id: string;
  maker: string;
  versionName: string;
  yearRelease: number | null;
  typeOfCar: string | null;
  color: string | null;
  fuel: string | null;
  cc: number | null;
  hp: number | null;
  transmissionType: string | null;
  km: number | null;
  offer: boolean;
  price: number | null;
  monthlyPrice: number | null;
}

export interface ComparisonFieldDefinition<TVehicle> {
  id: string;
  group: ComparisonGroup;
  label: string;
  getValue: (vehicle: TVehicle) => unknown;
  formatValue: (value: unknown, vehicle: TVehicle) => string;
  comparisonMode: ComparisonMode;
  /** Short badge text shown on the winning cell(s) — field-specific (never the generic "Καλύτερη τιμή" for a non-price field like mileage or horsepower). Required whenever comparisonMode !== "none". */
  bestLabel?: string;
}

const DASH = "—";

function formatOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  if (typeof value === "string" && value.trim().length === 0) return DASH;
  return String(value);
}

export const COMPARISON_FIELDS: readonly ComparisonFieldDefinition<ComparisonMatrixVehicle>[] = [
  {
    id: "model",
    group: "basics",
    label: "Μοντέλο",
    getValue: (v) => `${v.maker} ${v.versionName}`,
    formatValue: (value) => formatOrDash(value as string),
    comparisonMode: "none",
  },
  {
    id: "yearRelease",
    group: "basics",
    label: "Έτος",
    getValue: (v) => v.yearRelease,
    formatValue: (value) => formatOrDash(value as number | null),
    comparisonMode: "newer-is-better",
    bestLabel: "Νεότερο μοντέλο",
  },
  {
    id: "typeOfCar",
    group: "basics",
    label: "Τύπος οχήματος",
    getValue: (v) => v.typeOfCar,
    formatValue: (value) => formatOrDash(value as string | null),
    comparisonMode: "none",
  },
  {
    id: "color",
    group: "basics",
    label: "Χρώμα",
    getValue: (v) => v.color,
    formatValue: (value) => formatOrDash(value as string | null),
    comparisonMode: "none",
  },
  {
    id: "fuel",
    group: "engine",
    label: "Καύσιμο",
    getValue: (v) => v.fuel,
    formatValue: (value) => formatOrDash(value as string | null),
    comparisonMode: "none",
  },
  {
    id: "cc",
    group: "engine",
    label: "Κυβικά",
    getValue: (v) => v.cc,
    formatValue: (value) => (value === null || value === undefined ? DASH : `${value as number}cc`),
    comparisonMode: "none",
  },
  {
    id: "hp",
    group: "engine",
    label: "Ίπποι",
    getValue: (v) => v.hp,
    formatValue: (value) => (value === null || value === undefined ? DASH : `${value as number} hp`),
    comparisonMode: "higher-is-better",
    bestLabel: "Περισσότερη ισχύς",
  },
  {
    id: "transmissionType",
    group: "engine",
    label: "Κιβώτιο ταχυτήτων",
    getValue: (v) => v.transmissionType,
    formatValue: (value) => formatOrDash(value as string | null),
    comparisonMode: "none",
  },
  {
    id: "km",
    group: "usage",
    label: "Χιλιόμετρα",
    getValue: (v) => v.km,
    formatValue: (value) => (value === null || value === undefined ? DASH : formatKm(value as number)),
    comparisonMode: "lower-is-better",
    bestLabel: "Λιγότερα χιλιόμετρα",
  },
  {
    id: "offer",
    group: "usage",
    label: "Προσφορά",
    getValue: (v) => v.offer,
    formatValue: (value) => (value ? "Ναι" : "Όχι"),
    comparisonMode: "none",
  },
  {
    id: "price",
    group: "financial",
    label: "Τιμή",
    getValue: (v) => v.price,
    formatValue: (value) => (value === null || value === undefined ? DASH : formatEuro(value as number)),
    comparisonMode: "lower-is-better",
    bestLabel: "Χαμηλότερη τιμή",
  },
  {
    id: "monthlyPrice",
    group: "financial",
    label: "Μηνιαία δόση",
    getValue: (v) => v.monthlyPrice,
    formatValue: (value) => (value === null || value === undefined ? DASH : `${formatEuro(value as number)} / μήνα`),
    comparisonMode: "lower-is-better",
    bestLabel: "Χαμηλότερη δόση",
  },
];

/**
 * Returns the IDs of every vehicle tied for the objectively best value of
 * one field, or an empty set if the field isn't rankable ("none") or no
 * vehicle has a usable numeric value. Missing values (null/undefined/NaN)
 * are excluded from the comparison entirely — never treated as zero, which
 * would otherwise make a vehicle with unknown mileage look like it has
 * "0 km" and win every lower-is-better comparison.
 *
 * Tie rule (applied consistently, including the all-tied case): every
 * vehicle whose value equals the best value is highlighted. This is a
 * deliberate, documented choice — "all 3 tied" still highlights all 3,
 * rather than arbitrarily picking one or hiding the highlight, so the same
 * rule always answers "which value(s) are best" with no special case.
 */
export function computeBestValueVehicleIds<TVehicle extends { id: string }>(
  vehicles: readonly TVehicle[],
  field: ComparisonFieldDefinition<TVehicle>,
): ReadonlySet<string> {
  if (field.comparisonMode === "none") return new Set();

  const numericEntries = vehicles
    .map((vehicle) => ({ id: vehicle.id, value: field.getValue(vehicle) }))
    .filter((entry): entry is { id: string; value: number } => typeof entry.value === "number" && Number.isFinite(entry.value));

  if (numericEntries.length === 0) return new Set();

  const values = numericEntries.map((entry) => entry.value);
  const best = field.comparisonMode === "lower-is-better" ? Math.min(...values) : Math.max(...values);

  return new Set(numericEntries.filter((entry) => entry.value === best).map((entry) => entry.id));
}
