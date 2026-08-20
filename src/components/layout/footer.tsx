import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { getSiteSettings } from "@/server/services/settings.service";
import { CookieSettingsButton } from "@/components/layout/cookie-settings-button";
import { ScrambleLink } from "@/components/layout/scramble-link";

const QUICK_LINKS = [
  { label: "Δανειοδότηση", href: "/financing" },
  { label: "Εγγύηση", href: "/warranty" },
  { label: "Σύγκριση οχημάτων", href: "/compare" },
];

const COMPANY_LINKS = [
  { label: "Επικοινωνία", href: "/contact" },
  { label: "Συχνές Ερωτήσεις", href: "/faq" },
  { label: "Η Kinsen", href: "https://www.kinsen.gr", external: true },
];

// Corporate brand partners — plain text links, kept in the lower row (not
// "social" platforms, so out of scope for the "Βρείτε μας" icon row and
// unaffected by the animation-removal requirement that applies to socials).
// Order matches ROW 2/3's shared three-zone grid (Goldcar under Εταιρεία,
// Europcar under Επικοινωνία, Saracakis Leasing under Βρείτε μας) — see
// ZONE_GRID_COLS below.
const PARTNER_LINKS = [
  { label: "Goldcar", href: "https://www.goldcar.com/el-gr/" },
  { label: "Europcar", href: "https://www.europcar.com/en-us" },
  { label: "Saracakis Leasing", href: "https://saracakisleasing.gr/" },
];

// Official Simple Icons (CC0) brand marks, downloaded once as local
// first-party assets — see /public/icons/social/*.svg — not hand-drawn
// approximations and never fetched from a CDN at runtime. lucide-react
// ships no brand/logo icons at all (out of its trademark scope), and no
// icon library was already present in the project, so a whole new
// dependency wasn't justified for four marks.
//
// Read synchronously at module scope (not per-request): this file is
// loaded once and cached by Node/Next, so each of these four ~0.5-2KB
// reads happens once per server process, not once per page view. The raw
// markup is inlined via `dangerouslySetInnerHTML` below (rather than
// referenced as an `<img src>`) specifically so `fill="currentColor"`
// baked into each file — see the strip/edit step that produced them — can
// inherit the surrounding `text-white`, keeping the color under normal
// Footer CSS control instead of being a fixed raster/vector color.
const SOCIAL_ICON_SLUGS = ["facebook", "instagram", "linkedin", "youtube"] as const;
const SOCIAL_ICON_MARKUP: Record<(typeof SOCIAL_ICON_SLUGS)[number], string> = Object.fromEntries(
  SOCIAL_ICON_SLUGS.map((slug) => [
    slug,
    fs.readFileSync(path.join(process.cwd(), "public", "icons", "social", `${slug}.svg`), "utf8"),
  ]),
) as Record<(typeof SOCIAL_ICON_SLUGS)[number], string>;

const SOCIAL_ICON_LINKS = (settings: Awaited<ReturnType<typeof getSiteSettings>>) => [
  { label: "Facebook", href: settings.socialLinks.facebook || "https://www.facebook.com/KinsenGR/", slug: "facebook" as const },
  { label: "Instagram", href: settings.socialLinks.instagram || "https://www.instagram.com/kinsen_hellas/", slug: "instagram" as const },
  { label: "LinkedIn", href: settings.socialLinks.linkedin || "https://gr.linkedin.com/company/kinsen", slug: "linkedin" as const },
  // No settings field for this one — the URL was given explicitly for this
  // refinement pass rather than sourced from getSiteSettings().
  { label: "YouTube", href: "https://www.youtube.com/@KinsenHellas", slug: "youtube" as const },
];

// Full white, no dimmed/gray variant — hierarchy against the larger body
// content below comes entirely from size (still the smallest heading text
// in the footer), weight (bold) and uppercase tracking, never from opacity.
// `text-xs sm:text-sm lg:text-[15px]` is this tier's own restrained
// responsive step (12/14/15px) — compact on phones, gains presence from
// `lg` without ever approaching the nav-link tier's size. Margin is
// deliberately NOT baked in here (unlike the old version) since the two
// call sites need different vertical rhythm: "Πλοήγηση" in the top area
// keeps its original `mb-4`, while the three middle-band labels
// (Εταιρεία/Επικοινωνία/Βρείτε μας) use a tighter `mb-3` — see below.
const SECTION_LABEL_CLASS = "text-xs sm:text-sm lg:text-[15px] font-bold uppercase tracking-[0.14em] text-white";

// The middle 3-column band's own label treatment: `mb-3` (vs the top
// area's `mb-4`) tightens the heading-to-content gap, a purely vertical
// rhythm adjustment so each column reads as one compact, intentional unit
// instead of a loose label floating above its list. The trailing
// short-landscape-phone rule tightens that gap further, self-bounded the
// same way as every other density override in this file. No horizontal
// inset here (an earlier `pl-1` nudge was removed): hierarchy between
// this heading and its content below reads through size/weight/tracking
// and the `mb-3` gap, not through shifting either one sideways — both now
// share the exact same left edge.
const MIDDLE_LABEL_CLASS = `${SECTION_LABEL_CLASS} mb-3 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:mb-1.5`;

// LAYER B — the centered inner corporate content rail shared by every one
// of the five Footer rows below (LAYER A, the full-width navy `<footer>`
// shell with its curved top edge, is untouched). Deliberately narrower
// than `.container-page`'s own max-w-7xl (1280px box, ~1216px content at
// `lg`+): once viewport width exceeds this rail's own max-width, the
// extra space becomes outer gutter instead of stretching the Footer's
// columns further apart. This replaces an earlier `2.7fr 1fr 1fr`
// three-column grid that spanned the *full* `container-page` width — that
// let column 1 dominate the row and pushed the other two columns toward
// the far right edge, reading as content scattered across the page
// rather than one compact corporate cluster. `max-w-4xl` (896px) is the
// same width an even earlier version of the middle band alone used to
// use; the fix here is applying it consistently to all five rows instead
// of just one, so the whole Footer reads as one frame, not several
// different-width strips.
const RAIL_CLASS = "mx-auto w-full max-w-4xl";

