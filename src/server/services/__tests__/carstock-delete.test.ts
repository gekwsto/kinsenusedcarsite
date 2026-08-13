import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/integrations/carstock/cars-delete/route";
import { addVehicleImage } from "@/server/services/vehicle.service";
import { prisma } from "@/lib/prisma";

// The canonical endpoint is now POST, not HTTP DELETE — the external
// CMS/client has unreliable support for a JSON body on a DELETE request.
// The operation itself is unchanged: a pure, idempotent soft delete.
//
// All three CarStock write endpoints now share ONE common per-vehicle batch
// response envelope (see src/lib/carstock-response.ts):
// {ok, total, added, updated, deleted, skipped, failed, results[]}. For
// DELETE specifically: `deleted` (newly soft-deleted), `already_deleted`,
// and `not_found` are all SUCCESS results — an unknown/absent carId already
// satisfies the CMS-desired end state ("this carId is not active"), so it
// is never a failure.

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
    method: "POST",
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
    method: "POST",
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

const EMPTY_FAILED_ENVELOPE = { ok: false, total: 0, added: 0, updated: 0, deleted: 0, skipped: 0, failed: 0, results: [] };

/** Every counter must be internally consistent with `results[]` — never asserted independently. */
function assertEnvelopeInvariants(json: Record<string, unknown>) {
  const results = json.results as Array<{ success: boolean }>;
  assert.equal(json.total, results.length, "total must equal results.length");
  assert.equal(json.ok, json.failed === 0, "ok must be exactly failed===0");
  assert.equal(
    (json.deleted as number) + (json.skipped as number) + (json.failed as number),
    json.total,
    "deleted+skipped+failed must equal total for POST /cars-delete",
  );
  assert.equal(json.added, 0, "POST /cars-delete never creates");
  assert.equal(json.updated, 0, "POST /cars-delete never updates");
}

// ---------- Auth ----------

test("POST /cars-delete: invalid token returns 401 and the empty-failed envelope", async (t) => {
  withApiKey(t);
  const response = await POST(buildRequest([123], "wrong-token"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test("POST /cars-delete: missing Authorization header returns 401", async (t) => {
  withApiKey(t);
  const response = await POST(buildRequestWithoutAuth([123]));
  assert.equal(response.status, 401);
});

// ---------- Request contract ----------

test("POST /cars-delete: accepts a collection containing one carId", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-one-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await POST(buildRequest([carId]));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.deleted, 1);
  assert.deepEqual(json.results, [{ carId, success: true, action: "deleted", error: null }]);
});

test("POST /cars-delete: accepts multiple carIds in one bare array", async (t) => {
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

  const response = await POST(buildRequest([carIdA, carIdB]));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.deleted, 2);
  assert.deepEqual(json.results, [
    { carId: carIdA, success: true, action: "deleted", error: null },
    { carId: carIdB, success: true, action: "deleted", error: null },
  ]);

  const a = await prisma.vehicle.findUnique({ where: { externalCarId: carIdA } });
  const b = await prisma.vehicle.findUnique({ where: { externalCarId: carIdB } });
  assert.equal(a!.isDeleted, true);
  assert.equal(b!.isDeleted, true);
});

test("POST /cars-delete: also accepts the { carIds: [...] } wrapper shape", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-wrapper-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await POST(buildRequest({ carIds: [carId] }));
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.deleted, 1);
});

test("POST /cars-delete: rejects an empty request body", async (t) => {
  withApiKey(t);
  const response = await POST(buildRequest([]));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

test("POST /cars-delete: numeric carIds work", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "918273";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await POST(buildRequest([918273]));
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.deleted, 1);
  assert.deepEqual(json.results, [{ carId: 918273, success: true, action: "deleted", error: null }]);
});

test("POST /cars-delete: valid non-empty string carIds work", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-string-id-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await POST(buildRequest({ carIds: [carId] }));
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.deleted, 1);
});

test("POST /cars-delete: a blank string carId rejects with 400", async (t) => {
  withApiKey(t);
  const response = await POST(buildRequest(["   "]));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), EMPTY_FAILED_ENVELOPE);
});

// ---------- Soft delete semantics ----------

test("POST /cars-delete: sets only isDeleted=true; the Vehicle row stays physically present", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-soft-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId, { price: 12345, color: "Red" });

  await POST(buildRequest([carId]));

  const after = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
  assert.ok(after, "the row must still physically exist");
  assert.equal(after!.isDeleted, true);
  assert.equal(Number(after!.price), 12345, "no other field must change");
  assert.equal(after!.color, "Red");
});

test("POST /cars-delete: leaves VehicleExtra rows physically present", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-extras-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await prisma.vehicleExtra.create({ data: { vehicleId: vehicle.id, displayName: "Navigation" } });

  await POST(buildRequest([carId]));

  const extras = await prisma.vehicleExtra.findMany({ where: { vehicleId: vehicle.id } });
  assert.equal(extras.length, 1);
});

test("POST /cars-delete: leaves VehicleImage rows physically present", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-images-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId);
  await addVehicleImage(vehicle.id, "https://example.com/photo.jpg", { isMain: true });

  await POST(buildRequest([carId]));

  const images = await prisma.vehicleImage.findMany({ where: { vehicleId: vehicle.id } });
  assert.equal(images.length, 1);
});

