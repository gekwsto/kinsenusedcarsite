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
      <div className="container-wide flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Αρχική" className="relative h-10 w-32 shrink-0 xl:h-11 xl:w-36">
          <Image
            src="/images/brandlogo.png"
            alt="Kinsen Hellas"
            fill
            sizes="(min-width: 1280px) 144px, 128px"
            className="object-contain object-left"
            priority
          />
        </Link>

        <div className="flex items-center gap-6 xl:gap-10">
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
              // Scoped entirely to this one call site (extra classes + decorative
              // spans) rather than touching `buttonVariants`/`Button` — every
              // other `variant="primary"` button on the site must keep its
              // plain hover treatment untouched.
              //
              // `hover:bg-primary` cancels the shared variant's own
              // `hover:bg-primary-dark` (last-in-source wins via `cn`'s
              // tailwind-merge): the color change on hover is now carried
              // entirely by the expanding teal circle below, not a background
              // swap on the button itself, so there is nothing left to fight it.
              <Button
                asChild
                variant="primary"
                size="sm"
                className="group relative isolate hidden min-w-[140px] rounded-md transition-[box-shadow,transform] duration-200 ease-out hover:bg-primary hover:shadow-[0_6px_18px_rgba(0,137,154,0.28)] active:scale-[0.97] motion-reduce:transition-none sm:inline-flex"
              >
                <Link href="/login">
                  {/* `overflow-hidden` lives on THIS inner wrapper, not the
                      `<a>` itself — an element's own `overflow: hidden`
                      clips its own outward box-shadow too, which would have
                      silently swallowed the focus-visible ring below. */}
                  <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[inherit]">
                    {/* The expanding surface — a fixed-size circle (220px,
                        well past this pill's ~145px corner-to-center
                        diagonal at any real width) scaled from 0 to cover
                        the button, so it's circular at every frame of the
                        animation, not just at rest/full. `transform`-only
                        (no width/height animation), so this never reflows
                        the page. */}
                    <span className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-detail transition-transform duration-[500ms] ease-[cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none group-hover:scale-100" />
                    {/* Near-invisible depth overlay, present at rest (on
                        navy) and after the hover fill (on teal) alike — not
                        a hover effect of its own. */}
                    <span className="absolute inset-0 z-[1] bg-gradient-to-b from-white/10 via-transparent to-black/10" />
                  </span>
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <User className="h-4 w-4 transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
                    Σύνδεση
                  </span>
                </Link>
              </Button>
            )}

            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
