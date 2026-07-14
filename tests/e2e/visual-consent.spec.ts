import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { bannerLocators, modalLocators } from "./helpers";

const ARTIFACT_DIR = path.join(process.cwd(), "test-results", "artifacts");
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function stabilize(page: import("@playwright/test").Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.fonts.ready);
}

// Full-page screenshots below deliberately do NOT use Playwright's
// `animations: "disabled"`. Verified empirically: on this page (header +
// hero + banner all animating/transitioning at once), that option
// produces a washed-out, incorrectly-rendered capture — confirmed by
// comparing against a plain, option-free screenshot of the identical
// state, which renders correctly. Instead, a short wait for the ~220ms
// CSS entrance transition (globals.css, `.kinsen-cookie-banner`) to finish
// is used — a deliberate, justified wait for a known timed transition
// with no better observable signal, per this suite's own stated
// allowance. The locator-scoped baseline snapshots further down (small,
// single-element captures) do not exhibit this issue and keep using
// `animations: "disabled"` as intended.
const ENTRANCE_TRANSITION_SETTLE_MS = 300;

test.describe("named review screenshots (test-results/artifacts, not committed)", () => {
  test("first-visit banner @390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await stabilize(page);
    await expect(bannerLocators(page).region).toBeVisible();
    await page.waitForTimeout(ENTRANCE_TRANSITION_SETTLE_MS);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "banner-390.png") });
  });

  test("preferences modal @390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await stabilize(page);
    await bannerLocators(page).settingsButton.click();
    await expect(modalLocators(page).dialog).toBeVisible();
    await page.waitForTimeout(ENTRANCE_TRANSITION_SETTLE_MS);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "modal-390.png") });
  });

  test("first-visit banner @1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await stabilize(page);
    await expect(bannerLocators(page).region).toBeVisible();
    await page.waitForTimeout(ENTRANCE_TRANSITION_SETTLE_MS);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "banner-1440.png") });
  });

  test("preferences modal @1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await stabilize(page);
    await bannerLocators(page).settingsButton.click();
    await expect(modalLocators(page).dialog).toBeVisible();
    await page.waitForTimeout(ENTRANCE_TRANSITION_SETTLE_MS);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "modal-1440.png") });
  });

  test("privacy page legal table @390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/privacy-policy");
    await stabilize(page);
    await expect(bannerLocators(page).region).toBeVisible();
    await page.waitForTimeout(ENTRANCE_TRANSITION_SETTLE_MS);
    const table = page.locator("table").first();
    await table.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "privacy-table-390.png") });
  });

  test("privacy page @1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/privacy-policy");
    await stabilize(page);
    // The cookie banner is also present (first visit) — let its entrance
    // transition settle for the same reason as the banner/modal tests above.
    await expect(bannerLocators(page).region).toBeVisible();
    await page.waitForTimeout(ENTRANCE_TRANSITION_SETTLE_MS);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "privacy-1440.png"), fullPage: false });
  });

  test("/vehicles after consent resolution", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/vehicles");
    await bannerLocators(page).acceptAllButton.click();
    await expect(bannerLocators(page).region).toBeHidden();
    await stabilize(page);
    await page.waitForTimeout(ENTRANCE_TRANSITION_SETTLE_MS);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "vehicles-post-consent.png") });
  });
});

// ---------- Small, focused visual baseline set (consent UI only) ----------
// Locator-scoped (not full-page) screenshots so dynamic vehicle/account
// content never enters the comparison. Baselines live under this spec's
// default `-snapshots` directory and are intentionally committed (the
// whole point of toHaveScreenshot is a persisted baseline future runs
// diff against). `animations: "disabled"` is safe and correct here
// (unlike the full-page captures above) — verified visually.
test.describe("visual baseline — consent UI", () => {
  test("banner — mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await stabilize(page);
    const region = bannerLocators(page).region;
    await expect(region).toBeVisible();
    await expect(region).toHaveScreenshot("banner-mobile.png", { animations: "disabled" });
  });

  test("banner — desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await stabilize(page);
    const region = bannerLocators(page).region;
    await expect(region).toBeVisible();
    await expect(region).toHaveScreenshot("banner-desktop.png", { animations: "disabled" });
  });

  test("modal — mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await stabilize(page);
    await bannerLocators(page).settingsButton.click();
    const dialog = modalLocators(page).dialog;
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot("modal-mobile.png", { animations: "disabled" });
  });

  test("modal — desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await stabilize(page);
    await bannerLocators(page).settingsButton.click();
    const dialog = modalLocators(page).dialog;
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot("modal-desktop.png", { animations: "disabled" });
  });
});
