import { z } from "zod";

/**
 * carId is the authoritative CarStock identity (-> Vehicle.externalCarId,
 * see vehicle.service.ts). A string carId must be trimmed and non-empty —
 * `""`/whitespace-only can never normalize into a stored externalCarId, so
 * it is rejected here rather than silently becoming an empty-string
 * identity. Numeric carIds are preserved as-is: the existing CarStock
 * contract already supports both string and number, and this hardening
 * pass narrows only the string case, not the wire type itself. Shared by
 * every CarStock schema that accepts a carId — CREATE, PUT, and bulk
 * DELETE — so the identity rule can't drift between endpoints.
 */
const carStockCarIdSchema = z.union([z.string().trim().min(1, "carId must not be blank"), z.number()]);

/**
 * `ExtrasDTO` entries as CarStock sends them: `{ "displayName": "Navigation" }`.
 * Deliberately lenient (missing/null displayName is allowed at the schema
 * level) — blank-trimming and dropping empty entries happens downstream in
 * normalizeExtras (src/lib/vehicle-normalization.ts), the single place that
 * owns "what counts as a persistable extra".
 */
const carStockExtraDtoSchema = z.object({
  displayName: z.string().nullish(),
});

const carStockExtrasDtoArraySchema = z.array(carStockExtraDtoSchema).nullish();

/**
 * The real, currently-integrated CarStock system sends lower-camel-case
 * field names (carId, yearRelease, typeOfDiscount, ...). This is the
 * contract to validate against by default.
 */
const realCarStockItemSchema = z.object({
  carId: carStockCarIdSchema,
  maker: z.string().nullish(),
  model: z.string().nullish(),
  versionName: z.string().nullish(),
  // `.nullish()` (not just `.optional()`) on every CarStock-owned data field
  // below: the PUT full-replacement contract sends explicit JSON `null` to
  // mean "clear this field" (see applyCarStockFullUpdate in
  // vehicle.service.ts), so the schema boundary must accept `null`, not just
  // a missing key, or a real full-replacement payload would fail validation.
  yearRelease: z.union([z.string(), z.number()]).nullish(),
  price: z.union([z.string(), z.number()]).nullish(),
  km: z.union([z.string(), z.number()]).nullish(),
  cc: z.union([z.string(), z.number()]).nullish(),
  hp: z.union([z.string(), z.number()]).nullish(),
  typeOfDiscount: z.string().nullish(),
  fuel: z.string().nullish(),
  transmissionType: z.string().nullish(),
  color: z.string().nullish(),
  typeOfCar: z.string().nullish(),
  // Carried through validation for logging/traceability only. See the
  // `imageUrl` comment on CarStockCanonicalItem for why this never reaches
  // vehicle image resolution.
  image_url: z.string().nullish(),
  offer: z.union([z.boolean(), z.string(), z.number()]).optional(),
  froze: z.union([z.boolean(), z.string(), z.number()]).optional(),
  delete: z.union([z.boolean(), z.string(), z.number()]).optional(),
  rent: z.union([z.string(), z.number()]).nullish(),
  vin: z.string().nullish(),
  ExtrasDTO: carStockExtrasDtoArraySchema,
});

/**
 * The previously-defined PascalCase contract. Kept only so any caller still
 * emitting the old shape keeps working; the real system does not send this.
 */
const legacyCarStockItemSchema = z.object({
  CarId: carStockCarIdSchema,
  Maker: z.string().nullish(),
  Model: z.string().nullish(),
  YearRelease: z.union([z.string(), z.number()]).nullish(),
  Price: z.union([z.string(), z.number()]).nullish(),
  MonthlyPrice: z.union([z.string(), z.number()]).nullish(),
  Km: z.union([z.string(), z.number()]).nullish(),
  Cc: z.union([z.string(), z.number()]).nullish(),
  Hp: z.union([z.string(), z.number()]).nullish(),
  Fuel: z.string().nullish(),
  TransmissionType: z.string().nullish(),
  Color: z.string().nullish(),
  Offer: z.union([z.boolean(), z.string(), z.number()]).optional(),
  Froze: z.union([z.boolean(), z.string(), z.number()]).optional(),
  Delete: z.union([z.boolean(), z.string(), z.number()]).optional(),
  TypeOfCar: z.string().nullish(),
  Plate: z.string().nullish(),
  VIN: z.string().nullish(),
});

/**
 * Single internal shape every downstream consumer (import.service,
 * vehicle.service, normalizeVehiclePayload) reads from. Both wire formats
 * above are remapped into this one via `normalizeCarStockItemKeys` *before*
 * zod validates it, so nothing past the schema boundary ever has to know
 * which casing a given feed push used.
 */
