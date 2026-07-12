import Image from "next/image";

export type NavigationLoaderPhase = "entering" | "visible" | "exiting";

// The single visual navigation-loading overlay for the whole application.
// Only NavigationTransitionProvider renders this — it is not rendered by
// any route-level `loading.tsx` (those render NavigationFallbackSignal,
// which draws nothing). All visual styling lives in the scoped
// `.kinsen-navigation-loader*` rules in src/app/globals.css so there is one
// source of truth for the loader's CSS, not a parallel Tailwind config copy.
export function NavigationLoader({ phase }: { phase: NavigationLoaderPhase }) {
  return (
    <div
      className="kinsen-navigation-loader"
      data-state={phase}
      data-kinsen-navigation-loader="true"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sr-only">Φόρτωση της επόμενης σελίδας</span>

      <div className="kinsen-navigation-loader__content">
        {/* brandlogo.png's real intrinsic size is 1163x209 (h/w ≈ 0.1797,
            NOT the ~0.235 a casual guess would suggest) — width/height here
            must match that real ratio, since the CSS below only sets an
            explicit width with `height: auto`, letting the browser derive
            height from the loaded image's actual proportions. Getting this
            wrong doesn't crop or stretch the image, but it does make the
            logo render far shorter than intended, which reads as "missing"
            at these display sizes. */}
        <Image
          src="/images/brandlogo.png"
          alt=""
          width={230}
          height={41}
          priority
          // Matches the header logo's `sizes="128px"` exactly (both render
          // this same asset at ~128px on desktop) so next/image resolves to
          // the identical cached srcset URL instead of triggering a second,
          // separate network fetch for a differently-sized rendition — the
          // header has always already loaded by the time any client-side
          // navigation (and therefore this loader) can occur.
          sizes="128px"
          className="kinsen-navigation-loader__logo"
        />

        <div className="kinsen-navigation-loader__track" aria-hidden="true">
          <span className="kinsen-navigation-loader__bar" />
        </div>
      </div>
    </div>
  );
}
