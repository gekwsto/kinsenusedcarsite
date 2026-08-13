import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { getRealtimeBroker } from "@/server/realtime/broker";
import type { PublicRealtimeEvent } from "@/lib/realtime/types";
import { carStockPayloadSchema, carStockUpdatePayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockPayload, processCarStockUpdate, processCarStockDelete } from "@/server/services/import.service";
import { createVehicleFromCarStock, softDeleteVehiclesByExternalCarIds } from "@/server/services/vehicle.service";

// The CarStock contract itself (request/response shapes, strict RESTORE,
// strict PUT, soft-delete-only, auth) is locked and untouched by this pass
// — see the CarStock test files. These tests verify only the realtime
// SIDE EFFECT: exactly one coalesced vehicles.changed event per batch when
// (and only when) authoritative DB state actually changed.

async function skipIfDbUnreachable(t: TestContext): Promise<boolean> {
  try {
    await prisma.vehicle.count();
    return false;
  } catch {
    t.skip("DATABASE_URL not reachable in this environment");
    return true;
  }
}

async function cleanupVehicle(externalCarId: string) {
  await prisma.vehicle.deleteMany({ where: { externalCarId } });
}

async function cleanupImportLogsForSource(source: string) {
  await prisma.importLog.deleteMany({ where: { source } });
}

async function capturePublishedEvents(run: () => Promise<void>): Promise<PublicRealtimeEvent[]> {
  const broker = getRealtimeBroker();
  const received: PublicRealtimeEvent[] = [];
  const unsubscribe = broker.subscribe((event) => received.push(event));
  try {
    await run();
  } finally {
    unsubscribe();
  }
  return received;
}

function completeRestorePayload(carId: string | number, overrides: Record<string, unknown> = {}) {
  return {
    carId,
    maker: "Toyota",
    model: "Corolla Realtime Restore Fixture",
    versionName: "1.8",
    price: 10000,
    rent: 200,
    yearRelease: 2020,
    vin: null,
    km: 1000,
    cc: 1600,
    hp: 110,
    fuel: "Petrol",
    color: "Blue",
    typeOfCar: "Sedan",
    transmissionType: "Manual",
    ExtrasDTO: [],
    ...overrides,
  };
}

// ---------- POST /cars-updated (CREATE / SKIP / RESTORE) ----------

test("CREATE (new carId, DB actually changed): publishes one vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-create-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock");
  });
  await cleanupVehicle(carId);

  const items = carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Realtime Fixture" }]);
  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockPayload(items, "carstock");
    assert.equal(result.added, 1);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("SKIP (active duplicate, DB unchanged): publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-skip-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock");
  });
  await cleanupVehicle(carId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Realtime Fixture" }])[0]!);

  const items = carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Realtime Fixture", km: 9999 }]);
  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockPayload(items, "carstock");
    assert.equal(result.skipped, 1);
  });

  assert.equal(events.length, 0);
});

test("RESTORE (soft-deleted + complete payload, DB actually changed): publishes one vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-restore-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock");
  });
  await cleanupVehicle(carId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([completeRestorePayload(carId)])[0]!);
  await softDeleteVehiclesByExternalCarIds([carId]);

  const items = carStockPayloadSchema.parse([completeRestorePayload(carId, { km: 55555 })]);
  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockPayload(items, "carstock");
    assert.equal(result.updated, 1);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("restore_rejected (incomplete payload, DB unchanged): publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-restore-rejected-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock");
  });
  await cleanupVehicle(carId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([completeRestorePayload(carId)])[0]!);
  await softDeleteVehiclesByExternalCarIds([carId]);

  const items = carStockPayloadSchema.parse([{ carId }]); // incomplete
  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockPayload(items, "carstock");
    assert.equal(result.failed, 1);
  });

  assert.equal(events.length, 0);
});

test("batch coalescing: 20 items, 17 real DB changes -> exactly ONE vehicles.changed, not 17", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const newCarIds = Array.from({ length: 12 }, (_, i) => `realtime-carstock-batch-new-${i}`);
  const restoreCarIds = Array.from({ length: 5 }, (_, i) => `realtime-carstock-batch-restore-${i}`);
  const skipCarIds = Array.from({ length: 3 }, (_, i) => `realtime-carstock-batch-skip-${i}`);
  const allIds = [...newCarIds, ...restoreCarIds, ...skipCarIds];

  t.after(async () => {
    for (const id of allIds) await cleanupVehicle(id);
    await cleanupImportLogsForSource("carstock");
  });
  for (const id of allIds) await cleanupVehicle(id);

  // Preconditions: restoreCarIds exist + soft-deleted; skipCarIds exist + active.
  for (const id of restoreCarIds) {
    await createVehicleFromCarStock(carStockPayloadSchema.parse([completeRestorePayload(id)])[0]!);
  }
  await softDeleteVehiclesByExternalCarIds(restoreCarIds);
  for (const id of skipCarIds) {
    await createVehicleFromCarStock(carStockPayloadSchema.parse([{ carId: id, maker: "BMW", model: "320d Batch Skip Fixture" }])[0]!);
  }

  const batchItems = [
    ...newCarIds.map((id) => ({ carId: id, maker: "BMW", model: `320d Batch New Fixture ${id}` })),
    ...restoreCarIds.map((id) => completeRestorePayload(id, { km: 42 })),
    ...skipCarIds.map((id) => ({ carId: id, maker: "BMW", model: "320d Batch Skip Fixture" })),
  ];
  const items = carStockPayloadSchema.parse(batchItems);
  assert.equal(items.length, 20);

  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockPayload(items, "carstock");
    assert.equal(result.added, 12);
    assert.equal(result.updated, 5);
    assert.equal(result.skipped, 3);
    assert.equal(result.added + result.updated, 17, "17 items actually changed DB state");
  });

  assert.equal(events.length, 1, "17 real mutations in one batch must still publish exactly ONE event, never 17");
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("batch coalescing: a partial batch (some changed, some failed) still publishes exactly ONE event", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const createdCarId = "realtime-carstock-partial-created-1";
  const rejectedCarId = "realtime-carstock-partial-rejected-1";
  t.after(async () => {
    await cleanupVehicle(createdCarId);
    await cleanupVehicle(rejectedCarId);
    await cleanupImportLogsForSource("carstock");
  });
  await cleanupVehicle(createdCarId);
  await cleanupVehicle(rejectedCarId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([completeRestorePayload(rejectedCarId)])[0]!);
  await softDeleteVehiclesByExternalCarIds([rejectedCarId]);

  const items = carStockPayloadSchema.parse([
    { carId: createdCarId, maker: "BMW", model: "320d Partial Fixture" },
    { carId: rejectedCarId }, // incomplete -> restore_rejected
  ]);

  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockPayload(items, "carstock");
    assert.equal(result.added, 1);
    assert.equal(result.failed, 1);
  });

  assert.equal(events.length, 1, "at least one real change in the batch -> exactly one event");
});

