import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getImportLogById } from "@/server/services/import.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STATUS_VARIANT: Record<string, "available" | "reserved" | "muted"> = {
  SUCCESS: "available",
  PARTIAL_SUCCESS: "reserved",
  FAILED: "muted",
};

interface ImportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ImportDetailPage({ params }: ImportDetailPageProps) {
  const user = await requirePagePermission("IMPORT_LOG_READ");
  const canViewRawPayload = hasPermission(user, "IMPORT_RAW_PAYLOAD_READ");
  const { id } = await params;
  const log = await getImportLogById(id, { includeRawPayload: canViewRawPayload });
  if (!log) notFound();

  const errors = log.errors as unknown;
  const rawPayload = canViewRawPayload ? ((log as { rawPayload?: unknown }).rawPayload as unknown) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link href="/admin/imports">
          <ArrowLeft className="h-4 w-4" />
          Πίσω στις εισαγωγές
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">Εισαγωγή: {log.source}</h1>
        <Badge variant={STATUS_VARIANT[log.status] ?? "muted"}>{log.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Σύνοψη</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Παραλήφθηκαν" value={log.receivedCount} />
          <Stat label="Δημιουργήθηκαν" value={log.createdCount} />
          <Stat label="Ενημερώθηκαν" value={log.updatedCount} />
          <Stat label="Διαγράφηκαν" value={log.deletedCount} />
          <Stat label="Παγώθηκαν" value={log.frozenCount} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Σφάλματα</CardTitle>
        </CardHeader>
        <CardContent>
          {errors ? (
            <pre className="overflow-x-auto rounded-lg bg-surface p-4 text-xs text-ink">
              {JSON.stringify(errors, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-ink-muted">Δεν υπάρχουν καταγεγραμμένα σφάλματα.</p>
          )}
        </CardContent>
      </Card>

      {canViewRawPayload && (
        <Card>
          <CardHeader>
            <CardTitle>Ωμό Payload</CardTitle>
          </CardHeader>
          <CardContent>
            {rawPayload ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  Προβολή ωμού payload
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-surface p-4 text-xs text-ink">
                  {JSON.stringify(rawPayload, null, 2)}
                </pre>
              </details>
            ) : (
              <p className="text-sm text-ink-muted">Δεν υπάρχει διαθέσιμο payload.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase text-ink-muted">{label}</span>
      <span className="text-xl font-semibold text-ink">{value}</span>
    </div>
  );
}
