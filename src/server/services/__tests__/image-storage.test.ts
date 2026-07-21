import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, chmod, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  uploadContentImage,
  uploadVehicleImage,
  removeUploadedImage,
  __testing__,
} from "@/lib/images";

const { LocalImageDriver, resolveUploadRoot } = __testing__;

// A minimal real PNG (matches the ALLOWED_EXTENSIONS/"real bytes, not just
// a renamed extension" requirement) — 1x1 transparent pixel.
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d494844520000000100000001080600000" +
    "01f15c4890000000a4944415478da6360000002000155001b3d260000000049454e44ae426082",
  "hex",
);

function pngFile(name = "photo.png"): File {
  return new File([PNG_BYTES], name, { type: "image/png" });
}

async function withTempDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "kinsen-upload-test-"));
  t.after(async () => {
    await chmod(dir, 0o700).catch(() => undefined); // undo any permission test that locked it down
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });
  return dir;
}

function withEnv(t: TestContext, key: string, value: string | undefined) {
  const original = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  });
}

// ---------- resolveUploadRoot ----------

test("resolveUploadRoot: no UPLOAD_DIR falls back to <cwd>/public/uploads", () => {
  const root = resolveUploadRoot({});
  assert.equal(root, path.join(process.cwd(), "public", "uploads"));
});

test("resolveUploadRoot: relative UPLOAD_DIR resolves against process.cwd()", () => {
  const root = resolveUploadRoot({ UPLOAD_DIR: "./public/uploads" });
  assert.equal(root, path.join(process.cwd(), "public", "uploads"));
});

test("resolveUploadRoot: a differently-shaped relative UPLOAD_DIR still resolves against process.cwd(), not some other base", () => {
  const root = resolveUploadRoot({ UPLOAD_DIR: "custom-uploads" });
  assert.equal(root, path.join(process.cwd(), "custom-uploads"));
});

test("resolveUploadRoot: absolute UPLOAD_DIR is used as-is", () => {
  const root = resolveUploadRoot({ UPLOAD_DIR: "/data/kinsen-uploads" });
  assert.equal(root, "/data/kinsen-uploads");
});

// ---------- LocalImageDriver: custom UPLOAD_DIR is actually used ----------

test("LocalImageDriver.upload: writes into the configured custom directory, not the public/uploads default", async (t) => {
  const tempRoot = await withTempDir(t);
  const driver = new LocalImageDriver(tempRoot);

  const { url } = await driver.upload(pngFile(), "content/home.hero");

  // Canonical public URL format is unchanged regardless of physical location.
  assert.match(url, /^\/uploads\/content\/home\.hero\/[0-9a-f-]{36}\.png$/);

  const filename = url.split("/").pop()!;
  const physicalPath = path.join(tempRoot, "content", "home.hero", filename);
  const written = await readFile(physicalPath);
  assert.deepEqual(written, PNG_BYTES);

  // Nothing was written to the real public/uploads default while a custom
  // root was configured — the two locations must never both receive files.
  const defaultPath = path.join(process.cwd(), "public", "uploads", "content", "home.hero", filename);
  await assert.rejects(readFile(defaultPath));
});

test("LocalImageDriver.remove: deletes the file from the same configured directory it was written to", async (t) => {
  const tempRoot = await withTempDir(t);
  const driver = new LocalImageDriver(tempRoot);

  const { url } = await driver.upload(pngFile(), "vehicles/veh_123");
  const filename = url.split("/").pop()!;
  const physicalPath = path.join(tempRoot, "vehicles", "veh_123", filename);

  await assert.doesNotReject(readFile(physicalPath));
  await driver.remove(url);
  await assert.rejects(readFile(physicalPath));
});

test("LocalImageDriver.upload: content and vehicle uploads share the same storage contract (same configured root, same public URL shape)", async (t) => {
  const tempRoot = await withTempDir(t);
  withEnv(t, "UPLOAD_DIR", tempRoot);
  withEnv(t, "UPLOAD_DRIVER", "local");

  const contentResult = await uploadContentImage(pngFile(), "warranty.hero");
  const vehicleResult = await uploadVehicleImage(pngFile(), "veh_abc");

  assert.match(contentResult.url, /^\/uploads\/content\/warranty\.hero\/[0-9a-f-]{36}\.png$/);
  assert.match(vehicleResult.url, /^\/uploads\/vehicles\/veh_abc\/[0-9a-f-]{36}\.png$/);

  await assert.doesNotReject(readFile(path.join(tempRoot, "content", "warranty.hero", contentResult.url.split("/").pop()!)));
  await assert.doesNotReject(readFile(path.join(tempRoot, "vehicles", "veh_abc", vehicleResult.url.split("/").pop()!)));

  await removeUploadedImage(contentResult.url);
  await removeUploadedImage(vehicleResult.url);
  await assert.rejects(readFile(path.join(tempRoot, "content", "warranty.hero", contentResult.url.split("/").pop()!)));
});

