"use client";

import * as React from "react";
import { toast } from "@/components/ui/use-toast";
import {
  MAX_COMPARISON_VEHICLES,
  VEHICLE_COMPARISON_STORAGE_KEY,
  addComparisonId,
  areComparisonIdListsEqual,
  buildComparisonUrl,
  createEmptyComparisonState,
  parseComparisonState,
  removeComparisonId,
  serializeComparisonState,
  toggleComparisonId,
  type ComparisonActionResult,
  type VehicleComparisonSummary,
} from "@/lib/vehicle-comparison";

interface VehicleComparisonContextValue {
  selectedVehicleIds: readonly string[];
  selectedVehicles: readonly VehicleComparisonSummary[];
  selectedCount: number;
  maxVehicles: typeof MAX_COMPARISON_VEHICLES;
  isHydrated: boolean;
  isSidebarOpen: boolean;
  isSelected: (vehicleId: string) => boolean;
  canAddVehicle: (vehicleId: string) => boolean;
  /**
   * `opener` should be the exact element the caller's click/keydown handler
   * fired on (`event.currentTarget`) — never inferred from
   * `document.activeElement` inside the handler. Same proven cross-browser
   * reason as CookieConsentProvider's `lastTriggerRef`: WebKit's `.click()`
   * blurs an already-focused `<button>` before the handler runs, so
   * `document.activeElement` is unreliable there specifically. Used so the
   * sidebar/sheet this opens can restore focus to the exact card/detail
   * button that triggered it, regardless of which surface it was clicked
   * from.
   */
  addVehicle: (vehicle: VehicleComparisonSummary, opener?: HTMLElement | null) => ComparisonActionResult;
  removeVehicle: (vehicleId: string) => void;
  toggleVehicle: (vehicle: VehicleComparisonSummary, opener?: HTMLElement | null) => ComparisonActionResult;
  clearVehicles: () => void;
  openSidebar: (opener?: HTMLElement | null) => void;
  closeSidebar: () => void;
  toggleSidebar: (opener?: HTMLElement | null) => void;
  canCompare: boolean;
  comparisonUrl: string | null;
  /** The element focus should return to when the sidebar/sheet closes. */
  lastTriggerRef: React.RefObject<HTMLElement | null>;
  /** Synchronizes provider state to a validated, complete `/compare` URL ID list — see the module doc below for the precedence rule. */
  syncSelectionFromUrl: (ids: readonly string[]) => void;
}

const VehicleComparisonContext = React.createContext<VehicleComparisonContextValue | null>(null);

const MAX_REACHED_MESSAGE = "Μπορείτε να συγκρίνετε έως 3 αυτοκίνητα. Αφαιρέστε ένα όχημα για να προσθέσετε κάποιο άλλο.";
const VEHICLE_UNAVAILABLE_MESSAGE = "Ένα από τα επιλεγμένα αυτοκίνητα δεν είναι πλέον διαθέσιμο και αφαιρέθηκε από τη σύγκριση.";

/**
 * State-precedence rule between ordinary pages and `/compare` (task
 * requirement, documented once here rather than scattered across call
 * sites): on every ordinary page, this provider + its localStorage
 * persistence is the source of truth for the selected IDs. On `/compare`,
 * the validated query-string ID list is the source of truth for *what the
 * page renders*, and `syncSelectionFromUrl` additionally replaces the
 * provider's own selection with it — but only when the URL supplies an
 * exactly-MAX_COMPARISON_VEHICLES, de-duplicated ID list (syntactic
 * validity only; the page itself separately handles the case where the
 * database can't resolve one of those IDs to a real, public vehicle). An
 * incomplete or malformed URL never overwrites a valid, already-persisted
 * selection — a mistyped/truncated shared link should never wipe out a
 * visitor's own in-progress comparison.
 */
