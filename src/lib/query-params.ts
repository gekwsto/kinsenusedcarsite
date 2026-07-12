/**
 * Small client-side helper for building a query string from the current
 * URLSearchParams plus a set of updates. Not part of the pre-built foundation —
 * added because vehicle-filters/pagination/sort-select all need identical
 * "merge into current query params, drop empties, reset page" behavior.
 *
 * The output is canonicalized (fixed key order, sorted/deduped multi-value
 * fields, default values omitted) so that two interaction sequences which
 * land on the same logical filter set always produce the exact same query
 * string. Without this, e.g. toggling "BMW" then "Toyota" versus "Toyota"
 * then "BMW" would produce differently-ordered `maker=` values, and
 * value-based equality checks (the filter sidebar's draft-vs-URL
 * comparison) or Back/Forward history entries could end up textually
 * distinct for what is actually the same filter state.
 */

const MULTI_VALUE_FIELDS = new Set(["maker", "fuel", "transmissionType", "color", "typeOfCar"]);

// Values that are equivalent to the field being entirely absent, so they're
// never written into the URL (e.g. the server already treats a missing
// `sort` as "recommended" — writing `sort=recommended` explicitly would
// just make an otherwise-identical URL look different from the bare one).
const DEFAULT_VALUES: Record<string, string> = { sort: "recommended" };

// Fixed order so the resulting string never depends on which field the user
// happened to touch first.
const CANONICAL_KEY_ORDER = [
  "maker",
  "fuel",
  "transmissionType",
  "color",
  "typeOfCar",
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
  "offerOnly",
  "availableOnly",
  "search",
  "sort",
  "page",
  "pageSize",
];

function canonicalizeValue(key: string, rawValue: string): string {
  if (!MULTI_VALUE_FIELDS.has(key)) return rawValue;
  const unique = Array.from(new Set(rawValue.split(",").filter(Boolean)));
  unique.sort();
  return unique.join(",");
}

export function buildQueryString(
  current: URLSearchParams,
  updates: Record<string, string | number | boolean | null | undefined>,
  opts: { resetPage?: boolean } = { resetPage: true },
): string {
  const merged = new Map<string, string>();
  for (const [key, value] of current.entries()) merged.set(key, value);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") merged.delete(key);
    else merged.set(key, String(value));
  }

  if (opts.resetPage && !("page" in updates)) {
    merged.delete("page");
  }

  const params = new URLSearchParams();
  const orderedKeys = [...CANONICAL_KEY_ORDER, ...Array.from(merged.keys()).filter((k) => !CANONICAL_KEY_ORDER.includes(k)).sort()];

  for (const key of orderedKeys) {
    if (!merged.has(key)) continue;
    const value = canonicalizeValue(key, merged.get(key)!);
    if (value === "") continue;
    if (DEFAULT_VALUES[key] === value) continue;
    params.set(key, value);
  }

  return params.toString();
}

/** `pathname?qs`, or just `pathname` when `qs` is empty — never a bare trailing `?`. */
export function buildHref(pathname: string, qs: string): string {
  return qs ? `${pathname}?${qs}` : pathname;
}
