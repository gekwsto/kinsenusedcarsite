import { prisma } from "@/lib/prisma";
import { CONTENT_DEFAULTS, type ContentKey, type ContentValue } from "@/lib/content-defaults";

export async function getPageContent<K extends ContentKey>(key: K): Promise<ContentValue<K>> {
  const row = await prisma.pageContent.findUnique({ where: { key } });
  return (row ? (row.value as ContentValue<K>) : CONTENT_DEFAULTS[key]);
}

export async function getAllPageContent(): Promise<Record<ContentKey, unknown>> {
  const rows = await prisma.pageContent.findMany();
  const overrides = new Map(rows.map((row) => [row.key, row.value]));

  const result = {} as Record<ContentKey, unknown>;
  for (const key of Object.keys(CONTENT_DEFAULTS) as ContentKey[]) {
    result[key] = overrides.get(key) ?? CONTENT_DEFAULTS[key];
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
