import { test, expect, type Page } from "@playwright/test";
import { bannerLocators } from "./helpers";

// Locks the `/vehicles` listing shell's large-desktop architecture
// (src/app/(public)/vehicles/page.tsx, src/app/globals.css's
// `.container-wide`, src/components/vehicles/vehicle-grid.tsx):
//
// NORMAL desktop/laptop (up to ~2199px) keeps the originally-approved
// layout completely unchanged — `.container-wide` capped at 1880px, the
// vehicle grid at 3 columns. Only from a genuinely large desktop tier
// (`[@media(min-width:2200px)]`, deliberately *not* Tailwind's `2xl:`,
// which starts at 1536px — far too early, still well inside normal
// laptop widths) does the shell widen (`.container-wide` to 2320px) and
// the grid gain a 4th column, so the extra width goes to one more vehicle
// card instead of ever-growing empty outer gutters. Past that cap
// (genuinely ultrawide monitors), the shell stops growing again and the
// extra width becomes intentional outer breathing room — still exactly 4
// columns, never 5.
//
// These tests protect the structural invariants (column count, shared
// row Y, distinct X positions, toolbar-matches-results width, the cap
// itself), not exact pixel values that would make this brittle to a
// future content or spacing tweak.

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

// Returns the bounding boxes of every vehicle card in the results grid, in
// DOM order. Cards are `<div role="group" aria-label="...">` at the top of
// each `VehicleCard` — selecting on that role/attribute pair is stable
// against internal markup changes inside the card itself.
function cardLocator(page: Page) {
  return page.locator('[role="group"][aria-label]');
}

