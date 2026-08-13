import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { carStockPayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockPayload, listImportLogs, getImportLogById } from "@/server/services/import.service";
import { createVehicleFromCarStock, isPrismaP2002 } from "@/server/services/vehicle.service";

// Self-skips (rather than failing) when no local Postgres is reachable, same
// pattern as vehicle-filter-metadata-scope.test.ts — keeps `npm test` green
// in environments without DATABASE_URL wired up, while still exercising
// real create/skip behavior wherever a dev DB is available.
async function skipIfDbUnreachable(t: TestContext): Promise<boolean> {
  try {
    await prisma.vehicle.count();
    return false;
  } catch {
    t.skip("DATABASE_URL not reachable in this environment");
    return true;
  }
}

const EXTERNAL_ID = "carstock-test-4821";

async function cleanupVehicle(externalCarId: string) {
  await prisma.vehicle.deleteMany({ where: { externalCarId } });
}

test("createVehicleFromCarStock: creates a new vehicle from the exact real CarStock payload", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [item] = carStockPayloadSchema.parse([
    {
      carId: EXTERNAL_ID,
      maker: "Toyota",
      model: "Corolla Import Fixture",
      versionName: "1.8 Hybrid Active",
      yearRelease: "2022",
      price: 18500.5,
      km: 32000,
      cc: 1798,
      hp: 122,
      typeOfDiscount: "SEASONAL",
      fuel: "Hybrid",
      transmissionType: "Automatic",
      color: "White",
      typeOfCar: "Sedan",
      image_url: "https://carstock.example.com/photos/4821/main.jpg",
      offer: true,
      froze: false,
      delete: false,
      rent: 289.9,
      vin: "JTDBU4EE0N3123456",
    },
  ]);

  const result = await createVehicleFromCarStock(item!);
  assert.equal(result.action, "created");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.ok(vehicle);
  assert.equal(vehicle!.maker, "Toyota");
  assert.equal(vehicle!.model, "Corolla Import Fixture");
  assert.equal(vehicle!.versionName, "1.8 Hybrid Active");
  assert.equal(vehicle!.yearRelease, 2022);
  assert.equal(Number(vehicle!.price), 18500.5);
  assert.equal(Number(vehicle!.monthlyPrice), 289.9, "rent must be persisted as monthlyPrice");
  assert.equal(vehicle!.discountType, "SEASONAL");
  assert.equal(vehicle!.vin, "JTDBU4EE0N3123456");
  assert.equal(vehicle!.froze, false);
  assert.equal(vehicle!.isDeleted, false);
});

test("createVehicleFromCarStock: a full re-push of an existing carId is skipped, not updated", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [createItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", km: 32000, rent: 289.9, vin: "JTDBU4EE0N3123456" },
  ]);
  await createVehicleFromCarStock(createItem!);

  const [reRushItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", km: 45000, rent: 310.0, price: 17500 },
  ]);
  const result = await createVehicleFromCarStock(reRushItem!);
  assert.equal(result.action, "skipped", "CREATE is strict create-only; an existing carId is never updated by POST");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.equal(vehicle!.km, 32000, "the existing vehicle must remain completely unchanged");
  assert.equal(vehicle!.price, null);
  assert.equal(Number(vehicle!.monthlyPrice), 289.9);
  assert.equal(vehicle!.vin, "JTDBU4EE0N3123456");
});

test("createVehicleFromCarStock: a {carId, froze} push for an existing carId is skipped, not frozen", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [createItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", km: 32000, cc: 1798, hp: 122, fuel: "Hybrid" },
  ]);
  await createVehicleFromCarStock(createItem!);

  const [freezeItem] = carStockPayloadSchema.parse([{ carId: EXTERNAL_ID, froze: true }]);
  const result = await createVehicleFromCarStock(freezeItem!);
  assert.equal(result.action, "skipped", "POST no longer performs the old {carId, froze} partial update");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.equal(vehicle!.froze, false, "an existing vehicle must never be frozen through POST");
  assert.equal(vehicle!.km, 32000);
  assert.equal(vehicle!.cc, 1798);
  assert.equal(vehicle!.hp, 122);
  assert.equal(vehicle!.fuel, "Hybrid");
});

