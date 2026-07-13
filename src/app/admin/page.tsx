import Link from "next/link";
import { requirePageAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listImportLogs } from "@/server/services/import.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const IMPORT_STATUS_VARIANT: Record<string, "available" | "muted" | "reserved"> = {
  SUCCESS: "available",
  PARTIAL_SUCCESS: "reserved",
  FAILED: "muted",
};

export default async function AdminDashboardPage() {
  await requirePageAdmin();

  const [
    totalVehicles,
    activeVehicles,
    frozenVehicles,
    deletedVehicles,
    totalLeads,
    newLeads,
    contactMessages,
    newContactMessages,
    recentImports,
    recentVehicles,
  ] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { froze: false, isDeleted: false } }),
    prisma.vehicle.count({ where: { froze: true } }),
    prisma.vehicle.count({ where: { isDeleted: true } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    listImportLogs({ page: 1, pageSize: 5 }),
    prisma.vehicle.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  const stats = [
    { label: "Σύνολο Οχημάτων", value: totalVehicles },
    { label: "Ενεργά Οχήματα", value: activeVehicles },
    { label: "Παγωμένα Οχήματα", value: frozenVehicles },
    { label: "Αρχειοθετημένα Οχήματα", value: deletedVehicles },
    { label: "Σύνολο Leads", value: totalLeads },
    { label: "Νέα Leads", value: newLeads },
    { label: "Μηνύματα Επικοινωνίας", value: contactMessages },
    { label: "Νέα Μηνύματα", value: newContactMessages },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {stat.label}
              </span>
              <span className="text-2xl font-semibold text-ink">{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Πρόσφατες Εισαγωγές</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
                  <th className="px-5 py-3">Πηγή</th>
                  <th className="px-5 py-3">Κατάσταση</th>
                  <th className="px-5 py-3">Ημερομηνία</th>
                </tr>
              </thead>
              <tbody>
                {recentImports.items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-ink-muted">
                      Δεν υπάρχουν εισαγωγές
                    </td>
                  </tr>
                )}
                {recentImports.items.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/imports/${log.id}`} className="text-primary hover:underline">
                        {log.source}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={IMPORT_STATUS_VARIANT[log.status] ?? "muted"}>{log.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" }).format(
                        log.createdAt,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4">
              <Link href="/admin/imports" className="text-sm text-primary hover:underline">
                Προβολή όλων →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Πρόσφατες Αλλαγές Οχημάτων</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
                  <th className="px-5 py-3">Όχημα</th>
                  <th className="px-5 py-3">Ενημερώθηκε</th>
                </tr>
              </thead>
              <tbody>
                {recentVehicles.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-5 py-6 text-center text-ink-muted">
                      Δεν υπάρχουν οχήματα
                    </td>
                  </tr>
                )}
                {recentVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/vehicles/${vehicle.id}`} className="text-primary hover:underline">
                        {vehicle.maker} {vehicle.versionName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" }).format(
                        vehicle.updatedAt,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4">
              <Link href="/admin/vehicles" className="text-sm text-primary hover:underline">
                Προβολή όλων →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
