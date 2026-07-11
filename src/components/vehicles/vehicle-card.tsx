import Image from "next/image";
import Link from "next/link";
import { Gauge, Cog as EngineIcon, Fuel } from "lucide-react";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { Badge } from "@/components/ui/badge";
import { formatEuro, formatKm, FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";

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

export function VehicleCard({ vehicle, priority = false }: { vehicle: VehicleCardVehicle; priority?: boolean }) {
  const mainImage =
    vehicle.images?.find((img) => img.isMain)?.url ?? vehicle.images?.[0]?.url ?? FALLBACK_VEHICLE_IMAGE;

  const stats = [
    vehicle.km !== null && vehicle.km !== undefined ? { icon: Gauge, label: formatKm(vehicle.km) } : null,
    vehicle.cc !== null && vehicle.cc !== undefined ? { icon: EngineIcon, label: `${vehicle.cc}cc` } : null,
    vehicle.fuel ? { icon: Fuel, label: vehicle.fuel } : null,
  ].filter(Boolean) as { icon: typeof Gauge; label: string }[];

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-white shadow-soft transition-shadow hover:shadow-card">
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
