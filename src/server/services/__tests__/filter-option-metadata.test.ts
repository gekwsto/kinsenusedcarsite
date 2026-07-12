import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFuelIcon, resolveTransmissionIcon, resolveVehicleTypeIcon, DEALS_ICON } from "@/components/vehicles/filter-option-metadata";

// Proves the "unknown value never gets hidden for lack of an icon mapping"
// invariant at the one layer where a gate could theoretically exist: every
// resolver must return a real icon component for a synthetic value that
// has never appeared in any known-value map, never null/undefined.
const SYNTHETIC = {
  fuel: "Hydrogen-X",
  transmission: "Adaptive-DCT-X",
  vehicleType: "Urban-Crossover-X",
};

test("resolveFuelIcon: returns a real icon component for a synthetic unknown fuel value", () => {
  const icon = resolveFuelIcon(SYNTHETIC.fuel);
  assert.equal(typeof icon, "object");
  assert.notEqual(icon, undefined);
  assert.notEqual(icon, null);
});

test("resolveFuelIcon: known and unknown values both resolve to a defined icon (no gating)", () => {
  assert.notEqual(resolveFuelIcon("Electric"), undefined);
  assert.notEqual(resolveFuelIcon(SYNTHETIC.fuel), undefined);
});

test("resolveTransmissionIcon: returns a real icon component for a synthetic unknown transmission value", () => {
  const icon = resolveTransmissionIcon(SYNTHETIC.transmission);
  assert.notEqual(icon, undefined);
  assert.notEqual(icon, null);
});

test("resolveVehicleTypeIcon: returns a real icon component for a synthetic unknown vehicle type", () => {
  const icon = resolveVehicleTypeIcon(SYNTHETIC.vehicleType);
  assert.notEqual(icon, undefined);
  assert.notEqual(icon, null);
});

test("resolveVehicleTypeIcon: case/whitespace variants of a known value resolve the same as the canonical form", () => {
  assert.equal(resolveVehicleTypeIcon("SUV"), resolveVehicleTypeIcon("  suv  "));
});

test("DEALS_ICON is a defined icon component", () => {
  assert.notEqual(DEALS_ICON, undefined);
});

test("vehicle-filters.tsx renders every database-derived option family unconditionally from options.*, with no metadata-presence gate", async () => {
  // Structural guard: the only thing allowed to decide whether an option
  // *appears* is the authoritative options.<family> array itself — never a
  // conditional on whether a presentation resolver has an entry for that
  // value. This greps for the specific invalid pattern the task calls out:
  // `metadata[value] ? renderOption() : null`.
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../../../components/vehicles/vehicle-filters.tsx", import.meta.url), "utf8");
  assert.match(source, /options\.fuels\.map/);
  assert.match(source, /options\.transmissions\.map/);
  assert.match(source, /options\.typesOfCar\.map/);
  assert.match(source, /options\.makers/);
  assert.match(source, /options\.colors/);
  assert.doesNotMatch(source, /ICON_MAP\[[^\]]*\]\s*&&/);
  assert.doesNotMatch(source, /resolve\w*Icon\([^)]*\)\s*\?\s*.*:\s*null/);
});