// ---------- Idempotency / unknown ids (all SUCCESS results) ----------

test("POST /cars-delete: is idempotent — the second call reports already_deleted (still success)", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-idempotent-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const first = await POST(buildRequest([carId]));
  const firstJson = await first.json();
  assert.equal(firstJson.ok, true);
  assert.deepEqual(firstJson.results, [{ carId, success: true, action: "deleted", error: null }]);

  const second = await POST(buildRequest([carId]));
  assert.equal(second.status, 200);
  const secondJson = await second.json();
  assertEnvelopeInvariants(secondJson);
  assert.equal(secondJson.ok, true, "already_deleted is still a SUCCESS result");
  assert.equal(secondJson.deleted, 0);
  assert.equal(secondJson.skipped, 1);
  assert.deepEqual(
    secondJson.results,
    [{ carId, success: true, action: "already_deleted", error: null }],
    "resending an already-deleted carId must not fail or double-count as newly deleted",
  );

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true);
});

test("POST /cars-delete: an unknown carId is a SUCCESS result (action=not_found) and creates nothing", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const unknownCarId = "carstock-delete-unknown-999999";
  t.after(() => cleanupVehicle(unknownCarId));

  const response = await POST(buildRequest([unknownCarId]));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true, "an unknown carId already satisfies the desired end state — it is success, not failure");
  assert.equal(json.deleted, 0);
  assert.equal(json.skipped, 1);
  assert.deepEqual(json.results, [{ carId: unknownCarId, success: true, action: "not_found", error: null }]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: unknownCarId } });
  assert.equal(vehicle, null, "an unknown carId must never create a vehicle");
});

test("POST /cars-delete: duplicate carIds in the same request collapse to a single result, not double-counted", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-dedupe-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const response = await POST(buildRequest([carId, carId, carId]));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.total, 1, "a carId repeated 3x collapses to one result, matching this endpoint's existing dedup semantics");
  assert.equal(json.deleted, 1);
  assert.deepEqual(json.results, [{ carId, success: true, action: "deleted", error: null }]);
});

// ---------- Mixed batch: deleted + already_deleted + not_found ----------

test("mixed batch (deleted + already_deleted + not_found): ok=true, failed=0, every carId represented", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const activeCarId = "carstock-delete-mixed-active-1";
  const alreadyDeletedCarId = "carstock-delete-mixed-already-1";
  const unknownCarId = "carstock-delete-mixed-unknown-1";
  t.after(async () => {
    await cleanupVehicle(activeCarId);
    await cleanupVehicle(alreadyDeletedCarId);
    await cleanupVehicle(unknownCarId);
  });
  await cleanupVehicle(activeCarId);
  await cleanupVehicle(alreadyDeletedCarId);
  await cleanupVehicle(unknownCarId);
  await seedVehicle(activeCarId);
  await seedVehicle(alreadyDeletedCarId, { isDeleted: true });

  const response = await POST(buildRequest([activeCarId, alreadyDeletedCarId, unknownCarId]));
  assert.equal(response.status, 200);
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.total, 3);
  assert.equal(json.deleted, 1);
  assert.equal(json.skipped, 2);
  assert.equal(json.failed, 0);
  assert.deepEqual(json.results, [
    { carId: activeCarId, success: true, action: "deleted", error: null },
    { carId: alreadyDeletedCarId, success: true, action: "already_deleted", error: null },
    { carId: unknownCarId, success: true, action: "not_found", error: null },
  ]);
});

// ---------- Genuine per-item/database failure ----------

test("a genuine DB failure is reported as action=failed for every requested carId, never a raw internal error", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-db-failure-1";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  await seedVehicle(carId);

  const originalFindMany = prisma.vehicle.findMany.bind(prisma.vehicle);
  prisma.vehicle.findMany = (async () => {
    throw new Error("simulated internal failure: postgresql://user:secret@internal-host:5432/db");
  }) as typeof prisma.vehicle.findMany;

  let response;
  try {
    response = await POST(buildRequest([carId]));
  } finally {
    prisma.vehicle.findMany = originalFindMany;
  }

  assert.equal(response.status, 200, "a genuine per-item DB failure is still HTTP 200 for a syntactically valid batch");
  const json = await response.json();
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, false);
  assert.equal(json.failed, 1);
  assert.deepEqual(json.results, [{ carId, success: false, action: "failed", error: "Unable to remove vehicle" }]);
  assert.doesNotMatch(JSON.stringify(json), /postgresql:\/\//, "no internal connection detail may leak into the response");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, false, "a failed operation must never leave the vehicle mutated");
});

// ---------- Never VIN-based ----------

test("POST /cars-delete: never matches by VIN — sending a VIN as the carId is just not_found", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-delete-vin-safety-1";
  const vin = "VIN-SHOULD-NOT-MATCH";
  t.after(() => cleanupVehicle(carId));
  await cleanupVehicle(carId);
  const vehicle = await seedVehicle(carId, { vin });

  const response = await POST(buildRequest([vin]));
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.ok, true);
  assert.deepEqual(json.results, [{ carId: vin, success: true, action: "not_found", error: null }]);

  const untouched = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
  assert.equal(untouched!.isDeleted, false, "the VIN must never be usable as a delete lookup key");
});
