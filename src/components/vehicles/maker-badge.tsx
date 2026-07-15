"use client";

import { cn } from "@/lib/utils";

// Every known maker's logo lives at /public/images/brands/<slug>.svg —
// small, current-era official marks sourced individually from Wikimedia
// Commons (each file's own source URL is documented in the commit that
// added it). A maker absent from this map (e.g. a brand-new CarStock import
// not yet added here) still renders correctly via the deterministic-initials
// fallback in MakerBadge below — never a broken image, never a blank badge,
// and zero frontend code changes are required for it to appear at all (see
// filter-option-metadata.ts for the same "never hide an unmapped value"
// contract applied to fuel/transmission/vehicle-type).
const MAKER_LOGO_MAP: Record<string, string> = {
  audi: "/images/brands/audi.svg",
  bmw: "/images/brands/bmw.svg",
  citroen: "/images/brands/citroen.svg",
  dacia: "/images/brands/dacia.svg",
  fiat: "/images/brands/fiat.svg",
  ford: "/images/brands/ford.svg",
  honda: "/images/brands/honda.svg",
  hyundai: "/images/brands/hyundai.svg",
  kia: "/images/brands/kia.svg",
  mazda: "/images/brands/mazda.svg",
  "mercedes-benz": "/images/brands/mercedes-benz.svg",
  mercedes: "/images/brands/mercedes-benz.svg",
  nissan: "/images/brands/nissan.svg",
  opel: "/images/brands/opel.svg",
  peugeot: "/images/brands/peugeot.svg",
  renault: "/images/brands/renault.svg",
  seat: "/images/brands/seat.svg",
  skoda: "/images/brands/skoda.svg",
  toyota: "/images/brands/toyota.svg",
  volkswagen: "/images/brands/volkswagen.svg",
  vw: "/images/brands/volkswagen.svg",
  volvo: "/images/brands/volvo.svg",
};

// Diacritic/case-insensitive lookup key — "Citroën" -> "citroen", matching
// the same normalization approach already used for the maker search box
// (see normalizeForSearch in vehicle-filters.tsx).
function normalizeMakerKey(maker: string): string {
  return maker
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveMakerLogo(maker: string): string | null {
  return MAKER_LOGO_MAP[normalizeMakerKey(maker)] ?? null;
}

// A small fixed palette drawn from the site's own brand colors
// (tailwind.config.ts) rather than an arbitrary/neon hash color, so an
// unmapped maker's badge still reads as native to the rest of the UI.
const FALLBACK_PALETTE = ["#023859", "#00899a", "#22577A", "#2ea9ac", "#0b2239", "#007c91"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function makerInitials(maker: string): string {
  const [first, second] = maker.trim().split(/\s+/).filter(Boolean);
  if (!first) return "?";
  if (!second) return first.slice(0, 3).toUpperCase();
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}

interface MakerBadgeProps {
  maker: string;
  size?: number;
  className?: string;
}

// Renders the maker's real logo when known; otherwise a deterministic
// initials badge in a fixed brand-color palette. Same footprint either way,
// so the filter list never jumps/reflows as real logos get added for more
// makers over time.
export function MakerBadge({ maker, size = 26, className }: MakerBadgeProps) {
  const logoSrc = resolveMakerLogo(maker);

  if (logoSrc) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-white p-1 shadow-sm",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* Local, static, pre-optimized SVGs — a plain img avoids next/image's
            SVG restrictions and loader overhead for a ~1-20KB icon. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" aria-hidden="true" className="h-full w-full object-contain" />
      </span>
    );
  }

  const initials = makerInitials(maker);
  const color = FALLBACK_PALETTE[hashString(maker) % FALLBACK_PALETTE.length];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
