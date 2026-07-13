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

  const response = await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla" }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 1 });
});

test("update an existing vehicle: returns {ok:true, added:0}", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-update-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla", km: 10000 }]));

  const response = await POST(buildRequest([{ carId, km: 20000 }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 0 });
});

test("freeze an existing vehicle: returns {ok:true, added:0}", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-freeze-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla" }]));

  const response = await POST(buildRequest([{ carId, froze: true }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 0 });
});

test("delete an existing vehicle: returns {ok:true, added:0}", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;

  const carId = "carstock-route-delete-1";
  t.after(async () => {
    await cleanupVehicle(carId);
    await cleanupImportLogsForCarId(carId);
  });
  await cleanupVehicle(carId);

  await POST(buildRequest([{ carId, maker: "Toyota", model: "Corolla" }]));

  const response = await POST(buildRequest([{ carId, delete: true }]));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 0 });
});

test("mixed create/update payload: added counts only the newly created vehicle", async (t) => {
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

  await POST(buildRequest([{ carId: existingCarId, maker: "Toyota", model: "Corolla" }]));

  const response = await POST(
    buildRequest([
      { carId: existingCarId, km: 15000 },
      { carId: newCarId, maker: "BMW", model: "320d" },
    ]),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, added: 1 });
});
