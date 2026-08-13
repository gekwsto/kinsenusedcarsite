import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { carStockPayloadSchema } from "@/lib/validators/carstock.schema";
import {
  createVehicleFromCarStock,
  softDeleteVehiclesByExternalCarIds,
  setVehicleFrozen,
  addVehicleImage,
} from "@/server/services/vehicle.service";
import { processCarStockPayload } from "@/server/services/import.service";
import { POST as postCarsUpdated } from "@/app/api/integrations/carstock/cars-updated/route";
import { POST as postCarsDelete } from "@/app/api/integrations/carstock/cars-delete/route";

// A previously soft-deleted Vehicle must be restorable through the SAME
// CREATE endpoint (POST /cars-updated): externalCarId exists + isDeleted
// -> RESTORE, as opposed to externalCarId exists + active -> SKIP.
//
// RESTORE now additionally requires the COMPLETE current CarStock state,
// validated with the exact same strictness PUT uses (carStockRestoreItemSchema
// in carstock.schema.ts, built from the same shared field validators as
// carStockUpdateItemWireSchema — no second, drift-prone schema). An
// incomplete/invalid restore item is `restore_rejected`: no mutation at all,
// the Vehicle stays soft-deleted with every existing field untouched.

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

async function cleanupImportLogsForCarId(carId: string) {
  const recent = await prisma.importLog.findMany({
    where: { source: "carstock" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, rawPayload: true },
  });
  const matchIds = recent
    .filter(
      (log) =>
        Array.isArray(log.rawPayload) &&
        (log.rawPayload as Array<{ carId?: unknown }>).some((item) => String(item?.carId) === carId),
    )
    .map((log) => log.id);
  if (matchIds.length > 0) {
    await prisma.importLog.deleteMany({ where: { id: { in: matchIds } } });
  }
}

function parseItem(raw: Record<string, unknown>) {
  return carStockPayloadSchema.parse([raw])[0]!;
}

/**
 * A COMPLETE, strictly-valid restore payload (wire/real shape — same field
 * names the real CarStock feed sends: rent, ExtrasDTO). Every property
 * carStockRestoreItemSchema requires is explicitly present. Tests that
 * expect a successful restore must use this (or a deliberately-incomplete
 * variant of it for the strict-validation tests below) rather than the
 * loose/partial shapes CREATE alone would tolerate.
 */
function completePayload(carId: string | number, overrides: Record<string, unknown> = {}) {
  return {
    carId,
    maker: "Toyota",
    model: "Corolla Restore Fixture",
    versionName: "1.8 Hybrid Active",
    price: 15000,
    rent: 250,
    yearRelease: 2021,
    vin: "RESTOREVIN00000001",
    km: 20000,
    cc: 1800,
    hp: 122,
    fuel: "Hybrid",
    color: "White",
    typeOfCar: "Sedan",
    transmissionType: "Automatic",
    ExtrasDTO: [{ displayName: "Navigation" }],
    ...overrides,
  };
}

async function createThenSoftDelete(carId: string, overrides: Record<string, unknown> = {}) {
  await createVehicleFromCarStock(parseItem(completePayload(carId, overrides)));
  await softDeleteVehiclesByExternalCarIds([carId]);
}

// ---------- Core lifecycle: NEW -> CREATE, ACTIVE -> SKIP, DELETED+COMPLETE -> RESTORE ----------

test("restore: a new carId still creates (unaffected by the restore branch)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-new-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  const result = await createVehicleFromCarStock(parseItem({ carId, maker: "Toyota", model: "Corolla Restore Fixture" }));
  assert.equal(result.action, "created");
});

test("restore: an existing ACTIVE carId still skips (unaffected by the restore branch)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-active-skip-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  await createVehicleFromCarStock(parseItem({ carId, maker: "Toyota", model: "Corolla Restore Fixture", km: 1000 }));
  const result = await createVehicleFromCarStock(parseItem({ carId, maker: "Toyota", model: "Corolla Restore Fixture", km: 9999 }));
  assert.equal(result.action, "skipped");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.km, 1000, "an active duplicate must remain byte-for-byte untouched");
});

test("restore: a soft-deleted carId + a COMPLETE valid payload restores (action === 'restored')", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-basic-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId)));
  assert.equal(result.action, "restored");
});

test("restore: never creates a second Vehicle row for the same externalCarId", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-no-duplicate-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  await createVehicleFromCarStock(parseItem(completePayload(carId)));

  const vehicles = await prisma.vehicle.findMany({ where: { externalCarId: carId } });
  assert.equal(vehicles.length, 1);
});

