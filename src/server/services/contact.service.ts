import type { ContactMessageStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateContactMessageInput } from "@/lib/validators/contact.schema";

export async function createContactMessage(input: CreateContactMessageInput) {
  return prisma.contactMessage.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email,
      phone: input.phone || null,
      message: input.message,
    },
  });
}

export async function listContactMessages(params: { status?: ContactMessageStatus; page?: number; pageSize?: number }) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: Prisma.ContactMessageWhereInput = params.status ? { status: params.status } : {};

  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function updateContactMessageStatus(id: string, status: ContactMessageStatus) {
  return prisma.contactMessage.update({ where: { id }, data: { status } });
}
