import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/integrations/carstock/cars-updated/route";
import { prisma } from "@/lib/prisma";

// All three CarStock write endpoints now share ONE common per-vehicle batch
// response envelope (see src/lib/carstock-response.ts) — these tests pin
// that exact contract at the HTTP boundary for POST /cars-updated:
// {ok, total, added, updated, deleted, skipped, failed, results[]}, where
// `results[]` is the per-carId source of truth and the five counters/`ok`
// are only a derived summary.

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

/** Every counter must be internally consistent with `results[]` — never asserted independently. */
function assertEnvelopeInvariants(json: Record<string, unknown>) {
  const results = json.results as Array<{ success: boolean }>;
  assert.equal(json.total, results.length, "total must equal results.length");
  assert.equal(json.ok, json.failed === 0, "ok must be exactly failed===0");
  assert.equal(
    (json.added as number) + (json.updated as number) + (json.skipped as number) + (json.failed as number),
    json.total,
    "added+updated+skipped+failed must equal total for POST /cars-updated (deleted is always 0)",
  );
  assert.equal(json.deleted, 0, "POST /cars-updated never deletes");
}

// ---------- Request-level failures (empty envelope) ----------

test("invalid token: returns 401 and the empty-failed envelope", async (t) => {
  withApiKey(t);

  const response = await POST(buildRequest([{ carId: "irrelevant" }], "wrong-token"));
  assert.equal(response.status, 401);
  assert.deepEqual(await readJson(response), {
    ok: false,
    total: 0,
    added: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    results: [],
  });
});

test("invalid payload: returns a non-2xx status and the empty-failed envelope", async (t) => {
  withApiKey(t);

  // Missing the required carId field.
  const response = await POST(buildRequest([{ maker: "Toyota" }]));
  assert.equal(response.status >= 400 && response.status < 500, true);
  assert.deepEqual(await readJson(response), {
    ok: false,
    total: 0,
    added: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    results: [],
  });
});

// ---------- Normal per-item processing ----------

test("create one new vehicle: added=1, results[0] = {success:true, action:created, error:null}", async (t) => {
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
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.total, 1);
  assert.equal(json.added, 1);
  assert.deepEqual(json.results, [{ carId, success: true, action: "created", error: null }]);
});

test("an existing carId is skipped, not updated: skipped=1, success=true, vehicle stays unchanged", async (t) => {
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
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.skipped, 1);
  assert.deepEqual(json.results, [{ carId, success: true, action: "skipped", error: null }]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.km, 10000, "POST is CREATE-only for active vehicles; a second push must never update it");
});

test("an existing carId with {carId, froze:true} is skipped, not frozen: skipped=1", async (t) => {
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
  const json = await readJson(response);
  assert.equal(json.ok, true);
  assert.equal(json.skipped, 1);

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
  const json = await readJson(response);
  assert.equal(json.ok, true);
  assert.equal(json.skipped, 1);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.ok(vehicle, "the vehicle must still exist");
  assert.equal(vehicle!.isDeleted, false, "the old {delete:true} flag must no longer soft-delete via POST");
});

test("batch of an existing carId + a new carId: added counts only the new one, results has both", async (t) => {
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
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.total, 2);
  assert.equal(json.added, 1);
  assert.equal(json.skipped, 1);
  assert.deepEqual(json.results, [
    { carId: existingCarId, success: true, action: "skipped", error: null },
    { carId: newCarId, success: true, action: "created", error: null },
  ]);

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
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.added, 2);

  const vehicleA = await prisma.vehicle.findUnique({ where: { externalCarId: carIdA } });
  const vehicleB = await prisma.vehicle.findUnique({ where: { externalCarId: carIdB } });
  assert.ok(vehicleA);
  assert.ok(vehicleB);
});

test("a carId repeated twice in one batch creates only one Vehicle: added:1, skipped:1, results has both occurrences", async (t) => {
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
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.total, 2, "both occurrences of the repeated carId must be individually represented");
  assert.equal(json.added, 1);
  assert.equal(json.skipped, 1);
  assert.deepEqual(json.results, [
    { carId, success: true, action: "created", error: null },
    { carId, success: true, action: "skipped", error: null },
  ]);

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
  const json = await readJson(response);
  assert.equal(json.ok, true);
  assert.equal(json.added, 1);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId }, include: { extras: true } });
  assert.ok(vehicle);
  assert.deepEqual(
    vehicle!.extras.map((e) => e.displayName).sort(),
    ["Heated seats", "Navigation"],
    "blank extras must be dropped and displayName trimmed",
  );
});