// The three-zone grid shared by ROW 2 (Εταιρεία/Επικοινωνία/Βρείτε μας)
// and ROW 3 (Goldcar/Europcar/Saracakis Leasing) — genuine equal thirds,
// not the rejected 2.7fr-weighted split: neither row needs a dominant
// first column once the rail itself is this much narrower, and equal
// zones are what lets GOLDCAR/EUROPCAR/SARACAKIS LEASING read as
// belonging to the same cluster as ΕΤΑΙΡΕΙΑ/ΕΠΙΚΟΙΝΩΝΙΑ/ΒΡΕΙΤΕ ΜΑΣ above
// them. Only active from any landscape orientation/`lg` up; portrait/
// tablet-portrait falls back to a single stacked column, unchanged from
// before. Both the landscape rule and the `lg:` rule set the identical
// value, so the two can never disagree regardless of which one "wins"
// the cascade (Tailwind emits arbitrary `[@media(...)]:` variants after
// every named screen in the compiled stylesheet, regardless of source
// order — the same reasoning behind every other structural landscape
// rule in this file).
const ZONE_GRID_COLS = "grid-cols-1 [@media(orientation:landscape)]:grid-cols-3 lg:grid-cols-3";

// Column gap only — kept separate from each row's own vertical/stacked
// gap (`gap-10`, `gap-y-3`, ...), which stays row-specific since portrait
// stacking rhythm is a different concern from the shared column geometry.
// Tighter than the old master grid's gap at every tier (`gap-x-6`/
// `gap-x-8`, was `gap-x-6`/`gap-x-12`) — the point of the narrower rail
// is "controlled internal gaps", so the three zones don't need as much
// breathing room to avoid feeling cramped as they did at the old, much
// wider column widths.
const ZONE_GRID_GAP_X = "[@media(orientation:landscape)_and_(max-width:1023px)]:gap-x-6 lg:gap-x-8";

// A small, deliberate, symmetric outward optical nudge for the LEFT and
// RIGHT zones — the CENTER zone never moves (see CENTER_ZONE_LOCK below).
// Landscape/`lg` only, the same 8px (Tailwind's `2`/`-2` spacing step) in
// each direction so LEFT and RIGHT stay visually mirrored around the fixed
// CENTER axis at every viewport width. Applied uniformly across every row
// that has LEFT/RIGHT content — ROW 1 (CTA/Πλοήγηση), ROW 2 (Εταιρεία/
// Βρείτε μας), ROW 3 (Goldcar/Saracakis) and ROW 5 (copyright/legal) — so
// the two outer zones share one mirrored alignment rule rather than each
// row inventing its own. (A later pass briefly replaced this for ROW 2/3
// with per-element `justify-self-end`/no-shift rules tuned to equalize
// each row's own visible text gap — that approach was reverted: it made
// individual columns chase glyph bounding boxes instead of obeying the
// shared zone system, and left ROW 2/3's axis diverging from ROW 1/5's.
// The zone geometry, not manual per-string compensation, is what should
// read as balanced.)
const LEFT_ZONE_OPEN = "[@media(orientation:landscape)]:-ml-2 lg:-ml-2";
const RIGHT_ZONE_OPEN = "[@media(orientation:landscape)]:ml-2 lg:ml-2";

// The CENTER zone's outer wrapper is authoritative for POSITIONING and
// never shifts. Επικοινωνία/Europcar override the grid's default
// `stretch` item alignment to `justify-self-center` so the OUTER WRAPPER
// itself — not just the abstract grid cell, which was already correctly
// positioned — visibly centers on the zone's true axis. Kinsen (ROW 4)
// already centers correctly via its own `flex justify-center` once its
// `shrink-0` fix (see the `<Image>` below) is in place, so it needs no
// matching override here.
const CENTER_ZONE_LOCK = "[@media(orientation:landscape)]:justify-self-center lg:justify-self-center";

// Επικοινωνία's label is left-aligned (its wrapper's default, same as
// every other column — no `text-center` override), so it sits flush with
// the wrapper's own left edge — exactly where the address/email/phone
// content below it also starts, since that content is left-aligned within
// the same wrapper. The two are siblings sharing one wrapper, so this
// match holds regardless of the wrapper's own width or position.
//
// Europcar, unlike the label, isn't a sibling of that content — it's a
// separate anchor in ROW 3, on its own row's identical (but structurally
// independent) three-zone grid. Both rows use the same `grid-cols-3`
// track proportions, so the CENTER track itself already lines up
// perfectly across rows — the two elements just used two different
// alignment RULES within that shared track (one content-fit, one
// independently content-fit at a different natural width), which is what
// made them land at two different X positions.
//
// CONTACT_RAIL_WIDTH replaces that mismatch with one shared rule: an
// explicit width (rounded up from the contact block's own measured
// content-fit width, so nothing that already fits can start wrapping),
// applied to BOTH the Επικοινωνία wrapper and Europcar's own item,
// `justify-self-center`d on the same-proportioned CENTER track in their
// respective rows, with left-aligned content inside. Same width + same
// alignment rule + same track ⇒ the same X by construction, not by a
// value tuned to compensate for a mismatch after the fact. Split at the
// same `max-width:1023px`/`lg:` boundary ZONE_GRID_GAP_X already uses (no
// overlap: `lg` is `min-width:1024px`) since the contact block's own
// natural width already differs slightly between those two font-size
// tiers.
const CONTACT_RAIL_WIDTH =
  "[@media(orientation:landscape)_and_(max-width:1023px)]:w-[176px] lg:w-[186px]";

