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
// Every `clamp()` below shares the same two anchor points — 1280px
// (laptop floor) and 2200px (the true-large-desktop tier already
// established for the /vehicles listing shell: vehicle-grid.tsx,
// globals.css's `.container-wide`) — so the whole hierarchy scales up
// together across laptop/desktop/large-desktop and then goes flat past
// 2200px, instead of several independently-tuned breakpoint jumps or
// unbounded growth on ultrawide monitors. Below 1280px (tablet, mobile,
// and the mobile Sheet, all sharing this same file) the preferred value
// falls under each clamp's own floor, so it simply resolves to that
// floor — a small, deliberate bump over the previous static mobile sizes
// (never the large-desktop ceiling), not desktop type forced onto mobile.
//
// `py-[clamp(21px,19.6px+0.11vw,22px)]` (~42-44px combined) plus the
// label's own taller line-height together target the ~64-68px effective
// collapsed row height this polish pass calls for — padding alone, not a
// forced fixed height.
export const FILTER_TRIGGER_CLASS =
  "px-2 py-[clamp(21px,19.6px+0.11vw,22px)] text-[clamp(17.5px,15.4px+0.16vw,19px)] font-semibold leading-tight text-primary transition-colors";

// Replaces the trigger's hardcoded chevron chrome (ui/accordion.tsx's own
// last-child span — a 28px circle with a hover fill) with a plain,
// unboxed navy chevron: larger, unconditionally `text-primary` (no hover
// color change — the rotation itself already signals open/closed, so nothing
// else needs to compete for attention), and never the cyan `filterHeading`
// token at any state. Passed to every filter AccordionTrigger via the
// `chevronWrapperClassName`/`chevronClassName`/`chevronStrokeWidth` props
// ui/accordion.tsx exposes for exactly this kind of consumer-specific
// override, so mobile-nav's and the cookie modal's accordions (the other
// two consumers of that shared primitive) keep their original chevron
// untouched.
export const FILTER_CHEVRON_WRAPPER_CLASS =
  "h-auto w-auto shrink-0 rounded-none bg-transparent text-primary group-hover:bg-transparent";
export const FILTER_CHEVRON_CLASS = "h-[clamp(22px,19.2px+0.22vw,24px)] w-[clamp(22px,19.2px+0.22vw,24px)]";
export const FILTER_CHEVRON_STROKE_WIDTH = 2.375;

// The main "Φίλτρα" panel heading — same clamp anchors as the trigger/
// chevron above (1280px laptop floor -> 2200px large-desktop ceiling).
export const FILTER_TITLE_CLASS =
  "text-[clamp(25px,20.8px+0.33vw,28px)] font-bold leading-tight text-primary";

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
