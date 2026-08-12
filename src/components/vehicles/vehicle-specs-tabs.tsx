"use client";

import * as React from "react";
import {
  ListChecks,
  Sparkles,
  BadgeCheck,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  Car,
  CarFront,
  Shapes,
  Fuel,
  Cog,
  Gauge,
  Zap,
  Box,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentedGlider, useGliderRect } from "@/components/vehicles/segmented-glider";
import { cn } from "@/lib/utils";

const EXTRAS_PAGE_SIZE = 6;

export type VehicleSpecKey = "maker" | "model" | "category" | "fuel" | "transmission" | "km" | "hp" | "cc" | "color";

// A component reference (LucideIcon) can never be passed as a prop from a
// Server Component to a Client Component — React can only serialize plain
// data across that boundary. So the server only sends a stable string
// `key`, and this map (living entirely on the client side) resolves it to
// the actual icon — the same icons page.tsx used to pick directly.
const SPEC_ICONS: Record<VehicleSpecKey, LucideIcon> = {
  maker: Car,
  model: CarFront,
  category: Shapes,
  fuel: Fuel,
  transmission: Cog,
  km: Gauge,
  hp: Zap,
  cc: Box,
  color: Palette,
};

export interface VehicleSpecItem {
  key: VehicleSpecKey;
  label: string;
  value: string;
}

export interface VehicleExtraItem {
  id: string;
  displayName: string;
}

export type SpecsExtrasTab = "specs" | "extras";

/**
 * Just the segmented "Χαρακτηριστικά / Έξτρα εξοπλισμός" selector control
 * (a `<TabsList>` + its two `<TabsTrigger>`s) — deliberately NOT bundled
 * with its own `<Tabs>` root, `<TabsContent>`, or CTA. It must sit in the
 * SAME action row as, and share one Leasing/Αγορά state with, the vehicle's
 * single interest CTA — both owned by VehiclePricingSection, which renders
 * the actual `<Tabs>` root wrapping this selector *and* the content panels
 * below (SpecsGrid/ExtrasPanel). This avoids a second, independent
 * pricing-mode state (and therefore a second CTA) ever existing.
 *
 * `activeTab` is threaded in (rather than read from Radix's own internal
 * context, which isn't part of its public API) purely to drive the glider
 * below — Radix itself still owns selection via the surrounding `<Tabs>`
 * root; this prop always mirrors that same state, one render behind at most.
 */
export function SpecsExtrasSelector({ activeTab, className }: { activeTab: SpecsExtrasTab; className?: string }) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const specsRef = React.useRef<HTMLButtonElement>(null);
  const extrasRef = React.useRef<HTMLButtonElement>(null);
  // They deliberately aren't equal width at `lg:`+ (a compact, content-sized
  // pill, like the "Leasing/Αγορά" switch above it) — the two Greek labels
  // are different lengths, so a hardcoded 50/50 split would either stretch
  // the control or leave the glider misaligned. `useGliderRect` measures the
  // active trigger's real box instead, so it always hugs it exactly, at any
  // width, without requiring any change to the existing trigger sizing.
  const glider = useGliderRect(listRef, activeTab === "specs" ? specsRef : extrasRef, activeTab);

  return (
    // "Χαρακτηριστικά"/"Έξτρα εξοπλισμός" are long enough Greek words that,
    // combined, they don't fit side by side at full icon+text size on a
    // ~320-375px phone — measured: the two labels alone need ~355px, well
    // past what a card with real padding leaves at that width. Below `sm:`,
    // the decorative icon is hidden and each trigger is an equal-width grid
    // column (no truncation, no horizontal scroll); from `sm:` up, both
    // labels+icons fit comfortably within the stacked, full-width row this
    // control occupies until `lg:`.
    //
    // The switch to a compact, content-sized (not stretched) pill —
    // `lg:w-auto`, left-aligned by the caller via `justify-self-start` on
    // its grid cell — happens at `lg:`, matching the action row's own
    // `lg:grid-cols-2` in VehiclePricingSection: below that width the row
    // is a single column (this control gets the full row to itself, so
    // `w-full` is safe), and only at `lg:`+ is the row split into two
    // side-by-side 50% cells wide enough that this control's natural
    // ~370px content width fits without spilling into the CTA's cell.
    //
    // `relative` turns this into the glider's offset parent (see the
    // `offsetLeft`/`offsetWidth` measurement above) and its positioning
    // context. The outer surface's own background/border tint shifts by a
    // hair depending on which option is active — felt more than seen.
    <TabsList
      ref={listRef}
      className={cn(
        "relative grid w-full grid-cols-2 transition-colors duration-300 ease-out motion-reduce:transition-none lg:inline-flex lg:w-auto",
        activeTab === "specs" ? "border-[#dfe8ed] bg-[#f7fafc]" : "border-[#cfe6ea] bg-[#f2f9fa]",
        className,
      )}
    >
      <SegmentedGlider rect={glider} tone={activeTab === "specs" ? "a" : "b"} sweepKey={activeTab} />

      <TabsTrigger
        ref={specsRef}
        value="specs"
        className="relative z-10 px-3 duration-200 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=inactive]:hover:bg-white/50 sm:px-4"
      >
        <ListChecks
          className={cn(
            "hidden h-4 w-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none sm:block",
            activeTab === "specs" && "scale-105",
          )}
          aria-hidden="true"
        />
        Χαρακτηριστικά
      </TabsTrigger>
      <TabsTrigger
        ref={extrasRef}
        value="extras"
        className="relative z-10 px-3 duration-200 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=inactive]:hover:bg-white/50 sm:px-4"
      >
        <Sparkles
          className={cn(
            "hidden h-4 w-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none sm:block",
            activeTab === "extras" && "scale-105",
          )}
          aria-hidden="true"
        />
        Έξτρα εξοπλισμός
      </TabsTrigger>
    </TabsList>
  );
}

