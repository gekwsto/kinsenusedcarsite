import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  getCdnVehicleImageFiles,
  isValidVin,
  normalizeVin,
  naturalCompare,
} from "@/server/services/cdn-image.service";

const ENV_KEYS = [
  "CDN_INTERNAL_BASE_URL",
  "CDN_PUBLIC_BASE_URL",
  "CDN_LIST_TOKEN",
  "CDN_VEHICLE_LIST_PATH",
  "CDN_VEHICLE_PUBLIC_PATH",
  "CDN_FETCH_TIMEOUT_MS",
  "CDN_CACHE_TTL_SECONDS",
] as const;

const TEST_TOKEN = "test-token";

function withCdnEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  const original: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) original[key] = process.env[key];

  process.env.CDN_INTERNAL_BASE_URL = overrides.CDN_INTERNAL_BASE_URL ?? "http://cdn";
  process.env.CDN_PUBLIC_BASE_URL = overrides.CDN_PUBLIC_BASE_URL ?? "https://cdn.kinsen.gr";
  process.env.CDN_LIST_TOKEN = overrides.CDN_LIST_TOKEN ?? TEST_TOKEN;
  process.env.CDN_VEHICLE_LIST_PATH = overrides.CDN_VEHICLE_LIST_PATH ?? "/_list";
  process.env.CDN_VEHICLE_PUBLIC_PATH = overrides.CDN_VEHICLE_PUBLIC_PATH ?? "/usedcars";
  process.env.CDN_FETCH_TIMEOUT_MS = overrides.CDN_FETCH_TIMEOUT_MS ?? "2500";
  process.env.CDN_CACHE_TTL_SECONDS = overrides.CDN_CACHE_TTL_SECONDS ?? "300";

  return () => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  };
}

function mockFetchOnce(t: TestContext, impl: (url: string) => Response | Promise<Response>) {
  return t.mock.method(globalThis, "fetch", async (input: string | URL) => impl(String(input)));
}

test("naturalCompare sorts image1, image2, image10 in numeric order", () => {
  const names = ["image10.jpg", "image1.jpg", "image2.jpg"];
  names.sort(naturalCompare);
  assert.deepEqual(names, ["image1.jpg", "image2.jpg", "image10.jpg"]);
});

test("normalizeVin trims and uppercases", () => {
  assert.equal(normalizeVin("  wba7k110707l27397  "), "WBA7K110707L27397");
});

test("isValidVin rejects path traversal and separators", () => {
  assert.equal(isValidVin("WBA7K110707L27397"), true);
  assert.equal(isValidVin("../../etc/passwd"), false);
  assert.equal(isValidVin("abc def"), false);
  assert.equal(isValidVin("a/b"), false);
  assert.equal(isValidVin(""), false);
});

test("getCdnVehicleImageFiles returns [] and skips fetch for an invalid VIN", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);
  let called = false;
  t.mock.method(globalThis, "fetch", async () => {
    called = true;
    return new Response("[]", { status: 200 });
  });

  const files = await getCdnVehicleImageFiles("../not-a-vin");
  assert.deepEqual(files, []);
  assert.equal(called, false);
});

test("getCdnVehicleImageFiles returns [] when CDN env is not configured", async (t) => {
  const restore = withCdnEnv({});
  delete process.env.CDN_INTERNAL_BASE_URL;
  delete process.env.CDN_PUBLIC_BASE_URL;
  delete process.env.CDN_LIST_TOKEN;
  t.after(restore);

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles returns [] when CDN_INTERNAL_BASE_URL alone is missing", async (t) => {
  const restore = withCdnEnv({});
  delete process.env.CDN_INTERNAL_BASE_URL;
  t.after(restore);

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles returns [] when CDN_PUBLIC_BASE_URL alone is missing", async (t) => {
  const restore = withCdnEnv({});
  delete process.env.CDN_PUBLIC_BASE_URL;
  t.after(restore);

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles returns [] when CDN_INTERNAL_BASE_URL is not a valid URL", async (t) => {
  const restore = withCdnEnv({ CDN_INTERNAL_BASE_URL: "not-a-url" });
  t.after(restore);
  let called = false;
  t.mock.method(globalThis, "fetch", async () => {
    called = true;
    return new Response("[]", { status: 200 });
  });

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
  assert.equal(called, false, "an invalid base URL must never reach fetch");
});

