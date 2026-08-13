import { prisma } from "@/lib/prisma";
import { publishPublicRealtimeEvent } from "@/server/realtime/publisher";

export async function listActiveFaqItems() {
  return prisma.faqItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
}

export async function listAllFaqItems() {
  return prisma.faqItem.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
}

export async function createFaqItem(data: { question: string; answer: string; category?: string; sortOrder?: number }) {
  const item = await prisma.faqItem.create({ data });
  publishPublicRealtimeEvent("faq.changed", ["faq"]);
  return item;
}

export async function updateFaqItem(
  id: string,
  data: Partial<{ question: string; answer: string; category: string; sortOrder: number; isActive: boolean }>,
) {
  const item = await prisma.faqItem.update({ where: { id }, data });
  publishPublicRealtimeEvent("faq.changed", ["faq"]);
  return item;
}

export async function deleteFaqItem(id: string) {
  const item = await prisma.faqItem.delete({ where: { id } });
  publishPublicRealtimeEvent("faq.changed", ["faq"]);
  return item;
}