// Portrait-only vertical rhythm. Each of the five Footer rows below is its
// own separate `<div>` in normal document flow (not one shared grid), so
// with no override the whitespace between any two rows is simply that
// row's own `pb-*` plus the next row's own `pt-*` — values originally
// tuned to separate visually-distinct *horizontal bands* on desktop, not
// to read as a coherent single-column stack. Stacked in portrait, those
// same values summed to 64-96px between sections while each row's own
// *internal* stacking gap (`gap-10`, used when its own grid falls back to
// `grid-cols-1`) was only 40px — an inconsistent hierarchy, not a
// deliberate one. This introduces exactly two portrait-only levels
// instead: SECTION (32px total, split evenly as 16px+16px across the two
// adjacent rows) for one Footer section flowing into the next, and MAJOR
// (48px total, 24px+24px) for the two transitions the content itself
// calls for a bigger break at — top CTA/navigation area → corporate
// information area, and partners → the Kinsen brand signature. Bounded to
// `max-width:1023px` (the same cutoff `ZONE_GRID_GAP_X` already uses) so
// it never touches a `1024px`-and-up window where `lg:` already switches
// that row back to the horizontal three-zone layout regardless of
// orientation — this rhythm only ever applies to a genuinely single-
// column, stacked row. Two levels only, reused across every row boundary
// below, rather than every section getting its own independently-tuned
// number.
const PORTRAIT_SECTION_PT = "[@media(orientation:portrait)_and_(max-width:1023px)]:pt-4";
const PORTRAIT_SECTION_PB = "[@media(orientation:portrait)_and_(max-width:1023px)]:pb-4";
const PORTRAIT_MAJOR_PT = "[@media(orientation:portrait)_and_(max-width:1023px)]:pt-6";
const PORTRAIT_MAJOR_PB = "[@media(orientation:portrait)_and_(max-width:1023px)]:pb-6";
// The same rhythm applied to each row's own *internal* stacking gap
// (Ε.g. ROW 1's CTA block/Πλοήγηση block, ROW 2's Εταιρεία/Επικοινωνία/
// Βρείτε μας) — 32px, matching SECTION above, so a row's internal
// sub-sections and the boundary to the next row read as one consistent
// scale rather than two different tuned values.
const PORTRAIT_SECTION_GAP = "[@media(orientation:portrait)_and_(max-width:1023px)]:gap-8";

// Portrait alignment, in two bounded tiers rather than one blanket rule.
// ROW 2 (Εταιρεία/Επικοινωνία/Βρείτε μας) and ROW 5 (copyright/legal)
// already carry an unconditional `text-center` base (overridden only by
// `[@media(orientation:landscape)]:text-left`/`lg:text-left`) — centered
// at every portrait width, always, not something this pass changes. ROW 3
// (partners) and ROW 4 (Kinsen) are unconditionally centered in portrait
// too, via their own `justify-center`/`flex justify-center`, for the same
// reason. ROW 1 (CTA/Πλοήγηση) is the one row with no such base — it's
// plain left-aligned block text with no text-align class at all — so on
// its own it stayed left in every portrait width while every row below it
// was already centered, reading as two different compositions stacked
// together instead of one.
//
// PORTRAIT_CENTERED_TOP_AREA fixes that, but only up to 820px width in
// portrait (phones through a large phone/small-tablet band, sized to
// match an iPad Air's own 820px portrait width) — centering ROW 1 so it
// joins the rest of the Footer's already-centered composition there. Wider
// portrait tablets (821-1023px) get no override here, so ROW 1 simply
// falls through to its existing plain-left default, unchanged — the
// pre-existing portrait vertical-flow behavior this file already had
// before this pass, left alone above the 820px cutoff. `max-width:820px`
// (not the `1023px` cutoff every other portrait rule in this file uses)
// is a deliberate, narrower band — a second, independent tier nested
// inside the first, not a replacement for it.
const PORTRAIT_CENTERED_TOP_AREA = "[@media(orientation:portrait)_and_(max-width:820px)]:text-center";

// `text-center` on the ROW 1 container above only centers a block's own
// INLINE content — it does nothing to reposition the block's own box
// within a wider available column. The CTA heading and paragraph are both
// capped at `max-w-lg` (512px) with no auto margins, so at this tier's
// wider end (768-820px, where the available column is noticeably wider
// than 512px) they still render flush-left as a *box*, with only the text
// inside that mis-positioned box centering — measured 104-130px off the
// true viewport center, a real, visible left skew, not just an unmet
// pixel-perfect tolerance. `mx-auto` on these two elements specifically
// (same bound, so it's a no-op everywhere `max-w-lg` isn't the binding
// constraint — landscape/desktop/the wider portrait tier all leave these
// boxes at their full, uncapped column width already) re-centers the
// capped box itself, matching every other element `text-center` already
// handles correctly on its own.
const PORTRAIT_CENTERED_MAX_W_BLOCK = "[@media(orientation:portrait)_and_(max-width:820px)]:mx-auto";

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className={MIDDLE_LABEL_CLASS}>{title}</p>
      {/* Full white, no hover color shift — `text-sm sm:text-[15px]
          lg:text-base` (14/15/16px) gives this "key content" tier a touch
          more substance relative to the label above it at every
          breakpoint, matching the top-right nav links' own scale. No
          horizontal inset (an earlier `pl-2` nudge relative to the
          heading above was removed): both now share the exact same left
          edge, and the hierarchy between them reads through the label's
          size/weight/tracking and the `mb-3` gap above instead. */}
      <ul className="space-y-2.5 text-sm text-white sm:text-[15px] lg:text-base [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:space-y-1.5">
        {children}
      </ul>
    </div>
  );
}

