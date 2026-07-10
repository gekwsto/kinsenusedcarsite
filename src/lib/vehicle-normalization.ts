/**
 * Central normalization for values arriving from the external stock feed or
 * admin forms. Add new synonym mappings here rather than special-casing
 * makers/fuels/colors in business logic or components.
 */

type Mapping = Record<string, string>;

const FUEL_MAP: Mapping = {
  petrol: "Βενζίνη",
  gasoline: "Βενζίνη",
  "βενζίνη": "Βενζίνη",
  diesel: "Πετρέλαιο",
  "πετρέλαιο": "Πετρέλαιο",
  hybrid: "Hybrid",
  "υβριδικό": "Hybrid",
  "plug-in hybrid": "Plug-in Hybrid",
  phev: "Plug-in Hybrid",
  electric: "Electric",
  "ηλεκτρικό": "Electric",
  ev: "Electric",
  lpg: "Υγραέριο",
  "υγραέριο": "Υγραέριο",
  cng: "Φυσικό Αέριο",
};

const TRANSMISSION_MAP: Mapping = {
  automatic: "Αυτόματο",
  "αυτόματο": "Αυτόματο",
  auto: "Αυτόματο",
  manual: "Χειροκίνητο",
  "χειροκίνητο": "Χειροκίνητο",
  "semi-automatic": "Ημιαυτόματο",
  "ημιαυτόματο": "Ημιαυτόματο",
};

const TYPE_OF_CAR_MAP: Mapping = {
  city: "Πόλης",
  "πόλης": "Πόλης",
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  van: "Van",
  wagon: "Wagon",
  estate: "Wagon",
  coupe: "Coupe",
  cabrio: "Cabrio",
  convertible: "Cabrio",
  pickup: "Pickup",
};

const MAKER_MAP: Mapping = {
  vw: "Volkswagen",
  "volkswagen": "Volkswagen",
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
};

function lookup(map: Mapping, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return map[key] ?? raw.trim();
}

export function normalizeFuel(raw: string | null | undefined): string | null {
  return lookup(FUEL_MAP, raw);
}

export function normalizeTransmission(raw: string | null | undefined): string | null {
  return lookup(TRANSMISSION_MAP, raw);
}

export function normalizeTypeOfCar(raw: string | null | undefined): string | null {
  return lookup(TYPE_OF_CAR_MAP, raw);
}

export function normalizeMaker(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const mapped = MAKER_MAP[raw.trim().toLowerCase()];
  if (mapped) return mapped;
  return raw.trim().replace(/\s+/g, " ");
}

export function normalizeModel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().replace(/\s+/g, " ");
}

export function normalizeColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function normalizeBoolean(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    return ["true", "1", "yes", "ναι"].includes(raw.trim().toLowerCase());
  }
  return false;
}

export function normalizeNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "string" ? parseFloat(raw.replace(",", ".")) : Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function normalizeInt(raw: unknown): number | null {
  const num = normalizeNumber(raw);
  return num === null ? null : Math.round(num);
}

export function normalizeString(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  return str.length > 0 ? str : null;
}

export interface NormalizedVehicleInput {
  maker: string | null;
  model: string | null;
  yearRelease: number | null;
  price: number | null;
  monthlyPrice: number | null;
  km: number | null;
  cc: number | null;
  hp: number | null;
  fuel: string | null;
  transmissionType: string | null;
  color: string | null;
  typeOfCar: string | null;
  offer: boolean;
  froze: boolean;
  isDeleted: boolean;
  plate: string | null;
  vin: string | null;
}

export function normalizeVehiclePayload(raw: {
  Maker?: unknown;
  Model?: unknown;
  YearRelease?: unknown;
  Price?: unknown;
  MonthlyPrice?: unknown;
  Km?: unknown;
  Cc?: unknown;
  Hp?: unknown;
  Fuel?: unknown;
  TransmissionType?: unknown;
  Color?: unknown;
  Offer?: unknown;
  Froze?: unknown;
  Delete?: unknown;
  TypeOfCar?: unknown;
  Plate?: unknown;
  VIN?: unknown;
}): NormalizedVehicleInput {
  return {
    maker: normalizeMaker(normalizeString(raw.Maker)),
    model: normalizeModel(normalizeString(raw.Model)),
    yearRelease: normalizeInt(raw.YearRelease),
    price: normalizeNumber(raw.Price),
    monthlyPrice: normalizeNumber(raw.MonthlyPrice),
    km: normalizeInt(raw.Km),
    cc: normalizeInt(raw.Cc),
    hp: normalizeInt(raw.Hp),
    fuel: normalizeFuel(normalizeString(raw.Fuel)),
    transmissionType: normalizeTransmission(normalizeString(raw.TransmissionType)),
    color: normalizeColor(normalizeString(raw.Color)),
    typeOfCar: normalizeTypeOfCar(normalizeString(raw.TypeOfCar)),
    offer: normalizeBoolean(raw.Offer),
    froze: normalizeBoolean(raw.Froze),
    isDeleted: normalizeBoolean(raw.Delete),
    plate: normalizeString(raw.Plate),
    vin: normalizeString(raw.VIN),
  };
}
