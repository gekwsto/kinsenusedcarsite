import { z } from "zod";

const optionalNumber = z.coerce.number().optional().nullable();
const optionalInt = z.coerce.number().int().optional().nullable();

export const vehicleAdminSchema = z.object({
  externalCarId: z.string().optional().nullable(),
  maker: z.string().min(1, "Ο κατασκευαστής είναι υποχρεωτικός"),
  model: z.string().min(1, "Το μοντέλο είναι υποχρεωτικό"),
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

export const vehicleSortEnum = z.enum([
  "newest",
  "price_asc",
  "price_desc",
  "monthly_asc",
  "monthly_desc",
  "year_desc",
  "km_asc",
]);

export const vehicleFilterSchema = z.object({
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
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
  sort: vehicleSortEnum.optional().default("newest"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(48).optional().default(12),
});

export type VehicleFilterInput = z.infer<typeof vehicleFilterSchema>;
