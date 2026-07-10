"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/use-toast";

export interface FaqItemRow {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface FaqFormState {
  question: string;
  answer: string;
  category: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FaqFormState = { question: "", answer: "", category: "", sortOrder: "0", isActive: true };

export function FaqManager({ items }: { items: FaqItemRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FaqFormState>(EMPTY_FORM);
  const [editItem, setEditItem] = useState<FaqItemRow | null>(null);
  const [editForm, setEditForm] = useState<FaqFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<FaqItemRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: createForm.question,
          answer: createForm.answer,
          category: createForm.category || undefined,
          sortOrder: Number(createForm.sortOrder) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Αποτυχία δημιουργίας FAQ");
      }
      toast({ title: "Το FAQ δημιουργήθηκε" });
      setCreateForm(EMPTY_FORM);
      setCreating(false);
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

  function openEdit(item: FaqItemRow) {
    setEditItem(item);
    setEditForm({
      question: item.question,
      answer: item.answer,
      category: item.category ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
  }

  async function handleEditSave() {
    if (!editItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/faq/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: editForm.question,
          answer: editForm.answer,
          category: editForm.category || undefined,
          sortOrder: Number(editForm.sortOrder) || 0,
          isActive: editForm.isActive,
        }),
      });
      if (!res.ok) throw new Error("Αποτυχία ενημέρωσης FAQ");
      toast({ title: "Το FAQ ενημερώθηκε" });
      setEditItem(null);
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

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/faq/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Αποτυχία διαγραφής FAQ");
      toast({ title: "Το FAQ διαγράφηκε" });
      setDeleteTarget(null);
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
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4" />
          Νέο FAQ
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>Νέο FAQ</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-question">Ερώτηση</Label>
                <Input
                  id="new-question"
                  required
                  value={createForm.question}
                  onChange={(e) => setCreateForm((f) => ({ ...f, question: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-answer">Απάντηση</Label>
                <Textarea
                  id="new-answer"
                  required
                  rows={4}
                  value={createForm.answer}
                  onChange={(e) => setCreateForm((f) => ({ ...f, answer: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-category">Κατηγορία</Label>
                  <Input
                    id="new-category"
                    value={createForm.category}
                    onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-sortOrder">Σειρά</Label>
                  <Input
                    id="new-sortOrder"
                    type="number"
                    value={createForm.sortOrder}
                    onChange={(e) => setCreateForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={saving}>
                  Ακύρωση
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Αποθήκευση…" : "Δημιουργία"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">Ερώτηση</th>
              <th className="px-4 py-3">Κατηγορία</th>
              <th className="px-4 py-3">Σειρά</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  Δεν υπάρχουν FAQ items
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="max-w-md px-4 py-3 font-medium text-ink">{item.question}</td>
                <td className="px-4 py-3 text-ink-muted">{item.category ?? "-"}</td>
                <td className="px-4 py-3 text-ink-muted">{item.sortOrder}</td>
                <td className="px-4 py-3">
                  <Badge variant={item.isActive ? "available" : "muted"}>
                    {item.isActive ? "Ενεργό" : "Ανενεργό"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Επεξεργασία" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Διαγραφή" onClick={() => setDeleteTarget(item)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Επεξεργασία FAQ</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-question">Ερώτηση</Label>
              <Input
                id="edit-question"
                value={editForm.question}
                onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-answer">Απάντηση</Label>
              <Textarea
                id="edit-answer"
                rows={4}
                value={editForm.answer}
                onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-category">Κατηγορία</Label>
                <Input
                  id="edit-category"
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-sortOrder">Σειρά</Label>
                <Input
                  id="edit-sortOrder"
                  type="number"
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm((f) => ({ ...f, isActive: !!checked }))}
              />
              Ενεργό
            </label>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>
                Ακύρωση
              </Button>
              <Button onClick={handleEditSave} disabled={saving}>
                {saving ? "Αποθήκευση…" : "Αποθήκευση"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Διαγραφή FAQ"
        description="Αυτή η ενέργεια δεν μπορεί να αναιρεθεί."
        destructive
        loading={saving}
        onConfirm={handleDelete}
      />
    </div>
  );
}
