"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { buildQueryString, buildHref } from "@/lib/query-params";
import { useNavigationTransition } from "@/components/providers/navigation-transition-provider";
import { useVehicleResultsScroll } from "@/lib/vehicle-results-scroll";
import { formatEuro } from "@/lib/utils";

export const NUMERIC_FIELDS = [
  "priceMin",
  "priceMax",
  "monthlyPriceMin",
  "monthlyPriceMax",
  "yearMin",
  "yearMax",
  "kmMin",
  "kmMax",
  "ccMin",
  "ccMax",
  "hpMin",
  "hpMax",
] as const;
export type NumericField = (typeof NUMERIC_FIELDS)[number];

// Multi-select checkbox groups. Unlike the numeric range inputs, these are
// discrete clicks — they must apply immediately, never debounced.
export const CSV_FIELDS = ["maker", "fuel", "transmissionType", "color", "typeOfCar"] as const;
export type CsvField = (typeof CSV_FIELDS)[number];

// One canonical draft covers *every* filter field the sidebar owns.
export interface FilterDraft extends Record<NumericField, string>, Record<CsvField, string> {
  offerOnly: boolean;
}

export const EMPTY_DRAFT: FilterDraft = {
  priceMin: "",
  priceMax: "",
  monthlyPriceMin: "",
  monthlyPriceMax: "",
  yearMin: "",
  yearMax: "",
  kmMin: "",
  kmMax: "",
  ccMin: "",
  ccMax: "",
  hpMin: "",
  hpMax: "",
  maker: "",
  fuel: "",
  transmissionType: "",
  color: "",
  typeOfCar: "",
  offerOnly: false,
};

// Data only — deliberately no `onRemove` function stored here. Building
// ref-closing closures (setCsvParam/clearNumericField/setOfferOnly all
// touch debounceRef) into a plain array during render trips the
// react-hooks/refs lint rule ("passing a ref to a function"); the removal
// handler is instead created inline inside the consuming component's own
// JSX `.map()`.
export type ActiveFilterChip =
  | { id: string; label: string; ariaLabel: string; kind: "csv"; field: CsvField; value: string }
  | { id: string; label: string; ariaLabel: string; kind: "numeric"; field: NumericField }
  | { id: string; label: string; ariaLabel: string; kind: "offer" };

// One label per numeric field with a rendered control in the filter panel,
// used only to build the human-readable active-filter chip for it.
const NUMERIC_CHIP_LABEL: Partial<Record<NumericField, (value: string) => string>> = {
  priceMin: (v) => `Από ${formatEuro(v)}`,
  priceMax: (v) => `Έως ${formatEuro(v)}`,
  monthlyPriceMin: (v) => `Leasing από ${formatEuro(v)}`,
  monthlyPriceMax: (v) => `Leasing έως ${formatEuro(v)}`,
  yearMin: (v) => `Έτος από ${v}`,
  yearMax: (v) => `Έτος έως ${v}`,
  kmMin: (v) => `Χλμ από ${new Intl.NumberFormat("el-GR").format(Number(v))}`,
  kmMax: (v) => `Χλμ έως ${new Intl.NumberFormat("el-GR").format(Number(v))}`,
  ccMin: (v) => `Κυβικά από ${new Intl.NumberFormat("el-GR").format(Number(v))} cc`,
  ccMax: (v) => `Κυβικά έως ${new Intl.NumberFormat("el-GR").format(Number(v))} cc`,
  // "hp" (not "Bhp") to match the exact unit already shown on the vehicle
  // detail page (src/app/(public)/vehicles/[slug]/page.tsx: `${vehicle.hp} hp`)
  // — one consistent unit between the filter chip and the vehicle data itself.
  hpMin: (v) => `Ίπποι από ${v} hp`,
  hpMax: (v) => `Ίπποι έως ${v} hp`,
};

// Deduplicates (order-preserving) a raw comma-separated CSV field value.
// `buildQueryString` already sorts+dedupes any value *this app* writes, but
// a direct/hand-crafted/legacy URL (e.g. `?maker=BMW,BMW`) bypasses that —
// this is the one parsing boundary every canonical read goes through, so
// normalizing here keeps checkbox state, the active-filter chip list (which
// keys each chip by `field:value`), and the server query all seeing the
// same deduplicated set regardless of how the URL was reached.
function dedupeCsvValue(raw: string): string {
  if (!raw) return raw;
  return Array.from(new Set(raw.split(",").filter(Boolean))).join(",");
}

