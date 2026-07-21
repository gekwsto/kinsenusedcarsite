import { type BrowserContext, type Locator, type Page, expect } from "@playwright/test";

// ---------- Admin auth ----------

// Seeded by prisma/seed.ts (see ADMIN_EMAIL/ADMIN_PASSWORD there) — the
// standing local/test super-admin account, not a real Marketing user.
export const SEEDED_ADMIN_EMAIL = "admin@kinsen.local";
export const SEEDED_ADMIN_PASSWORD = "change-me-after-login";

/** Logs in through the real /login form (not a cookie/session shortcut) and waits for the post-login admin redirect. */
export async function loginAsAdmin(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#login-email").fill(SEEDED_ADMIN_EMAIL);
  await page.locator("#login-password").fill(SEEDED_ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/admin/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

export const CONSENT_COOKIE_NAME = "kinsen_cookie_consent_v2";
export const LEGACY_CONSENT_COOKIE_NAME = "kinsen_cookie_consent_v1";
export const NECESSARY_ONLY_FINGERPRINT = "necessary-only:v1";

export interface ParsedConsentCookie {
  version: number;
  policyFingerprint: string;
  necessary: boolean;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

/** Reads the real browser cookie jar (not a pure-function call) for the current consent cookie. */
export async function getConsentCookie(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === CONSENT_COOKIE_NAME) ?? null;
}

export async function getLegacyConsentCookie(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === LEGACY_CONSENT_COOKIE_NAME) ?? null;
}

export function parseConsentCookieValue(rawValue: string): ParsedConsentCookie {
  return JSON.parse(decodeURIComponent(rawValue));
}

/** Asserts the real, persisted browser cookie matches the expected normalized necessary-only shape. */
export async function expectNecessaryOnlyConsentCookie(context: BrowserContext) {
  const cookie = await getConsentCookie(context);
  expect(cookie, `${CONSENT_COOKIE_NAME} cookie was not created`).not.toBeNull();
  expect(cookie!.path).toBe("/");
  expect(cookie!.sameSite).toBe("Lax");
  expect(cookie!.secure).toBe(false); // local http — Secure would silently no-op the write if ever set here

  const parsed = parseConsentCookieValue(cookie!.value);
  expect(parsed.version).toBe(2);
  expect(parsed.policyFingerprint).toBe(NECESSARY_ONLY_FINGERPRINT);
  expect(parsed.necessary).toBe(true);
  expect(parsed.preferences).toBe(false);
  expect(parsed.analytics).toBe(false);
  expect(parsed.marketing).toBe(false);
  expect(Number.isNaN(Date.parse(parsed.updatedAt))).toBe(false);
  return parsed;
}

/** Injects a raw, already-serialized cookie value directly into the browser's real cookie jar (bypassing the UI) — used for legacy/malformed/stale-fingerprint fixtures. */
export async function injectRawCookie(context: BrowserContext, baseURL: string, name: string, rawValue: string) {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name,
      value: encodeURIComponent(rawValue),
      domain: url.hostname,
      path: "/",
    },
  ]);
}

export function realisticLegacyV1Payload() {
  // The pre-hardening schema: no policyFingerprint field, and the exact
  // "phantom consent" shape Accept All used to produce.
  return JSON.stringify({
    version: 1,
    necessary: true,
    preferences: true,
    analytics: true,
    marketing: true,
    updatedAt: new Date().toISOString(),
  });
}

// ---------- Banner / modal locators (role + accessible name — no CSS selectors) ----------

export function bannerLocators(page: Page) {
  return {
    region: page.getByRole("region", { name: "Ειδοποίηση για cookies" }),
    rejectButton: page.getByRole("region", { name: "Ειδοποίηση για cookies" }).getByRole("button", { name: "Απόρριψη μη απαραίτητων" }),
    settingsButton: page.getByRole("region", { name: "Ειδοποίηση για cookies" }).getByRole("button", { name: "Ρυθμίσεις cookies", exact: true }),
    acceptAllButton: page.getByRole("region", { name: "Ειδοποίηση για cookies" }).getByRole("button", { name: "Αποδοχή όλων" }),
    privacyLink: page.getByRole("region", { name: "Ειδοποίηση για cookies" }).getByRole("link", { name: "Πολιτική Προστασίας Δεδομένων" }),
  };
}

export function modalLocators(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Ρυθμίσεις Cookies" });
  return {
    dialog,
    closeButton: dialog.getByRole("button", { name: "Κλείσιμο" }),
    rejectButton: dialog.getByRole("button", { name: "Απόρριψη μη απαραίτητων" }),
    saveButton: dialog.getByRole("button", { name: "Αποθήκευση επιλογών" }),
    acceptAllButton: dialog.getByRole("button", { name: "Αποδοχή όλων" }),
    necessaryOnlyMessage: dialog.getByText("Αυτή τη στιγμή ο ιστότοπος χρησιμοποιεί μόνο αναγκαία cookies."),
  };
}

// ---------- Accordion (src/components/ui/accordion.tsx) ----------

// AccordionTrigger (src/components/ui/accordion.tsx) deliberately ignores a
// click on its own trigger while that item's open/close CSS animation
// (accordion-down/accordion-up, 0.2s) is still running — a documented
// anti-flash guard, not a bug: Radix's height remeasure on a rapid re-toggle
// can otherwise land mid-animation and snap to full height for one frame.
// No real user can double-click within that ~200ms window, but a
// synthetic/scripted double-click can, and clicking through the lock is
// correctly a no-op — so a test that opens then immediately closes the same
// section must wait for the animation to actually finish first. Waits on
// the Web Animations API (`element.getAnimations()`) rather than a fixed
// sleep, so it's exact regardless of main-thread jank in a given run.
export async function waitForAccordionSettled(trigger: Locator) {
  const page = trigger.page();
  const handle = await trigger.elementHandle();
  if (!handle) throw new Error("waitForAccordionSettled: trigger element not found");
  await page.waitForFunction((triggerEl) => {
    const contentId = triggerEl.getAttribute("aria-controls");
    const content = contentId ? document.getElementById(contentId) : null;
    return content ? content.getAnimations().length === 0 : true;
  }, handle);
}

