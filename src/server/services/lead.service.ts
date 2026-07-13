import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateLeadInput, UpdateLeadInput } from "@/lib/validators/lead.schema";
import type { LeadWithVehicle } from "@/server/services/lead-notification.service";

export interface CreateLeadResult {
  lead: LeadWithVehicle;
  /** True when `input.submissionId` already matched an existing Lead — the
   * row returned is the ORIGINAL one, nothing was written, and the caller
   * must skip notification emails entirely (see /api/leads/route.ts). */
  isDuplicate: boolean;
}

/**
 * Creates a Lead, or — when `input.submissionId` is set and already used —
 * returns the original Lead untouched. This is what makes retrying the
 * exact same form submission (e.g. after a client-side network error) safe:
 * no duplicate row, and the caller knows (via `isDuplicate`) not to fire
 * notification emails a second time.
 */
export async function createLead(
  input: CreateLeadInput,
  opts: { userId?: string; source?: string },
): Promise<CreateLeadResult> {
  if (input.submissionId) {
    const existing = await prisma.lead.findUnique({
      where: { submissionId: input.submissionId },
      include: { vehicle: true },
    });
    if (existing) return { lead: existing, isDuplicate: true };
  }

  const data = {
    userId: opts.userId,
    vehicleId: input.vehicleId || null,
    interestType: input.interestType,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone || null,
    message: input.message || null,
    source: opts.source ?? "website",
    submissionId: input.submissionId || null,
  };

  try {
    const lead = await prisma.lead.create({ data, include: { vehicle: true } });
    return { lead, isDuplicate: false };
  } catch (error) {
    // Two concurrent requests carrying the same submissionId can both pass
    // the findUnique check above before either commits — the loser hits a
    // unique-constraint violation here instead of a lost update. Treat that
    // exactly like the pre-check hit: return the winner's row as a
    // duplicate rather than surfacing a spurious 500 to the client.
    if (
      input.submissionId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.lead.findUnique({
        where: { submissionId: input.submissionId },
        include: { vehicle: true },
      });
      if (existing) return { lead: existing, isDuplicate: true };
    }
    throw error;
  }
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
