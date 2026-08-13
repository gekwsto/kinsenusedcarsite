import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishPublicRealtimeEvent } from "@/server/realtime/publisher";

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

async function upsertSiteSetting(client: Prisma.TransactionClient, key: keyof SiteSettings, value: unknown) {
  return client.siteSetting.upsert({
    where: { key },
    update: { value: value as object },
    create: { key, value: value as object },
  });
}

export async function updateSiteSetting(key: keyof SiteSettings, value: unknown) {
  return upsertSiteSetting(prisma, key, value);
}

/**
 * Batch entry point for PATCH /api/admin/settings — updates every provided
 * key, then publishes ONCE for the whole request, not once per key.
 * Deliberately not published inside updateSiteSetting() itself: a single
 * PATCH commonly changes several keys at once (see the route), and
 * publishing there would fan out one event per key instead of coalescing
 * the whole request into one, the same batching principle CarStock's
 * import.service.ts applies to its own multi-item requests.
 *
 * All writes for one request run inside a single $transaction — either
 * every key is updated or none are, so a mid-batch failure can never leave
 * some keys committed and others not while still (or worse, never)
 * publishing a realtime event. The transaction uses sequential awaits
 * (not Promise.all) because Prisma's interactive transactions are not safe
 * for concurrent queries against the same transaction client. The realtime
 * publish happens strictly AFTER the transaction promise resolves — never
 * inside it — so a publish failure can't roll back an already-committed
 * write, and visitors are only ever notified about state that is actually
 * durable.
 *
 * Currently every SiteSettings field the public site actually renders
 * (contactEmail/contactPhone/address/socialLinks) lives in the shared
 * Footer on every public page — see src/components/layout/footer.tsx — so
 * any settings change uses the `all-public` scope rather than a narrower
 * one; see the realtime spec's SiteSettings section for why a per-field
 * scope isn't worth the extra complexity while that remains true.
 */
export async function updateSiteSettings(partial: Partial<SiteSettings>): Promise<SiteSettings> {
  const keys = Object.keys(partial) as (keyof SiteSettings)[];

  if (keys.length === 0) {
    return getSiteSettings();
  }

  await prisma.$transaction(async (tx) => {
    for (const key of keys) {
      await upsertSiteSetting(tx, key, partial[key]);
    }
  });

  publishPublicRealtimeEvent("settings.changed", ["all-public"]);

  return getSiteSettings();
}
