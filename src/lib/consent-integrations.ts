/**
 * Centralized, typed registry of real optional (non-necessary) consent
 * integrations. This is the single source of truth for:
 *
 *   - which optional integrations actually exist and are enabled
 *   - which consent categories are therefore "active" right now
 *   - what `Αποδοχή όλων` is allowed to enable
 *   - what the preferences modal is allowed to display
 *   - what a category's own cookies are, for revocation/deletion
 *   - the consent-policy fingerprint stored in the consent cookie
 *
 * `necessary` is NOT part of this registry — it is a separate, always-on
 * category handled directly by src/lib/cookie-consent.ts, never something
 * an "integration" can opt in or out of.
 *
 * Metadata here is deliberately plain/serializable (strings, numbers,
 * booleans, readonly arrays) — no React components, loader functions, or
 * closures. A future integration's actual script-loading logic belongs in
 * the separate loader map in src/components/cookie-consent/consent-script-gate.tsx,
 * keyed by `id`. See the worked example at the bottom of this file for the
 * exact future workflow.
 */

export type OptionalConsentCategory = "preferences" | "analytics" | "marketing";

// Canonical, fixed display/consideration order — every derived list below
// (active categories, fingerprint category grouping, etc.) is ordered
// against this array, never against registry array insertion order, so
// results never depend on the order CONSENT_INTEGRATIONS entries happen to
// be declared in.
export const ALL_OPTIONAL_CATEGORIES: readonly OptionalConsentCategory[] = ["preferences", "analytics", "marketing"];

export interface ConsentCookieDefinition {
  readonly name: string;
  readonly provider: string;
  readonly purpose: string;
  /** Omit rather than fabricate when the real duration isn't documented. */
  readonly duration?: string;
}

export interface ConsentIntegrationDefinition {
  readonly id: string;
  readonly category: OptionalConsentCategory;
  readonly enabled: boolean;
  readonly provider: string;
  readonly displayName: string;
  readonly description: string;
  /**
   * Bump only when this integration's *material consent meaning* changes
   * (new cookie, new purpose, new data shared with the provider) — not for
   * a copy/wording tweak. Feeds computeConsentPolicyFingerprint(); a bump
   * here changes the fingerprint, which invalidates every previously
   * stored consent and forces a fresh choice.
   */
  readonly consentRevision: number;
  readonly cookies: readonly ConsentCookieDefinition[];
  /**
   * True when this integration's already-loaded script cannot be safely
   * torn down without a full page reload once its category is revoked.
   */
  readonly requiresReloadOnRevoke: boolean;
}

/**
 * THE production registry. Empty today — see reports/cookie_consent_audit.json:
 * no analytics, marketing, or non-essential preference integration exists
 * anywhere in this application. Do not add an entry here with `enabled:
 * true` unless a real, currently-shipping integration backs it; doing so
 * would let `Αποδοχή όλων` grant "phantom consent" for something that
 * isn't actually running, which is exactly the bug this registry exists to
 * prevent.
 */
export const CONSENT_INTEGRATIONS: readonly ConsentIntegrationDefinition[] = [];

/** Only integrations with `enabled === true` may ever influence consent categories, the modal, Accept All, or the script gate. */
export function getEnabledConsentIntegrations(
  registry: readonly ConsentIntegrationDefinition[] = CONSENT_INTEGRATIONS,
): readonly ConsentIntegrationDefinition[] {
  return registry.filter((integration) => integration.enabled);
}

/**
 * The set of optional categories with at least one enabled integration,
 * in canonical (ALL_OPTIONAL_CATEGORIES) order — deterministic and
 * independent of registry array order or how many enabled integrations
 * share a category.
 */
export function getActiveOptionalCategories(
  enabledIntegrations: readonly ConsentIntegrationDefinition[],
): readonly OptionalConsentCategory[] {
  const present = new Set(enabledIntegrations.map((integration) => integration.category));
  return ALL_OPTIONAL_CATEGORIES.filter((category) => present.has(category));
}

/**
 * The current policy's baseline revision — bump this only if the meaning
 * of "necessary-only" itself changes (e.g. a new necessary cookie is added
 * that visitors should be freshly informed about), independent of any
 * individual integration. Keeps the fingerprint able to invalidate old
 * consent even while the optional-integration registry stays empty.
 */
export const NECESSARY_ONLY_POLICY_REVISION = 1;

/**
 * Deterministic, order-independent fingerprint of the effective consent
 * policy. Changes whenever an integration is enabled/disabled, changes
 * category, or has its consentRevision bumped — never for a pure
 * display-copy edit (provider/displayName/description are intentionally
 * excluded). Stored in the consent cookie; a mismatch means the policy
 * moved on since the user's last choice, so old consent is rejected and a
 * fresh choice is required.
 */