test("restore: sets isDeleted=false", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-isdeleted-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  await createVehicleFromCarStock(parseItem(completePayload(carId)));

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, false);
});

// ---------- RESTORE refreshes current CarStock scalar data ----------

test("restore: refreshes price, rent->monthlyPrice, and km from the incoming payload", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-scalars-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { price: 10000, rent: 200, km: 1000 });

  await createVehicleFromCarStock(parseItem(completePayload(carId, { price: 17500, rent: 349.5, km: 45000 })));

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(Number(vehicle!.price), 17500, "price must reflect the current, not stale, CarStock value");
  assert.equal(Number(vehicle!.monthlyPrice), 349.5, "rent must be persisted as monthlyPrice");
  assert.equal(vehicle!.km, 45000);
});

test("restore: refreshes VIN as ordinary data", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-vin-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { vin: "OLDVIN000000000001" });

  await createVehicleFromCarStock(parseItem(completePayload(carId, { vin: "NEWVIN000000000002" })));

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.vin, "NEWVIN000000000002");
});

test("restore: refreshes representative string fields (fuel, color, transmissionType, typeOfCar, cc, hp)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strings-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, {
    fuel: "petrol",
    color: "white",
    transmissionType: "manual",
    typeOfCar: "sedan",
    cc: 1600,
    hp: 110,
  });

  await createVehicleFromCarStock(
    parseItem(
      completePayload(carId, {
        fuel: "hybrid",
        color: "black",
        transmissionType: "automatic",
        typeOfCar: "suv",
        cc: 1798,
        hp: 122,
      }),
    ),
  );

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.fuel, "Hybrid");
  assert.equal(vehicle!.color, "Black");
  assert.equal(vehicle!.transmissionType, "Αυτόματο");
  assert.equal(vehicle!.typeOfCar, "SUV");
  assert.equal(vehicle!.cc, 1798);
  assert.equal(vehicle!.hp, 122);
});

// ---------- RESTORE replaces ExtrasDTO exactly ----------

test("restore: ExtrasDTO fully replaces prior extras (Navigation+Bluetooth -> Navigation+Panoramic Roof, Bluetooth removed)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-extras-replace-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { ExtrasDTO: [{ displayName: "Navigation" }, { displayName: "Bluetooth" }] });

  await createVehicleFromCarStock(
    parseItem(completePayload(carId, { ExtrasDTO: [{ displayName: "Navigation" }, { displayName: "Panoramic Roof" }] })),
  );

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.deepEqual(
    vehicle!.extras.map((e) => e.displayName).sort(),
    ["Navigation", "Panoramic Roof"],
    "Bluetooth must be removed, Panoramic Roof added",
  );
});

test("restore: an explicit empty ExtrasDTO ([]) is valid and clears all prior extras", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-extras-clear-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { ExtrasDTO: [{ displayName: "Navigation" }, { displayName: "Bluetooth" }] });

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId, { ExtrasDTO: [] })));
  assert.equal(result.action, "restored", "ExtrasDTO: [] is a valid, complete restore payload");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.equal(vehicle!.isDeleted, false);
  assert.equal(vehicle!.extras.length, 0);
});

// ---------- Transactional atomicity ----------

test("restore: scalar refresh + extras replacement + isDeleted=false are one transaction — a failure leaves the vehicle NOT restored", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-txn-atomicity-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { km: 1000 });

  const originalTransaction = prisma.$transaction.bind(prisma);
  let transactionAttempted = false;
  prisma.$transaction = (async () => {
    transactionAttempted = true;
    throw new Error("simulated extras-replacement failure");
  }) as typeof prisma.$transaction;

  try {
    await assert.rejects(() => createVehicleFromCarStock(parseItem(completePayload(carId, { km: 99999 }))));
  } finally {
    prisma.$transaction = originalTransaction;
  }
  assert.ok(transactionAttempted, "a valid, strictly-passing restore item must reach the transaction");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true, "must remain soft-deleted after a failed transaction");
  assert.equal(vehicle!.km, 1000, "scalar fields must not be partially updated by a failed transaction");
});

// ---------- RESTORE does not touch non-CarStock data ----------

