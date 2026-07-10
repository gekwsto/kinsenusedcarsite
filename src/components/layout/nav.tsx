"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/vehicles", label: "Οχήματα" },
  { href: "/financing", label: "Δανειοδότηση" },
  { href: "/warranty", label: "Εγγύηση" },
  { href: "/contact", label: "Επικοινωνία" },
];

export function Nav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-8", className)}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "border-b-2 border-transparent pb-1 text-sm font-semibold text-primary transition-colors hover:text-accent",
              active && "border-accent",
            )}
          >
            {item.label}
          </Link>
        );
      })}

      <div className="group relative">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 border-b-2 border-transparent pb-1 text-sm font-semibold text-primary transition-colors hover:text-accent",
            pathname?.startsWith("/faq") && "border-accent",
          )}
        >
          Η Εταιρεία μας
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <div className="invisible absolute left-0 top-full w-40 rounded-lg border border-border bg-white p-1.5 opacity-0 shadow-card transition-opacity group-hover:visible group-hover:opacity-100">
          <Link href="/faq" className="block rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-surface">
            FAQ
          </Link>
        </div>
      </div>
    </nav>
  );
}
