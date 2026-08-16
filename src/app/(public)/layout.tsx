import { FavoritesProvider } from "@/components/providers/favorites-provider";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { VehicleComparisonProvider } from "@/components/providers/vehicle-comparison-provider";
import { PublicRealtimeProvider } from "@/components/providers/public-realtime-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CookieBanner } from "@/components/cookie-consent/cookie-banner";
import { CookiePreferencesModal } from "@/components/cookie-consent/cookie-preferences-modal";
import { ConsentScriptGate } from "@/components/cookie-consent/consent-script-gate";
import { VehicleComparisonTray } from "@/components/vehicles/vehicle-comparison-tray";

// Every public page reads live DB state (site settings, vehicle inventory,
// FAQ) or session-based UI (header login state), so static generation buys
// nothing here and would only serve stale content — render per-request.
export const dynamic = "force-dynamic";

// Scoped to the public site only (not /admin, an internal authenticated
// staff area with its own layout) — this is where the site's real
// visitor-facing cookies/behavior live. See reports/cookie_consent_audit.json.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <FavoritesProvider>
      <CookieConsentProvider>
        <VehicleComparisonProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            {/* Non-visual observation target for the floating comparison
                launcher's Footer-aware geometry (see vehicle-comparison-tray.tsx's
                useFooterAwareCompareState) — its ResizeObserver watches this
                element's rendered size so a same-route content-height change
                (e.g. a realtime-driven vehicle list update) that shifts the
                Footer's document position, without changing the Footer's own
                size or the route, still triggers a remeasurement. Carries no
                styling of its own. */}
            <main data-public-main="" className="flex-1">{children}</main>
            <Footer />
          </div>
          <CookieBanner />
          <CookiePreferencesModal />
          <ConsentScriptGate />
          <VehicleComparisonTray />
          <PublicRealtimeProvider />
        </VehicleComparisonProvider>
      </CookieConsentProvider>
    </FavoritesProvider>
  );
}