export async function Footer() {
  const settings = await getSiteSettings();
  const year = new Date().getFullYear();
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;

  // Forces the address onto a deterministic, balanced 2-line shape at the
  // widths where ΕΠΙΚΟΙΝΩΝΙΑ's column is narrow (~277px, whenever ROW 2's
  // 3-zone grid is active — landscape/`lg`, the same condition
  // ZONE_GRID_COLS itself uses) instead of leaving it to natural wrapping,
  // which was breaking after the *second* comma and left "Αθήνα" alone on
  // a near-empty line (measured: 243px/47px, a 0.19 ratio). Splitting at
  // the *first* comma instead — "Λεωφόρος Αθηνών 71," / "Τ.Κ. 104 47,
  // Αθήνα" — measured 161px/129px (0.8) at every affected breakpoint. At
  // `lg`+/landscape widths this same 3-zone grid also has genuinely
  // narrower short-landscape-phone columns, so the fix applies there too.
  // Portrait/tablet-portrait's full-width stacked column already fits the
  // whole address on one line (confirmed: no wrap at all at 375–768px),
  // so the forced break stays inert there. Falls back to the whole string
  // un-split if the content is ever edited to no longer contain a comma,
  // matching the same defensive pattern already used for the Hero
  // subtitle split.
  const addressCommaIndex = settings.address.indexOf(", ");
  const addressLine1 = addressCommaIndex === -1 ? settings.address : settings.address.slice(0, addressCommaIndex + 1);
  const addressLine2 = addressCommaIndex === -1 ? null : settings.address.slice(addressCommaIndex + 2);

  return (
    // The top edge is a shallow clip-path dip (24px deep at its center,
    // flat again at both corners) replacing the previous hard straight
    // edge — a percentage-x / pixel-y polygon sampling a sine curve, so
    // it scales fluidly with the footer's width at every viewport
    // without needing per-breakpoint tuning (same technique as the
    // /login diagonal). The small pixel depth reveals a sliver of
    // whatever page content sits directly above the footer in that gap —
    // real footer content starts at `pt-12` below, well clear of the curve.
    // No separate top border/accent is layered on top of it; the curve
    // itself is the entire boundary treatment now.
    <footer
      // Non-visual observation target for the floating comparison
      // launcher's footer-aware auto-hide (see vehicle-comparison-tray.tsx's
      // useFooterVisible) — a stable, purpose-named selector rather than
      // reaching for the bare `<footer>` tag (which could collide with a
      // future nested `<footer>` elsewhere) or a CSS class (which could
      // change with a restyle). Carries no styling of its own.
      data-site-footer=""
      className="relative overflow-hidden bg-gradient-to-b from-footer via-[#031f30] to-[#00121e] text-white"
      style={{
        clipPath:
          "polygon(0% 0px, 5% 4px, 10% 7px, 15% 11px, 20% 14px, 25% 17px, 30% 19px, 35% 21px, 40% 23px, 45% 24px, 50% 24px, 55% 24px, 60% 23px, 65% 21px, 70% 19px, 75% 17px, 80% 14px, 85% 11px, 90% 7px, 95% 4px, 100% 0px, 100% 100%, 0% 100%)",
      }}
    >
      {/* ROW 1 — premium top area: heading + supporting copy + the one real
          vehicles CTA, on the SAME ZONE_GRID_COLS/ZONE_GRID_GAP_X
          three-zone grid every other row below uses (not a `flex
          justify-between` approximation of it) — this is the real shared
          layout architecture, not a visual imitation of one. The CTA
          block spans the LEFT+CENTER zones (`col-span-2`, starting at the
          implicit column 1) rather than being confined to a single ~277px
          third: its own `max-w-lg` heading is what actually caps its
          rendered width (~512px, comfortably inside the two-zone span),
          so the CENTER zone still reads as empty in practice — nothing
          else occupies it, and the CTA's own text never reaches that far.
          "Πλοήγηση" (financing/warranty/compare) is placed explicitly at
          `col-start-3`, the RIGHT zone, landing it on the exact same X
          axis as ΒΡΕΙΤΕ ΜΑΣ/Saracakis Leasing in the rows below. Both
          placement classes are gated to landscape/`lg` only (never applied
          unconditionally) — an explicit `col-start`/`col-span` past the
          grid's current track count makes CSS Grid fabricate an *implicit*
          extra column to satisfy it, which would silently widen the
          portrait `grid-cols-1` fallback and risk horizontal overflow on
          phones; gating means they're inert until `grid-cols-3` is
          actually active. Grid only from any landscape orientation/`lg`
          up; below that it collapses into a single vertical flow. No
          divider/border marks the boundary with ROW 2 below — the
          `pb-10 sm:pb-12` gap is deliberately generous to read as a
          section break through spacing alone. */}
      {/* `[@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pt-8`/`:pb-6`
          below is the "short landscape phone" density tier — self-bounded
          by its own `max-height:500px`, so it can only ever match short
          landscape viewports (568-956px-wide phones in the test matrix)
          and never a tall tablet/desktop window, meaning it's safe to
          leave unbounded on width and let it freely override `sm:`/`lg:`
          padding there. `pt-8` (was `pt-6`, +8px) is a micro-polish: the
          first content row sat slightly too close to the curved top edge
          on real landscape phones — this nudges only that top gap, not the
          matching `pb-6` below it, not the CTA/Πλοήγηση relationship, and
          not any other spacing tier in the footer. This is written as a
          complete literal string everywhere in this file (never a JS
          constant fragment-interpolated into a template literal) — the
          Hero component hit a real bug where `` `${SOME_CONST}:utility` ``
          compiled fine but silently generated zero CSS, because Tailwind's
          content scanner is a static text search that never executes
          JavaScript. */}
      <div
        className={`relative container-page pt-12 pb-10 sm:pt-14 sm:pb-12 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pt-8 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pb-6 ${PORTRAIT_MAJOR_PB}`}
      >
        <div
          className={`${RAIL_CLASS} grid items-start gap-10 ${ZONE_GRID_COLS} ${ZONE_GRID_GAP_X} ${PORTRAIT_SECTION_GAP} ${PORTRAIT_CENTERED_TOP_AREA}`}
        >
          <div className={`[@media(orientation:landscape)]:col-span-2 lg:col-span-2 ${LEFT_ZONE_OPEN}`}>
            {/* Line breaks are forced (not left to fluid wrapping) from `sm`
                up so "ταιριάζει" reliably lands alone on its own third
                line at every desktop/tablet width. Below `sm` the first
                break is dropped and that stretch wraps naturally instead —
                forcing the full 3-line shape at true phone widths risked
                the first line overflowing a ~340px content column at this
                font size. `max-w-lg` (not `-md`) is the narrowest width
                that still fits "...οχήματα και" on one line at every font
                size this heading uses, including the `lg:text-3xl` jump
                right at the `lg` breakpoint. `xl:text-[2rem]` adds one more
                restrained step so the heading still reads with full
                presence at 1440-1920 rather than looking proportionally
                small against the extra available width there. The
                trailing `[@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:`
                pair is the short-landscape-phone density tier: a
                844×390-class viewport is wide enough for `sm:text-[1.75rem]`
                to already be active by width alone, but only 390px tall —
                self-bounded by `max-height:500px`, so it only ever
                engages on genuinely short landscape phones, never a
                tablet/desktop window, and safely wins there regardless of
                which width-tier would otherwise apply. */}
            <h2
              className={`max-w-lg text-2xl leading-tight font-bold text-white sm:text-[1.75rem] lg:text-3xl xl:text-[2rem] [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:text-xl [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:leading-[1.15] ${PORTRAIT_CENTERED_MAX_W_BLOCK}`}
            >
              Δείτε τα διαθέσιμα οχήματα και
              <br className="hidden sm:block" /> ξεκινήστε από αυτό που σας
              <br /> ταιριάζει
            </h2>
            {/* Full white (not the previous white/60) — smaller size and
                normal weight against the bold heading above and semibold
                CTA below are what read as "secondary" now, not dimness.
                Short-landscape-phone gets a touch more compaction (both
                text size and top margin) for the same reason as the
                heading above.
                Two independent forced-break mechanisms live in this same
                paragraph now, gated to different, non-overlapping ranges:
                (1) the outer two `<br>`s are `hidden` everywhere except
                the short-landscape-phone tier (same visibility-toggle
                pattern already used on the `<h2>` above, e.g.
                `hidden sm:block`) — only at short-landscape widths
                (844-956px in the test matrix) does natural wrapping alone
                produce a lopsided two-line shape; forcing breaks at the
                sentence's own natural pause points — the dash, then the
                second clause — gives an intentionally balanced 3-line
                block instead. (2) The middle `<br>` (between "Kinsen" and
                "είναι") targets the *other* problem case: at every width
                where this paragraph reaches its `max-w-lg` (512px) cap
                (sm:+ and up — tablet-portrait, tablet-landscape, desktop)
                natural wrapping alone breaks after "διάθεσή σας",
                producing a 506px/260px split (measured) — a long first
                line, a short second one. Forcing the break one clause
                earlier instead — after "Kinsen", the natural subject/verb
                boundary — measured 436px/330px, the most balanced of every
                candidate break point tested. Gated to `sm:block` so it's
                inert below 640px (portrait phones already wrap evenly
                there without any forced break: 335px/335px at 375px,
                381px/288px at 430px — confirmed close enough to leave
                alone) and `[@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:hidden`
                so it never fires inside the short-landscape-phone tier,
                which already gets its own separate 3-line treatment from
                mechanism (1) above and would otherwise show a 4th,
                conflicting break. Neither mechanism touches font size,
                line-height, max-width or any other property. No
                horizontal inset (an earlier `pl-1` nudge was removed): the
                heading and this paragraph share the exact same left edge,
                reading as one clear column — hierarchy between them comes
                from size/weight and the `mt-3` gap instead of a sideways
                shift. */}
            <p
              className={`mt-3 max-w-lg text-sm font-normal text-white sm:text-base [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:mt-2 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:text-xs ${PORTRAIT_CENTERED_MAX_W_BLOCK}`}
            >
              Επιλέξτε όχημα και τρόπο απόκτησης -
              <br className="hidden [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:block" /> η ομάδα της Kinsen
              <br className="hidden sm:block [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:hidden" /> είναι στη διάθεσή σας
              <br className="hidden [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:block" /> για κάθε πληροφορία.
            </p>
            {/* The one required non-button CTA: a real link styled as an
                elegant white underlined text treatment — deliberately no
                button chrome, no accent/cyan, and no hover color shift
                (full-strength white in every state — default, hover, focus
                and active — with zero opacity/color shift). No trailing
                arrow icon (removed at the user's request — a plain
                underlined text link, nothing else). Short-landscape-phone
                only tightens the top margin (the height-consuming part) —
                the text itself stays fully visible and legible. */}
            <Link
              href="/vehicles"
              className="group mt-6 inline-flex w-fit items-center gap-2 rounded-sm text-base font-semibold text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-footer focus-visible:outline-none sm:text-lg xl:text-xl [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:mt-3"
            >
              <span className="relative pb-0.5">
                Δείτε τα οχήματα
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-0 h-px bg-white" />
              </span>
            </Link>
          </div>

          <div className={`[@media(orientation:landscape)]:col-start-3 [@media(orientation:landscape)]:pt-1 lg:col-start-3 lg:pt-1 ${RIGHT_ZONE_OPEN}`}>
            <p className={`${SECTION_LABEL_CLASS} mb-4 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:mb-2`}>
              Πλοήγηση
            </p>
            {/* No `divide-y`/border rows anymore — the list relies on its
                own `space-y-1` plus each row's padding for rhythm instead
                of a visible rule between items. font-semibold (up from
                font-medium) gives these "key destination" links more
                presence next to the now-larger, now-white label above,
                without growing past the main CTA's own size/weight —
                `text-sm sm:text-[15px] lg:text-base` keeps that same
                relationship true at every breakpoint. Short-landscape-phone
                tightens row padding only. No horizontal inset (an earlier
                `pl-2` nudge was removed): the "Πλοήγηση" heading and this
                list now share the exact same left edge, cueing "these
                items belong under this heading" through the `mb-4` gap
                and the label's own weight/tracking instead of a sideways
                shift. No right-side arrow anymore (removed for a cleaner,
                less decorative treatment) — `justify-between`/`gap-4`,
                which existed only to push that arrow to the row's far
                right, were dropped along with it since a single text
                child has nothing left to justify between. */}
            <nav aria-label="Πλοήγηση">
              <ul className="space-y-1">
                {QUICK_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`block rounded-sm py-2.5 text-sm font-semibold text-white underline-offset-4 sm:text-[15px] lg:text-base [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:py-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:underline`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>

      {/* ROW 2 — company + contact + "Βρείτε μας", sharing the same
          RAIL_CLASS/ZONE_GRID_COLS/ZONE_GRID_GAP_X rail and three-zone
          grid as ROW 3 below (and the same RAIL_CLASS width as every
          other row), so its three columns land close together, inside
          the same generous outer gutters as the rest of the Footer.
          Single column below `lg`/landscape (a 3-way split felt cramped
          on real tablet-portrait widths). No divider marks this band's
          edges either — spacing is the only separator now, matching
          ROW 1. Top padding (`pt-10 sm:pt-12`, unchanged from the old
          symmetric `py-10 sm:py-12`) keeps the gap from ROW 1 exactly as
          it was; only the bottom (`pb-9 sm:pb-11`, one Tailwind step
          tighter) was nudged, together with ROW 3's own top padding
          below, to pull the partner row slightly closer to this band
          without touching spacing anywhere else. Short-landscape-phone
          density tier tightens both, same self-bounded reasoning as
          ROW 1. */}
      <div
        className={`relative container-page pt-10 pb-9 sm:pt-12 sm:pb-11 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pt-5 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pb-5 ${PORTRAIT_MAJOR_PT} ${PORTRAIT_SECTION_PB}`}
      >
        <div
          className={`${RAIL_CLASS} grid gap-10 text-center [@media(orientation:landscape)]:text-left lg:text-left ${ZONE_GRID_COLS} ${ZONE_GRID_GAP_X} ${PORTRAIT_SECTION_GAP}`}
        >
          <FooterColumn title="Εταιρεία" className={LEFT_ZONE_OPEN}>
            {COMPANY_LINKS.map((link) =>
              link.external ? (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-sm underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:underline`}
                  >
                    {link.label}
                  </a>
                </li>
              ) : (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`rounded-sm underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:underline`}
                  >
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </FooterColumn>

          <FooterColumn title="Επικοινωνία" className={`${CENTER_ZONE_LOCK} ${CONTACT_RAIL_WIDTH}`}>
            <li>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-sm underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:underline`}
              >
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {/* The forced break lives inside its own `<span>` (not as
                    a direct flex-item sibling of the icon above) so it
                    behaves as a normal inline line break within that
                    span's own text flow, rather than as an independent
                    flex item that a `<br>` can't meaningfully break
                    against inside an `inline-flex` container. */}
                <span>
                  {addressLine1}
                  {addressLine2 && (
                    <>
                      <br className="hidden [@media(orientation:landscape)]:block lg:block" /> {addressLine2}
                    </>
                  )}
                </span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${settings.contactEmail}`}
                className={`inline-flex items-center gap-2 rounded-sm underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:underline`}
              >
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                {settings.contactEmail}
              </a>
            </li>
            <li>
              <a
                href={`tel:${settings.contactPhone.replace(/\s+/g, "")}`}
                className={`inline-flex items-center gap-2 rounded-sm underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:underline`}
              >
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                {settings.contactPhone}
              </a>
            </li>
          </FooterColumn>

          <div className={RIGHT_ZONE_OPEN}>
            <p className={MIDDLE_LABEL_CLASS}>Βρείτε μας</p>
            {/* Icon-only row — completely stable, no hover animation of any
                kind (no opacity dip, no color shift, no scale/translate/
                glow/rotation). Full white in every state — default, hover,
                focus, active — via `currentColor` baked into each SVG
                file; `focus-visible` still gets a visible ring for keyboard
                users, but the icon itself never changes. Each icon is
                decorative (`aria-hidden` baked into the SVG markup itself)
                — the real accessible name lives on the anchor's
                `aria-label`, and the generous `p-2.5` padding keeps the
                actual tap target well above the visual icon size without
                making the glyphs themselves look oversized. A fixed
                `h-5 w-5 lg:h-6 lg:w-6` wrapper plus `[&>svg]:h-full
                [&>svg]:w-full` normalizes optical size across the four
                source files (whose original viewBoxes/shapes differ
                slightly) and gives the row one restrained size step at
                `lg` so it stays in visual balance with the rest of this
                column's now-larger type. `[@media(orientation:landscape)]:justify-start`
                sets the same value `lg:justify-start` already sets (safe
                unbounded). `gap-4` is a single unconditional value now, so
                the short-landscape-phone override that used to drop it to
                that same value was removed as redundant.
                `flex-wrap` is still a deliberate safety net, not a design
                choice — at the narrowest landscape-phone widths (roughly
                568-715px) this column's own share of the grid isn't quite
                wide enough for all four icons in one unwrapped row, and
                without `flex-wrap` they silently overflowed *this* column
                and got clipped by the `<footer>` element's own
                `overflow-hidden` (used for the decorative top edge) —
                invisible to a `document.documentElement.scrollWidth`
                check since it never reached page level, only caught by
                actually rendering and inspecting each icon's bounding
                box. Wrapping keeps every icon fully visible and at its
                full tap size instead of shrinking them to force one line;
                it only engages at the handful of widths that need it;
                every wider viewport still renders a single row. No
                horizontal inset (an earlier `pl-2` nudge was removed):
                this icon row now shares the exact same left edge as the
                "Βρείτε μας" heading above it, matching the other two
                columns in this band (see `FooterColumn` above). */}
            <ul className="flex flex-wrap items-center justify-center gap-4 [@media(orientation:landscape)]:justify-start lg:justify-start">
              {SOCIAL_ICON_LINKS(settings).map(({ label, href, slug }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="block rounded-sm p-2.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-footer"
                  >
                    <span
                      className="block h-5 w-5 [&>svg]:h-full [&>svg]:w-full lg:h-6 lg:w-6"
                      dangerouslySetInnerHTML={{ __html: SOCIAL_ICON_MARKUP[slug] }}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ROW 3 — remaining corporate brand row (Goldcar/Europcar/Saracakis
          Leasing, in that order — see PARTNER_LINKS above). From any
          landscape orientation/`lg` up this switches to the same
          RAIL_CLASS/ZONE_GRID_COLS/ZONE_GRID_GAP_X rail and three-zone
          grid as ROW 2 above, so each name aligns under its matching zone
          (Goldcar under Εταιρεία, Europcar under Επικοινωνία, Saracakis
          Leasing under Βρείτε μας) instead of remaining a small,
          disconnected centered cluster — `justify-items-start` keeps each
          name flush with its column's left edge rather than stretched
          toward the zone's own edges. Below that (portrait/tablet-
          portrait) it keeps its original centered `flex flex-wrap` row
          unchanged. Facebook/Instagram/LinkedIn used to scramble-hover
          here too; they've moved up into "Βρείτε μας" above, so this row
          is partners-only now — no duplicated social links left below.
          Kept on its own scramble hover treatment since it's not a
          "social" link and wasn't in scope for the animation-removal
          requirement. Full white (not white/70): this tier is still
          visually the quietest in the footer, but that now comes purely
          from being the smallest text size (`text-[11px] sm:text-xs
          lg:text-[13px]`) plus the mono/tracked treatment, never from
          reduced opacity — and with no color to shift, the hover class was
          dropped entirely rather than left as a white-to-white no-op. Top
          padding (`pt-7`, one step tighter than the old symmetric `py-8`)
          is the other half of the ROW 2/3 gap reduction above; bottom
          padding (`pb-8`) stays exactly as it was, so the gap to the legal
          row below is untouched. Short-landscape-phone tightens both, same
          self-bounded reasoning as every other density override in this
          file. */}
      <div
        className={`relative container-page pt-7 pb-8 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pt-4 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pb-5 ${PORTRAIT_SECTION_PT} ${PORTRAIT_MAJOR_PB}`}
      >
        <div
          className={`${RAIL_CLASS} flex flex-wrap items-center justify-center gap-x-12 gap-y-3 [@media(orientation:landscape)]:grid [@media(orientation:landscape)]:justify-items-start lg:grid lg:justify-items-start ${ZONE_GRID_COLS} ${ZONE_GRID_GAP_X}`}
        >
          {PARTNER_LINKS.map((link) => (
            <ScrambleLink
              key={link.label}
              text={link.label.toUpperCase()}
              ariaLabel={link.label}
              href={link.href}
              external
              className={`font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white sm:text-xs lg:text-[13px] ${
                link.label === "Goldcar"
                  ? LEFT_ZONE_OPEN
                  : link.label === "Europcar"
                    ? `${CENTER_ZONE_LOCK} ${CONTACT_RAIL_WIDTH} text-left`
                    : RIGHT_ZONE_OPEN
              }`}
            />
          ))}
        </div>
      </div>

      {/* ROW 4 — purely decorative brand mark, the real Kinsen logo (same
          asset used in the transactional emails, see logoUrl() in
          lead-notification.service.ts). On the SAME ZONE_GRID_COLS grid as
          every other row — the logo's wrapper is placed explicitly at
          `col-start-2`, the actual CENTER grid cell, not just visually
          centered via a bare full-width `justify-center` — so it shares
          the real CENTER-zone column, not just a coincidentally-matching
          page-center, with ROW 2's Επικοινωνία and ROW 3's Europcar above
          it. The inner `flex justify-center` then centers the artwork
          *within* that column (the column itself stretches to its full
          ~277px share, and without `justify-center` the logo would hug
          the column's left edge instead of sitting centered in it).
          `max-w-none shrink-0` on the `<Image>` itself is required, not
          optional — a real, previously-undetected size regression
          (verified: computed width was 277.33px against an intended
          320px at 1920px, a ~13% reduction) introduced when the logo was
          first wrapped in this grid cell. The actual cause is Tailwind's
          own preflight base style (`img { max-width: 100% }`, normally
          desirable so images never overflow their box) — for a *flex
          child*, a percentage `max-width` resolves against the flex
          container's own content box, which here is the ~277px stretched
          grid cell, so it silently capped the artwork below its intended
          `clamp()` width at every size where that column is narrower than
          20rem. `max-w-none` removes that cap so the explicit
          `w-[clamp(...)]` value actually governs; `shrink-0` additionally
          guards against the (unrelated but adjacent) flex `flex-shrink:1`
          default ever re-squeezing it. With both, the artwork renders at
          its true intended size and overflows its column symmetrically
          when needed (safe: the zone gap comfortably absorbs it at every
          tested width, and `justify-center` still
          centers the oversized box exactly on the column's own center,
          which is what ROW 2/3's CENTER-zone alignment fix above this
          div depends on). Grid only
          from any landscape orientation/`lg` up (`col-start-2` is gated
          the same way as ROW 1's placements, for the same
          implicit-extra-column reason); below that, with no placement
          class active, the single child falls back to the portrait
          `grid-cols-1` track and the inner `justify-center` centers it
          across the full rail width instead, matching the previous
          (pre-grid) portrait behavior exactly. `clamp()` scales the
          artwork continuously between a mobile floor and a desktop
          ceiling rather than jumping at fixed breakpoints. aria-hidden +
          pointer-events-none since it carries no information and must
          never intercept a click meant for real content. `pt-6 sm:pt-7`
          gives this row its own lead-in gap now that the legal row
          (ROW 5) sits below it instead of above it, restoring the same
          ~50-60px band-to-band rhythm used everywhere else in the Footer.
          Bottom padding is intentionally smaller (`pb-3 sm:pb-4`) — ROW 5
          directly below supplies its own top padding too, and the goal is
          a compact, intentional close, not a large gap before the final
          row. Short-landscape-phone tightens both the same self-bounded
          way as every other density override in this file. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none relative pt-6 pb-3 sm:pt-7 sm:pb-4 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pt-3 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pb-2 ${PORTRAIT_MAJOR_PT} ${PORTRAIT_SECTION_PB}`}
      >
        <div className={`${RAIL_CLASS} grid select-none ${ZONE_GRID_COLS} ${ZONE_GRID_GAP_X}`}>
          <div className="flex justify-center [@media(orientation:landscape)]:col-start-2 lg:col-start-2">
            <Image
              src="/images/kinsen_logowhite.png"
              alt=""
              width={3000}
              height={701}
              className="h-auto w-[clamp(9rem,32vw,20rem)] max-w-none shrink-0 opacity-90"
            />
          </div>
        </div>
      </div>

      {/* ROW 5 — the true final Footer row: copyright in the LEFT zone
          (default placement — the first grid item), legal/cookie links in
          the RIGHT zone, an intentionally empty CENTER between them —
          visually echoing ROW 1's "CTA | empty | Πλοήγηση" structure at
          the opposite end of the Footer, and on the exact same
          ZONE_GRID_COLS/ZONE_GRID_GAP_X grid every other row uses (not a
          `flex justify-between` approximation of it). The legal `<ul>`
          mirrors ROW 1's own CTA treatment exactly, reflected: CTA spans
          LEFT+CENTER (`col-span-2`, starting at the implicit column 1) and
          is left-anchored by ordinary block flow; this `<ul>` spans
          CENTER+RIGHT (`col-start-2 col-span-2`) and is right-anchored via
          `justify-self-end` — sized to its own two-link content width
          rather than stretched to fill the double-wide span, so it lands
          flush with the RIGHT zone's own right edge (verified: a version
          confined to a single `col-start-3` column stretched the `<ul>` to
          only ~277px, too narrow for "Πολιτική Προστασίας Δεδομένων" +
          "Ρυθμίσεις Cookies" side by side, so it silently wrapped to two
          lines and grew the Footer's height at every desktop width — this
          span+anchor approach gives it the room it actually needs while
          still terminating exactly at the RIGHT zone's boundary, the same
          "empty in practice, not empty by construction" reasoning as the
          CTA block above). Both placement classes are gated to
          landscape/`lg` for the same implicit-extra-column reason as every
          other explicit placement in this file. Text-align follows the
          same `text-center` → landscape/`lg` `text-left` pattern as
          ROW 2/3. Full white (not white/40 and white/60): the quietest
          tier in the footer, but that comes via its own
          smallest-in-the-footer responsive size (`text-[11px] sm:text-xs
          lg:text-[13px]`) rather than opacity. Already full white in every
          state, so no hover color class is needed — `hover:underline`
          alone is enough interaction feedback. Short-landscape-phone
          tightens vertical padding only. Top padding only needed a slight
          trim (`pt-4` vs. the original symmetric `py-6`, bottom untouched)
          since ROW 4 above supplies its own matching lead-in gap. */}
      <div
        className={`relative container-page pt-4 pb-6 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pt-3 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:pb-4 ${PORTRAIT_SECTION_PT}`}
      >
        <div
          className={`${RAIL_CLASS} grid items-center gap-3 text-center [@media(orientation:landscape)]:text-left lg:text-left ${ZONE_GRID_COLS} ${ZONE_GRID_GAP_X}`}
        >
          <p className={`text-[11px] text-white sm:text-xs lg:text-[13px] ${LEFT_ZONE_OPEN}`}>© {year} Kinsen Hellas. All rights reserved.</p>
          <ul
            className={`flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-[11px] text-white sm:text-xs [@media(orientation:landscape)]:col-start-2 [@media(orientation:landscape)]:col-span-2 [@media(orientation:landscape)]:justify-self-end lg:col-start-2 lg:col-span-2 lg:justify-self-end lg:text-[13px] ${RIGHT_ZONE_OPEN}`}
          >
            <li>
              <Link href="/privacy-policy" className="hover:underline">
                Πολιτική Προστασίας Δεδομένων
              </Link>
            </li>
            <li>
              <CookieSettingsButton className="hover:underline" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
