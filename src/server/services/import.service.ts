import type { ImportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createVehicleFromCarStock,
  applyCarStockFullUpdate,
  softDeleteVehiclesByExternalCarIds,
} from "@/server/services/vehicle.service";
import type { CarStockPayloadItem } from "@/lib/validators/carstock.schema";

// CREATE (POST /api/integrations/carstock/cars-updated). STRICT create-only:
// an externalCarId that already exists — or a carId repeated within the same
// batch — is skipped entirely (recorded, never mutated). The intra-batch
// check runs before createVehicleFromCarStock is ever called, so the second
// occurrence of a repeated carId is caught by this in-memory Set rather than
// by letting Prisma's externalCarId unique constraint reject it; that
// constraint (see createVehicleFromCarStock's P2002 handling) is only a
// safety net for the genuinely concurrent cross-request case, never relied
// on for the same-batch case. A skip is recorded in `skippedCount`, its own
// ImportLog column — it is NOT an update, so `updatedCount` stays 0 for
// every CREATE batch. `deletedCount`/`frozenCount` likewise stay 0 — CREATE
// has no deletion or freeze responsibility.
export async function processCarStockPayload(items: CarStockPayloadItem[], source = "carstock") {
  let createdCount = 0;
  let skippedCount = 0;
  const errors: { carId: string | number; error: string }[] = [];
  const seenExternalCarIds = new Set<string>();

  for (const item of items) {
    const externalCarId = String(item.carId);
    if (seenExternalCarIds.has(externalCarId)) {
      skippedCount += 1;
      continue;
    }
    seenExternalCarIds.add(externalCarId);

    try {
      const result = await createVehicleFromCarStock(item);
      if (result.action === "created") createdCount += 1;
      else skippedCount += 1;
    } catch (error) {
      errors.push({ carId: item.carId, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  const status: ImportStatus =
    errors.length === 0 ? "SUCCESS" : errors.length === items.length ? "FAILED" : "PARTIAL_SUCCESS";

  const log = await prisma.importLog.create({
    data: {
      source,
      status,
      receivedCount: items.length,
      createdCount,
      updatedCount: 0,
      skippedCount,
      deletedCount: 0,
      frozenCount: 0,
      errors: errors.length > 0 ? errors : undefined,
      rawPayload: items as unknown as object,
    },
  });

  return { log, createdCount, skippedCount, errors };
}

// UPDATE (PUT /api/integrations/carstock/cars-update). Full-replacement
// semantics live in applyCarStockFullUpdate; this only orchestrates the
// per-item loop and ImportLog bookkeeping, same shape as CREATE above. A
// carId with no matching vehicle is recorded as an error (PUT never
// creates), which also means an all-not-found batch reports FAILED like any
// other all-failed batch.
export async function processCarStockUpdate(items: CarStockPayloadItem[], source = "carstock:update") {
  let updatedCount = 0;
  const errors: { carId: string | number; error: string }[] = [];

  for (const item of items) {
    try {
      const result = await applyCarStockFullUpdate(item);
      if (result.action === "updated") {
        updatedCount += 1;
      } else {
        errors.push({ carId: item.carId, error: "vehicle_not_found" });
      }
    } catch (error) {
      errors.push({ carId: item.carId, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  const status: ImportStatus =
    errors.length === 0 ? "SUCCESS" : errors.length === items.length ? "FAILED" : "PARTIAL_SUCCESS";

  const log = await prisma.importLog.create({
    data: {
      source,
      status,
      receivedCount: items.length,
      updatedCount,
      errors: errors.length > 0 ? errors : undefined,
      rawPayload: items as unknown as object,
    },
  });

  return { log, updatedCount, errors };
}

// DELETE (DELETE /api/integrations/carstock/cars-delete). One bulk,
// idempotent updateMany via softDeleteVehiclesByExternalCarIds — never a
// per-item loop, since there's nothing item-specific that can fail here
// (unknown carIds simply match zero rows).
export async function processCarStockDelete(externalCarIds: string[], source = "carstock:delete") {
  const { count } = await softDeleteVehiclesByExternalCarIds(externalCarIds);

  const log = await prisma.importLog.create({
    data: {
      source,
      status: "SUCCESS",
      receivedCount: externalCarIds.length,
      deletedCount: count,
      rawPayload: externalCarIds as unknown as object,
    },
  });

  return { log, deletedCount: count };
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