const carStockCanonicalItemSchema = z.object({
  carId: carStockCarIdSchema,
  maker: z.string().nullish(),
  model: z.string().nullish(),
  versionName: z.string().nullish(),
  yearRelease: z.union([z.string(), z.number()]).nullish(),
  price: z.union([z.string(), z.number()]).nullish(),
  monthlyPrice: z.union([z.string(), z.number()]).nullish(),
  km: z.union([z.string(), z.number()]).nullish(),
  cc: z.union([z.string(), z.number()]).nullish(),
  hp: z.union([z.string(), z.number()]).nullish(),
  discountType: z.string().nullish(),
  fuel: z.string().nullish(),
  transmissionType: z.string().nullish(),
  color: z.string().nullish(),
  typeOfCar: z.string().nullish(),
  // Deliberately never consumed by stockDataFromNormalized /
  // stockUpdateDataFromRaw. Vehicle photos come from admin-managed
  // VehicleImage rows or the VIN-keyed CDN (see
  // src/server/services/vehicle-image.service.ts) — a stray/stale
  // image_url from the feed must never silently replace either.
  imageUrl: z.string().nullish(),
  offer: z.union([z.boolean(), z.string(), z.number()]).optional(),
  froze: z.union([z.boolean(), z.string(), z.number()]).optional(),
  isDeleted: z.union([z.boolean(), z.string(), z.number()]).optional(),
  plate: z.string().nullish(),
  vin: z.string().nullish(),
  extras: carStockExtrasDtoArraySchema,
});

export type CarStockPayloadItem = z.infer<typeof carStockCanonicalItemSchema>;
export type CarStockExtraDto = z.infer<typeof carStockExtraDtoSchema>;

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
    extras: raw.ExtrasDTO,
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
    extras: raw.ExtrasDTO,
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

/**
 * POST /api/integrations/carstock/cars-delete request contract (POST, not
 * HTTP DELETE — the external CMS has unreliable support for a JSON body on
 * a DELETE request; the operation itself is still a pure soft delete). The
 * canonical body is a bare array of carId values (`[123, 456]`); a
 * `{ carIds: [...] }` wrapper is also accepted so a caller that prefers a
 * named field isn't forced into the bare-array shape. Both resolve to the
 * same carId type CarStock already uses elsewhere in this integration
 * (string | number) — see `carId` on carStockCanonicalItemSchema above.
 */
export const carStockDeleteIdsArraySchema = z.array(carStockCarIdSchema).min(1);
export const carStockDeleteBodySchema = z.union([
  carStockDeleteIdsArraySchema,
  z.object({ carIds: carStockDeleteIdsArraySchema }),
]);

/**
 * Shared strict-field building blocks for the "complete current CarStock
 * state" contract — used by BOTH PUT's wire-format schema below AND POST's
 * RESTORE-strictness schema further down (see carStockRestoreItemSchema).
 * The two schemas validate different physical shapes (PUT's raw wire keys —
 * rent/ExtrasDTO/... — vs POST's already-remapped canonical keys —
 * monthlyPrice/extras/...), so they can't literally be the same z.object,
 * but every FIELD-LEVEL rule (what counts as "required", "non-blank", or
 * "present but nullable") is defined exactly once here and only referenced
 * by both, so they cannot silently drift apart on what a valid full-state
 * payload requires.
 */
const strictNonBlankString = (label: string) => z.string().trim().min(1, `${label} is required and must not be blank`);
const strictNullableNumberOrString = z.union([z.string(), z.number()]).nullable();
const strictNullableString = z.string().nullable();
const strictExtrasArray = z.array(carStockExtraDtoSchema);

/**
 * PUT /api/integrations/carstock/cars-update request contract. Deliberately
 * NOT built on carStockCanonicalItemSchema above — that schema exists to
 * accept the loose, partial-delta shapes CREATE has always tolerated, which
 * is exactly what PUT must reject. PUT represents the COMPLETE current
 * CarStock state for a vehicle, so every key below is required (not
 * `.optional()`); only the "remaining fields" (rent/yearRelease/vin/km/cc/
 * hp/fuel/color/typeOfCar/transmissionType/price) may hold `null` as their
 * *value* — the property itself must still be present, which is what
 * distinguishes an intentional `"price": null` (full-replacement clear)
 * from an incomplete/malformed payload missing `price` entirely (rejected).
 *
 * `maker`/`model`/`versionName` are the one set of keys that may NOT be
 * null/blank: Vehicle.maker/model/versionName stay NOT NULL columns (see
 * schema.prisma), so a PUT that can't supply real values for them is
 * rejected here, before any DB mutation — applyCarStockFullUpdate in
 * vehicle.service.ts trusts these three completely and never falls back to
 * the vehicle's existing value.
 *
 * ExtrasDTO is likewise required and, unlike CREATE, may NOT be null: only
 * an actual array (`[]` to clear every extra, or a populated array to
 * replace them) is accepted, so a missing/null ExtrasDTO can never be
 * silently read as "clear all extras".
 */
