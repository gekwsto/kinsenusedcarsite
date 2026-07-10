import { prisma } from "@/lib/prisma";
import { serializeVehicle } from "@/server/services/vehicle.service";

export async function toggleFavorite(userId: string, vehicleId: string) {
  const existing = await prisma.favorite.findUnique({
    where: { userId_vehicleId: { userId, vehicleId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.favorite.create({ data: { userId, vehicleId } });
  return { favorited: true };
}

export async function removeFavorite(userId: string, vehicleId: string) {
  await prisma.favorite.deleteMany({ where: { userId, vehicleId } });
}

export async function listFavoriteIds(userId: string) {
  const favorites = await prisma.favorite.findMany({ where: { userId }, select: { vehicleId: true } });
  return favorites.map((f) => f.vehicleId);
}

export async function listFavoriteVehicles(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { vehicle: { include: { images: { orderBy: { sortOrder: "asc" } } } } },
  });
  return favorites
    .filter((f) => !f.vehicle.isDeleted)
    .map((f) => serializeVehicle(f.vehicle));
}
