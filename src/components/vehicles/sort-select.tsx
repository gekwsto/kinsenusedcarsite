"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { buildQueryString } from "@/lib/query-params";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "price_asc", label: "Αύξουσα τιμή" },
  { value: "price_desc", label: "Φθίνουσα τιμή" },
];

export function SortSelect({ value, className }: { value: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (next: string) => {
    const qs = buildQueryString(searchParams, { sort: next }, { resetPage: true });
    router.push(`${pathname}?${qs}`, { scroll: false });
  };

  // Always pass a defined string (never undefined) so the Select stays
  // controlled across renders — flipping controlled/uncontrolled triggers a
  // React warning. "" simply matches no SelectItem, which shows the placeholder.
  const displayValue = value === "price_asc" || value === "price_desc" ? value : "";

  return (
    <Select value={displayValue} onValueChange={handleChange}>
      <SelectTrigger className={cn("w-full sm:w-64", className)}>
        <SelectValue placeholder="Ταξινόμηση" />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