export function computeDraftFromParams(searchParams: URLSearchParams): FilterDraft {
  const draft = { ...EMPTY_DRAFT };
  for (const field of NUMERIC_FIELDS) draft[field] = searchParams.get(field) ?? "";
  for (const field of CSV_FIELDS) draft[field] = dedupeCsvValue(searchParams.get(field) ?? "");
  draft.offerOnly = searchParams.get("offerOnly") === "true";
  return draft;
}

export function draftsEqual(a: FilterDraft, b: FilterDraft): boolean {
  for (const field of NUMERIC_FIELDS) if (a[field] !== b[field]) return false;
  for (const field of CSV_FIELDS) if (a[field] !== b[field]) return false;
  return a.offerOnly === b.offerOnly;
}

export function toggleCsvValue(current: string, value: string): string {
  const list = current ? current.split(",").filter(Boolean) : [];
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
  return list.join(",");
}

// Distinguishes *why* the committed filter state (and therefore
// `activeChips`) just changed — consumed by the filter sidebar's accordion
// to decide how to reconcile section open/closed state:
//  - "filter": a single same-page filter control (a toggle, a dropdown
//    selection, one chip's remove button) — only the section that field
//    belongs to should open/close; every other section's open/closed
//    state (including a section a user manually opened with no filter in
//    it) is left exactly as it was.
//  - "clear-all": the centralized clear action, from either the sidebar's
//    "Καθαρισμός όλων" or the end-of-results "Καθαρισμός φίλτρων" — every
//    section should close, unconditionally.
//  - "external": the committed state changed WITHOUT this component's own
//    applyDraft/clearFilters running first — i.e. Back, Forward, a direct
//    URL, or a refresh. The just-restored URL is authoritative, so the
//    open-section set should be fully rebuilt from it, discarding any
//    section state a user manually toggled under a previous history entry.
export type FilterChangeSource = "filter" | "clear-all" | "external";

interface VehicleFilterContextValue {
  draft: FilterDraft;
  setDraft: React.Dispatch<React.SetStateAction<FilterDraft>>;
  setCsvParam: (key: CsvField, value: string) => void;
  setOfferOnly: (checked: boolean) => void;
  setNumericValue: (field: NumericField, value: string) => void;
  clearNumericField: (field: NumericField) => void;
  clearFilters: () => void;
  activeChips: ActiveFilterChip[];
  hasActiveFilters: boolean;
  handleChipRemove: (chip: ActiveFilterChip) => void;
  lastChangeSource: FilterChangeSource;
}

const VehicleFilterContext = React.createContext<VehicleFilterContextValue | null>(null);

