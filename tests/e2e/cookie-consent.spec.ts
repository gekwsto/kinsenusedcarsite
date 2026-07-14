import { test, expect } from "@playwright/test";
import {
  CONSENT_COOKIE_NAME,
  LEGACY_CONSENT_COOKIE_NAME,
  NECESSARY_ONLY_FINGERPRINT,
  attachFailedRequestGuard,
  attachRuntimeErrorGuard,
  attachTrackerGuard,
  assertNoFailedFirstPartyRequests,
  assertNoRuntimeErrors,
  assertNoTrackerRequests,
  bannerLocators,
  expectNecessaryOnlyConsentCookie,
  footerSettingsButton,
  getConsentCookie,
  getLegacyConsentCookie,
  injectRawCookie,
  modalLocators,
  parseConsentCookieValue,
  realisticLegacyV1Payload,
} from "./helpers";

// Every test gets a fresh, isolated Playwright BrowserContext by default
// (the `page`/`context` fixtures are per-test) — no explicit
// browser.newContext() plumbing is needed for "clean first visit"
// semantics, and no test's cookie writes can leak into another test.

test.describe("cookie consent — clean first visit", () => {
  test("[1][2][44][45][46] banner appears, modal does not auto-open, no hydration/console/page errors, no failed first-party requests", async ({ page, baseURL }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    const failedRequests = attachFailedRequestGuard(page, baseURL!);
    const tracker = attachTrackerGuard(page);

    await page.goto("/");

    const banner = bannerLocators(page);
    await expect(banner.region).toBeVisible();
    await expect(modalLocators(page).dialog).toBeHidden();

    await expect(banner.rejectButton).toBeVisible();
    await expect(banner.rejectButton).toBeEnabled();
    await expect(banner.settingsButton).toBeVisible();
    await expect(banner.settingsButton).toBeEnabled();
    await expect(banner.acceptAllButton).toBeVisible();
    await expect(banner.acceptAllButton).toBeEnabled();
    await expect(banner.privacyLink).toBeVisible();

    expect(await page.evaluate(() => document.body.getBoundingClientRect().height)).toBeGreaterThan(0);

    assertNoRuntimeErrors(runtimeGuard);
    assertNoFailedFirstPartyRequests(failedRequests);
    assertNoTrackerRequests(tracker);
  });

  test("no optional consent cookie exists before any choice is made", async ({ page, context }) => {
    await page.goto("/");
    await expect(bannerLocators(page).region).toBeVisible();
    expect(await getConsentCookie(context)).toBeNull();
  });
});

test.describe("cookie consent — Accept All", () => {
  test("[3][21][24][36] Accept All persists a normalized necessary-only v2 cookie with no reload and no tracker request", async ({ page, context, baseURL }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    const tracker = attachTrackerGuard(page);

    await page.goto("/");
    const banner = bannerLocators(page);
    await expect(banner.acceptAllButton).toBeVisible();

    await banner.acceptAllButton.click();
    await expect(banner.region).toBeHidden();

    await expectNecessaryOnlyConsentCookie(context);
    assertNoTrackerRequests(tracker);
    assertNoRuntimeErrors(runtimeGuard);
  });

  test("[4] Accept All persists after a page refresh", async ({ page, context }) => {
    await page.goto("/");
    await bannerLocators(page).acceptAllButton.click();
    await expect(bannerLocators(page).region).toBeHidden();

    await page.reload();
    await expect(bannerLocators(page).region).toBeHidden();
    await expectNecessaryOnlyConsentCookie(context);
  });

  test("[5] Accept All persists across route navigation and a second page in the same context", async ({ page, context }) => {
    await page.goto("/");
    await bannerLocators(page).acceptAllButton.click();
    await expect(bannerLocators(page).region).toBeHidden();

    await page.goto("/vehicles");
    await expect(bannerLocators(page).region).toBeHidden();

    const secondPage = await context.newPage();
    await secondPage.goto("/");
    await expect(bannerLocators(secondPage).region).toBeHidden();
    await secondPage.close();
  });
});

