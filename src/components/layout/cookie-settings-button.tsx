"use client";

import { useCookieConsent } from "@/components/providers/cookie-consent-provider";

// The one narrowly-scoped client piece the (server) Footer needs — a plain
// button, never a navigation, so it must not be an <a>/Link.
export function CookieSettingsButton({ className }: { className?: string }) {
  const { openPreferences } = useCookieConsent();

  return (
    <button type="button" onClick={(event) => openPreferences(event.currentTarget)} className={className}>
      Ρυθμίσεις Cookies
    </button>
  );
}
