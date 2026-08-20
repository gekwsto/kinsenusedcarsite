import { test, expect, type Page } from "@playwright/test";
import { bannerLocators } from "./helpers";

// Locks the /vehicles Filters panel's premium-redesign contract
// (src/components/vehicles/vehicle-filters.tsx, filter-typography.ts,
// ui/accordion.tsx's chevron-override props):
// - category headers render label + chevron only — no decorative icon
//   chip (removed in the redesign; SECTION_ICON_MAP no longer exists);
// - every interactive control's focus ring renders *inside* its own
//   border box (never clipped by AccordionContent's load-bearing
//   `overflow-hidden`, which the open/close animation depends on);
// - the chevron is one flat navy color, unconditionally — never affected
//   by hover or open/closed state, and never the cyan `filterHeading`
//   token;
// - each category row's background/border (rest/hover/open) is navy or
//   neutral only, never cyan;
// - real vertical gap separates one category row from the next;
// - decorative row hover tinting only ever activates on a genuine
//   fine-pointer/hover-capable device, never sticking after a touch tap.

const NAVY = "rgb(2, 56, 89)";
const WHITE = "rgb(255, 255, 255)";
const SURFACE = "rgb(245, 247, 250)";

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

function fuelTrigger(page: Page) {
  return page.getByRole("button", { name: /Καύσιμο/ });
}

function chevronSpan(trigger: ReturnType<typeof fuelTrigger>) {
  return trigger.locator(":scope > span:last-child");
}

// The AccordionItem row itself — `aside`'s or the mobile Sheet's
// `[role="dialog"]`'s ancestor of the trigger button one level up from the
// header, i.e. the element ITEM_CLASS's border/background classes live on.
function itemRow(trigger: ReturnType<typeof fuelTrigger>) {
  return trigger.locator("xpath=ancestor::*[contains(@class,'rounded-xl')][1]");
}

test.describe("vehicle filters — no decorative category icons", () => {
  test("category headers render exactly one icon (the chevron) — no icon chip beside the label", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();

    const svgCount = await trigger.locator("svg").count();
    expect(svgCount).toBe(1); // the chevron only

    // The label sits in its own plain span, not inside an icon-chip
    // wrapper with fixed h-8/w-8 dimensions.
    const label = trigger.getByText("Καύσιμο", { exact: true });
    await expect(label).toBeVisible();
  });

  test("the main Φίλτρα heading has no icon beside it", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const heading = page.locator("aside h2", { hasText: "Φίλτρα" });
    await expect(heading).toBeVisible();
    const iconCount = await page.locator("aside").locator("h2", { hasText: "Φίλτρα" }).locator("xpath=..").locator("svg").count();
    expect(iconCount).toBe(0);
  });
});

test.describe("vehicle filters — input focus is never clipped", () => {
  test("the maker search input's focus ring is inset (stays inside its border box)", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = page.getByRole("button", { name: /Κατασκευαστής/ });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const input = page.locator("#maker-search");
    await expect(input).toBeVisible();
    await input.focus();

    const style = await input.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { boxShadow: cs.boxShadow, borderColor: cs.borderColor, borderTopWidth: cs.borderTopWidth };
    });

    // An *outset* ring (the shared ui/input.tsx default) is exactly what
    // AccordionContent's overflow-hidden was clipping at the top edge —
    // asserting "inset" here is the deterministic proof the ring can
    // never be sliced, regardless of where the control sits in the
    // content flow.
    expect(style.boxShadow).toContain("inset");
    expect(style.borderColor).toBe(NAVY);
    expect(style.borderTopWidth).toBe("1px"); // the full 1px border survives on every side, including top
  });

  test("the first fuel toggle button (flush against the content's top edge) also gets an inset focus ring", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const firstToggle = page.locator('button[aria-pressed]').first();
    await expect(firstToggle).toBeVisible();
    // Real keyboard focus, not a bare `.focus()` call — Chromium's
    // `:focus-visible` heuristic can suppress the ring for a purely
    // programmatic focus that follows a preceding pointer interaction on
    // the page (the trigger click above), so drive focus the same way a
    // keyboard user actually would.
    await firstToggle.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");

    const boxShadow = await firstToggle.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).toContain("inset");
  });
});

