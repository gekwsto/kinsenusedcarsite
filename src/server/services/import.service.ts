import type { ImportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { upsertVehicleFromStock } from "@/server/services/vehicle.service";
import type { CarStockPayloadItem } from "@/lib/validators/carstock.schema";

export async function processCarStockPayload(items: CarStockPayloadItem[], source = "carstock") {
  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;
  let frozenCount = 0;
  const errors: { carId: string | number; error: string }[] = [];

  for (const item of items) {
    try {
      const result = await upsertVehicleFromStock(item);
      if (result.action === "created") createdCount += 1;
      if (result.action === "updated") updatedCount += 1;
      if (result.action === "deleted") deletedCount += 1;
      if (result.action === "frozen") frozenCount += 1;
    } catch (error) {
      errors.push({ carId: item.CarId, error: error instanceof Error ? error.message : "Unknown error" });
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
      updatedCount,
      deletedCount,
      frozenCount,
      errors: errors.length > 0 ? errors : undefined,
      rawPayload: items as unknown as object,
    },
  });

  return { log, createdCount, updatedCount, deletedCount, frozenCount, errors };
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
