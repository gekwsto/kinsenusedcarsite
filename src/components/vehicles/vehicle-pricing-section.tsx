"use client";

import * as React from "react";
import { CalendarDays, Gauge, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { VehicleCompareToggle } from "@/components/vehicles/vehicle-compare-toggle";
import { InterestModalTrigger } from "@/components/vehicles/interest-modal";
import { cn, formatEuro, formatKm } from "@/lib/utils";
import type { VehicleComparisonSummary } from "@/lib/vehicle-comparison";

type PricingTab = "LEASING" | "PURCHASE";

const CTA_CLASSNAME =
  "flex w-full items-center justify-center gap-3 rounded-lg border border-detail bg-detail px-4 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-[#004c74]";

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
}

// Leasing/Αγορά is a real tab now, not decoration: exactly one price card,
// one set of benefit bullets, and one CTA render at a time, driven by
// `activeTab`. Lives in one client component (rather than two, split across
// the left/right grid columns) because the tab buttons on the left and the
// price panel on the right must share that same state.
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
}: VehiclePricingSectionProps) {
  const hasLeasing = monthlyPrice !== null;
  const hasPurchase = price !== null;
  const [activeTab, setActiveTab] = React.useState<PricingTab>(hasLeasing ? "LEASING" : "PURCHASE");

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

  return (
    <div className="grid grid-cols-1 gap-6 border-b border-[#e8eef2] pb-6 lg:grid-cols-[1fr_1.25fr] lg:gap-10">
      {/* Left: tabs, title, meta */}
      <div>
        <div className="mb-4 grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-full border border-[#dfe8ed] bg-[#f7fafc] p-1">
          {hasLeasing && (
            <button
              type="button"
              onClick={() => setActiveTab("LEASING")}
              aria-pressed={showLeasing}
              className={cn(
                "rounded-full py-2 text-center text-sm font-extrabold transition-colors",
                showLeasing
                  ? "bg-detail text-white shadow-[0_8px_18px_rgba(0,137,154,0.22)]"
                  : "text-[#8a97a5] hover:text-detail-title",
              )}
            >
              Leasing
            </button>
          )}
          {hasPurchase && (
            <button
              type="button"
              onClick={() => setActiveTab("PURCHASE")}
              aria-pressed={activeTab === "PURCHASE"}
              className={cn(
                "rounded-full py-2 text-center text-sm font-extrabold transition-colors",
                activeTab === "PURCHASE"
                  ? "bg-detail text-white shadow-[0_8px_18px_rgba(0,137,154,0.22)]"
                  : "text-[#8a97a5] hover:text-detail-title",
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
            <CalendarDays className="h-4 w-4 text-detail" /> {yearRelease ?? "-"}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-detail" /> {km !== null ? formatKm(km) : "-"}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-detail" /> Ελεγμένο
          </span>
        </div>
      </div>

      {/* Right: price card, benefits, CTA — exactly one tab's worth at a time */}
      <div>
        <div className="grid grid-cols-1 gap-3.5">
          {showLeasing && (
            <div className="min-h-[116px] rounded-xl border border-[#dfe8ed] bg-white p-5">
              <span className="mb-2 block font-extrabold text-detail">Leasing από</span>
              <div className="text-2xl font-black leading-none text-detail-title">
                {formatEuro(monthlyPrice)}
                <small className="text-sm font-extrabold text-[#52616f]"> /μήνα*</small>
              </div>
              <span className="mt-2 block font-bold text-[#52616f]">για 24 μήνες/20.000χλμ</span>
            </div>
          )}
          {showPurchase && (
            <div className="min-h-[116px] rounded-xl border border-[#dfe8ed] bg-white p-5">
              <span className="mb-2 block font-extrabold text-detail">Τιμή αγοράς</span>
              <div className="text-2xl font-black leading-none text-detail-title">{formatEuro(price)}</div>
              <span className="mt-2 block font-bold text-[#52616f]">με ΦΠΑ</span>
            </div>
          )}
        </div>

        <div className="my-4 flex flex-wrap gap-8 text-sm font-bold text-[#7b8794]">
          {showLeasing && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-detail" /> Χωρίς προκαταβολή
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-detail" /> Σταθερό μηνιαίο κόστος
              </span>
            </>
          )}
          {showPurchase && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-detail" /> Πλήρης κυριότητα οχήματος
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-detail" /> Χωρίς μηνιαίες δεσμεύσεις
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {showLeasing && (
            <InterestModalTrigger interestType="LEASING" className={CTA_CLASSNAME}>
              Ενδιαφέρομαι για Leasing <ArrowRight className="h-4 w-4" />
            </InterestModalTrigger>
          )}
          {showPurchase && (
            <InterestModalTrigger interestType="PURCHASE" className={CTA_CLASSNAME}>
              Ενδιαφέρομαι για Αγορά <ArrowRight className="h-4 w-4" />
            </InterestModalTrigger>
          )}
        </div>
      </div>
    </div>
  );
}
