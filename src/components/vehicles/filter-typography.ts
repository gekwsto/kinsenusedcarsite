// Shared Tailwind class tokens for the /vehicles filter sidebar's
// typography hierarchy — Φίλτρα → section heading → Από/Έως → value —
// used across vehicle-filters.tsx, price-range-slider.tsx and
// numeric-range-select.tsx so every control reads as one consistent
// design instead of several independently-tuned pieces.

// AccordionTrigger's own shared base (ui/accordion.tsx) declares
// `transition-all`, harmless there today but not something Filters needs
// to inherit — nothing on the trigger's own box changes except color, so
// `transition-colors` below narrows it to exactly that. It wins over the
// shared `transition-all` because both belong to the same tailwind-merge
// "transition-property" group and this constant is passed in as
// `className` (merged last). Scoped to this constant only, so the shared
// mobile-nav/cookie-modal accordions (also built on ui/accordion.tsx, but
// not consumers of this file) are untouched.
//
// The two `[&>span:last-child]:` rules give the trigger's hardcoded
// chevron (ui/accordion.tsx's own last child, not exposed as a separate
// prop) exactly one authoritative color per state — read directly off
// this same trigger element via `data-[state]`, not a second/duplicate
// piece of open-state bookkeeping:
//  - open: deep navy, unconditionally — no hover variant is defined for
//    this state, so nothing can compete with it while a row is open.
//  - closed + real hover (`(hover:hover) and (pointer:fine)` — a touch
//    tap can never satisfy this, so it never goes visually "stuck" after
//    a tap): a slightly stronger navy.
//  - closed, no hover: the muted rest color already on the shared
//    chevron span (`text-ink-muted`, ui/accordion.tsx) shows through
//    untouched, since neither rule above matches.
export const FILTER_TRIGGER_CLASS =
  "px-2 py-3 text-[1.05rem] font-semibold leading-tight text-primary transition-colors " +
  "[&[data-state=open]>span:last-child]:text-primary " +
  "[@media(hover:hover)_and_(pointer:fine)]:[&[data-state=closed]:hover>span:last-child]:text-primary/70";

export const FILTER_RANGE_LABEL_CLASS = "text-sm font-semibold text-primary/70";

// One authoritative focus treatment, reused by every interactive Filters
// control (search inputs, checkboxes, toggle buttons, the year/km/cc/hp
// selects). AccordionContent's own `overflow-hidden` (ui/accordion.tsx)
// is load-bearing — Radix's open/close height animation depends on it —
// but it also clips anything a focused child renders *outside* its own
// border box, which is exactly what this repo's default (outset) `ring-*`
// focus treatment does. Several Filters controls sit flush against that
// clipped top edge (the maker/color search inputs' own `<Label>` is
// `sr-only` and contributes no visual height above them; the first toggle
// button in the fuel/transmission/type sections has nothing above it
// either), so the top arc of their focus ring was being sliced off —
// visually indistinguishable from a cut/missing top border.
// `ring-inset` keeps the ring entirely within the control's own border
// box, so it can never be clipped regardless of where the control sits in
// the content flow — the true root cause is fixed without touching the
// shared overflow-hidden animation wrapper at all. Paired with an
// explicit navy `focus-visible:border-*` so the full 1px border itself
// (all four sides, never just three) reads as clearly focused too.
export const FILTER_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 focus-visible:border-primary";
