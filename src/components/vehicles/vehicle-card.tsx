import Image from "next/image";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Gauge, Cog as EngineIcon, Fuel } from "lucide-react";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { VehicleCompareToggle } from "@/components/vehicles/vehicle-compare-toggle";
import { Badge } from "@/components/ui/badge";
import { cn, formatEuro, formatKm, FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";
import type { VehicleComparisonSummary } from "@/lib/vehicle-comparison";

export type VehicleCardVariant = "default" | "featured" | "related" | "listing";

// Shared by the homepage "featured" carousel, the main `/vehicles` listing
// grid, and the vehicle-detail "Παρόμοια οχήματα" (similar vehicles) grid —
// all three are the same premium corporate card language, so they use one
// hover treatment: the resting border stays neutral and only very subtly
// deepens toward navy, while a soft navy-tinted shadow (the same
// `shadow-card` token used elsewhere on the site) does the actual work of
// signaling "hovered" — never a glow, never a color jump, never cyan
// (`related` cards previously used a bright `hover:border-accent` cyan
// outline with no shadow — removed in favor of this shared treatment).
// `featured` previously had its own separate, deliberately-reduced
// treatment (a plain instant border-color flip, no transition/shadow) to
// dodge a corner-rendering glitch a much heavier effect (lift transform +
// shadow + ring + GPU-layer promotion) produced under repeated hover
// in/out cycling. This treatment isn't that heavier combination — it's
// the exact border-color+box-shadow transition already proven stable in
// production on `/vehicles` — and was re-verified glitch-free under the
// same rapid hover-cycling in the carousel before adopting it here too, so
// no separate lift/transform was introduced for `related` either.
const CORPORATE_HOVER_BORDER_CLASSES =
  "border-border transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/20 hover:shadow-card focus-within:border-primary/20 focus-within:shadow-card motion-reduce:transition-none";

export interface VehicleCardImage {
  id: string;
  url: string;
  alt?: string | null;
  isMain?: boolean;
}

export interface VehicleCardVehicle {
  id: string;
  slug: string;
  maker: string;
  versionName: string;
  yearRelease?: number | null;
  price?: number | null;
  monthlyPrice?: number | null;
  km?: number | null;
  cc?: number | null;
  hp?: number | null;
  fuel?: string | null;
  transmissionType?: string | null;
  color?: string | null;
  typeOfCar?: string | null;
  offer?: boolean;
  images?: VehicleCardImage[];
}

export function VehicleCard({
  vehicle,
  priority = false,
  variant = "default",
}: {
  vehicle: VehicleCardVehicle;
  priority?: boolean;
  variant?: VehicleCardVariant;
}) {
  const mainImage =
    vehicle.images?.find((img) => img.isMain)?.url ?? vehicle.images?.[0]?.url ?? FALLBACK_VEHICLE_IMAGE;

  const comparisonSummary: VehicleComparisonSummary = {
    id: vehicle.id,
    slug: vehicle.slug,
    maker: vehicle.maker,
    versionName: vehicle.versionName,
    yearRelease: vehicle.yearRelease ?? null,
    price: vehicle.price ?? null,
    monthlyPrice: vehicle.monthlyPrice ?? null,
    km: vehicle.km ?? null,
    imageUrl: mainImage,
    fuel: vehicle.fuel ?? null,
    transmissionType: vehicle.transmissionType ?? null,
  };

  const stats = [
    vehicle.km !== null && vehicle.km !== undefined ? { icon: Gauge, label: formatKm(vehicle.km) } : null,
    vehicle.cc !== null && vehicle.cc !== undefined ? { icon: EngineIcon, label: `${vehicle.cc}cc` } : null,
    vehicle.fuel ? { icon: Fuel, label: vehicle.fuel } : null,
  ].filter(Boolean) as { icon: typeof Gauge; label: string }[];

  return (
    <div
      role="group"
      aria-label={vehicle.versionName}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border bg-white shadow-soft",
        variant === "related" || variant === "featured" || variant === "listing"
          ? CORPORATE_HOVER_BORDER_CLASSES
          : "border-border transition-shadow hover:shadow-card",
      )}
    >
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <VehicleCompareToggle vehicle={comparisonSummary} size="sm" />
        <FavoriteButton vehicleId={vehicle.id} size="sm" />
      </div>

      <Link href={`/vehicles/${vehicle.slug}`} className="relative block h-[250px] w-full overflow-hidden bg-white">
        <Image
          src={mainImage}
          alt={vehicle.versionName}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain transition-transform duration-300 group-hover:scale-105"
        />
        {vehicle.offer && (
          <Badge className="absolute left-2.5 top-2.5 rounded-md bg-primary font-semibold text-white lg:px-3 lg:py-1.5 lg:text-[0.8rem] 2xl:text-sm">
            Προσφορά
          </Badge>
        )}
      </Link>

      <Link href={`/vehicles/${vehicle.slug}`} className="flex flex-1 flex-col items-center gap-1 px-4 py-5 text-center">
        <h3 className="text-base font-semibold leading-snug text-ink lg:text-[1.05rem] 2xl:text-lg">{vehicle.versionName}</h3>
        <p className="text-sm font-medium text-ink-muted">{vehicle.yearRelease ?? 0}</p>

        {vehicle.monthlyPrice ? (
          <p className="mt-1 text-xl font-bold text-ink lg:text-2xl">Από {formatEuro(vehicle.monthlyPrice)}</p>
        ) : vehicle.price ? (
          <p className="mt-1 text-xl font-bold text-ink lg:text-2xl">{formatEuro(vehicle.price)}</p>
        ) : null}
        {vehicle.monthlyPrice ? <p className="text-xs text-ink-muted">ανά μήνα + ΦΠΑ</p> : null}

        {stats.length > 0 && (
          <ul className="mt-3 flex w-full items-center justify-center gap-4 border-t border-border pt-3 text-xs text-ink-muted lg:text-[0.8rem]">
            {stats.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                <span className="truncate font-semibold text-ink">{label}</span>
              </li>
            ))}
          </ul>
        )}
      </Link>
    </div>
  );
}
