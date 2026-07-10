import crypto from "crypto";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/permissions";
import { hashPassword, EmailAlreadyRegisteredError } from "@/server/services/auth.service";
import { logAdminAction } from "@/server/services/audit.service";
import type { CreateUserInput } from "@/lib/validators/user.schema";

export { EmailAlreadyRegisteredError };

export class SelfModificationError extends AppError {
  constructor(message = "Δεν μπορείτε να τροποποιήσετε τον δικό σας λογαριασμό μέσω αυτής της ενέργειας.") {
    super(message, 400);
  }
}

export class LastSuperAdminError extends AppError {
  constructor(message = "Πρέπει να παραμείνει τουλάχιστον ένας ενεργός Super Admin.") {
    super(message, 400);
  }
}

function generateTemporaryPassword(): string {
  // 9 random bytes -> 12-char base64url string. Plenty of entropy for a
  // one-time temporary password that the user is expected to change.
  return crypto.randomBytes(9).toString("base64url");
}

async function assertNotLastActiveSuperAdmin(targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  if (target?.role !== "SUPER_ADMIN") return;

  const activeSuperAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
  if (activeSuperAdmins <= 1) throw new LastSuperAdminError();
}

export async function listUsers(params: { search?: string; page?: number; pageSize?: number }) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: Prisma.UserWhereInput = params.search
    ? {
        OR: [
          { email: { contains: params.search, mode: "insensitive" } },
          { firstName: { contains: params.search, mode: "insensitive" } },
          { lastName: { contains: params.search, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { favorites: true, leads: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Role changes: blocked for self-modification (an actor can never change
 * their own role through this path, safe or not) and blocked if it would
 * demote the last remaining active SUPER_ADMIN, to prevent a full lockout.
 */
export async function updateUserRole(actor: CurrentUser, targetId: string, role: Role) {
  if (actor.id === targetId) throw new SelfModificationError("Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο.");
  if (role !== "SUPER_ADMIN") await assertNotLastActiveSuperAdmin(targetId);

  const user = await prisma.user.update({ where: { id: targetId }, data: { role } });
  await logAdminAction({ actor, action: "USER_ROLE_UPDATE", targetType: "User", targetId, metadata: { newRole: role } });
  return user;
}

/**
 * Activation toggles: blocked for self-deactivation (prevents locking
 * yourself out) and blocked if deactivating would leave zero active
 * SUPER_ADMINs.
 */
export async function setUserActive(actor: CurrentUser, targetId: string, isActive: boolean) {
  if (actor.id === targetId && !isActive) {
    throw new SelfModificationError("Δεν μπορείτε να απενεργοποιήσετε τον δικό σας λογαριασμό.");
  }
  if (!isActive) await assertNotLastActiveSuperAdmin(targetId);

  const user = await prisma.user.update({ where: { id: targetId }, data: { isActive } });
  await logAdminAction({
    actor,
    action: isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
    targetType: "User",
    targetId,
  });
  return user;
}

/**
 * SUPER_ADMIN-only user creation (gated by USER_CREATE at the route level).
 * If no password is supplied, a random temporary one is generated and
 * returned once in the result — never logged, never stored in plaintext.
 */
export async function createUser(actor: CurrentUser, input: CreateUserInput) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new EmailAlreadyRegisteredError();

  const generatedPassword = input.password ? null : generateTemporaryPassword();
  const passwordHash = await hashPassword(input.password ?? generatedPassword!);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      role: input.role,
      isActive: true,
    },
  });

  await logAdminAction({
    actor,
    action: "USER_CREATE",
    targetType: "User",
    targetId: user.id,
    metadata: { role: input.role },
  });

  return { user, temporaryPassword: generatedPassword ?? undefined };
}

/**
 * Generates a fresh random password for the target user and returns it once
 * — the caller (SUPER_ADMIN) is responsible for relaying it out-of-band.
 */
export async function resetUserPassword(actor: CurrentUser, targetId: string) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await prisma.user.update({ where: { id: targetId }, data: { passwordHash } });
  await logAdminAction({ actor, action: "USER_PASSWORD_RESET", targetType: "User", targetId });

  return { user, temporaryPassword };
}
