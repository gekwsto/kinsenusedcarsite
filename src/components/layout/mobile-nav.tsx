"use client";

import * as React from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

// 44px-tall full-width tap targets throughout, per the site's minimum
// comfortable touch target; navy-tinted hover/active instead of the
// plain gray the rest of the site's `hover:bg-surface` normally uses,
// matching the desktop nav's restrained navy language rather than
// introducing a second hover language just for mobile. Text grows from
// 16px to 17px from `md` (tablet) up — the row height stays fixed at
// `min-h-11`, so the extra confidence comes from type size alone, not
// looser padding.
const MOBILE_LINK_CLASSNAME =
  "flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium text-ink transition-colors hover:bg-primary/5 active:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:text-[17px]";
const MOBILE_LINK_ACTIVE_CLASSNAME = "bg-primary/5 font-semibold text-primary-dark";

// A plain three-bar → X morph, driven directly by the Sheet's own `open`
// state rather than a separate animation library — three absolutely
// positioned bars that rotate/fade into an X. Purely decorative
// (aria-hidden); the trigger button itself carries the real
// open/close label.
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="relative flex h-4 w-5 flex-col items-center justify-center">
      <span
        className={cn(
          "absolute h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-out",
          open ? "translate-y-0 rotate-45" : "-translate-y-[5px]",
        )}
      />
      <span
        className={cn("absolute h-0.5 w-5 rounded-full bg-current transition-opacity duration-150", open && "opacity-0")}
      />
      <span
        className={cn(
          "absolute h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ease-out",
          open ? "translate-y-0 -rotate-45" : "translate-y-[5px]",
        )}
      />
    </span>
  );
}

export function MobileNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const faqActive = pathname?.startsWith("/faq") ?? false;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? "Κλείσιμο μενού" : "Άνοιγμα μενού"}
          className="h-11 w-11 text-primary lg:hidden"
        >
          <HamburgerIcon open={open} />
        </Button>
      </SheetTrigger>
      {/* Opens from the left, alongside the hamburger's new left position
          in the Header. Narrower on the smallest phones (leaves a sliver of
          the page visible behind it) than on larger phones/tablets (a
          full, comfortable 384px, never "ridiculously narrow" on a
          768–820px tablet). */}
      <SheetContent side="left" className="w-[85vw] max-w-xs sm:w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Μενού</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <SheetClose asChild key={item.href}>
                <Link href={item.href} className={cn(MOBILE_LINK_CLASSNAME, active && MOBILE_LINK_ACTIVE_CLASSNAME)}>
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}

          {/* Inline collapsible, not a floating popover — the desktop
              dropdown's one sub-item (FAQ) becomes an indented child row
              instead, kept in the existing Accordion primitive already
              used elsewhere on the site (e.g. the FAQ page itself). */}
          <Accordion type="single" collapsible>
            <AccordionItem value="company" className="border-none">
              <AccordionTrigger
                className={cn(
                  "min-h-11 rounded-md px-3 py-0 text-base transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:text-[17px]",
                  faqActive ? "font-semibold text-primary-dark" : "text-ink",
                )}
              >
                Η Εταιρεία μας
              </AccordionTrigger>
              <AccordionContent className="pb-1 pl-3">
                <SheetClose asChild>
                  <Link href="/faq" className={cn(MOBILE_LINK_CLASSNAME, "pl-4", faqActive && MOBILE_LINK_ACTIVE_CLASSNAME)}>
                    FAQ
                  </Link>
                </SheetClose>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </nav>

        {/* Unauthenticated visitors have no "Σύνδεση" row here anymore —
            the Header's own external CTA (always visible now, even at
            320px) is the single sign-in access point, so this block only
            renders at all once there's real account navigation to show. */}
        {session?.user && (
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
            <SheetClose asChild>
              <Link href="/account" className={MOBILE_LINK_CLASSNAME}>
                <User className="h-4 w-4" /> Ο λογαριασμός μου
              </Link>
            </SheetClose>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className={cn(MOBILE_LINK_CLASSNAME, "text-left")}
            >
              <LogOut className="h-4 w-4" /> Αποσύνδεση
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
