import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VERSION,
  COOKIE_CONSENT_MAX_AGE_DAYS,
  LEGACY_COOKIE_CONSENT_NAMES,
  buildCookieClearString,
  buildConsentCookieClearString,
  buildConsentCookieString,
  createAcceptAllConsent,
  createCustomState,
  createDefaultConsentState,
  createRejectNonEssentialConsent,
  hasCategoryConsent,
  normalizeConsentAgainstActiveCategories,
  parseConsentState,
  readConsentFromCookieHeader,
  readCookieValue,
  serializeConsentState,
} from "@/lib/cookie-consent";
import {
  ALL_OPTIONAL_CATEGORIES,
  CONSENT_INTEGRATIONS,
  CURRENT_POLICY_FINGERPRINT,
  NECESSARY_ONLY_POLICY_REVISION,
  categoryRequiresReloadOnRevoke,
  computeConsentPolicyFingerprint,
  getActiveOptionalCategories,
  getConsentCategoryViewModels,
  getEnabledConsentIntegrations,
  getRemovableCookiesForCategory,
  type ConsentIntegrationDefinition,
} from "@/lib/consent-integrations";

// ---------- test fixtures (never added to the production registry) ----------

const MOCK_ANALYTICS: ConsentIntegrationDefinition = {
  id: "google-analytics-test",
  category: "analytics",
  enabled: true,
  provider: "Google LLC",
  displayName: "Google Analytics (test fixture)",
  description: "Test-only analytics integration.",
  consentRevision: 1,
  cookies: [{ name: "_ga_test", provider: "Google Analytics", purpose: "Test purpose", duration: "2 έτη" }],
  requiresReloadOnRevoke: true,
};

const MOCK_MARKETING: ConsentIntegrationDefinition = {
  id: "meta-pixel-test",
  category: "marketing",
  enabled: true,
  provider: "Meta Platforms",
  displayName: "Meta Pixel (test fixture)",
  description: "Test-only marketing integration.",
  consentRevision: 1,
  cookies: [{ name: "_fbp_test", provider: "Meta", purpose: "Test purpose" }],
  requiresReloadOnRevoke: false,
};

const MOCK_DISABLED_PREFERENCES: ConsentIntegrationDefinition = {
  id: "disabled-preference-test",
  category: "preferences",
  enabled: false,
  provider: "Kinsen",
  displayName: "Disabled preference integration (test fixture)",
  description: "Test-only, deliberately disabled.",
  consentRevision: 1,
  cookies: [],
  requiresReloadOnRevoke: false,
};

const MOCK_PREFERENCES: ConsentIntegrationDefinition = {
  id: "kinsen-preferences-test",
  category: "preferences",
  enabled: true,
  provider: "Kinsen",
  displayName: "Kinsen preferences (test fixture)",
  description: "Test-only preferences integration.",
  consentRevision: 1,
  cookies: [{ name: "kinsen_pref_test", provider: "Kinsen", purpose: "Test purpose" }],
  requiresReloadOnRevoke: false,
};

// A second, distinct analytics integration — used to prove two enabled
// integrations in the same category collapse into one category row with
// both listed in its inventory, never two separate rows.
const MOCK_ANALYTICS_SECOND: ConsentIntegrationDefinition = {
  id: "matomo-test",
  category: "analytics",
  enabled: true,
  provider: "Matomo",
  displayName: "Matomo (test fixture)",
  description: "Second test-only analytics integration, same category as MOCK_ANALYTICS.",
  consentRevision: 1,
  cookies: [{ name: "_pk_id_test", provider: "Matomo", purpose: "Test purpose" }],
  requiresReloadOnRevoke: false,
};

// Deliberately sparse metadata (empty description, no cookies) — proves the
// view model / modal rendering path never crashes on a real but minimal
// integration definition.
const MOCK_MINIMAL_INTEGRATION: ConsentIntegrationDefinition = {
  id: "minimal-test",
  category: "marketing",
  enabled: true,
  provider: "Test Provider",
  displayName: "Minimal integration (test fixture)",
  description: "",
  consentRevision: 1,
  cookies: [],
  requiresReloadOnRevoke: false,
};

// ==================== 1-5: active category derivation ====================

test("[1] empty registry → active categories is []", () => {
  assert.deepEqual(getActiveOptionalCategories(getEnabledConsentIntegrations([])), []);
});