// ---------- RESTORE via the shared envelope ----------

test("a soft-deleted carId + complete payload restores via POST: updated=1, action=restored", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-restore-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  const completeItem = {
    carId,
    maker: "Toyota",
    model: "Corolla Route Restore Fixture",
    versionName: "1.8 Hybrid",
    price: 15000,
    rent: 250,
    yearRelease: 2021,
    vin: "ROUTERESTOREVIN01",
    km: 1000,
    cc: 1800,
    hp: 122,
    fuel: "Hybrid",
    color: "White",
    typeOfCar: "Sedan",
    transmissionType: "Automatic",
    ExtrasDTO: [{ displayName: "Navigation" }],
  };

  await POST(buildRequest([completeItem]));
  const softDeleteResponse = await import("@/app/api/integrations/carstock/cars-delete/route").then((m) =>
    m.POST(
      new NextRequest("http://localhost/api/integrations/carstock/cars-delete", {
        method: "POST",
        headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${TEST_TOKEN}` }),
        body: JSON.stringify({ carIds: [carId] }),
      }),
    ),
  );
  assert.equal(softDeleteResponse.status, 200);

  const response = await POST(buildRequest([{ ...completeItem, km: 55555 }]));
  assert.equal(response.status, 200);
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.updated, 1);
  assert.deepEqual(json.results, [{ carId, success: true, action: "restored", error: null }]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, false);
  assert.equal(vehicle!.km, 55555);
});

test("a soft-deleted carId + incomplete payload is restore_rejected: failed=1, ok=false, safe error text", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-restore-rejected-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla Route Restore Fixture", km: 500 }]));
  await import("@/app/api/integrations/carstock/cars-delete/route").then((m) =>
    m.POST(
      new NextRequest("http://localhost/api/integrations/carstock/cars-delete", {
        method: "POST",
        headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${TEST_TOKEN}` }),
        body: JSON.stringify({ carIds: [carId] }),
      }),
    ),
  );

  const response = await POST(buildRequest([{ carId, maker: "Toyota" }]));
  assert.equal(response.status, 200, "a per-item failure inside a valid batch is still HTTP 200");
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, false);
  assert.equal(json.failed, 1);
  assert.deepEqual(json.results, [
    { carId, success: false, action: "restore_rejected", error: "Complete vehicle payload is required for restore" },
  ]);

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: carId } });
  assert.equal(vehicle!.isDeleted, true, "an incomplete restore must never reactivate the vehicle");
  assert.equal(vehicle!.km, 500, "old data must remain untouched");
});

