import { test, expect } from "@playwright/test";
import { bannerLocators, footerSettingsButton, modalLocators } from "./helpers";

const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];

async function hasNoHorizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1);
}

for (const viewport of VIEWPORTS) {
  test.describe(`responsive — ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    // These tests assert final resting layout/geometry, not animation
    // behavior (that is covered separately in cookie-consent.spec.ts) —
    // reduced motion means the banner's CSS entrance transform is skipped
    // entirely (globals.css honors prefers-reduced-motion for it), so a
    // bounding-box measurement can never race a still-in-progress
    // translateY() transition.
    test.use({ viewport: { width: viewport.width, height: viewport.height }, contextOptions: { reducedMotion: "reduce" } });

    test("[30][31][32][33] banner: visible, all actions reachable, no clipping, no page overflow", async ({ page }) => {
      await page.goto("/");
      const banner = bannerLocators(page);
      await expect(banner.region).toBeVisible();
      await expect(banner.rejectButton).toBeVisible();
      await expect(banner.settingsButton).toBeVisible();
      await expect(banner.acceptAllButton).toBeVisible();

      for (const button of [banner.rejectButton, banner.settingsButton, banner.acceptAllButton]) {
        const box = await button.boundingBox();
        expect(box, "button must have a bounding box").not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
      }

      const bannerBox = await banner.region.boundingBox();
      expect(bannerBox).not.toBeNull();
      expect(bannerBox!.y + bannerBox!.height).toBeLessThanOrEqual(viewport.height + 1);

      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    });

    test("[30][31][32][33] preferences modal: visible, title/close/actions reachable, no overflow", async ({ page }) => {
      await page.goto("/");
      await bannerLocators(page).settingsButton.click();
      const modal = modalLocators(page);
      await expect(modal.dialog).toBeVisible();
      // Scoped to the dialog — the footer's own identically-labeled
      // settings button remains present (though inert) in the background.
      await expect(modal.dialog.getByRole("heading", { name: "Ρυθμίσεις Cookies" })).toBeVisible();
      await expect(modal.closeButton).toBeVisible();

      // Sticky footer action row must remain reachable regardless of modal height.
      await expect(modal.rejectButton).toBeVisible();
      await expect(modal.saveButton).toBeVisible();
      await expect(modal.acceptAllButton).toBeVisible();

      const dialogBox = await modal.dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(dialogBox!.height).toBeLessThanOrEqual(viewport.height + 1);

      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    });

    test("privacy page: no horizontal overflow, tables remain contained", async ({ page }) => {
      await page.goto("/privacy-policy");
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
      const table = page.locator("table").first();
      await expect(table).toBeVisible();
    });

    test("footer settings button does not overlap adjacent footer links", async ({ page }) => {
      await page.goto("/");
      await bannerLocators(page).rejectButton.click();
      const settingsButton = footerSettingsButton(page);
      await settingsButton.scrollIntoViewIfNeeded();
      await expect(settingsButton).toBeVisible();
      const privacyLink = page.locator("footer").getByRole("link", { name: "Πολιτική Προστασίας Δεδομένων" });
      await expect(privacyLink).toBeVisible();

      const [settingsBox, privacyBox] = await Promise.all([settingsButton.boundingBox(), privacyLink.boundingBox()]);
      expect(settingsBox).not.toBeNull();
      expect(privacyBox).not.toBeNull();
      // They must not fully overlap (allowing normal inline-list adjacency).
      const overlapArea =
        Math.max(0, Math.min(settingsBox!.x + settingsBox!.width, privacyBox!.x + privacyBox!.width) - Math.max(settingsBox!.x, privacyBox!.x)) *
        Math.max(0, Math.min(settingsBox!.y + settingsBox!.height, privacyBox!.y + privacyBox!.height) - Math.max(settingsBox!.y, privacyBox!.y));
      const smallerArea = Math.min(settingsBox!.width * settingsBox!.height, privacyBox!.width * privacyBox!.height);
      expect(overlapArea).toBeLessThan(smallerArea * 0.5);
    });
  });
}

// ---------- Automated zoom-equivalent layout-pressure coverage ----------
// Method: page.setViewportSize() with a proportionally reduced CSS
// viewport (base 1440x900 divided by the target zoom factor) — the
// task-sanctioned technique for approximating the *layout pressure* a
// real browser zoom creates (less available CSS px for the same content),
// not a pixel-identical reproduction of any specific browser's native zoom
// renderer. This is not the same as testing actual OS/browser zoom.
const ZOOM_LEVELS = [
  { label: "125%", factor: 1.25 },
  { label: "150%", factor: 1.5 },
  { label: "200%", factor: 2 },
];

for (const { label, factor } of ZOOM_LEVELS) {
  const width = Math.round(1440 / factor);
  const height = Math.round(900 / factor);

  test.describe(`zoom-equivalent layout pressure — ${label} (viewport ${width}x${height})`, () => {
    test.use({ viewport: { width, height } });

    test("[51] banner and footer controls remain reachable, no page overflow", async ({ page }) => {
      await page.goto("/");
      const banner = bannerLocators(page);
      await expect(banner.acceptAllButton).toBeVisible();
      await expect(banner.rejectButton).toBeVisible();
      expect(await hasNoHorizontalOverflow(page)).toBe(true);

      await banner.rejectButton.click();
      const settingsButton = footerSettingsButton(page);
      await settingsButton.scrollIntoViewIfNeeded();
      await expect(settingsButton).toBeVisible();
    });

    test("[51] modal controls remain reachable, privacy tables remain usable", async ({ page }) => {
      await page.goto("/");
      await bannerLocators(page).settingsButton.click();
      const modal = modalLocators(page);
      await expect(modal.dialog).toBeVisible();
      await expect(modal.acceptAllButton).toBeVisible();
      await page.keyboard.press("Escape");

      await page.goto("/privacy-policy");
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
      await expect(page.locator("table").first()).toBeVisible();
    });
  });
}