test("[2] analytics-only enabled integration → active categories is ['analytics']", () => {
  assert.deepEqual(getActiveOptionalCategories(getEnabledConsentIntegrations([MOCK_ANALYTICS])), ["analytics"]);
});

test("[3] analytics + marketing enabled → active categories in canonical order", () => {
  assert.deepEqual(getActiveOptionalCategories(getEnabledConsentIntegrations([MOCK_MARKETING, MOCK_ANALYTICS])), [
    "analytics",
    "marketing",
  ]);
});

test("[4] a disabled integration's category is excluded", () => {
  assert.deepEqual(getActiveOptionalCategories(getEnabledConsentIntegrations([MOCK_DISABLED_PREFERENCES])), []);
});

test("[5] category ordering is deterministic regardless of registry array order", () => {
  const orderA = getActiveOptionalCategories(getEnabledConsentIntegrations([MOCK_MARKETING, MOCK_ANALYTICS]));
  const orderB = getActiveOptionalCategories(getEnabledConsentIntegrations([MOCK_ANALYTICS, MOCK_MARKETING]));
  assert.deepEqual(orderA, orderB);
  assert.deepEqual(orderA, ["analytics", "marketing"]);
});

// ==================== 6-8: Accept All ====================

test("[6] Accept All with no active categories → every optional flag false", () => {
  const state = createAcceptAllConsent([], "necessary-only:v1");
  assert.equal(state.necessary, true);
  assert.equal(state.preferences, false);
  assert.equal(state.analytics, false);
  assert.equal(state.marketing, false);
});

test("[7] Accept All with only analytics active → analytics true, others false", () => {
  const state = createAcceptAllConsent(["analytics"], "fp");
  assert.equal(state.preferences, false);
  assert.equal(state.analytics, true);
  assert.equal(state.marketing, false);
});

test("[8] Accept All with preferences+marketing active → exactly those true, analytics stays false", () => {
  const state = createAcceptAllConsent(["preferences", "marketing"], "fp");
  assert.equal(state.preferences, true);
  assert.equal(state.analytics, false);
  assert.equal(state.marketing, true);
});

// ==================== 9-12: Reject / normalization / necessary ====================

test("[9] Reject Non-Essential always produces every-optional-false, independent of active categories", () => {
  const state = createRejectNonEssentialConsent("fp");
  assert.equal(state.necessary, true);
  assert.equal(state.preferences, false);
  assert.equal(state.analytics, false);
  assert.equal(state.marketing, false);
});

test("[10] normalizeConsentAgainstActiveCategories forces inactive categories false", () => {
  const normalized = normalizeConsentAgainstActiveCategories(
    { preferences: true, analytics: true, marketing: true },
    ["analytics"],
  );
  assert.deepEqual(normalized, { preferences: false, analytics: true, marketing: false });
});

test("[11] createCustomState: a hidden/inactive category requested true is forced false when saved", () => {
  const state = createCustomState({ preferences: true, analytics: true, marketing: true }, ["analytics"], "fp");
  assert.equal(state.preferences, false);
  assert.equal(state.analytics, true);
  assert.equal(state.marketing, false);
});

test("[12] necessary is always true — in every factory, and via hasCategoryConsent even with null state", () => {
  assert.equal(createDefaultConsentState("fp").necessary, true);
  assert.equal(createAcceptAllConsent(["analytics"], "fp").necessary, true);
  assert.equal(createRejectNonEssentialConsent("fp").necessary, true);
  assert.equal(createCustomState({ preferences: false, analytics: false, marketing: false }, [], "fp").necessary, true);
  assert.equal(hasCategoryConsent(null, "necessary"), true);
});

// ==================== 13-17: fingerprint ====================

test("[13] necessary-only fingerprint (empty registry) uses NECESSARY_ONLY_POLICY_REVISION", () => {
  assert.equal(computeConsentPolicyFingerprint([]), `necessary-only:v${NECESSARY_ONLY_POLICY_REVISION}`);
});

test("[14] fingerprint is order-independent", () => {
  const a = computeConsentPolicyFingerprint([MOCK_ANALYTICS, MOCK_MARKETING]);
  const b = computeConsentPolicyFingerprint([MOCK_MARKETING, MOCK_ANALYTICS]);
  assert.equal(a, b);
});