test("restore: preserves existing VehicleImage rows", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-images-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  await createVehicleFromCarStock(parseItem(completePayload(carId)));
  const vehicleBefore = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  await addVehicleImage(vehicleBefore!.id, "https://example.com/photo.jpg", { isMain: true });
  await softDeleteVehiclesByExternalCarIds([carId]);

  await createVehicleFromCarStock(parseItem(completePayload(carId)));

  const images = await prisma.vehicleImage.findMany({ where: { vehicleId: vehicleBefore!.id } });
  assert.equal(images.length, 1, "VehicleImage rows must survive a restore");
});

test("restore: preserves SEO/description/admin-managed fields", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-seo-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  await createVehicleFromCarStock(parseItem(completePayload(carId)));
  const vehicleBefore = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  await prisma.vehicle.update({
    where: { id: vehicleBefore!.id },
    data: {
      seoTitle: "Admin SEO Title",
      seoDescription: "Admin SEO Description",
      description: "Hand-written admin description",
    },
  });
  await softDeleteVehiclesByExternalCarIds([carId]);

  await createVehicleFromCarStock(parseItem(completePayload(carId)));

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.seoTitle, "Admin SEO Title");
  assert.equal(vehicle!.seoDescription, "Admin SEO Description");
  assert.equal(vehicle!.description, "Hand-written admin description");
});

// ---------- RESTORE must not touch `froze` ----------

test("restore: preserves froze=true even though the incoming payload has no froze:true", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-froze-true-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  await createVehicleFromCarStock(parseItem(completePayload(carId)));
  const vehicleBefore = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  await setVehicleFrozen(vehicleBefore!.id, true);
  await softDeleteVehiclesByExternalCarIds([carId]);

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId)));
  assert.equal(result.action, "restored");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.froze, true, "RESTORE must never silently unfreeze a vehicle");
  assert.equal(vehicle!.isDeleted, false, "froze=true must not block RESTORE from clearing isDeleted");
});

test("restore: preserves froze=false even when the incoming payload explicitly sends froze:true", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-froze-false-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId, { froze: true })));
  assert.equal(result.action, "restored");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.froze, false, "RESTORE must never derive froze from the incoming CarStock payload");
});

// ---------- STRICT VALIDATION: required identity/core fields ----------

test("restore: soft-deleted Vehicle + only {carId} MUST NOT restore", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-only-carid-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { km: 5000 });

  const result = await createVehicleFromCarStock(parseItem({ carId }));
  assert.equal(result.action, "restore_rejected");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true, "must remain soft-deleted");
  assert.equal(vehicle!.km, 5000, "no field may change on a rejected restore");
});

test("restore: missing maker is rejected, no mutation", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-missing-maker-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const payload = completePayload(carId) as Record<string, unknown>;
  delete payload.maker;
  const result = await createVehicleFromCarStock(parseItem(payload));
  assert.equal(result.action, "restore_rejected");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true);
});

test('restore: maker = "" is rejected, no mutation', async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-blank-maker-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId, { maker: "" })));
  assert.equal(result.action, "restore_rejected");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true);
});

test('restore: maker = "   " (whitespace-only) is rejected, no mutation', async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-whitespace-maker-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId, { maker: "   " })));
  assert.equal(result.action, "restore_rejected");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true);
});

test("restore: missing model is rejected, no mutation", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-missing-model-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const payload = completePayload(carId) as Record<string, unknown>;
  delete payload.model;
  const result = await createVehicleFromCarStock(parseItem(payload));
  assert.equal(result.action, "restore_rejected");
});

test("restore: missing versionName is rejected, no mutation", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-missing-versionname-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const payload = completePayload(carId) as Record<string, unknown>;
  delete payload.versionName;
  const result = await createVehicleFromCarStock(parseItem(payload));
  assert.equal(result.action, "restore_rejected");
});

// ---------- STRICT VALIDATION: nullable-but-present fields ----------

test("restore: missing price property is rejected, no mutation", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-missing-price-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { price: 12345 });

  const payload = completePayload(carId) as Record<string, unknown>;
  delete payload.price;
  const result = await createVehicleFromCarStock(parseItem(payload));
  assert.equal(result.action, "restore_rejected");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(Number(vehicle!.price), 12345, "old price must be untouched");
});

test('restore: explicit "price": null is valid and restores with DB price=null', async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-null-price-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { price: 12345 });

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId, { price: null })));
  assert.equal(result.action, "restored");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.price, null);
  assert.equal(vehicle!.isDeleted, false);
});

test("restore: missing vin property is rejected, no mutation", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-missing-vin-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { vin: "OLDVIN0000000001" });

  const payload = completePayload(carId) as Record<string, unknown>;
  delete payload.vin;
  const result = await createVehicleFromCarStock(parseItem(payload));
  assert.equal(result.action, "restore_rejected");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.vin, "OLDVIN0000000001");
});