test.describe("vehicle filters — deterministic chevron color, no flicker, no cyan", () => {
  test("the chevron is deep navy at rest, stays navy on hover, and stays navy once open — never the cyan filterHeading token", async ({
    page,
  }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    const chevron = chevronSpan(trigger);

    await expect(trigger).toHaveAttribute("data-state", "closed");
    await expect(chevron).toHaveCSS("color", NAVY);

    await trigger.hover();
    await expect(chevron).toHaveCSS("color", NAVY); // unchanged on hover — no competing rule

    await trigger.click();
    await expect(trigger).toHaveAttribute("data-state", "open");
    await expect(chevron).toHaveCSS("color", NAVY); // unchanged once open, too — one authoritative color, always
  });

  test("the chevron wrapper has no circle/box chrome — no background fill at rest or on hover", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    const chevron = chevronSpan(trigger);

    await expect(chevron).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await trigger.hover();
    await expect(chevron).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });
});

test.describe("vehicle filters — category row hover/open states are navy or neutral, never cyan", () => {
  test("a closed row's rest/hover background and border are neutral, never cyan", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    const row = itemRow(trigger);

    const rest = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(rest).toBe(WHITE);

    await trigger.hover();
    const hovered = await row.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, border: cs.borderColor };
    });
    // Neutral surface tint, navy-tinted border — never the cyan
    // filterHeading (#007c91 -> "0, 124, 145") or accent (#39c0c3 ->
    // "57, 192, 195") tokens.
    expect(hovered.bg).not.toContain("124, 145");
    expect(hovered.bg).not.toContain("192, 195");
    expect(hovered.border).not.toContain("124, 145");
    expect(hovered.border).not.toContain("192, 195");
  });

  test("an open row's background/border are a restrained navy tint, unaffected by hover", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(trigger).toHaveAttribute("data-state", "open");
    const row = itemRow(trigger);

    // toHaveCSS auto-retries, so this also waits out the open/close
    // background-color transition rather than reading a mid-flight
    // interpolated value.
    await expect(row).toHaveCSS("background-color", "rgba(2, 56, 89, 0.05)");
    const openState = await row.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, border: cs.borderColor };
    });

    await trigger.hover();
    await expect(row).toHaveCSS("background-color", openState.bg);
    const openHovered = await row.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, border: cs.borderColor };
    });

    expect(openHovered).toEqual(openState);
    expect(openState.bg).not.toContain("124, 145");
    expect(openState.bg).not.toContain("192, 195");
  });
});

test.describe("vehicle filters — real vertical gap between category rows", () => {
  test("collapsed category rows have a real gap between them, not 0px", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const items = page.locator('aside [class*="rounded-xl"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(1);

    const firstBox = await items.nth(0).boundingBox();
    const secondBox = await items.nth(1).boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    const gap = secondBox!.y - (firstBox!.y + firstBox!.height);
    expect(gap).toBeGreaterThan(4);
  });
});

test.describe("vehicle filters — no decorative hover state sticks after a touch tap", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("tapping a row toggles its real open state cleanly, with no leftover hover tint", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const media = await page.evaluate(() => ({
      hoverHover: matchMedia("(hover: hover)").matches,
      pointerFine: matchMedia("(pointer: fine)").matches,
    }));
    expect(media.hoverHover).toBe(false);
    expect(media.pointerFine).toBe(false);

    const filtersButton = page.getByRole("button", { name: "Φίλτρα" }).first();
    await filtersButton.tap();

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    const row = itemRow(trigger);

    await expect(trigger).toHaveAttribute("data-state", "closed");
    await expect(row).toHaveCSS("background-color", WHITE);

    await trigger.tap();
    await expect(trigger).toHaveAttribute("data-state", "open");
    // Back to the exact original rest state — a touch tap never leaves a
    // hover-only tint (gated to `(hover: hover) and (pointer: fine)`,
    // which this device never satisfies) stuck behind. Also waits out the
    // AccordionTrigger click-lock (ui/accordion.tsx) so the next tap below
    // isn't swallowed while the open animation is still mid-flight.
    await expect(row).toHaveCSS("background-color", "rgba(2, 56, 89, 0.05)");
    const openBg = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(openBg).not.toBe(SURFACE);

    await trigger.tap();
    await expect(trigger).toHaveAttribute("data-state", "closed");
    await expect(row).toHaveCSS("background-color", WHITE);
  });
});

