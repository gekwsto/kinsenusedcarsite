"use client";

import Image from "next/image";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { useSession, signOut } from "next-auth/react";
import { Heart, User, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/layout/nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useFavorites } from "@/components/providers/favorites-provider";

export function Header() {
  const { data: session, status } = useSession();
  const { favoriteIds } = useFavorites();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Αρχική" className="relative h-10 w-32 shrink-0">
          <Image src="/images/brandlogo.png" alt="Kinsen Hellas" fill sizes="128px" className="object-contain object-left" priority />
        </Link>

        <Nav className="hidden lg:flex" />

        <div className="flex items-center gap-3">
          {status === "authenticated" && (
            <Link
              href="/favorites"
              aria-label="Αγαπημένα"
              className="relative hidden items-center justify-center rounded-full p-2 text-ink hover:bg-surface sm:flex"
            >
              <Heart
                className={favoriteIds.size > 0 ? "h-5 w-5 fill-favorite-active text-favorite-active" : "h-5 w-5 text-favorite-inactive"}
              />
              {favoriteIds.size > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {favoriteIds.size}
                </span>
              )}
            </Link>
          )}

          {status === "authenticated" && session?.user ? (
            <div className="group relative hidden sm:block">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-surface"
              >
                <User className="h-4 w-4" />
                {session.user.name?.split(" ")[0] ?? "Λογαριασμός"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="invisible absolute right-0 top-full w-48 rounded-lg border border-border bg-white p-1.5 opacity-0 shadow-card transition-opacity group-hover:visible group-hover:opacity-100">
                {(session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") && (
                  <Link href="/admin" className="block rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-surface">
                    Πίνακας Διαχείρισης
                  </Link>
                )}
                <Link href="/account" className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface">
                  Ο λογαριασμός μου
                </Link>
                <Link href="/favorites" className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-surface">
                  Αγαπημένα
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface"
                >
                  <LogOut className="h-3.5 w-3.5" /> Αποσύνδεση
                </button>
              </div>
            </div>
          ) : (
            <Button asChild variant="primary" size="sm" className="hidden min-w-[140px] rounded-md sm:inline-flex">
              <Link href="/login">
                <User className="h-4 w-4" /> Σύνδεση
              </Link>
            </Button>
          )}

          <MobileNav />
        </div>
      </div>
    </header>
  );
}
