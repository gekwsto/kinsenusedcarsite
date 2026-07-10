import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/types/next-auth";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ---------------------------------------------------------------------------
// Permissions
//
// v1 design note: this is a CODE-LEVEL role -> permission mapping. There is
// no database table for permissions — `User.role` (CUSTOMER | ADMIN |
// SUPER_ADMIN) remains the single source of truth. It is centralized here,
// and every authorization check in the app (pages, server actions, API
// routes) goes through hasPermission()/requirePermission() rather than a raw
// `role === "ADMIN"` comparison scattered around. That indirection is what
// makes a future move to DB-managed permissions (a `Permission` +
// `RolePermission` table, loaded into ROLE_PERMISSIONS at request time)
// a change to this one file instead of a hunt across the codebase.
// ---------------------------------------------------------------------------

export type Permission =
  | "VEHICLE_READ"
  | "VEHICLE_CREATE"
  | "VEHICLE_UPDATE"
  | "VEHICLE_DELETE"
  | "VEHICLE_IMAGE_MANAGE"
  | "LEAD_READ"
  | "LEAD_UPDATE"
  | "CONTACT_MESSAGE_READ"
  | "CONTACT_MESSAGE_UPDATE"
  | "CONTENT_READ"
  | "CONTENT_UPDATE"
  | "FAQ_MANAGE"
  | "IMPORT_LOG_READ"
  | "IMPORT_RAW_PAYLOAD_READ"
  | "USER_READ"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "USER_ROLE_UPDATE"
  | "SETTINGS_READ"
  | "SETTINGS_UPDATE";

// What a limited back-office ADMIN can do: day-to-day content and lead
// operations, but nothing about other users, roles, settings, or the raw
// CarStock vendor payloads (which may carry more data than the normalized
// vehicle fields and are treated as sensitive).
const ADMIN_PERMISSIONS: Permission[] = [
  "VEHICLE_READ",
  "VEHICLE_CREATE",
  "VEHICLE_UPDATE",
  "VEHICLE_DELETE",
  "VEHICLE_IMAGE_MANAGE",
  "LEAD_READ",
  "LEAD_UPDATE",
  "CONTACT_MESSAGE_READ",
  "CONTACT_MESSAGE_UPDATE",
  "CONTENT_READ",
  "CONTENT_UPDATE",
  "FAQ_MANAGE",
  "IMPORT_LOG_READ",
];

// Everything ADMIN has, plus the sensitive/critical operations: user &
// role management, site settings, and raw import payloads.
const SUPER_ADMIN_ONLY_PERMISSIONS: Permission[] = [
  "IMPORT_RAW_PAYLOAD_READ",
  "USER_READ",
  "USER_CREATE",
  "USER_UPDATE",
  "USER_ROLE_UPDATE",
  "SETTINGS_READ",
  "SETTINGS_UPDATE",
];

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  CUSTOMER: [],
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: [...ADMIN_PERMISSIONS, ...SUPER_ADMIN_ONLY_PERMISSIONS],
};

export function getPermissionsForRole(role: AppRole | null | undefined): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

// ---------------------------------------------------------------------------
// Current user resolution
// ---------------------------------------------------------------------------

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: AppRole;
  isActive: boolean;
}

/**
 * Resolves the current user and re-checks role/isActive fresh from the
 * database on every call, rather than trusting the values baked into the
 * NextAuth JWT at login time. Sessions use the JWT strategy (no DB session
 * table), so without this re-check, deactivating a user or changing their
 * role would only take effect after their token expires or they re-log in —
 * this makes both effective immediately, on the very next request.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return user;
}

export function hasRole(user: CurrentUser | null, role: AppRole): boolean {
  return user?.role === role;
}

export function hasAnyRole(user: CurrentUser | null, roles: AppRole[]): boolean {
  return !!user && roles.includes(user.role);
}

export function hasPermission(user: CurrentUser | null, permission: Permission): boolean {
  return !!user && getPermissionsForRole(user.role).includes(permission);
}

export function isAdminRole(role: AppRole | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdminRole(role: AppRole | undefined | null): boolean {
  return role === "SUPER_ADMIN";
}

// ---------------------------------------------------------------------------
// Throwing guards — use in API routes and server actions.
// handleApiError() (src/lib/api-error.ts) maps UnauthorizedError -> 401 and
// ForbiddenError -> 403 as proper JSON responses.
// ---------------------------------------------------------------------------

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(role: AppRole): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user, role)) throw new ForbiddenError();
  return user;
}

export async function requireAnyRole(roles: AppRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasAnyRole(user, roles)) throw new ForbiddenError();
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) throw new ForbiddenError();
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  return requireAnyRole(["ADMIN", "SUPER_ADMIN"]);
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  return requireRole("SUPER_ADMIN");
}

// ---------------------------------------------------------------------------
// Redirecting guards — use in server-rendered admin pages, where an uncaught
// throw would otherwise surface Next's generic error boundary instead of a
// clean redirect. Unauthenticated -> /login; authenticated but missing the
// permission -> /admin (visible to any admin-ish role) by default.
// ---------------------------------------------------------------------------

export async function requirePagePermission(
  permission: Permission,
  opts: { forbiddenRedirectTo?: string } = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, permission)) redirect(opts.forbiddenRedirectTo ?? "/admin");
  return user;
}

export async function requirePageAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"])) redirect("/");
  return user;
}
