"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { SortSelect } from "@/components/vehicles/sort-select";
import { buildQueryString } from "@/lib/query-params";

export interface VehicleFilterOptions {
  makers: string[];
  colors: string[];
  typesOfCar: string[];
  fuels: string[];
  transmissions: string[];
}

const NUMERIC_FIELDS = [
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

type NumericField = (typeof NUMERIC_FIELDS)[number];
type Draft = Record<NumericField, string>;

const TRIGGER_CLASS = "py-3 text-[1.1rem] font-semibold text-primary";

const CHECKBOX_FIELDS: { key: "transmissionType" | "color" | "typeOfCar"; label: string; optionsKey: keyof VehicleFilterOptions }[] = [
  { key: "transmissionType", label: "Κιβώτιο Ταχυτήτων", optionsKey: "transmissions" },
  { key: "color", label: "Χρώμα", optionsKey: "colors" },
  { key: "typeOfCar", label: "Τύπος Αυτοκινήτου", optionsKey: "typesOfCar" },
];

function computeDraftFromParams(searchParams: URLSearchParams): Draft {
  const draft = {} as Draft;
  for (const field of NUMERIC_FIELDS) draft[field] = searchParams.get(field) ?? "";
  return draft;
}

function toggleCsvValue(current: string, value: string): string {
  const list = current ? current.split(",").filter(Boolean) : [];
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
  return list.join(",");
}

export function VehicleFilters({ options }: { options: VehicleFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const [draft, setDraft] = React.useState<Draft>(() => computeDraftFromParams(searchParams));
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = React.useRef(true);

  React.useEffect(() => {
    // Keep local draft in sync if the URL changes from elsewhere (e.g. pagination, clear filters).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(computeDraftFromParams(searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  React.useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const qs = buildQueryString(searchParams, draft);
      router.push(`${pathname}?${qs}`, { scroll: false });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setCsvParam = (key: "maker" | "fuel" | "transmissionType" | "color" | "typeOfCar", value: string) => {
    const next = toggleCsvValue(searchParams.get(key) ?? "", value);
    const qs = buildQueryString(searchParams, { [key]: next || undefined });
    router.push(`${pathname}?${qs}`, { scroll: false });
  };

  const setOfferOnly = (checked: boolean) => {
    const qs = buildQueryString(searchParams, { offerOnly: checked ? "true" : undefined });
    router.push(`${pathname}?${qs}`, { scroll: false });
  };

  const clearFilters = () => {
    router.push(pathname, { scroll: false });
  };

  const selectedMakers = (searchParams.get("maker") ?? "").split(",").filter(Boolean);
  const selectedFuels = (searchParams.get("fuel") ?? "").split(",").filter(Boolean);
  const currentSort = searchParams.get("sort") ?? "newest";

  const fields = (
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between border-b border-[#ccc] pb-2">
        <div className="flex items-center gap-2 text-base font-semibold text-filterHeading">
          <Filter className="h-4 w-4" /> Φίλτρα
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 text-sm font-semibold text-filterHeading hover:opacity-80"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Καθαρισμός
        </button>
      </div>

      <Accordion type="multiple" defaultValue={["price", "maker"]}>
        <AccordionItem value="price">
          <AccordionTrigger className={TRIGGER_CLASS}>Τιμή</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <StackedRangeField
              minLabel="Από:"
              maxLabel="Έως:"
              minPlaceholder="π.χ. 5000"
              maxPlaceholder="π.χ. 20000"
              minValue={draft.priceMin}
              maxValue={draft.priceMax}
              onChange={(min, max) => setDraft((prev) => ({ ...prev, priceMin: min, priceMax: max }))}
            />
            <SortSelect value={currentSort} className="w-full" />
          </AccordionContent>
        </AccordionItem>

        {options.makers.length > 0 && (
          <AccordionItem value="maker">
            <AccordionTrigger className={TRIGGER_CLASS}>Κατασκευαστής</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {options.makers.map((maker) => (
                  <label key={maker} className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Checkbox
                      checked={selectedMakers.includes(maker)}
                      onCheckedChange={() => setCsvParam("maker", maker)}
                    />
                    {maker}
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="year">
          <AccordionTrigger className={TRIGGER_CLASS}>Χρονολογία</AccordionTrigger>
          <AccordionContent>
            <StackedRangeField
              minLabel="Από:"
              maxLabel="Έως:"
              minPlaceholder="π.χ. 2010"
              maxPlaceholder="π.χ. 2025"
              minValue={draft.yearMin}
              maxValue={draft.yearMax}
              onChange={(min, max) => setDraft((prev) => ({ ...prev, yearMin: min, yearMax: max }))}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="km">
          <AccordionTrigger className={TRIGGER_CLASS}>Χιλιόμετρα</AccordionTrigger>
          <AccordionContent>
            <StackedRangeField
              minLabel="Από:"
              maxLabel="Έως:"
              minPlaceholder="π.χ. 50000"
              maxPlaceholder="π.χ. 150000"
              minValue={draft.kmMin}
              maxValue={draft.kmMax}
              onChange={(min, max) => setDraft((prev) => ({ ...prev, kmMin: min, kmMax: max }))}
            />
          </AccordionContent>
        </AccordionItem>

        {options.fuels.length > 0 && (
          <AccordionItem value="fuel">
            <AccordionTrigger className={TRIGGER_CLASS}>Καύσιμο</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {options.fuels.map((fuel) => (
                  <label key={fuel} className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                    <Checkbox
                      checked={selectedFuels.includes(fuel)}
                      onCheckedChange={() => setCsvParam("fuel", fuel)}
                    />
                    {fuel}
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="cc">
          <AccordionTrigger className={TRIGGER_CLASS}>Κυβικά (cc)</AccordionTrigger>
          <AccordionContent>
            <StackedRangeField
              minLabel="Από:"
              maxLabel="Έως:"
              minPlaceholder="π.χ. 1400"
              maxPlaceholder="π.χ. 2000"
              minValue={draft.ccMin}
              maxValue={draft.ccMax}
              onChange={(min, max) => setDraft((prev) => ({ ...prev, ccMin: min, ccMax: max }))}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="hp">
          <AccordionTrigger className={TRIGGER_CLASS}>Ιπποδύναμη (Bhp)</AccordionTrigger>
          <AccordionContent>
            <StackedRangeField
              minLabel="Από:"
              maxLabel="Έως:"
              minPlaceholder="π.χ. 100"
              maxPlaceholder="π.χ. 400"
              minValue={draft.hpMin}
              maxValue={draft.hpMax}
              onChange={(min, max) => setDraft((prev) => ({ ...prev, hpMin: min, hpMax: max }))}
            />
          </AccordionContent>
        </AccordionItem>

        {CHECKBOX_FIELDS.map(({ key, label, optionsKey }) => {
          const values = options[optionsKey];
          if (!values.length) return null;
          const selected = (searchParams.get(key) ?? "").split(",").filter(Boolean);
          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className={TRIGGER_CLASS}>{label}</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {values.map((value) => (
                    <label key={value} className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                      <Checkbox checked={selected.includes(value)} onCheckedChange={() => setCsvParam(key, value)} />
                      {value}
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="flex items-center gap-2.5 border-t border-border pt-4">
        <Checkbox
          id="filter-offer"
          checked={searchParams.get("offerOnly") === "true"}
          onCheckedChange={(checked) => setOfferOnly(checked === true)}
        />
        <Label htmlFor="filter-offer" className="font-normal">
          Μόνο προσφορές
        </Label>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-4 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="primary" className="w-full">
              <SlidersHorizontal className="h-4 w-4" /> Φίλτρα
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh]">
            {/* Visually hidden: the "fields" block below already renders its own visible
                "Φίλτρα" heading + clear button (shared with the desktop sidebar), so a second
                visible title here would just duplicate it. Radix still needs a title for a11y. */}
            <SheetHeader className="sr-only">
              <SheetTitle>Φίλτρα</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto pb-4">{fields}</div>
            <SheetClose asChild>
              <Button className="w-full">Εμφάνιση αποτελεσμάτων</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden shrink-0 lg:block lg:w-72">
        <div className="sticky top-20 rounded-card border border-border bg-white p-5 shadow-soft">{fields}</div>
      </aside>
    </>
  );
}

function StackedRangeField({
  minLabel,
  maxLabel,
  minPlaceholder,
  maxPlaceholder,
  minValue,
  maxValue,
  onChange,
}: {
  minLabel: string;
  maxLabel: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  minValue: string;
  maxValue: string;
  onChange: (min: string, max: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs font-medium text-ink-muted">{minLabel}</Label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder={minPlaceholder}
          value={minValue}
          onChange={(e) => onChange(e.target.value, maxValue)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-ink-muted">{maxLabel}</Label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder={maxPlaceholder}
          value={maxValue}
          onChange={(e) => onChange(minValue, e.target.value)}
        />
      </div>
    </div>
  );
}
