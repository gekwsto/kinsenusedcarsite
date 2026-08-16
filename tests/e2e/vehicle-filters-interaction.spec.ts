import { test, expect, type Page } from "@playwright/test";
import { bannerLocators } from "./helpers";

// Locks the /vehicles Filters panel's interaction-hardening contract:
// - every interactive control's focus ring renders *inside* its own
//   border box (never clipped by AccordionContent's load-bearing
//   `overflow-hidden`, which the open/close animation depends on);
// - a section's category icon/chevron color is driven by exactly one
//   authoritative rule per state (open vs. closed), so hovering an
//   already-open row can never revert it toward another color;
// - decorative row hover tinting only ever activates on a genuine
//   fine-pointer/hover-capable device, never sticking after a touch tap.
// See src/components/vehicles/filter-typography.ts (FILTER_FOCUS_CLASS,
// FILTER_TRIGGER_CLASS) and vehicle-filters.tsx (ITEM_CLASS,
// FilterSectionHeading) for the implementation these assert against.

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

function iconSpan(trigger: ReturnType<typeof fuelTrigger>) {
  return trigger.locator("span > span").first();
}

function chevronSpan(trigger: ReturnType<typeof fuelTrigger>) {
  return trigger.locator(":scope > span:last-child");
}

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

test.describe("vehicle filters — deterministic icon/chevron color, no flicker", () => {
  test("an open section's icon is a stable white-on-navy that hovering the row cannot revert", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(trigger).toHaveAttribute("data-state", "open");

    const icon = iconSpan(trigger);
    // toHaveCSS auto-retries, so this also waits out the 150ms
    // background-color/color transition rather than reading a mid-flight
    // interpolated value.
    await expect(icon).toHaveCSS("background-color", NAVY);
    await expect(icon).toHaveCSS("color", WHITE);
    const before = await icon.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });

    await trigger.hover();
    const afterHover = await icon.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    // Open + hover must resolve to the exact same values as open alone —
    // if a second, competing rule were still targeting this property,
    // hovering would visibly change at least one of these.
    expect(afterHover).toEqual(before);
  });

  test("the chevron is deep navy while open, unaffected by hover, and never the cyan filterHeading token", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(trigger).toHaveAttribute("data-state", "open");

    const chevron = chevronSpan(trigger);
    await expect(chevron).toHaveCSS("color", NAVY);

    await trigger.hover();
    await expect(chevron).toHaveCSS("color", NAVY); // unchanged — one authoritative source, not two competing ones
  });

  test("a closed section's icon container is the neutral surface token, never the cyan filterHeading token", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const trigger = fuelTrigger(page);
    await expect(trigger).toHaveAttribute("data-state", "closed");

    const icon = iconSpan(trigger);
    const bg = await icon.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe(SURFACE);
    expect(bg).not.toContain("124, 145"); // #007c91 (filterHeading) — the cyan-family token this replaces
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
    const icon = iconSpan(trigger);

    await expect(trigger).toHaveAttribute("data-state", "closed");
    await expect(icon).toHaveCSS("background-color", SURFACE);

    await trigger.tap();
    await expect(trigger).toHaveAttribute("data-state", "open");
    await expect(icon).toHaveCSS("background-color", NAVY);
    await expect(icon).toHaveCSS("color", WHITE);

    await trigger.tap();
    await expect(trigger).toHaveAttribute("data-state", "closed");
    // Back to the exact original rest state — a touch tap never leaves a
    // hover-only tint (gated to `(hover: hover) and (pointer: fine)`,
    // which this device never satisfies) stuck behind.
    await expect(icon).toHaveCSS("background-color", SURFACE);
    await expect(icon).toHaveCSS("color", NAVY);
  });
});
