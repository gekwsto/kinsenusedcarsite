import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { resolveVehicleImages, resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";

const ENV_KEYS = ["CDN_BASE_URL", "CDN_LIST_TOKEN"] as const;

function withCdnEnv(t: TestContext) {
  const original: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) original[key] = process.env[key];
  process.env.CDN_BASE_URL = "https://cdn.kinsen.gr";
  process.env.CDN_LIST_TOKEN = "test-token";
  t.after(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
}

function mockFetch(t: TestContext, impl: () => Response | Promise<Response>) {
  return t.mock.method(globalThis, "fetch", async () => impl());
}

test("resolveVehicleImages: database images take precedence and pick isMain as the main image", async () => {
  const resolved = await resolveVehicleImages({
    vin: "WBA7K110707L27397",
    images: [
      { id: "img-1", url: "/uploads/vehicles/v1/a.jpg", alt: null, isMain: false, sortOrder: 0 },
      { id: "img-2", url: "/uploads/vehicles/v1/b.jpg", alt: null, isMain: true, sortOrder: 1 },
    ],
  });

  assert.equal(resolved.source, "DATABASE");
  assert.equal(resolved.images.length, 2);
  assert.equal(resolved.mainImage.id, "img-2");
});

test("resolveVehicleImages: falls back to first sortOrder image when no isMain flag is set", async () => {
  const resolved = await resolveVehicleImages({
    vin: null,
    images: [
      { id: "img-2", url: "/b.jpg", alt: null, isMain: false, sortOrder: 1 },
      { id: "img-1", url: "/a.jpg", alt: null, isMain: false, sortOrder: 0 },
    ],
  });

  assert.equal(resolved.source, "DATABASE");
  assert.equal(resolved.mainImage.id, "img-1");
  assert.deepEqual(resolved.images.map((i) => i.id), ["img-1", "img-2"]);
});

test("resolveVehicleImages: uses CDN images when no database images exist", async (t) => {
  withCdnEnv(t);
  mockFetch(t, async () => new Response(JSON.stringify([
    { name: "WBA7K110707L27397_02.png", type: "file" },
    { name: "WBA7K110707L27397_01.png", type: "file" },
  ]), { status: 200 }));

  const resolved = await resolveVehicleImages({ vin: "WBA7K110707L27397", images: [] });

  assert.equal(resolved.source, "CDN");
  assert.deepEqual(
    resolved.images.map((i) => i.url),
    [
      "https://cdn.kinsen.gr/usedcars/WBA7K110707L27397/WBA7K110707L27397_01.png",
      "https://cdn.kinsen.gr/usedcars/WBA7K110707L27397/WBA7K110707L27397_02.png",
    ],
  );
  assert.equal(resolved.mainImage.url, resolved.images[0]!.url);
});

test("resolveVehicleImages: database images win even when a VIN with CDN images is also present", async (t) => {
  withCdnEnv(t);
  const fetchMock = mockFetch(t, async () => new Response(JSON.stringify([{ name: "a.jpg", type: "file" }]), { status: 200 }));

  const resolved = await resolveVehicleImages({
    vin: "WBA7K110707L27397",
    images: [{ id: "img-1", url: "/uploads/a.jpg", alt: null, isMain: true, sortOrder: 0 }],
  });

  assert.equal(resolved.source, "DATABASE");
  assert.equal(fetchMock.mock.callCount(), 0, "CDN should never be queried when DB images exist");
});

test("resolveVehicleImages: falls back to the placeholder when there are no DB images and no VIN", async () => {
  const resolved = await resolveVehicleImages({ vin: null, images: [] });
  assert.equal(resolved.source, "FALLBACK");
  assert.equal(resolved.images.length, 1);
  assert.match(resolved.mainImage.url, /vehicle-fallback\.png$/);
});

test("resolveVehicleImages: falls back to the placeholder for an invalid VIN", async (t) => {
  withCdnEnv(t);
  const fetchMock = mockFetch(t, async () => new Response("[]", { status: 200 }));

  const resolved = await resolveVehicleImages({ vin: "../../etc/passwd", images: [] });

  assert.equal(resolved.source, "FALLBACK");
  assert.equal(fetchMock.mock.callCount(), 0, "an invalid VIN must never reach the CDN fetch");
});

test("resolveVehicleImages: falls back to the placeholder when the VIN has no CDN images", async (t) => {
  withCdnEnv(t);
  mockFetch(t, async () => new Response("[]", { status: 200 }));

  const resolved = await resolveVehicleImages({ vin: "ZZZZZZZZZZZZZZZZZ", images: [] });
  assert.equal(resolved.source, "FALLBACK");
});

test("resolveVehicleImages: CDN failure degrades to fallback instead of throwing", async (t) => {
  withCdnEnv(t);
  mockFetch(t, async () => {
    throw new Error("simulated CDN outage");
  });

  const resolved = await resolveVehicleImages({ vin: "WBA7K110707L27397", images: [] });
  assert.equal(resolved.source, "FALLBACK");
});

test("resolveVehicleImagesForList: resolves each vehicle independently and never throws", async (t) => {
  withCdnEnv(t);
  mockFetch(t, async () => new Response(JSON.stringify([{ name: "a.jpg", type: "file" }]), { status: 200 }));

  const vehicles = [
    { id: "v1", vin: null, images: [{ id: "img-1", url: "/db.jpg", alt: null, isMain: true, sortOrder: 0 }] },
    { id: "v2", vin: "WBA7K110707L27397", images: [] },
    { id: "v3", vin: null, images: [] },
  ];

  const resolved = await resolveVehicleImagesForList(vehicles);

  assert.equal(resolved.length, 3);
  assert.equal(resolved[0]!.images[0]!.url, "/db.jpg");
  assert.equal(resolved[1]!.images[0]!.url, "https://cdn.kinsen.gr/usedcars/WBA7K110707L27397/a.jpg");
  assert.match(resolved[2]!.images[0]!.url, /vehicle-fallback\.png$/);
});
