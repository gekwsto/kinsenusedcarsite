"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildQueryString, buildHref } from "@/lib/query-params";
import { useVehicleResultsScroll } from "@/lib/vehicle-results-scroll";

interface PaginationProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}

// Shares the same canonical builder as the filter sidebar and sort select
// (rather than an ad hoc URLSearchParams pass here) so a page link and a
// filter-driven link for the same logical state always produce byte-identical
// query strings.
function hrefFor(searchParams: PaginationProps["searchParams"], page: number) {
  const current = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => current.append(key, v));
    else current.set(key, value);
  }
  const qs = buildQueryString(current, { page: page > 1 ? page : undefined }, { resetPage: false });
  return buildHref("/vehicles", qs);
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
  // Explicit pagination intent only — requestScroll fires exclusively from a
  // click on one of the three controls below, routed through the same
  // authoritative results-scroll coordinator the filter sidebar and sort
  // select use, never from a generic searchParams-watching effect (which
  // would also fire for unrelated changes).
  const requestScroll = useVehicleResultsScroll();

  if (totalPages <= 1) return null;

  const pages = getPageList(page, totalPages);

  return (
    <nav aria-label="Σελιδοποίηση" className="mt-10 flex items-center justify-center gap-1.5">
      <Link
        intent="url-state-sync"
        href={hrefFor(searchParams, Math.max(1, page - 1))}
        aria-disabled={page === 1}
        onClick={() => {
          if (page !== 1) requestScroll();
        }}
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
            intent="url-state-sync"
            href={hrefFor(searchParams, p)}
            aria-current={p === page ? "page" : undefined}
            onClick={() => {
              if (p !== page) requestScroll();
            }}
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
        intent="url-state-sync"
        href={hrefFor(searchParams, Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        onClick={() => {
          if (page !== totalPages) requestScroll();
        }}
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
