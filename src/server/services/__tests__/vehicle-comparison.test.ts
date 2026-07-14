import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_COMPARISON_VEHICLES,
  VEHICLE_COMPARISON_STORAGE_VERSION,
  addComparisonId,
  areComparisonIdListsEqual,
  buildComparisonUrl,
  createEmptyComparisonState,
  parseComparisonIdsFromSearchParam,
  parseComparisonState,
  removeComparisonId,
  reorderVehiclesByIds,
  serializeComparisonState,
  toggleComparisonId,
} from "@/lib/vehicle-comparison";

// ---------- empty state ----------

test("createEmptyComparisonState: starts with zero IDs and the current version", () => {
  const state = createEmptyComparisonState();
  assert.deepEqual(state.ids, []);
  assert.equal(state.version, VEHICLE_COMPARISON_STORAGE_VERSION);
  assert.equal(typeof state.updatedAt, "string");
});

// ---------- add / max / duplicate ----------

test("addComparisonId: first vehicle is added", () => {
  const { ids, result } = addComparisonId([], "v1");
  assert.deepEqual(ids, ["v1"]);
  assert.equal(result, "added");
});

test("addComparisonId: second vehicle is appended, preserving order", () => {
  const { ids, result } = addComparisonId(["v1"], "v2");
  assert.deepEqual(ids, ["v1", "v2"]);
  assert.equal(result, "added");
});

test("addComparisonId: third vehicle is appended, preserving order", () => {
  const { ids, result } = addComparisonId(["v1", "v2"], "v3");
  assert.deepEqual(ids, ["v1", "v2", "v3"]);
  assert.equal(result, "added");
});

test("addComparisonId: a fourth vehicle is rejected once MAX_COMPARISON_VEHICLES is reached", () => {
  const full = ["v1", "v2", "v3"];
  assert.equal(full.length, MAX_COMPARISON_VEHICLES);
  const { ids, result } = addComparisonId(full, "v4");
  assert.equal(result, "max-reached");
  assert.deepEqual(ids, full);
});

test("addComparisonId: the original three are preserved unchanged after a rejected fourth attempt (same reference)", () => {
  const full = ["v1", "v2", "v3"];
  const { ids } = addComparisonId(full, "v4");
  assert.equal(ids, full);
});

test("addComparisonId: adding an already-selected vehicle is a no-op (duplicate prevention)", () => {
  const { ids, result } = addComparisonId(["v1", "v2"], "v1");
  assert.equal(result, "already-selected");
  assert.deepEqual(ids, ["v1", "v2"]);
});

test("toggleComparisonId: toggling an already-selected vehicle removes it", () => {
  const { ids, result } = toggleComparisonId(["v1", "v2"], "v1");
  assert.equal(result, "removed");
  assert.deepEqual(ids, ["v2"]);
});

test("toggleComparisonId: toggling a not-yet-selected vehicle adds it", () => {
  const { ids, result } = toggleComparisonId(["v1"], "v2");
  assert.equal(result, "added");
  assert.deepEqual(ids, ["v1", "v2"]);
});

// ---------- remove ----------

test("removeComparisonId: removes the first vehicle, preserving remaining order", () => {
  assert.deepEqual(removeComparisonId(["v1", "v2", "v3"], "v1"), ["v2", "v3"]);
});

test("removeComparisonId: removes the middle vehicle, preserving remaining order", () => {
  assert.deepEqual(removeComparisonId(["v1", "v2", "v3"], "v2"), ["v1", "v3"]);
});

test("removeComparisonId: removes the last vehicle, preserving remaining order", () => {
  assert.deepEqual(removeComparisonId(["v1", "v2", "v3"], "v3"), ["v1", "v2"]);
});

test("removeComparisonId: removing an ID that isn't present is a no-op (same reference)", () => {
  const ids = ["v1", "v2"];
  assert.equal(removeComparisonId(ids, "v9"), ids);
});

// ---------- canCompare / comparison URL ----------

test("buildComparisonUrl: null with 0 selected", () => {
  assert.equal(buildComparisonUrl([]), null);
});

test("buildComparisonUrl: null with 1 selected", () => {
  assert.equal(buildComparisonUrl(["v1"]), null);
});

test("buildComparisonUrl: null with 2 selected", () => {
  assert.equal(buildComparisonUrl(["v1", "v2"]), null);
});

test("buildComparisonUrl: a complete, ordered URL with exactly 3 selected", () => {
  assert.equal(buildComparisonUrl(["v1", "v2", "v3"]), "/compare?vehicles=v1,v2,v3");
});

test("buildComparisonUrl: safely URI-encodes IDs containing reserved characters", () => {
  const url = buildComparisonUrl(["a b", "c&d", "e,f"]);
  assert.equal(url, `/compare?vehicles=${encodeURIComponent("a b")},${encodeURIComponent("c&d")},${encodeURIComponent("e,f")}`);
});

// ---------- storage parser ----------

test("parseComparisonState: accepts a valid, current-version stored payload", () => {
  const raw = serializeComparisonState({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: ["v1", "v2"], updatedAt: "2026-01-01T00:00:00.000Z" });
  const parsed = parseComparisonState(raw);
  assert.deepEqual(parsed?.ids, ["v1", "v2"]);
});

