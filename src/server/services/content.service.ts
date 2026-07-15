import { prisma } from "@/lib/prisma";
import { CONTENT_DEFAULTS, type ContentKey, type ContentValue } from "@/lib/content-defaults";

// Shallow-merges a stored override on top of the section's defaults rather
// than trusting the stored row's shape outright — an override saved before
// a field (e.g. `image`) existed on a given section would otherwise come
// back missing that field entirely (undefined `src` on an <Image>) instead
// of gracefully falling back to the shipped default for just that field.
export function withDefaults<K extends ContentKey>(key: K, stored: unknown): ContentValue<K> {
  if (stored === null || typeof stored !== "object") return CONTENT_DEFAULTS[key];
  return { ...CONTENT_DEFAULTS[key], ...stored } as ContentValue<K>;
}

export async function getPageContent<K extends ContentKey>(key: K): Promise<ContentValue<K>> {
  const row = await prisma.pageContent.findUnique({ where: { key } });
  return row ? withDefaults(key, row.value) : CONTENT_DEFAULTS[key];
}

export async function getAllPageContent(): Promise<Record<ContentKey, unknown>> {
  const rows = await prisma.pageContent.findMany();
  const overrides = new Map(rows.map((row) => [row.key, row.value]));

  const result = {} as Record<ContentKey, unknown>;
  for (const key of Object.keys(CONTENT_DEFAULTS) as ContentKey[]) {
    result[key] = overrides.has(key) ? withDefaults(key, overrides.get(key)) : CONTENT_DEFAULTS[key];
  }
  return result;
}

export async function updatePageContent<K extends ContentKey>(key: K, value: ContentValue<K>) {
  return prisma.pageContent.upsert({
    where: { key },
    update: { value: value as object },
    create: { key, value: value as object },
  });
}

export async function resetPageContent(key: ContentKey) {
  return prisma.pageContent.delete({ where: { key } }).catch(() => null);
}
