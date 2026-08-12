import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/integrations/carstock/cars-updated/route";
import { prisma } from "@/lib/prisma";

// The real CarStock client only ever understands `{ ok, added }`
// (CreateUmbraccoCarsRoot) — these tests pin that exact contract at the
// HTTP boundary, independent of whatever internal shape
// processCarStockPayload happens to return.

const TEST_TOKEN = "test-carstock-route-token";

function withApiKey(t: TestContext) {
  const original = process.env.CARSTOCK_API_KEY;
  process.env.CARSTOCK_API_KEY = TEST_TOKEN;
  t.after(() => {
    if (original === undefined) delete process.env.CARSTOCK_API_KEY;
    else process.env.CARSTOCK_API_KEY = original;
  });
}

function buildRequest(body: unknown, token: string | undefined = TEST_TOKEN): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  return new NextRequest("http://localhost/api/integrations/carstock/cars-updated", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return response.json();
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

test("invalid token: returns 401 and the safe {ok:false, added:0} shape", async (t) => {
  withApiKey(t);

  const response = await POST(buildRequest([{ carId: "irrelevant" }], "wrong-token"));
  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), { ok: false, added: 0 });
});

test("invalid payload: returns a non-2xx status and the safe {ok:false, added:0} shape", async (t) => {
  withApiKey(t);

  // Missing the required carId field.
  const response = await POST(buildRequest([{ maker: "Toyota" }]));
  assert.equal(response.status >= 400 && response.status < 500, true);
  assert.deepEqual(await readJson(response), { ok: false, added: 0 });
});

test("create one new vehicle: returns {ok:true, added:1}", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-create-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  const response = await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla Route Fixture" }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 1 });
});

test("an existing carId is skipped, not updated: returns {ok:true, added:0} and the vehicle stays unchanged", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-update-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla Route Fixture", km: 10000 }]));

  const response = await POST(buildRequest([{ carId, km: 20000 }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 0 });

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.km, 10000, "POST is CREATE-only; a second push for the same carId must never update it");
});

test("an existing carId with {carId, froze:true} is skipped, not frozen: returns {ok:true, added:0}", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-freeze-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla Route Fixture" }]));

  const response = await POST(buildRequest([{ carId, froze: true }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 0 });

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.froze, false, "the old {carId, froze} partial update is no longer performed by POST");
});

test("POST no longer honors the old delete flag: vehicle stays isDeleted:false", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-delete-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla Route Fixture" }]));

  const response = await POST(buildRequest([{ carId, delete: true }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 0 });

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.ok(vehicle, "the vehicle must still exist");
  assert.equal(vehicle!.isDeleted, false, "the old {delete:true} flag must no longer soft-delete via POST");
});

test("batch of an existing carId + a new carId: added counts only the newly created vehicle, existing stays untouched", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const existingCarId = "carstock-route-mixed-existing";
  const newCarId = "carstock-route-mixed-new";
  t.after(async () => {
    await cleanupVehicle(existingCarId);
    await cleanupVehicle(newCarId);
    await cleanupImportLogsForCarId(existingCarId);
    await cleanupImportLogsForCarId(newCarId);
  });
  await cleanupVehicle(existingCarId);
  await cleanupVehicle(newCarId);

  await POST(buildRequest([{ carId: existingCarId, maker: "Toyota", model: "Corolla Route Fixture" }]));

  const response = await POST(
    buildRequest([
      { carId: existingCarId, km: 15000 },
      { carId: newCarId, maker: "BMW", model: "320d Batch Mixed Fixture" },
    ]),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 1 });

  const existing = await prisma.vehicle.findUnique({ where: { externalCarId: existingCarId } });
  assert.equal(existing!.km, null, "the existing vehicle must remain untouched, not receive km:15000");
});

test("multiple new carIds in one batch create multiple Vehicles: added:2", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carIdA = "carstock-route-multi-new-a";
  const carIdB = "carstock-route-multi-new-b";
  t.after(async () => {
    await cleanupVehicle(carIdA);
    await cleanupVehicle(carIdB);
    await cleanupImportLogsForCarId(carIdA);
    await cleanupImportLogsForCarId(carIdB);
  });
  await cleanupVehicle(carIdA);
  await cleanupVehicle(carIdB);

  const response = await POST(
    buildRequest([
      { carId: carIdA, maker: "Toyota", model: "Corolla Multi New Fixture A" },
      { carId: carIdB, maker: "BMW", model: "320d Multi New Fixture B" },
    ]),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 2 });

  const vehicleA = await prisma.vehicle.findUnique({ where: { externalCarId: carIdA } });
  const vehicleB = await prisma.vehicle.findUnique({ where: { externalCarId: carIdB } });
  assert.ok(vehicleA);
  assert.ok(vehicleB);
});

test("a carId repeated twice in one batch creates only one Vehicle: added:1", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-intra-batch-dup";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  const response = await POST(
    buildRequest([
      { carId, maker: "BMW", model: "320d Dup Route A" },
      { carId, maker: "BMW", model: "320d Dup Route B" },
    ]),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 1 });

  const vehicles = await prisma.vehicle.findMany({ where: { externalCarId: carId } });
  assert.equal(vehicles.length, 1);
});

test("POST persists ExtrasDTO as VehicleExtra rows on create", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-extras-create-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  const response = await POST(
    buildRequest([
      {
        carId,
        maker: "BMW",
        model: "X1 Extras Route Fixture",
        ExtrasDTO: [{ displayName: "Navigation" }, { displayName: "  Heated seats  " }, { displayName: "   " }],
      },
    ]),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 1 });

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.ok(vehicle);
  assert.deepEqual(
    vehicle!.extras.map((e) => e.displayName).sort(),
    ["Heated seats", "Navigation"],
    "blank extras must be dropped and displayName trimmed",
  );
});
