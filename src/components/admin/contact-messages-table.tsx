"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = ["NEW", "READ", "ARCHIVED", "SPAM"];

const STATUS_BADGE: Record<string, "default" | "accent" | "offer" | "reserved" | "available" | "muted"> = {
  NEW: "offer",
  READ: "default",
  ARCHIVED: "muted",
  SPAM: "muted",
};

export interface ContactMessageRow {
  id: string;
  createdAt: string | Date;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  message: string;
  status: string;
}

interface ContactMessagesTableProps {
  messages: ContactMessageRow[];
  page: number;
  totalPages: number;
  total: number;
}

export function ContactMessagesTable({ messages, page, totalPages, total }: ContactMessagesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<ContactMessageRow | null>(null);

  function updateStatusFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set("status", value);
    else params.delete("status");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/contact-messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Αποτυχία ενημέρωσης κατάστασης");
      toast({ title: "Η κατάσταση ενημερώθηκε" });
      setDetailMessage((current) => (current && current.id === id ? { ...current, status } : current));
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

  function openDetail(msg: ContactMessageRow) {
    setDetailMessage(msg);
    if (msg.status === "NEW") {
      updateStatus(msg.id, "READ");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <Select value={searchParams.get("status") ?? "all"} onValueChange={updateStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Κατάσταση" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">Ημερομηνία</th>
              <th className="px-4 py-3">Στοιχεία</th>
              <th className="px-4 py-3">Μήνυμα</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  Δεν βρέθηκαν μηνύματα
                </td>
              </tr>
            )}
            {messages.map((msg) => (
              <tr key={msg.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink-muted">
                  {new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" }).format(
                    new Date(msg.createdAt),
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">
                    {msg.firstName} {msg.lastName ?? ""}
                  </div>
                  <div className="text-xs text-ink-muted">{msg.email}</div>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-ink-muted">{msg.message}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_BADGE[msg.status] ?? "default"}>{msg.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" title="Προβολή" onClick={() => openDetail(msg)}>
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

      <Dialog open={!!detailMessage} onOpenChange={(open) => !open && setDetailMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailMessage?.firstName} {detailMessage?.lastName ?? ""}
            </DialogTitle>
          </DialogHeader>
          {detailMessage && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-ink-muted">Email</p>
                  <p className="text-ink">{detailMessage.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-ink-muted">Τηλέφωνο</p>
                  <p className="text-ink">{detailMessage.phone ?? "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase text-ink-muted">Μήνυμα</p>
                <p className="whitespace-pre-wrap text-sm text-ink">{detailMessage.message}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs uppercase text-ink-muted">Κατάσταση</p>
                <Select
                  value={detailMessage.status}
                  onValueChange={(v) => updateStatus(detailMessage.id, v)}
                  disabled={busyId === detailMessage.id}
                >
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
