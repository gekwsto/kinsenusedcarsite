"use client";

import * as React from "react";
import { CalendarDays, Gauge, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { VehicleCompareToggle } from "@/components/vehicles/vehicle-compare-toggle";
import { InterestModalTrigger } from "@/components/vehicles/interest-modal";
import { Button } from "@/components/ui/button";
import { KINSEN_CTA_BUTTON_CLASSNAME } from "@/components/ui/kinsen-cta-button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  SpecsExtrasSelector,
  SpecsGrid,
  ExtrasPanel,
  type VehicleSpecItem,
  type VehicleExtraItem,
} from "@/components/vehicles/vehicle-specs-tabs";
import { SegmentedGlider, useGliderRect } from "@/components/vehicles/segmented-glider";
import { cn, formatEuro, formatKm } from "@/lib/utils";
import type { VehicleComparisonSummary } from "@/lib/vehicle-comparison";

type PricingTab = "LEASING" | "PURCHASE";
type InfoTab = "specs" | "extras";

interface VehiclePricingSectionProps {
  vehicleId: string;
  vehicleSlug: string;
  vehicleLabel: string;
  maker: string;
  versionName: string;
  yearRelease: number | null;
  km: number | null;
  monthlyPrice: number | null;
  price: number | null;
  fuel: string | null;
  transmissionType: string | null;
  imageUrl: string | null;
  specs: VehicleSpecItem[];
  extras: VehicleExtraItem[];
}