test("createVehicleFromCarStock: the old {carId, delete} flag is no longer a deletion mechanism (existing carId is just skipped)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [createItem] = carStockPayloadSchema.parse([{ carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture" }]);
  await createVehicleFromCarStock(createItem!);

  const [deleteItem] = carStockPayloadSchema.parse([{ carId: EXTERNAL_ID, delete: true }]);
  const result = await createVehicleFromCarStock(deleteItem!);
  assert.equal(result.action, "skipped");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.ok(vehicle);
  assert.equal(vehicle!.isDeleted, false, "soft-delete is exclusively DELETE /api/integrations/carstock/cars-delete");
});

test("createVehicleFromCarStock: a skipped duplicate leaves the vehicle's existing VehicleExtra rows untouched", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [createItem] = carStockPayloadSchema.parse([
    {
      carId: EXTERNAL_ID,
      maker: "Toyota",
      model: "Corolla Import Fixture",
      ExtrasDTO: [{ displayName: "Navigation" }],
    },
  ]);
  await createVehicleFromCarStock(createItem!);

  const [duplicateItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", ExtrasDTO: [{ displayName: "Panoramic roof" }] },
  ]);
  const result = await createVehicleFromCarStock(duplicateItem!);
  assert.equal(result.action, "skipped");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID }, include: { extras: true } });
  assert.deepEqual(
    vehicle!.extras.map((e) => e.displayName),
    ["Navigation"],
    "extras must be untouched by a skipped duplicate, never replaced",
  );
});

test("createVehicleFromCarStock: ExtrasDTO is persisted as VehicleExtra rows on create, inside a transaction", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [item] = carStockPayloadSchema.parse([
    {
      carId: EXTERNAL_ID,
      maker: "Toyota",
      model: "Corolla Import Fixture",
      ExtrasDTO: [{ displayName: "Navigation" }, { displayName: "Bluetooth" }],
    },
  ]);

  const result = await createVehicleFromCarStock(item!);
  assert.equal(result.action, "created");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID }, include: { extras: true } });
  assert.ok(vehicle);
  assert.deepEqual(vehicle!.extras.map((e) => e.displayName).sort(), ["Bluetooth", "Navigation"]);
});

test("createVehicleFromCarStock: null ExtrasDTO normalizes to no extras created", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [item] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", ExtrasDTO: null },
  ]);
  await createVehicleFromCarStock(item!);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID }, include: { extras: true } });
  assert.equal(vehicle!.extras.length, 0);
});

test("createVehicleFromCarStock: image_url never creates or overwrites VehicleImage rows on create", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [item] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", image_url: "https://carstock.example.com/x.jpg" },
  ]);
  await createVehicleFromCarStock(item!);

  const vehicle = await prisma.vehicle.findUnique({
    where: { externalCarId: EXTERNAL_ID },
    include: { images: true },
  });
  assert.equal(vehicle!.images.length, 0);
});

test("processCarStockPayload: end-to-end create via the exact real payload, through the ImportLog", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  let importLogId: string | undefined;
  t.after(async () => {
    await cleanupVehicle(EXTERNAL_ID);
    if (importLogId) await prisma.importLog.delete({ where: { id: importLogId } }).catch(() => null);
  });
  await cleanupVehicle(EXTERNAL_ID);

  const parsed = carStockPayloadSchema.parse([
    {
      carId: EXTERNAL_ID,
      maker: "Toyota",
      model: "Corolla Import Fixture",
      versionName: "1.8 Hybrid Active",
      yearRelease: "2022",
      price: 18500.5,
      rent: 289.9,
      vin: "JTDBU4EE0N3123456",
      typeOfDiscount: "SEASONAL",
      offer: true,
      froze: false,
      delete: false,
    },
  ]);

  const result = await processCarStockPayload(parsed, "carstock");
  importLogId = result.log.id;

  assert.equal(result.added, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.errors.length, 0);
  assert.equal(result.log.status, "SUCCESS");
  assert.equal(result.log.createdCount, 1);
  assert.equal(result.log.skippedCount, 0, "a real skippedCount column, not folded into updatedCount");
  assert.equal(result.log.updatedCount, 0, "CREATE never performs an update");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.ok(vehicle);
  assert.equal(Number(vehicle!.monthlyPrice), 289.9);
  assert.equal(vehicle!.discountType, "SEASONAL");
});

