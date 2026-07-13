"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pencil, Snowflake, Sun, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatEuro, formatKm } from "@/lib/utils";

export interface VehicleRow {
  id: string;
  slug: string;
  maker: string;
  versionName: string;
  yearRelease: number | null;
  price: number | null;
  km: number | null;
  offer: boolean;
  froze: boolean;
  isDeleted: boolean;
}

interface VehiclesTableProps {
  vehicles: VehicleRow[];
  page: number;
  totalPages: number;
  total: number;
}

function statusBadge(v: VehicleRow) {
  if (v.isDeleted) return <Badge variant="muted">Διαγραμμένο</Badge>;
  if (v.froze) return <Badge variant="reserved">Παγωμένο</Badge>;
  if (v.offer) return <Badge variant="offer">Προσφορά</Badge>;
  return <Badge variant="available">Ενεργό</Badge>;
}

export function VehiclesTable({ vehicles, page, totalPages, total }: VehiclesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [freezeTarget, setFreezeTarget] = useState<VehicleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function toggleFreeze(vehicle: VehicleRow, nextFroze: boolean) {
    setBusyId(vehicle.id);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}/freeze`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ froze: nextFroze }),
      });
      if (!res.ok) throw new Error("Αποτυχία ενημέρωσης κατάστασης");
      toast({ title: nextFroze ? "Το όχημα παγώθηκε" : "Το όχημα ενεργοποιήθηκε" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setFreezeTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/vehicles/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Αποτυχία διαγραφής οχήματος");
      toast({ title: "Το όχημα αρχειοθετήθηκε" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">Όχημα</th>
              <th className="px-4 py-3">Έτος</th>
              <th className="px-4 py-3">Τιμή</th>
              <th className="px-4 py-3">Χλμ</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  Δεν βρέθηκαν οχήματα
                </td>
              </tr>
            )}
            {vehicles.map((v) => (
              <tr key={v.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-ink">
                  {v.maker} {v.versionName}
                </td>
                <td className="px-4 py-3">{v.yearRelease ?? "-"}</td>
                <td className="px-4 py-3">{formatEuro(v.price)}</td>
                <td className="px-4 py-3">{formatKm(v.km)}</td>
                <td className="px-4 py-3">{statusBadge(v)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild title="Επεξεργασία">
                      <Link href={`/admin/vehicles/${v.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="Προεπισκόπηση">
                      <a href={`/vehicles/${v.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {v.froze ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ενεργοποίηση"
                        disabled={busyId === v.id}
                        onClick={() => toggleFreeze(v, false)}
                      >
                        <Sun className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Πάγωμα"
                        disabled={busyId === v.id}
                        onClick={() => setFreezeTarget(v)}
                      >
                        <Snowflake className="h-4 w-4" />
                      </Button>
                    )}
                    {!v.isDeleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Διαγραφή"
                        disabled={busyId === v.id}
                        onClick={() => setDeleteTarget(v)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>Σύνολο: {total}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            Προηγούμενη
          </Button>
          <span>
            Σελίδα {page} από {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Επόμενη
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!freezeTarget}
        onOpenChange={(open) => !open && setFreezeTarget(null)}
        title="Πάγωμα οχήματος"
        description="Το όχημα θα αποκρυφτεί από τη δημόσια σελίδα μέχρι να ενεργοποιηθεί ξανά."
        destructive={false}
        loading={busyId === freezeTarget?.id}
        onConfirm={() => freezeTarget && toggleFreeze(freezeTarget, true)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Διαγραφή οχήματος"
        description="Το όχημα θα αρχειοθετηθεί (soft delete) και δεν θα είναι ορατό στο κοινό."
        destructive
        loading={busyId === deleteTarget?.id}
        onConfirm={handleDelete}
      />
    </div>
  );
}
