import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPARISON_FIELDS,
  COMPARISON_GROUP_ORDER,
  computeBestValueVehicleIds,
  type ComparisonMatrixVehicle,
} from "@/lib/comparison-fields";

function makeVehicle(overrides: Partial<ComparisonMatrixVehicle> & { id: string }): ComparisonMatrixVehicle {
  return {
    maker: "Toyota",
    versionName: "Corolla",
    yearRelease: 2020,
    typeOfCar: "Sedan",
    color: "Λευκό",
    fuel: "Βενζίνη",
    cc: 1600,
    hp: 120,
    transmissionType: "Αυτόματο",
    km: 50000,
    offer: false,
    price: 15000,
    monthlyPrice: null,
    ...overrides,
  };
}

function fieldById(id: string) {
  const field = COMPARISON_FIELDS.find((f) => f.id === id);
  assert.ok(field, `expected a comparison field with id "${id}"`);
  return field!;
}

// ---------- best-value calculation ----------

test("computeBestValueVehicleIds: lower-is-better (price) highlights the single cheapest vehicle", () => {
  const vehicles = [makeVehicle({ id: "a", price: 20000 }), makeVehicle({ id: "b", price: 15000 }), makeVehicle({ id: "c", price: 25000 })];
  const best = computeBestValueVehicleIds(vehicles, fieldById("price"));
  assert.deepEqual([...best], ["b"]);
});

test("computeBestValueVehicleIds: higher-is-better (hp) highlights the single most powerful vehicle", () => {
  const vehicles = [makeVehicle({ id: "a", hp: 100 }), makeVehicle({ id: "b", hp: 180 }), makeVehicle({ id: "c", hp: 140 })];
  const best = computeBestValueVehicleIds(vehicles, fieldById("hp"));
  assert.deepEqual([...best], ["b"]);
});

test("computeBestValueVehicleIds: newer-is-better (yearRelease) highlights the single newest vehicle", () => {
  const vehicles = [makeVehicle({ id: "a", yearRelease: 2018 }), makeVehicle({ id: "b", yearRelease: 2022 }), makeVehicle({ id: "c", yearRelease: 2020 })];
  const best = computeBestValueVehicleIds(vehicles, fieldById("yearRelease"));
  assert.deepEqual([...best], ["b"]);
});

test("computeBestValueVehicleIds: a tie highlights every vehicle tied for the best value (documented, consistent rule)", () => {
  const vehicles = [makeVehicle({ id: "a", km: 10000 }), makeVehicle({ id: "b", km: 10000 }), makeVehicle({ id: "c", km: 50000 })];
  const best = computeBestValueVehicleIds(vehicles, fieldById("km"));
  assert.deepEqual(new Set(best), new Set(["a", "b"]));
});

test("computeBestValueVehicleIds: an all-tied field still highlights every vehicle (same rule, no special case)", () => {
  const vehicles = [makeVehicle({ id: "a", km: 30000 }), makeVehicle({ id: "b", km: 30000 }), makeVehicle({ id: "c", km: 30000 })];
  const best = computeBestValueVehicleIds(vehicles, fieldById("km"));
  assert.deepEqual(new Set(best), new Set(["a", "b", "c"]));
});

test("computeBestValueVehicleIds: a missing (null) numeric value is excluded, never treated as zero", () => {
  // If null were treated as 0, vehicle "a" would incorrectly win a
  // lower-is-better comparison against real positive prices.
  const vehicles = [makeVehicle({ id: "a", price: null }), makeVehicle({ id: "b", price: 15000 }), makeVehicle({ id: "c", price: 20000 })];
  const best = computeBestValueVehicleIds(vehicles, fieldById("price"));
  assert.deepEqual([...best], ["b"]);
});

test("computeBestValueVehicleIds: returns an empty set when every value is missing", () => {
  const vehicles = [makeVehicle({ id: "a", price: null }), makeVehicle({ id: "b", price: null })];
  const best = computeBestValueVehicleIds(vehicles, fieldById("price"));
  assert.deepEqual([...best], []);
});

test("computeBestValueVehicleIds: subjective/non-rankable fields (comparisonMode 'none') are never highlighted", () => {
  const subjectiveFieldIds = ["model", "typeOfCar", "color", "fuel", "cc", "transmissionType", "offer"];
  for (const id of subjectiveFieldIds) {
    const field = fieldById(id);
    assert.equal(field.comparisonMode, "none", `expected "${id}" to be non-rankable`);
    const vehicles = [makeVehicle({ id: "a" }), makeVehicle({ id: "b" })];
    assert.deepEqual([...computeBestValueVehicleIds(vehicles, field)], []);
  }
});

test("every rankable field (comparisonMode !== 'none') declares a field-specific bestLabel", () => {
  for (const field of COMPARISON_FIELDS) {
    if (field.comparisonMode === "none") continue;
    assert.ok(field.bestLabel && field.bestLabel.length > 0, `expected field "${field.id}" to have a bestLabel`);
  }
});

// ---------- formatting / missing-value display ----------

test("formatValue: a missing value renders as the dash placeholder, never null/undefined/blank", () => {
  const vehicle = makeVehicle({ id: "a", color: null, cc: null, hp: null, km: null, price: null, monthlyPrice: null });
  for (const field of COMPARISON_FIELDS) {
    const formatted = field.formatValue(field.getValue(vehicle), vehicle);
    if (field.id === "offer") continue; // boolean field always renders Ναι/Όχι, never missing
    if (field.id === "model") continue; // always has maker+versionName in this fixture
    if (field.id === "yearRelease" || field.id === "typeOfCar" || field.id === "fuel" || field.id === "transmissionType") continue;
    assert.equal(formatted, "—", `expected field "${field.id}" to render the dash placeholder for a missing value`);
  }
});

test("formatValue: boolean offer field renders Ναι/Όχι, never a raw boolean or database code", () => {
  const field = fieldById("offer");
  assert.equal(field.formatValue(true, makeVehicle({ id: "a", offer: true })), "Ναι");
  assert.equal(field.formatValue(false, makeVehicle({ id: "a", offer: false })), "Όχι");
});

test("formatValue: km renders through the shared formatKm() Greek-locale formatter, not a raw number", () => {
  const field = fieldById("km");
  const formatted = field.formatValue(50000, makeVehicle({ id: "a", km: 50000 }));
  assert.ok(formatted.includes("χλμ"), "expected the formatted mileage to include the χλμ unit suffix");
  assert.notEqual(formatted, "50000");
});

test("formatValue: price renders through the shared formatEuro() formatter, not a raw number", () => {
  const field = fieldById("price");
  const formatted = field.formatValue(15000, makeVehicle({ id: "a", price: 15000 }));
  assert.notEqual(formatted, "15000");
  assert.ok(formatted.includes("€"));
});

// ---------- registry shape ----------

test("COMPARISON_FIELDS: every field belongs to one of the declared, ordered groups", () => {
  for (const field of COMPARISON_FIELDS) {
    assert.ok(COMPARISON_GROUP_ORDER.includes(field.group), `field "${field.id}" has an undeclared group "${field.group}"`);
  }
});

test("COMPARISON_FIELDS: field IDs are unique", () => {
  const ids = COMPARISON_FIELDS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});
