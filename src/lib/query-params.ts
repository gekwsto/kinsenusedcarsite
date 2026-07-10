/**
 * Small client-side helper for building a query string from the current
 * URLSearchParams plus a set of updates. Not part of the pre-built foundation —
 * added because vehicle-filters/pagination/sort-select all need identical
 * "merge into current query params, drop empties, reset page" behavior.
 */
export function buildQueryString(
  current: URLSearchParams,
  updates: Record<string, string | number | boolean | null | undefined>,
  opts: { resetPage?: boolean } = { resetPage: true },
): string {
  const params = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  if (opts.resetPage && !("page" in updates)) {
    params.delete("page");
  }

  return params.toString();
}