test('restore: explicit "vin": null is valid and restores with DB vin=null', async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-null-vin-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { vin: "OLDVIN0000000001" });

  const result = await createVehicleFromCarStock(parseItem(completePayload(carId, { vin: null })));
  assert.equal(result.action, "restored");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.vin, null);
});

test("restore: missing ExtrasDTO is rejected, no mutation (never silently treated as [])", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-strict-missing-extras-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId, { ExtrasDTO: [{ displayName: "Navigation" }] });

  const payload = completePayload(carId) as Record<string, unknown>;
  delete payload.ExtrasDTO;
  const result = await createVehicleFromCarStock(parseItem(payload));
  assert.equal(result.action, "restore_rejected");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.equal(vehicle!.isDeleted, true);
  assert.deepEqual(vehicle!.extras.map((e) => e.displayName), ["Navigation"], "old extras must survive a rejected restore");
});

// ---------- The locked scenario (task section 19) ----------

test("LOCKED SCENARIO: {carId} only never restores; DB stays byte-for-byte identical; a complete payload afterward restores transactionally", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "55-locked-scenario";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  await createVehicleFromCarStock(
    parseItem(completePayload(carId, { maker: "BMW", price: 30000, km: 10000, ExtrasDTO: [{ displayName: "Navigation" }] })),
  );
  await softDeleteVehiclesByExternalCarIds([carId]);

  const before = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.equal(before!.isDeleted, true);
  assert.equal(before!.maker, "BMW");
  assert.equal(Number(before!.price), 30000);
  assert.equal(before!.km, 10000);
  assert.deepEqual(before!.extras.map((e) => e.displayName), ["Navigation"]);

  // Incoming POST: { "carId": "55-locked-scenario" } — nothing else.
  const rejectResult = await createVehicleFromCarStock(parseItem({ carId }));
  assert.equal(rejectResult.action, "restore_rejected", "NO RESTORE for an incomplete payload");

  const afterReject = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.equal(afterReject!.isDeleted, true, "isDeleted stays true");
  assert.equal(afterReject!.maker, "BMW", "maker stays BMW — never null/undefined/'Άγνωστο'/externalCarId fallback");
  assert.equal(Number(afterReject!.price), 30000, "price stays unchanged");
  assert.equal(afterReject!.km, 10000, "km stays unchanged");
  assert.deepEqual(afterReject!.extras.map((e) => e.displayName), ["Navigation"], "extras stay unchanged");

  // Now send a COMPLETE valid POST for the same carId.
  const restoreResult = await createVehicleFromCarStock(
    parseItem(completePayload(carId, { maker: "BMW", price: 31000, km: 11000, ExtrasDTO: [{ displayName: "Panoramic Roof" }] })),
  );
  assert.equal(restoreResult.action, "restored", "RESTORE succeeds transactionally once the payload is complete");

  const afterRestore = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.equal(afterRestore!.isDeleted, false);
  assert.equal(Number(afterRestore!.price), 31000);
  assert.equal(afterRestore!.km, 11000);
  assert.deepEqual(afterRestore!.extras.map((e) => e.displayName), ["Panoramic Roof"]);

  const rows = await prisma.vehicle.findMany({ where: { externalCarId: carId } });
  assert.equal(rows.length, 1);
});

// ---------- ImportLog / processCarStockPayload accounting ----------

test("processCarStockPayload: a restored vehicle (complete payload) is counted in updatedCount, not createdCount", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-importlog-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const parsed = carStockPayloadSchema.parse([completePayload(carId, { km: 5000 })]);
  const result = await processCarStockPayload(parsed, "carstock");

  assert.equal(result.added, 0, "a restore must never be counted as a create");
  assert.equal(result.updated, 1, "a restore is represented as an update — it updates an existing DB row");
  assert.equal(result.skipped, 0);
  assert.equal(result.errors.length, 0);
  assert.equal(result.log.createdCount, 0);
  assert.equal(result.log.updatedCount, 1);
  assert.equal(result.log.skippedCount, 0);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, false);
  assert.equal(vehicle!.km, 5000);
});

test("processCarStockPayload: an incomplete restore item is recorded as an error, not counted as created/updated/skipped", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-importlog-rejected-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);
  await createThenSoftDelete(carId);

  const parsed = carStockPayloadSchema.parse([{ carId }]);
  const result = await processCarStockPayload(parsed, "carstock");

  assert.equal(result.added, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]!.error, /restore_rejected/);
  assert.equal(result.log.status, "FAILED", "the only item in the batch failed");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true);
});

