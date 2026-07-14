"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCookieConsent } from "@/components/providers/cookie-consent-provider";

// Compact bottom banner — task section 3/7/8. Renders only once the client
// cookie read has resolved (never during SSR/first paint, so there is no
// server/client markup mismatch) and only when no valid consent exists yet.
//
// Stays mounted (never `return null`) while the preferences modal is open
// — only visually/interactively hidden via `invisible` (visibility:hidden,
// which also removes it from the Tab order natively). Real browser testing
// showed that unmounting it here destroyed the exact DOM node
// CookieConsentProvider's `lastTriggerRef` points to when the banner's own
// "Ρυθμίσεις cookies" button is what opened the modal — Escape would then
// try to focus a detached node and silently fail, landing on `<body>`
// instead. Radix's modal Dialog already marks this element `aria-hidden`
// for assistive tech while open, and its own overlay (z-50, above this
// banner's z-40) already covers it visually and blocks pointer events —
// nothing extra is needed to make it inert.
export function CookieBanner() {
  const { resolved, bannerVisible, preferencesOpen, acceptAll, rejectNonEssential, openPreferences } =
    useCookieConsent();

  if (!resolved || !bannerVisible) return null;

  return (
    <div
      role="region"
      aria-label="Ειδοποίηση για cookies"
      className={cn(
        "kinsen-cookie-banner fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] sm:px-4 sm:pb-4",
        preferencesOpen && "invisible",
      )}
    >
      <div className="mx-auto w-full max-w-3xl border border-border bg-white p-5 shadow-card sm:rounded-card sm:border sm:p-6">
        <h2 className="text-base font-bold text-primary">Η ιδιωτικότητά σας είναι σημαντική για εμάς</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Χρησιμοποιούμε αναγκαία cookies για τη σωστή λειτουργία του ιστοτόπου και, με τη συγκατάθεσή σας,
          προαιρετικά cookies για λειτουργίες, ανάλυση και βελτίωση της εμπειρίας σας.{" "}
          <Link
            href="/privacy-policy"
            className="font-semibold text-primary underline underline-offset-2 hover:text-accent"
          >
            Πολιτική Προστασίας Δεδομένων
          </Link>
        </p>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={rejectNonEssential} className="sm:order-1">
            Απόρριψη μη απαραίτητων
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => openPreferences(event.currentTarget)}
            className="sm:order-2"
          >
            Ρυθμίσεις cookies
          </Button>
          <Button type="button" variant="primary" onClick={acceptAll} className="sm:order-3">
            Αποδοχή όλων
          </Button>
        </div>
      </div>
    </div>
  );
}
