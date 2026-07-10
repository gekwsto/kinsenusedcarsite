"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Menu, User, LogOut } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/components/layout/nav";

export function MobileNav() {
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Άνοιγμα μενού" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Μενού</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link href={item.href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface">
                {item.label}
              </Link>
            </SheetClose>
          ))}
          <SheetClose asChild>
            <Link href="/faq" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface">
              Η Εταιρεία μας &middot; FAQ
            </Link>
          </SheetClose>
        </nav>

        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
          {session?.user ? (
            <>
              <SheetClose asChild>
                <Link
                  href="/account"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
                >
                  <User className="h-4 w-4" /> Ο λογαριασμός μου
                </Link>
              </SheetClose>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-surface"
              >
                <LogOut className="h-4 w-4" /> Αποσύνδεση
              </button>
            </>
          ) : (
            <SheetClose asChild>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
              >
                <User className="h-4 w-4" /> Σύνδεση
              </Link>
            </SheetClose>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