// Single authoritative owner of the /vehicles filter draft, debounce timer
// and commit path — shared by the filter sidebar (checkboxes, price inputs,
// the active-filters box's "Καθαρισμός όλων") and the end-of-results
// "Καθαρισμός φίλτρων" text action. Deliberately one shared instance rather
// than each consumer calling its own copy of this logic: two independent
// `debounceRef`s could race (one clearing the URL while the other's stale
// price-debounce timer later fires and overwrites it), and two independent
// `activeChips` computations could disagree about whether a filter is
// active. Wrap every component that needs filter state or the clear action
// in <VehicleFilterProvider>; consume via useVehicleFilterContext().
export function VehicleFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const transition = useNavigationTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestScroll = useVehicleResultsScroll();

  // Same-page filter query-string sync must never activate the global
  // full-screen loader — that's reserved for real page navigation. Routed
  // through the provider's silent, non-blocking syncUrlState, with a plain
  // router.replace fallback if it's ever rendered outside that provider.
  const syncUrl = React.useCallback(
    (href: string) => {
      if (transition) transition.syncUrlState(href, { method: "replace" });
      else router.replace(href, { scroll: false });
    },
    [transition, router],
  );

  const [draft, setDraft] = React.useState<FilterDraft>(() => computeDraftFromParams(searchParams));
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // The draft that's already reflected in the URL — i.e. nothing left to
  // sync. Compared by value, not by effect-run count, so this can't
  // misfire under React Strict Mode's dev-only double-invocation of mount
  // effects (the "isFirstRun" pattern this replaced broke under exactly
  // that double-invoke, firing a phantom self-navigation on every mount).
  const lastAppliedDraftRef = React.useRef(draft);

  // See FilterChangeSource above. Defaults to "external" so the very first
  // render (no filter interaction has happened yet) is treated as a fresh
  // URL/refresh by any consumer that branches on it.
  const [lastChangeSource, setLastChangeSource] = React.useState<FilterChangeSource>("external");

  React.useEffect(() => {
    // Keep local draft in sync if the URL changes from elsewhere (Back/Forward,
    // pagination, a shared link).
    const next = computeDraftFromParams(searchParams);
    // Captured BEFORE this effect overwrites the ref below: if the newly
    // observed committed state already matches what applyDraft/clearFilters
    // last *predicted* (they set this ref synchronously, before the URL
    // write even resolves), this searchParams change is simply this
    // component's own prior commit finally landing — not an external
    // navigation — so `lastChangeSource` (already set to "filter" or
    // "clear-all" by that caller) is left untouched.
    const matchesLastApplied = draftsEqual(next, lastAppliedDraftRef.current);
    lastAppliedDraftRef.current = next;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(next);
    if (!matchesLastApplied) {
      setLastChangeSource("external");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Single choke point for every committed filter change (checkbox/offer
  // toggles call this synchronously, the numeric price debounce below calls
  // it once the debounce fires) — so the results-scroll request only needs
  // to be wired up in this one place, not duplicated at every call site.
  const applyDraft = React.useCallback(
    (next: FilterDraft) => {
      lastAppliedDraftRef.current = next;
      setLastChangeSource("filter");
      const updates: Record<string, string | undefined> = {
        offerOnly: next.offerOnly ? "true" : undefined,
      };
      for (const field of NUMERIC_FIELDS) updates[field] = next[field] || undefined;
      for (const field of CSV_FIELDS) updates[field] = next[field] || undefined;
      const qs = buildQueryString(searchParams, updates);
      syncUrl(buildHref(pathname, qs));
      requestScroll();
    },
    [pathname, searchParams, syncUrl, requestScroll],
  );

  // Only the numeric range inputs go through this debounced effect (raw
  // typing shouldn't fire a request per keystroke). Checkbox/offer changes
  // call applyDraft directly and synchronously below, bypassing the
  // debounce entirely, since each one is already a single discrete click.
  React.useEffect(() => {
    if (draftsEqual(lastAppliedDraftRef.current, draft)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      applyDraft(draft);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setCsvParam = React.useCallback(
    (key: CsvField, value: string) => {
      const next = { ...draft, [key]: toggleCsvValue(draft[key], value) };
      setDraft(next);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      applyDraft(next);
    },
    [draft, applyDraft],
  );

  const setOfferOnly = React.useCallback(
    (checked: boolean) => {
      const next = { ...draft, offerOnly: checked };
      setDraft(next);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      applyDraft(next);
    },
    [draft, applyDraft],
  );

  // Immediate, non-debounced commit for a single numeric field — the
  // dropdown-based range controls (year/mileage/cc/hp — see
  // NumericRangeSelect) call this directly on every selection. A dropdown
  // choice is already one discrete, explicit action (unlike free-typed
  // numeric input or a slider drag), so it mirrors setCsvParam/setOfferOnly
  // exactly rather than going through the draft-watching debounce effect
  // above: update the local draft immediately, cancel any pending debounce
  // from an unrelated in-flight field, commit synchronously.
  const setNumericValue = React.useCallback(
    (field: NumericField, value: string) => {
      const next = { ...draft, [field]: value };
      setDraft(next);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      applyDraft(next);
    },
    [draft, applyDraft],
  );

  // Chip removal for a numeric range endpoint (price/year/km/cc/hp min or
  // max) is just setNumericValue(field, "") — removing one endpoint never
  // touches its counterpart (removing "Από 5.000 €" leaves "Έως 20.000 €"
  // untouched).
  const clearNumericField = React.useCallback((field: NumericField) => setNumericValue(field, ""), [setNumericValue]);

  const clearFilters = React.useCallback(() => {
    // Repeated clicks while already clear must be a true no-op: no state
    // update, no URL write, no transition. Checked against `draft` (this
    // provider's single shared instance), so it's correct regardless of
    // which consumer — the sidebar's "Καθαρισμός όλων" or the end-of-results
    // "Καθαρισμός φίλτρων" — triggered the call.
    if (draftsEqual(draft, EMPTY_DRAFT)) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Reset the controls synchronously, in this same click handler — do not
    // wait for the URL round-trip to eventually flow back through the
    // searchParams-sync effect above.
    setDraft(EMPTY_DRAFT);
    lastAppliedDraftRef.current = EMPTY_DRAFT;
    setLastChangeSource("clear-all");
    // Clear only the narrowing filter fields, routed through the same
    // buildQueryString merge every other commit uses — `sort` (and any
    // other non-filter param) is left completely untouched rather than
    // wiped by navigating to the bare pathname, since sorting reorders the
    // existing result set rather than narrowing it and the selected order
    // is a deliberate, orthogonal user choice. `resetPage` defaults to
    // true, so pagination still returns to page 1.
    const updates: Record<string, string | undefined> = { offerOnly: undefined };
    for (const field of NUMERIC_FIELDS) updates[field] = undefined;
    for (const field of CSV_FIELDS) updates[field] = undefined;
    const qs = buildQueryString(searchParams, updates);
    syncUrl(buildHref(pathname, qs));
    requestScroll();
  }, [draft, searchParams, pathname, syncUrl, requestScroll]);

  // The one canonical source for the active-filters box and the
  // end-of-results section: derived from the *committed* URL state
  // (searchParams), not the local `draft` — draft updates on every
  // keystroke for the numeric range inputs, and a price chip must not
  // appear until that value has actually been committed to the
  // results/URL. CSV fields commit immediately on click, so for those
  // `committed` and `draft` are equivalent at all times; using `committed`
  // uniformly here keeps a single rule for the whole list rather than a
  // special case per field type.
  //
  // Count policy (Option A — each selected value counts individually): the
  // count always equals `activeChips.length`, so it can never disagree with
  // the rendered chips. Sorting is intentionally excluded — it reorders the
  // existing result set rather than narrowing it, so counting it would
  // inflate the badge without a corresponding "remove" affordance a user
  // would expect from a filter chip. Pagination is never part of this
  // draft at all, so it can never be counted either.
  const committed = React.useMemo(() => computeDraftFromParams(searchParams), [searchParams]);

  // Data-only, so this is safe to memoize purely on `committed` — unlike a
  // version that stored bound removal callbacks, there's no closed-over
  // `draft` here that could go stale between commits.
  const activeChips = React.useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    for (const field of CSV_FIELDS) {
      const values = committed[field] ? committed[field].split(",").filter(Boolean) : [];
      for (const value of values) {
        chips.push({ id: `${field}:${value}`, label: value, ariaLabel: `Αφαίρεση φίλτρου ${value}`, kind: "csv", field, value });
      }
    }
    for (const field of NUMERIC_FIELDS) {
      const value = committed[field];
      const toLabel = NUMERIC_CHIP_LABEL[field];
      // A malformed direct/legacy URL (e.g. `?priceMin=abc`) reaches this
      // component's local draft as a raw, unvalidated string — the server
      // already rejects it safely (vehicleFilterSchema.safeParse falls back
      // to defaults), but without this check the chip itself would render
      // a misleading label built from a non-finite number (e.g. "Από -").
      if (!value || !toLabel || !Number.isFinite(Number(value))) continue;
      chips.push({ id: field, label: toLabel(value), ariaLabel: `Αφαίρεση φίλτρου ${toLabel(value)}`, kind: "numeric", field });
    }
    if (committed.offerOnly) {
      chips.push({ id: "offerOnly", label: "Μόνο προσφορές", ariaLabel: "Αφαίρεση φίλτρου Μόνο προσφορές", kind: "offer" });
    }
    return chips;
  }, [committed]);

  // The one removal entry point every chip's close button calls, created
  // inline inside the consuming component's own JSX render (not stored in
  // the plain `activeChips` data array above) so it reads the *current*
  // `draft` at click time rather than whatever it was when `activeChips`
  // last changed.
  const handleChipRemove = React.useCallback(
    (chip: ActiveFilterChip) => {
      if (chip.kind === "csv") setCsvParam(chip.field, chip.value);
      else if (chip.kind === "numeric") clearNumericField(chip.field);
      else setOfferOnly(false);
    },
    [setCsvParam, clearNumericField, setOfferOnly],
  );

  const contextValue = React.useMemo<VehicleFilterContextValue>(
    () => ({
      draft,
      setDraft,
      setCsvParam,
      setOfferOnly,
      setNumericValue,
      clearNumericField,
      clearFilters,
      activeChips,
      hasActiveFilters: activeChips.length > 0,
      handleChipRemove,
      lastChangeSource,
    }),
    [draft, setCsvParam, setOfferOnly, setNumericValue, clearNumericField, clearFilters, activeChips, handleChipRemove, lastChangeSource],
  );

  return <VehicleFilterContext.Provider value={contextValue}>{children}</VehicleFilterContext.Provider>;
}

export function useVehicleFilterContext(): VehicleFilterContextValue {
  const context = React.useContext(VehicleFilterContext);
  if (!context) {
    throw new Error("useVehicleFilterContext must be used within a VehicleFilterProvider");
  }
  return context;
}
