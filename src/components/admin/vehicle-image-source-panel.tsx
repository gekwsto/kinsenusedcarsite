import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  resolveVehicleImages,
  type VehicleForImageResolution,
  type VehicleImageSource,
} from "@/server/services/vehicle-image.service";

const SOURCE_LABELS: Record<VehicleImageSource, string> = {
  DATABASE: "Χειροκίνητο (Βάση Δεδομένων)",
  CDN: "Αυτόματο μέσω CDN (VIN)",
  FALLBACK: "Εφεδρική εικόνα",
};

const SOURCE_STYLES: Record<VehicleImageSource, string> = {
  DATABASE: "bg-emerald-100 text-emerald-800",
  CDN: "bg-sky-100 text-sky-800",
  FALLBACK: "bg-amber-100 text-amber-800",
};

/**
 * Read-only admin view of what `resolveVehicleImages` will actually show on
 * the public site for this vehicle. Purely informational — manual image
 * CRUD stays in VehicleImageManager, which only ever touches VehicleImage
 * rows and never these CDN-derived entries.
 */
export async function VehicleImageSourcePanel({ vin, images }: VehicleForImageResolution) {
  const resolved = await resolveVehicleImages({ vin, images });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>Πηγή εικόνων:</span>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", SOURCE_STYLES[resolved.source])}>
          {SOURCE_LABELS[resolved.source]}
        </span>
        {resolved.source === "CDN" && (
          <span className="text-xs">
            ({resolved.images.length} εικόν{resolved.images.length === 1 ? "α" : "ες"} από το CDN για VIN &quot;{vin}&quot;)
          </span>
        )}
      </div>

      {resolved.source === "CDN" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {resolved.images.map((image) => (
            <div key={image.id} className="relative aspect-[4/3] w-full overflow-hidden rounded-card border border-border bg-surface">
              <Image src={image.url} alt={image.alt ?? ""} fill sizes="200px" className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {resolved.source === "FALLBACK" && (
        <p className="text-sm text-ink-muted">
          Δεν υπάρχουν εικόνες βάσης δεδομένων ούτε έγκυρο VIN με διαθέσιμες εικόνες στο CDN — εμφανίζεται η εφεδρική εικόνα.
        </p>
      )}
    </div>
  );
}
