"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminTopbarProps {
  name: string;
  email: string;
  role: string;
}

export function AdminTopbar({ name, email, role }: AdminTopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="text-xs text-ink-muted">
            {email} · {role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4" />
          Αποσύνδεση
        </Button>
      </div>
    </header>
  );
}
