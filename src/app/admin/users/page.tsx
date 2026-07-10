import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { listUsers } from "@/server/services/user.service";
import { UsersTable } from "@/components/admin/users-table";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";

export const dynamic = "force-dynamic";

interface AdminUsersPageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const currentUser = await requirePagePermission("USER_READ");
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await listUsers({ search: sp.search, page, pageSize: 20 });
  const canCreateUsers = hasPermission(currentUser, "USER_CREATE");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Χρήστες</h1>
        {canCreateUsers && <CreateUserDialog />}
      </div>
      <UsersTable
        users={result.items}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        canManageRoles={hasPermission(currentUser, "USER_ROLE_UPDATE")}
      />
    </div>
  );
}
