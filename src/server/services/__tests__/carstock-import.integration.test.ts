import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { carStockPayloadSchema } from "@/lib/validators/carstock.schema";
import { processCarStockPayload } from "@/server/services/import.service";
import { upsertVehicleFromStock } from "@/server/services/vehicle.service";

// Self-skips (rather than failing) when no local Postgres is reachable, same
// pattern as vehicle-filter-metadata-scope.test.ts — keeps `npm test` green
// in environments without DATABASE_URL wired up, while still exercising
// real create/update/upsert behavior wherever a dev DB is available.
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

test("upsertVehicleFromStock: creates a new vehicle from the exact real CarStock payload", async (t) => {
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

  const result = await upsertVehicleFromStock(item!);
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

test("upsertVehicleFromStock: a full re-push updates every mapped field", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [createItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", km: 32000, rent: 289.9, vin: "JTDBU4EE0N3123456" },
  ]);
  await upsertVehicleFromStock(createItem!);

  const [updateItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", km: 45000, rent: 310.0, price: 17500 },
  ]);
  const result = await upsertVehicleFromStock(updateItem!);
  assert.equal(result.action, "updated");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.equal(vehicle!.km, 45000);
  assert.equal(Number(vehicle!.monthlyPrice), 310.0);
  assert.equal(Number(vehicle!.price), 17500);
  assert.equal(vehicle!.vin, "JTDBU4EE0N3123456", "fields absent from the delta must be left untouched");
});

test("upsertVehicleFromStock: a partial {carId, froze} delta freezes without nulling other fields", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [createItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", km: 32000, cc: 1798, hp: 122, fuel: "Hybrid" },
  ]);
  await upsertVehicleFromStock(createItem!);

  const [freezeItem] = carStockPayloadSchema.parse([{ carId: EXTERNAL_ID, froze: true }]);
  const result = await upsertVehicleFromStock(freezeItem!);
  assert.equal(result.action, "frozen");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.equal(vehicle!.froze, true);
  assert.equal(vehicle!.km, 32000, "partial update must not null unrelated fields");
  assert.equal(vehicle!.cc, 1798);
  assert.equal(vehicle!.hp, 122);
  assert.equal(vehicle!.fuel, "Hybrid");
});

test("upsertVehicleFromStock: a partial {carId, delete} delta soft-deletes the vehicle", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [createItem] = carStockPayloadSchema.parse([{ carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture" }]);
  await upsertVehicleFromStock(createItem!);

  const [deleteItem] = carStockPayloadSchema.parse([{ carId: EXTERNAL_ID, delete: true }]);
  const result = await upsertVehicleFromStock(deleteItem!);
  assert.equal(result.action, "deleted");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.ok(vehicle, "delete is a soft-delete flag, the row itself must still exist");
  assert.equal(vehicle!.isDeleted, true);
});

test("upsertVehicleFromStock: image_url never creates or overwrites VehicleImage rows", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [item] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, maker: "Toyota", model: "Corolla Import Fixture", image_url: "https://carstock.example.com/x.jpg" },
  ]);
  await upsertVehicleFromStock(item!);

  const vehicle = await prisma.vehicle.findUnique({
    where: { externalCarId: EXTERNAL_ID },
    include: { images: true },
  });
  assert.equal(vehicle!.images.length, 0);

  const [updateItem] = carStockPayloadSchema.parse([
    { carId: EXTERNAL_ID, image_url: "https://carstock.example.com/y.jpg" },
  ]);
  await upsertVehicleFromStock(updateItem!);

  const vehicleAfterUpdate = await prisma.vehicle.findUnique({
    where: { externalCarId: EXTERNAL_ID },
    include: { images: true },
  });
  assert.equal(vehicleAfterUpdate!.images.length, 0, "image_url must never populate VehicleImage rows");
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

  assert.equal(result.createdCount, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.log.status, "SUCCESS");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.ok(vehicle);
  assert.equal(Number(vehicle!.monthlyPrice), 289.9);
  assert.equal(vehicle!.discountType, "SEASONAL");
});
