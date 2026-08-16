import { test, expect, type Page } from "@playwright/test";
import { bannerLocators, loginAsAdmin } from "./helpers";

// Locks the semantic color contract for the two /vehicles listing-card
// action controls (favorite-button.tsx, vehicle-compare-toggle.tsx's
// icon-only variant): cyan (`accent`/`accent-dark`) is reserved
// exclusively for a genuinely-liked Favorite; every other state — resting,
// hovered-while-not-liked, and the entire Comparison control including its
// selected state — stays inside the neutral/deep-navy (`primary`) family.
// Asserted via computed color, not screenshots, so it survives unrelated
// visual tweaks to the rest of the card.

const PRIMARY_NAVY = "rgb(2, 56, 89)"; // primary
const ACCENT_CYAN = "rgb(57, 192, 195)"; // accent
const ACCENT_CYAN_DARK = "rgb(46, 169, 172)"; // accent-dark
const FAVORITE_MUTED = "rgb(105, 108, 109)"; // favorite-inactive
const COMPARE_MUTED = "rgb(100, 116, 139)"; // ink-muted

async function dismissBanner(page: Page) {
  const banner = bannerLocators(page);
  const appeared = await banner.region
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await banner.rejectButton.click({ timeout: 5000 }).catch(() => {});
    await banner.region.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

function firstCardLocators(page: Page) {
  const card = page.locator("div[role='group']").first();
  return {
    card,
    heartBtn: card.getByRole("button", { name: /αγαπημένα/i }),
    heartIcon: card.getByRole("button", { name: /αγαπημένα/i }).locator("svg"),
    compareBtn: card.getByRole("button", { name: /σύγκριση/i }),
    compareIcon: card.getByRole("button", { name: /σύγκριση/i }).locator("svg"),
  };
}

test.describe("vehicle card actions — favorite (cyan-only-when-liked) and comparison (never cyan)", () => {
  test("comparison: idle is muted, hover and selected both stay navy, never cyan", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);
    const { compareBtn, compareIcon } = firstCardLocators(page);

    await expect(compareIcon).toHaveCSS("color", COMPARE_MUTED);

    await compareBtn.hover();
    await expect(compareIcon).toHaveCSS("color", PRIMARY_NAVY);

    await compareBtn.click();
    await expect(compareBtn).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 0);
    await expect(compareIcon).toHaveCSS("color", PRIMARY_NAVY);

    // Selected + hover — must remain in the navy family, never cyan.
    await compareBtn.hover();
    await expect(compareIcon).toHaveCSS("color", PRIMARY_NAVY);

    // cleanup
    await compareBtn.click();
    await expect(compareBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("favorite: cyan appears only once genuinely liked, and disappears again on removal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/vehicles");
    await dismissBanner(page);
    const { heartBtn, heartIcon } = firstCardLocators(page);

    // Start from a known "not liked" baseline regardless of leftover state.
    if ((await heartBtn.getAttribute("aria-pressed")) === "true") {
      await heartBtn.click();
      await expect(heartBtn).toHaveAttribute("aria-pressed", "false");
    }

    // A. rest, not liked — muted, no cyan.
    await expect(heartIcon).toHaveCSS("color", FAVORITE_MUTED);

    // B. hover, not liked — deep navy, still no cyan.
    await heartBtn.hover();
    await expect(heartIcon).toHaveCSS("color", PRIMARY_NAVY);

    // C. click — becomes the one and only cyan state.
    await heartBtn.click();
    await expect(heartBtn).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 0);
    await expect(heartIcon).toHaveCSS("color", ACCENT_CYAN);

    // D. liked + hover — stays visibly cyan (a deeper shade), never navy.
    await heartBtn.hover();
    await expect(heartIcon).toHaveCSS("color", ACCENT_CYAN_DARK);

    // E. removed — back to muted, cyan gone.
    await heartBtn.click();
    await expect(heartBtn).toHaveAttribute("aria-pressed", "false");
    await page.mouse.move(0, 0);
    await expect(heartIcon).toHaveCSS("color", FAVORITE_MUTED);
  });

  test("no overlap between the two controls, and neither overflows the card", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);
    const { card, heartBtn, compareBtn } = firstCardLocators(page);

    const [cardBox, heartBox, compareBox] = await Promise.all([
      card.boundingBox(),
      heartBtn.boundingBox(),
      compareBtn.boundingBox(),
    ]);
    expect(compareBox!.x + compareBox!.width).toBeLessThanOrEqual(heartBox!.x + 1);
    expect(heartBox!.x + heartBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
  });
});
