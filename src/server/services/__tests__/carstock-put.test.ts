import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/integrations/carstock/cars-update/route";
import { applyCarStockFullUpdate, addVehicleImage } from "@/server/services/vehicle.service";
import { carStockUpdatePayloadSchema } from "@/lib/validators/carstock.schema";
import { prisma } from "@/lib/prisma";

const TEST_TOKEN = "test-carstock-put-token";

function withApiKey(t: TestContext) {
  const original = process.env.CARSTOCK_API_KEY;
  process.env.CARSTOCK_API_KEY = TEST_TOKEN;
  t.after(() => {
    if (original === undefined) delete process.env.CARSTOCK_API_KEY;
    else process.env.CARSTOCK_API_KEY = original;
  });
}

// `token` has no default: a default parameter is substituted even when the
// caller explicitly passes `undefined`, which would silently defeat the
// "missing Authorization header" test below (it would always resolve to
// TEST_TOKEN instead of actually omitting the header). Every call site is
// explicit about which token (if any) it wants.
function buildRequest(body: unknown, token: string | undefined): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  return new NextRequest("http://localhost/api/integrations/carstock/cars-update", {
    method: "PUT",
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
  const slug = `carstock-put-fixture-${externalCarId}`;
  // model is per-carId, not a shared literal "X1": generateUniqueVehicleSlug
  // regenerates the slug from maker+model+year whenever maker/model/year
  // change, and if every seeded fixture in this file shared the same
  // maker+model, that regeneration would race different tests onto the
  // exact same slug base when the suite's test files run concurrently — a
  // real, reproducible unique-constraint failure observed while writing
  // these tests. Baking the carId into the model keeps every fixture's slug
  // base unique.
  return prisma.vehicle.create({
    data: {
      externalCarId,
      slug,
      maker: "BMW",
      model: `X1 ${externalCarId}`,
      versionName: "sDrive18i",
      price: 30000,
      monthlyPrice: 500,
      color: "Black",
      vin: "ABC",
      km: 10000,
      cc: 1499,
      hp: 136,
      fuel: "Βενζίνη",
      typeOfCar: "SUV",
      transmissionType: "Automatic",
      yearRelease: 2024,
      description: "Admin-written description",
      seoTitle: "Admin SEO title",
      seoDescription: "Admin SEO description",
      ...overrides,
    },
  });
}

// A COMPLETE, strictly-valid PUT wire item (every required key present) —
// the strict PUT contract requires every one of these keys on every item,
// so every test below starts from this and overrides only what it's
// actually testing, rather than re-typing all fifteen keys every time.
function completeItem(carId: string, overrides: Record<string, unknown> = {}) {
  return {
    carId,
    maker: "BMW",
    model: `X1 Updated ${carId}`,
    versionName: "sDrive20i",
    rent: 600,
    yearRelease: 2025,
    vin: "NEW-VIN",
    km: 5000,
    cc: 1998,
    hp: 190,
    fuel: "Πετρέλαιο",
    color: "White",
    typeOfCar: "SUV",
    transmissionType: "Automatic",
    price: 35000,
    ExtrasDTO: [] as unknown[],
    ...overrides,
  };
}

function parseUpdateItem(carId: string, overrides: Record<string, unknown> = {}) {
  return carStockUpdatePayloadSchema.parse([completeItem(carId, overrides)])[0]!;
}

/** Every counter must be internally consistent with `results[]` — never asserted independently. */
function assertEnvelopeInvariants(json: Record<string, unknown>) {
  const results = json.results as Array<{ success: boolean }>;
  assert.equal(json.total, results.length, "total must equal results.length");
  assert.equal(json.ok, json.failed === 0, "ok must be exactly failed===0");
  assert.equal(
    (json.updated as number) + (json.skipped as number) + (json.failed as number),
    json.total,
    "updated+skipped+failed must equal total for PUT /cars-update",
  );
  assert.equal(json.added, 0, "PUT never creates");
  assert.equal(json.deleted, 0, "PUT never deletes");
}

const EMPTY_FAILED_ENVELOPE = { ok: false, total: 0, added: 0, updated: 0, deleted: 0, skipped: 0, failed: 0, results: [] };

// ---------- Auth ----------

test("PUT: invalid token returns 401 and the empty-failed envelope", async (t) => {
  withApiKey(t);
  const response = await PUT(buildRequest([{ carId: "irrelevant" }], "wrong-token"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test("PUT: missing Authorization header returns 401", async (t) => {
  withApiKey(t);
  const response = await PUT(buildRequest([{ carId: "irrelevant" }], undefined));
  assert.equal(response.status, 401);
});

// ---------- Strict validation: required properties ----------

test("PUT validation: a complete valid payload succeeds", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-valid-complete-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await PUT(buildRequest([completeItem(carId)], TEST_TOKEN));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.updated, 1);
  assert.deepEqual(json.results, [{ carId, success: true, action: "updated", error: null }]);
});

test("PUT validation: missing maker is rejected with 400, DB untouched", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-missing-maker-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const payload = completeItem(carId) as Record<string, unknown>;
  delete payload.maker;

  const response = await PUT(buildRequest([payload], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.maker, "BMW", "the DB must be untouched by a rejected payload");
});

test("PUT validation: missing model is rejected with 400", async (t) => {
  withApiKey(t);
  const carId = "carstock-put-missing-model-1";
  const payload = completeItem(carId) as Record<string, unknown>;
  delete payload.model;

  const response = await PUT(buildRequest([payload], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test("PUT validation: missing versionName is rejected with 400", async (t) => {
  withApiKey(t);
  const carId = "carstock-put-missing-versionname-1";
  const payload = completeItem(carId) as Record<string, unknown>;
  delete payload.versionName;

  const response = await PUT(buildRequest([payload], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test("PUT validation: null maker is rejected with 400", async (t) => {
  withApiKey(t);
  const carId = "carstock-put-null-maker-1";
  const response = await PUT(buildRequest([completeItem(carId, { maker: null })], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test("PUT validation: blank (whitespace-only) maker is rejected with 400", async (t) => {
  withApiKey(t);
  const carId = "carstock-put-blank-maker-1";
  const response = await PUT(buildRequest([completeItem(carId, { maker: "   " })], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test("PUT validation: missing price property is rejected with 400", async (t) => {
  withApiKey(t);
  const carId = "carstock-put-missing-price-1";
  const payload = completeItem(carId) as Record<string, unknown>;
  delete payload.price;

  const response = await PUT(buildRequest([payload], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test('PUT validation: explicit "price": null succeeds and the DB price becomes null', async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-explicit-null-price-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId, { price: 30000 });

  const response = await PUT(buildRequest([completeItem(carId, { price: null })], TEST_TOKEN));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.deepEqual(json.results, [{ carId, success: true, action: "updated", error: null }]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.price, null);
});

test("PUT validation: missing vin property is rejected with 400", async (t) => {
  withApiKey(t);
  const carId = "carstock-put-missing-vin-1";
  const payload = completeItem(carId) as Record<string, unknown>;
  delete payload.vin;

  const response = await PUT(buildRequest([payload], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test('PUT validation: explicit "vin": null succeeds and the DB vin becomes null', async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-explicit-null-vin-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId, { vin: "OLD-VIN" });

  const response = await PUT(buildRequest([completeItem(carId, { vin: null })], TEST_TOKEN));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.deepEqual(json.results, [{ carId, success: true, action: "updated", error: null }]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.vin, null);
});

test("PUT validation: missing ExtrasDTO is rejected with 400", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-missing-extras-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await prisma.vehicleExtra.create({ data: { vehicleId: vehicle.id, displayName: "Navigation" } });

  const payload = completeItem(carId) as Record<string, unknown>;
  delete payload.ExtrasDTO;

  const response = await PUT(buildRequest([payload], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);

  const extras = await prisma.vehicleExtra.findMany({ where: { vehicleId: vehicle.id } });
  assert.equal(extras.length, 1, "a rejected payload must never delete extras");
});

test('PUT validation: "ExtrasDTO": [] succeeds and clears extras', async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-extras-empty-explicit-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await prisma.vehicleExtra.create({ data: { vehicleId: vehicle.id, displayName: "Navigation" } });

  const response = await PUT(buildRequest([completeItem(carId, { ExtrasDTO: [] })], TEST_TOKEN));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.deepEqual(json.results, [{ carId, success: true, action: "updated", error: null }]);

  const extras = await prisma.vehicleExtra.findMany({ where: { vehicleId: vehicle.id } });
  assert.equal(extras.length, 0);
});

test("PUT validation: an incomplete {carId} payload is rejected before any mutation, DB stays exactly as-is", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-incomplete-carid-only-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId, { price: 30000, color: "Black", vin: "ABC" });

  const response = await PUT(buildRequest([{ carId }], TEST_TOKEN));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(Number(vehicle!.price), 30000, "an incomplete payload must never null out DB values");
  assert.equal(vehicle!.color, "Black");
  assert.equal(vehicle!.vin, "ABC");
});

// ---------- Lookup: carId/externalCarId only, never VIN ----------

test("PUT: finds the vehicle by carId -> externalCarId", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-lookup-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await PUT(buildRequest([completeItem(carId, { price: 25000 })], TEST_TOKEN));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.deepEqual(json.results, [{ carId, success: true, action: "updated", error: null }]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(Number(vehicle!.price), 25000);
});

test("PUT: does not find (and does not update) a vehicle by VIN — reported as a FAILURE result (vehicle_not_found)", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const seededCarId = "carstock-put-vin-lookup-seed";
  const vin = "UNIQUE-VIN-LOOKUP-TEST";
  t.after(() => cleanupVehicle(seededCarId));
  await cleanupVehicle(seededCarId);
  await seedVehicle(seededCarId, { vin });

  // Sends the VIN as the payload's "carId" — must never resolve to the
  // vehicle above via VIN matching. It just won't be found (no vehicle has
  // externalCarId === vin), so this is a not-found update, not a match.
  const response = await PUT(buildRequest([completeItem(vin, { price: 1 })], TEST_TOKEN));
  assert.equal(response.status, 200, "a valid batch with a not-found item is still HTTP 200");
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, false, "vehicle_not_found is a FAILURE result, not a success");
  assert.equal(json.updated, 0);
  assert.equal(json.failed, 1);
  assert.deepEqual(json.results, [{ carId: vin, success: false, action: "vehicle_not_found", error: "Vehicle was not found" }]);

  const untouched = await prisma.vehicle.findUnique({ where: { externalCarId: seededCarId } });
  assert.equal(Number(untouched!.price), 30000, "the seeded vehicle must be untouched");
});

// ---------- PUT never creates ----------

test("PUT: does not create a vehicle for an unknown carId", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-no-create-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);

  const response = await PUT(buildRequest([completeItem(carId)], TEST_TOKEN));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, false);
  assert.equal(json.updated, 0);
  assert.equal(json.failed, 1);
  assert.deepEqual(json.results, [{ carId, success: false, action: "vehicle_not_found", error: "Vehicle was not found" }]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle, null);
});

// ---------- Multiple cars ----------

test("PUT: supports multiple cars in one request", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carIdA = "carstock-put-multi-a";
  const carIdB = "carstock-put-multi-b";
  t.after(async () => {
    await cleanupVehicle(carIdA);
    await cleanupVehicle(carIdB);
  });
  await cleanupVehicle(carIdA);
  await cleanupVehicle(carIdB);
  await seedVehicle(carIdA);
  await seedVehicle(carIdB);

  const response = await PUT(
    buildRequest(
      [completeItem(carIdA, { price: 11111 }), completeItem(carIdB, { price: 22222 })],
      TEST_TOKEN,
    ),
  );
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.total, 2);
  assert.equal(json.updated, 2);
  assert.deepEqual(json.results, [
    { carId: carIdA, success: true, action: "updated", error: null },
    { carId: carIdB, success: true, action: "updated", error: null },
  ]);

  const vehicleA = await prisma.vehicle.findUnique({ where: { externalCarId: carIdA } });
  const vehicleB = await prisma.vehicle.findUnique({ where: { externalCarId: carIdB } });
  assert.equal(Number(vehicleA!.price), 11111);
  assert.equal(Number(vehicleB!.price), 22222);
});

// ---------- VIN as ordinary data ----------

test("PUT: updates VIN as ordinary vehicle data", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-vin-data-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId, { vin: "OLD-VIN" });

  const result = await applyCarStockFullUpdate(parseUpdateItem(carId, { vin: "NEW-VIN-123" }));
  assert.equal(result.action, "updated");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.vin, "NEW-VIN-123");
});

// ---------- rent -> monthlyPrice, normalization reuse ----------

test("PUT: maps rent -> monthlyPrice and reuses existing normalization", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-normalization-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const item = parseUpdateItem(carId, {
    rent: 725.5,
    yearRelease: "2/22/2022 12:00:00 AM",
    fuel: "petrol",
    transmissionType: "automatic",
    color: "  red  ",
  });
  const result = await applyCarStockFullUpdate(item);
  assert.equal(result.action, "updated");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(Number(vehicle!.monthlyPrice), 725.5, "rent must map to monthlyPrice");
  assert.equal(vehicle!.yearRelease, 2022);
  assert.equal(vehicle!.fuel, "Βενζίνη");
  assert.equal(vehicle!.transmissionType, "Αυτόματο");
  assert.equal(vehicle!.color, "Red");
});

// ---------- maker/model/versionName: applied directly, never a stale fallback ----------

test("PUT: maker/model/versionName are updated from the supplied values", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-maker-model-version-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId, { maker: "BMW", model: "Old Model", versionName: "Old Version" });

  const item = parseUpdateItem(carId, { maker: "Audi", model: "A4 New", versionName: "40 TDI Quattro" });
  const result = await applyCarStockFullUpdate(item);
  assert.equal(result.action, "updated");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.maker, "Audi");
  assert.equal(vehicle!.model, "A4 New");
  assert.equal(vehicle!.versionName, "40 TDI Quattro");
});

// ---------- Full-replacement / null semantics (the core PUT contract) ----------

test("PUT: full replacement — explicit null CarStock fields become null, not left unchanged", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-full-replace-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId, { price: 30000, color: "Black", vin: "ABC" });

  const item = parseUpdateItem(carId, {
    price: null,
    color: null,
    vin: null,
    km: null,
    cc: null,
    hp: null,
    fuel: null,
    typeOfCar: null,
    transmissionType: null,
    yearRelease: null,
    rent: null,
  });
  const result = await applyCarStockFullUpdate(item);
  assert.equal(result.action, "updated");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.price, null);
  assert.equal(vehicle!.color, null);
  assert.equal(vehicle!.vin, null);
  assert.equal(vehicle!.km, null);
  assert.equal(vehicle!.cc, null);
  assert.equal(vehicle!.hp, null);
  assert.equal(vehicle!.fuel, null);
  assert.equal(vehicle!.typeOfCar, null);
  assert.equal(vehicle!.transmissionType, null);
  assert.equal(vehicle!.yearRelease, null);
  assert.equal(vehicle!.monthlyPrice, null, "explicit rent:null must also normalize to null");
});

// ---------- Extras: complete replacement ----------

test("PUT: ExtrasDTO fully replaces the previous extras collection", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-extras-replace-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await prisma.vehicleExtra.createMany({
    data: [
      { vehicleId: vehicle.id, displayName: "Navigation" },
      { vehicleId: vehicle.id, displayName: "Bluetooth" },
      { vehicleId: vehicle.id, displayName: "Heated seats" },
    ],
  });

  const response = await PUT(
    buildRequest(
      [completeItem(carId, { ExtrasDTO: [{ displayName: "Navigation" }, { displayName: "Panoramic roof" }] })],
      TEST_TOKEN,
    ),
  );
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.deepEqual(json.results, [{ carId, success: true, action: "updated", error: null }]);

  const extras = await prisma.vehicleExtra.findMany({ where: { vehicleId: vehicle.id } });
  assert.deepEqual(extras.map((e) => e.displayName).sort(), ["Navigation", "Panoramic roof"]);
});

// ---------- Isolation: images, SEO/admin fields ----------

test("PUT: does not modify VehicleImage rows", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-image-isolation-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await addVehicleImage(vehicle.id, "https://example.com/photo.jpg", { isMain: true });

  await applyCarStockFullUpdate(parseUpdateItem(carId, { price: 12345 }));

  const images = await prisma.vehicleImage.findMany({ where: { vehicleId: vehicle.id } });
  assert.equal(images.length, 1);
  assert.equal(images[0]!.url, "https://example.com/photo.jpg");
});

test("PUT: does not modify description/SEO admin-managed fields", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-admin-isolation-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  await applyCarStockFullUpdate(parseUpdateItem(carId, { price: 999 }));

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.description, "Admin-written description");
  assert.equal(vehicle!.seoTitle, "Admin SEO title");
  assert.equal(vehicle!.seoDescription, "Admin SEO description");
});