test("processCarStockPayload: a batch of a new carId + an already-existing carId creates only the new one", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const existingCarId = "carstock-import-batch-existing";
  const newCarId = "carstock-import-batch-new";
  let importLogId: string | undefined;
  t.after(async () => {
    await cleanupVehicle(existingCarId);
    await cleanupVehicle(newCarId);
    if (importLogId) await prisma.importLog.delete({ where: { id: importLogId } }).catch(() => null);
  });
  await cleanupVehicle(existingCarId);
  await cleanupVehicle(newCarId);

  await createVehicleFromCarStock(
    carStockPayloadSchema.parse([{ carId: existingCarId, maker: "Toyota", model: "Corolla Fixture", km: 1000 }])[0]!,
  );

  const parsed = carStockPayloadSchema.parse([
    { carId: existingCarId, maker: "Toyota", model: "Corolla Fixture", km: 99999 },
    { carId: newCarId, maker: "BMW", model: "320d Batch New Fixture" },
  ]);
  const result = await processCarStockPayload(parsed, "carstock");
  importLogId = result.log.id;

  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.log.createdCount, 1);
  assert.equal(result.log.skippedCount, 1);
  assert.equal(result.log.updatedCount, 0, "a skipped duplicate must never be counted as an update");

  const existing = await prisma.vehicle.findUnique({ where: { externalCarId: existingCarId } });
  const created = await prisma.vehicle.findUnique({ where: { externalCarId: newCarId } });
  assert.equal(existing!.km, 1000, "the existing vehicle must remain untouched");
  assert.ok(created, "the new carId must be created");
});

test("processCarStockPayload: a carId repeated twice in the same batch creates only one Vehicle", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-import-intra-batch-dup";
  let importLogId: string | undefined;
  t.after(async () => {
    await cleanupVehicle(carId);
    if (importLogId) await prisma.importLog.delete({ where: { id: importLogId } }).catch(() => null);
  });
  await cleanupVehicle(carId);

  const parsed = carStockPayloadSchema.parse([
    { carId, maker: "BMW", model: "320d Intra-Batch Dup A" },
    { carId, maker: "BMW", model: "320d Intra-Batch Dup B" },
  ]);
  const result = await processCarStockPayload(parsed, "carstock");
  importLogId = result.log.id;

  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.log.skippedCount, 1);
  assert.equal(result.log.updatedCount, 0);

  const vehicles = await prisma.vehicle.findMany({ where: { externalCarId: carId } });
  assert.equal(vehicles.length, 1, "only one Vehicle row may ever be created for a duplicated carId");
});

test("processCarStockPayload: mixed batch — 4 received, 2 created, 2 skipped, 0 updated", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const existingCarId = "carstock-import-mixed-existing";
  const newCarIdA = "carstock-import-mixed-new-a";
  const newCarIdB = "carstock-import-mixed-new-b";
  let importLogId: string | undefined;
  t.after(async () => {
    await cleanupVehicle(existingCarId);
    await cleanupVehicle(newCarIdA);
    await cleanupVehicle(newCarIdB);
    if (importLogId) await prisma.importLog.delete({ where: { id: importLogId } }).catch(() => null);
  });
  await cleanupVehicle(existingCarId);
  await cleanupVehicle(newCarIdA);
  await cleanupVehicle(newCarIdB);

  await createVehicleFromCarStock(
    carStockPayloadSchema.parse([{ carId: existingCarId, maker: "Toyota", model: "Corolla Mixed Fixture" }])[0]!,
  );

  // 4 items: existingCarId (already exists -> skip), newCarIdA (new ->
  // create), newCarIdB sent twice (first creates, the intra-batch repeat is
  // skipped).
  const parsed = carStockPayloadSchema.parse([
    { carId: existingCarId, maker: "Toyota", model: "Corolla Mixed Fixture" },
    { carId: newCarIdA, maker: "BMW", model: "320d Mixed A" },
    { carId: newCarIdB, maker: "BMW", model: "320d Mixed B" },
    { carId: newCarIdB, maker: "BMW", model: "320d Mixed B Duplicate" },
  ]);
  const result = await processCarStockPayload(parsed, "carstock");
  importLogId = result.log.id;

  assert.equal(result.log.receivedCount, 4);
  assert.equal(result.log.createdCount, 2);
  assert.equal(result.log.skippedCount, 2);
  assert.equal(result.log.updatedCount, 0);
});