test("[15] enabling an integration changes the fingerprint", () => {
  const before = computeConsentPolicyFingerprint([]);
  const after = computeConsentPolicyFingerprint([MOCK_ANALYTICS]);
  assert.notEqual(before, after);
});

test("[16] a disabled integration does not change the fingerprint", () => {
  const withoutIt = computeConsentPolicyFingerprint([]);
  const withDisabledOne = computeConsentPolicyFingerprint([MOCK_DISABLED_PREFERENCES]);
  assert.equal(withoutIt, withDisabledOne);
});

test("[17] bumping consentRevision changes the fingerprint", () => {
  const v1 = computeConsentPolicyFingerprint([MOCK_ANALYTICS]);
  const v2 = computeConsentPolicyFingerprint([{ ...MOCK_ANALYTICS, consentRevision: 2 }]);
  assert.notEqual(v1, v2);
});

test("display-only field changes (provider/displayName/description) do NOT change the fingerprint", () => {
  const a = computeConsentPolicyFingerprint([MOCK_ANALYTICS]);
  const b = computeConsentPolicyFingerprint([{ ...MOCK_ANALYTICS, displayName: "Renamed", provider: "Renamed Inc", description: "New copy" }]);
  assert.equal(a, b);
});

// ==================== 18-22: parser / cookie rejection ====================

const FP = "necessary-only:v1";

function validPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: COOKIE_CONSENT_VERSION,
    policyFingerprint: FP,
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
}

test("[32] regression: a valid current payload parses successfully", () => {
  const parsed = parseConsentState(validPayload(), FP, []);
  assert.notEqual(parsed, null);
  assert.equal(parsed!.policyFingerprint, FP);
});

test("[32] regression: malformed JSON never throws and returns null", () => {
  assert.doesNotThrow(() => parseConsentState("{not valid json", FP, []));
  assert.equal(parseConsentState("{not valid json", FP, []), null);
});

test("[18] missing policyFingerprint is rejected", () => {
  const payload = JSON.stringify({
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
  });
  assert.equal(parseConsentState(payload, FP, []), null);
});

test("[19] wrong/stale policyFingerprint is rejected (policy moved on since this was saved)", () => {
  assert.equal(parseConsentState(validPayload({ policyFingerprint: "some-other-fp:v1" }), FP, []), null);
});

test("[20] old/unknown version is rejected", () => {
  assert.equal(parseConsentState(validPayload({ version: COOKIE_CONSENT_VERSION - 1 }), FP, []), null);
  assert.equal(parseConsentState(validPayload({ version: COOKIE_CONSENT_VERSION + 1 }), FP, []), null);
});

test("necessary=false is rejected", () => {
  assert.equal(parseConsentState(validPayload({ necessary: false }), FP, []), null);
});

test("non-boolean optional flags are rejected", () => {
  assert.equal(parseConsentState(validPayload({ analytics: "yes" }), FP, []), null);
});

test("[21] legacy cookie name: readConsentFromCookieHeader never reads it (only COOKIE_CONSENT_NAME)", () => {
  const header = `${LEGACY_COOKIE_CONSENT_NAMES[0]}=${encodeURIComponent(
    JSON.stringify({ necessary: true, preferences: true, analytics: true, marketing: true }),
  )}`;
  assert.equal(readConsentFromCookieHeader(header, FP, []), null);
});

test("[22] phantom true flags for an inactive category are normalized to false even with a matching current fingerprint", () => {
  const payload = validPayload({ analytics: true, marketing: true });
  const parsed = parseConsentState(payload, FP, ["analytics"]);
  assert.notEqual(parsed, null);
  assert.equal(parsed!.analytics, true, "analytics is active — stays true");
  assert.equal(parsed!.marketing, false, "marketing is not active — forced false despite the raw payload");
});

// ==================== 23-25: script-gate permission decisions (pure logic) ====================
// ConsentScriptGate itself is a React component (no RTL in this repo — see
// task constraints); these tests exercise the exact decision expression it
// uses: enabledIntegrations.filter(i => hasConsent(i.category)).

function scriptGateDecision(integrations: ConsentIntegrationDefinition[], consentState: Parameters<typeof hasCategoryConsent>[0]) {
  return integrations
    .filter((i) => i.enabled)
    .filter((i) => hasCategoryConsent(consentState, i.category))
    .map((i) => i.id);
}