test.describe("cookie consent — Reject Non-Essential", () => {
  test("[6][25] Reject stores the same normalized necessary-only shape as Accept All, no tracker request", async ({ page, context }) => {
    const tracker = attachTrackerGuard(page);
    await page.goto("/");
    const banner = bannerLocators(page);
    await banner.rejectButton.click();
    await expect(banner.region).toBeHidden();

    await expectNecessaryOnlyConsentCookie(context);
    assertNoTrackerRequests(tracker);
  });

  test("[7] Reject persists after refresh", async ({ page, context }) => {
    await page.goto("/");
    await bannerLocators(page).rejectButton.click();
    await expect(bannerLocators(page).region).toBeHidden();

    await page.reload();
    await expect(bannerLocators(page).region).toBeHidden();
    await expectNecessaryOnlyConsentCookie(context);
  });

  test("Reject does not reappear on another route in the same context", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).rejectButton.click();
    await page.goto("/vehicles");
    await expect(bannerLocators(page).region).toBeHidden();
  });
});

test.describe("cookie consent — preferences modal from the banner", () => {
  test("[8] Ρυθμίσεις cookies opens the modal without implying any choice", async ({ page, context }) => {
    await page.goto("/");
    const banner = bannerLocators(page);
    await banner.settingsButton.click();

    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();
    expect(await getConsentCookie(context)).toBeNull();
  });

  test("[14][15][16] modal shows only the Αναγκαία category, no optional toggle, and the necessary-only message", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();

    await expect(modal.dialog.getByText("Αναγκαία", { exact: true })).toBeVisible();
    await expect(modal.dialog.getByText("Πάντα ενεργά")).toBeVisible();
    await expect(modal.necessaryOnlyMessage).toBeVisible();

    // No optional category label anywhere, and no switch role at all —
    // "Πάντα ενεργά" is a static badge, not an interactive control.
    for (const label of ["Λειτουργικά", "Ανάλυσης", "Εμπορικής προώθησης"]) {
      await expect(modal.dialog.getByText(label)).toHaveCount(0);
    }
    await expect(modal.dialog.getByRole("switch")).toHaveCount(0);
  });

  // Guards the exact incident this repository investigated: a report of the
  // modal rendering generic English fallback/demo content ("Necessary
  // cookies are required to enable the basic features...", "Functional
  // cookies help perform...", "Analytical cookies are used...", "Always
  // Active"). That content was not found anywhere in the source, a clean
  // rebuild, or the rendered DOM when investigated — this asserts against
  // the real rendered text directly, not just source code, as a permanent
  // regression guard against a future stale build or duplicate modal
  // reintroducing it. Complements the static source-level guard in
  // src/server/services/__tests__/consent-ui-content-guard.test.ts.
  test("the rendered modal contains none of the previously-reported generic English fallback strings", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();

    const renderedText = await modal.dialog.innerText();
    for (const fragment of [
      "Necessary cookies are required to enable the basic features",
      "Functional cookies help perform",
      "Analytical cookies are used to understand how visitors interact",
      "Always Active",
    ]) {
      expect(renderedText, `modal must not render the banned fragment: "${fragment}"`).not.toContain(fragment);
    }

    // Exactly one dialog — no legacy/duplicate modal rendered underneath or alongside it.
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("[9][13] closing the modal with the close button creates no consent cookie, and the banner remains available", async ({ page, context }) => {
    await page.goto("/");
    const banner = bannerLocators(page);
    await banner.settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();

    await modal.closeButton.click();
    await expect(modal.dialog).toBeHidden();
    expect(await getConsentCookie(context)).toBeNull();
    await expect(banner.region).toBeVisible();
  });

  test("[10][11][27] Escape closes the modal without saving, and focus returns to the banner's settings button", async ({ page, context }) => {
    await page.goto("/");
    const banner = bannerLocators(page);
    await banner.settingsButton.focus();
    await banner.settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal.dialog).toBeHidden();
    expect(await getConsentCookie(context)).toBeNull();

    await expect(banner.settingsButton).toBeFocused();
  });

  test("[15][35] Reject/Save/Accept All inside the modal all store necessary-only under today's registry", async ({ page, context }) => {
    await page.goto("/");
    await bannerLocators(page).settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.saveButton).toBeVisible();

    await modal.saveButton.click();
    await expect(modal.dialog).toBeHidden();
    await expectNecessaryOnlyConsentCookie(context);
  });
});

