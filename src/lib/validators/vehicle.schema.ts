import { z } from "zod";

const optionalNumber = z.coerce.number().optional().nullable();
const optionalInt = z.coerce.number().int().optional().nullable();

export const vehicleAdminSchema = z.object({
  externalCarId: z.string().optional().nullable(),
  maker: z.string().min(1, "Ο κατασκευαστής είναι υποχρεωτικός"),
  model: z.string().min(1, "Το μοντέλο είναι υποχρεωτικό"),
  versionName: z.string().min(1, "Η έκδοση είναι υποχρεωτική"),
  yearRelease: optionalInt,
  price: optionalNumber,
  monthlyPrice: optionalNumber,
  km: optionalInt,
  cc: optionalInt,
  hp: optionalInt,
  fuel: z.string().optional().nullable(),
  transmissionType: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  typeOfCar: z.string().optional().nullable(),
  offer: z.coerce.boolean().default(false),
  froze: z.coerce.boolean().default(false),
  isDeleted: z.coerce.boolean().default(false),
  plate: z.string().optional().nullable(),
  vin: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  slug: z.string().optional(),
});

export type VehicleAdminInput = z.infer<typeof vehicleAdminSchema>;

// For PATCH: every field must be genuinely optional with NO default, so a
// field the caller omits comes through as `undefined` (leave unchanged) —
// not coerced to `false`/`null` like the create schema's `.default()`s do.
// Using vehicleAdminSchema directly for updates silently nulls out any
// field an update request doesn't happen to include (e.g. externalCarId).
export const vehicleAdminUpdateSchema = vehicleAdminSchema
  .omit({ offer: true, froze: true, isDeleted: true })
  .partial()
  .extend({
    offer: z.coerce.boolean().optional(),
    froze: z.coerce.boolean().optional(),
    isDeleted: z.coerce.boolean().optional(),
  });

export type VehicleAdminUpdateInput = z.infer<typeof vehicleAdminUpdateSchema>;

// "recommended" preserves the existing default business ordering (newest
// listings first — see buildOrderBy in vehicle.service.ts) under a
// URL-neutral name; the other six are the explicit numeric sort directions
// the /vehicles results toolbar exposes. A missing `sort` param resolves to
// "recommended" via `.default(...)` below; an unrecognized one (a stale
// bookmark using the old `price_asc`-style names, or a malformed external
// URL) fails enum validation, which — via the existing whole-object
// safeParse-then-fallback pattern in vehicles/page.tsx — safely resets the
// full filter set to defaults rather than ever producing a server error.
export const vehicleSortEnum = z.enum([
  "recommended",
  "price-desc",
  "price-asc",
  "mileage-asc",
  "mileage-desc",
  "engine-asc",
  "engine-desc",
]);

export type VehicleSort = z.infer<typeof vehicleSortEnum>;

// One centralized business-level price-filter range, shared by the client
// slider UI (src/components/vehicles/price-range-slider.tsx) and this
// schema's own clamping below, so the UI can never offer a value the
// server would treat differently. A direct URL with an out-of-range value
// (`?maxPrice=999999`, `?minPrice=-100`) is clamped into range rather than
// rejected — rejecting would fail the *entire* filter object under the
// existing whole-object safeParse-then-fallback pattern (see
// vehicles/page.tsx), silently discarding unrelated valid filters over one
// out-of-range number, which clamping avoids.
export const VEHICLE_PRICE_FILTER_MIN = 0;
export const VEHICLE_PRICE_FILTER_MAX = 50_000;
export const VEHICLE_PRICE_FILTER_STEP = 500;

// Single source of truth for the year/mileage/cc/hp dropdown option
// boundaries (src/components/vehicles/numeric-range-select.tsx, fed via
// createNumericRange in src/lib/numeric-range.ts). Unlike
// VEHICLE_PRICE_FILTER_MIN/MAX above, these are *not* a hard clamp on the
// query value — they only bound which choices the dropdowns offer. A
// direct URL outside this range (e.g. `?minMileage=5000`, below the
// 10,000 dropdown floor) is still honored as-is by the server query; see
// buildPublicFilterWhere in vehicle.service.ts, which has never clamped
// these four fields and isn't changed by this config's introduction.
export const VEHICLE_FILTER_RANGES = {
  year: { min: 2010, max: 2026, step: 1 },
  mileage: { min: 10_000, max: 250_000, step: 10_000 },
  engineCc: { min: 1_000, max: 2_500, step: 100 },
  horsepower: { min: 80, max: 250, step: 10 },
} as const;

function clampPrice(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.min(VEHICLE_PRICE_FILTER_MAX, Math.max(VEHICLE_PRICE_FILTER_MIN, value));
}

export const vehicleFilterSchema = z.object({
  priceMin: z.coerce.number().optional().transform(clampPrice),
  priceMax: z.coerce.number().optional().transform(clampPrice),
  monthlyPriceMin: z.coerce.number().optional(),
  monthlyPriceMax: z.coerce.number().optional(),
  maker: z.string().optional(),
  model: z.string().optional(),
  yearMin: z.coerce.number().optional(),
  yearMax: z.coerce.number().optional(),
  kmMin: z.coerce.number().optional(),
  kmMax: z.coerce.number().optional(),
  fuel: z.string().optional(),
  transmissionType: z.string().optional(),
  color: z.string().optional(),
  typeOfCar: z.string().optional(),
  ccMin: z.coerce.number().optional(),
  ccMax: z.coerce.number().optional(),
  hpMin: z.coerce.number().optional(),
  hpMax: z.coerce.number().optional(),
  offerOnly: z.coerce.boolean().optional(),
  availableOnly: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sort: vehicleSortEnum.optional().default("recommended"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(48).optional().default(12),
});

export type VehicleFilterInput = z.infer<typeof vehicleFilterSchema>;
