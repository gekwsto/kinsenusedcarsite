import { prisma } from "@/lib/prisma";

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
  return prisma.faqItem.create({ data });
}

export async function updateFaqItem(
  id: string,
  data: Partial<{ question: string; answer: string; category: string; sortOrder: number; isActive: boolean }>,
) {
  return prisma.faqItem.update({ where: { id }, data });
}

export async function deleteFaqItem(id: string) {
  return prisma.faqItem.delete({ where: { id } });
}