test("[23] script gate permits nothing when the registry is empty", () => {
  assert.deepEqual(scriptGateDecision([], createAcceptAllConsent(["analytics"], "fp")), []);
});

test("[24] mock analytics gate: denied when analytics consent is false", () => {
  const consent = createRejectNonEssentialConsent("fp");
  assert.deepEqual(scriptGateDecision([MOCK_ANALYTICS], consent), []);
});

test("[25] mock analytics gate: allowed once analytics consent is true", () => {
  const consent = createAcceptAllConsent(["analytics"], "fp");
  assert.deepEqual(scriptGateDecision([MOCK_ANALYTICS], consent), ["google-analytics-test"]);
});

test("mock analytics gate: a disabled integration is never permitted even with consent true", () => {
  const disabledAnalytics = { ...MOCK_ANALYTICS, enabled: false };
  const consent = createAcceptAllConsent(["analytics"], "fp");
  assert.deepEqual(scriptGateDecision([disabledAnalytics], consent), []);
});

// ==================== 26-28: revocation derivation ====================

test("[26] getRemovableCookiesForCategory derives cookie names from enabled integrations in that category", () => {
  assert.deepEqual(getRemovableCookiesForCategory("analytics", [MOCK_ANALYTICS]), ["_ga_test"]);
  assert.deepEqual(getRemovableCookiesForCategory("marketing", [MOCK_ANALYTICS]), []);
});

test("[27] categoryRequiresReloadOnRevoke reflects the integration's own flag", () => {
  assert.equal(categoryRequiresReloadOnRevoke("analytics", [MOCK_ANALYTICS]), true);
  assert.equal(categoryRequiresReloadOnRevoke("marketing", [MOCK_MARKETING]), false);
});

test("[28] no integrations registered → no removable cookies, no reload required, for any category", () => {
  for (const category of ALL_OPTIONAL_CATEGORIES) {
    assert.deepEqual(getRemovableCookiesForCategory(category, []), []);
    assert.equal(categoryRequiresReloadOnRevoke(category, []), false);
  }
});

// ==================== 29-30: modal category view model ====================

test("[29] modal view model for an empty registry is []", () => {
  assert.deepEqual(getConsentCategoryViewModels([]), []);
});

test("[30] modal view model for a mocked enabled analytics integration includes it, with its own inventory", () => {
  const models = getConsentCategoryViewModels([MOCK_ANALYTICS]);
  assert.equal(models.length, 1);
  assert.equal(models[0]!.category, "analytics");
  assert.equal(models[0]!.integrations.length, 1);
  assert.equal(models[0]!.integrations[0]!.id, "google-analytics-test");
});

test("modal view model for a mocked enabled marketing integration produces one Marketing category", () => {
  const models = getConsentCategoryViewModels([MOCK_MARKETING]);
  assert.equal(models.length, 1);
  assert.equal(models[0]!.category, "marketing");
  assert.equal(models[0]!.integrations[0]!.id, "meta-pixel-test");
});

test("modal view model for a mocked enabled preferences integration produces one Preferences category", () => {
  const models = getConsentCategoryViewModels([MOCK_PREFERENCES]);
  assert.equal(models.length, 1);
  assert.equal(models[0]!.category, "preferences");
  assert.equal(models[0]!.integrations[0]!.id, "kinsen-preferences-test");
});

test("a disabled integration never produces a category, even alongside other enabled ones", () => {
  const models = getConsentCategoryViewModels([MOCK_DISABLED_PREFERENCES, MOCK_ANALYTICS]);
  assert.deepEqual(
    models.map((m) => m.category),
    ["analytics"],
  );
});

test("two enabled integrations in the same category collapse into one category row listing both", () => {
  const models = getConsentCategoryViewModels([MOCK_ANALYTICS, MOCK_ANALYTICS_SECOND]);
  assert.equal(models.length, 1);
  assert.equal(models[0]!.category, "analytics");
  assert.deepEqual(
    models[0]!.integrations.map((i) => i.id).sort(),
    ["google-analytics-test", "matomo-test"],
  );
});

