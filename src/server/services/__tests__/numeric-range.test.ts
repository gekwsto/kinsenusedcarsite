import { test } from "node:test";
import assert from "node:assert/strict";
import { createNumericRange } from "@/lib/numeric-range";
import { VEHICLE_FILTER_RANGES } from "@/lib/validators/vehicle.schema";

test("createNumericRange: includes both the minimum and maximum bounds", () => {
  const values = createNumericRange(2010, 2026, 1);
  assert.equal(values[0], 2010);
  assert.equal(values[values.length - 1], 2026);
});

test("createNumericRange: produces the exact expected count for the centralized year range", () => {
  const values = createNumericRange(VEHICLE_FILTER_RANGES.year.min, VEHICLE_FILTER_RANGES.year.max, VEHICLE_FILTER_RANGES.year.step);
  assert.equal(values.length, 17); // 2010..2026 inclusive
});

test("createNumericRange: produces the exact expected count for the centralized mileage range", () => {
  const values = createNumericRange(VEHICLE_FILTER_RANGES.mileage.min, VEHICLE_FILTER_RANGES.mileage.max, VEHICLE_FILTER_RANGES.mileage.step);
  assert.equal(values.length, 25); // 10,000..250,000 step 10,000 inclusive
  assert.equal(values[0], 10_000);
  assert.equal(values[values.length - 1], 250_000);
});

test("createNumericRange: is deterministic and ascending with no duplicates", () => {
  const values = createNumericRange(1_000, 2_500, 100);
  for (let i = 1; i < values.length; i++) assert.ok(values.at(i)! > values.at(i - 1)!);
  assert.equal(new Set(values).size, values.length);
});

test("createNumericRange: returns an empty array for an inverted range rather than crashing", () => {
  assert.deepEqual(createNumericRange(100, 0, 10), []);
});