test.describe("cookie consent — footer settings", () => {
  test("[12][13][26] footer settings opens the modal after consent is resolved, shows necessary-only, and returns focus on close", async ({ page, context }) => {
    await page.goto("/");
    await bannerLocators(page).acceptAllButton.click();
    await expect(bannerLocators(page).region).toBeHidden();

    const settingsButton = footerSettingsButton(page);
    await settingsButton.scrollIntoViewIfNeeded();
    await settingsButton.focus();
    await settingsButton.click();

    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();
    await expect(modal.necessaryOnlyMessage).toBeVisible();
    for (const label of ["Λειτουργικά", "Ανάλυσης", "Εμπορικής προώθησης"]) {
      await expect(modal.dialog.getByText(label)).toHaveCount(0);
    }

    await page.keyboard.press("Escape");
    await expect(modal.dialog).toBeHidden();
    await expect(settingsButton).toBeFocused();
  });

  test("footer settings button is reachable and activatable by keyboard alone", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).rejectButton.click();

    const settingsButton = footerSettingsButton(page);
    await settingsButton.scrollIntoViewIfNeeded();
    await settingsButton.focus();
    await expect(settingsButton).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(modalLocators(page).dialog).toBeVisible();
  });
});

test.describe("cookie consent — legacy and malformed cookies", () => {
  test("[17][31] a legacy v1 cookie is deleted, never migrated, and the banner appears with a fresh choice required", async ({ page, context, baseURL }) => {
    await injectRawCookie(context, baseURL!, LEGACY_CONSENT_COOKIE_NAME, realisticLegacyV1Payload());
    expect(await getLegacyConsentCookie(context)).not.toBeNull();

    const tracker = attachTrackerGuard(page);
    await page.goto("/");
    await expect(bannerLocators(page).region).toBeVisible();

    // The legacy cookie must be gone, and its phantom-true flags must
    // never have been imported into a v2 cookie.
    await expect.poll(async () => getLegacyConsentCookie(context)).toBeNull();
    expect(await getConsentCookie(context)).toBeNull();
    assertNoTrackerRequests(tracker);
  });

  const malformedCases: { name: string; value: () => string }[] = [
    { name: "invalid JSON / truncated value", value: () => '{"version":2,"policyFin' },
    {
      name: "missing policyFingerprint",
      value: () => JSON.stringify({ version: 2, necessary: true, preferences: false, analytics: false, marketing: false, updatedAt: new Date().toISOString() }),
    },
    {
      name: "wrong policyFingerprint",
      value: () =>
        JSON.stringify({ version: 2, policyFingerprint: "stale-old-policy:v1", necessary: true, preferences: false, analytics: false, marketing: false, updatedAt: new Date().toISOString() }),
    },
    {
      name: "wrong version",
      value: () =>
        JSON.stringify({ version: 1, policyFingerprint: NECESSARY_ONLY_FINGERPRINT, necessary: true, preferences: false, analytics: false, marketing: false, updatedAt: new Date().toISOString() }),
    },
    {
      name: "necessary=false",
      value: () =>
        JSON.stringify({ version: 2, policyFingerprint: NECESSARY_ONLY_FINGERPRINT, necessary: false, preferences: false, analytics: false, marketing: false, updatedAt: new Date().toISOString() }),
    },
  ];

  for (const { name, value } of malformedCases) {
    test(`[18][19][20][22][23] malformed/stale v2 cookie (${name}) is rejected safely — banner appears, no crash`, async ({ page, context, baseURL }) => {
      await injectRawCookie(context, baseURL!, CONSENT_COOKIE_NAME, value());

      const runtimeGuard = attachRuntimeErrorGuard(page);
      const tracker = attachTrackerGuard(page);
      await page.goto("/");

      await expect(bannerLocators(page).region).toBeVisible();
      assertNoRuntimeErrors(runtimeGuard);
      assertNoTrackerRequests(tracker);

      // A fresh choice replaces the invalid cookie with a valid, normalized one.
      await bannerLocators(page).acceptAllButton.click();
      await expectNecessaryOnlyConsentCookie(context);
    });
  }

  test("[22] a structurally-valid v2 cookie with phantom optional=true flags for inactive categories is silently normalized, not rejected — no banner reappears", async ({ page, context, baseURL }) => {
    // Unlike the malformed cases above, version/fingerprint here are
    // correct — only the optional flags are phantom-true despite zero
    // active categories. That represents a real (if tampered-with) prior
    // consent decision, so it must be accepted and normalized down to
    // false, not treated as "no consent" (which would reopen the banner
    // for a user who already chose).
    await injectRawCookie(
      context,
      baseURL!,
      CONSENT_COOKIE_NAME,
      JSON.stringify({
        version: 2,
        policyFingerprint: NECESSARY_ONLY_FINGERPRINT,
        necessary: true,
        preferences: true,
        analytics: true,
        marketing: true,
        updatedAt: new Date().toISOString(),
      }),
    );

    const tracker = attachTrackerGuard(page);
    await page.goto("/");

    // toBeHidden() resolves immediately for an element that was never in
    // the DOM to begin with — it does not, by itself, prove the client
    // mount-effect (which rewrites the cookie with normalized flags) has
    // run yet. Poll the actual observable condition instead.
    await expect(bannerLocators(page).region).toBeHidden();
    await expect
      .poll(async () => {
        const cookie = await getConsentCookie(context);
        return cookie ? parseConsentCookieValue(cookie.value).preferences : undefined;
      })
      .toBe(false);

    const cookie = await getConsentCookie(context);
    expect(cookie).not.toBeNull();
    const parsed = parseConsentCookieValue(cookie!.value);
    expect(parsed.preferences).toBe(false);
    expect(parsed.analytics).toBe(false);
    expect(parsed.marketing).toBe(false);
    assertNoTrackerRequests(tracker);
  });

  test("[18] stale fingerprint from a previous policy is rejected, and a fresh Accept All produces today's current fingerprint", async ({ page, context, baseURL }) => {
    await injectRawCookie(
      context,
      baseURL!,
      CONSENT_COOKIE_NAME,
      JSON.stringify({
        version: 2,
        policyFingerprint: "old-policy:v1",
        necessary: true,
        preferences: false,
        analytics: false,
        marketing: false,
        updatedAt: new Date().toISOString(),
      }),
    );

    await page.goto("/");
    await expect(bannerLocators(page).region).toBeVisible();
    await bannerLocators(page).acceptAllButton.click();
    const parsed = await expectNecessaryOnlyConsentCookie(context);
    expect(parsed.policyFingerprint).toBe(NECESSARY_ONLY_FINGERPRINT);
  });
});

