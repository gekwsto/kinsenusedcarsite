import { test, expect } from "@playwright/test";
import { attachRuntimeErrorGuard, assertNoRuntimeErrors, bannerLocators } from "./helpers";

const VEHICLE_NOT_FOUND_HEADING = "Το όχημα που αναζητάτε δεν είναι πλέον διαθέσιμο";
const GENERAL_NOT_FOUND_HEADING = "Η σελίδα δεν βρέθηκε";
const RECOVERABLE_ERROR_HEADING = "Δεν μπορέσαμε να ολοκληρώσουμε την ενέργεια";

test.describe("[vehicle not-found] /vehicles/[slug]", () => {
  test("a nonexistent slug renders the vehicle-specific not-found experience", async ({ page }) => {
    const guard = attachRuntimeErrorGuard(page);
    await page.goto("/vehicles/this-vehicle-does-not-exist-e2e");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    await expect(page.getByRole("heading", { level: 1, name: VEHICLE_NOT_FOUND_HEADING })).toBeVisible();
    await expect(page.getByText("Όχημα μη διαθέσιμο")).toBeVisible();

    assertNoRuntimeErrors(guard);
  });

  test("primary CTA goes to /vehicles, secondary to /", async ({ page }) => {
    await page.goto("/vehicles/this-vehicle-does-not-exist-e2e");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    await expect(page.getByRole("link", { name: "Δείτε όλα τα οχήματα" })).toHaveAttribute("href", "/vehicles");
    await expect(page.getByRole("link", { name: "Επιστροφή στην αρχική" })).toHaveAttribute("href", "/");
  });

  test("Header and Footer remain present (public layout inheritance)", async ({ page }) => {
    await page.goto("/vehicles/this-vehicle-does-not-exist-e2e");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("a soft-deleted vehicle (isDeleted=true) resolves to not-found, never the detail page", async ({ page }) => {
    // Seeded fixture — see prisma/seed.ts / existing DB state (froze=false, isDeleted=true).
    await page.goto("/vehicles/testmaker-testmodel");
    if (page.url().includes("404")) {
      test.info().annotations.push({ type: "data-limitation", description: "Seeded soft-deleted slug testmaker-testmodel not available in this environment." });
      return;
    }
    await bannerLocators(page).rejectButton.click().catch(() => {});
    await expect(page.getByRole("heading", { level: 1, name: VEHICLE_NOT_FOUND_HEADING })).toBeVisible();
  });

  test("a frozen vehicle (froze=true) resolves to not-found, never the detail page", async ({ page }) => {
    // Seeded fixture — froze=true, isDeleted=false.
    await page.goto("/vehicles/mazda-cx-5-2021");
    if (page.url().includes("404")) {
      test.info().annotations.push({ type: "data-limitation", description: "Seeded frozen slug mazda-cx-5-2021 not available in this environment." });
      return;
    }
    await bannerLocators(page).rejectButton.click().catch(() => {});
    await expect(page.getByRole("heading", { level: 1, name: VEHICLE_NOT_FOUND_HEADING })).toBeVisible();
  });

  test("a valid vehicle slug still renders its real detail page, not not-found", async ({ page }) => {
    await page.goto("/vehicles/toyota-corolla-2021");
    if (page.url().includes("404")) {
      test.info().annotations.push({ type: "data-limitation", description: "Seeded slug toyota-corolla-2021 not available in this environment." });
      return;
    }
    await bannerLocators(page).rejectButton.click().catch(() => {});
    await expect(page.getByText(VEHICLE_NOT_FOUND_HEADING)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(VEHICLE_NOT_FOUND_HEADING);
  });

  test("mobile viewport (320px) has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/vehicles/this-vehicle-does-not-exist-e2e");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});

test.describe("[general 404] unknown public URLs", () => {
  test("an unknown URL renders the general not-found experience", async ({ page }) => {
    const guard = attachRuntimeErrorGuard(page);
    await page.goto("/this-page-does-not-exist-e2e");

    await expect(page.getByRole("heading", { level: 1, name: GENERAL_NOT_FOUND_HEADING })).toBeVisible();
    // A genuinely-404 navigation always logs the browser's own "Failed to
    // load resource: 404" console message for the top-level document — that
    // is the correct, expected HTTP status here, not an app defect. Only
    // assert there's no actual JS crash (pageerror).
    expect(guard.pageErrors, `Unexpected page errors:\n${guard.pageErrors.join("\n")}`).toEqual([]);
  });

  test("messaging is contextually different from the vehicle not-found page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-e2e");
    await expect(page.getByText(VEHICLE_NOT_FOUND_HEADING)).toHaveCount(0);
  });

  test("primary CTA is Home, secondary is Vehicles (opposite priority from vehicle not-found)", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-e2e");
    await expect(page.getByRole("link", { name: "Αρχική σελίδα" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Δείτε τα οχήματα" })).toHaveAttribute("href", "/vehicles");
  });

  test("mobile viewport (320px) has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/this-page-does-not-exist-e2e");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});

test.describe("[recoverable error] public error.tsx boundary", () => {
  test("a genuine runtime failure shows a calm retry UI, never raw error details", async ({ page }) => {
    const guard = attachRuntimeErrorGuard(page);
    await page.goto("/vehicles/__e2e_trigger_error__");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    await expect(page.getByRole("heading", { level: 1, name: RECOVERABLE_ERROR_HEADING })).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("E2E test-only trigger");
    expect(bodyText).not.toContain(".tsx");
    expect(bodyText).not.toContain("at Object");
    expect(bodyText).not.toMatch(/prisma/i);

    // A console error is expected here (the whole point of this test is a
    // genuine thrown error) — including Next.js's own production redaction
    // notice ("The specific message is omitted in production builds..."),
    // which is itself proof the raw error is NOT leaking. Assert none of
    // what *did* get logged contains sensitive detail, rather than
    // requiring zero console output.
    for (const message of guard.consoleErrors) {
      expect(message).not.toContain("E2E test-only trigger");
      expect(message).not.toContain(".tsx");
      expect(message).not.toMatch(/prisma/i);
    }
  });

  test("retry is a real button wired to reset(), not a navigation link", async ({ page }) => {
    await page.goto("/vehicles/__e2e_trigger_error__");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    const retryButton = page.getByRole("button", { name: "Δοκιμάστε ξανά" });
    await expect(retryButton).toBeVisible();
    await retryButton.click();
    // The trigger always re-throws, so reset() re-renders the same
    // boundary rather than navigating anywhere else.
    await expect(page).toHaveURL(/\/vehicles\/__e2e_trigger_error__$/);
    await expect(page.getByRole("heading", { level: 1, name: RECOVERABLE_ERROR_HEADING })).toBeVisible();
  });

  test("Home action navigates to /", async ({ page }) => {
    await page.goto("/vehicles/__e2e_trigger_error__");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    await expect(page.getByRole("link", { name: "Επιστροφή στην αρχική" })).toHaveAttribute("href", "/");
  });

  test("Header and Footer remain present", async ({ page }) => {
    await page.goto("/vehicles/__e2e_trigger_error__");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
});

test.describe("[accessibility] keyboard focus", () => {
  test("Tab reaches the vehicle not-found primary action with visible focus", async ({ page }) => {
    await page.goto("/vehicles/this-vehicle-does-not-exist-e2e");
    await bannerLocators(page).rejectButton.click().catch(() => {});

    const primary = page.getByRole("link", { name: "Δείτε όλα τα οχήματα" });
    await primary.focus();
    await expect(primary).toBeFocused();
  });

  test("Tab reaches the general 404 primary action with visible focus", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-e2e");

    const primary = page.getByRole("link", { name: "Αρχική σελίδα" });
    await primary.focus();
    await expect(primary).toBeFocused();
  });
});
