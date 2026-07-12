import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPublicFilterWhere } from "@/server/services/vehicle.service";
import { vehicleFilterSchema } from "@/lib/validators/vehicle.schema";

// Proves the /vehicles query builder is genuinely dynamic for every
// database-derived enumerated filter family (maker, fuel, transmissionType,
// color, typeOfCar): a value that has never been seen in the local sample
// database — and has no entry in any presentation-metadata resolver —
// still reaches Prisma as a plain field value. There is no component-level
// or query-level allowlist that could reject it.
const SYNTHETIC = {
  maker: "Aether Motors",
  fuel: "Hydrogen-X",
  transmissionType: "Adaptive-DCT-X",
  color: "Ultraviolet Pearl X",
  typeOfCar: "Urban-Crossover-X",
};

test("buildPublicFilterWhere: synthetic unseen maker reaches the query as-is", () => {
  const filters = vehicleFilterSchema.parse({ maker: SYNTHETIC.maker });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.maker, { in: [SYNTHETIC.maker], mode: "insensitive" });
});

test("buildPublicFilterWhere: synthetic unseen fuel reaches the query as-is", () => {
  const filters = vehicleFilterSchema.parse({ fuel: SYNTHETIC.fuel });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.fuel, { in: [SYNTHETIC.fuel], mode: "insensitive" });
});

test("buildPublicFilterWhere: synthetic unseen transmission reaches the query as-is", () => {
  const filters = vehicleFilterSchema.parse({ transmissionType: SYNTHETIC.transmissionType });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.transmissionType, { in: [SYNTHETIC.transmissionType], mode: "insensitive" });
});

test("buildPublicFilterWhere: synthetic unseen color reaches the query as-is", () => {
  const filters = vehicleFilterSchema.parse({ color: SYNTHETIC.color });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.color, { in: [SYNTHETIC.color], mode: "insensitive" });
});

test("buildPublicFilterWhere: synthetic unseen vehicle type reaches the query as-is", () => {
  const filters = vehicleFilterSchema.parse({ typeOfCar: SYNTHETIC.typeOfCar });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.typeOfCar, { in: [SYNTHETIC.typeOfCar], mode: "insensitive" });
});

test("buildPublicFilterWhere: multiple comma-separated values (known + synthetic) all reach the query", () => {
  const filters = vehicleFilterSchema.parse({ maker: `BMW,${SYNTHETIC.maker}`, fuel: `Hybrid,${SYNTHETIC.fuel}` });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.maker, { in: ["BMW", SYNTHETIC.maker], mode: "insensitive" });
  assert.deepEqual(where.fuel, { in: ["Hybrid", SYNTHETIC.fuel], mode: "insensitive" });
});

test("buildPublicFilterWhere: Deals uses the real canonical `offer` boolean field", () => {
  const filters = vehicleFilterSchema.parse({ offerOnly: "true" });
  const where = buildPublicFilterWhere(filters);
  assert.equal(where.offer, true);
});

test("buildPublicFilterWhere: offerOnly absent does not constrain `offer`", () => {
  const filters = vehicleFilterSchema.parse({});
  const where = buildPublicFilterWhere(filters);
  assert.equal(where.offer, undefined);
});

test("buildPublicFilterWhere: price is clamped into the centralized [0, 50000] range", () => {
  const filters = vehicleFilterSchema.parse({ priceMin: "-500", priceMax: "999999" });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.price, { gte: 0, lte: 50_000 });
});

test("buildPublicFilterWhere: an off-grid mileage value (not a dropdown step) is honored literally, not clamped", () => {
  const filters = vehicleFilterSchema.parse({ kmMin: "15000" });
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where.km, { gte: 15000 });
});

test("buildPublicFilterWhere: no filters produces only the base public scope", () => {
  const filters = vehicleFilterSchema.parse({});
  const where = buildPublicFilterWhere(filters);
  assert.deepEqual(where, { froze: false, isDeleted: false });
});
