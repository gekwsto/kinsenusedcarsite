/**
 * Real integration test against the live Kinsen CDN — no mocking. Requires
 * CDN_BASE_URL / CDN_LIST_TOKEN to be set (e.g. via `.env`, loaded with
 * `node --env-file-if-exists=.env`) and outbound network access. Skips
 * itself rather than failing the suite when either is unavailable, since
 * CI environments may not have network access or the real CDN token.
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
