"use client";

import * as React from "react";
import { useCookieConsent } from "@/components/providers/cookie-consent-provider";
import { ENABLED_CONSENT_INTEGRATIONS } from "@/lib/consent-integrations";

/**
 * Consent-aware integration gate — task section 14/16.
 *
 * Rendering decisions come from two things only:
 *   1. ENABLED_CONSENT_INTEGRATIONS (src/lib/consent-integrations.ts) — the
 *      registry, which integrations actually exist and are enabled.
 *   2. hasConsent(integration.category) — the user's real, normalized,
 *      currently-active-policy consent for that integration's category.
 *
 * The registry itself only carries plain, serializable metadata (id,
 * category, cookies, ...) — no React components, no closures. The actual
 * loader implementation for a given integration id lives in
 * INTEGRATION_LOADERS below, kept deliberately separate so registry data
 * can safely cross Server/Client boundaries.
 *
 * reports/cookie_consent_audit.json found NO analytics or marketing
 * integration anywhere in this application, so ENABLED_CONSENT_INTEGRATIONS
 * is `[]` today and this component renders nothing — not a placeholder,
 * not a fake script, nothing.
 *
 * Adding a real integration later (see the worked example at the bottom of
 * consent-integrations.ts) requires exactly two edits: add the registry
 * entry, and add its id here, e.g.:
 *
 *   const INTEGRATION_LOADERS: Record<string, React.ComponentType> = {
 *     "google-analytics": GoogleAnalyticsLoader,
 *   };
 *
 * No change to this gate's own logic, to acceptAll(), or to the modal is
 * ever needed for a new integration under an already-supported category.
 */
const INTEGRATION_LOADERS: Record<string, React.ComponentType> = {};

export function ConsentScriptGate() {
  const { hasConsent } = useCookieConsent();

  return (
    <>
      {ENABLED_CONSENT_INTEGRATIONS.filter((integration) => hasConsent(integration.category)).map((integration) => {
        const Loader = INTEGRATION_LOADERS[integration.id];
        // No registered loader for an enabled integration is a
        // configuration gap, not a reason to crash the page.
        if (!Loader) return null;
        return <Loader key={integration.id} />;
      })}
    </>
  );
}
