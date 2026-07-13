"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = ["NEW", "CONTACTED", "IN_PROGRESS", "WON", "LOST", "SPAM"];

const STATUS_BADGE: Record<string, "default" | "accent" | "offer" | "reserved" | "available" | "muted"> = {
  NEW: "offer",
  CONTACTED: "reserved",
  IN_PROGRESS: "default",
  WON: "available",
  LOST: "muted",
  SPAM: "muted",
};

export interface LeadRow {
  id: string;
  createdAt: string | Date;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  message: string | null;
  interestType: string;
  status: string;
  internalNotes: unknown;
  vehicle: { id: string; maker: string; versionName: string; slug: string } | null;
}

interface LeadsTableProps {
  leads: LeadRow[];
  page: number;
  totalPages: number;
  total: number;
}

function notesToText(notes: unknown): string {
  if (!notes) return "";
  if (typeof notes === "string") return notes;
  if (typeof notes === "object" && notes !== null && "note" in notes) {
    return String((notes as { note?: string }).note ?? "");
  }
  return JSON.stringify(notes);
}

export function LeadsTable({ leads, page, totalPages, total }: LeadsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailLead, setDetailLead] = useState<LeadRow | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("NEW");
  const [saving, setSaving] = useState(false);

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  function openDetail(lead: LeadRow) {
    setDetailLead(lead);
    setNotesDraft(notesToText(lead.internalNotes));
    setStatusDraft(lead.status);
  }

  async function updateStatus(leadId: string, status: string) {
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Αποτυχία ενημέρωσης κατάστασης");
      toast({ title: "Η κατάσταση ενημερώθηκε" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function saveDetail() {
    if (!detailLead) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${detailLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusDraft, internalNotes: { note: notesDraft } }),
      });
      if (!res.ok) throw new Error("Αποτυχία αποθήκευσης");
      toast({ title: "Το lead ενημερώθηκε" });
      setDetailLead(null);
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">Ημερομηνία</th>
              <th className="px-4 py-3">Στοιχεία Επικοινωνίας</th>
              <th className="px-4 py-3">Τύπος</th>
              <th className="px-4 py-3">Όχημα</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  Δεν βρέθηκαν leads
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink-muted">
                  {new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" }).format(
                    new Date(lead.createdAt),
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">
                    {lead.firstName} {lead.lastName}
                  </div>
                  <div className="text-xs text-ink-muted">{lead.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="muted">{lead.interestType}</Badge>
                </td>
                <td className="px-4 py-3">
                  {lead.vehicle ? (
                    <Link href={`/vehicles/${lead.vehicle.slug}`} target="_blank" className="text-primary hover:underline">
                      {lead.vehicle.maker} {lead.vehicle.versionName}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={lead.status}
                    onValueChange={(v) => updateStatus(lead.id, v)}
                    disabled={busyId === lead.id}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue>
                        <Badge variant={STATUS_BADGE[lead.status] ?? "default"}>{lead.status}</Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" title="Προβολή" onClick={() => openDetail(lead)}>
                    <Eye className="h-4 w-4" />
                  </Button>
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
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
            Επόμενη
          </Button>
        </div>
      </div>

      <Dialog open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Lead: {detailLead?.firstName} {detailLead?.lastName}
            </DialogTitle>
          </DialogHeader>
          {detailLead && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-ink-muted">Email</p>
                  <p className="text-ink">{detailLead.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-ink-muted">Τηλέφωνο</p>
                  <p className="text-ink">{detailLead.phone ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-ink-muted">Τύπος Ενδιαφέροντος</p>
                  <p className="text-ink">{detailLead.interestType}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-ink-muted">Όχημα</p>
                  <p className="text-ink">
                    {detailLead.vehicle ? `${detailLead.vehicle.maker} ${detailLead.vehicle.versionName}` : "-"}
                  </p>
                </div>
              </div>
              {detailLead.message && (
                <div>
                  <p className="text-xs uppercase text-ink-muted">Μήνυμα</p>
                  <p className="whitespace-pre-wrap text-sm text-ink">{detailLead.message}</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Κατάσταση</Label>
                <Select value={statusDraft} onValueChange={setStatusDraft}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="internal-notes">Εσωτερικές Σημειώσεις</Label>
                <Textarea
                  id="internal-notes"
                  rows={4}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDetailLead(null)} disabled={saving}>
                  Ακύρωση
                </Button>
                <Button onClick={saveDetail} disabled={saving}>
                  {saving ? "Αποθήκευση…" : "Αποθήκευση"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
