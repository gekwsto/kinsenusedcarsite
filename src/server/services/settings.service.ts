import { prisma } from "@/lib/prisma";

export interface SiteSettings {
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialLinks: { facebook?: string; instagram?: string; linkedin?: string };
  fallbackVehicleImage: string;
  featuredVehicleIds: string[];
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  contactEmail: "info@kinsen.gr",
  contactPhone: "21 0349 7860",
  address: "Λεωφόρος Αθηνών 71, Τ.Κ. 104 47, Αθήνα",
  socialLinks: {},
  fallbackVehicleImage: "/images/vehicle-fallback.png",
  featuredVehicleIds: [],
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.siteSetting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    ...DEFAULT_SITE_SETTINGS,
    ...Object.fromEntries(
      Object.keys(DEFAULT_SITE_SETTINGS)
        .filter((key) => map.has(key))
        .map((key) => [key, map.get(key)]),
    ),
  } as SiteSettings;
}

export async function updateSiteSetting(key: keyof SiteSettings, value: unknown) {
  return prisma.siteSetting.upsert({
    where: { key },
    update: { value: value as object },
    create: { key, value: value as object },
  });
}
