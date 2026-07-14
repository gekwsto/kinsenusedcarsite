import { FavoritesProvider } from "@/components/providers/favorites-provider";
import { CookieConsentProvider } from "@/components/providers/cookie-consent-provider";
import { VehicleComparisonProvider } from "@/components/providers/vehicle-comparison-provider";
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
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <CookieBanner />
          <CookiePreferencesModal />
          <ConsentScriptGate />
          <VehicleComparisonTray />
        </VehicleComparisonProvider>
      </CookieConsentProvider>
    </FavoritesProvider>
  );
}
