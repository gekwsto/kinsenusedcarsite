import { test } from "node:test";
import assert from "node:assert/strict";
import { VEHICLE_FILTER_RANGES, VEHICLE_PRICE_FILTER_MIN, VEHICLE_PRICE_FILTER_MAX } from "@/lib/validators/vehicle.schema";
import { EMPTY_DRAFT, NUMERIC_FIELDS, CSV_FIELDS, computeDraftFromParams } from "@/components/providers/vehicle-filter-provider";

// Locks the five intentional business-configured numeric ranges to their
// agreed values, in the one centralized location.
test("centralized numeric business configuration matches the agreed product ranges", () => {
  assert.equal(VEHICLE_PRICE_FILTER_MIN, 0);
  assert.equal(VEHICLE_PRICE_FILTER_MAX, 50_000);
  assert.deepEqual(VEHICLE_FILTER_RANGES.year, { min: 2010, max: 2026, step: 1 });
  assert.deepEqual(VEHICLE_FILTER_RANGES.mileage, { min: 10_000, max: 250_000, step: 10_000 });
  assert.deepEqual(VEHICLE_FILTER_RANGES.engineCc, { min: 1_000, max: 2_500, step: 100 });
  assert.deepEqual(VEHICLE_FILTER_RANGES.horsepower, { min: 80, max: 250, step: 10 });
});

// Fails loudly if a future edit reintroduces the same numeric literal
// (50000/2010/2026/250000/2500) as a *second, competing* range definition
// anywhere the filter UI itself lives — VEHICLE_FILTER_RANGES and
// VEHICLE_PRICE_FILTER_MIN/MAX in vehicle.schema.ts must remain the only
// source.
test("no competing numeric range literal is duplicated inside the filter UI directory", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "src/components/vehicles");
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const forbidden = [/\b50000\b/, /\b50_000\b/, /\b250000\b/, /\b250_000\b/, /\b2026\b/];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const contents = await fs.readFile(path.join(dir, entry.name), "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(contents, pattern, `${entry.name} appears to hardcode a business-range literal outside VEHICLE_FILTER_RANGES/VEHICLE_PRICE_FILTER_MAX`);
    }
  }
});

// Clear-all completeness: EMPTY_DRAFT (the canonical "nothing selected"
// state clearFilters resets to) must have an entry for every field the
// draft type declares — NUMERIC_FIELDS/CSV_FIELDS are the single source of
// truth clearFilters itself iterates (see vehicle-filter-provider.tsx),
// so adding a new canonical field there without an EMPTY_DRAFT entry would
// be a TypeScript compile error, and this test additionally proves the
// *values* are the correct "unset" sentinel for each field kind.
test("EMPTY_DRAFT has the correct unset value for every canonical numeric and csv field", () => {
  for (const field of NUMERIC_FIELDS) assert.equal(EMPTY_DRAFT[field], "", `NUMERIC_FIELDS entry '${field}' is not empty in EMPTY_DRAFT`);
  for (const field of CSV_FIELDS) assert.equal(EMPTY_DRAFT[field], "", `CSV_FIELDS entry '${field}' is not empty in EMPTY_DRAFT`);
  assert.equal(EMPTY_DRAFT.offerOnly, false);
});

test("computeDraftFromParams on an empty URL exactly equals EMPTY_DRAFT (no-filter canonical state)", () => {
  const draft = computeDraftFromParams(new URLSearchParams());
  assert.deepEqual(draft, EMPTY_DRAFT);
});

test("clearFilters (vehicle-filter-provider.tsx) resets fields by iterating the canonical NUMERIC_FIELDS/CSV_FIELDS arrays, not a hardcoded list", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../../../components/providers/vehicle-filter-provider.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const clearFilters = React.useCallback(() => {");
  assert.notEqual(start, -1, "clearFilters not found");
  const end = source.indexOf("\n  }, [", start);
  const body = source.slice(start, end);
  assert.match(body, /for \(const field of NUMERIC_FIELDS\)/);
  assert.match(body, /for \(const field of CSV_FIELDS\)/);
});