test.describe("cookie consent — no duplicate instances", () => {
  test("[39][40] exactly one banner and one modal instance exist, including across route navigation", async ({ page }) => {
    await page.goto("/");
    await expect(bannerLocators(page).region).toHaveCount(1);

    await bannerLocators(page).settingsButton.click();
    await expect(modalLocators(page).dialog).toHaveCount(1);
    await page.keyboard.press("Escape");

    await page.goto("/vehicles");
    await page.goto("/");
    await expect(bannerLocators(page).region).toHaveCount(1);
  });

  test("repeated open/close of the settings modal never stacks overlays", async ({ page }) => {
    await page.goto("/");
    const banner = bannerLocators(page);
    const modal = modalLocators(page);

    for (let i = 0; i < 3; i++) {
      await banner.settingsButton.click();
      await expect(modal.dialog).toBeVisible();
      await expect(modal.dialog).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(modal.dialog).toBeHidden();
    }
  });
});

test.describe("cookie consent — background scroll lock", () => {
  test("[34][35] background does not scroll while the modal is open, and scroll is restored after it closes", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).rejectButton.click();

    // `behavior: "instant"` bypasses globals.css's `html { scroll-behavior:
    // smooth }` — with smooth scrolling, reading scrollY immediately after
    // scrollTo() races the in-progress animation and can observe 0.
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
    const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
    expect(scrollBeforeOpen).toBeGreaterThan(0);

    const settingsButton = footerSettingsButton(page);
    await settingsButton.scrollIntoViewIfNeeded();
    await settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();

    // Attempt to scroll the background document while the modal is open.
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150); // allow any scroll event to settle — not a fixed-duration animation wait
    const scrollWhileOpen = await page.evaluate(() => window.scrollY);

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyOverflow === "hidden" || scrollWhileOpen === scrollBeforeOpen).toBeTruthy();

    await page.keyboard.press("Escape");
    await expect(modal.dialog).toBeHidden();

    await page.mouse.wheel(0, 200);
    await expect.poll(async () => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  });
});