test("processCarStockPayload: skippedCount remains correct for an active duplicate (unaffected by restore accounting)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-skip-accounting-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await createVehicleFromCarStock(parseItem({ carId, maker: "Toyota", model: "Corolla Restore Fixture" }));

  const parsed = carStockPayloadSchema.parse([{ carId, maker: "Toyota", model: "Corolla Restore Fixture", km: 5000 }]);
  const result = await processCarStockPayload(parsed, "carstock");

  assert.equal(result.added, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 1);
});

// ---------- Batch independence ----------

test("batch: an invalid restore item does not corrupt an independent, genuinely-new CREATE item in the same batch", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const softDeletedCarId = "carstock-restore-batch-invalid-1";
  const newCarId = "carstock-restore-batch-new-1";
  t.after(async () => {
    await cleanupVehicle(softDeletedCarId);
    await cleanupVehicle(newCarId);
    await cleanupImportLogsForCarId(softDeletedCarId);
    await cleanupImportLogsForCarId(newCarId);
  });
  await cleanupVehicle(softDeletedCarId);
  await cleanupVehicle(newCarId);
  await createThenSoftDelete(softDeletedCarId, { km: 7000 });

  const parsed = carStockPayloadSchema.parse([
    { carId: softDeletedCarId }, // incomplete -> restore_rejected
    { carId: newCarId, maker: "BMW", model: "320d Batch Fixture" }, // genuine create
  ]);
  const result = await processCarStockPayload(parsed, "carstock");

  assert.equal(result.added, 1, "the independent new carId must still be created");
  assert.equal(result.updated, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.log.status, "PARTIAL_SUCCESS");

  const rejected = await prisma.vehicle.findUnique({ where: { externalCarId: softDeletedCarId } });
  assert.equal(rejected!.isDeleted, true, "the rejected restore's Vehicle stays untouched");
  assert.equal(rejected!.km, 7000);

  const created = await prisma.vehicle.findUnique({ where: { externalCarId: newCarId } });
  assert.ok(created, "the independent create must succeed despite the other batch item failing");
});

test("batch: a valid restore item does not corrupt an independent active-duplicate skip in the same batch", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const softDeletedCarId = "carstock-restore-batch-valid-1";
  const activeCarId = "carstock-restore-batch-active-1";
  t.after(async () => {
    await cleanupVehicle(softDeletedCarId);
    await cleanupVehicle(activeCarId);
    await cleanupImportLogsForCarId(softDeletedCarId);
    await cleanupImportLogsForCarId(activeCarId);
  });
  await cleanupVehicle(softDeletedCarId);
  await cleanupVehicle(activeCarId);
  await createThenSoftDelete(softDeletedCarId);
  await createVehicleFromCarStock(parseItem({ carId: activeCarId, maker: "Toyota", model: "Corolla Active Fixture", km: 1 }));

  const parsed = carStockPayloadSchema.parse([
    completePayload(softDeletedCarId, { km: 8000 }),
    { carId: activeCarId, maker: "Toyota", model: "Corolla Active Fixture", km: 99999 },
  ]);
  const result = await processCarStockPayload(parsed, "carstock");

  assert.equal(result.updated, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.added, 0);
  assert.equal(result.log.status, "SUCCESS");

  const restored = await prisma.vehicle.findUnique({ where: { externalCarId: softDeletedCarId } });
  assert.equal(restored!.isDeleted, false);
  assert.equal(restored!.km, 8000);

  const active = await prisma.vehicle.findUnique({ where: { externalCarId: activeCarId } });
  assert.equal(active!.km, 1, "the independent active duplicate must remain untouched");
});

// ---------- Full HTTP lifecycle: CREATE -> POST soft-delete -> RESTORE ----------

const TEST_TOKEN = "test-carstock-restore-lifecycle-token";

function withApiKey(t: TestContext) {
  const original = process.env.CARSTOCK_API_KEY;
  process.env.CARSTOCK_API_KEY = TEST_TOKEN;
  t.after(() => {
    if (original === undefined) delete process.env.CARSTOCK_API_KEY;
    else process.env.CARSTOCK_API_KEY = original;
  });
}