// ---------- Transactional safety ----------

test("PUT: scalar update and extras replacement are transactional (both land, or observed consistently)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-put-transactional-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId, { price: 30000 });
  await prisma.vehicleExtra.createMany({ data: [{ vehicleId: vehicle.id, displayName: "Navigation" }] });

  const item = parseUpdateItem(carId, { price: 40000, ExtrasDTO: [{ displayName: "Panoramic roof" }] });
  await applyCarStockFullUpdate(item);

  const updated = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.equal(Number(updated!.price), 40000);
  assert.deepEqual(updated!.extras.map((e) => e.displayName), ["Panoramic roof"]);
});

// ---------- Mixed batch: success + vehicle_not_found ----------

test("PUT: mixed batch (successful update + vehicle_not_found): HTTP 200, ok=false, the successful update stays applied, complete results returned", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const foundCarId = "carstock-put-mixed-found-1";
  const missingCarId = "carstock-put-mixed-missing-1";
  t.after(() => cleanupVehicle(foundCarId));
  await cleanupVehicle(foundCarId);
  await seedVehicle(foundCarId);

  const response = await PUT(
    buildRequest([completeItem(foundCarId, { price: 42000 }), completeItem(missingCarId)], TEST_TOKEN),
  );
  assert.equal(response.status, 200, "a per-item not-found inside a valid batch is still HTTP 200");
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, false);
  assert.equal(json.total, 2);
  assert.equal(json.updated, 1);
  assert.equal(json.failed, 1);
  assert.deepEqual(json.results, [
    { carId: foundCarId, success: true, action: "updated", error: null },
    { carId: missingCarId, success: false, action: "vehicle_not_found", error: "Vehicle was not found" },
  ]);

  const updated = await prisma.vehicle.findUnique({ where: { externalCarId: foundCarId } });
  assert.equal(Number(updated!.price), 42000, "the successful update in the same batch must remain committed");
});
