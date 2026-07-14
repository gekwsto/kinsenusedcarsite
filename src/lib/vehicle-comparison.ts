/**
 * Central vehicle-comparison model — the single source of truth for the
 * comparison storage key/version/shape, the ordered-ID list operations,
 * and the `/compare` URL parameter shape. Deliberately framework-agnostic
 * (no `document`/`window`/`localStorage` access here) so every function is
 * pure and unit-testable; src/components/providers/vehicle-comparison-provider.tsx
 * is the only place that touches browser storage, and it is built entirely
 * out of these functions the same way CookieConsentProvider is built out of
 * src/lib/cookie-consent.ts.
 */

export const VEHICLE_COMPARISON_STORAGE_KEY = "kinsen_vehicle_comparison_v1";
export const VEHICLE_COMPARISON_STORAGE_VERSION = 1;

/** Hard cap enforced everywhere: the provider, the parser, and the `/compare` route. */
export const MAX_COMPARISON_VEHICLES = 3;

export interface VehicleComparisonStoredState {
  version: number;
  /** Ordered, unique, public vehicle IDs — never full vehicle records (see reports/vehicle_comparison_feature_lock.json for the storage-classification rationale). */
  ids: readonly string[];
  updatedAt: string;
}

export type ComparisonActionResult = "added" | "removed" | "already-selected" | "max-reached";

export function createEmptyComparisonState(): VehicleComparisonStoredState {
  return { version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: [], updatedAt: new Date().toISOString() };
}

export function serializeComparisonState(state: VehicleComparisonStoredState): string {
  return JSON.stringify(state);
}

/**
 * Parses and validates a raw localStorage string. Never throws — any
 * malformed JSON, wrong version, non-array `ids`, non-string/blank entries,
 * duplicate IDs, or more than MAX_COMPARISON_VEHICLES entries is treated as
 * "no valid stored state" (returns null), so the caller always falls back
 * to an empty comparison list rather than trusting corrupted/tampered
 * storage or crashing hydration.
 */
export function parseComparisonState(raw: string | null | undefined): VehicleComparisonStoredState | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;

  if (candidate.version !== VEHICLE_COMPARISON_STORAGE_VERSION) return null;
  if (!Array.isArray(candidate.ids)) return null;
  if (typeof candidate.updatedAt !== "string") return null;

  const ids = candidate.ids;
  if (ids.length > MAX_COMPARISON_VEHICLES) return null;
  if (!ids.every((id): id is string => typeof id === "string" && id.trim().length > 0)) return null;
  if (new Set(ids).size !== ids.length) return null;

  return { version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: [...ids], updatedAt: candidate.updatedAt };
}

/**
 * Adds `id` to the end of `ids` (preserving selection order) if — and only
 * if — it isn't already present and the list isn't already at
 * MAX_COMPARISON_VEHICLES. Returns the *same* array reference when nothing
 * changed, so callers can cheaply skip a re-render/re-persist on a no-op.
 */
export function addComparisonId(
  ids: readonly string[],
  id: string,
): { ids: readonly string[]; result: ComparisonActionResult } {
  if (ids.includes(id)) return { ids, result: "already-selected" };
  if (ids.length >= MAX_COMPARISON_VEHICLES) return { ids, result: "max-reached" };
  return { ids: [...ids, id], result: "added" };
}

export function removeComparisonId(ids: readonly string[], id: string): readonly string[] {
  if (!ids.includes(id)) return ids;
  return ids.filter((existing) => existing !== id);
}

export function toggleComparisonId(
  ids: readonly string[],
  id: string,
): { ids: readonly string[]; result: ComparisonActionResult } {
  if (ids.includes(id)) return { ids: removeComparisonId(ids, id), result: "removed" };
  return addComparisonId(ids, id);
}

/**
 * Reorders (and prunes) a batch-loaded vehicle result set to match
 * `orderedIds` — the single place both the `/compare` page and the client
 * summary-hydration path use to (a) preserve the user's original selection
 * order regardless of what order the database returned rows in, and (b)
 * silently drop any ID that didn't come back (deleted/unpublished/frozen
 * vehicle) rather than rendering a gap or throwing.
 */
export function reorderVehiclesByIds<T extends { id: string }>(vehicles: readonly T[], orderedIds: readonly string[]): T[] {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const result: T[] = [];
  for (const id of orderedIds) {
    const vehicle = byId.get(id);
    if (vehicle) result.push(vehicle);
  }
  return result;
}

/** Parses the `/compare?vehicles=a,b,c` query value into a trimmed, deduped, non-blank ID list. Pure parsing only — does not enforce the exact-3 rule (the page decides what "incomplete" means) and does not validate the IDs resolve to real vehicles (only the database can answer that). */
export function parseComparisonIdsFromSearchParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/** Builds the shareable `/compare` URL for a complete (exactly MAX_COMPARISON_VEHICLES) ordered ID list. Returns null for any incomplete list — there is deliberately no "partial comparison" URL. */
export function buildComparisonUrl(ids: readonly string[]): string | null {
  if (ids.length !== MAX_COMPARISON_VEHICLES) return null;
  return `/compare?vehicles=${ids.map(encodeURIComponent).join(",")}`;
}

/** Two ordered ID lists are equal (same IDs, same order) — used to avoid redundant state updates/persists/URL-sync loops. */
export function areComparisonIdListsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export interface VehicleComparisonSummary {
  id: string;
  /** Used to build the canonical `/vehicles/{slug}` details link — the detail page route resolves by slug only (unlike the [id] API route, which also accepts a raw ID). */
  slug: string;
  maker: string;
  versionName: string;
  yearRelease: number | null;
  price: number | null;
  monthlyPrice: number | null;
  km: number | null;
  imageUrl: string | null;
  fuel: string | null;
  transmissionType: string | null;
}
