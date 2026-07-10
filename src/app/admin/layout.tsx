import { requirePageAdmin, getPermissionsForRole } from "@/lib/permissions";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: middleware already blocks non-admins from /admin/*,
  // but every admin entry point must re-verify at the service level.
  const user = await requirePageAdmin();
  const permissions = getPermissionsForRole(user.role);

  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar permissions={permissions} />
      <div className="flex flex-1 flex-col">
        <AdminTopbar
          name={[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}
          email={user.email}
          role={user.role}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
