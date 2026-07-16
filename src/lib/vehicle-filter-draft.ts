// Pure filter-draft helpers shared by the client-side VehicleFilterProvider
// and any Server Component that needs the same "does this URL have active
// filters?" answer (e.g. vehicles/page.tsx) — kept out of that "use client"
// file because every export there is an opaque client reference from the
// server's point of view and can't be called directly, only rendered.
export const NUMERIC_FIELDS = [
  "priceMin",
  "priceMax",
  "monthlyPriceMin",
  "monthlyPriceMax",
  "yearMin",
  "yearMax",
  "kmMin",
  "kmMax",
  "ccMin",
  "ccMax",
  "hpMin",
  "hpMax",
] as const;
export type NumericField = (typeof NUMERIC_FIELDS)[number];

// Multi-select checkbox groups. Unlike the numeric range inputs, these are
// discrete clicks — they must apply immediately, never debounced.
export const CSV_FIELDS = ["maker", "fuel", "transmissionType", "color", "typeOfCar"] as const;
export type CsvField = (typeof CSV_FIELDS)[number];

// One canonical draft covers *every* filter field the sidebar owns.
export interface FilterDraft extends Record<NumericField, string>, Record<CsvField, string> {
  offerOnly: boolean;
}

export const EMPTY_DRAFT: FilterDraft = {
  priceMin: "",
  priceMax: "",
  monthlyPriceMin: "",
  monthlyPriceMax: "",
  yearMin: "",
  yearMax: "",
  kmMin: "",
  kmMax: "",
  ccMin: "",
  ccMax: "",
  hpMin: "",
  hpMax: "",
  maker: "",
  fuel: "",
  transmissionType: "",
  color: "",
  typeOfCar: "",
  offerOnly: false,
};

// Deduplicates (order-preserving) a raw comma-separated CSV field value.
// `buildQueryString` already sorts+dedupes any value *this app* writes, but
// a direct/hand-crafted/legacy URL (e.g. `?maker=BMW,BMW`) bypasses that —
// this is the one parsing boundary every canonical read goes through, so
// normalizing here keeps checkbox state, the active-filter chip list (which
// keys each chip by `field:value`), and the server query all seeing the
// same deduplicated set regardless of how the URL was reached.
function dedupeCsvValue(raw: string): string {
  if (!raw) return raw;
  return Array.from(new Set(raw.split(",").filter(Boolean))).join(",");
}

export function computeDraftFromParams(searchParams: URLSearchParams): FilterDraft {
  const draft = { ...EMPTY_DRAFT };
  for (const field of NUMERIC_FIELDS) draft[field] = searchParams.get(field) ?? "";
  for (const field of CSV_FIELDS) draft[field] = dedupeCsvValue(searchParams.get(field) ?? "");
  draft.offerOnly = searchParams.get("offerOnly") === "true";
  return draft;
}

export function draftsEqual(a: FilterDraft, b: FilterDraft): boolean {
  for (const field of NUMERIC_FIELDS) if (a[field] !== b[field]) return false;
  for (const field of CSV_FIELDS) if (a[field] !== b[field]) return false;
  return a.offerOnly === b.offerOnly;
}

export function toggleCsvValue(current: string, value: string): string {
  const list = current ? current.split(",").filter(Boolean) : [];
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
  return list.join(",");
}
