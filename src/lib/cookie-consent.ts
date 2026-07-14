/**
 * Central cookie-consent model — the single source of truth for the
 * consent cookie's name, version, lifetime, and payload shape, plus the
 * only parser/serializer pair in the app. See reports/cookie_consent_audit.json
 * for the real cookie/storage inventory this model is based on, and
 * src/lib/consent-integrations.ts for the registry that determines which
 * optional categories actually exist.
 *
 * Deliberately framework-agnostic (no `document` access here, and no
 * import of the registry's live CONSENT_INTEGRATIONS/ACTIVE_OPTIONAL_CATEGORIES
 * constants) so every function is pure and unit-testable against arbitrary
 * fixture category sets — src/components/providers/cookie-consent-provider.tsx
 * is the only place that touches `document.cookie` and the only place that
 * wires this module to the real production registry.
 */

import type { OptionalConsentCategory } from "@/lib/consent-integrations";

export type ConsentCategory = "necessary" | OptionalConsentCategory;

export interface CookieConsentState {
  version: number;
  /**
   * Fingerprint of the consent-integration policy in effect when this
   * state was saved (src/lib/consent-integrations.ts,
   * computeConsentPolicyFingerprint). A stored cookie whose fingerprint no
   * longer matches the current policy is stale — treated as no consent at
   * all, never silently reinterpreted, so old "phantom" true flags for a
   * category that didn't really exist yet can never carry forward into a
   * newly-added real integration.
   */
  policyFingerprint: string;
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

/**
 * Current cookie name. Bumped to v2 (both the name and the internal
 * `version` field) specifically because this payload shape changed
 * (added `policyFingerprint`) — see LEGACY_COOKIE_CONSENT_NAMES below for
 * how a v1 cookie from before this change is handled. Keep the name and
 * `COOKIE_CONSENT_VERSION` in sync by convention (not enforced by types),
 * so the name itself stays a human-readable trace of the schema version.
 */
export const COOKIE_CONSENT_NAME = "kinsen_cookie_consent_v2";
export const COOKIE_CONSENT_VERSION = 2;
export const COOKIE_CONSENT_MAX_AGE_DAYS = 180;

/**
 * Cookie names this app has used for consent storage in the past.
 * Encountering one means: delete it, never read its flags, and treat the
 * visitor as having no valid consent (task requirement — no silent
 * migration of old "Accept All" phantom-true flags into the new schema).
 */
export const LEGACY_COOKIE_CONSENT_NAMES: readonly string[] = ["kinsen_cookie_consent_v1"];

export function createDefaultConsentState(policyFingerprint: string): CookieConsentState {
  return {
    version: COOKIE_CONSENT_VERSION,
    policyFingerprint,
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
  };
}

export function createRejectNonEssentialConsent(policyFingerprint: string): CookieConsentState {
  // Always every-optional-false, independent of which categories are
  // currently active — rejection never depends on the registry.
  return createDefaultConsentState(policyFingerprint);
}

/**
 * `Αποδοχή όλων` — enables an optional category only if it is currently
 * active (i.e. has at least one real, enabled integration registered).
 * This is the fix for the "phantom consent" bug: previously this
 * unconditionally set every optional flag to true regardless of whether
 * anything real backed that category.
 */
export function createAcceptAllConsent(
  activeCategories: readonly OptionalConsentCategory[],
  policyFingerprint: string,
): CookieConsentState {
  const active = new Set(activeCategories);
  return {
    version: COOKIE_CONSENT_VERSION,
    policyFingerprint,
    necessary: true,
    preferences: active.has("preferences"),
    analytics: active.has("analytics"),
    marketing: active.has("marketing"),
    updatedAt: new Date().toISOString(),
  };
}

export interface OptionalCategorySelection {
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}

/**
 * Forces every category not currently active to false, regardless of what
 * the raw/requested value claims. Applied both when saving a fresh
 * preferences-modal selection and when re-validating a stored cookie at
 * parse time, so a category can never end up granted — by a stale save, a
 * manipulated cookie, or a registry change — without truly being active.
 */
export function normalizeConsentAgainstActiveCategories(
  requested: OptionalCategorySelection,
  activeCategories: readonly OptionalConsentCategory[],
): OptionalCategorySelection {
  const active = new Set(activeCategories);
  return {
    preferences: active.has("preferences") && requested.preferences === true,
    analytics: active.has("analytics") && requested.analytics === true,
    marketing: active.has("marketing") && requested.marketing === true,
  };
}

/** Builds a saved state from the modal's current switch values, normalized against the categories currently active. `necessary` is never a caller-supplied input — it is always true, structurally. */
export function createCustomState(
  selection: OptionalCategorySelection,
  activeCategories: readonly OptionalConsentCategory[],
  policyFingerprint: string,
): CookieConsentState {
  const normalized = normalizeConsentAgainstActiveCategories(selection, activeCategories);
  return {
    version: COOKIE_CONSENT_VERSION,
    policyFingerprint,
    necessary: true,
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
}

export function hasCategoryConsent(state: CookieConsentState | null, category: ConsentCategory): boolean {
  // "necessary" is always permitted — even before any consent decision
  // exists (state === null) — since necessary functionality (session,
  // CSRF, the consent cookie itself) must work before the banner has even
  // been answered.
  if (category === "necessary") return true;
  if (!state) return false;
  return state[category] === true;
}

/** JSON-serializes a consent state for storage as a cookie value. */
export function serializeConsentState(state: CookieConsentState): string {
  return JSON.stringify(state);
}

/**
 * Parses and validates a raw (already URI-decoded) cookie value against
 * the currently active policy. Never throws — any malformed, incomplete,
 * wrong-version, or stale-fingerprint payload is treated as "no valid
 * consent", so the caller always shows the banner rather than silently
 * trusting garbage or an out-of-date policy. Categories not currently
 * active are force-normalized to false even for an otherwise-valid,
 * current-fingerprint payload — defense in depth against a manipulated
 * cookie value.
 */
export function parseConsentState(
  raw: string | null | undefined,
  currentPolicyFingerprint: string,
  activeCategories: readonly OptionalConsentCategory[],
): CookieConsentState | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;

  if (candidate.version !== COOKIE_CONSENT_VERSION) return null;
  if (typeof candidate.policyFingerprint !== "string" || candidate.policyFingerprint.length === 0) return null;
  if (candidate.policyFingerprint !== currentPolicyFingerprint) return null;
  if (candidate.necessary !== true) return null;
  if (typeof candidate.preferences !== "boolean") return null;
  if (typeof candidate.analytics !== "boolean") return null;
  if (typeof candidate.marketing !== "boolean") return null;
  if (typeof candidate.updatedAt !== "string") return null;

  const normalized = normalizeConsentAgainstActiveCategories(
    { preferences: candidate.preferences, analytics: candidate.analytics, marketing: candidate.marketing },
    activeCategories,
  );

  return {
    version: COOKIE_CONSENT_VERSION,
    policyFingerprint: candidate.policyFingerprint,
    necessary: true,
    ...normalized,
    updatedAt: candidate.updatedAt,
  };
}

/** Reads one cookie's raw (still URI-encoded) value out of a `document.cookie`-shaped header string. Pure — takes the header as input so it's testable without a DOM. */
export function readCookieValue(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export function readConsentFromCookieHeader(
  cookieHeader: string,
  currentPolicyFingerprint: string,
  activeCategories: readonly OptionalConsentCategory[],
): CookieConsentState | null {
  return parseConsentState(readCookieValue(cookieHeader, COOKIE_CONSENT_NAME), currentPolicyFingerprint, activeCategories);
}

/**
 * Builds the exact string to assign to `document.cookie` to persist consent.
 * `Secure` is only appended when `secure` is true (production, https) —
 * setting `Secure` over plain http silently no-ops the cookie write in
 * every browser, which would look like consent "not saving" in local dev.
 */
export function buildConsentCookieString(state: CookieConsentState, opts: { secure: boolean }): string {
  const value = encodeURIComponent(serializeConsentState(state));
  const maxAgeSeconds = COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  const attrs = [`${COOKIE_CONSENT_NAME}=${value}`, "Path=/", `Max-Age=${maxAgeSeconds}`, "SameSite=Lax"];
  if (opts.secure) attrs.push("Secure");
  return attrs.join("; ");
}

/** Deletes the consent cookie by expiring it immediately. */
export function buildConsentCookieClearString(opts: { secure: boolean }): string {
  const attrs = [`${COOKIE_CONSENT_NAME}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (opts.secure) attrs.push("Secure");
  return attrs.join("; ");
}

/** Deletes a cookie by name, expiring it immediately — used for both LEGACY_COOKIE_CONSENT_NAMES and category-revocation cookie cleanup. */
export function buildCookieClearString(name: string, opts: { secure: boolean }): string {
  const attrs = [`${name}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (opts.secure) attrs.push("Secure");
  return attrs.join("; ");
}
