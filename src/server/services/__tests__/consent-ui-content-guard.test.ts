import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Static regression guard: a specific incident report described the cookie
 * preferences modal rendering generic English fallback/demo content
 * ("Necessary cookies are required to enable the basic features...",
 * "Functional cookies help perform...", "Analytical cookies are used...",
 * "Always Active", and English category names). That content was not found
 * anywhere in this repository when investigated (see
 * reports/cookie_preferences_dynamic_ui_lock.json for the full
 * investigation) — this guard exists so that if any of those exact strings
 * (or a second/legacy consent-modal implementation) is ever introduced,
 * CI fails immediately rather than relying on someone noticing it visually.
 */

const CONSENT_UI_SOURCE_FILES = [
  "src/components/cookie-consent/cookie-preferences-modal.tsx",
  "src/components/cookie-consent/cookie-banner.tsx",
  "src/components/providers/cookie-consent-provider.tsx",
  "src/lib/consent-integrations.ts",
  "src/lib/cookie-consent.ts",
  "src/components/layout/cookie-settings-button.tsx",
];

const BANNED_FRAGMENTS = [
  "Necessary cookies are required to enable the basic features",
  "Functional cookies help perform",
  "Analytical cookies are used to understand how visitors interact",
  "Always Active",
];

// English category-name strings as standalone quoted identifiers only —
// deliberately narrow (a whole-word, quoted match), so this never flags a
// legitimate substring appearing inside real Greek copy or an unrelated
// English word used correctly elsewhere (e.g. a code comment).
const BANNED_QUOTED_CATEGORY_NAMES = [/"Necessary"/, /"Functional"/, /"Analytics"/, /"Marketing"/, /'Necessary'/, /'Functional'/, /'Analytics'/, /'Marketing'/];

function readConsentUiSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("consent UI source contains none of the reported generic English fallback fragments", () => {
  for (const file of CONSENT_UI_SOURCE_FILES) {
    const content = readConsentUiSource(file);
    for (const fragment of BANNED_FRAGMENTS) {
      assert.ok(!content.includes(fragment), `${file} must not contain the banned fragment: "${fragment}"`);
    }
  }
});

test("consent UI source contains no hardcoded English quoted category names (Necessary/Functional/Analytics/Marketing)", () => {
  for (const file of CONSENT_UI_SOURCE_FILES) {
    const content = readConsentUiSource(file);
    for (const pattern of BANNED_QUOTED_CATEGORY_NAMES) {
      assert.ok(!pattern.test(content), `${file} must not contain a hardcoded English category name matching ${pattern}`);
    }
  }
});

test("exactly one Cookie Preferences modal component exists in the repository", () => {
  const cookieConsentDir = path.join(process.cwd(), "src/components/cookie-consent");
  const files = fs.readdirSync(cookieConsentDir);
  const modalFiles = files.filter((f) => /modal/i.test(f));
  assert.deepEqual(modalFiles, ["cookie-preferences-modal.tsx"], "expected exactly one modal file in src/components/cookie-consent/");
});

test("no third-party consent-management-platform package is present in package.json", () => {
  const pkg = JSON.parse(readConsentUiSource("package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const bannedPackageNamePatterns = [/cookieyes/i, /cookiebot/i, /onetrust/i, /consentmanager/i, /termly/i, /iubenda/i, /complianz/i];
  for (const name of Object.keys(allDeps)) {
    for (const pattern of bannedPackageNamePatterns) {
      assert.ok(!pattern.test(name), `package.json must not depend on a third-party CMP package matching ${pattern} (found "${name}")`);
    }
  }
});

test("the preferences modal renders category copy only from CATEGORY_COPY, never a hardcoded per-category JSX branch", () => {
  const content = readConsentUiSource("src/components/cookie-consent/cookie-preferences-modal.tsx");
  // A hardcoded "if preferences category exists render this JSX, if
  // analytics render that JSX" pattern would reintroduce exactly the
  // fictional-disabled-row risk this guard exists to prevent — the modal
  // must map over categoryViewModels generically instead.
  assert.match(content, /categoryViewModels\.map/, "expected the modal to render optional categories via a single generic .map() over the registry-derived view models");
  assert.ok(!/category === "analytics"/.test(content), "must not special-case the analytics category with its own conditional branch");
  assert.ok(!/category === "marketing"/.test(content), "must not special-case the marketing category with its own conditional branch");
});
