/**
 * Real, opt-in NETWORK SMOKE TEST against the live Kinsen CDN — no mocking.
 *
 * Deliberately named `*.integration.smoke.ts`, not `*.test.ts`: the default
 * `npm test` script only globs `src/server/services/__tests__/**\/*.test.ts`,
 * so this file is excluded from that deterministic gate. Its skip-if-
 * unconfigured guard below only protects against a *missing* CDN_BASE_URL/
 * CDN_LIST_TOKEN — it does NOT protect against the configured CDN being
 * unreachable or the fixture VIN's real images changing, both of which
 * previously made `npm test` fail nondeterministically whenever `.env`
 * happened to have CDN credentials set in a given environment.
 *
 * The exact same request/response *logic* this file exercises against the
 * real network (VIN validation, natural sort, extension filtering,
 * 404/500/network-failure/malformed-JSON handling) is already covered
 * deterministically with mocked fetch in cdn-image.service.test.ts, which
 * IS part of the default gate — so excluding this file from `npm test`
 * loses no meaningful coverage, only the "is the live CDN itself currently
 * reachable and serving this fixture VIN" check.
 *
 * Run manually when you want that live check:
 *   node --env-file-if-exists=.env --import tsx --test \
 *     src/server/services/__tests__/cdn-image.service.integration.smoke.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCdnVehicleImageFiles } from "@/server/services/cdn-image.service";

const REAL_VIN = "WBA7K110707L27397";
const hasCdnConfig = Boolean(process.env.CDN_BASE_URL && process.env.CDN_LIST_TOKEN);

test(
  "real CDN: known VIN returns its actual naturally-sorted image files",
  { skip: !hasCdnConfig && "CDN_BASE_URL/CDN_LIST_TOKEN not configured in this environment" },
  async () => {
    const files = await getCdnVehicleImageFiles(REAL_VIN);

    assert.ok(files.length > 0, "expected at least one real image for the known test VIN");
    for (const file of files) {
      assert.match(file.name, /\.(jpe?g|png|webp|avif)$/i);
      assert.equal(file.url, `https://cdn.kinsen.gr/usedcars/${REAL_VIN}/${file.name}`);
    }

    const sortedCopy = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    assert.deepEqual(
      files.map((f) => f.name),
      sortedCopy.map((f) => f.name),
    );
  },
);

test(
  "real CDN: nonexistent VIN returns an empty list, not an error",
  { skip: !hasCdnConfig && "CDN_BASE_URL/CDN_LIST_TOKEN not configured in this environment" },
  async () => {
    const files = await getCdnVehicleImageFiles("NOSUCHVIN0000001");
    assert.deepEqual(files, []);
  },
);
