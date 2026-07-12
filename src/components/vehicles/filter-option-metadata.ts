// Presentation-only metadata for database-driven filter options — resolves
// a raw canonical value (exactly as stored in and queried against the
// database) to a purely decorative icon. This is metadata *about* an
// option, never the source of which options exist: a value absent from
// these maps still renders, using the shared fallback icon below — a new
// production transmission or vehicle-type string requires zero frontend
// code changes to appear in the filter UI.
//
// Icons are resolved here (inside a "use client" boundary) from a plain
// string key, never passed as a component/function from a Server
// Component — see getPublicFilterOptions (vehicle.service.ts), which
// returns only serializable string arrays.
import { Bus, Car, CarFront, Cog, Droplet, Fuel as FuelIcon, Leaf, Tag, Truck, Zap, type LucideIcon } from "lucide-react";

// `fuel` (like `transmissionType`/`typeOfCar`/`color`) is a free-text
// Prisma `String?` column, not a database enum — normalizeFuel()
// (vehicle-normalization.ts) can write more values than currently exist in
// this sample database (e.g. "Plug-in Hybrid", "Υγραέριο", "Φυσικό Αέριο"
// are valid ingestion targets with zero vehicles locally). The four keys
// below only assign a nicer icon to the currently most common values —
// resolveFuelIcon's fallback below is what actually keeps a fifth+ value
// selectable, exactly like the vehicle-type/transmission resolvers.
const FUEL_ICON_MAP: Record<string, LucideIcon> = {
  electric: Zap,
  hybrid: Leaf,
  "βενζίνη": FuelIcon,
  "πετρέλαιο": Droplet,
};

// Falls back to the generic fuel-pump icon for any value with no specific
// entry above — never hides or refuses to render an unrecognized fuel.
export function resolveFuelIcon(rawValue: string): LucideIcon {
  return FUEL_ICON_MAP[rawValue.trim().toLowerCase()] ?? FuelIcon;
}

const VEHICLE_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  suv: Car,
  sedan: CarFront,
  hatchback: Car,
  van: Bus,
  "πόλης": Car,
  wagon: Car,
  estate: Car,
  coupe: CarFront,
  cabrio: Car,
  convertible: Car,
  pickup: Truck,
};

// Falls back to a single neutral `Car` icon for anything not listed above
// — deliberately never `undefined`, so an unrecognized/new vehicle type
// never renders with a missing icon or gets hidden for lack of a mapping.
export function resolveVehicleTypeIcon(rawValue: string): LucideIcon {
  return VEHICLE_TYPE_ICON_MAP[rawValue.trim().toLowerCase()] ?? Car;
}

// Every known transmission family (automatic/manual/semi-automatic/CVT/...)
// deliberately resolves to the same neutral gearbox icon: there is no
// lucide-react icon set that distinguishes them without being misleading,
// and this task's own guidance prefers one consistent neutral icon over a
// guessed, potentially-wrong distinguishing one. Kept as a resolver
// function (not a bare constant) so a genuinely distinct icon for one
// specific family could be added later without touching any call site.
export function resolveTransmissionIcon(_rawValue: string): LucideIcon {
  return Cog;
}

export const DEALS_ICON: LucideIcon = Tag;
