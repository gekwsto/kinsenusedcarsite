import { Prisma, type Vehicle, type VehicleImage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUniqueVehicleSlug } from "@/lib/slug";
import { normalizeVehiclePayload, type NormalizedVehicleInput } from "@/lib/vehicle-normalization";
import type { VehicleAdminInput, VehicleAdminUpdateInput, VehicleFilterInput } from "@/lib/validators/vehicle.schema";
import type { CarStockPayloadItem } from "@/lib/validators/carstock.schema";

export type VehicleWithImages = Vehicle & { images: VehicleImage[] };

export function serializeVehicle(vehicle: Vehicle & { images?: VehicleImage[] }) {
  return {
    ...vehicle,
    price: vehicle.price ? Number(vehicle.price) : null,
    monthlyPrice: vehicle.monthlyPrice ? Number(vehicle.monthlyPrice) : null,
    images: vehicle.images ?? [],
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
    include: { images: { orderBy: { sortOrder: "asc" } } },
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

export async function listAdminVehicles(params: {
  search?: string;
  status?: "active" | "frozen" | "deleted" | "offer";
  maker?: string;
  fuel?: string;
  transmissionType?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: Prisma.VehicleWhereInput = {};

  if (params.status === "active") Object.assign(where, { froze: false, isDeleted: false });
  if (params.status === "frozen") where.froze = true;
  if (params.status === "deleted") where.isDeleted = true;
  if (params.status === "offer") where.offer = true;
  if (params.maker) where.maker = params.maker;
  if (params.fuel) where.fuel = params.fuel;
  if (params.transmissionType) where.transmissionType = params.transmissionType;

  if (params.search) {
    where.OR = [
      { maker: { contains: params.search, mode: "insensitive" } },
      { model: { contains: params.search, mode: "insensitive" } },
      { externalCarId: { contains: params.search, mode: "insensitive" } },
      { vin: { contains: params.search, mode: "insensitive" } },
      { plate: { contains: params.search, mode: "insensitive" } },
    ];
  }

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
 * Upserts a vehicle from the external stock feed. Preserves images and any
 * manually-edited SEO fields — the feed only owns stock data (price, km,
 * spec, flags), never photos or copy.
 */
export async function upsertVehicleFromStock(raw: CarStockPayloadItem) {
  const externalCarId = String(raw.carId);
  const normalized = normalizeVehiclePayload(raw);

  const existing = await prisma.vehicle.findUnique({ where: { externalCarId } });

  if (!existing) {
    if (normalized.isDeleted) {
      return { action: "skipped" as const };
    }
    const slug = await generateUniqueVehicleSlug({
      maker: normalized.maker ?? "vehicle",
      model: normalized.model ?? externalCarId,
      yearRelease: normalized.yearRelease,
    });
    await prisma.vehicle.create({
      data: {
        externalCarId,
        slug,
        ...stockDataFromNormalized(normalized),
        maker: normalized.maker ?? "Άγνωστο",
        model: normalized.model ?? externalCarId,
        versionName: normalized.versionName ?? normalized.model ?? externalCarId,
      },
    });
    return { action: "created" as const };
  }

  const significantChange =
    (normalized.maker && normalized.maker !== existing.maker) ||
    (normalized.model && normalized.model !== existing.model) ||
    (normalized.yearRelease && normalized.yearRelease !== existing.yearRelease);

  const slug = significantChange
    ? await generateUniqueVehicleSlug(
        {
          maker: normalized.maker ?? existing.maker,
          model: normalized.model ?? existing.model,
          yearRelease: normalized.yearRelease ?? existing.yearRelease,
        },
        existing.id,
      )
    : existing.slug;

  await prisma.vehicle.update({
    where: { id: existing.id },
    data: {
      ...stockUpdateDataFromRaw(raw, normalized),
      slug,
    },
  });

  return {
    action: normalized.isDeleted ? ("deleted" as const) : normalized.froze ? ("frozen" as const) : ("updated" as const),
  };
}

/**
 * Builds the update payload for an EXISTING vehicle, field-by-field, only
 * touching keys the feed actually sent this time. Real stock feeds commonly
 * push minimal deltas (e.g. `{carId, froze}` to just freeze a listing) — if
 * every normalized field were written unconditionally, that single flag
 * flip would null out km/cc/hp/fuel/etc. on every such call. Contrast with
 * stockDataFromNormalized() below, used only for brand-new vehicles, where
 * defaulting absent fields to null is correct.
 *
 * `raw.imageUrl` is deliberately never read here — see the field comment on
 * the canonical schema in carstock.schema.ts.
 */
function stockUpdateDataFromRaw(
  raw: CarStockPayloadItem,
  normalized: NormalizedVehicleInput,
): Prisma.VehicleUncheckedUpdateInput {
  const data: Prisma.VehicleUncheckedUpdateInput = {};

  if (raw.maker !== undefined) data.maker = normalized.maker ?? undefined;
  if (raw.model !== undefined) data.model = normalized.model ?? undefined;
  if (raw.versionName !== undefined) data.versionName = normalized.versionName ?? undefined;
  if (raw.yearRelease !== undefined) data.yearRelease = normalized.yearRelease;
  if (raw.price !== undefined) data.price = normalized.price;
  if (raw.monthlyPrice !== undefined) data.monthlyPrice = normalized.monthlyPrice;
  if (raw.km !== undefined) data.km = normalized.km;
  if (raw.cc !== undefined) data.cc = normalized.cc;
  if (raw.hp !== undefined) data.hp = normalized.hp;
  if (raw.discountType !== undefined) data.discountType = normalized.discountType;
  if (raw.fuel !== undefined) data.fuel = normalized.fuel;
  if (raw.transmissionType !== undefined) data.transmissionType = normalized.transmissionType;
  if (raw.color !== undefined) data.color = normalized.color;
  if (raw.typeOfCar !== undefined) data.typeOfCar = normalized.typeOfCar;
  if (raw.offer !== undefined) data.offer = normalized.offer;
  if (raw.froze !== undefined) data.froze = normalized.froze;
  if (raw.isDeleted !== undefined) data.isDeleted = normalized.isDeleted;
  if (raw.plate !== undefined) data.plate = normalized.plate;
  if (raw.vin !== undefined) data.vin = normalized.vin;

  return data;
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
    isDeleted: normalized.isDeleted,
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