// ---------- default local path (no UPLOAD_DIR) ----------

test("LocalImageDriver: with no UPLOAD_DIR configured, uploads land under the real public/uploads (cleaned up after)", async (t) => {
  withEnv(t, "UPLOAD_DIR", undefined);
  withEnv(t, "UPLOAD_DRIVER", "local");

  const { url } = await uploadContentImage(pngFile(), "faq.hero");
  const filename = url.split("/").pop()!;
  const physicalPath = path.join(process.cwd(), "public", "uploads", "content", "faq.hero", filename);

  await assert.doesNotReject(readFile(physicalPath));
  t.after(async () => {
    await removeUploadedImage(url);
  });
});

// ---------- path traversal protection ----------

test("LocalImageDriver.upload: rejects a folder segment attempting to traverse above the upload root", async (t) => {
  const tempRoot = await withTempDir(t);
  const driver = new LocalImageDriver(tempRoot);

  await assert.rejects(driver.upload(pngFile(), "vehicles/../../../etc"), /unsafe path segment|escapes the configured upload root/);
  await assert.rejects(driver.upload(pngFile(), "../outside"), /unsafe path segment|escapes the configured upload root/);
});

test("LocalImageDriver.upload: a crafted vehicleId-shaped traversal segment (the actual attack surface — [id] is not whitelisted) is rejected", async (t) => {
  const tempRoot = await withTempDir(t);
  const driver = new LocalImageDriver(tempRoot);

  // Simulates what params.id would actually contain after Next.js decodes
  // a URL like /api/admin/vehicles/..%2F..%2F..%2Fetc/images — a decoded
  // "/" turns one dynamic route segment into several logical path parts.
  const maliciousVehicleId = decodeURIComponent("..%2F..%2F..%2Fetc");
  assert.equal(maliciousVehicleId, "../../../etc");
  await assert.rejects(driver.upload(pngFile(), `vehicles/${maliciousVehicleId}`));

  // Confirm nothing escaped: no file was written outside tempRoot.
  const outsideAttempt = path.join(tempRoot, "..", "etc");
  await assert.rejects(readFile(outsideAttempt));
});

test("LocalImageDriver.remove: a stored URL containing a traversal segment is refused, not resolved outside the root", async (t) => {
  const tempRoot = await withTempDir(t);
  const driver = new LocalImageDriver(tempRoot);

  // Should be a silent no-op (best-effort cleanup contract), never throw,
  // and never touch anything outside tempRoot.
  await assert.doesNotReject(driver.remove("/uploads/../../etc/passwd"));
});

// ---------- invalid / non-writable configuration fails loudly ----------

test("LocalImageDriver.upload: a non-writable configured root fails the upload with a clear error instead of a silent/fake success", async (t) => {
  const tempRoot = await withTempDir(t);
  await chmod(tempRoot, 0o400); // read-only for the owner; withTempDir's own cleanup restores permissions before removing it

  const driver = new LocalImageDriver(path.join(tempRoot, "nested"));
  await assert.rejects(driver.upload(pngFile(), "content/home.hero"), /could not be created/);
});

test("LocalImageDriver.upload: a configured root that is actually a file (not a directory) fails clearly", async (t) => {
  const tempRoot = await withTempDir(t);
  const fileAsRoot = path.join(tempRoot, "not-a-directory");
  await writeFile(fileAsRoot, "not a directory");

  const driver = new LocalImageDriver(fileAsRoot);
  await assert.rejects(driver.upload(pngFile(), "content/home.hero"), /could not be created/);
});

// ---------- unsupported file type still rejected server-side ----------

test("LocalImageDriver.upload: rejects a disallowed extension regardless of UPLOAD_DIR", async (t) => {
  const tempRoot = await withTempDir(t);
  const driver = new LocalImageDriver(tempRoot);
  const exeFile = new File([Buffer.from("not an image")], "payload.exe", { type: "application/octet-stream" });
  await assert.rejects(driver.upload(exeFile, "content/home.hero"), /Unsupported image type/);
});