test("batch coalescing: zero real changes (all skipped) publishes NO event", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-zero-change-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock");
  });
  await cleanupVehicle(carId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Realtime Fixture" }])[0]!);

  const items = carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Realtime Fixture", km: 1 }]);
  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockPayload(items, "carstock");
    assert.equal(result.added, 0);
    assert.equal(result.updated, 0);
  });

  assert.equal(events.length, 0);
});

// ---------- PUT /cars-update (STRICT FULL UPDATE) ----------

function completeUpdateWireItem(carId: string, overrides: Record<string, unknown> = {}) {
  return {
    carId,
    maker: "BMW",
    model: `X1 Realtime Update Fixture ${carId}`,
    versionName: "sDrive18i",
    rent: 500,
    yearRelease: 2023,
    vin: null,
    km: 5000,
    cc: 1499,
    hp: 140,
    fuel: "Πετρέλαιο",
    color: "White",
    typeOfCar: "SUV",
    transmissionType: "Automatic",
    price: 28000,
    ExtrasDTO: [] as unknown[],
    ...overrides,
  };
}

test("PUT updated: publishes one vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-put-updated-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock:update");
  });
  await cleanupVehicle(carId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([{ carId, maker: "BMW", model: "X1 Base Fixture" }])[0]!);

  const items = carStockUpdatePayloadSchema.parse([completeUpdateWireItem(carId)]);
  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockUpdate(items);
    assert.equal(result.updated, 1);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("PUT vehicle_not_found: publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-put-notfound-1";
  t.after(() => cleanupImportLogsForSource("carstock:update"));

  const items = carStockUpdatePayloadSchema.parse([completeUpdateWireItem(carId)]);
  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockUpdate(items);
    assert.equal(result.failed, 1);
  });

  assert.equal(events.length, 0);
});

// ---------- POST /cars-delete (BULK SOFT DELETE) ----------

test("DELETE (active -> deleted, DB actually changed): publishes one vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-delete-deleted-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock:delete");
  });
  await cleanupVehicle(carId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Realtime Fixture" }])[0]!);

  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockDelete([carId]);
    assert.equal(result.deleted, 1);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("DELETE (already_deleted, DB unchanged): publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-delete-already-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForSource("carstock:delete");
  });
  await cleanupVehicle(carId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Realtime Fixture" }])[0]!);
  await softDeleteVehiclesByExternalCarIds([carId]);

  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockDelete([carId]);
    assert.equal(result.deleted, 0);
    assert.equal(result.skipped, 1);
  });

  assert.equal(events.length, 0);
});

test("DELETE (not_found, DB unchanged): publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "realtime-carstock-delete-notfound-1";
  t.after(() => cleanupImportLogsForSource("carstock:delete"));

  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockDelete([carId]);
    assert.equal(result.deleted, 0);
  });

  assert.equal(events.length, 0);
});

test("DELETE batch coalescing: mixed deleted/already_deleted/not_found publishes exactly ONE event", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const activeCarId = "realtime-carstock-delete-batch-active-1";
  const alreadyDeletedCarId = "realtime-carstock-delete-batch-already-1";
  const unknownCarId = "realtime-carstock-delete-batch-unknown-1";
  t.after(async () => {
    await cleanupVehicle(activeCarId);
    await cleanupVehicle(alreadyDeletedCarId);
    await cleanupImportLogsForSource("carstock:delete");
  });
  await cleanupVehicle(activeCarId);
  await cleanupVehicle(alreadyDeletedCarId);
  await createVehicleFromCarStock(carStockPayloadSchema.parse([{ carId: activeCarId, maker: "Toyota", model: "Corolla Realtime Fixture" }])[0]!);
  await createVehicleFromCarStock(
    carStockPayloadSchema.parse([{ carId: alreadyDeletedCarId, maker: "Toyota", model: "Corolla Realtime Fixture" }])[0]!,
  );
  await softDeleteVehiclesByExternalCarIds([alreadyDeletedCarId]);

  const events = await capturePublishedEvents(async () => {
    const result = await processCarStockDelete([activeCarId, alreadyDeletedCarId, unknownCarId]);
    assert.equal(result.deleted, 1);
    assert.equal(result.skipped, 2);
  });

  assert.equal(events.length, 1, "one real deletion among the three requested carIds -> exactly one event");
});
