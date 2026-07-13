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

// CarStock's `yearRelease` is usually a plain year ("2022" or 2022), but
// sometimes arrives as a full date-time string instead (observed live:
// "2/22/2022 12:00:00 AM"). Routing that through normalizeInt's
// parseFloat silently mis-parses it — parseFloat stops at the first
// non-numeric character, so "2/22/2022 ..." becomes 2, not 2022. A plain
// digits-only string/number is parsed directly (no Date involved, so no
// locale/format ambiguity); anything else is parsed as a date and only
// its year is kept.
export function normalizeYear(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;

  const str = String(raw).trim();
  if (str.length === 0) return null;

  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    return Number.isFinite(num) ? Math.round(num) : null;
  }

  const parsedDate = new Date(str);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getFullYear();
}

export function normalizeString(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  return str.length > 0 ? str : null;
}

export interface NormalizedVehicleInput {
  maker: string | null;
  model: string | null;
  versionName: string | null;
  yearRelease: number | null;
  price: number | null;
  monthlyPrice: number | null;
  km: number | null;
  cc: number | null;
  hp: number | null;
  discountType: string | null;
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
  maker?: unknown;
  model?: unknown;
  versionName?: unknown;
  yearRelease?: unknown;
  price?: unknown;
  monthlyPrice?: unknown;
  km?: unknown;
  cc?: unknown;
  hp?: unknown;
  discountType?: unknown;
  fuel?: unknown;
  transmissionType?: unknown;
  color?: unknown;
  offer?: unknown;
  froze?: unknown;
  isDeleted?: unknown;
  typeOfCar?: unknown;
  plate?: unknown;
  vin?: unknown;
}): NormalizedVehicleInput {
  return {
    maker: normalizeMaker(normalizeString(raw.maker)),
    model: normalizeModel(normalizeString(raw.model)),
    versionName: normalizeString(raw.versionName),
    yearRelease: normalizeYear(raw.yearRelease),
    price: normalizeNumber(raw.price),
    monthlyPrice: normalizeNumber(raw.monthlyPrice),
    km: normalizeInt(raw.km),
    cc: normalizeInt(raw.cc),
    hp: normalizeInt(raw.hp),
    discountType: normalizeString(raw.discountType),
    fuel: normalizeFuel(normalizeString(raw.fuel)),
    transmissionType: normalizeTransmission(normalizeString(raw.transmissionType)),
    color: normalizeColor(normalizeString(raw.color)),
    typeOfCar: normalizeTypeOfCar(normalizeString(raw.typeOfCar)),
    offer: normalizeBoolean(raw.offer),
    froze: normalizeBoolean(raw.froze),
    isDeleted: normalizeBoolean(raw.isDeleted),
    plate: normalizeString(raw.plate),
    vin: normalizeString(raw.vin),
  };
}