test("view-model category ordering is deterministic canonical order (preferences, analytics, marketing), independent of registry array order", () => {
  const modelsA = getConsentCategoryViewModels([MOCK_MARKETING, MOCK_ANALYTICS, MOCK_PREFERENCES]);
  const modelsB = getConsentCategoryViewModels([MOCK_PREFERENCES, MOCK_MARKETING, MOCK_ANALYTICS]);
  const orderA = modelsA.map((m) => m.category);
  const orderB = modelsB.map((m) => m.category);
  assert.deepEqual(orderA, ["preferences", "analytics", "marketing"]);
  assert.deepEqual(orderB, ["preferences", "analytics", "marketing"]);
});

test("a minimal integration (empty description, no cookies) does not crash view-model derivation", () => {
  assert.doesNotThrow(() => {
    const models = getConsentCategoryViewModels([MOCK_MINIMAL_INTEGRATION]);
    assert.equal(models[0]!.integrations[0]!.description, "");
    assert.deepEqual(models[0]!.integrations[0]!.cookies, []);
  });
});

test("the production registry (CONSENT_INTEGRATIONS) is empty today, so the real modal view model is []", () => {
  assert.deepEqual(getConsentCategoryViewModels(CONSENT_INTEGRATIONS), []);
});

// ==================== cookie string builders (regression) ====================

test("buildConsentCookieString: has Path=/, SameSite=Lax, correct Max-Age, no Secure in non-secure context", () => {
  const state = createAcceptAllConsent(["analytics"], "fp");
  const cookieString = buildConsentCookieString(state, { secure: false });
  assert.match(cookieString, /Path=\//);
  assert.match(cookieString, /SameSite=Lax/);
  assert.match(cookieString, new RegExp(`Max-Age=${COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60}`));
  assert.doesNotMatch(cookieString, /Secure/);
  assert.match(cookieString, new RegExp(`^${COOKIE_CONSENT_NAME.replace(/\./g, "\\.")}=`));
});

test("buildConsentCookieString: appends Secure when secure=true (production/https)", () => {
  const cookieString = buildConsentCookieString(createAcceptAllConsent([], "fp"), { secure: true });
  assert.match(cookieString, /; Secure$/);
});

test("buildConsentCookieString value round-trips through readConsentFromCookieHeader", () => {
  const state = createCustomState({ preferences: false, analytics: true, marketing: false }, ["analytics"], FP);
  const cookieString = buildConsentCookieString(state, { secure: false });
  const nameValue = cookieString.split(";")[0]!;
  assert.deepEqual(readConsentFromCookieHeader(nameValue, FP, ["analytics"]), state);
});

test("buildConsentCookieClearString: expires immediately (Max-Age=0)", () => {
  const cleared = buildConsentCookieClearString({ secure: false });
  assert.match(cleared, /Max-Age=0/);
});

test("buildCookieClearString: expires an arbitrary named cookie immediately", () => {
  const cleared = buildCookieClearString("some_third_party_cookie", { secure: false });
  assert.match(cleared, /^some_third_party_cookie=;/);
  assert.match(cleared, /Max-Age=0/);
});

test("readCookieValue: finds and decodes the named cookie among several", () => {
  const header = `other=1; ${COOKIE_CONSENT_NAME}=%7B%22a%22%3A1%7D; another=2`;
  assert.equal(readCookieValue(header, COOKIE_CONSENT_NAME), '{"a":1}');
});

test("readCookieValue: returns null when the cookie is absent", () => {
  assert.equal(readCookieValue("foo=1; bar=2", COOKIE_CONSENT_NAME), null);
});

// ==================== production registry sanity ====================

test("production CONSENT_INTEGRATIONS is empty — no enabled fake integration was introduced by this task", () => {
  assert.deepEqual(CONSENT_INTEGRATIONS, []);
});

test("production CURRENT_POLICY_FINGERPRINT is the necessary-only fingerprint", () => {
  assert.equal(CURRENT_POLICY_FINGERPRINT, `necessary-only:v${NECESSARY_ONLY_POLICY_REVISION}`);
});

test("serializeConsentState → parseConsentState round-trips exactly", () => {
  const state = createAcceptAllConsent(["analytics", "marketing"], "fp");
  const parsed = parseConsentState(serializeConsentState(state), "fp", ["analytics", "marketing"]);
  assert.deepEqual(parsed, state);
});
