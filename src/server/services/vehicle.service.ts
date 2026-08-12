import { Prisma, type Vehicle, type VehicleImage, type VehicleExtra } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUniqueVehicleSlug } from "@/lib/slug";
import {
  normalizeVehiclePayload,
  normalizeExtras,
  type NormalizedVehicleInput,
  type NormalizedExtraInput,
} from "@/lib/vehicle-normalization";
import type { VehicleAdminInput, VehicleAdminUpdateInput, VehicleFilterInput } from "@/lib/validators/vehicle.schema";
import type { CarStockPayloadItem } from "@/lib/validators/carstock.schema";

export type VehicleWithImages = Vehicle & { images: VehicleImage[] };

// `extras` is optional here (like `images`) so every existing caller that
// doesn't `include: { extras: true }` keeps getting `extras: []` rather than
// a type error — only getPublicVehicleBySlug currently loads the relation.
export function serializeVehicle(vehicle: Vehicle & { images?: VehicleImage[]; extras?: VehicleExtra[] }) {
  return {
    ...vehicle,
    price: vehicle.price ? Number(vehicle.price) : null,
    monthlyPrice: vehicle.monthlyPrice ? Number(vehicle.monthlyPrice) : null,
    images: vehicle.images ?? [],
    extras: vehicle.extras ?? [],
  };
}

const PUBLIC_WHERE: Prisma.VehicleWhereInput = { froze: false, isDeleted: false };