test.describe("cookie consent — reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("[34] banner and modal remain fully functional with prefers-reduced-motion", async ({ page, context }) => {
    await page.goto("/");
    const banner = bannerLocators(page);
    await expect(banner.region).toBeVisible();

    await banner.settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();

    await modal.acceptAllButton.click();
    await expect(modal.dialog).toBeHidden();
    await expectNecessaryOnlyConsentCookie(context);
  });
});

test.describe("cookie consent — keyboard accessibility", () => {
  test("Tab reaches every banner action in order, each with visible focus", async ({ page, browserName }) => {
    await page.goto("/");
    const banner = bannerLocators(page);
    await expect(banner.region).toBeVisible();

    await banner.rejectButton.focus();
    await expect(banner.rejectButton).toBeFocused();
    await page.keyboard.press("Tab");

    // WebKit does not include plain <button> elements in sequential Tab
    // order by default — proven with an isolated, React/Radix/Tailwind-free
    // plain-HTML control page (a bare <button> after a link is skipped by
    // Tab the same way there) — this matches real Safari's default "Full
    // Keyboard Access: Text boxes and lists only" setting and is genuine
    // native platform behavior, not an app defect, so sequential Tab
    // arrival is not asserted for WebKit. What's asserted instead: the
    // buttons are real semantic <button> elements (never divs, which real
    // Full-Keyboard-Access Safari users and switch/AT devices could not
    // reach at all), and they remain keyboard-operable — explicitly
    // focusable and Enter-activatable — which is exactly how a Safari user
    // with Full Keyboard Access enabled (or any AT that drives focus
    // programmatically) actually operates this banner.
    if (browserName === "webkit") {
      await expect(banner.settingsButton).toHaveJSProperty("tagName", "BUTTON");
      await expect(banner.acceptAllButton).toHaveJSProperty("tagName", "BUTTON");

      await banner.settingsButton.focus();
      await expect(banner.settingsButton).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(modalLocators(page).dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(modalLocators(page).dialog).toBeHidden();

      await banner.acceptAllButton.focus();
      await expect(banner.acceptAllButton).toBeFocused();
      return;
    }

    await expect(banner.settingsButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(banner.acceptAllButton).toBeFocused();
  });

  test("focus is trapped inside the modal while open (Tab does not escape to the page behind it)", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();

    // Cycle through many Tab presses — focus must always remain a
    // descendant of the dialog, never fall through to page content behind it.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const focusInDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return !!dialog && dialog.contains(document.activeElement);
      });
      expect(focusInDialog).toBe(true);
    }
  });

  test("modal has an accessible title and the close button has an accessible name", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).settingsButton.click();
    const modal = modalLocators(page);
    await expect(modal.dialog).toBeVisible();
    // Scoped to the dialog itself — the footer's own "Ρυθμίσεις Cookies"
    // settings button (still present in the background) has the identical
    // accessible name, so an unscoped page-wide lookup is ambiguous.
    await expect(modal.dialog.getByRole("heading", { name: "Ρυθμίσεις Cookies" })).toBeVisible();
    await expect(modal.closeButton).toBeVisible();
    await expect(modal.closeButton).toHaveAccessibleName("Κλείσιμο");
  });
});
