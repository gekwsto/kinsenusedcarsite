import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveLocalUploadPath } from "@/lib/images";

// Serves uploaded files at the exact same `/uploads/**` public URL that has
// always been stored in the database (no persisted-URL/schema change) —
// but through an explicit, always-dynamic route handler instead of relying
// on Next.js's built-in `public/` static file serving.
//
// Root cause this works around: Next.js (confirmed here on 16.2.10 with
// Turbopack, both `next build && next start`) resolves `public/**` against
// a manifest snapshotted at build time. A file written to `public/uploads/
// **` by LocalImageDriver.upload() *after* the server has started (i.e.
// every real admin upload) isn't in that snapshot, so the request falls
// through to normal App Router matching, resolves to the app's not-found
// boundary, and — because that response is otherwise a completely ordinary
// cacheable route response — gets full-route-cached as a 404
// (`x-nextjs-cache: HIT`, confirmed via curl -v against a file that
// verifiably exists on disk). That 404 does not self-heal; it persists
// until the cache entry's stale-time elapses, and a differently-named file
// (this driver's uploads are always fresh random UUIDs) would 404 the same
// way every time. Matching this exact path with a real route handler wins
// App Router's routing before the not-found boundary is ever reached, and
// a route handler reads the file fresh from disk on every request — no
// build-time manifest involved, so newly-written files are always visible
// immediately.
//
// UUID filenames (see LocalImageDriver.upload) make every URL under this
// route content-addressed and immutable — a replacement image always gets
// a new filename, never overwrites an old one — so far-future, immutable
// caching here is safe and is exactly what makes "replace an image" work
// without any cache-busting query strings.
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = resolveLocalUploadPath(segments);
  if (!filePath) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse(null, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
