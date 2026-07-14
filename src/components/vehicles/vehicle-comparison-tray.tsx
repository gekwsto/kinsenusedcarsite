"use client";

import * as React from "react";
import Image from "next/image";
import { X, Scale } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useVehicleComparison } from "@/components/providers/vehicle-comparison-provider";
import { useCookieConsent } from "@/components/providers/cookie-consent-provider";
import { formatEuro, formatKm, FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";
import type { VehicleComparisonSummary } from "@/lib/vehicle-comparison";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function useIsDesktopViewport(): boolean {
  // This hook is called unconditionally on every render of
  // VehicleComparisonTray, including the server-side render pass — a
  // `return null` later in that component does NOT stop its hooks from
  // running first, so the initializer itself must survive SSR (no
  // `window` global there) even though the component's rendered *output*
  // is always null until hydration resolves. `typeof window` is the safe
  // check; the real value is corrected by the effect below immediately
  // after mount, before this ever produces visible output (VehicleComparisonTray
  // still renders null on the client's first pass too, since `isHydrated`
  // itself starts false — so this never causes a hydration mismatch).
  const [isDesktop, setIsDesktop] = React.useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_MEDIA_QUERY).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleChange = () => setIsDesktop(mql.matches);
    handleChange();
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

function progressCopy(count: number): string {
  if (count === 1) return "Προσθέστε ακόμη 2 αυτοκίνητα για σύγκριση.";
  if (count === 2) return "Προσθέστε ακόμη 1 αυτοκίνητο για σύγκριση.";
  if (count === 3) return "Τα αυτοκίνητα είναι έτοιμα για σύγκριση.";
  return "Προσθέστε αυτοκίνητα για να ξεκινήσετε τη σύγκριση.";
}

function ComparisonSlot({ index, vehicle, onRemove }: { index: number; vehicle: VehicleComparisonSummary | undefined; onRemove: (id: string) => void }) {
  if (!vehicle) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface/60 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-white text-xs font-semibold text-ink-muted">
          {index + 1}
        </div>
        <p className="text-sm text-ink-muted">Προσθέστε ακόμη ένα αυτοκίνητο</p>
      </div>
    );
  }

  const title = `${vehicle.maker} ${vehicle.versionName}`;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 shadow-soft">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface">
        <Image src={vehicle.imageUrl ?? FALLBACK_VEHICLE_IMAGE} alt={title} fill sizes="56px" className="object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/vehicles/${vehicle.slug}`} className="block truncate text-sm font-semibold text-ink hover:text-primary">
          {title}
        </Link>
        <p className="truncate text-xs text-ink-muted">
          {[vehicle.yearRelease ?? null, vehicle.km !== null ? formatKm(vehicle.km) : null].filter(Boolean).join(" · ") || "—"}
        </p>
        <p className="text-sm font-bold text-ink">
          {vehicle.monthlyPrice ? `Από ${formatEuro(vehicle.monthlyPrice)}` : vehicle.price ? formatEuro(vehicle.price) : "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(vehicle.id)}
        aria-label={`Αφαίρεση ${title} από τη σύγκριση`}
        className="shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function PanelBody({ titleId }: { titleId: string }) {
  const { selectedVehicles, selectedCount, maxVehicles, removeVehicle, clearVehicles, canCompare, comparisonUrl } = useVehicleComparison();
  const slots = Array.from({ length: maxVehicles }, (_, index) => selectedVehicles[index]);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-lg font-bold text-primary">
            Σύγκριση οχημάτων
          </h2>
          <p className="text-sm font-semibold text-ink-muted">
            {selectedCount}/{maxVehicles} επιλεγμένα
          </p>
        </div>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={clearVehicles}
            className="shrink-0 text-sm font-semibold text-ink-muted underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Εκκαθάριση όλων
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {slots.map((vehicle, index) => (
          <ComparisonSlot key={vehicle?.id ?? `empty-${index}`} index={index} vehicle={vehicle} onRemove={removeVehicle} />
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-3 text-sm text-ink-muted">{progressCopy(selectedCount)}</p>
        {canCompare && comparisonUrl ? (
          <Button asChild variant="primary" className="w-full">
            <Link href={comparisonUrl}>Δείτε τη σύγκριση</Link>
          </Button>
        ) : (
          <Button type="button" variant="primary" className="w-full" disabled aria-disabled="true">
            Δείτε τη σύγκριση
          </Button>
        )}
      </div>
    </>
  );
}

// The cookie banner's real rendered height varies a lot with viewport
// width (its Greek copy wraps to 2-3 lines on narrow phones — measured up
// to ~380px tall at 390px width) — a guessed fixed pixel offset undershot
// this badly and let the collapsed control sit underneath the banner.
// Measuring the actual element is the only reliable way to always clear
// it — but a one-time measurement on mount plus a `resize` listener still
// missed one real case (proven by a captured Firefox E2E failure
// screenshot): if the banner's own web font hasn't finished loading yet
// at the moment of that first measurement, its Greek text can wrap to
// fewer lines under the fallback font than it does once Manrope swaps in,
// so the initial height is measured too short and never re-measured
// (font swap fires no `resize` event). A ResizeObserver on the banner
// element itself re-measures on *any* height change — font swap, text
// reflow, viewport change, or its own entrance transition completing —
// without needing to enumerate every possible cause individually.
function useCookieBannerClearance(bannerVisible: boolean): number {
  const [clearance, setClearance] = React.useState(16);

  React.useEffect(() => {
    if (!bannerVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClearance(16);
      return;
    }

    const banner = document.querySelector('[role="region"][aria-label="Ειδοποίηση για cookies"]');
    if (!banner) return;

    const measure = () => setClearance(banner.getBoundingClientRect().height + 16);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => observer.disconnect();
  }, [bannerVisible]);

  return clearance;
}

function CollapsedControl() {
  const { selectedCount, isSidebarOpen, openSidebar, maxVehicles } = useVehicleComparison();
  const { bannerVisible } = useCookieConsent();
  const clearance = useCookieBannerClearance(bannerVisible);

  if (isSidebarOpen || selectedCount === 0) return null;

  return (
    <button
      type="button"
      onClick={(event) => openSidebar(event.currentTarget)}
      aria-label={`Άνοιγμα σύγκρισης οχημάτων, ${selectedCount} από ${maxVehicles} επιλεγμένα`}
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${clearance}px)` }}
      className="fixed z-[45] inline-flex items-center gap-2 rounded-full border border-border bg-primary px-4 py-3 text-sm font-semibold text-white shadow-card transition-[bottom] duration-200 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0"
    >
      <Scale className="h-4 w-4" />
      Σύγκριση οχημάτων · {selectedCount}/{maxVehicles}
    </button>
  );
}

function DesktopPanel() {
  const { isSidebarOpen, closeSidebar, lastTriggerRef } = useVehicleComparison();
  const shouldReduceMotion = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();
  const wasOpenRef = React.useRef(false);

  // Non-modal panel — no focus trap, page stays interactive — but Escape
  // still collapses it for keyboard users, and focus is deliberately
  // restored to the exact opener on close (never document.activeElement,
  // for the same proven cross-browser reason as CookieConsentProvider).
  React.useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen, closeSidebar]);

  React.useEffect(() => {
    if (isSidebarOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      lastTriggerRef.current?.focus();
    }
  }, [isSidebarOpen, lastTriggerRef]);

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <motion.aside
          ref={panelRef}
          role="complementary"
          aria-labelledby={titleId}
          initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-y-0 right-0 z-[45] hidden w-full max-w-[420px] flex-col overflow-y-auto border-l border-border bg-white p-6 shadow-card lg:flex"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSidebar}
            aria-label="Κλείσιμο σύγκρισης"
            className="absolute right-4 top-4 rounded-md p-1.5 text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="h-4 w-4" />
          </button>
          <PanelBody titleId={titleId} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function MobileSheetPanel() {
  const { isSidebarOpen, closeSidebar, lastTriggerRef } = useVehicleComparison();
  const titleId = React.useId();

  return (
    <Sheet open={isSidebarOpen} onOpenChange={(next) => !next && closeSidebar()}>
      <SheetContent
        side="bottom"
        aria-labelledby={titleId}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          lastTriggerRef.current?.focus();
        }}
        className="pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <PanelBody titleId={titleId} />
      </SheetContent>
    </Sheet>
  );
}

export function VehicleComparisonTray() {
  const { isHydrated } = useVehicleComparison();
  const isDesktop = useIsDesktopViewport();

  // Nothing about this tray is ever meaningful before hydration resolves
  // (selection is always empty pre-hydration, matching SSR) — rendering
  // null until then keeps the client's first paint identical to the SSR
  // markup, so there is no hydration mismatch. (useIsDesktopViewport's own
  // useState initializer still runs during SSR regardless of this early
  // return — hook calls always run before a component's return statement
  // is reached — which is exactly why that hook guards its `window` read
  // with `typeof window !== "undefined"` rather than relying on this gate.)
  if (!isHydrated) return null;

  return (
    <>
      {isDesktop ? <DesktopPanel /> : <MobileSheetPanel />}
      <CollapsedControl />
    </>
  );
}
