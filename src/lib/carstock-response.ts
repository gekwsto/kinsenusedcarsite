/**
 * ONE common per-vehicle batch response envelope shared by all three
 * CarStock write endpoints (POST /cars-updated, PUT /cars-update, POST
 * /cars-delete). Before this, each route hand-built its own slightly
 * different `{ ok, <single-counter> }` shape and told the CMS nothing about
 * which individual carId succeeded or failed — unsafe for partial batch
 * success. Now every endpoint returns the same shape, and `results[]` is
 * the per-Vehicle source of truth the CMS synchronizes against; `ok`/the
 * five counters are only a derived summary (see buildCarStockBatchResponse),
 * never independently maintained, so they can never drift from `results[]`.
 */

/** Actions a result may report when `success: true`. */
export type CarStockSuccessAction =
  // POST /cars-updated
  | "created"
  | "restored"
  | "skipped"
  // PUT /cars-update
  | "updated"
  // POST /cars-delete
  | "deleted"
  | "already_deleted"
  | "not_found";

/** Actions a result may report when `success: false`. */
export type CarStockFailureAction =
  // POST /cars-updated
  | "restore_rejected"
  // PUT /cars-update
  | "vehicle_not_found"
  // shared across all three endpoints — an unexpected per-item processing error
  | "failed";

export type CarStockBatchAction = CarStockSuccessAction | CarStockFailureAction;

/**
 * A discriminated union (not just `error: string | null`) so `success` and
 * `error`/`action` can never disagree at the type level: a success result's
 * `error` is statically `null`, a failure result's `error` is statically a
 * `string`, and `action` is narrowed to only the actions valid for that
 * outcome. `carId` echoes the incoming CarStock scalar exactly as received
 * (never Vehicle.id, never re-typed) — see buildCarStockBatchResponse's
 * per-action counter mapping below for why this is safe to switch on
 * exhaustively.
 */
export type CarStockBatchResult =
  | { carId: string | number; success: true; action: CarStockSuccessAction; error: null }
  | { carId: string | number; success: false; action: CarStockFailureAction; error: string };

export interface CarStockBatchResponse {
  ok: boolean;
  total: number;
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: number;
  results: CarStockBatchResult[];
}

/**
 * Safe, generic, human-readable strings for `results[].error` — the ONLY
 * text ever allowed to reach the external CMS for a failure. Detailed
 * internal diagnostics (Zod messages, thrown Error#message, Prisma errors)
 * must stay in ImportLog.errors (admin-only, see import.service.ts), never
 * in this response. Centralized here so every endpoint's public failure
 * text is defined in one auditable place.
 */
export const CARSTOCK_SAFE_MESSAGES = {
  restoreRejected: "Complete vehicle payload is required for restore",
  vehicleNotFound: "Vehicle was not found",
  unableToProcessVehicle: "Unable to process vehicle",
  unableToUpdateVehicle: "Unable to update vehicle",
  unableToRemoveVehicle: "Unable to remove vehicle",
} as const;

/**
 * Derives the full envelope from `results[]` alone — `total`/the five
 * counters/`ok` are never tracked independently anywhere else, so they
 * cannot silently drift from what `results[]` actually says. `failed` is
 * simply every `success: false` entry; `ok` is exactly `failed === 0` (see
 * the module doc on this file and each route for why "at least one success"
 * or "added > 0" are deliberately NOT used). The switch below is written to
 * be exhaustive over `CarStockSuccessAction` — adding a new success action
 * anywhere without updating this mapping is a compile error, not a silent
 * miscount.
 */
export function buildCarStockBatchResponse(results: CarStockBatchResult[]): CarStockBatchResponse {
  let added = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of results) {
    if (!result.success) {
      failed += 1;
      continue;
    }
    switch (result.action) {
      case "created":
        added += 1;
        break;
      case "restored":
      case "updated":
        updated += 1;
        break;
      case "deleted":
        deleted += 1;
        break;
      case "skipped":
      case "already_deleted":
      case "not_found":
        skipped += 1;
        break;
      default: {
        // `result` (not `result.action`) is what TS has actually narrowed
        // to `never` here — reading `.action` off an already-`never` value
        // doesn't itself produce `never`, so it must not be what's assigned
        // below, or this exhaustiveness check stops compiling.
        const exhaustiveCheck: never = result;
        throw new Error(`buildCarStockBatchResponse: unrecognized successful result: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }
  }

  return {
    ok: failed === 0,
    total: results.length,
    added,
    updated,
    deleted,
    skipped,
    failed,
    results,
  };
}

/**
 * The envelope for a request that never reached per-item processing at all
 * — auth failure, unparseable/malformed body, or an unrecoverable
 * route-level exception (see section 15 of the hardening pass this
 * implements). Deliberately NOT `buildCarStockBatchResponse([])`: an empty
 * `results[]` would make `failed === 0` vacuously true, reporting `ok:true`
 * for a request that was actually rejected outright — the one legitimate
 * exception to "ok is derived from results", since there are no per-item
 * results to derive it from. Keeps the exact same JSON shape as a normal
 * response (same keys, all counters present as 0, `results: []`) so a CMS
 * client never has to branch on response shape by HTTP status.
 */
export function emptyFailedCarStockResponse(): CarStockBatchResponse {
  return { ok: false, total: 0, added: 0, updated: 0, deleted: 0, skipped: 0, failed: 0, results: [] };
}
