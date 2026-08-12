import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/integrations/carstock/cars-delete/route";
import { addVehicleImage } from "@/server/services/vehicle.service";
import { prisma } from "@/lib/prisma";

const TEST_TOKEN = "test-carstock-delete-token";

function withApiKey(t: TestContext) {
  const original = process.env.CARSTOCK_API_KEY;
  process.env.CARSTOCK_API_KEY = TEST_TOKEN;
  t.after(() => {
    if (original === undefined) delete process.env.CARSTOCK_API_KEY;
    else process.env.CARSTOCK_API_KEY = original;
  });
}

function buildRequest(body: unknown, token: string = TEST_TOKEN): NextRequest {
  const headers = new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` });
  return new NextRequest("http://localhost/api/integrations/carstock/cars-delete", {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });
}

// Deliberately a separate helper (not `buildRequest(body, undefined)`) — a
// default parameter is substituted even when the caller explicitly passes
// `undefined`, which would silently defeat a "missing Authorization header"
// test by always sending TEST_TOKEN anyway.
function buildRequestWithoutAuth(body: unknown): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  return new NextRequest("http://localhost/api/integrations/carstock/cars-delete", {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });
}

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

async function seedVehicle(externalCarId: string, overrides: Record<string, unknown> = {}) {
  return prisma.vehicle.create({
    data: {
      externalCarId,
      slug: `carstock-delete-fixture-${externalCarId}`,
      maker: "BMW",
      model: "X1",
      versionName: "sDrive18i",
      vin: `VIN-${externalCarId}`,
      ...overrides,
    },
  });
}

// ---------- Auth ----------

test("DELETE: invalid token returns 401 and the safe {ok:false, deleted:0} shape", async (t) => {
  withApiKey(t);
  const response = await DELETE(buildRequest([123], "wrong-token"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, deleted: 0 });
});

test("DELETE: missing Authorization header returns 401", async (t) => {
  withApiKey(t);
  const response = await DELETE(buildRequestWithoutAuth([123]));
  assert.equal(response.status, 401);
});

// ---------- Request contract ----------

test("DELETE: accepts a collection containing one carId", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-one-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await DELETE(buildRequest([carId]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 1 });
});

test("DELETE: accepts multiple carIds in one bare array", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carIdA = "carstock-delete-multi-a";
  const carIdB = "carstock-delete-multi-b";
  t.after(async () => {
    await cleanupVehicle(carIdA);
    await cleanupVehicle(carIdB);
  });
  await cleanupVehicle(carIdA);
  await cleanupVehicle(carIdB);
  await seedVehicle(carIdA);
  await seedVehicle(carIdB);

  const response = await DELETE(buildRequest([carIdA, carIdB]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 2 });

  const a = await prisma.vehicle.findUnique({ where: { externalCarId: carIdA } });
  const b = await prisma.vehicle.findUnique({ where: { externalCarId: carIdB } });
  assert.equal(a!.isDeleted, true);
  assert.equal(b!.isDeleted, true);
});

test("DELETE: also accepts the { carIds: [...] } wrapper shape", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-wrapper-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await DELETE(buildRequest({ carIds: [carId] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 1 });
});

test("DELETE: rejects an empty request body", async (t) => {
  withApiKey(t);
  const response = await DELETE(buildRequest([]));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, deleted: 0 });
});

// ---------- Soft delete semantics ----------

test("DELETE: sets only isDeleted=true; the Vehicle row stays physically present", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-soft-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId, { price: 12345, color: "Red" });

  await DELETE(buildRequest([carId]));

  const after = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
  assert.ok(after, "the row must still physically exist");
  assert.equal(after!.isDeleted, true);
  assert.equal(Number(after!.price), 12345, "no other field must change");
  assert.equal(after!.color, "Red");
});

test("DELETE: leaves VehicleExtra rows physically present", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-extras-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await prisma.vehicleExtra.create({ data: { vehicleId: vehicle.id, displayName: "Navigation" } });

  await DELETE(buildRequest([carId]));

  const extras = await prisma.vehicleExtra.findMany({ where: { vehicleId: vehicle.id } });
  assert.equal(extras.length, 1);
});

test("DELETE: leaves VehicleImage rows physically present", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-images-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await addVehicleImage(vehicle.id, "https://example.com/photo.jpg", { isMain: true });

  await DELETE(buildRequest([carId]));

  const images = await prisma.vehicleImage.findMany({ where: { vehicleId: vehicle.id } });
  assert.equal(images.length, 1);
});

// ---------- Idempotency / unknown ids ----------

test("DELETE: is idempotent — deleting the same carId twice only counts the first time", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-idempotent-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const first = await DELETE(buildRequest([carId]));
  assert.deepEqual(await first.json(), { ok: true, deleted: 1 });

  const second = await DELETE(buildRequest([carId]));
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { ok: true, deleted: 0 }, "resending an already-deleted carId must not fail or double-count");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true);
});

test("DELETE: an unknown carId does not create anything and does not error", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const unknownCarId = "carstock-delete-unknown-999999";
  t.after(() => cleanupVehicle(unknownCarId));

  const response = await DELETE(buildRequest([unknownCarId]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 0 });

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: unknownCarId } });
  assert.equal(vehicle, null, "an unknown carId must never create a vehicle");
});

test("DELETE: duplicate carIds in the same request are deduplicated, not double-counted", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-dedupe-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await DELETE(buildRequest([carId, carId, carId]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 1 });
});

// ---------- Never VIN-based ----------

test("DELETE: never matches by VIN — sending a VIN as the carId is just an unknown id", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-vin-safety-1";
  const vin = "VIN-SHOULD-NOT-MATCH";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId, { vin });

  const response = await DELETE(buildRequest([vin]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 0 });

  const untouched = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
  assert.equal(untouched!.isDeleted, false, "the VIN must never be usable as a delete lookup key");
});