const carStockUpdateItemWireSchema = z.object({
  carId: carStockCarIdSchema,
  maker: strictNonBlankString("maker"),
  model: strictNonBlankString("model"),
  versionName: strictNonBlankString("versionName"),
  rent: strictNullableNumberOrString,
  yearRelease: strictNullableNumberOrString,
  vin: strictNullableString,
  km: strictNullableNumberOrString,
  cc: strictNullableNumberOrString,
  hp: strictNullableNumberOrString,
  fuel: strictNullableString,
  color: strictNullableString,
  typeOfCar: strictNullableString,
  transmissionType: strictNullableString,
  price: strictNullableNumberOrString,
  ExtrasDTO: strictExtrasArray,
});

/**
 * Maps the strict wire shape above onto the same canonical
 * `CarStockPayloadItem` shape CREATE produces, so applyCarStockFullUpdate,
 * normalizeVehiclePayload, and normalizeExtras stay the single source of
 * truth for normalization — PUT only adds stricter presence validation at
 * the boundary, never a competing normalization path.
 */
export const carStockUpdateItemSchema = carStockUpdateItemWireSchema.transform(
  (raw): CarStockPayloadItem => ({
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
    fuel: raw.fuel,
    transmissionType: raw.transmissionType,
    color: raw.color,
    typeOfCar: raw.typeOfCar,
    vin: raw.vin,
    extras: raw.ExtrasDTO,
  }),
);

export const carStockUpdatePayloadSchema = z.array(carStockUpdateItemSchema).min(1);

/**
 * RESTORE strictness check for POST /api/integrations/carstock/cars-updated,
 * used only when an incoming carId resolves to an EXISTING, SOFT-DELETED
 * Vehicle (see createVehicleFromCarStock in vehicle.service.ts). A restore
 * must supply the complete current CarStock state, exactly like PUT — so
 * this schema enforces the identical field-by-field rules as
 * carStockUpdateItemWireSchema above (same shared strictNonBlankString /
 * strictNullableNumberOrString / strictNullableString / strictExtrasArray
 * building blocks — never re-implemented), just applied to the CANONICAL
 * shape (monthlyPrice/extras/...) instead of the raw wire shape
 * (rent/ExtrasDTO/...).
 *
 * Operating on the canonical shape rather than the original wire item is
 * deliberately safe here, not a weaker approximation: normalizeCarStockItemKeys
 * (see fromRealShape/fromLegacyShape above) does pure key-renaming with no
 * value transformation, and every canonical field below is `.nullish()` on
 * carStockCanonicalItemSchema, so a wire field that was completely absent
 * comes through as `undefined` and an explicit `null` comes through as
 * `null` — the exact distinction this schema needs to enforce is preserved
 * intact by the time createVehicleFromCarStock has its parsed
 * `CarStockPayloadItem` in hand. A missing key and a present-but-`undefined`
 * key are indistinguishable to JSON (and to zod's own property access)
 * either way, so nothing is lost by not re-parsing the original wire object.
 *
 * Only used to gate whether a restore may proceed — the ALREADY-parsed
 * canonical item is what actually gets used for the mutation once this
 * passes, so this schema's own transformed output is never consumed.
 */
export const carStockRestoreItemSchema = z.object({
  carId: carStockCarIdSchema,
  maker: strictNonBlankString("maker"),
  model: strictNonBlankString("model"),
  versionName: strictNonBlankString("versionName"),
  yearRelease: strictNullableNumberOrString,
  price: strictNullableNumberOrString,
  monthlyPrice: strictNullableNumberOrString,
  km: strictNullableNumberOrString,
  cc: strictNullableNumberOrString,
  hp: strictNullableNumberOrString,
  fuel: strictNullableString,
  transmissionType: strictNullableString,
  color: strictNullableString,
  typeOfCar: strictNullableString,
  vin: strictNullableString,
  extras: strictExtrasArray,
});