// Exported (not just used internally) so its dynamic-value behavior —
// notably that maker/fuel/transmissionType/color/typeOfCar are passed
// straight through as Prisma `in`/`equals` field *values*, never used to
// build allowlists or field names — is directly unit-testable without a
// live database connection. See
// src/server/services/__tests__/vehicle-filter-query.test.ts.
export function buildPublicFilterWhere(filters: VehicleFilterInput): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = { ...PUBLIC_WHERE };

  // maker/fuel accept a comma-separated list of values from the sidebar's
  // multi-select checkboxes (e.g. "BMW,Toyota"), not just a single value.
  if (filters.maker) {
    const makers = filters.maker.split(",").filter(Boolean);
    where.maker = { in: makers, mode: "insensitive" };
  }
  if (filters.model) where.model = { equals: filters.model, mode: "insensitive" };
  if (filters.fuel) {
    const fuels = filters.fuel.split(",").filter(Boolean);
    where.fuel = { in: fuels, mode: "insensitive" };
  }
  if (filters.transmissionType) {
    const transmissions = filters.transmissionType.split(",").filter(Boolean);
    where.transmissionType = { in: transmissions, mode: "insensitive" };
  }
  if (filters.color) {
    const colors = filters.color.split(",").filter(Boolean);
    where.color = { in: colors, mode: "insensitive" };
  }
  if (filters.typeOfCar) {
    const types = filters.typeOfCar.split(",").filter(Boolean);
    where.typeOfCar = { in: types, mode: "insensitive" };
  }
  if (filters.offerOnly) where.offer = true;

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    where.price = {
      ...(filters.priceMin !== undefined ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax !== undefined ? { lte: filters.priceMax } : {}),
    };
  }
  if (filters.monthlyPriceMin !== undefined || filters.monthlyPriceMax !== undefined) {
    where.monthlyPrice = {
      ...(filters.monthlyPriceMin !== undefined ? { gte: filters.monthlyPriceMin } : {}),
      ...(filters.monthlyPriceMax !== undefined ? { lte: filters.monthlyPriceMax } : {}),
    };
  }
  if (filters.yearMin !== undefined || filters.yearMax !== undefined) {
    where.yearRelease = {
      ...(filters.yearMin !== undefined ? { gte: filters.yearMin } : {}),
      ...(filters.yearMax !== undefined ? { lte: filters.yearMax } : {}),
    };
  }
  if (filters.kmMin !== undefined || filters.kmMax !== undefined) {
    where.km = {
      ...(filters.kmMin !== undefined ? { gte: filters.kmMin } : {}),
      ...(filters.kmMax !== undefined ? { lte: filters.kmMax } : {}),
    };
  }
  if (filters.ccMin !== undefined || filters.ccMax !== undefined) {
    where.cc = {
      ...(filters.ccMin !== undefined ? { gte: filters.ccMin } : {}),
      ...(filters.ccMax !== undefined ? { lte: filters.ccMax } : {}),
    };
  }
  if (filters.hpMin !== undefined || filters.hpMax !== undefined) {
    where.hp = {
      ...(filters.hpMin !== undefined ? { gte: filters.hpMin } : {}),
      ...(filters.hpMax !== undefined ? { lte: filters.hpMax } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { maker: { contains: filters.search, mode: "insensitive" } },
      { model: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

// One explicit, fully-typed allowlist mapping every canonical `sort` value
// to a trusted Prisma `orderBy`. Never build the ordering from the raw
// query-string value directly — an invalid value can't reach this map at
// all (vehicleSortEnum already rejects it upstream, see vehicle.schema.ts),
// and this switch's own `default` case is a second, redundant safety net
// rather than the only one.
//
// Every entry ends with `{ id: "asc" }` as a stable secondary key: `price`,
// `km` and `cc` are not unique, so without a deterministic tie-breaker,
// vehicles sharing a value could reorder between two requests for the same
// page (Postgres makes no row-order guarantee among ties), shifting items
// across pagination boundaries unpredictably.
//
// `nulls: "last"` on every directional numeric sort means a vehicle with no
// recorded price/km/cc is never mistaken for the cheapest/lowest-mileage/
// smallest-engine result — it always sorts after every vehicle with a real
// value, in both the ascending and descending case, rather than the
// database's default per-direction null placement (Postgres: NULLS LAST
// for ASC, NULLS FIRST for DESC — which would otherwise put missing values
// first for "highest price").
function buildOrderBy(sort: VehicleFilterInput["sort"]): Prisma.VehicleOrderByWithRelationInput[] {
  switch (sort) {
    case "price-desc":
      return [{ price: { sort: "desc", nulls: "last" } }, { id: "asc" }];
    case "price-asc":
      return [{ price: { sort: "asc", nulls: "last" } }, { id: "asc" }];
    case "mileage-asc":
      return [{ km: { sort: "asc", nulls: "last" } }, { id: "asc" }];
    case "mileage-desc":
      return [{ km: { sort: "desc", nulls: "last" } }, { id: "asc" }];
    case "engine-asc":
      return [{ cc: { sort: "asc", nulls: "last" } }, { id: "asc" }];
    case "engine-desc":
      return [{ cc: { sort: "desc", nulls: "last" } }, { id: "asc" }];
    case "recommended":
    default:
      // Existing default business order (newest listings first) — the same
      // ordering the plain `newest` sort always used, just now living
      // under the "recommended" name. No featured/offer-first ranking is
      // currently implemented, so there is no additional business rule to
      // preserve beyond this.
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listPublicVehicles(filters: VehicleFilterInput) {
  const where = buildPublicFilterWhere(filters);
  const orderBy = buildOrderBy(filters.sort);
  const skip = (filters.page - 1) * filters.pageSize;

  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy,
      skip,
      take: filters.pageSize,
      include: { images: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return {
    items: items.map(serializeVehicle),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export async function getPublicVehicleBySlug(slug: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { slug, ...PUBLIC_WHERE },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      extras: { orderBy: { createdAt: "asc" } },
    },
  });
  return vehicle ? serializeVehicle(vehicle) : null;
}

export async function getSimilarVehicles(vehicle: Pick<Vehicle, "id" | "maker" | "typeOfCar">, limit = 4) {
  const items = await prisma.vehicle.findMany({
    where: {
      ...PUBLIC_WHERE,
      id: { not: vehicle.id },
      OR: [{ maker: vehicle.maker }, { typeOfCar: vehicle.typeOfCar ?? undefined }],
    },
    include: { images: { orderBy: { sortOrder: "asc" } } },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return items.map(serializeVehicle);
}

export async function getFeaturedVehicles(limit = 6) {
  const items = await prisma.vehicle.findMany({
    where: PUBLIC_WHERE,
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ offer: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return items.map(serializeVehicle);
}

/**
 * Batch lookup for the vehicle-comparison feature — one query for up to
 * MAX_COMPARISON_VEHICLES IDs, using the exact same PUBLIC_WHERE visibility
 * filter as every other public read (a frozen/deleted vehicle ID never
 * resolves here, so it can never leak into a shared /compare URL or a
 * stale localStorage-persisted ID). Callers are responsible for
 * re-ordering the result to match the caller's requested ID order (see
 * reorderVehiclesByIds in src/lib/vehicle-comparison.ts) — Prisma's `in`
 * filter does not preserve input order.
 */
export async function getPublicVehiclesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const items = await prisma.vehicle.findMany({
    where: { id: { in: ids }, ...PUBLIC_WHERE },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  return items.map(serializeVehicle);
}

export async function getPublicFilterOptions() {
  const [makers, colors, types, fuels, transmissions, offerCount] = await Promise.all([
    prisma.vehicle.findMany({ where: PUBLIC_WHERE, select: { maker: true }, distinct: ["maker"] }),
    prisma.vehicle.findMany({ where: PUBLIC_WHERE, select: { color: true }, distinct: ["color"] }),
    prisma.vehicle.findMany({ where: PUBLIC_WHERE, select: { typeOfCar: true }, distinct: ["typeOfCar"] }),
    prisma.vehicle.findMany({ where: PUBLIC_WHERE, select: { fuel: true }, distinct: ["fuel"] }),
    prisma.vehicle.findMany({ where: PUBLIC_WHERE, select: { transmissionType: true }, distinct: ["transmissionType"] }),
    // Authoritative availability check for the "Deals" filter (the `offer`
    // Boolean field — see buildPublicFilterWhere's `filters.offerOnly`
    // branch below) — same "hide the whole section when the option set is
    // empty" policy already applied to maker/fuel/transmission/color/type
    // above, extended to this one boolean facet.
    prisma.vehicle.count({ where: { ...PUBLIC_WHERE, offer: true } }),
  ]);

  return {
    makers: makers.map((m) => m.maker).filter(Boolean).sort(),
    colors: colors.map((c) => c.color).filter(Boolean).sort() as string[],
    typesOfCar: types.map((t) => t.typeOfCar).filter(Boolean).sort() as string[],
    fuels: fuels.map((f) => f.fuel).filter(Boolean).sort() as string[],
    transmissions: transmissions.map((t) => t.transmissionType).filter(Boolean).sort() as string[],
    hasOffers: offerCount > 0,
  };
}

// ---------- Admin ----------

export interface AdminVehicleListFilters {
  search?: string;
  status?: "active" | "frozen" | "deleted" | "offer";
  maker?: string;
  fuel?: string;
  transmissionType?: string;
}

/**
 * Pure where-clause builder for the admin vehicle list — separated from
 * `listAdminVehicles` (like `buildPublicFilterWhere` above) so the exact
 * filter logic is directly unit-testable without a database.
 *
 * Soft-deleted vehicles are excluded from every view except the explicit
 * "deleted" filter — a just-deleted vehicle must never reappear in the
 * default ("all statuses") list, nor under "frozen"/"offer" (those two
 * previously never touched `isDeleted` at all, so a frozen-then-deleted or
 * offer-then-deleted vehicle stayed visible under those filters too).
 */
export function buildAdminVehicleWhere(filters: AdminVehicleListFilters): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = {};

  if (filters.status === "deleted") {
    where.isDeleted = true;
  } else {
    where.isDeleted = false;
    if (filters.status === "active") where.froze = false;
    if (filters.status === "frozen") where.froze = true;
    if (filters.status === "offer") where.offer = true;
  }
  if (filters.maker) where.maker = filters.maker;
  if (filters.fuel) where.fuel = filters.fuel;
  if (filters.transmissionType) where.transmissionType = filters.transmissionType;

  if (filters.search) {
    where.OR = [
      { maker: { contains: filters.search, mode: "insensitive" } },
      { model: { contains: filters.search, mode: "insensitive" } },
      { externalCarId: { contains: filters.search, mode: "insensitive" } },
      { vin: { contains: filters.search, mode: "insensitive" } },
      { plate: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listAdminVehicles(params: AdminVehicleListFilters & { page?: number; pageSize?: number }) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where = buildAdminVehicleWhere(params);

  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { items: items.map(serializeVehicle), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getAdminVehicleById(id: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  return vehicle ? serializeVehicle(vehicle) : null;
}

export async function createVehicle(input: VehicleAdminInput) {
  const slug = await generateUniqueVehicleSlug({ maker: input.maker, model: input.model, yearRelease: input.yearRelease });
  const vehicle = await prisma.vehicle.create({
    data: { ...toVehicleData(input), slug },
    include: { images: true },
  });
  return serializeVehicle(vehicle);
}

export async function updateVehicle(id: string, input: VehicleAdminUpdateInput) {
  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) return null;

  const maker = input.maker ?? existing.maker;
  const model = input.model ?? existing.model;
  const yearRelease = input.yearRelease !== undefined ? input.yearRelease : existing.yearRelease;

  const shouldRegenerateSlug = maker !== existing.maker || model !== existing.model || yearRelease !== existing.yearRelease;
  const slug = shouldRegenerateSlug
    ? await generateUniqueVehicleSlug({ maker, model, yearRelease }, id)
    : existing.slug;

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: { ...toVehicleUpdateData(input), slug },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  return serializeVehicle(vehicle);
}

export async function setVehicleFrozen(id: string, froze: boolean) {
  return prisma.vehicle.update({ where: { id }, data: { froze } });
}

export async function softDeleteVehicle(id: string) {
  return prisma.vehicle.update({ where: { id }, data: { isDeleted: true } });
}

function toVehicleData(input: VehicleAdminInput): Prisma.VehicleUncheckedCreateInput {
  return {
    externalCarId: input.externalCarId || null,
    maker: input.maker,
    model: input.model,
    versionName: input.versionName,
    yearRelease: input.yearRelease ?? null,
    price: input.price ?? null,
    monthlyPrice: input.monthlyPrice ?? null,
    km: input.km ?? null,
    cc: input.cc ?? null,
    hp: input.hp ?? null,
    fuel: input.fuel ?? null,
    transmissionType: input.transmissionType ?? null,
    color: input.color ?? null,
    typeOfCar: input.typeOfCar ?? null,
    offer: input.offer,
    froze: input.froze,
    isDeleted: input.isDeleted,
    plate: input.plate ?? null,
    vin: input.vin ?? null,
    description: input.description ?? null,
    features: input.features ?? undefined,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    slug: "",
  };
}

/**
 * Unlike toVehicleData (create), this only sets keys actually present in
 * the request — a field the caller omits must be left alone in the DB, not
 * reset to null/false. `slug` is computed separately by the caller.
 */
function toVehicleUpdateData(input: VehicleAdminUpdateInput): Prisma.VehicleUncheckedUpdateInput {
  const data: Prisma.VehicleUncheckedUpdateInput = {};

  if (input.externalCarId !== undefined) data.externalCarId = input.externalCarId || null;
  if (input.maker !== undefined) data.maker = input.maker;
  if (input.model !== undefined) data.model = input.model;
  if (input.versionName !== undefined) data.versionName = input.versionName;
  if (input.yearRelease !== undefined) data.yearRelease = input.yearRelease;
  if (input.price !== undefined) data.price = input.price;
  if (input.monthlyPrice !== undefined) data.monthlyPrice = input.monthlyPrice;
  if (input.km !== undefined) data.km = input.km;
  if (input.cc !== undefined) data.cc = input.cc;
  if (input.hp !== undefined) data.hp = input.hp;
  if (input.fuel !== undefined) data.fuel = input.fuel;
  if (input.transmissionType !== undefined) data.transmissionType = input.transmissionType;
  if (input.color !== undefined) data.color = input.color;
  if (input.typeOfCar !== undefined) data.typeOfCar = input.typeOfCar;
  if (input.offer !== undefined) data.offer = input.offer;
  if (input.froze !== undefined) data.froze = input.froze;
  if (input.isDeleted !== undefined) data.isDeleted = input.isDeleted;
  if (input.plate !== undefined) data.plate = input.plate;
  if (input.vin !== undefined) data.vin = input.vin;
  if (input.description !== undefined) data.description = input.description;
  if (input.features !== undefined) data.features = input.features ?? undefined;
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;

  return data;
}

// ---------- Images ----------

export async function addVehicleImage(vehicleId: string, url: string, opts?: { alt?: string; isMain?: boolean }) {
  const count = await prisma.vehicleImage.count({ where: { vehicleId } });
  if (opts?.isMain || count === 0) {
    await prisma.vehicleImage.updateMany({ where: { vehicleId }, data: { isMain: false } });
  }
  return prisma.vehicleImage.create({
    data: {
      vehicleId,
      url,
      alt: opts?.alt ?? null,
      isMain: opts?.isMain ?? count === 0,
      sortOrder: count,
    },
  });
}

export async function removeVehicleImage(vehicleId: string, imageId: string) {
  return prisma.vehicleImage.delete({ where: { id: imageId } }).catch(() => null);
}

export async function reorderVehicleImages(vehicleId: string, orderedImageIds: string[]) {
  await prisma.$transaction(
    orderedImageIds.map((id, index) =>
      prisma.vehicleImage.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
}

// ---------- External stock integration ----------

/**
 * Deletes and re-creates a vehicle's VehicleExtra rows to match `extras`
 * exactly (full replacement, never a patch). Callers run this inside the
 * same `prisma.$transaction` as the Vehicle write it accompanies, so a
 * failure here can never leave a create/update partially applied.
 */
async function replaceVehicleExtras(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  extras: NormalizedExtraInput[],
) {
  await tx.vehicleExtra.deleteMany({ where: { vehicleId } });
  if (extras.length > 0) {
    await tx.vehicleExtra.createMany({
      data: extras.map((extra) => ({ vehicleId, displayName: extra.displayName })),
    });
  }
}

/**
 * True for any Prisma P2002 (unique constraint violation), regardless of
 * which constraint it names. Deliberately NOT a decision about *which*
 * unique field collided — Postgres/Prisma's choice of which conflicting
 * index to report in `error.meta.target` is not something this code should
 * depend on (see the comment on the P2002 catch in createVehicleFromCarStock
 * below for why). Exported so it's directly unit-testable.
 */
export function isPrismaP2002(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * CarStock CREATE (POST /api/integrations/carstock/cars-updated). STRICT
 * create-only: a brand-new externalCarId is created (with its ExtrasDTO
 * persisted as VehicleExtra rows, atomically); a carId that already exists
 * is left completely untouched — no scalar field, VIN, froze flag, extras,
 * image, or admin/SEO field is ever modified by this path. Updating an
 * existing vehicle is exclusively PUT's job (see applyCarStockFullUpdate
 * below) — CREATE has no update responsibility at all anymore, partial or
 * otherwise.
 *
 * Deletion is likewise not a responsibility of this path — CarStock's old
 * `{carId, delete: true}` flag is validated but never read here; soft-deletes
 * go exclusively through DELETE /api/integrations/carstock/cars-delete.
 *
 * The findUnique check above is the normal control-flow path for "this carId
 * already exists". It is not race-proof by itself: two overlapping requests
 * (or a retried request) for the same brand-new carId can both pass it
 * before either commits its create — and, since both would then also
 * generate the same slug, a losing request's create can fail with P2002 on
 * *either* `externalCarId` or `slug`, depending on which constraint Postgres
 * happens to report. Trusting `error.meta.target` to tell them apart would
 * make this depend on database/index ordering, so instead: on any P2002, run
 * one fresh, authoritative lookup on `externalCarId` alone. If it now
 * exists, this was another request winning the exact same CarStock vehicle
 * — treat it exactly like a pre-existing carId (`skipped`), never a failure
 * and never a hidden update. If it still doesn't exist, the P2002 was caused
 * by something else entirely (e.g. a genuine slug collision unrelated to
 * this carId) and must not be swallowed — the original error is rethrown.
 * The failed transaction has already rolled back by this point, so no
 * partial Vehicle/VehicleExtra state is ever left behind either way.
 */
export async function createVehicleFromCarStock(raw: CarStockPayloadItem) {
  const externalCarId = String(raw.carId);

  const existing = await prisma.vehicle.findUnique({ where: { externalCarId }, select: { id: true } });
  if (existing) {
    return { action: "skipped" as const };
  }

  const normalized = normalizeVehiclePayload(raw);
  const extras = normalizeExtras(raw.extras);

  const slug = await generateUniqueVehicleSlug({
    maker: normalized.maker ?? "vehicle",
    model: normalized.model ?? externalCarId,
    yearRelease: normalized.yearRelease,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          externalCarId,
          slug,
          ...stockDataFromNormalized(normalized),
          maker: normalized.maker ?? "Άγνωστο",
          model: normalized.model ?? externalCarId,
          versionName: normalized.versionName ?? normalized.model ?? externalCarId,
        },
      });
      await replaceVehicleExtras(tx, vehicle.id, extras);
    });
  } catch (error) {
    if (isPrismaP2002(error)) {
      const existingAfterRace = await prisma.vehicle.findUnique({ where: { externalCarId }, select: { id: true } });
      if (existingAfterRace) {
        return { action: "skipped" as const };
      }
    }
    throw error;
  }

  return { action: "created" as const };
}

/**
 * CarStock UPDATE (PUT /api/integrations/carstock/cars-update). Looks the
 * vehicle up by carId -> externalCarId only (never VIN) and, if found,
 * overwrites every CarStock-owned scalar field with the incoming value —
 * missing/null/empty normalizes to `null` via normalizeVehiclePayload, so an
 * omitted field really does clear the existing value. `raw` is expected to
 * come from carStockUpdatePayloadSchema (see carstock.schema.ts), which
 * requires every one of these keys to be present and requires
 * maker/model/versionName specifically to be non-blank — so unlike CREATE,
 * there is no fallback to the vehicle's existing maker/model/versionName
 * here: an incomplete or blank payload is rejected by validation *before*
 * this function ever runs, so the values read below are trusted as-is.
 * ExtrasDTO is a full replacement of the vehicle's extras, and runs in the
 * same transaction as the scalar update. Never creates a vehicle, and never
 * touches images, SEO copy, description, or any other admin-managed field.
 */
export async function applyCarStockFullUpdate(raw: CarStockPayloadItem) {
  const externalCarId = String(raw.carId);
  const existing = await prisma.vehicle.findUnique({ where: { externalCarId } });
  if (!existing) {
    return { action: "not_found" as const };
  }

  const normalized = normalizeVehiclePayload(raw);
  const extras = normalizeExtras(raw.extras);

  // Guaranteed non-null: carStockUpdateItemSchema requires maker/model/
  // versionName to be present, trimmed, non-empty strings, and
  // normalizeMaker/normalizeModel/normalizeString only ever return null for
  // null/undefined/empty input.
  const maker = normalized.maker!;
  const model = normalized.model!;
  const versionName = normalized.versionName!;
  const yearRelease = normalized.yearRelease;

  const significantChange = maker !== existing.maker || model !== existing.model || yearRelease !== existing.yearRelease;
  const slug = significantChange
    ? await generateUniqueVehicleSlug({ maker, model, yearRelease }, existing.id)
    : existing.slug;

  const data: Prisma.VehicleUncheckedUpdateInput = {
    maker,
    model,
    versionName,
    yearRelease,
    price: normalized.price,
    monthlyPrice: normalized.monthlyPrice,
    km: normalized.km,
    cc: normalized.cc,
    hp: normalized.hp,
    fuel: normalized.fuel,
    transmissionType: normalized.transmissionType,
    color: normalized.color,
    typeOfCar: normalized.typeOfCar,
    vin: normalized.vin,
    slug,
  };

  await prisma.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id: existing.id }, data });
    await replaceVehicleExtras(tx, existing.id, extras);
  });

  return { action: "updated" as const };
}

/**
 * CarStock DELETE (DELETE /api/integrations/carstock/cars-delete). Bulk,
 * idempotent soft-delete keyed on carId -> externalCarId only (never VIN):
 * flips `isDeleted` for every matching, not-yet-deleted vehicle in one
 * `updateMany`, never calls `prisma.vehicle.delete`, and never touches
 * VehicleExtra/VehicleImage/leads or any other relation. Unknown carIds
 * simply match zero rows — no vehicle is ever created here. The returned
 * count is only the vehicles newly flipped from false -> true, so resending
 * the same carIds is always safe.
 */
export async function softDeleteVehiclesByExternalCarIds(externalCarIds: string[]) {
  if (externalCarIds.length === 0) return { count: 0 };
  const result = await prisma.vehicle.updateMany({
    where: { externalCarId: { in: externalCarIds }, isDeleted: false },
    data: { isDeleted: true },
  });
  return { count: result.count };
}

function stockDataFromNormalized(normalized: NormalizedVehicleInput) {
  return {
    maker: normalized.maker ?? undefined,
    model: normalized.model ?? undefined,
    versionName: normalized.versionName ?? normalized.model ?? undefined,
    yearRelease: normalized.yearRelease,
    price: normalized.price,
    monthlyPrice: normalized.monthlyPrice,
    km: normalized.km,
    cc: normalized.cc,
    hp: normalized.hp,
    discountType: normalized.discountType,
    fuel: normalized.fuel,
    transmissionType: normalized.transmissionType,
    color: normalized.color,
    typeOfCar: normalized.typeOfCar,
    offer: normalized.offer,
    froze: normalized.froze,
    plate: normalized.plate,
    vin: normalized.vin,
  };
}

export async function getActiveDisplayVehicles() {
  const items = await prisma.vehicle.findMany({
    where: PUBLIC_WHERE,
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return items.map(serializeVehicle);
}

export async function getAvailableColors() {
  const colors = await prisma.vehicle.findMany({
    where: PUBLIC_WHERE,
    select: { color: true },
    distinct: ["color"],
  });
  return colors.map((c) => c.color).filter((c): c is string => !!c).sort();
}
