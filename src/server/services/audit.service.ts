import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/permissions";

export type AdminAuditAction =
  | "USER_CREATE"
  | "USER_ROLE_UPDATE"
  | "USER_ACTIVATE"
  | "USER_DEACTIVATE"
  | "USER_PASSWORD_RESET";

export async function logAdminAction(params: {
  actor: CurrentUser;
  action: AdminAuditAction;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.adminAuditLog.create({
    data: {
      actorId: params.actor.id,
      actorEmail: params.actor.email,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata as object | undefined,
    },
  });
}

export async function listAuditLogForTarget(targetType: string, targetId: string) {
  return prisma.adminAuditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
