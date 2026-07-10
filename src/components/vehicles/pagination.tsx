import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}

function hrefFor(searchParams: PaginationProps["searchParams"], page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || key === "page") continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/vehicles?${qs}` : "/vehicles";
}

function getPageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({ page, totalPages, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageList(page, totalPages);

  return (
    <nav aria-label="Σελιδοποίηση" className="mt-10 flex items-center justify-center gap-1.5">
      <Link
        href={hrefFor(searchParams, Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-ink hover:bg-surface",
          page === 1 && "pointer-events-none opacity-40",
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      {pages.map((p, index) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-ink-muted">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(searchParams, p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium",
              p === page
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-ink hover:bg-surface",
            )}
          >
            {p}
          </Link>
        ),
      )}

      <Link
        href={hrefFor(searchParams, Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-ink hover:bg-surface",
          page === totalPages && "pointer-events-none opacity-40",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
