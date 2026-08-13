import type { ImportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createVehicleFromCarStock,
  applyCarStockFullUpdate,
  softDeleteVehiclesByExternalCarIds,
} from "@/server/services/vehicle.service";
import type { CarStockPayloadItem } from "@/lib/validators/carstock.schema";
import {
  buildCarStockBatchResponse,
  CARSTOCK_SAFE_MESSAGES,
  type CarStockBatchResult,
} from "@/lib/carstock-response";
import { publishPublicRealtimeEvent, VEHICLE_CHANGE_SCOPES } from "@/server/realtime/publisher";

// CREATE / SKIP / RESTORE (POST /api/integrations/carstock/cars-updated).
// A new externalCarId creates a Vehicle (`added`). An existing, ACTIVE
// externalCarId — or a carId repeated within the same batch — is skipped
// entirely, recorded as a SUCCESSFUL `skipped` result (never mutated): the
// CMS-desired state "this vehicle exists on the Used Cars site" is already
// satisfied. An existing but SOFT-DELETED externalCarId is restored in
// place (see restoreVehicleFromCarStock in vehicle.service.ts) ONLY when
// the item is the complete current CarStock state (gated by
// carStockRestoreItemSchema — see createVehicleFromCarStock): the same
// Vehicle row is reactivated and its CarStock-owned fields refreshed, which
// is why it's counted in `updated` rather than `added` — no second Vehicle
// row is ever created for it. A soft-deleted carId sent with an
// incomplete/invalid payload is `restore_rejected` — a FAILURE result
// (`failed++`), and the Vehicle is left completely untouched (still
// isDeleted=true). The intra-batch dedupe check runs before
// createVehicleFromCarStock is ever called, so the second occurrence of a
// repeated carId within one batch is caught by this in-memory Set rather
// than by letting Prisma's externalCarId unique constraint reject it; that
// constraint (see createVehicleFromCarStock's P2002 handling) is only a
// safety net for the genuinely concurrent cross-request case, never relied
// on for the same-batch case. One `results[]` entry is pushed per incoming
// item (including intra-batch repeats), so `results.length === items.length`
// always holds — every requested carId is individually represented, never
// silently folded away. Every counter in the returned envelope (added/
// updated/skipped/failed/ok) is derived from `results[]` by
// buildCarStockBatchResponse, not tracked separately, so it cannot drift.
export async function processCarStockPayload(items: CarStockPayloadItem[], source = "carstock") {
  const results: CarStockBatchResult[] = [];
  const errors: { carId: string | number; error: string }[] = [];
  const seenExternalCarIds = new Set<string>();

  for (const item of items) {
    const externalCarId = String(item.carId);
    if (seenExternalCarIds.has(externalCarId)) {
      results.push({ carId: item.carId, success: true, action: "skipped", error: null });
      continue;
    }
    seenExternalCarIds.add(externalCarId);

    try {
      const outcome = await createVehicleFromCarStock(item);
      if (outcome.action === "created") {
        results.push({ carId: item.carId, success: true, action: "created", error: null });
      } else if (outcome.action === "restored") {
        results.push({ carId: item.carId, success: true, action: "restored", error: null });
      } else if (outcome.action === "restore_rejected") {
        errors.push({ carId: item.carId, error: `restore_rejected: ${outcome.reason}` });
        results.push({
          carId: item.carId,
          success: false,
          action: "restore_rejected",
          error: CARSTOCK_SAFE_MESSAGES.restoreRejected,
        });
      } else {
        results.push({ carId: item.carId, success: true, action: "skipped", error: null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ carId: item.carId, error: message });
      results.push({
        carId: item.carId,
        success: false,
        action: "failed",
        error: CARSTOCK_SAFE_MESSAGES.unableToProcessVehicle,
      });
    }
  }

  const batch = buildCarStockBatchResponse(results);
  const status: ImportStatus = errors.length === 0 ? "SUCCESS" : errors.length === items.length ? "FAILED" : "PARTIAL_SUCCESS";

  const log = await prisma.importLog.create({
    data: {
      source,
      status,
      receivedCount: items.length,
      createdCount: batch.added,
      updatedCount: batch.updated,
      skippedCount: batch.skipped,
      deletedCount: 0,
      frozenCount: 0,
      errors: errors.length > 0 ? errors : undefined,
      rawPayload: items as unknown as object,
    },
  });

  // Batch coalescing (section 19 of the realtime spec): a 20-item request
  // where 17 items actually changed the DB must still publish exactly ONE
  // vehicles.changed event, never 17 — checking the aggregate `added`/
  // `updated` counters once, here, after the whole loop has finished (never
  // inside createVehicleFromCarStock or the per-item loop above) is what
  // guarantees that. `skipped`/`restore_rejected`/`failed` items never
  // reach this condition, matching "publish only when authoritative
  // public-relevant DB state actually changed".
  if (batch.added > 0 || batch.updated > 0) {
    publishPublicRealtimeEvent("vehicles.changed", VEHICLE_CHANGE_SCOPES);
  }

  return { log, errors, ...batch };
}

// UPDATE (PUT /api/integrations/carstock/cars-update). Full-replacement
// semantics live in applyCarStockFullUpdate; this only orchestrates the
// per-item loop, results[]/counter derivation, and ImportLog bookkeeping,
// same shape as CREATE above. A carId with no matching vehicle is a FAILURE
// result (`vehicle_not_found`, `failed++`) — PUT never creates — which also
// means an all-not-found batch reports FAILED like any other all-failed
// batch. Whole-request-level validation (every item must satisfy
// carStockUpdatePayloadSchema's strict shape) still happens upstream in the
// route handler before this function is ever called — that is unchanged,
// so there is no reachable per-item "validation_rejected" action here: an
// item only reaches this loop once it has already passed strict validation.
export async function processCarStockUpdate(items: CarStockPayloadItem[], source = "carstock:update") {
  const results: CarStockBatchResult[] = [];
  const errors: { carId: string | number; error: string }[] = [];

  for (const item of items) {
    try {
      const outcome = await applyCarStockFullUpdate(item);
      if (outcome.action === "updated") {
        results.push({ carId: item.carId, success: true, action: "updated", error: null });
      } else {
        errors.push({ carId: item.carId, error: "vehicle_not_found" });
        results.push({
          carId: item.carId,
          success: false,
          action: "vehicle_not_found",
          error: CARSTOCK_SAFE_MESSAGES.vehicleNotFound,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ carId: item.carId, error: message });
      results.push({
        carId: item.carId,
        success: false,
        action: "failed",
        error: CARSTOCK_SAFE_MESSAGES.unableToUpdateVehicle,
      });
    }
  }

  const batch = buildCarStockBatchResponse(results);
  const status: ImportStatus = errors.length === 0 ? "SUCCESS" : errors.length === items.length ? "FAILED" : "PARTIAL_SUCCESS";

  const log = await prisma.importLog.create({
    data: {
      source,
      status,
      receivedCount: items.length,
      updatedCount: batch.updated,
      errors: errors.length > 0 ? errors : undefined,
      rawPayload: items as unknown as object,
    },
  });

  // One coalesced event for the whole batch — see the identical reasoning
  // in processCarStockPayload above. `vehicle_not_found`/`failed` items
  // never contribute to `batch.updated`.
  if (batch.updated > 0) {
    publishPublicRealtimeEvent("vehicles.changed", VEHICLE_CHANGE_SCOPES);
  }

  return { log, errors, ...batch };
}

// DELETE (POST /api/integrations/carstock/cars-delete — POST, not HTTP
// DELETE; see that route file for why). Efficient, set-based, idempotent
// soft-delete via softDeleteVehiclesByExternalCarIds — one read + one
// `updateMany`, never a per-item DB round trip. Each ORIGINAL requested
// carId (including duplicates, preserving order) gets its own SUCCESSFUL
// result: `deleted` (was active, now soft-deleted), `already_deleted` (was
// already soft-deleted), or `not_found` (no such Vehicle at all — for
// DELETE this is success, not failure: the CMS-desired end state, "this
// carId is not active on the Used Cars site", is already satisfied). A
// carId repeated within the same request collapses to a single result —
// preserving the pre-existing dedup semantics of this endpoint (unlike
// CREATE's intra-batch dedupe, where the second occurrence of a repeated
// carId genuinely differs in outcome from the first — created, then
// skipped — every repeat of the same carId here would report the exact
// same outcome, since it's computed from a single before-mutation
// snapshot; keeping every repeat as its own result would inflate the
// `deleted`/`skipped` counters relative to how many Vehicle rows actually
// changed, breaking the deleted+skipped+failed===total invariant against
// the real DB delta. Since the mutation is one set-based call rather than a
// per-item loop, a genuine DB failure can't be isolated to a single carId —
// if it happens, every distinct requested carId is reported as a FAILURE
// result (`failed`, safe message) rather than letting the exception bubble
// past this function and lose the per-carId shape entirely.
export async function processCarStockDelete(rawCarIds: (string | number)[], source = "carstock:delete") {
  const seenExternalCarIds = new Set<string>();
  const dedupedCarIds: (string | number)[] = [];
  for (const carId of rawCarIds) {
    const key = String(carId);
    if (seenExternalCarIds.has(key)) continue;
    seenExternalCarIds.add(key);
    dedupedCarIds.push(carId);
  }

  let results: CarStockBatchResult[];
  let deletedCount = 0;

  try {
    const { count, outcomes } = await softDeleteVehiclesByExternalCarIds(dedupedCarIds.map(String));
    deletedCount = count;
    results = dedupedCarIds.map((carId) => ({
      carId,
      success: true,
      action: outcomes.get(String(carId))!,
      error: null,
    }));
  } catch (error) {
    console.error("processCarStockDelete failed", error);
    results = dedupedCarIds.map((carId) => ({
      carId,
      success: false,
      action: "failed",
      error: CARSTOCK_SAFE_MESSAGES.unableToRemoveVehicle,
    }));
  }

  const batch = buildCarStockBatchResponse(results);
  const status: ImportStatus =
    batch.failed === 0 ? "SUCCESS" : batch.failed === dedupedCarIds.length ? "FAILED" : "PARTIAL_SUCCESS";

  const log = await prisma.importLog.create({
    data: {
      source,
      status,
      receivedCount: rawCarIds.length,
      deletedCount,
      rawPayload: rawCarIds as unknown as object,
    },
  });

  // One coalesced event for the whole batch. `already_deleted`/`not_found`
  // are SUCCESS results but never contribute to `batch.deleted` (they map
  // to `batch.skipped` — see buildCarStockBatchResponse), so a batch that
  // only re-confirms already-deleted/unknown carIds correctly publishes
  // nothing: no public-relevant DB state actually changed.
  if (batch.deleted > 0) {
    publishPublicRealtimeEvent("vehicles.changed", VEHICLE_CHANGE_SCOPES);
  }

  return { log, ...batch };
}

// `rawPayload` is the vendor's unredacted upstream JSON — it may carry more
// than the normalized fields surfaced elsewhere and is treated as sensitive.
// Both list and detail queries omit it from the selected columns entirely
// unless the caller is explicitly allowed to see it (IMPORT_RAW_PAYLOAD_READ,
// SUPER_ADMIN only), rather than fetching it and hoping every call site
// remembers to strip it before responding.
const LOG_LIST_SELECT = {
  id: true,
  source: true,
  status: true,
  receivedCount: true,
  createdCount: true,
  updatedCount: true,
  skippedCount: true,
  deletedCount: true,
  frozenCount: true,
  errors: true,
  createdAt: true,
} as const;

export async function listImportLogs(params: { page?: number; pageSize?: number; includeRawPayload?: boolean }) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const [items, total] = await Promise.all([
    prisma.importLog.findMany({
      select: params.includeRawPayload ? { ...LOG_LIST_SELECT, rawPayload: true } : LOG_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.importLog.count(),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getImportLogById(id: string, opts: { includeRawPayload?: boolean } = {}) {
  return prisma.importLog.findUnique({
    where: { id },
    select: opts.includeRawPayload ? { ...LOG_LIST_SELECT, rawPayload: true } : LOG_LIST_SELECT,
  });
}
