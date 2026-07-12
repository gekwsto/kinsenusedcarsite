import Image from "next/image";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Gauge, Cog as EngineIcon, Fuel } from "lucide-react";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { Badge } from "@/components/ui/badge";
import { cn, formatEuro, formatKm, FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";

export type VehicleCardVariant = "default" | "featured" | "related" | "listing";

// Homepage "featured" grid only. Several rounds of a fancier hover effect
// (lift transform, navy/teal shadow, ring, GPU layer promotion) all
// produced rendering glitches around the top rounded corners during
// repeated hover in/out cycles. None of that machinery is worth the
// instability, so the featured hover treatment is deliberately reduced to
// the simplest thing that cannot glitch: a border that is transparent at
// rest and the accent teal on hover/focus, with no transition and nothing
// else (no transform, no shadow change, no extra elements, no
// `will-change`). A color with no animation and nothing else moving has no
// timing to race against and nothing to visually desync.
const FEATURED_BORDER_CLASSES = "border-transparent hover:border-accent focus-within:border-accent";

// Vehicle-detail "similar vehicles" grid only. Unlike `featured`, the
// border is the card's real, already-neutral resting border (never
// transparent) and smoothly transitions its *color* only — border-width
// never changes, so nothing shifts. Scoped to `transition-[border-color]`
// rather than `transition-colors` so no other property (text color,
// background) is ever implicated.
const RELATED_BORDER_CLASSES =
  "border-border transition-[border-color] duration-200 ease-out hover:border-accent focus-within:border-accent motion-reduce:transition-none";

// Main `/vehicles` listing grid only. Same real-border-only treatment as
// `related` (resting neutral border, only `border-color` transitions to the
// accent teal on hover/focus — never width, never a second layer), kept as
// its own variant so the listing grid's hover can be tuned independently of
// the vehicle-detail "similar vehicles" grid without touching that page.
const LISTING_BORDER_CLASSES =
  "border-border transition-[border-color] duration-200 ease-out hover:border-accent focus-within:border-accent motion-reduce:transition-none";

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
  model: string;
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

  const stats = [
    vehicle.km !== null && vehicle.km !== undefined ? { icon: Gauge, label: formatKm(vehicle.km) } : null,
    vehicle.cc !== null && vehicle.cc !== undefined ? { icon: EngineIcon, label: `${vehicle.cc}cc` } : null,
    vehicle.fuel ? { icon: Fuel, label: vehicle.fuel } : null,
  ].filter(Boolean) as { icon: typeof Gauge; label: string }[];

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border bg-white shadow-soft",
        variant === "featured"
          ? FEATURED_BORDER_CLASSES
          : variant === "related"
            ? RELATED_BORDER_CLASSES
            : variant === "listing"
              ? LISTING_BORDER_CLASSES
              : "border-border transition-shadow hover:shadow-card",
      )}
    >
      <FavoriteButton vehicleId={vehicle.id} className="absolute right-3 top-3 z-10" />

      <Link href={`/vehicles/${vehicle.slug}`} className="relative block h-[250px] w-full overflow-hidden bg-white">
        <Image
          src={mainImage}
          alt={`${vehicle.maker} ${vehicle.model}`}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain transition-transform duration-300 group-hover:scale-105"
        />
        {vehicle.offer && (
          <Badge className="absolute left-2.5 top-2.5 bg-offer font-normal text-white">Προσφορά</Badge>
        )}
      </Link>

      <Link href={`/vehicles/${vehicle.slug}`} className="flex flex-1 flex-col items-center gap-1.5 px-4 py-5 text-center">
        <h3 className="text-base font-semibold text-ink">
          {vehicle.maker} {vehicle.model}
        </h3>
        <p className="text-sm text-ink-muted">{vehicle.yearRelease ?? 0}</p>

        {vehicle.monthlyPrice ? (
          <p className="mt-1 text-xl font-bold text-ink">Από {formatEuro(vehicle.monthlyPrice)}</p>
        ) : vehicle.price ? (
          <p className="mt-1 text-xl font-bold text-ink">{formatEuro(vehicle.price)}</p>
        ) : null}
        {vehicle.monthlyPrice ? <p className="text-xs text-ink-muted">ανά μήνα + ΦΠΑ</p> : null}

        {stats.length > 0 && (
          <ul className="mt-3 flex w-full items-center justify-center gap-4 border-t border-border pt-3 text-xs text-ink-muted">
            {stats.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ul>
        )}
      </Link>
    </div>
  );
}
