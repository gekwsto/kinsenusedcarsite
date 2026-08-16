import { test, expect, type Page } from "@playwright/test";
import { bannerLocators } from "./helpers";

// Locks the homepage visual-consistency contract: featured vehicle cards
// share the same finalized corporate hover system as `/vehicles` (no cyan
// border), and both homepage CTA families ("Δείτε όλα", "Δείτε
// Περισσότερα") use the same static Kinsen corporate CTA as the
// Navbar/Login "Σύνδεση" buttons — reusing the exact same underlying
// primitive (kinsen-cta-button.tsx), not a visual approximation. Solid
// navy at rest, unchanged on hover — no animated fill, no color shift.

const PRIMARY_NAVY = "rgb(2, 56, 89)"; // primary

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

test.describe("homepage — featured vehicle cards match the /vehicles corporate system", () => {
  test("featured card hover uses the navy border/shadow system, never a cyan border", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const card = page.locator("div[role='group']").first();
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

    await expect(card).toHaveCSS("border-color", "rgba(2, 56, 89, 0.2)");
    const boxShadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).toContain("rgba(2, 56, 89, 0.1)");
    expect(boxShadow).not.toContain("57, 192, 195"); // accent/cyan
  });

  test("the offer badge (when present) uses the finalized navy treatment, no icon", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const badge = page.getByText("Προσφορά").first();
    if ((await badge.count()) === 0) {
      test.info().annotations.push({ type: "data-limitation", description: "No featured vehicle currently flagged as an offer." });
      return;
    }
    await expect(badge).toHaveCSS("background-color", PRIMARY_NAVY);
    const hasIcon = await badge.evaluate((el) => !!el.querySelector("svg"));
    expect(hasIcon).toBe(false);
  });
});

test.describe("homepage CTAs — static Kinsen corporate CTA, routes unchanged", () => {
  test("Δείτε όλα: unchanged destination, solid navy at rest and unchanged on hover", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const cta = page.getByRole("link", { name: "Δείτε όλα" });
    await expect(cta).toHaveAttribute("href", "/vehicles");
    await expect(cta).toHaveCSS("background-color", PRIMARY_NAVY);
    await expect(cta).toHaveCSS("color", "rgb(255, 255, 255)");

    await cta.hover();
    // No animated fill, no color shift on hover.
    await expect(cta).toHaveCSS("background-color", PRIMARY_NAVY);
    await expect(cta).toHaveCSS("color", "rgb(255, 255, 255)");
  });

  test("every Δείτε Περισσότερα CTA keeps its destination, solid navy at rest, unchanged on hover", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const ctas = page.getByRole("link", { name: "Δείτε Περισσότερα" });
    const count = await ctas.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const cta = ctas.nth(i);
      await expect(cta).toHaveAttribute("href", "/vehicles");
      // Structured radius family (rounded-md), not the previous pill shape.
      await expect(cta).toHaveCSS("border-radius", "6px");
      await expect(cta).toHaveCSS("background-color", PRIMARY_NAVY);
    }

    const first = ctas.first();
    await first.scrollIntoViewIfNeeded();
    await first.hover();
    // No animated fill, no color shift on hover.
    await expect(first).toHaveCSS("background-color", PRIMARY_NAVY);
    await expect(first).toHaveCSS("color", "rgb(255, 255, 255)");
  });
});
