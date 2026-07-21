import { test, expect } from "@playwright/test";
import { attachRuntimeErrorGuard, assertNoRuntimeErrors, bannerLocators, waitForAccordionSettled } from "./helpers";

// Root-provider (CookieConsentProvider/FavoritesProvider) regression —
// these public-site behaviors were not directly edited by the consent
// work, but the provider tree wrapping them was, so this proves the
// critical paths still work in a real browser rather than assuming no
// regression from an untouched-files argument.

test.describe("navigation regression", () => {
  test("[37][38][39][44][45] homepage → /vehicles → /privacy-policy → Back, consent persists throughout, no errors", async ({ page }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    await page.goto("/");
    await bannerLocators(page).acceptAllButton.click();
    await expect(bannerLocators(page).region).toBeHidden();

    await page.getByRole("link", { name: "Οχήματα", exact: true }).first().click();
    await page.waitForURL("**/vehicles");
    await expect(bannerLocators(page).region).toBeHidden();
    // Same reasoning as the identical wait below, applied to the earlier
    // transition too: arriving at /vehicles can still have its own
    // required JS chunks in flight (proven via a captured WebKit trace —
    // network log showed a `_next/static/chunks/*.js` request for this
    // exact page with `_failureText: "cancelled"`, immediately followed by
    // a second successful request for the identical URL). Navigating away
    // with page.goto() before that settles tears down the document mid
    // fetch; the chunk loader's own rejection handler calls the global
    // reportError() for the cancelled request, which Playwright observes
    // as an uncaught page error — a test-harness-visible artifact of an
    // abandoned page transition, not a defect a real visitor would ever
    // notice (the navigation itself completes correctly either way).
    // Letting this page's own load settle before navigating away removes
    // the race instead of asserting around its output.
    await page.waitForLoadState("networkidle");

    await page.goto("/privacy-policy");
    await expect(bannerLocators(page).region).toBeHidden();
    // Let this page's own background <Link> prefetches (footer routes)
    // settle before navigating away. Otherwise the browser cancels an
    // in-flight prefetch mid-navigation — a normal, harmless occurrence —
    // but Firefox/WebKit can log that cancellation as a console.error, and
    // in Firefox specifically the message text is racy (sometimes the full
    // sentence, sometimes just the bare word "Error" if the page's JS
    // context is torn down before Playwright reads the console args),
    // which no fixed string/pattern can reliably distinguish from a real
    // uncaught error. Waiting here removes the race instead of guessing at
    // its output.
    await page.waitForLoadState("networkidle");

    await page.goBack();
    await page.waitForURL("**/vehicles");
    await expect(bannerLocators(page).region).toBeHidden();

    assertNoRuntimeErrors(runtimeGuard);
  });

  test("global header remains interactive after a consent choice", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).rejectButton.click();
    const logo = page.getByRole("link", { name: "Αρχική" });
    await expect(logo).toBeVisible();
    await expect(logo).toBeEnabled();
  });

  test("footer remains interactive after a consent choice", async ({ page }) => {
    await page.goto("/");
    await bannerLocators(page).rejectButton.click();
    const kinsenLink = page.locator("footer").getByRole("link", { name: "Η Kinsen" });
    await expect(kinsenLink).toBeVisible();
  });
});

// Matches all four grammatical forms VehicleResultsToolbar renders (see
// src/components/vehicles/vehicle-results-toolbar.tsx): "Αποτελέσματα:" /
// "Αποτέλεσμα:" only appear once a filter is actively applied — a fresh,
// unfiltered /vehicles visit (hasActiveFilters === false, the case every
// test below actually exercises) renders "Όλα τα αποτελέσματα:" / "Όλο το
// αποτέλεσμα:" instead (lowercase "α", correct Greek mid-sentence casing).
// Case-insensitive so both the capitalized standalone label and the
// lowercase mid-sentence form match the same pattern.
const RESULTS_LABEL_PATTERN = /αποτελέσματα|αποτέλεσμα/i;

