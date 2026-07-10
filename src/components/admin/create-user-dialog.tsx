"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const ROLE_OPTIONS = ["CUSTOMER", "ADMIN", "SUPER_ADMIN"];

export function CreateUserDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", role: "CUSTOMER" });

  function resetForm() {
    setForm({ email: "", firstName: "", lastName: "", phone: "", role: "CUSTOMER" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Αποτυχία δημιουργίας χρήστη");
      setOpen(false);
      resetForm();
      setTemporaryPassword(data.temporaryPassword);
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Νέος Χρήστης
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Νέος Χρήστης</DialogTitle>
            <DialogDescription>
              Θα δημιουργηθεί προσωρινός κωδικός πρόσβασης, εκτός αν ορίσετε δικό σας.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              placeholder="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Όνομα"
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
              <Input
                placeholder="Επώνυμο"
                required
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Τηλέφωνο (προαιρετικό)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Ακύρωση
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Δημιουργία…" : "Δημιουργία"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!temporaryPassword} onOpenChange={(open) => !open && setTemporaryPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ο χρήστης δημιουργήθηκε</DialogTitle>
            <DialogDescription>
              Σημειώστε τον προσωρινό κωδικό τώρα — δεν θα εμφανιστεί ξανά.
            </DialogDescription>
          </DialogHeader>
          <code className="block rounded-lg bg-surface px-4 py-3 text-sm font-medium text-ink">
            {temporaryPassword}
          </code>
        </DialogContent>
      </Dialog>
    </>
  );
}