test("createVehicleFromCarStock: a concurrent duplicate create for the same brand-new carId is skipped, not failed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-import-concurrent-race-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  const itemA = carStockPayloadSchema.parse([
    { carId, maker: "BMW", model: "320d Race A", km: 11111, ExtrasDTO: [{ displayName: "Race A Extra" }] },
  ])[0]!;
  const itemB = carStockPayloadSchema.parse([
    { carId, maker: "BMW", model: "320d Race B", km: 22222, ExtrasDTO: [{ displayName: "Race B Extra" }] },
  ])[0]!;

  const [resultA, resultB] = await Promise.all([
    createVehicleFromCarStock(itemA),
    createVehicleFromCarStock(itemB),
  ]);

  const actions = [resultA.action, resultB.action].sort();
  assert.deepEqual(actions, ["created", "skipped"], "exactly one concurrent create must win, the other must be skipped");

  const vehicles = await prisma.vehicle.findMany({ where: { externalCarId: carId }, include: { extras: true } });
  assert.equal(vehicles.length, 1, "a concurrent duplicate must never create two Vehicle rows");

  // Whichever request actually won, the loser must never have mutated the
  // winner's fields or extras — a skip is a true no-op, not a hidden merge.
  const winner = vehicles[0]!;
  const winningKm = resultA.action === "created" ? 11111 : 22222;
  const winningExtra = resultA.action === "created" ? "Race A Extra" : "Race B Extra";
  assert.equal(winner.km, winningKm, "the losing request must never overwrite the winner's fields");
  assert.deepEqual(
    winner.extras.map((e) => e.displayName),
    [winningExtra],
    "the losing request must never touch the winner's extras",
  );
});

test("processCarStockPayload: two concurrent POST batches for the same new carId — one batch creates it, the other logs it as skipped, never updated", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-import-concurrent-batches-1";
  let logIdA: string | undefined;
  let logIdB: string | undefined;
  t.after(async () => {
    await cleanupVehicle(carId);
    if (logIdA) await prisma.importLog.delete({ where: { id: logIdA } }).catch(() => null);
    if (logIdB) await prisma.importLog.delete({ where: { id: logIdB } }).catch(() => null);
  });
  await cleanupVehicle(carId);

  const parsedA = carStockPayloadSchema.parse([{ carId, maker: "BMW", model: "320d Concurrent Batch A" }]);
  const parsedB = carStockPayloadSchema.parse([{ carId, maker: "BMW", model: "320d Concurrent Batch B" }]);

  const [resultA, resultB] = await Promise.all([
    processCarStockPayload(parsedA, "carstock"),
    processCarStockPayload(parsedB, "carstock"),
  ]);
  logIdA = resultA.log.id;
  logIdB = resultB.log.id;

  assert.equal(resultA.added + resultB.added, 1, "exactly one of the two concurrent batches creates the vehicle");
  assert.equal(resultA.skipped + resultB.skipped, 1, "the other batch records the duplicate as skipped");
  assert.equal(resultA.log.updatedCount, 0);
  assert.equal(resultB.log.updatedCount, 0, "a concurrent duplicate must never be counted as an update");

  const vehicles = await prisma.vehicle.findMany({ where: { externalCarId: carId } });
  assert.equal(vehicles.length, 1);
});

// ---------- isPrismaP2002: a generic, target-agnostic classifier ----------

test("isPrismaP2002: true for a P2002 regardless of what meta.target names", () => {
  const targetingExternalCarId = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["externalCarId"] },
  });
  const targetingSlug = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["slug"] },
  });
  const noMeta = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
  assert.equal(isPrismaP2002(targetingExternalCarId), true);
  assert.equal(isPrismaP2002(targetingSlug), true);
  assert.equal(isPrismaP2002(noMeta), true);
});

test("isPrismaP2002: false for a non-P2002 Prisma error", () => {
  const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
    code: "P2025",
    clientVersion: "test",
  });
  assert.equal(isPrismaP2002(error), false);
});

test("isPrismaP2002: false for a plain, non-Prisma error", () => {
  assert.equal(isPrismaP2002(new Error("boom")), false);
  assert.equal(isPrismaP2002("boom"), false);
  assert.equal(isPrismaP2002(null), false);
});

// ---------- createVehicleFromCarStock's P2002 resolution: authoritative
// fresh lookup, never a decision based on meta.target ----------
//
// These three tests replace `prisma.$transaction` with a stand-in for the
// duration of a single call (restored in `finally`) so the exact P2002
// shape Postgres/Prisma happens to report can be controlled directly,
// instead of depending on a real race actually landing on one index over
// the other. `prisma.vehicle.findUnique` is never mocked — the fresh
// post-P2002 lookup inside createVehicleFromCarStock always runs for real.

async function withMockedTransaction(mockTransaction: typeof prisma.$transaction, run: () => Promise<void>) {
  const original = prisma.$transaction.bind(prisma);
  prisma.$transaction = mockTransaction;
  try {
    await run();
  } finally {
    prisma.$transaction = original;
  }
}