// Leasing/Αγορά is a real tab now, not decoration: exactly one price card,
// one set of benefit bullets, and one CTA render at a time, driven by
// `activeTab`. Lives in one client component (rather than two, split across
// the left/right grid columns) because the tab buttons on the left and the
// price panel on the right must share that same state.
//
// The Χαρακτηριστικά/Έξτρα εξοπλισμός selector (`infoTab`) and its content
// panels live here too, for the same reason: the selector sits in the same
// action row as — and beside — the ONE interest CTA below, and that CTA's
// label/behavior is entirely driven by `activeTab`. Splitting the selector
// into its own component with its own independent CTA previously produced
// a second, redundant "Ενδιαφέρομαι για Leasing" button; keeping both
// pieces of state in this one component is what makes exactly one CTA
// possible.
export function VehiclePricingSection({
  vehicleId,
  vehicleSlug,
  vehicleLabel,
  maker,
  versionName,
  yearRelease,
  km,
  monthlyPrice,
  price,
  fuel,
  transmissionType,
  imageUrl,
  specs,
  extras,
}: VehiclePricingSectionProps) {
  const hasLeasing = monthlyPrice !== null;
  const hasPurchase = price !== null;
  const [activeTab, setActiveTab] = React.useState<PricingTab>(hasLeasing ? "LEASING" : "PURCHASE");
  const [infoTab, setInfoTab] = React.useState<InfoTab>("specs");

  // Same shared glider system as the Χαρακτηριστικά/Έξτρα εξοπλισμός
  // selector below (see segmented-glider.tsx) — only wired here when BOTH
  // options exist; with just one, there's nothing to slide between, so that
  // single button keeps its original always-active solid styling instead.
  const bothPricingOptionsAvailable = hasLeasing && hasPurchase;
  const pricingTrackRef = React.useRef<HTMLDivElement>(null);
  const leasingButtonRef = React.useRef<HTMLButtonElement>(null);
  const purchaseButtonRef = React.useRef<HTMLButtonElement>(null);
  const pricingGlider = useGliderRect(
    pricingTrackRef,
    activeTab === "LEASING" ? leasingButtonRef : purchaseButtonRef,
    activeTab,
  );

  const comparisonSummary: VehicleComparisonSummary = {
    id: vehicleId,
    slug: vehicleSlug,
    maker,
    versionName,
    yearRelease,
    price,
    monthlyPrice,
    km,
    imageUrl,
    fuel,
    transmissionType,
  };

  const showLeasing = activeTab === "LEASING" && hasLeasing;
  const showPurchase = activeTab === "PURCHASE" && hasPurchase;
  // Whichever offer is currently active also determines the ONE CTA's
  // label/interestType below — never a second, independent selection.
  const ctaAvailable = showLeasing || showPurchase;

  return (
    <Tabs value={infoTab} onValueChange={(value) => setInfoTab(value as InfoTab)}>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.25fr] lg:gap-10">
      {/* Left: tabs, title, meta */}
      <div>
        {/* Track background/border is a fixed neutral surface, not
            conditional on which option is active — a track that recolors
            in lockstep with the glider is exactly the kind of two-element
            transition sync that produced the reported seam artifact; a
            static track removes that failure mode entirely rather than
            trying to keep two independent transitions perfectly aligned. */}
        <div
          ref={pricingTrackRef}
          className="relative mb-4 grid w-full max-w-[320px] grid-cols-2 rounded-full border border-[#dfe8ed] bg-[#f7fafc] p-1"
        >
          {bothPricingOptionsAvailable && (
            <SegmentedGlider rect={pricingGlider} tone={activeTab === "LEASING" ? "a" : "b"} />
          )}
          {hasLeasing && (
            <button
              ref={leasingButtonRef}
              type="button"
              onClick={() => setActiveTab("LEASING")}
              aria-pressed={showLeasing}
              className={cn(
                "relative z-10 rounded-full py-2 text-center text-sm font-extrabold transition-colors duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                bothPricingOptionsAvailable
                  ? showLeasing
                    ? "text-white"
                    : "text-[#8a97a5] hover:bg-white/50 hover:text-detail-title"
                  : "bg-primary text-white shadow-soft",
              )}
            >
              Leasing
            </button>
          )}
          {hasPurchase && (
            <button
              ref={purchaseButtonRef}
              type="button"
              onClick={() => setActiveTab("PURCHASE")}
              aria-pressed={activeTab === "PURCHASE"}
              className={cn(
                "relative z-10 rounded-full py-2 text-center text-sm font-extrabold transition-colors duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                bothPricingOptionsAvailable
                  ? activeTab === "PURCHASE"
                    ? "text-white"
                    : "text-[#8a97a5] hover:bg-white/50 hover:text-detail-title"
                  : "bg-primary text-white shadow-soft",
              )}
            >
              Αγορά
            </button>
          )}
        </div>

        <div className="mb-3 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold leading-tight text-detail-title sm:text-3xl">{vehicleLabel}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <VehicleCompareToggle vehicle={comparisonSummary} showLabel />
            <FavoriteButton vehicleId={vehicleId} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-[#7b8794]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-primary" /> {yearRelease ?? "-"}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-primary" /> {km !== null ? formatKm(km) : "-"}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> Ελεγμένο
          </span>
        </div>
      </div>

      {/* Right: price card, benefits, CTA — exactly one tab's worth at a time */}
      <div>
        <div className="grid grid-cols-1 gap-3.5">
          {showLeasing && (
            <div className="min-h-[116px] rounded-xl border border-[#dfe8ed] bg-white p-5">
              <span className="mb-2 block font-extrabold text-primary">Leasing από</span>
              <div className="text-2xl font-black leading-none text-detail-title">
                {formatEuro(monthlyPrice)}
                <small className="text-sm font-extrabold text-[#52616f]"> /μήνα*</small>
              </div>
              <span className="mt-2 block font-bold text-[#52616f]">για 24 μήνες/20.000χλμ</span>
            </div>
          )}
          {showPurchase && (
            <div className="min-h-[116px] rounded-xl border border-[#dfe8ed] bg-white p-5">
              <span className="mb-2 block font-extrabold text-primary">Τιμή αγοράς</span>
              <div className="text-2xl font-black leading-none text-detail-title">{formatEuro(price)}</div>
              <span className="mt-2 block font-bold text-[#52616f]">με ΦΠΑ</span>
            </div>
          )}
        </div>

        <div className="my-4 flex flex-wrap gap-8 text-sm font-bold text-[#7b8794]">
          {showLeasing && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Χωρίς προκαταβολή
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Σταθερό μηνιαίο κόστος
              </span>
            </>
          )}
          {showPurchase && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Πλήρης κυριότητα οχήματος
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Χωρίς μηνιαίες δεσμεύσεις
              </span>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Full-width action row, a SIBLING of the two-column grid above (not
        nested inside its right column) — the Χαρακτηριστικά/Έξτρα
        εξοπλισμός selector occupies the left 50%, the ONE interest CTA the
        right 50%, via the same `grid-cols-2` the upper columns use for
        their own left/right split (just an even 1fr/1fr split here, not
        the upper section's 1fr/1.25fr — the two are independent grids that
        happen to sit in the same card, not one shared template). The
        selector does not stretch to fill its cell (`justify-self-start`);
        it stays its natural compact size, left-aligned, exactly like the
        "Leasing/Αγορά" pill above it. The CTA fills its cell, matching the
        existing full-width premium button language.

        This switches to 2 columns at `lg:` (1024px), not `sm:` (640px):
        a `minmax(0,1fr)` grid column (Tailwind's `grid-cols-2`) does not
        grow to protect a non-stretched child's content width — if the
        selector's natural (compact) width exceeds its 50% share, it
        visually overflows into the CTA's cell instead of the cell
        widening for it. Measured: the selector's natural content width is
        ~370px, so a cell needs the full row to be >~950px wide to fit it
        without a stretched CTA-column also cramping. Below `lg:`, the row
        stays a single column (selector, full width via its own internal
        breakpoint, then the CTA beneath it); `lg:`+ is comfortably above
        that threshold at every wider viewport (the card's max-width only
        grows from there). */}
    <div className="mt-5 grid grid-cols-1 gap-3 border-b border-[#e8eef2] pb-6 lg:grid-cols-2 lg:items-center lg:gap-6">
      <SpecsExtrasSelector activeTab={infoTab} className="justify-self-start" />
      {ctaAvailable && (
        // Same shared premium CTA system as the Login/Contact submit
        // buttons (Button variant="primary" + KINSEN_CTA_BUTTON_CLASSNAME,
        // see kinsen-cta-button.tsx) — `asChild` on the trigger composes its
        // click-to-open-modal behavior onto the Button's own rendered
        // element instead of duplicating a one-off filled button style.
        //
        // The trailing override below is a LOCAL, scoped color swap for
        // this ONE CTA — applied unconditionally to both its Leasing and
        // Αγορά states (same single button, only its label/interestType
        // changes) — it does not touch KINSEN_CTA_BUTTON_CLASSNAME itself,
        // so every other consumer of that shared class (Login, Contact,
        // the comparison launcher, etc.) stays the standard navy.
        <InterestModalTrigger interestType={activeTab} asChild>
          <Button
            variant="primary"
            className={cn(
              KINSEN_CTA_BUTTON_CLASSNAME,
              "h-12 w-full rounded-xl border-accent-dark bg-accent hover:bg-accent",
            )}
          >
            Ενδιαφέρομαι για {showLeasing ? "Leasing" : "Αγορά"} <ArrowRight className="h-4 w-4" />
          </Button>
        </InterestModalTrigger>
      )}
    </div>

    <div className="mt-6">
      <TabsContent value="specs">
        <SpecsGrid specs={specs} />
      </TabsContent>
      <TabsContent value="extras">
        <ExtrasPanel extras={extras} />
      </TabsContent>
    </div>
    </Tabs>
  );
}