test.describe("vehicle filters — accordion open state is independent of active filter count", () => {
  test("clearing the last active filter (activeFilters -> 0) does not close other open dropdowns", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const yearTrigger = page.getByRole("button", { name: /Χρονολογία/ });
    const kmTrigger = page.getByRole("button", { name: /Χιλιόμετρα/ });
    await yearTrigger.scrollIntoViewIfNeeded();
    await yearTrigger.click();
    await expect(yearTrigger).toHaveAttribute("data-state", "open");
    await kmTrigger.click();
    await expect(kmTrigger).toHaveAttribute("data-state", "open");

    // Apply one filter in an unrelated section (fuel), so activeFilters
    // goes 0 -> 1 without touching year/km.
    const fuel = fuelTrigger(page);
    await fuel.scrollIntoViewIfNeeded();
    await fuel.click();
    const firstToggle = page.locator('button[aria-pressed]').first();
    await firstToggle.click();
    const activeCount = page.getByText(/Ενεργά φίλτρα: \d+/);
    await expect(activeCount).toHaveText("Ενεργά φίλτρα: 1");

    // Clear it via "Καθαρισμός όλων" — the exact action that used to force
    // every open section closed once activeFilters hit 0. `exact: true`
    // disambiguates from the end-of-results section's own clear action
    // ("Καθαρισμός όλων των φίλτρων"), a different button entirely.
    await page.getByRole("button", { name: "Καθαρισμός όλων", exact: true }).click();
    await expect(activeCount).toHaveCount(0); // the active-filters box only renders while chips.length > 0

    await expect(yearTrigger).toHaveAttribute("data-state", "open");
    await expect(kmTrigger).toHaveAttribute("data-state", "open");
  });

  test("applying then removing a filter within its OWN open section does not close that section", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const yearTrigger = page.getByRole("button", { name: /Χρονολογία/ });
    await yearTrigger.scrollIntoViewIfNeeded();
    await yearTrigger.click();
    await expect(yearTrigger).toHaveAttribute("data-state", "open");

    const minSelect = page.getByRole("combobox", { name: "Ελάχιστη χρονολογία" });
    await minSelect.click();
    await page.getByRole("option").nth(1).click(); // first real year (index 0 is "Χωρίς ελάχιστο")
    const activeCount = page.getByText(/Ενεργά φίλτρα: \d+/);
    await expect(activeCount).toHaveText("Ενεργά φίλτρα: 1");
    await expect(yearTrigger).toHaveAttribute("data-state", "open");

    // Remove that same filter -> activeFilters back to 0. The section that
    // owned the removed filter must stay open too — not just unrelated
    // sections — since accordion state is now fully independent of
    // whether any filter (anywhere) is active.
    await minSelect.click();
    await page.getByRole("option", { name: "Χωρίς ελάχιστο" }).click();
    await expect(activeCount).toHaveCount(0);

    await expect(yearTrigger).toHaveAttribute("data-state", "open");
  });

  test("Καθαρισμός όλων preserves every open section, including the one that held the cleared filter", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const yearTrigger = page.getByRole("button", { name: /Χρονολογία/ });
    const kmTrigger = page.getByRole("button", { name: /Χιλιόμετρα/ });
    await yearTrigger.scrollIntoViewIfNeeded();
    await yearTrigger.click();
    await kmTrigger.click();
    await expect(yearTrigger).toHaveAttribute("data-state", "open");
    await expect(kmTrigger).toHaveAttribute("data-state", "open");

    const minSelect = page.getByRole("combobox", { name: "Ελάχιστη χρονολογία" });
    await minSelect.click();
    await page.getByRole("option").nth(1).click();
    await expect(page.getByText(/Ενεργά φίλτρα: \d+/)).toHaveText("Ενεργά φίλτρα: 1");

    await page.getByRole("button", { name: "Καθαρισμός όλων", exact: true }).click();
    await expect(page.getByText(/Ενεργά φίλτρα: \d+/)).toHaveCount(0);

    await expect(yearTrigger).toHaveAttribute("data-state", "open");
    await expect(kmTrigger).toHaveAttribute("data-state", "open");
  });
});
