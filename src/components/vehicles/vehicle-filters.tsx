"use client";

import * as React from "react";
import { Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { PriceRangeSlider } from "@/components/vehicles/price-range-slider";
import { NumericRangeSelect } from "@/components/vehicles/numeric-range-select";
import { FilterToggleButton } from "@/components/vehicles/filter-toggle-button";
import { resolveFuelIcon, resolveTransmissionIcon, resolveVehicleTypeIcon, DEALS_ICON } from "@/components/vehicles/filter-option-metadata";
import { MakerBadge } from "@/components/vehicles/maker-badge";
import { FILTER_TRIGGER_CLASS } from "@/components/vehicles/filter-typography";
import { createNumericRange } from "@/lib/numeric-range";
import { cn, formatKm } from "@/lib/utils";
import { normalizeForSearch as normalizeColorTerm, colorMatchesSearch, colorGroupKey, compareColors } from "@/lib/color-search";
import {
  VEHICLE_FILTER_RANGES,
  VEHICLE_MONTHLY_PRICE_FILTER_MIN,
  VEHICLE_MONTHLY_PRICE_FILTER_MAX,
  VEHICLE_MONTHLY_PRICE_FILTER_STEP,
} from "@/lib/validators/vehicle.schema";
import {
  useVehicleFilterContext,
  type ActiveFilterChip,
  type NumericField,
  type CsvField,
} from "@/components/providers/vehicle-filter-provider";

export interface VehicleFilterOptions {
  makers: string[];
  colors: string[];
  typesOfCar: string[];
  fuels: string[];
  transmissions: string[];
  hasOffers: boolean;
}

const TRIGGER_CLASS = FILTER_TRIGGER_CLASS;

// Generated once at module scope from the centralized business config
// (VEHICLE_FILTER_RANGES, vehicle.schema.ts) — never recreated on render,
// never hardcoded inline as a wall of <option> elements.
const YEAR_OPTIONS = createNumericRange(VEHICLE_FILTER_RANGES.year.min, VEHICLE_FILTER_RANGES.year.max, VEHICLE_FILTER_RANGES.year.step);
const MILEAGE_OPTIONS = createNumericRange(VEHICLE_FILTER_RANGES.mileage.min, VEHICLE_FILTER_RANGES.mileage.max, VEHICLE_FILTER_RANGES.mileage.step);
const CC_OPTIONS = createNumericRange(VEHICLE_FILTER_RANGES.engineCc.min, VEHICLE_FILTER_RANGES.engineCc.max, VEHICLE_FILTER_RANGES.engineCc.step);
const HP_OPTIONS = createNumericRange(VEHICLE_FILTER_RANGES.horsepower.min, VEHICLE_FILTER_RANGES.horsepower.max, VEHICLE_FILTER_RANGES.horsepower.step);

const formatYearOption = (value: number) => String(value);
const formatMileageOption = (value: number) => formatKm(value);
const formatCcOption = (value: number) => `${new Intl.NumberFormat("el-GR").format(value)} cc`;
// "hp", not "Bhp" — matches the unit already shown on the vehicle detail
// page (`${vehicle.hp} hp`) and the chip label above, so the dropdown
// value, the chip and the vehicle card/detail page never disagree on unit.
const formatHpOption = (value: number) => `${value} hp`;

// Locale-aware alphabetical ordering for manufacturer names (handles Greek
// and Latin scripts, and numeric-aware comparison e.g. "5 Series" style
// names sort numerically rather than character-by-character).
const MAKER_COLLATOR = new Intl.Collator("el-GR", { sensitivity: "base", numeric: true });

// Diacritic/case-insensitive normalization for the manufacturer search box
// — "citroen" should match "Citroën". NFD splits accented characters into a
// base letter + combining mark, which the regex then strips.
function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Dynamic grouping key — whatever letters are actually present in the
// (already-loaded) manufacturer list, never a hardcoded A–Z scan. Anything
// not starting with a letter (a rare edge case for manufacturer names)
// falls under a single "#" bucket rather than being hidden or crashing.
function makerGroupLetter(value: string): string {
  const first = value.trim().charAt(0);
  return /\p{L}/u.test(first) ? first.toLocaleUpperCase("el-GR") : "#";
}

// One typed identifier per collapsible section — these are exactly the
// AccordionItem `value` strings used below, so there is a single real
// vocabulary shared by the accordion markup and the section-activity
// predicate (no separate "manufacturer"/"engineCc"/"horsepower" renaming
// layer that could drift from the actual field names already established
// in vehicle-filter-provider.tsx's NumericField/CsvField).
type VehicleFilterSection = "price" | "maker" | "year" | "km" | "fuel" | "cc" | "hp" | "transmissionType" | "color" | "typeOfCar" | "offers";

const ALL_SECTIONS: VehicleFilterSection[] = ["price", "maker", "year", "km", "fuel", "cc", "hp", "transmissionType", "color", "typeOfCar", "offers"];

// Maps every canonical numeric/csv field that has a rendered control to the
// section that owns it. `monthlyPriceMin`/`monthlyPriceMax` share the
// "price" section — same AccordionItem as the purchase-price slider, just a
// second stacked slider underneath it.
const FIELD_TO_SECTION: Partial<Record<NumericField | CsvField, VehicleFilterSection>> = {
  priceMin: "price",
  priceMax: "price",
  monthlyPriceMin: "price",
  monthlyPriceMax: "price",
  yearMin: "year",
  yearMax: "year",
  kmMin: "km",
  kmMax: "km",
  ccMin: "cc",
  ccMax: "cc",
  hpMin: "hp",
  hpMax: "hp",
  maker: "maker",
  fuel: "fuel",
  transmissionType: "transmissionType",
  color: "color",
  typeOfCar: "typeOfCar",
};

// The set of sections that currently own at least one committed
// (URL-reflected) active filter — derived purely from activeChips, which is
// itself built from the committed searchParams (see VehicleFilterProvider),
// never from local draft or local search text. Sort and pagination never
// produce a chip, so they can never open a section.
function computeActiveSections(chips: ActiveFilterChip[]): Set<VehicleFilterSection> {
  const sections = new Set<VehicleFilterSection>();
  for (const chip of chips) {
    if (chip.kind === "offer") {
      sections.add("offers");
      continue;
    }
    const section = FIELD_TO_SECTION[chip.field];
    if (section) sections.add(section);
  }
  return sections;
}

function sectionSetsEqual(a: Set<VehicleFilterSection>, b: Set<VehicleFilterSection>): boolean {
  if (a.size !== b.size) return false;
  for (const section of a) if (!b.has(section)) return false;
  return true;
}

export function VehicleFilters({ options }: { options: VehicleFilterOptions }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Single shared source (VehicleFilterProvider, wrapping this component and
  // the end-of-results section — see src/app/(public)/vehicles/page.tsx) for
  // every filter mutation, so this component and the "Καθαρισμός φίλτρων"
  // action below the results share one debounce timer, one draft, and one
  // clear implementation instead of two that could diverge or race.
  const {
    draft,
    setDraft,
    setCsvParam,
    setOfferOnly,
    setNumericValue,
    clearNumericField,
    clearFilters,
    activeChips,
    handleChipRemove,
    lastChangeSource,
  } = useVehicleFilterContext();

  // Local-only manufacturer search text — filters the display of the
  // already-loaded options.makers list. Deliberately never touches
  // draft/URL/pagination: typing here is purely a client-side narrowing of
  // what's rendered, so a manufacturer already selected (draft.maker) stays
  // selected even while hidden by an unrelated search term.
  const [makerSearch, setMakerSearch] = React.useState("");
  const selectedMakers = draft.maker.split(",").filter(Boolean);
  const makerGroups = React.useMemo(() => {
    const term = normalizeForSearch(makerSearch);
    const filtered = term ? options.makers.filter((maker) => normalizeForSearch(maker).includes(term)) : options.makers;
    const sorted = [...filtered].sort((a, b) => MAKER_COLLATOR.compare(a, b));
    const groups = new Map<string, string[]>();
    for (const maker of sorted) {
      const letter = makerGroupLetter(maker);
      const bucket = groups.get(letter);
      if (bucket) bucket.push(maker);
      else groups.set(letter, [maker]);
    }
    return Array.from(groups.entries());
  }, [options.makers, makerSearch]);

  // Local-only color search text — same "never touches draft/URL" contract
  // as makerSearch above, plus cross-language (Greek/English) family
  // matching and script-aware grouping/sorting (src/lib/color-search.ts),
  // since — unlike manufacturer names — the database's raw `color` values
  // are not normalized into one script or one canonical spelling.
  const [colorSearch, setColorSearch] = React.useState("");
  const selectedColors = draft.color.split(",").filter(Boolean);
  const colorGroups = React.useMemo(() => {
    const term = normalizeColorTerm(colorSearch);
    const filtered = term ? options.colors.filter((color) => colorMatchesSearch(color, term)) : options.colors;
    const sorted = [...filtered].sort(compareColors);
    const groups = new Map<string, string[]>();
    for (const color of sorted) {
      const { letter } = colorGroupKey(color);
      const bucket = groups.get(letter);
      if (bucket) bucket.push(color);
      else groups.set(letter, [color]);
    }
    return Array.from(groups.entries());
  }, [options.colors, colorSearch]);

  // Single owner of every section's open/closed state — one array, not a
  // boolean per section and not a second copy for mobile (the mobile Sheet
  // and desktop aside below both render the exact same `filterCategories`
  // tree, so they necessarily share this one state).
  //
  // Initial value: sections with a committed active filter open, everything
  // else closed — computed identically on the server (via useSearchParams,
  // which reads the real request URL during SSR) and on the client, so the
  // very first rendered frame is already correct with no hydration flip.
  //
  // `activeSections`/`prevActiveSections` are compared on every render
  // (React's documented "adjusting state when a prop changes" pattern, not
  // a useEffect — this repo's lint config flags an unconditional
  // setState-in-effect as a cascading-render risk, same reasoning as
  // PriceRangeSlider's prop-sync above). Reconciliation branches on
  // `lastChangeSource` (VehicleFilterProvider) to implement three distinct,
  // deliberately different policies:
  //  - "filter" (a control here, or one chip's own remove button): only the
  //    section(s) that actually transitioned active<->inactive are
  //    toggled — a section the user manually opened with no filter in it,
  //    or another section that's still active, is left exactly as it was.
  //    Removing the very last active filter anywhere this way still only
  //    closes ITS OWN section, never every section.
  //  - "clear-all": every section closes, unconditionally — the one case
  //    where "leave unrelated sections alone" does not apply.
  //  - "external" (Back, Forward, a direct URL, a refresh): the restored
  //    URL is authoritative, so the whole open-section set is rebuilt from
  //    it, discarding any section state left over from a previous history
  //    entry.
  const activeSections = React.useMemo(() => computeActiveSections(activeChips), [activeChips]);
  const [openSections, setOpenSections] = React.useState<string[]>(() => Array.from(activeSections));
  const [prevActiveSections, setPrevActiveSections] = React.useState(activeSections);
  if (!sectionSetsEqual(activeSections, prevActiveSections)) {
    setPrevActiveSections(activeSections);
    if (lastChangeSource === "clear-all") {
      setOpenSections([]);
    } else if (lastChangeSource === "external") {
      setOpenSections(Array.from(activeSections));
    } else {
      setOpenSections((current) => {
        const next = new Set(current);
        for (const section of ALL_SECTIONS) {
          const wasActive = prevActiveSections.has(section);
          const isActive = activeSections.has(section);
          if (isActive && !wasActive) next.add(section);
          if (!isActive && wasActive) next.delete(section);
        }
        return Array.from(next);
      });
    }
  }

  // Main title (navy, same family as the category headings below) + the
  // dynamic active-filters summary. The total result count and sorting
  // control both now live in the results toolbar above the vehicle grid
  // (src/components/vehicles/vehicle-results-toolbar.tsx) — this panel
  // holds only narrowing/search criteria, never sorting or a result count.
  // Kept as a separate block from the scrollable categories so the desktop
  // sidebar can hold it fixed above the one internal scroll region (see the
  // `aside` markup further down).
  const filterHeader = (
    <div className="border-b border-border pb-3">
      <h2 className="text-2xl font-bold leading-tight text-primary">Φίλτρα</h2>
      <ActiveFiltersBox chips={activeChips} onRemoveChip={handleChipRemove} onClearAll={clearFilters} />
    </div>
  );

  const filterCategories = (
    <div className="space-y-1">
      <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
        <AccordionItem value="price">
          <AccordionTrigger className={TRIGGER_CLASS}>Τιμή</AccordionTrigger>
          <AccordionContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Αγορά</p>
              <PriceRangeSlider
                minValue={draft.priceMin}
                maxValue={draft.priceMax}
                onCommit={(min, max) => setDraft((prev) => ({ ...prev, priceMin: min, priceMax: max }))}
              />
            </div>
            <div className="space-y-2 border-t border-border/70 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Leasing (μηνιαίο)</p>
              <PriceRangeSlider
                minValue={draft.monthlyPriceMin}
                maxValue={draft.monthlyPriceMax}
                onCommit={(min, max) => setDraft((prev) => ({ ...prev, monthlyPriceMin: min, monthlyPriceMax: max }))}
                rangeMin={VEHICLE_MONTHLY_PRICE_FILTER_MIN}
                rangeMax={VEHICLE_MONTHLY_PRICE_FILTER_MAX}
                rangeStep={VEHICLE_MONTHLY_PRICE_FILTER_STEP}
                minAriaLabel="Ελάχιστη μηνιαία τιμή"
                maxAriaLabel="Μέγιστη μηνιαία τιμή"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {options.makers.length > 0 && (
          <AccordionItem value="maker">
            <AccordionTrigger className={TRIGGER_CLASS}>Κατασκευαστής</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="relative">
                <Label htmlFor="maker-search" className="sr-only">
                  Αναζήτηση κατασκευαστή
                </Label>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  id="maker-search"
                  type="text"
                  placeholder="Αναζήτηση κατασκευαστή"
                  value={makerSearch}
                  onChange={(e) => setMakerSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              {makerGroups.length === 0 ? (
                <div className="space-y-1.5 py-1 text-sm text-ink-muted">
                  <p>Δεν βρέθηκε κατασκευαστής</p>
                  <button
                    type="button"
                    onClick={() => setMakerSearch("")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Καθαρισμός αναζήτησης
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {makerGroups.map(([letter, makers]) => (
                    <div key={letter} className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold tracking-wide text-primary">
                          {letter}
                        </span>
                        <div className="h-px flex-1 bg-border/70" />
                      </div>
                      <div className="space-y-0.5">
                        {makers.map((maker) => {
                          const checked = selectedMakers.includes(maker);
                          return (
                            <label
                              key={maker}
                              className={cn(
                                "flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm transition-colors",
                                checked ? "bg-primary/[0.06] font-semibold text-primary" : "text-[#1a1a1a] hover:bg-surface",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => setCsvParam("maker", maker)}
                              />
                              <MakerBadge maker={maker} size={26} />
                              <span className="flex-1 truncate">{maker}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="year">
          <AccordionTrigger className={TRIGGER_CLASS}>Χρονολογία</AccordionTrigger>
          <AccordionContent>
            <NumericRangeSelect
              options={YEAR_OPTIONS}
              minValue={draft.yearMin}
              maxValue={draft.yearMax}
              minAriaLabel="Ελάχιστη χρονολογία"
              maxAriaLabel="Μέγιστη χρονολογία"
              minPlaceholder="Χωρίς ελάχιστο"
              maxPlaceholder="Χωρίς μέγιστο"
              formatOption={formatYearOption}
              onMinChange={(value) => setNumericValue("yearMin", value)}
              onMaxChange={(value) => setNumericValue("yearMax", value)}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="km">
          <AccordionTrigger className={TRIGGER_CLASS}>Χιλιόμετρα</AccordionTrigger>
          <AccordionContent>
            <NumericRangeSelect
              options={MILEAGE_OPTIONS}
              minValue={draft.kmMin}
              maxValue={draft.kmMax}
              minAriaLabel="Ελάχιστα χιλιόμετρα"
              maxAriaLabel="Μέγιστα χιλιόμετρα"
              minPlaceholder="Χωρίς ελάχιστο"
              maxPlaceholder="Χωρίς μέγιστο"
              formatOption={formatMileageOption}
              onMinChange={(value) => setNumericValue("kmMin", value)}
              onMaxChange={(value) => setNumericValue("kmMax", value)}
            />
          </AccordionContent>
        </AccordionItem>

        {options.fuels.length > 0 && (
          <AccordionItem value="fuel">
            <AccordionTrigger className={TRIGGER_CLASS}>Καύσιμο</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2">
                {options.fuels.map((value) => (
                  <FilterToggleButton
                    key={value}
                    label={value}
                    icon={resolveFuelIcon(value)}
                    selected={draft.fuel.split(",").filter(Boolean).includes(value)}
                    onToggle={() => setCsvParam("fuel", value)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="cc">
          <AccordionTrigger className={TRIGGER_CLASS}>Κυβικά (cc)</AccordionTrigger>
          <AccordionContent>
            <NumericRangeSelect
              options={CC_OPTIONS}
              minValue={draft.ccMin}
              maxValue={draft.ccMax}
              minAriaLabel="Ελάχιστα κυβικά"
              maxAriaLabel="Μέγιστα κυβικά"
              minPlaceholder="Χωρίς ελάχιστο"
              maxPlaceholder="Χωρίς μέγιστο"
              formatOption={formatCcOption}
              onMinChange={(value) => setNumericValue("ccMin", value)}
              onMaxChange={(value) => setNumericValue("ccMax", value)}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="hp">
          <AccordionTrigger className={TRIGGER_CLASS}>Ιπποδύναμη (Bhp)</AccordionTrigger>
          <AccordionContent>
            <NumericRangeSelect
              options={HP_OPTIONS}
              minValue={draft.hpMin}
              maxValue={draft.hpMax}
              minAriaLabel="Ελάχιστη ιπποδύναμη"
              maxAriaLabel="Μέγιστη ιπποδύναμη"
              minPlaceholder="Χωρίς ελάχιστο"
              maxPlaceholder="Χωρίς μέγιστο"
              formatOption={formatHpOption}
              onMinChange={(value) => setNumericValue("hpMin", value)}
              onMaxChange={(value) => setNumericValue("hpMax", value)}
            />
          </AccordionContent>
        </AccordionItem>

        {options.transmissions.length > 0 && (
          <AccordionItem value="transmissionType">
            <AccordionTrigger className={TRIGGER_CLASS}>Κιβώτιο Ταχυτήτων</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2">
                {options.transmissions.map((value) => (
                  <FilterToggleButton
                    key={value}
                    label={value}
                    icon={resolveTransmissionIcon(value)}
                    selected={draft.transmissionType.split(",").filter(Boolean).includes(value)}
                    onToggle={() => setCsvParam("transmissionType", value)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {options.colors.length > 0 && (
          <AccordionItem value="color">
            <AccordionTrigger className={TRIGGER_CLASS}>Χρώμα</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="relative">
                <Label htmlFor="color-search" className="sr-only">
                  Αναζήτηση χρώματος
                </Label>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  id="color-search"
                  type="text"
                  placeholder="Αναζήτηση χρώματος"
                  value={colorSearch}
                  onChange={(e) => setColorSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              {colorGroups.length === 0 ? (
                <div className="space-y-1.5 py-1 text-sm text-ink-muted">
                  <p>Δεν βρέθηκε χρώμα</p>
                  <button
                    type="button"
                    onClick={() => setColorSearch("")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Καθαρισμός αναζήτησης
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {colorGroups.map(([letter, colors]) => (
                    <div key={letter} className="space-y-1.5">
                      <p className="text-xs font-bold text-primary">{letter}</p>
                      <div className="space-y-2">
                        {colors.map((color) => (
                          <label key={color} className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                            <Checkbox
                              checked={selectedColors.includes(color)}
                              onCheckedChange={() => setCsvParam("color", color)}
                            />
                            <span>{color}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {options.typesOfCar.length > 0 && (
          <AccordionItem value="typeOfCar">
            <AccordionTrigger className={TRIGGER_CLASS}>Τύπος Αυτοκινήτου</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2">
                {options.typesOfCar.map((value) => (
                  <FilterToggleButton
                    key={value}
                    label={value}
                    icon={resolveVehicleTypeIcon(value)}
                    selected={draft.typeOfCar.split(",").filter(Boolean).includes(value)}
                    onToggle={() => setCsvParam("typeOfCar", value)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {options.hasOffers && (
          <AccordionItem value="offers">
            <AccordionTrigger className={TRIGGER_CLASS}>Προσφορές</AccordionTrigger>
            <AccordionContent>
              <FilterToggleButton
                label="Deals"
                icon={DEALS_ICON}
                selected={draft.offerOnly}
                onToggle={() => setOfferOnly(!draft.offerOnly)}
                accessibleLabel="Εμφάνιση μόνο οχημάτων σε προσφορά"
              />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );

  return (
    <>
      <div className="mb-4 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="primary" className="w-full">
              <SlidersHorizontal className="h-4 w-4" /> Φίλτρα
              {activeChips.length > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-xs font-semibold">
                  {activeChips.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh]">
            {/* Visually hidden: the block below already renders its own visible
                "Φίλτρα" heading (shared with the desktop sidebar), so a second
                visible title here would just duplicate it. Radix still needs a title for a11y. */}
            <SheetHeader className="sr-only">
              <SheetTitle>Φίλτρα</SheetTitle>
            </SheetHeader>
            <div className="shrink-0">{filterHeader}</div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-3">{filterCategories}</div>
            <SheetClose asChild>
              <Button className="w-full">Εμφάνιση αποτελεσμάτων</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden shrink-0 lg:sticky lg:top-[var(--kinsen-header-offset)] lg:block lg:self-start">
        <div className="flex max-h-[calc(100dvh_-_var(--kinsen-header-offset)_-_2rem)] flex-col rounded-card border border-border bg-white shadow-soft">
          <div className="shrink-0 px-4 pt-4">{filterHeader}</div>
          <div className="vehicle-filters-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
            {filterCategories}
          </div>
        </div>
      </aside>
    </>
  );
}

// Renders nothing at all when no filter is active — no reserved empty
// space, no permanently-visible clear button. The CSS entrance animation
// (.kinsen-active-filters-box, globals.css) fires whenever this element
// actually mounts — i.e. the zero-to-one-active-filter transition — and
// does not replay when only the chip count changes afterward, since React
// reconciles the same DOM node rather than remounting it.
function ActiveFiltersBox({
  chips,
  onRemoveChip,
  onClearAll,
}: {
  chips: ActiveFilterChip[];
  onRemoveChip: (chip: ActiveFilterChip) => void;
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="kinsen-active-filters-box mt-2.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-primary">Ενεργά φίλτρα: {chips.length}</span>
        <button
          type="button"
          onClick={onClearAll}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Καθαρισμός όλων
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-white py-1 pl-2.5 pr-1 text-xs text-ink"
          >
            {chip.label}
            <button
              type="button"
              onClick={() => onRemoveChip(chip)}
              aria-label={chip.ariaLabel}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-border/60 hover:text-ink"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
