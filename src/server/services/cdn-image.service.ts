/**
 * Talks to the Kinsen photo CDN. The CDN exposes a token-gated JSON "listing"
 * endpoint per VIN (directory contents, `[{ name, type, mtime, size }, ...]`)
 * and serves the actual image bytes from a separate, token-free public path.
 * Only this module knows the CDN's URL shape and response format — everything
 * else in the app works with plain `{ name, url }` results.
 */

export interface CdnImageFile {
  name: string;
  url: string;
}

interface CdnConfig {
  baseUrl: string;
  listPath: string;
  publicPath: string;
  listToken: string;
  fetchTimeoutMs: number;
  cacheTtlSeconds: number;
}

// Matches the CDN's raw directory-entry shape. `type` can be "file" or
// "directory" (subfolders can appear); only files matter to us.
interface CdnListingEntry {
  name?: unknown;
  type?: unknown;
}

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

// No path separators, no leading dot, no "..": blocks path traversal / bogus
// entries even though the CDN response is normally trustworthy.
const SAFE_IMAGE_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|avif)$/i;

// VINs are alphanumeric identifiers; this is intentionally looser than the
// strict 17-char/no-I-O-Q ISO VIN spec (real-world stock data isn't always
// perfectly clean) while still rejecting anything that could act as a path
// separator or traversal sequence in a URL segment.
const VIN_RE = /^[A-Za-z0-9]{5,20}$/;

let warnedMissingConfig = false;

export function normalizeVin(vin: string): string {
  return vin.trim().toUpperCase();
}

export function isValidVin(vin: string): boolean {
  return VIN_RE.test(vin);
}

function normalizePathSegment(segment: string): string {
  const withLeadingSlash = segment.startsWith("/") ? segment : `/${segment}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

function getCdnConfig(): CdnConfig | null {
  const baseUrl = process.env.CDN_BASE_URL?.trim();
  const listToken = process.env.CDN_LIST_TOKEN?.trim();

  if (!baseUrl || !listToken) {
    if (!warnedMissingConfig) {
      // Never log the token itself, only the fact that config is missing.
      console.warn("[cdn-image] CDN_BASE_URL / CDN_LIST_TOKEN not configured — CDN vehicle images are disabled");
      warnedMissingConfig = true;
    }
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    listPath: normalizePathSegment(process.env.CDN_VEHICLE_LIST_PATH || "/_list"),
    publicPath: normalizePathSegment(process.env.CDN_VEHICLE_PUBLIC_PATH || "/usedcars"),
    listToken,
    fetchTimeoutMs: Number(process.env.CDN_FETCH_TIMEOUT_MS) || 2500,
    cacheTtlSeconds: Number(process.env.CDN_CACHE_TTL_SECONDS) || 300,
  };
}

function buildCdnListingUrl(config: CdnConfig, vin: string): string {
  const encodedVin = encodeURIComponent(vin);
  // Trailing slash matters: the CDN 301-redirects without it, which would
  // cost an extra round trip on every uncached request.
  return `${config.baseUrl}${config.listPath}/${config.listToken}${config.publicPath}/${encodedVin}/`;
}

function buildCdnPublicImageUrl(config: CdnConfig, vin: string, filename: string): string {
  const encodedVin = encodeURIComponent(vin);
  const encodedFile = encodeURIComponent(filename);
  return `${config.baseUrl}${config.publicPath}/${encodedVin}/${encodedFile}`;
}

/**
 * Natural sort so `image2.jpg` sorts before `image10.jpg`. Splits each name
 * into alternating digit / non-digit runs and compares digit runs
 * numerically.
 */
export function naturalCompare(a: string, b: string): number {
  const chunksA = a.match(/\d+|\D+/g) ?? [a];
  const chunksB = b.match(/\d+|\D+/g) ?? [b];
  const length = Math.max(chunksA.length, chunksB.length);

  for (let i = 0; i < length; i++) {
    const chunkA = chunksA[i] ?? "";
    const chunkB = chunksB[i] ?? "";
    if (chunkA === chunkB) continue;

    const numA = Number(chunkA);
    const numB = Number(chunkB);
    const bothNumeric = chunkA !== "" && chunkB !== "" && !Number.isNaN(numA) && !Number.isNaN(numB);

    if (bothNumeric) {
      if (numA !== numB) return numA - numB;
    } else {
      return chunkA < chunkB ? -1 : 1;
    }
  }
  return 0;
}

function parseCdnListing(payload: unknown, config: CdnConfig, vin: string): CdnImageFile[] {
  if (!Array.isArray(payload)) return [];

  const filenames: string[] = [];
  for (const entry of payload as CdnListingEntry[]) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.type !== "file") continue;
    if (typeof entry.name !== "string") continue;

    const name = entry.name;
    if (!SAFE_IMAGE_FILENAME_RE.test(name)) continue;

    const extension = name.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) continue;

    filenames.push(name);
  }

  filenames.sort(naturalCompare);
  return filenames.map((name) => ({ name, url: buildCdnPublicImageUrl(config, vin, name) }));
}

/**
 * Fetches and parses the CDN's per-VIN image listing. Never throws — any
 * misconfiguration, invalid VIN, timeout, network failure, non-2xx status,
 * or malformed response simply resolves to an empty list so callers can fall
 * back safely. Uses Next.js's fetch data cache (`next.revalidate`) so repeat
 * requests for the same VIN within the cache window don't hit the CDN again,
 * and Next's automatic per-request fetch de-duplication so rendering the
 * same vehicle twice in one request (e.g. metadata + page body) only issues
 * one real request.
 */
export async function getCdnVehicleImageFiles(rawVin: string): Promise<CdnImageFile[]> {
  const vin = normalizeVin(rawVin);
  if (!isValidVin(vin)) return [];

  const config = getCdnConfig();
  if (!config) return [];

  const url = buildCdnListingUrl(config, vin);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
      next: { revalidate: config.cacheTtlSeconds, tags: [`cdn-vehicle-images:${vin}`] },
    });
  } catch (error) {
    console.warn(`[cdn-image] listing request failed for VIN ${vin}: ${errorMessage(error)}`);
    return [];
  }

  if (!response.ok) {
    if (response.status !== 404) {
      console.warn(`[cdn-image] listing request for VIN ${vin} returned HTTP ${response.status}`);
    }
    return [];
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.warn(`[cdn-image] listing response for VIN ${vin} was not valid JSON`);
    return [];
  }

  return parseCdnListing(payload, config, vin);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.name === "TimeoutError" ? "timed out" : error.message;
  return String(error);
}
