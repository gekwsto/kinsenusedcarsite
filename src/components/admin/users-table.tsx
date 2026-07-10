"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/use-toast";

const ROLE_OPTIONS = ["CUSTOMER", "ADMIN", "SUPER_ADMIN"];

export interface UserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | Date;
  _count: { favorites: number; leads: number };
}

interface UsersTableProps {
  users: UserRow[];
  page: number;
  totalPages: number;
  total: number;
  canManageRoles: boolean;
}

export function UsersTable({ users, page, totalPages, total, canManageRoles }: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  async function updateRole(userId: string, role: string) {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Αποτυχία ενημέρωσης ρόλου");
      toast({ title: "Ο ρόλος ενημερώθηκε" });
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

  async function setActive(userId: string, isActive: boolean) {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Αποτυχία ενημέρωσης χρήστη");
      toast({ title: isActive ? "Ο χρήστης ενεργοποιήθηκε" : "Ο χρήστης απενεργοποιήθηκε" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setDeactivateTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearchSubmit} className="flex max-w-md gap-2">
        <Input
          placeholder="Αναζήτηση με email ή όνομα…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Αναζήτηση
        </Button>
      </form>

      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
              <th className="px-4 py-3">Χρήστης</th>
              <th className="px-4 py-3">Ρόλος</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3">Αγαπημένα / Leads</th>
              <th className="px-4 py-3">Εγγραφή</th>
              <th className="px-4 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  Δεν βρέθηκαν χρήστες
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div className="text-xs text-ink-muted">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={user.role}
                    onValueChange={(v) => updateRole(user.id, v)}
                    disabled={!canManageRoles || busyId === user.id}
                  >
                    <SelectTrigger className="w-40">
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
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.isActive ? "available" : "muted"}>
                    {user.isActive ? "Ενεργός" : "Ανενεργός"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {user._count.favorites} / {user._count.leads}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {new Intl.DateTimeFormat("el-GR", { dateStyle: "short" }).format(new Date(user.createdAt))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild title="Λεπτομέρειες">
                      <Link href={`/admin/users/${user.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {user.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === user.id}
                        onClick={() => setDeactivateTarget(user)}
                      >
                        Απενεργοποίηση
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === user.id}
                        onClick={() => setActive(user.id, true)}
                      >
                        Ενεργοποίηση
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
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
            Επόμενη
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Απενεργοποίηση χρήστη"
        description="Ο χρήστης δεν θα μπορεί να συνδεθεί μέχρι να ενεργοποιηθεί ξανά."
        destructive
        loading={busyId === deactivateTarget?.id}
        onConfirm={() => deactivateTarget && setActive(deactivateTarget.id, false)}
      />
    </div>
  );
}