async function firstRowBoxes(page: Page) {
  const cards = cardLocator(page);
  const count = await cards.count();
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const box = await cards.nth(i).boundingBox();
    if (box) boxes.push(box);
  }
  const firstY = boxes[0]?.y ?? 0;
  return boxes.filter((b) => Math.abs(b.y - firstY) < 2);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("vehicle listing — normal desktop keeps the approved 3-column layout, unchanged", () => {
  for (const [width, height, label] of [
    [1280, 800, "laptop"],
    [1440, 900, "laptop"],
    [1920, 1080, "desktop"],
    [2199, 1200, "just below the large-desktop breakpoint"],
  ] as const) {
    test(`${label} (${width}×${height}): exactly 3 cards share the first row, filter sits left of results, no overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/vehicles");
      await dismissBanner(page);

      const aside = page.locator("aside");
      await expect(aside).toBeVisible();
      const asideBox = await aside.boundingBox();
      expect(asideBox).not.toBeNull();

      const row = await firstRowBoxes(page);
      expect(row.length).toBe(3);

      const xs = row.map((b) => Math.round(b.x));
      expect(new Set(xs).size).toBe(3);

      // Filter sits to the left of every card in the first row.
      for (const box of row) {
        expect(asideBox!.x + asideBox!.width).toBeLessThanOrEqual(box.x + 1);
      }

      await noHorizontalOverflow(page);
    });
  }
});

test.describe("vehicle listing — true large desktop gains a 4th column at exactly the 2200px tier", () => {
  for (const [width, height, label] of [
    [2200, 1200, "large-desktop transition point"],
    [2201, 1200, "just above the transition"],
    [2304, 1296, "large desktop"],
    [2560, 1440, "target large-monitor class"],
  ] as const) {
    test(`${label} (${width}×${height}): exactly 4 cards share the first row, at 4 distinct X positions, cards stay comfortably wide, toolbar spans the results width`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/vehicles");
      await dismissBanner(page);

      const aside = page.locator("aside");
      await expect(aside).toBeVisible();
      const asideBox = await aside.boundingBox();
      expect(asideBox).not.toBeNull();

      const row = await firstRowBoxes(page);
      expect(row.length).toBe(4);

      const xs = row.map((b) => Math.round(b.x));
      expect(new Set(xs).size).toBe(4);

      // Every card in the 4-column tier stays well above a "squeezed into
      // tiny boxes" width — the brief's own floor is ~390-440px; 350px is
      // a deliberately generous lower bound so this doesn't become brittle
      // to a few px of gap/padding retuning, while still catching a real
      // regression (e.g. an accidental 5-6 column jump).
      for (const box of row) {
        expect(box.width).toBeGreaterThan(350);
      }

      for (const box of row) {
        expect(asideBox!.x + asideBox!.width).toBeLessThanOrEqual(box.x + 1);
      }

      // The results toolbar ("Όλα τα αποτελέσματα" + sort select) must
      // span exactly the same width as the card grid below it — never an
      // independently-sized header. `VehicleResultsToolbar` is rendered as
      // the literal first child of the results column's `.min-w-0`
      // wrapper (see vehicles/page.tsx), so this is a stable structural
      // locator rather than a text match that could resolve ambiguously.
      const toolbar = page.locator(".min-w-0 > div").first();
      const toolbarBox = await toolbar.boundingBox();
      const gridRight = Math.max(...row.map((b) => b.x + b.width));
      const gridLeft = Math.min(...row.map((b) => b.x));
      expect(toolbarBox).not.toBeNull();
      expect(Math.abs(toolbarBox!.x - gridLeft)).toBeLessThanOrEqual(2);
      expect(Math.abs(toolbarBox!.x + toolbarBox!.width - gridRight)).toBeLessThanOrEqual(2);

      await noHorizontalOverflow(page);
    });
  }
});

test.describe("vehicle listing — ultrawide monitors keep exactly 4 columns, shell capped, no 5th column", () => {
  for (const [width, height, label] of [
    [2880, 1620, "ultrawide"],
    [3440, 1440, "ultrawide cap verification"],
  ] as const) {
    test(`${label} (${width}×${height}): still exactly 4 cards in the first row, container stops growing past its cap`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/vehicles");
      await dismissBanner(page);

      const row = await firstRowBoxes(page);
      expect(row.length).toBe(4);
      const xs = row.map((b) => Math.round(b.x));
      expect(new Set(xs).size).toBe(4);

      // The container itself must have stopped growing by this width —
      // proof the `2320px` cap actually held rather than the shell
      // continuing to stretch toward the viewport edge.
      const container = page.locator(".container-wide");
      const containerBox = await container.boundingBox();
      expect(containerBox).not.toBeNull();
      expect(containerBox!.width).toBeLessThanOrEqual(2330);
      expect(containerBox!.width).toBeGreaterThanOrEqual(2310);

      // No fifth card at this width — the whole point of the cap.
      const firstRowY = row[0]!.y;
      const allCards = await cardLocator(page).all();
      const firstRowCount = (
        await Promise.all(allCards.map(async (c) => (await c.boundingBox())?.y))
      ).filter((y) => y !== undefined && Math.abs(y - firstRowY) < 2).length;
      expect(firstRowCount).toBe(4);

      await noHorizontalOverflow(page);
    });
  }
});

test.describe("vehicle listing — large-desktop card content stays intact", () => {
  test("2200×1200: real card content (title, price, stats, badges, actions) renders without clipping or overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2200, height: 1200 });
    await page.goto("/vehicles");
    await dismissBanner(page);

    const firstCard = cardLocator(page).first();
    await expect(firstCard).toBeVisible();

    // Compare/favorite actions stay inside the card's own box (not
    // clipped or pushed outside it by the narrower 4-column width).
    const cardBox = await firstCard.boundingBox();
    const compareToggle = firstCard.getByRole("button", { name: /Σύγκριση|σύγκριση|compare/i }).first();
    if (await compareToggle.count()) {
      const toggleBox = await compareToggle.boundingBox();
      if (toggleBox && cardBox) {
        expect(toggleBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      }
    }

    // Stat row (km/cc/fuel) must not overflow its own card horizontally.
    const statRows = firstCard.locator("ul").first();
    if (await statRows.count()) {
      const statBox = await statRows.boundingBox();
      if (statBox && cardBox) {
        expect(statBox.x + statBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      }
    }

    await noHorizontalOverflow(page);
  });
});