export function footerSettingsButton(page: Page) {
  return page.locator("footer").getByRole("button", { name: "Ρυθμίσεις Cookies", exact: true });
}

// ---------- Tracker network guard ----------

export const TRACKER_HOST_PATTERNS = [
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "connect.facebook.net",
  "facebook.com/tr",
  "hotjar.com",
  "static.hotjar.com",
  "clarity.ms",
  "bat.bing.com",
  "doubleclick.net",
];

/** Records (never silently blocks) any outgoing request to a known tracker host — call assertNoTrackerRequests to fail the test if any occurred. */
export function attachTrackerGuard(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (TRACKER_HOST_PATTERNS.some((host) => url.includes(host))) requests.push(url);
  });
  return requests;
}

export function assertNoTrackerRequests(requests: string[]) {
  expect(requests, `Unexpected tracker network requests: ${requests.join("\n")}`).toEqual([]);
}

// ---------- Console / page-error guard ----------

export interface RuntimeErrorGuard {
  pageErrors: string[];
  consoleErrors: string[];
}

// Narrow, documented allowlist only — today's app ships no third-party
// script, so there should be almost nothing to allow. Keep this empty
// unless a specific, unavoidable, harmless message is identified and
// justified with a comment.
const ALLOWED_CONSOLE_PATTERNS: RegExp[] = [
  // next-auth's SessionProvider fetches /api/auth/session on mount; a real
  // browser back/forward navigation can abort that in-flight fetch before
  // it resolves, and next-auth logs the resulting AbortError/TypeError as
  // a console.error internally (library behavior, not something this
  // app's code controls or a functional defect — the session simply
  // refetches successfully on the next mount, confirmed by the rest of
  // this same test passing). Scoped to this exact message only.
  /Failed to fetch\. Read more at https:\/\/errors\.authjs\.dev#autherror/,
  // Same benign, entirely normal prefetch cancellation already excused for
  // Chromium's `net::ERR_ABORTED` wording in isBenignPrefetchAbort below
  // (a <Link>/NavigationLink background prefetch — URL carries `_rsc=` —
  // getting cancelled because the page navigated away, e.g. page.goBack()
  // in the middle of an in-flight prefetch for an unrelated footer link).
  // Firefox and WebKit both auto-log a console.error for that same
  // cancellation, but under a misleading message that reads like a real
  // CORS/access-control failure rather than a cancellation — a documented
  // browser quirk (the fetch's controlling document navigating away mid-
  // flight), not a functional defect. Scoped to `_rsc=` prefetch URLs only,
  // so a genuine cross-origin access-control failure on a non-prefetch
  // request still fails this guard.
  /Fetch API cannot load .*\?_rsc=\S* due to access control checks\.?/,
];

export function attachRuntimeErrorGuard(page: Page): RuntimeErrorGuard {
  const guard: RuntimeErrorGuard = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (err) => guard.pageErrors.push(String(err?.stack ?? err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (ALLOWED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
    guard.consoleErrors.push(text);
  });
  return guard;
}

export function assertNoRuntimeErrors(guard: RuntimeErrorGuard) {
  expect(guard.pageErrors, `Unexpected page errors:\n${guard.pageErrors.join("\n")}`).toEqual([]);
  expect(guard.consoleErrors, `Unexpected console errors:\n${guard.consoleErrors.join("\n")}`).toEqual([]);
}

// ---------- Failed first-party request guard ----------

// Next.js's <Link>/NavigationLink prefetches routes in the background
// (requests carrying a `_rsc=` query param) as they scroll into view —
// entirely normal, and the browser legitimately cancels a prefetch that's
// no longer needed (link scrolled away, page navigated). That is not a
// broken request; only a genuinely failed/aborted *primary* navigation or
// data request should fail a test. Each engine reports that same
// cancellation under its own wording — confirmed by an actual WebKit
// failure this exact guard let through as "http://.../renault-clio-2022
// ?_rsc=... — cancelled" (a background prefetch for a vehicle-detail link,
// cancelled by the test's own subsequent navigation) before "cancelled"
// was added here. Firefox's Gecko networking stack uses its own
// NS_BINDING_ABORTED code for the identical case.
const BENIGN_PREFETCH_ABORT_ERRORS = new Set(["net::ERR_ABORTED", "cancelled", "NS_BINDING_ABORTED"]);
function isBenignPrefetchAbort(url: string, errorText: string | undefined): boolean {
  return !!errorText && BENIGN_PREFETCH_ABORT_ERRORS.has(errorText) && url.includes("_rsc=");
}

export function attachFailedRequestGuard(page: Page, baseURL: string): string[] {
  const failures: string[] = [];
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(baseURL) && !isBenignPrefetchAbort(req.url(), req.failure()?.errorText)) {
      failures.push(`${req.url()} — ${req.failure()?.errorText ?? "unknown error"}`);
    }
  });
  page.on("response", (res) => {
    if (res.url().startsWith(baseURL) && res.status() >= 500) {
      failures.push(`${res.url()} — HTTP ${res.status()}`);
    }
  });
  return failures;
}

export function assertNoFailedFirstPartyRequests(failures: string[]) {
  expect(failures, `Unexpected failed/5xx first-party requests:\n${failures.join("\n")}`).toEqual([]);
}
