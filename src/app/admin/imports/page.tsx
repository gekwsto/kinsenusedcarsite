import Link from "next/link";
import { requirePagePermission } from "@/lib/permissions";
import { listImportLogs } from "@/server/services/import.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "available" | "reserved" | "muted"> = {
  SUCCESS: "available",
  PARTIAL_SUCCESS: "reserved",
  FAILED: "muted",
};

interface AdminImportsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminImportsPage({ searchParams }: AdminImportsPageProps) {
  await requirePagePermission("IMPORT_LOG_READ");
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const result = await listImportLogs({ page, pageSize: 20 });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Εισαγωγές</h1>

      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">Πηγή</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3">Παραλήφθηκαν</th>
              <th className="px-4 py-3">Δημιουργήθηκαν</th>
              <th className="px-4 py-3">Ενημερώθηκαν</th>
              <th className="px-4 py-3">Διαγράφηκαν</th>
              <th className="px-4 py-3">Παγώθηκαν</th>
              <th className="px-4 py-3">Ημερομηνία</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-muted">
                  Δεν υπάρχουν εισαγωγές
                </td>
              </tr>
            )}
            {result.items.map((log) => (
              <tr key={log.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/imports/${log.id}`} className="font-medium text-primary hover:underline">
                    {log.source}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[log.status] ?? "muted"}>{log.status}</Badge>
                </td>
                <td className="px-4 py-3">{log.receivedCount}</td>
                <td className="px-4 py-3">{log.createdCount}</td>
                <td className="px-4 py-3">{log.updatedCount}</td>
                <td className="px-4 py-3">{log.deletedCount}</td>
                <td className="px-4 py-3">{log.frozenCount}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" }).format(
                    log.createdAt,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>Σύνολο: {result.total}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? <Link href={`/admin/imports?page=${page - 1}`}>Προηγούμενη</Link> : <span>Προηγούμενη</span>}
          </Button>
          <span>
            Σελίδα {result.page} από {result.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= result.totalPages} asChild={page < result.totalPages}>
            {page < result.totalPages ? (
              <Link href={`/admin/imports?page=${page + 1}`}>Επόμενη</Link>
            ) : (
              <span>Επόμενη</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
