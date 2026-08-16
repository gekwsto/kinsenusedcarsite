"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NavDropdown } from "@/components/layout/nav-dropdown";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/vehicles", label: "Οχήματα" },
  { href: "/financing", label: "Δανειοδότηση" },
  { href: "/warranty", label: "Εγγύηση" },
  { href: "/contact", label: "Επικοινωνία" },
];

// Shared by every plain nav link AND the "Η Εταιρεία μας" dropdown
// trigger, so both read as one consistent link system. Text grows in two
// small steps (15px → 16px → 17px) rather than jumping straight to a
// large size, matching the conceptual "small/normal/large desktop" scale
// requested — `lg` (1024px, where this nav first becomes visible) stays
// compact, `xl` (1280px) nudges up, `2xl` (1536px) reaches the ceiling.
export const NAV_LINK_CLASSNAME =
  "rounded-md px-3 py-2 text-[15px] font-medium text-primary transition-colors duration-150 hover:bg-primary/5 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 xl:text-base 2xl:text-[17px]";
// No underline — active state is communicated by weight + a barely-there
// navy tint instead, so it still reads as navigation, not a button.
export const NAV_LINK_ACTIVE_CLASSNAME = "bg-primary/5 font-semibold text-primary-dark";

// `w-full` fills the panel's entire inner width (the panel itself has no
// padding — see panelClassName below) so each row reads as a proper
// edge-to-edge menu item, not text floating in a padded gutter.
// `rounded-none` — the outer panel (see panelClassName below) now owns the
// corner geometry via its own `rounded-md` + `overflow-hidden`, so this
// full-width row doesn't need (and must not have) its own radius, or it'd
// read as a separate inset mini-card again. `ring-inset` keeps the
// keyboard-focus ring drawn inside the row instead of getting clipped away
// by that same overflow-hidden.
const DROPDOWN_ITEM_CLASSNAME =
  "block w-full rounded-none px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50";

export function Nav({ className }: { className?: string }) {
  const pathname = usePathname();
  const companyActive = pathname?.startsWith("/faq") ?? false;

  return (
    <nav className={cn("flex items-center gap-1 xl:gap-2 2xl:gap-3", className)}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={cn(NAV_LINK_CLASSNAME, active && NAV_LINK_ACTIVE_CLASSNAME)}>
            {item.label}
          </Link>
        );
      })}

      <NavDropdown
        align="left"
        openOn="hover"
        // Scoped to just this dropdown (not the shared account menu in
        // header.tsx). The base panel already supplies the right gap
        // (`mt-1.5`, 6px), full border, and shadow — a proper floating
        // card, deliberately NOT fused to the trigger. `w-44` sizes it for
        // the real items. `rounded-md` matches the same restrained radius
        // the plain nav links use, instead of the base panel's rounder
        // `rounded-lg`. `p-0` removes the base panel's own gutter padding
        // (`p-1.5`) so each item row can span the full inner width
        // edge-to-edge rather than sitting in an inset mini-card —
        // `overflow-hidden` then lets the outer `rounded-md` cleanly clip
        // each row's hover background at the panel's own corners.
        panelClassName="w-44 rounded-md p-0 overflow-hidden"
        // The trigger stays a completely normal nav item at every state —
        // open communicates itself only through the chevron rotation (see
        // `trigger` below) and NAV_LINK_ACTIVE_CLASSNAME while the route
        // is actually active, never through a background/shape change
        // tied to `open`, so it never reads as "part of" the dropdown.
        triggerClassName={cn(
          NAV_LINK_CLASSNAME,
          "inline-flex items-center gap-1",
          companyActive && NAV_LINK_ACTIVE_CLASSNAME,
        )}
        trigger={({ open }) => (
          <>
            Η Εταιρεία μας
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
          </>
        )}
      >
        <Link href="/faq" className={DROPDOWN_ITEM_CLASSNAME}>
          FAQ
        </Link>
      </NavDropdown>
    </nav>
  );
}