function buildCarsUpdatedRequest(body: unknown): NextRequest {
  const headers = new Headers({ "content-type": "application/json", authorization: `Bearer ${TEST_TOKEN}` });
  return new NextRequest("http://localhost/api/integrations/carstock/cars-updated", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function buildCarsDeleteRequest(body: unknown): NextRequest {
  const headers = new Headers({ "content-type": "application/json", authorization: `Bearer ${TEST_TOKEN}` });
  return new NextRequest("http://localhost/api/integrations/carstock/cars-delete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("full lifecycle: POST create -> POST soft-delete -> POST restore (COMPLETE payload) ends with exactly one Vehicle row, isDeleted=false", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-full-lifecycle-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  // STEP 1: CREATE
  const createResponse = await postCarsUpdated(
    buildCarsUpdatedRequest([{ carId, maker: "Toyota", model: "Corolla Lifecycle Fixture", ExtrasDTO: [{ displayName: "Navigation" }] }]),
  );
  assert.equal(createResponse.status, 200);
  const createJson = await createResponse.json();
  assert.equal(createJson.ok, true);
  assert.equal(createJson.added, 1);
  assert.deepEqual(createJson.results, [{ carId, success: true, action: "created", error: null }]);

  const afterCreate = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.ok(afterCreate);
  assert.equal(afterCreate!.isDeleted, false);
  const originalVehicleId = afterCreate!.id;

  // STEP 2: POST soft-delete
  const deleteResponse = await postCarsDelete(buildCarsDeleteRequest({ carIds: [carId] }));
  assert.equal(deleteResponse.status, 200);
  const deleteJson = await deleteResponse.json();
  assert.equal(deleteJson.ok, true);
  assert.equal(deleteJson.deleted, 1);
  assert.deepEqual(deleteJson.results, [{ carId, success: true, action: "deleted", error: null }]);

  const afterDelete = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.ok(afterDelete, "the row must remain physically present");
  assert.equal(afterDelete!.isDeleted, true);
  assert.equal(afterDelete!.id, originalVehicleId);

  // STEP 3: RESTORE via the SAME create endpoint, current COMPLETE vehicle state
  const restoreResponse = await postCarsUpdated(buildCarsUpdatedRequest([completePayload(carId, { km: 12345 })]));
  assert.equal(restoreResponse.status, 200);
  const restoreJson = await restoreResponse.json();
  assert.equal(restoreJson.ok, true);
  assert.equal(restoreJson.added, 0, "a restore must not report as `added` — no second row was created");
  assert.equal(restoreJson.updated, 1);
  assert.deepEqual(restoreJson.results, [{ carId, success: true, action: "restored", error: null }]);

  const afterRestore = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.ok(afterRestore);
  assert.equal(afterRestore!.id, originalVehicleId, "the SAME row must be reactivated, never a new one");
  assert.equal(afterRestore!.isDeleted, false);
  assert.equal(afterRestore!.km, 12345);
  assert.deepEqual(afterRestore!.extras.map((e) => e.displayName), ["Navigation"]);

  const allRows = await prisma.vehicle.findMany({ where: { externalCarId: carId } });
  assert.equal(allRows.length, 1, "exactly one Vehicle row must exist for this externalCarId after the full lifecycle");
});

test("full lifecycle: POST create -> POST soft-delete -> POST restore with an INCOMPLETE payload does NOT reactivate the Vehicle", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;
  const carId = "carstock-restore-full-lifecycle-incomplete-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await postCarsUpdated(buildCarsUpdatedRequest([{ carId, maker: "Toyota", model: "Corolla Lifecycle Fixture", km: 500 }]));
  await postCarsDelete(buildCarsDeleteRequest({ carIds: [carId] }));

  // Incomplete: only carId + maker, missing model/versionName/price/etc.
  const restoreResponse = await postCarsUpdated(buildCarsUpdatedRequest([{ carId, maker: "Toyota" }]));
  assert.equal(restoreResponse.status, 200, "a per-item restore_rejected inside a valid batch is still HTTP 200");
  const restoreJson = await restoreResponse.json();
  assert.equal(restoreJson.ok, false, "restore_rejected is a FAILURE result");
  assert.equal(restoreJson.added, 0);
  assert.equal(restoreJson.failed, 1);
  assert.deepEqual(restoreJson.results, [
    { carId, success: false, action: "restore_rejected", error: "Complete vehicle payload is required for restore" },
  ]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.ok(vehicle);
  assert.equal(vehicle!.isDeleted, true, "an incomplete restore payload must never reactivate the vehicle");
  assert.equal(vehicle!.km, 500, "old data must remain untouched");
});
