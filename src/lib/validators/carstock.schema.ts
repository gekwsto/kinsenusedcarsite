import { z } from "zod";

/**
 * The real, currently-integrated CarStock system sends lower-camel-case
 * field names (carId, yearRelease, typeOfDiscount, ...). This is the
 * contract to validate against by default.
 */
const realCarStockItemSchema = z.object({
  carId: z.union([z.string(), z.number()]),
  maker: z.string().optional(),
  model: z.string().optional(),
  versionName: z.string().optional(),
  yearRelease: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  km: z.union([z.string(), z.number()]).optional(),
  cc: z.union([z.string(), z.number()]).optional(),
  hp: z.union([z.string(), z.number()]).optional(),
  typeOfDiscount: z.string().optional(),
  fuel: z.string().optional(),
  transmissionType: z.string().optional(),
  color: z.string().optional(),
  typeOfCar: z.string().optional(),
  // Carried through validation for logging/traceability only. See the
  // `imageUrl` comment on CarStockCanonicalItem for why this never reaches
  // vehicle image resolution.
  image_url: z.string().optional(),
  offer: z.union([z.boolean(), z.string(), z.number()]).optional(),
  froze: z.union([z.boolean(), z.string(), z.number()]).optional(),
  delete: z.union([z.boolean(), z.string(), z.number()]).optional(),
  rent: z.union([z.string(), z.number()]).optional(),
  vin: z.string().optional(),
});

/**
 * The previously-defined PascalCase contract. Kept only so any caller still
 * emitting the old shape keeps working; the real system does not send this.
 */
const legacyCarStockItemSchema = z.object({
  CarId: z.union([z.string(), z.number()]),
  Maker: z.string().optional(),
  Model: z.string().optional(),
  YearRelease: z.union([z.string(), z.number()]).optional(),
  Price: z.union([z.string(), z.number()]).optional(),
  MonthlyPrice: z.union([z.string(), z.number()]).optional(),
  Km: z.union([z.string(), z.number()]).optional(),
  Cc: z.union([z.string(), z.number()]).optional(),
  Hp: z.union([z.string(), z.number()]).optional(),
  Fuel: z.string().optional(),
  TransmissionType: z.string().optional(),
  Color: z.string().optional(),
  Offer: z.union([z.boolean(), z.string(), z.number()]).optional(),
  Froze: z.union([z.boolean(), z.string(), z.number()]).optional(),
  Delete: z.union([z.boolean(), z.string(), z.number()]).optional(),
  TypeOfCar: z.string().optional(),
  Plate: z.string().optional(),
  VIN: z.string().optional(),
});

/**
 * Single internal shape every downstream consumer (import.service,
 * vehicle.service, normalizeVehiclePayload) reads from. Both wire formats
 * above are remapped into this one via `normalizeCarStockItemKeys` *before*
 * zod validates it, so nothing past the schema boundary ever has to know
 * which casing a given feed push used.
 */
const carStockCanonicalItemSchema = z.object({
  carId: z.union([z.string(), z.number()]),
  maker: z.string().optional(),
  model: z.string().optional(),
  versionName: z.string().optional(),
  yearRelease: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  monthlyPrice: z.union([z.string(), z.number()]).optional(),
  km: z.union([z.string(), z.number()]).optional(),
  cc: z.union([z.string(), z.number()]).optional(),
  hp: z.union([z.string(), z.number()]).optional(),
  discountType: z.string().optional(),
  fuel: z.string().optional(),
  transmissionType: z.string().optional(),
  color: z.string().optional(),
  typeOfCar: z.string().optional(),
  // Deliberately never consumed by stockDataFromNormalized /
  // stockUpdateDataFromRaw. Vehicle photos come from admin-managed
  // VehicleImage rows or the VIN-keyed CDN (see
  // src/server/services/vehicle-image.service.ts) — a stray/stale
  // image_url from the feed must never silently replace either.
  imageUrl: z.string().optional(),
  offer: z.union([z.boolean(), z.string(), z.number()]).optional(),
  froze: z.union([z.boolean(), z.string(), z.number()]).optional(),
  isDeleted: z.union([z.boolean(), z.string(), z.number()]).optional(),
  plate: z.string().optional(),
  vin: z.string().optional(),
});

export type CarStockPayloadItem = z.infer<typeof carStockCanonicalItemSchema>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Format detection: the real feed sends `carId` (lower camel); the legacy
 * contract sent `CarId` (Pascal). Only `carId` is required in either shape,
 * so its casing alone is sufficient to route the rest of the object.
 */
function isLegacyShape(raw: Record<string, unknown>): boolean {
  return raw.CarId !== undefined && raw.carId === undefined;
}

function fromLegacyShape(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    carId: raw.CarId,
    maker: raw.Maker,
    model: raw.Model,
    yearRelease: raw.YearRelease,
    price: raw.Price,
    monthlyPrice: raw.MonthlyPrice,
    km: raw.Km,
    cc: raw.Cc,
    hp: raw.Hp,
    fuel: raw.Fuel,
    transmissionType: raw.TransmissionType,
    color: raw.Color,
    typeOfCar: raw.TypeOfCar,
    offer: raw.Offer,
    froze: raw.Froze,
    isDeleted: raw.Delete,
    plate: raw.Plate,
    vin: raw.VIN,
  };
}

function fromRealShape(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    carId: raw.carId,
    maker: raw.maker,
    model: raw.model,
    versionName: raw.versionName,
    yearRelease: raw.yearRelease,
    price: raw.price,
    monthlyPrice: raw.rent,
    km: raw.km,
    cc: raw.cc,
    hp: raw.hp,
    discountType: raw.typeOfDiscount,
    fuel: raw.fuel,
    transmissionType: raw.transmissionType,
    color: raw.color,
    typeOfCar: raw.typeOfCar,
    imageUrl: raw.image_url,
    offer: raw.offer,
    froze: raw.froze,
    isDeleted: raw.delete,
    vin: raw.vin,
  };
}

/** Exported for direct unit testing of the format-detection/remap step. */
export function normalizeCarStockItemKeys(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw;
  return isLegacyShape(raw) ? fromLegacyShape(raw) : fromRealShape(raw);
}

export const carStockItemSchema = z.preprocess(normalizeCarStockItemKeys, carStockCanonicalItemSchema);

export const carStockPayloadSchema = z.array(carStockItemSchema).min(1);

// Exported for tests/tooling that want to validate a single wire format
// directly without going through the compatibility preprocessing step.
export { realCarStockItemSchema, legacyCarStockItemSchema };