export function SpecsGrid({ specs }: { specs: VehicleSpecItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
      {specs.map(({ key, label, value }) => {
        const Icon = SPEC_ICONS[key];
        return (
          <div key={key} className="flex items-center gap-3.5 border-b border-[#edf2f5] px-1 py-4 last:border-b-0">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#dfe8ed] bg-white text-detail">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <small className="block font-bold text-[#8a97a5]">{label}</small>
              <strong className="block font-black text-detail-title">{value}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExtrasPanel({ extras }: { extras: VehicleExtraItem[] }) {
  const [page, setPage] = React.useState(1);

  const totalPages = Math.max(1, Math.ceil(extras.length / EXTRAS_PAGE_SIZE));
  // Clamped at render time (never via an effect): if `extras` ever shrinks
  // out from under a stale `page`, this self-heals on the very next render
  // instead of needing a useEffect to "catch" the out-of-range value.
  const safePage = Math.min(page, totalPages);
  const showPagination = extras.length > EXTRAS_PAGE_SIZE;
  const pageItems = extras.slice((safePage - 1) * EXTRAS_PAGE_SIZE, safePage * EXTRAS_PAGE_SIZE);

  if (extras.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#dfe8ed] bg-[#fafcfd] px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dfe8ed] bg-white text-[#8a97a5]">
          <PackageOpen className="h-5 w-5" />
        </span>
        <p className="font-bold text-detail-title">Δεν έχει δηλωθεί έξτρα εξοπλισμός για το συγκεκριμένο όχημα.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {pageItems.map((extra) => (
          <div
            key={extra.id}
            className="flex items-center gap-3 rounded-lg border border-[#dfe8ed] bg-white px-4 py-3 min-w-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-detail/25 bg-detail/5 text-detail">
              <BadgeCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0 break-words text-sm font-bold text-detail-title">{extra.displayName}</span>
          </div>
        ))}
      </div>

      {/* Page-switching is not preserved-vs-reset per spec ambiguity, so we
          document the choice: the page number is plain local state and is
          NOT reset when navigating away to "Χαρακτηριστικά" and back — the
          simpler behavior (no extra state-reset logic needed), and arguably
          the more useful one (returning to where you left off). */}
      {showPagination && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-[#8a97a5]">
            Σελίδα {safePage} από {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <PaginationButton
              direction="prev"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            />
            <PaginationButton
              direction="next"
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Προηγούμενη σελίδα" : "Επόμενη σελίδα"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md border border-[#dfe8ed] bg-white text-detail-title transition-colors duration-150 ease-out motion-reduce:transition-none",
        "hover:border-detail/40 hover:bg-detail/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#dfe8ed] disabled:hover:bg-white",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
