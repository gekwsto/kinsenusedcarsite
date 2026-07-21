import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export { FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";

interface UploadResult {
  url: string;
}

interface ImageDriver {
  upload(file: File, folder: string): Promise<UploadResult>;
  remove(url: string): Promise<void>;
}

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

// Public URL prefix stored in the database and served by Next.js's static
// handler for the `public/` directory. This is independent of where the
// files physically live on disk (see resolveUploadRoot below) — Next only
// ever serves `public/uploads/**` at this fixed `/uploads/**` route, so the
// physical upload root must ultimately BE (or be mounted at) `<app>/public/
// uploads` for a stored URL to actually resolve; this constant must never
// be derived from UPLOAD_DIR.
const PUBLIC_URL_PREFIX = "/uploads";

// Resolves the physical directory uploads are written to and read/removed
// from, separately from PUBLIC_URL_PREFIX above:
//  - UPLOAD_DIR unset: local dev default, `<project root>/public/uploads`.
//  - UPLOAD_DIR absolute (e.g. Docker's `/app/public/uploads`): used as-is.
//  - UPLOAD_DIR relative (e.g. the shipped `.env.example` value
//    "./public/uploads"): resolved against `process.cwd()`, matching how
//    `next start`/`next dev`/Docker's `CMD` and this repo's own test runner
//    all already invoke the app from the project root — never assumed, a
//    caller needing a different base should pass an absolute path instead.
function resolveUploadRoot(env: Record<string, string | undefined> = process.env): string {
  const configured = env.UPLOAD_DIR;
  if (!configured) return path.join(process.cwd(), "public", "uploads");
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

// Rejects any path segment that isn't a plain single filename/directory
// component — no empty segments, no `.`/`..`, no embedded separators or
// null bytes. Applied to every `/`-delimited part of a caller-supplied
// `folder` (which, for vehicle images, embeds the `[id]` route param
// directly — never validated against a whitelist the way content's
// `sectionKey` is) so a crafted id/key can never escape the configured
// upload root.
function assertSafePathSegment(segment: string, label: string): void {
  if (!segment || segment === "." || segment === ".." || /[/\\\0]/.test(segment)) {
    throw new Error(`Invalid ${label}: unsafe path segment "${segment}"`);
  }
}

// Resolves `segments` under `root` and confirms the resolved absolute path
// is still contained within it — shared by LocalImageDriver's own upload/
// remove and by resolveLocalUploadPath below (the uploads route handler),
// so both writers and the one reader of these files agree on exactly the
// same containment rule.
function resolveWithinRoot(root: string, segments: string[]): string {
  const resolved = path.resolve(root, ...segments);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error("Resolved upload path escapes the configured upload root");
  }
  return resolved;
}

class LocalImageDriver implements ImageDriver {
  private readonly uploadRoot: string;

  constructor(uploadRoot: string = resolveUploadRoot()) {
    this.uploadRoot = uploadRoot;
  }

  async upload(file: File, folder: string): Promise<UploadResult> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported image type: .${ext}`);
    }

    const folderSegments = folder.split("/");
    folderSegments.forEach((segment) => assertSafePathSegment(segment, "folder"));

    const filename = `${randomUUID()}.${ext}`;
    assertSafePathSegment(filename, "filename");

    const targetDir = resolveWithinRoot(this.uploadRoot, folderSegments);
    try {
      await mkdir(targetDir, { recursive: true });
    } catch (cause) {
      throw new Error(
        `Upload directory "${targetDir}" (from UPLOAD_DIR="${process.env.UPLOAD_DIR ?? "(unset, using default)"}"): could not be created — check that it exists, is a directory, and is writable by the running process.`,
        { cause },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const destination = resolveWithinRoot(this.uploadRoot, [...folderSegments, filename]);
    try {
      await writeFile(destination, buffer);
    } catch (cause) {
      throw new Error(`Failed to write uploaded file to "${destination}"`, { cause });
    }

    return { url: `${PUBLIC_URL_PREFIX}/${folder}/${filename}` };
  }

  async remove(url: string): Promise<void> {
    const prefix = `${PUBLIC_URL_PREFIX}/`;
    if (!url.startsWith(prefix)) return;

    const relative = url.slice(prefix.length);
    const segments = relative.split("/");
    // Refuse to touch anything a malformed/tampered stored URL points
    // outside the upload root at — same containment guarantee as upload(),
    // applied defensively even though `url` normally only ever comes from
    // a value this driver itself generated.
    let filePath: string;
    try {
      segments.forEach((segment) => assertSafePathSegment(segment, "url segment"));
      filePath = resolveWithinRoot(this.uploadRoot, segments);
    } catch {
      return;
    }
    await unlink(filePath).catch(() => undefined);
  }
}

// Resolves a `/uploads/**` request's path segments (from the catch-all
// route handler at src/app/uploads/[...path]/route.ts — see that file for
// why a route handler exists here instead of relying on Next's built-in
// `public/` static serving) to the real file on disk, honoring the same
// UPLOAD_DIR and the same path-traversal containment guarantee as
// LocalImageDriver.upload/remove. Returns null for anything unsafe or
// empty rather than throwing, since the route handler's job for those is
// simply "404", not "500".
export function resolveLocalUploadPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  try {
    segments.forEach((segment) => assertSafePathSegment(segment, "url segment"));
    return resolveWithinRoot(resolveUploadRoot(), segments);
  } catch {
    return null;
  }
}

function getDriver(): ImageDriver {
  const driver = process.env.UPLOAD_DRIVER ?? "local";
  switch (driver) {
    case "local":
      return new LocalImageDriver();
    default:
      throw new Error(
        `Upload driver "${driver}" is not implemented yet. Only "local" is available in v1 — implement ImageDriver for s3/cloudinary and wire it up here.`,
      );
  }
}

export async function uploadVehicleImage(file: File, vehicleId: string): Promise<UploadResult> {
  return getDriver().upload(file, `vehicles/${vehicleId}`);
}

// `sectionKey` is a ContentKey (e.g. "home.hero") — kept as `string` here
// rather than importing that type to avoid this low-level upload module
// depending on the content-defaults module for a value it only ever uses
// as an opaque folder-name segment.
export async function uploadContentImage(file: File, sectionKey: string): Promise<UploadResult> {
  return getDriver().upload(file, `content/${sectionKey}`);
}

export async function removeUploadedImage(url: string): Promise<void> {
  return getDriver().remove(url);
}

// Exposed for tests only: lets the storage-contract test suite construct a
// driver against a temp directory and resolve the default root without
// mutating global `process.env` mid-suite.
export const __testing__ = { LocalImageDriver, resolveUploadRoot };
