import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { normalizeYearRelease, normalizeVehiclePayload } from "@/lib/vehicle-normalization";
import { carStockItemSchema, carStockPayloadSchema } from "@/lib/validators/carstock.schema";
import { upsertVehicleFromStock } from "@/server/services/vehicle.service";
import { POST } from "@/app/api/integrations/carstock/cars-updated/route";
import { prisma } from "@/lib/prisma";

// The exact payload the real production CarStock system sent (2026-07-13
// used.kinsen.gr 403 investigation). yearRelease arrives as a US-style
// date-time string, not a bare year.
const PRODUCTION_PAYLOAD = {
  carId: 21429,
  maker: "Jeep",
  model: "Avenger 1.2 12v T3 MHEV Summit DCT Petrol & Electric Current",
  versionName: "Avenger 1.2 12v T3 MHEV Summit DCT Petrol & Electric Current",
  yearRelease: "2/22/2022 12:00:00 AM",
  price: 15200.0,
  km: 92987,
  cc: 1199.0,
  hp: 100.0,
  fuel: "Petrol-Hybrid",
  transmissionType: "A",
  color: "Black",
  offer: false,
  froze: false,
  delete: false,
  rent: 393.77,
  vin: "1C4NJCB34NPN46066",
};

test("normalizeYearRelease: bare year string", () => {
  assert.equal(normalizeYearRelease("2022"), 2022);
});

test("normalizeYearRelease: bare year number", () => {
  assert.equal(normalizeYearRelease(2022), 2022);
});

test("normalizeYearRelease: ISO date", () => {
  assert.equal(normalizeYearRelease("2022-02-22"), 2022);
});

test("normalizeYearRelease: ISO date-time with Z", () => {
  assert.equal(normalizeYearRelease("2022-02-22T00:00:00.000Z"), 2022);
});

test("normalizeYearRelease: US-style date-time (the real CarStock format)", () => {
  assert.equal(normalizeYearRelease("2/22/2022 12:00:00 AM"), 2022);
});

test("normalizeYearRelease: US-style date without time", () => {
  assert.equal(normalizeYearRelease("2/22/2022"), 2022);
});

test("normalizeYearRelease: two-digit month/day US-style", () => {
  assert.equal(normalizeYearRelease("12/31/2019 11:59:00 PM"), 2019);
});

test("normalizeYearRelease: null/undefined/empty all normalize to null", () => {
  assert.equal(normalizeYearRelease(null), null);
  assert.equal(normalizeYearRelease(undefined), null);
  assert.equal(normalizeYearRelease(""), null);
});

test("normalizeYearRelease: garbage input normalizes to null, not NaN", () => {
  assert.equal(normalizeYearRelease("not a date"), null);
});

test("production payload: carStockItemSchema accepts it and normalizeVehiclePayload resolves yearRelease to 2022", () => {
  const parsed = carStockItemSchema.parse(PRODUCTION_PAYLOAD);
  assert.equal(parsed.yearRelease, "2/22/2022 12:00:00 AM");

  const normalized = normalizeVehiclePayload(parsed);
  assert.equal(normalized.yearRelease, 2022);
  assert.equal(normalized.monthlyPrice, 393.77, "rent must map to monthlyPrice");
  assert.equal(normalized.vin, "1C4NJCB34NPN46066");
  assert.equal(normalized.versionName, PRODUCTION_PAYLOAD.versionName);
  assert.equal(normalized.km, 92987);
  assert.equal(normalized.cc, 1199);
  assert.equal(normalized.hp, 100);
  assert.equal(normalized.isDeleted, false);
  assert.equal(normalized.froze, false);
});

test("production payload: array wrapper accepts it as-is", () => {
  const parsed = carStockPayloadSchema.parse([PRODUCTION_PAYLOAD]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.carId, 21429);
});

async function skipIfDbUnreachable(t: TestContext): Promise<boolean> {
  try {
    await prisma.vehicle.count();
    return false;
  } catch {
    t.skip("DATABASE_URL not reachable in this environment");
    return true;
  }
}

const EXTERNAL_ID = "21429";

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

test("upsertVehicleFromStock: creates the vehicle from the exact production payload with yearRelease=2022", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => cleanupVehicle(EXTERNAL_ID));
  await cleanupVehicle(EXTERNAL_ID);

  const [item] = carStockPayloadSchema.parse([PRODUCTION_PAYLOAD]);
  const result = await upsertVehicleFromStock(item!);
  assert.equal(result.action, "created");

  const vehicle = await prisma.vehicle.findUnique({ where: { externalCarId: EXTERNAL_ID } });
  assert.ok(vehicle);
  assert.equal(vehicle!.yearRelease, 2022);
  assert.equal(vehicle!.maker, "Jeep");
  assert.equal(Number(vehicle!.monthlyPrice), 393.77);
  assert.equal(vehicle!.vin, "1C4NJCB34NPN46066");
});

const TEST_TOKEN = "test-carstock-prod-payload-token";

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

test("route: the exact production payload, with a valid Bearer token, returns {ok:true, added:1}", async (t) => {
  withApiKey(t);
  if (await skipIfDbUnreachable(t)) return;
  t.after(async () => {
    await cleanupVehicle(EXTERNAL_ID);
    await cleanupImportLogsForCarId(EXTERNAL_ID);
  });
  await cleanupVehicle(EXTERNAL_ID);

  const response = await POST(buildRequest([PRODUCTION_PAYLOAD]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, added: 1 });
});