test("mixed batch (created + restored + skipped): ok=true", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const newCarId = "carstock-route-mixed-success-new";
  const restoreCarId = "carstock-route-mixed-success-restore";
  const skipCarId = "carstock-route-mixed-success-skip";
  t.after(async () => {
    for (const id of [newCarId, restoreCarId, skipCarId]) {
      await cleanupVehicle(id);
      await cleanupImportLogsForCarId(id);
    }
  });
  for (const id of [newCarId, restoreCarId, skipCarId]) await cleanupVehicle(id);

  const completeRestoreItem = {
    carId: restoreCarId,
    maker: "Toyota",
    model: "Corolla Mixed Success Fixture",
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
  };
  await POST(buildRequest([completeRestoreItem]));
  await import("@/app/api/integrations/carstock/cars-delete/route").then((m) =>
    m.POST(
      new NextRequest("http://localhost/api/integrations/carstock/cars-delete", {
        method: "POST",
        headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${TEST_TOKEN}` }),
        body: JSON.stringify({ carIds: [restoreCarId] }),
      }),
    ),
  );
  await POST(buildRequest([{ carId: skipCarId, maker: "BMW", model: "320d Mixed Success Skip Fixture" }]));

  const response = await POST(
    buildRequest([
      { carId: newCarId, maker: "BMW", model: "320d Mixed Success New Fixture" },
      completeRestoreItem,
      { carId: skipCarId, maker: "BMW", model: "320d Mixed Success Skip Fixture" },
    ]),
  );
  assert.equal(response.status, 200);
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, true);
  assert.equal(json.total, 3);
  assert.equal(json.added, 1);
  assert.equal(json.updated, 1);
  assert.equal(json.skipped, 1);
  assert.equal(json.failed, 0);
});

test("mixed batch (created + restored + skipped + restore_rejected): HTTP 200, ok=false, correct counters, all results represented", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const newCarId = "carstock-route-mixed-partial-new";
  const restoreCarId = "carstock-route-mixed-partial-restore";
  const skipCarId = "carstock-route-mixed-partial-skip";
  const rejectedCarId = "carstock-route-mixed-partial-rejected";
  t.after(async () => {
    for (const id of [newCarId, restoreCarId, skipCarId, rejectedCarId]) {
      await cleanupVehicle(id);
      await cleanupImportLogsForCarId(id);
    }
  });
  for (const id of [newCarId, restoreCarId, skipCarId, rejectedCarId]) await cleanupVehicle(id);

  const completeRestoreItem = {
    carId: restoreCarId,
    maker: "Toyota",
    model: "Corolla Mixed Partial Fixture",
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
  };
  const deleteCarIds = async (ids: string[]) =>
    import("@/app/api/integrations/carstock/cars-delete/route").then((m) =>
      m.POST(
        new NextRequest("http://localhost/api/integrations/carstock/cars-delete", {
          method: "POST",
          headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${TEST_TOKEN}` }),
          body: JSON.stringify({ carIds: ids }),
        }),
      ),
    );

  await POST(buildRequest([completeRestoreItem]));
  await deleteCarIds([restoreCarId]);
  await POST(buildRequest([{ carId: skipCarId, maker: "BMW", model: "320d Mixed Partial Skip Fixture" }]));
  await POST(buildRequest([{ carId: rejectedCarId, maker: "BMW", model: "320d Mixed Partial Rejected Fixture" }]));
  await deleteCarIds([rejectedCarId]);

  const response = await POST(
    buildRequest([
      { carId: newCarId, maker: "BMW", model: "320d Mixed Partial New Fixture" },
      completeRestoreItem,
      { carId: skipCarId, maker: "BMW", model: "320d Mixed Partial Skip Fixture" },
      { carId: rejectedCarId }, // incomplete -> restore_rejected
    ]),
  );
  assert.equal(response.status, 200, "a partially-failed but syntactically valid batch is still HTTP 200");
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, false);
  assert.equal(json.total, 4);
  assert.equal(json.added, 1);
  assert.equal(json.updated, 1);
  assert.equal(json.skipped, 1);
  assert.equal(json.failed, 1);
  assert.equal(json.results.length, 4);
  assert.deepEqual(
    json.results.map((r: { carId: string }) => r.carId),
    [newCarId, restoreCarId, skipCarId, rejectedCarId],
    "every requested carId must be represented, in request order",
  );

  // The successful items in the same batch must remain committed —
  // partial failure never triggers all-or-nothing rollback.
  const created = await prisma.vehicle.findUnique({ where: { externalCarId: newCarId } });
  assert.ok(created);
  const restored = await prisma.vehicle.findUnique({ where: { externalCarId: restoreCarId } });
  assert.equal(restored!.isDeleted, false);
});

// ---------- Unexpected per-item failure ----------

test("an unexpected per-item error is reported as action=failed with a safe error string, never leaking internals", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-unexpected-failure-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  const originalFindUnique = prisma.vehicle.findUnique.bind(prisma.vehicle);
  prisma.vehicle.findUnique = (async () => {
    throw new Error("simulated internal failure: postgresql://user:secret@internal-host:5432/db");
  }) as unknown as typeof prisma.vehicle.findUnique;

  let response;
  try {
    response = await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla Unexpected Failure Fixture" }]));
  } finally {
    prisma.vehicle.findUnique = originalFindUnique;
  }

  assert.equal(response.status, 200);
  const json = await readJson(response);
  assertEnvelopeInvariants(json);
  assert.equal(json.ok, false);
  assert.equal(json.failed, 1);
  assert.deepEqual(json.results, [{ carId, success: false, action: "failed", error: "Unable to process vehicle" }]);
  assert.doesNotMatch(JSON.stringify(json), /postgresql:\/\//, "no internal connection detail may leak into the response");
  assert.doesNotMatch(JSON.stringify(json), /secret/, "no internal detail may leak into the response");
});
