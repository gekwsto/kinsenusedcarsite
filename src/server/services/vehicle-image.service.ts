/**
 * Centralized vehicle image resolution. This is the single place that
 * decides which images a vehicle shows, in this order of precedence:
 *
 *   1. DATABASE — manually managed VehicleImage records, if any exist.
 *   2. CDN       — images listed on the Kinsen photo CDN for the vehicle's VIN.
 *   3. FALLBACK  — the static Kinsen placeholder image.
 *
 * Every public surface (listing cards, detail gallery, similar vehicles,
 * homepage featured section, admin preview) should go through
 * `resolveVehicleImages` / `resolveVehicleImagesForList` rather than reading
 * `vehicle.images` or building CDN URLs itself.
 */
import { FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getCdnVehicleImageFiles } from "@/server/services/cdn-image.service";

export type VehicleImageSource = "DATABASE" | "CDN" | "FALLBACK";

export interface ResolvedImage {
  id: string;
  url: string;
  alt: string | null;
}

export interface ResolvedVehicleImages {
  source: VehicleImageSource;
  images: ResolvedImage[];
  mainImage: ResolvedImage;
}

export interface VehicleImageRecordLike {
  id: string;
  url: string;
  alt: string | null;
  isMain: boolean;
  sortOrder: number;
}

export interface VehicleForImageResolution {
  vin: string | null;
  images: VehicleImageRecordLike[];
}

const FALLBACK_IMAGE: ResolvedImage = { id: "fallback", url: FALLBACK_VEHICLE_IMAGE, alt: null };

const LIST_RESOLUTION_CONCURRENCY = Number(process.env.CDN_LIST_CONCURRENCY) || 6;

function toResolvedDbImage(image: VehicleImageRecordLike): ResolvedImage {
  return { id: image.id, url: image.url, alt: image.alt };
}

/**
 * Resolves the final image set for a single vehicle. Never throws — a CDN
 * failure degrades to the fallback image rather than breaking the page.
 */
export async function resolveVehicleImages(vehicle: VehicleForImageResolution): Promise<ResolvedVehicleImages> {
  if (vehicle.images.length > 0) {
    const sorted = [...vehicle.images].sort((a, b) => a.sortOrder - b.sortOrder);
    const mainRecord = sorted.find((image) => image.isMain) ?? sorted[0]!;
    return {
      source: "DATABASE",
      images: sorted.map(toResolvedDbImage),
      mainImage: toResolvedDbImage(mainRecord),
    };
  }

  const vin = vehicle.vin?.trim();
  if (vin) {
    try {
      const files = await getCdnVehicleImageFiles(vin);
      if (files.length > 0) {
        const images = files.map((file) => ({ id: `cdn:${file.name}`, url: file.url, alt: null }));
        return { source: "CDN", images, mainImage: images[0]! };
      }
    } catch (error) {
      // getCdnVehicleImageFiles already swallows its own errors, but this
      // guards against any future change there breaking image resolution.
      console.error(`[vehicle-image] unexpected error resolving CDN images for VIN ${vin}`, error);
    }
  }

  return { source: "FALLBACK", images: [FALLBACK_IMAGE], mainImage: FALLBACK_IMAGE };
}

/**
 * Batch variant for grids (listing page, similar vehicles, homepage
 * featured, favorites). Runs CDN lookups with bounded concurrency so
 * rendering N vehicles never fires N simultaneous CDN requests, and replaces
 * each vehicle's `images` with just the resolved main image — grids only
 * ever show one thumbnail per card.
 */
export async function resolveVehicleImagesForList<T extends VehicleForImageResolution>(
  vehicles: T[],
): Promise<Array<Omit<T, "images"> & { images: ResolvedImage[] }>> {
  return mapWithConcurrency(vehicles, LIST_RESOLUTION_CONCURRENCY, async (vehicle) => {
    try {
      const resolved = await resolveVehicleImages(vehicle);
      return { ...vehicle, images: [resolved.mainImage] };
    } catch (error) {
      console.error("[vehicle-image] unexpected error during list image resolution", error);
      return { ...vehicle, images: [FALLBACK_IMAGE] };
    }
  });
}