test("getCdnVehicleImageFiles returns [] when CDN_PUBLIC_BASE_URL is not a valid URL", async (t) => {
  const restore = withCdnEnv({ CDN_PUBLIC_BASE_URL: "not-a-url" });
  t.after(restore);

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles: listing request uses CDN_INTERNAL_BASE_URL (http://cdn), not the public host", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);

  let requestedUrl = "";
  mockFetchOnce(t, (url) => {
    requestedUrl = url;
    return new Response(
      JSON.stringify([{ name: "WBA7K110707L27397_01.png", type: "file" }]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  await getCdnVehicleImageFiles("WBA7K110707L27397");

  assert.ok(requestedUrl.startsWith("http://cdn/"), `expected listing request against http://cdn, got: ${requestedUrl}`);
  assert.equal(requestedUrl, "http://cdn/_list/test-token/usedcars/WBA7K110707L27397/");
});

test("getCdnVehicleImageFiles: returned image urls use CDN_PUBLIC_BASE_URL and never leak the internal host or the token", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);

  mockFetchOnce(
    t,
    async () =>
      new Response(
        JSON.stringify([
          { name: "WBA7K110707L27397_02.png", type: "file" },
          { name: "WBA7K110707L27397_01.png", type: "file" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");

  assert.equal(files.length, 2);
  for (const file of files) {
    assert.ok(file.url.startsWith("https://cdn.kinsen.gr/"), `expected public host, got: ${file.url}`);
    assert.ok(!file.url.includes("http://cdn"), `internal host leaked into public url: ${file.url}`);
    assert.ok(!file.url.includes(TEST_TOKEN), `list token leaked into public url: ${file.url}`);
  }
});

test("getCdnVehicleImageFiles filters unsupported files/directories and naturally sorts", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);

  mockFetchOnce(t, (url) => {
    assert.ok(url.includes("/_list/test-token/usedcars/WBA7K110707L27397/"));
    return new Response(
      JSON.stringify([
        { name: "WBA7K110707L27397_10.png", type: "file", size: 1 },
        { name: "WBA7K110707L27397_02.png", type: "file", size: 1 },
        { name: "WBA7K110707L27397_01.png", type: "file", size: 1 },
        { name: "manual.pdf", type: "file", size: 1 },
        { name: "subfolder", type: "directory" },
        { name: "..%2Fescape.png", type: "file", size: 1 },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  const files = await getCdnVehicleImageFiles("wba7k110707l27397");
  assert.deepEqual(
    files.map((f) => f.name),
    ["WBA7K110707L27397_01.png", "WBA7K110707L27397_02.png", "WBA7K110707L27397_10.png"],
  );
  assert.equal(files[0]!.url, "https://cdn.kinsen.gr/usedcars/WBA7K110707L27397/WBA7K110707L27397_01.png");
});

test("getCdnVehicleImageFiles is case-insensitive on file extensions", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);

  mockFetchOnce(
    t,
    async () =>
      new Response(JSON.stringify([{ name: "PHOTO.JPG", type: "file" }, { name: "photo.WEBP", type: "file" }]), {
        status: 200,
      }),
  );

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files.map((f) => f.name).sort(), ["PHOTO.JPG", "photo.WEBP"]);
});

test("getCdnVehicleImageFiles returns [] on a 404 (nonexistent VIN)", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);
  mockFetchOnce(t, async () => new Response("Not Found", { status: 404 }));

  const files = await getCdnVehicleImageFiles("ZZZZZZZZZZZZZZZZZ");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles returns [] on a 500", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);
  mockFetchOnce(t, async () => new Response("Internal Server Error", { status: 500 }));

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles returns [] instead of throwing on a network failure/timeout", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("simulated network failure");
  });

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles returns [] on malformed JSON", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);
  mockFetchOnce(t, async () => new Response("<html>not json</html>", { status: 200 }));

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});

test("getCdnVehicleImageFiles returns [] when the response is not an array", async (t) => {
  const restore = withCdnEnv({});
  t.after(restore);
  mockFetchOnce(t, async () => new Response(JSON.stringify({ error: "unexpected shape" }), { status: 200 }));

  const files = await getCdnVehicleImageFiles("WBA7K110707L27397");
  assert.deepEqual(files, []);
});
