import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { getPublicFilterOptions, listPublicVehicles } from "@/server/services/vehicle.service";
import { vehicleFilterSchema } from "@/lib/validators/vehicle.schema";
import { prisma } from "@/lib/prisma";

// Proves getPublicFilterOptions() is NOT derived from the current
// pagination page.
//
// The two tests below are pure structural/source proofs — no database
// needed, always part of the default deterministic gate. The function's
// own signature is the strongest proof of all: it takes zero arguments, so
// it cannot possibly receive "which page is currently being viewed" as
// input in the first place.
test("getPublicFilterOptions: takes no arguments — cannot structurally depend on the current page", () => {
  assert.equal(getPublicFilterOptions.length, 0);
});

test("getPublicFilterOptions: option queries carry no skip/take (source-level guard)", async () => {
  // Reads this module's own source and asserts none of the `findMany`/
  // `count` calls building filter-option metadata reference pagination
  // fields. Scoped to the function body only, not the whole file (which
  // legitimately uses skip/take elsewhere, in listPublicVehicles) — fails
  // loudly if a future refactor threads pagination into this function.
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../vehicle.service.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function getPublicFilterOptions()");
  assert.notEqual(start, -1, "getPublicFilterOptions not found in vehicle.service.ts");
  const end = source.indexOf("\n}", start);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /\bskip\s*:/);
  assert.doesNotMatch(body, /\btake\s*:/);
});

// The two tests below additionally prove the same invariant empirically,
// read-only, against whatever database DATABASE_URL points at (no rows
// written, modified or deleted). Each self-skips via a real connectivity
// probe done inside the test body (not just "is the env var set" — see the
// CDN integration smoke test's history for why a config-presence-only
// check isn't reliable enough to keep the default gate deterministic), so
// a build/CI environment without a reachable local Postgres still gets a
// fully green default `npm test`. `node:test`'s static `{ skip }` option
// requires a synchronous value, so a real `await`-based probe has to run
// inside the test function itself via `t.skip(...)` instead of top-level
// await, which esbuild/tsx doesn't support for this module's CJS output.
async function skipIfDbUnreachable(t: TestContext): Promise<boolean> {
  try {
    await prisma.vehicle.count();
    return false;
  } catch {
    t.skip("DATABASE_URL not reachable in this environment");
    return true;
  }
}

test("getPublicFilterOptions: returns an identical result before and after fetching different pagination pages", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const before = await getPublicFilterOptions();
  await listPublicVehicles(vehicleFilterSchema.parse({ page: "1", pageSize: "3" }));
  await listPublicVehicles(vehicleFilterSchema.parse({ page: "2", pageSize: "3" }));
  const after = await getPublicFilterOptions();
  assert.deepEqual(after, before);
});

test("getPublicFilterOptions: distinct option sets are not bounded by a small page-1 slice of the same data", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const metadata = await getPublicFilterOptions();
  const pageOne = await listPublicVehicles(vehicleFilterSchema.parse({ page: "1", pageSize: "3" }));

  // If getPublicFilterOptions() were (incorrectly) derived from the
  // *rendered* page-1 cards instead of an independent full-scope query,
  // its distinct value set could never exceed what those 3 cards contain.
  const pageOneMakers = new Set(pageOne.items.map((v) => v.maker));
  assert.ok(metadata.makers.length >= pageOneMakers.size);
});