export function computeConsentPolicyFingerprint(
  registry: readonly ConsentIntegrationDefinition[] = CONSENT_INTEGRATIONS,
): string {
  const enabled = getEnabledConsentIntegrations(registry);
  if (enabled.length === 0) return `necessary-only:v${NECESSARY_ONLY_POLICY_REVISION}`;
  return enabled
    .map((integration) => `${integration.id}:${integration.category}:v${integration.consentRevision}`)
    .sort()
    .join("|");
}

/** Every cookie name an enabled integration in `category` declares — the real basis for revocation deletion (never a separately-maintained hardcoded list). */
export function getRemovableCookiesForCategory(
  category: OptionalConsentCategory,
  registry: readonly ConsentIntegrationDefinition[] = CONSENT_INTEGRATIONS,
): readonly string[] {
  return getEnabledConsentIntegrations(registry)
    .filter((integration) => integration.category === category)
    .flatMap((integration) => integration.cookies.map((cookie) => cookie.name));
}

/** True if any enabled integration in `category` needs a reload to fully stop once revoked. */
export function categoryRequiresReloadOnRevoke(
  category: OptionalConsentCategory,
  registry: readonly ConsentIntegrationDefinition[] = CONSENT_INTEGRATIONS,
): boolean {
  return getEnabledConsentIntegrations(registry).some(
    (integration) => integration.category === category && integration.requiresReloadOnRevoke,
  );
}

export interface ConsentCategoryViewModel {
  readonly category: OptionalConsentCategory;
  readonly integrations: readonly ConsentIntegrationDefinition[];
}

/**
 * What the preferences modal actually renders: one entry per active
 * category (canonical order), each carrying only its own enabled
 * integrations for inventory display (provider/name/description/cookies).
 * An inactive/disabled category simply never appears in this list — the
 * modal must never hardcode which categories exist.
 */
export function getConsentCategoryViewModels(
  registry: readonly ConsentIntegrationDefinition[] = CONSENT_INTEGRATIONS,
): readonly ConsentCategoryViewModel[] {
  const enabled = getEnabledConsentIntegrations(registry);
  return getActiveOptionalCategories(enabled).map((category) => ({
    category,
    integrations: enabled.filter((integration) => integration.category === category),
  }));
}

// ---------- Precomputed from the real production registry ----------
// The values every non-test call site actually uses. Test files construct
// their own fixture arrays and call the functions above directly rather
// than relying on (or mutating) these.

export const ENABLED_CONSENT_INTEGRATIONS = getEnabledConsentIntegrations(CONSENT_INTEGRATIONS);
export const ACTIVE_OPTIONAL_CATEGORIES = getActiveOptionalCategories(ENABLED_CONSENT_INTEGRATIONS);
export const CURRENT_POLICY_FINGERPRINT = computeConsentPolicyFingerprint(CONSENT_INTEGRATIONS);

/**
 * ---------- Future workflow: adding a real optional integration ----------
 * Example only — not a live entry, and deliberately not added to
 * CONSENT_INTEGRATIONS above. Copy this shape when a real integration
 * ships:
 *
 * const GOOGLE_ANALYTICS: ConsentIntegrationDefinition = {
 *   id: "google-analytics",
 *   category: "analytics",
 *   enabled: Boolean(process.env.NEXT_PUBLIC_GA_ID), // real config, not a fake env var added speculatively
 *   provider: "Google LLC",
 *   displayName: "Google Analytics",
 *   description: "Μας βοηθά να κατανοήσουμε πώς χρησιμοποιείτε τον ιστότοπο.",
 *   consentRevision: 1,
 *   cookies: [
 *     { name: "_ga", provider: "Google Analytics", purpose: "Διάκριση μοναδικών επισκεπτών", duration: "2 έτη" },
 *     { name: "_ga_<container-id>", provider: "Google Analytics", purpose: "Διατήρηση κατάστασης συνεδρίας", duration: "2 έτη" },
 *   ],
 *   requiresReloadOnRevoke: true,
 * };
 *
 * Steps:
 *   1. Add the entry to CONSENT_INTEGRATIONS above.
 *   2. Register its loader in the client-side loader map in
 *      src/components/cookie-consent/consent-script-gate.tsx, keyed by `id`
 *      — the gate itself needs no other change.
 *   3. Never render the script anywhere else in the app (the static
 *      tracker guard test enforces this).
 *   4. Nothing else changes: acceptAll(), the modal's category list, the
 *      cookie parser, and revocation all derive from this registry
 *      automatically. ACTIVE_OPTIONAL_CATEGORIES now includes "analytics",
 *      CURRENT_POLICY_FINGERPRINT changes, every previously-stored
 *      necessary-only consent cookie is therefore rejected on next visit,
 *      and the banner reappears — analytics stays blocked until the user
 *      makes a fresh choice.
 */
