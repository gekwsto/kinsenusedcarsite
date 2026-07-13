import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateLeadInput, UpdateLeadInput } from "@/lib/validators/lead.schema";

export async function createLead(input: CreateLeadInput, opts: { userId?: string; source?: string }) {
  return prisma.lead.create({
    data: {
      userId: opts.userId,
      vehicleId: input.vehicleId || null,
      interestType: input.interestType,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone || null,
      message: input.message || null,
      source: opts.source ?? "website",
    },
  });
}

export async function listLeads(params: {
  status?: string;
  interestType?: string;
  vehicleId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: Prisma.LeadWhereInput = {};
  if (params.status) where.status = params.status as Prisma.EnumLeadStatusFilter["equals"];
  if (params.interestType) where.interestType = params.interestType as Prisma.EnumInterestTypeFilter["equals"];
  if (params.vehicleId) where.vehicleId = params.vehicleId;

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { vehicle: { select: { id: true, maker: true, versionName: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: { vehicle: { select: { id: true, maker: true, versionName: true, slug: true } } },
  });
}

export async function updateLead(id: string, input: UpdateLeadInput) {
  return prisma.lead.update({
    where: { id },
    data: {
      status: input.status,
      internalNotes: input.internalNotes as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listLeadsForUser(userId: string) {
  return prisma.lead.findMany({
    where: { userId },
    include: { vehicle: { select: { id: true, maker: true, versionName: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function exportLeadsToCsv(params: { status?: string; interestType?: string }) {
  const where: Prisma.LeadWhereInput = {};
  if (params.status) where.status = params.status as Prisma.EnumLeadStatusFilter["equals"];
  if (params.interestType) where.interestType = params.interestType as Prisma.EnumInterestTypeFilter["equals"];

  const leads = await prisma.lead.findMany({
    where,
    include: { vehicle: { select: { maker: true, versionName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "id",
    "createdAt",
    "status",
    "interestType",
    "firstName",
    "lastName",
    "email",
    "phone",
    "vehicle",
    "message",
  ];

  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const rows = leads.map((lead) =>
    [
      lead.id,
      lead.createdAt.toISOString(),
      lead.status,
      lead.interestType,
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone ?? "",
      lead.vehicle ? `${lead.vehicle.maker} ${lead.vehicle.versionName}` : "",
      (lead.message ?? "").replace(/\n/g, " "),
    ]
      .map((cell) => escapeCsv(String(cell)))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}