test.describe("[40] vehicle listing / filter regression", () => {
  test("route loads, vehicle cards or empty state render, no runtime errors", async ({ page }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    await page.goto("/vehicles");
    await bannerLocators(page).rejectButton.click().catch(() => {}); // banner may or may not be present depending on prior test isolation — best-effort dismiss

    const resultsHeading = page.getByText(RESULTS_LABEL_PATTERN);
    await expect(resultsHeading).toBeVisible();

    const hasCards = await page.locator("a[href^='/vehicles/']").count();
    if (hasCards === 0) {
      await expect(page.getByText("Δεν βρέθηκαν οχήματα")).toBeVisible();
    } else {
      expect(hasCards).toBeGreaterThan(0);
    }

    assertNoRuntimeErrors(runtimeGuard);
  });

  test("filter interface opens and a safe filter interaction works where data exists", async ({ page }) => {
    await page.goto("/vehicles");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    const priceSection = page.getByRole("button", { name: "Τιμή" }).first();
    await expect(priceSection).toBeVisible();
    await priceSection.click();
    await expect(priceSection).toHaveAttribute("aria-expanded", "true");
    // AccordionTrigger ignores a click on this same trigger while its
    // open/close animation is still running (deliberate anti-flash guard —
    // see waitForAccordionSettled/accordion.tsx). Waiting for that
    // animation to actually finish before the second click mirrors the
    // real minimum interaction cadence a human click provides.
    await waitForAccordionSettled(priceSection);
    await priceSection.click();
    await expect(priceSection).toHaveAttribute("aria-expanded", "false");
  });

  test("sorting control opens and offers options where available", async ({ page }) => {
    await page.goto("/vehicles");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    const sortTrigger = page.getByRole("combobox").first();
    if (await sortTrigger.count()) {
      await sortTrigger.click();
      await expect(page.getByRole("option").first()).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });

  test("pagination is operational where enough data exists", async ({ page }) => {
    await page.goto("/vehicles");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    // Scoped to the pagination <nav> and matched by exact text — an
    // unscoped/unanchored "2" pattern can also match an unrelated vehicle
    // card link whose title happens to contain a "2" (e.g. a model year).
    const pageTwoLink = page.getByRole("navigation", { name: "Σελιδοποίηση" }).getByRole("link", { name: "2", exact: true });
    if (await pageTwoLink.count()) {
      await pageTwoLink.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test("cookie banner/modal does not block the page after consent is resolved", async ({ page }) => {
    await page.goto("/vehicles");
    await bannerLocators(page).acceptAllButton.click();
    await expect(bannerLocators(page).region).toBeHidden();
    const resultsHeading = page.getByText(RESULTS_LABEL_PATTERN);
    await expect(resultsHeading).toBeVisible();
    await expect(resultsHeading).toBeInViewport();
  });
});

test.describe("[41] anonymous favorites regression", () => {
  test("clicking favorite as an anonymous visitor prompts login rather than throwing", async ({ page }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    await page.goto("/vehicles");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    const favoriteButton = page.getByRole("button", { name: "Προσθήκη στα αγαπημένα" }).first();
    if (await favoriteButton.count()) {
      await favoriteButton.click();
      // Real architecture: unauthenticated toggle() shows a toast and
      // navigates to /login?callbackUrl=... — see favorites-provider.tsx.
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    } else {
      test.info().annotations.push({ type: "data-limitation", description: "No vehicle cards with a favorite button were present to test against." });
    }

    assertNoRuntimeErrors(runtimeGuard);
  });
});

test.describe("[42] authentication surface regression", () => {
  test("login page loads with accessible fields and submit, consent persists on navigation there, no errors", async ({ page }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    await page.goto("/");
    await bannerLocators(page).acceptAllButton.click();

    await page.goto("/login");
    await expect(bannerLocators(page).region).toBeHidden();

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Κωδικός")).toBeVisible();
    await expect(page.getByRole("button", { name: "Σύνδεση" })).toBeVisible();

    assertNoRuntimeErrors(runtimeGuard);
  });

  test("submitting empty credentials shows safe validation, not a crash", async ({ page }) => {
    await page.goto("/login");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    await page.getByRole("button", { name: "Σύνδεση" }).click();
    // Either client-side zod validation messages appear, or the server
    // safely rejects — either way the page must not error out.
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "Σύνδεση" })).toBeVisible();
  });
});

test.describe("[43] inquiry/interest modal regression", () => {
  test("opens on a vehicle detail page, is accessible, closes with Escape, focus returns", async ({ page }) => {
    await page.goto("/vehicles");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    const firstCard = page.locator("a[href^='/vehicles/']").first();
    if (!(await firstCard.count())) {
      test.info().annotations.push({ type: "data-limitation", description: "No vehicle cards available to reach a detail page." });
      return;
    }
    await firstCard.click();
    await page.waitForURL(/\/vehicles\/[^/]+$/);

    const trigger = page.getByRole("button", { name: /Ενδιαφέρομαι για Leasing/ }).first();
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Όνομα")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the cookie preferences modal and the inquiry modal do not create a stacking conflict", async ({ page }) => {
    await page.goto("/vehicles/toyota-corolla-2021").catch(() => {});
    if (page.url().includes("404") || !(await page.getByRole("button", { name: /Ενδιαφέρομαι για Leasing/ }).count())) {
      test.info().annotations.push({ type: "data-limitation", description: "Seeded slug toyota-corolla-2021 not available in this environment." });
      return;
    }
    await bannerLocators(page).settingsButton.click();
    await expect(page.getByRole("dialog", { name: "Ρυθμίσεις Cookies" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Ρυθμίσεις Cookies" })).toBeHidden();

    const trigger = page.getByRole("button", { name: /Ενδιαφέρομαι για Leasing/ }).first();
    await trigger.click();
    const inquiryDialog = page.getByRole("dialog").first();
    await expect(inquiryDialog).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });
});
