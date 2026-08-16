"use client";

import Image from "next/image";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { useSession, signOut } from "next-auth/react";
import { Heart, User, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KINSEN_CTA_BUTTON_CLASSNAME } from "@/components/ui/kinsen-cta-button";
import { Nav } from "@/components/layout/nav";
import { NavDropdown } from "@/components/layout/nav-dropdown";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useFavorites } from "@/components/providers/favorites-provider";
import { cn } from "@/lib/utils";

const ACCOUNT_MENU_ITEM_CLASSNAME =
  "block rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-primary/5 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

export function Header() {
  const { data: session, status } = useSession();
  const { favoriteIds } = useFavorites();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      {/* `relative` is what makes the logo's absolute centering below measure
          against this container's own box — which, since container-wide is
          itself symmetric and only clamps to a max-width far past mobile/
          tablet viewports, is equivalent to true viewport centering there.
          Below `lg` the only two flex participants are the hamburger
          wrapper and the right cluster (the logo is taken out of flow
          entirely), so `justify-between` places them left/right with zero
          risk of their differing widths pulling the centered logo off-axis
          — the classic failure mode of trying to center a middle flex/grid
          item between two asymmetric siblings. */}
      <div className="container-wide relative flex h-16 items-center justify-between gap-3">
        {/* Hamburger trigger, left-aligned within the normal page gutter —
            hidden (and out of the flex layout entirely) at `lg`+, where
            MobileNav's own trigger button already carries `lg:hidden`. */}
        <div className="lg:hidden">
          <MobileNav />
        </div>

        <Link
          href="/"
          aria-label="Αρχική"
          className="absolute left-1/2 top-1/2 h-8 w-24 shrink-0 -translate-x-1/2 -translate-y-1/2 sm:h-9 sm:w-28 md:h-10 md:w-32 lg:static lg:left-auto lg:top-auto lg:h-10 lg:w-32 lg:translate-x-0 lg:translate-y-0 xl:h-11 xl:w-36 2xl:h-12 2xl:w-40"
        >
          <Image
            src="/images/brandlogo.png"
            alt="Kinsen Hellas"
            fill
            sizes="(min-width: 1536px) 160px, (min-width: 1280px) 144px, (min-width: 768px) 128px, (min-width: 640px) 112px, 96px"
            className="object-contain object-center lg:object-left"
            priority
          />
        </Link>

        <div className="flex items-center gap-4 xl:gap-6 2xl:gap-8">
          <Nav className="hidden lg:flex" />

          <div className="flex items-center gap-3 2xl:gap-4">
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
              <div className="hidden sm:block">
                <NavDropdown
                  align="right"
                  panelClassName="w-48"
                  triggerClassName="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-primary/5 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  trigger={({ open }) => (
                    <>
                      <User className="h-4 w-4" />
                      {session.user.name?.split(" ")[0] ?? "Λογαριασμός"}
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
                    </>
                  )}
                >
                  {(session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") && (
                    <Link href="/admin" className={ACCOUNT_MENU_ITEM_CLASSNAME}>
                      Πίνακας Διαχείρισης
                    </Link>
                  )}
                  <Link href="/account" className={ACCOUNT_MENU_ITEM_CLASSNAME}>
                    Ο λογαριασμός μου
                  </Link>
                  <Link href="/favorites" className={ACCOUNT_MENU_ITEM_CLASSNAME}>
                    Αγαπημένα
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className={cn(ACCOUNT_MENU_ITEM_CLASSNAME, "flex w-full items-center gap-2 text-left")}
                  >
                    <LogOut className="h-3.5 w-3.5" /> Αποσύνδεση
                  </button>
                </NavDropdown>
              </div>
            ) : (
              // The Kinsen static corporate CTA is shared (see
              // kinsen-cta-button.tsx) with the Login page's main
              // "Σύνδεση" submit button and the homepage CTAs — its own
              // colors/border are untouched here.
              // `2xl:h-10 2xl:min-w-[150px] 2xl:px-4 2xl:text-[15px]` is
              // this call site's own modest size bump so the CTA still
              // feels balanced against the larger nav text at 2xl+, not a
              // change to the shared appearance itself. Visible at every
              // width (this is the mobile Sheet's only sign-in access
              // point too — see mobile-nav.tsx, which no longer duplicates
              // a "Σύνδεση" row), so its own static footprint (min-width/
              // padding/gap/icon size) is tuned down at the smallest
              // phones and restored from `sm:` up.
              <Button
                asChild
                variant="primary"
                size="sm"
                className={cn(
                  KINSEN_CTA_BUTTON_CLASSNAME,
                  "min-w-0 gap-1 px-2 text-xs sm:min-w-[140px] sm:gap-2 sm:px-3 sm:text-sm rounded-md 2xl:h-10 2xl:min-w-[150px] 2xl:px-4 2xl:text-[15px]",
                )}
              >
                <Link href="/login">
                  <span className="inline-flex items-center gap-1 sm:gap-2">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Σύνδεση
                  </span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