test("createVehicleFromCarStock: P2002 reporting externalCarId resolves to skipped once a fresh lookup confirms the carId now exists", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-import-p2002-target-externalcarid-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  const originalTransaction = prisma.$transaction.bind(prisma);
  await withMockedTransaction(
    (async () => {
      // Simulate the concurrent winner actually committing first...
      await originalTransaction(async (tx) => {
        await tx.vehicle.create({
          data: {
            externalCarId: carId,
            slug: `carstock-p2002-target-externalcarid-winner-${carId}`,
            maker: "Volvo",
            model: "P2002 Target ExternalCarId Fixture",
            versionName: "P2002 Target ExternalCarId Fixture",
          },
        });
      });
      // ...then this (losing) request's own transaction failing, with
      // Prisma reporting the conflict against externalCarId.
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`externalCarId`)", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["externalCarId"] },
      });
    }) as typeof prisma.$transaction,
    async () => {
      const item = carStockPayloadSchema.parse([{ carId, maker: "Volvo", model: "Retry" }])[0]!;
      const result = await createVehicleFromCarStock(item);
      assert.equal(result.action, "skipped");
    },
  );
});

test("createVehicleFromCarStock: P2002 reporting ONLY slug still resolves to skipped once a fresh externalCarId lookup confirms it exists (decision does not depend on meta.target)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-import-p2002-target-slug-only-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  const originalTransaction = prisma.$transaction.bind(prisma);
  await withMockedTransaction(
    (async () => {
      await originalTransaction(async (tx) => {
        await tx.vehicle.create({
          data: {
            externalCarId: carId,
            slug: `carstock-p2002-target-slug-only-winner-${carId}`,
            maker: "Volvo",
            model: "P2002 Target Slug Only Fixture",
            versionName: "P2002 Target Slug Only Fixture",
          },
        });
      });
      // Prisma reports ONLY `slug` — never mentions externalCarId at all.
      // The correct answer still hinges on the fresh lookup, not this.
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["slug"] },
      });
    }) as typeof prisma.$transaction,
    async () => {
      const item = carStockPayloadSchema.parse([{ carId, maker: "Volvo", model: "Retry" }])[0]!;
      const result = await createVehicleFromCarStock(item);
      assert.equal(
        result.action,
        "skipped",
        "meta.target naming only `slug` must not prevent the skip — the fresh externalCarId lookup is authoritative",
      );
    },
  );
});

test("createVehicleFromCarStock: P2002 with no matching externalCarId afterward is rethrown, never swallowed as skipped", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-import-p2002-unrelated-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  const syntheticError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["slug"] },
  });

  let caught: unknown;
  await withMockedTransaction(
    (async () => {
      // No winning row is ever inserted for `carId` — this simulates a
      // genuinely unrelated uniqueness failure (e.g. a real slug collision
      // between two different carIds), not a duplicate of this carId.
      throw syntheticError;
    }) as typeof prisma.$transaction,
    async () => {
      const item = carStockPayloadSchema.parse([{ carId, maker: "Volvo", model: "Unrelated P2002 Fixture" }])[0]!;
      try {
        await createVehicleFromCarStock(item);
      } catch (error) {
        caught = error;
      }
    },
  );

  assert.equal(caught, syntheticError, "the original P2002 must be rethrown unchanged when the carId still doesn't exist");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle, null, "an unrelated/rethrown P2002 must never create the vehicle either");
});

test("listImportLogs / getImportLogById: expose skippedCount as its own field, distinct from updatedCount", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-import-log-serialization-1";
  let importLogId: string | undefined;
  t.after(async () => {
    await cleanupVehicle(carId);
    if (importLogId) await prisma.importLog.delete({ where: { id: importLogId } }).catch(() => null);
  });
  await cleanupVehicle(carId);

  await createVehicleFromCarStock(
    carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Log Serialization Fixture" }])[0]!,
  );
  const result = await processCarStockPayload(
    carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Log Serialization Fixture" }]),
    "carstock",
  );
  importLogId = result.log.id;

  const listed = await listImportLogs({ page: 1, pageSize: 50 });
  const listedLog = listed.items.find((log) => log.id === importLogId);
  assert.ok(listedLog);
  assert.equal(listedLog!.skippedCount, 1);
  assert.equal(listedLog!.updatedCount, 0);

  const detail = await getImportLogById(importLogId);
  assert.ok(detail);
  assert.equal(detail!.skippedCount, 1);
  assert.equal(detail!.updatedCount, 0);
});