export function VehicleComparisonProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = React.useState<readonly string[]>([]);
  const [summaryCache, setSummaryCache] = React.useState<Readonly<Record<string, VehicleComparisonSummary>>>({});
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const lastTriggerRef = React.useRef<HTMLElement | null>(null);

  // Client-only localStorage read — see cookie-consent-provider.tsx for the
  // identical reasoning (no `window`/`localStorage` during SSR, and
  // reading it during render risks a hydration mismatch). Nothing renders
  // a user-specific "selected" state before this resolves; see isHydrated
  // usage in the compare-toggle button.
  React.useEffect(() => {
    let stored: ReturnType<typeof parseComparisonState> = null;
    try {
      stored = parseComparisonState(window.localStorage.getItem(VEHICLE_COMPARISON_STORAGE_KEY));
    } catch {
      stored = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(stored?.ids ?? []);
    setIsHydrated(true);
  }, []);

  // Persists on every real change, skipped until hydration has resolved so
  // the pre-hydration empty state never clobbers real storage before it's
  // been read.
  React.useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(
        VEHICLE_COMPARISON_STORAGE_KEY,
        serializeComparisonState({ version: 1, ids, updatedAt: new Date().toISOString() }),
      );
    } catch {
      // Storage may be unavailable (private browsing, quota) — the
      // in-memory selection still works for the rest of this page view.
    }
  }, [ids, isHydrated]);

  // Batches one fetch for every currently-selected ID that doesn't yet
  // have a cached summary (e.g. right after hydration reads IDs-only
  // storage, or right after syncSelectionFromUrl adopts a shared URL's
  // IDs). Also reconciles stale/unavailable IDs: if the batch endpoint
  // returns fewer vehicles than requested, those missing IDs are pruned
  // from the active selection and the visitor is told why.
  // Mirrors summaryCache into a ref purely so the fetch effect below can
  // read the *latest* cache without listing it as a dependency (which
  // would re-trigger the effect the moment that same effect's own fetch
  // resolves and writes to it) — never written to from inside an effect
  // body itself, only read, so it never causes the "setState used just to
  // peek at current state" anti-pattern the effect below used to have.
  const summaryCacheRef = React.useRef(summaryCache);
  React.useEffect(() => {
    summaryCacheRef.current = summaryCache;
  }, [summaryCache]);

  const idsKey = ids.join(",");
  React.useEffect(() => {
    if (!isHydrated || ids.length === 0) return;

    const missing = ids.filter((id) => !(id in summaryCacheRef.current));
    if (missing.length === 0) return;

    let cancelled = false;
    fetch(`/api/vehicles/compare?ids=${missing.map(encodeURIComponent).join(",")}`)
      .then((res) => (res.ok ? res.json() : { vehicles: [] }))
      .then((data: { vehicles: VehicleComparisonSummary[] }) => {
        if (cancelled) return;
        const resolvedIds = new Set(data.vehicles.map((v) => v.id));
        const unavailable = missing.filter((id) => !resolvedIds.has(id));

        if (data.vehicles.length > 0) {
          setSummaryCache((prev) => {
            const next = { ...prev };
            for (const vehicle of data.vehicles) next[vehicle.id] = vehicle;
            return next;
          });
        }

        if (unavailable.length > 0) {
          setIds((prevIds) => prevIds.filter((id) => !unavailable.includes(id)));
          toast({ title: VEHICLE_UNAVAILABLE_MESSAGE, variant: "destructive" });
        }
      })
      .catch(() => {
        // Network failure: the affected slot(s) simply stay unresolved
        // (rendered as an empty/loading slot) until the next change to
        // `ids` re-triggers this effect — no crash, no silent data loss.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, isHydrated]);

  const isSelected = React.useCallback((vehicleId: string) => ids.includes(vehicleId), [ids]);

  const canAddVehicle = React.useCallback(
    (vehicleId: string) => !ids.includes(vehicleId) && ids.length < MAX_COMPARISON_VEHICLES,
    [ids],
  );

  const openSidebar = React.useCallback((opener?: HTMLElement | null) => {
    lastTriggerRef.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = React.useCallback(() => setIsSidebarOpen(false), []);

  const toggleSidebar = React.useCallback(
    (opener?: HTMLElement | null) => {
      setIsSidebarOpen((open) => {
        if (!open) {
          lastTriggerRef.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        }
        return !open;
      });
    },
    [],
  );

  const addVehicle = React.useCallback(
    (vehicle: VehicleComparisonSummary, opener?: HTMLElement | null): ComparisonActionResult => {
      const { ids: nextIds, result } = addComparisonId(ids, vehicle.id);

      if (result === "added") {
        setIds(nextIds);
        setSummaryCache((prev) => ({ ...prev, [vehicle.id]: vehicle }));
        openSidebar(opener);
      } else if (result === "max-reached") {
        openSidebar(opener);
        toast({ title: MAX_REACHED_MESSAGE, variant: "destructive" });
      }

      return result;
    },
    [ids, openSidebar],
  );

  const removeVehicle = React.useCallback((vehicleId: string) => {
    setIds((current) => removeComparisonId(current, vehicleId));
  }, []);

  const toggleVehicle = React.useCallback(
    (vehicle: VehicleComparisonSummary, opener?: HTMLElement | null): ComparisonActionResult => {
      if (isSelected(vehicle.id)) {
        removeVehicle(vehicle.id);
        return "removed";
      }
      return addVehicle(vehicle, opener);
    },
    [isSelected, removeVehicle, addVehicle],
  );

  const clearVehicles = React.useCallback(() => {
    setIds([]);
    setIsSidebarOpen(false);
  }, []);

  const syncSelectionFromUrl = React.useCallback(
    (urlIds: readonly string[]) => {
      if (urlIds.length !== MAX_COMPARISON_VEHICLES) return;
      if (new Set(urlIds).size !== urlIds.length) return;
      if (areComparisonIdListsEqual(urlIds, ids)) return;
      setIds(urlIds);
    },
    [ids],
  );

  const selectedVehicles = React.useMemo(
    () => ids.map((id) => summaryCache[id]).filter((v): v is VehicleComparisonSummary => v !== undefined),
    [ids, summaryCache],
  );

  const canCompare = ids.length === MAX_COMPARISON_VEHICLES;
  const comparisonUrl = React.useMemo(() => buildComparisonUrl(ids), [ids]);

  const value = React.useMemo<VehicleComparisonContextValue>(
    () => ({
      selectedVehicleIds: ids,
      selectedVehicles,
      selectedCount: ids.length,
      maxVehicles: MAX_COMPARISON_VEHICLES,
      isHydrated,
      isSidebarOpen,
      isSelected,
      canAddVehicle,
      addVehicle,
      removeVehicle,
      toggleVehicle,
      clearVehicles,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      canCompare,
      comparisonUrl,
      lastTriggerRef,
      syncSelectionFromUrl,
    }),
    [
      ids,
      selectedVehicles,
      isHydrated,
      isSidebarOpen,
      isSelected,
      canAddVehicle,
      addVehicle,
      removeVehicle,
      toggleVehicle,
      clearVehicles,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      canCompare,
      comparisonUrl,
      syncSelectionFromUrl,
    ],
  );

  return <VehicleComparisonContext.Provider value={value}>{children}</VehicleComparisonContext.Provider>;
}

export function useVehicleComparison() {
  const ctx = React.useContext(VehicleComparisonContext);
  if (!ctx) throw new Error("useVehicleComparison must be used within a VehicleComparisonProvider");
  return ctx;
}