test("parseComparisonState: rejects malformed JSON", () => {
  assert.equal(parseComparisonState("{not valid json"), null);
});

test("parseComparisonState: rejects null/undefined/empty input", () => {
  assert.equal(parseComparisonState(null), null);
  assert.equal(parseComparisonState(undefined), null);
  assert.equal(parseComparisonState(""), null);
});

test("parseComparisonState: rejects an unknown/future storage version", () => {
  const raw = JSON.stringify({ version: 999, ids: ["v1"], updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(parseComparisonState(raw), null);
});

test("parseComparisonState: rejects a payload with duplicate IDs rather than silently deduping", () => {
  const raw = JSON.stringify({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: ["v1", "v1"], updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(parseComparisonState(raw), null);
});

test("parseComparisonState: rejects more than MAX_COMPARISON_VEHICLES IDs", () => {
  const raw = JSON.stringify({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: ["v1", "v2", "v3", "v4"], updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(parseComparisonState(raw), null);
});

test("parseComparisonState: rejects non-string ID entries", () => {
  const raw = JSON.stringify({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: ["v1", 42], updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(parseComparisonState(raw), null);
});

test("parseComparisonState: rejects blank-string ID entries", () => {
  const raw = JSON.stringify({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: ["v1", "   "], updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(parseComparisonState(raw), null);
});

test("parseComparisonState: rejects a non-array `ids` field", () => {
  const raw = JSON.stringify({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: "v1,v2", updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(parseComparisonState(raw), null);
});

test("parseComparisonState: accepts an empty ID list (0 selected is valid persisted state)", () => {
  const raw = serializeComparisonState({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: [], updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(parseComparisonState(raw)?.ids, []);
});

test("parseComparisonState: the parsed/serialized payload contains no keys beyond version/ids/updatedAt (no personal data smuggled in)", () => {
  const raw = serializeComparisonState({ version: VEHICLE_COMPARISON_STORAGE_VERSION, ids: ["v1"], updatedAt: "2026-01-01T00:00:00.000Z" });
  const parsed = parseComparisonState(raw);
  assert.deepEqual(Object.keys(parsed ?? {}).sort(), ["ids", "updatedAt", "version"]);
});

// ---------- stale-ID pruning / requested-order restoration ----------

test("reorderVehiclesByIds: restores the requested selection order regardless of database return order", () => {
  const vehicles = [{ id: "v3" }, { id: "v1" }, { id: "v2" }];
  assert.deepEqual(
    reorderVehiclesByIds(vehicles, ["v1", "v2", "v3"]).map((v) => v.id),
    ["v1", "v2", "v3"],
  );
});

test("reorderVehiclesByIds: silently prunes a requested ID that isn't present in the result set (unavailable/deleted vehicle)", () => {
  const vehicles = [{ id: "v1" }, { id: "v3" }];
  assert.deepEqual(
    reorderVehiclesByIds(vehicles, ["v1", "v2", "v3"]).map((v) => v.id),
    ["v1", "v3"],
  );
});

test("reorderVehiclesByIds: excludes vehicles present in the result set but not requested", () => {
  const vehicles = [{ id: "v1" }, { id: "v2" }, { id: "unexpected" }];
  assert.deepEqual(
    reorderVehiclesByIds(vehicles, ["v1", "v2"]).map((v) => v.id),
    ["v1", "v2"],
  );
});

// ---------- URL search param parsing ----------

test("parseComparisonIdsFromSearchParam: parses a comma-separated ID list", () => {
  assert.deepEqual(parseComparisonIdsFromSearchParam("v1,v2,v3"), ["v1", "v2", "v3"]);
});

test("parseComparisonIdsFromSearchParam: trims whitespace around IDs", () => {
  assert.deepEqual(parseComparisonIdsFromSearchParam(" v1 , v2 "), ["v1", "v2"]);
});

test("parseComparisonIdsFromSearchParam: drops blank entries", () => {
  assert.deepEqual(parseComparisonIdsFromSearchParam("v1,,v2"), ["v1", "v2"]);
});

test("parseComparisonIdsFromSearchParam: deduplicates while preserving first-seen order", () => {
  assert.deepEqual(parseComparisonIdsFromSearchParam("v1,v2,v1"), ["v1", "v2"]);
});

test("parseComparisonIdsFromSearchParam: returns an empty array for null/undefined/empty input", () => {
  assert.deepEqual(parseComparisonIdsFromSearchParam(null), []);
  assert.deepEqual(parseComparisonIdsFromSearchParam(undefined), []);
  assert.deepEqual(parseComparisonIdsFromSearchParam(""), []);
});

// ---------- list equality ----------

test("areComparisonIdListsEqual: true for identical order and contents", () => {
  assert.equal(areComparisonIdListsEqual(["v1", "v2"], ["v1", "v2"]), true);
});

test("areComparisonIdListsEqual: false when order differs", () => {
  assert.equal(areComparisonIdListsEqual(["v1", "v2"], ["v2", "v1"]), false);
});

test("areComparisonIdListsEqual: false when lengths differ", () => {
  assert.equal(areComparisonIdListsEqual(["v1"], ["v1", "v2"]), false);
});
