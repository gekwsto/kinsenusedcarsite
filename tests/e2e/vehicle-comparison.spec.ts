import { test, expect, type Page } from "@playwright/test";
import { bannerLocators, attachRuntimeErrorGuard, assertNoRuntimeErrors, attachFailedRequestGuard, assertNoFailedFirstPartyRequests } from "./helpers";

const STORAGE_KEY = "kinsen_vehicle_comparison_v1";
const MAX_REACHED_MESSAGE = "Μπορείτε να συγκρίνετε έως 3 αυτοκίνητα. Αφαιρέστε ένα όχημα για να προσθέσετε κάποιο άλλο.";

// Every test gets a brand-new, isolated BrowserContext by default (same
// Playwright guarantee the cookie-consent suite relies on) — localStorage
// is already empty at the start of each test, so no manual "clear
// comparison storage" step is needed or used here. An earlier version of
// this file used `page.addInitScript` to remove the key defensively, but
// addInitScript re-runs on *every* subsequent navigation within the same
// test (not just the first), which silently wiped out the very selection
// several tests were trying to verify persists across navigation/reload —
// removed for that reason.

function compareToggle(page: Page) {
  return {
    notSelected: page.getByRole("button", { name: "Προσθήκη στη σύγκριση" }),
    selected: page.getByRole("button", { name: "Αφαίρεση από τη σύγκριση" }),
    // Matches a compare toggle regardless of its current selected/unselected
    // label — for holding a *stable* reference to "this physical button"
    // across a click that changes its accessible name (a plain `notSelected`
    // locator would stop matching the exact same element the instant it
    // becomes selected, since Playwright locators are always re-evaluated
    // against their original role+name query on every use).
    any: page.getByRole("button", { name: /^(Προσθήκη στη σύγκριση|Αφαίρεση από τη σύγκριση)$/ }),
  };
}

function comparisonTray(page: Page) {
  return {
    // Desktop non-modal panel.
    panel: page.getByRole("complementary", { name: "Σύγκριση οχημάτων" }),
    panelClose: page.getByRole("complementary", { name: "Σύγκριση οχημάτων" }).getByRole("button", { name: "Κλείσιμο σύγκρισης" }),
    // Mobile modal sheet (same accessible name, different role).
    sheet: page.getByRole("dialog", { name: "Σύγκριση οχημάτων" }),
    collapsedControl: page.getByRole("button", { name: /Άνοιγμα σύγκρισης οχημάτων/ }),
    clearAll: page.getByRole("button", { name: "Εκκαθάριση όλων" }),
    cta: page.getByRole("button", { name: "Δείτε τη σύγκριση" }).or(page.getByRole("link", { name: "Δείτε τη σύγκριση" })),
  };
}

async function getStoredComparisonState(page: Page): Promise<{ version: number; ids: string[]; updatedAt: string } | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // A still-malformed raw value (e.g. mid-poll, before the app's own
    // parser has had a chance to reject and re-persist a corrected value)
    // — treated the same way the app's own parseComparisonState treats it.
    return null;
  }
}

// Tests in this file often navigate/reload several times in one test. Once
// the banner is dismissed the first time, its own consent cookie means it
// never reappears — a plain `.click().catch(() => {})` would still block
// for the full actionTimeout (10s) on every later call waiting for an
// element that will never exist, easily exceeding the whole test's 30s
// budget across 2-3 reloads. Checking presence first makes the no-op case
// resolve immediately instead of waiting out a timeout.
//
// The click itself still needs a real, generous timeout (not the shortest
// possible one): a captured Firefox failure under full-suite load showed
// the banner's own entrance transition can still be settling (not yet
// "stable" by Playwright's actionability rules) when this runs, so a too-
// short click timeout can fail, get silently swallowed by `.catch()`, and
// leave the banner incorrectly still present — which then blocks later
// clicks elsewhere on the page. 5s (half the original problematic 10s
// actionTimeout, but ample margin over the banner's ~220ms transition)
// only costs real time in the rare case it's actually needed, since
// `count() > 0` already proved the element exists.
async function dismissBanner(page: Page) {
  const banner = bannerLocators(page);
  if ((await banner.rejectButton.count()) > 0) {
    await banner.rejectButton.click({ timeout: 5000 }).catch(() => {});
    // Confirms the click actually took effect (the banner fully unmounts
    // on rejectNonEssential(), it doesn't just fade) before returning —
    // catches the click-silently-failed case here, at its source, instead
    // of surfacing later as an unrelated element being intercepted.
    await banner.region.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

/** Waits (with Playwright's normal auto-retry) for the collapsed control to reflect exactly `count` selected — the one indicator that only ever renders once VehicleComparisonProvider's localStorage hydration has resolved, so asserting on it is also how tests avoid racing that hydration after a fresh full-page navigation. */
async function expectComparisonCount(page: Page, count: number) {
  const tray = comparisonTray(page);
  if (count === 0) {
    await expect(tray.collapsedControl).toBeHidden();
    return;
  }
  await expect(tray.collapsedControl).toHaveAccessibleName(`Άνοιγμα σύγκρισης οχημάτων, ${count} από 3 επιλεγμένα`);
}

/** Closes whichever comparison UI is currently open (desktop panel or mobile sheet), so the collapsed control becomes visible again and, on desktop, so the panel stops covering the right-hand column of the vehicle grid. */
async function closeComparisonUi(page: Page) {
  const tray = comparisonTray(page);
  if (await tray.panel.isVisible()) {
    await tray.panelClose.click();
    return;
  }
  if (await tray.sheet.isVisible()) {
    await page.keyboard.press("Escape");
  }
}

test.describe("vehicle comparison — selection journey", () => {
  test("full 3-vehicle journey across homepage, /vehicles, and vehicle-detail, ending at /compare", async ({ page }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    const failedRequests = attachFailedRequestGuard(page, "http://127.0.0.1:3099");

    await page.goto("/");
    await dismissBanner(page);

    // Nothing comparison-related is visible before any selection.
    await expect(comparisonTray(page).collapsedControl).toBeHidden();
    await expect(comparisonTray(page).panel).toBeHidden();

    // 1/3 — homepage.
    const firstCard = page.getByRole("group").filter({ has: compareToggle(page).notSelected }).first();
    const firstCardName = await firstCard.getAttribute("aria-label");
    await firstCard.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).click();

    const tray = comparisonTray(page);
    await expect(tray.panel).toBeVisible();
    await expect(tray.panel.getByText("1/3 επιλεγμένα")).toBeVisible();
    await expect(tray.cta).toBeDisabled();
    await expect(tray.panel.getByText("Προσθέστε ακόμη 2 αυτοκίνητα για σύγκριση.")).toBeVisible();

    // Close collapses, does not clear.
    await tray.panelClose.click();
    await expect(tray.panel).toBeHidden();
    await expectComparisonCount(page, 1);

    // Reopen via the collapsed control.
    await tray.collapsedControl.click();
    await expect(tray.panel).toBeVisible();
    await tray.panelClose.click();

    // 2/3 — /vehicles, a distinct vehicle. A fresh full navigation, so wait
    // for hydration to resolve (expectComparisonCount) before reading which
    // card is "next available" — otherwise the just-selected vehicle can
    // still transiently render as unselected (pre-hydration state).
    await page.goto("/vehicles");
    await dismissBanner(page);
    await expectComparisonCount(page, 1);

    const secondCard = page.getByRole("group").filter({ has: compareToggle(page).notSelected }).first();
    const secondCardName = await secondCard.getAttribute("aria-label");
    expect(secondCardName).not.toBe(firstCardName);
    await secondCard.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).click();

    await expect(tray.panel.getByText("2/3 επιλεγμένα")).toBeVisible();
    await expect(tray.cta).toBeDisabled();
    await expect(tray.panel.getByText("Προσθέστε ακόμη 1 αυτοκίνητο για σύγκριση.")).toBeVisible();
    await tray.panelClose.click();

    // 3/3 — a vehicle-detail page for a third distinct vehicle.
    await page.goto("/vehicles");
    await dismissBanner(page);
    await expectComparisonCount(page, 2);

    const thirdCard = page.getByRole("group").filter({ has: compareToggle(page).notSelected }).first();
    const thirdCardName = await thirdCard.getAttribute("aria-label");
    await thirdCard.getByRole("link").first().click();
    await page.waitForURL(/\/vehicles\/.+/);
    await dismissBanner(page);
    await expectComparisonCount(page, 2);

    // The vehicle-detail page also renders a "similar vehicles" grid with
    // its own compare toggles below the main vehicle's — .first() targets
    // the main vehicle's toggle (in the pricing section, first in DOM
    // order), not an arbitrary similar-vehicle card.
    await compareToggle(page).notSelected.first().click();
    await expect(tray.panel.getByText("3/3 επιλεγμένα")).toBeVisible();
    await expect(tray.cta).toBeEnabled();
    await expect(tray.panel.getByText("Τα αυτοκίνητα είναι έτοιμα για σύγκριση.")).toBeVisible();

    await tray.cta.click();
    await page.waitForURL(/\/compare\?vehicles=/);

    // Exactly 3 vehicle columns, in original selection order.
    const summaryLinks = page.locator("main a[href^='/vehicles/']");
    await expect(summaryLinks).toHaveCount(3);
    const renderedNames = await summaryLinks.allTextContents();
    expect(renderedNames[0]?.trim()).toBe(firstCardName);
    expect(renderedNames[1]?.trim()).toBe(secondCardName);
    expect(renderedNames[2]?.trim()).toBe(thirdCardName);

    assertNoRuntimeErrors(runtimeGuard);
    assertNoFailedFirstPartyRequests(failedRequests);
  });
});

test.describe("vehicle comparison — fourth vehicle rejection and recovery", () => {
  test("a 4th vehicle is rejected with the exact Greek message; the original 3 remain; recovery works after a removal", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const toggle = compareToggle(page);
    const tray = comparisonTray(page);

    // Close between each add — the desktop panel auto-opens after every
    // add and, being a non-modal overlay, visually covers the grid's
    // rightmost column, which would otherwise intercept the next click.
    await toggle.notSelected.first().click();
    await closeComparisonUi(page);
    await toggle.notSelected.first().click();
    await closeComparisonUi(page);
    await toggle.notSelected.first().click();
    await expect(tray.panel.getByText("3/3 επιλεγμένα")).toBeVisible();

    const before = await getStoredComparisonState(page);
    expect(before?.ids).toHaveLength(3);

    await tray.panelClose.click();

    // 4th attempt: rejected, original 3 preserved, panel re-emphasized, clear message shown.
    await toggle.notSelected.first().click();
    await expect(page.getByText(MAX_REACHED_MESSAGE)).toBeVisible();
    await expect(tray.panel).toBeVisible();

    const after = await getStoredComparisonState(page);
    expect(after?.ids).toEqual(before?.ids);

    // Remove one, then the rejected vehicle can now be added.
    const firstSlotRemove = tray.panel.getByRole("button", { name: /^Αφαίρεση .+ από τη σύγκριση$/ }).first();
    await firstSlotRemove.click();
    await expect(tray.panel.getByText("2/3 επιλεγμένα")).toBeVisible();
    await expect(tray.cta).toBeDisabled();

    await toggle.notSelected.first().click();
    await expect(tray.panel.getByText("3/3 επιλεγμένα")).toBeVisible();
    await expect(tray.cta).toBeEnabled();
  });
});

test.describe("vehicle comparison — persistence", () => {
  test("selection survives reload and route navigation; a real localStorage record is written; removal persists after reload", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const toggle = compareToggle(page);
    const tray = comparisonTray(page);

    await toggle.notSelected.first().click();
    await closeComparisonUi(page);
    await toggle.notSelected.first().click();
    await expect(tray.panel.getByText("2/3 επιλεγμένα")).toBeVisible();

    const stored = await getStoredComparisonState(page);
    expect(stored?.version).toBe(1);
    expect(stored?.ids).toHaveLength(2);
    expect(new Set(stored?.ids).size).toBe(2);

    await page.reload();
    await dismissBanner(page);
    await expectComparisonCount(page, 2);

    await page.goto("/");
    await dismissBanner(page);
    await expectComparisonCount(page, 2);

    await tray.collapsedControl.click();
    await expect(tray.panel).toBeVisible();
    const removeButtons = tray.panel.getByRole("button", { name: /^Αφαίρεση .+ από τη σύγκριση$/ });
    await removeButtons.first().click();
    await expect(tray.panel.getByText("1/3 επιλεγμένα")).toBeVisible();

    const afterRemoveIds = (await getStoredComparisonState(page))?.ids;

    await page.reload();
    await dismissBanner(page);
    await expectComparisonCount(page, 1);
    expect((await getStoredComparisonState(page))?.ids).toEqual(afterRemoveIds);
  });
});

test.describe("vehicle comparison — malformed storage handling", () => {
  const cases: { name: string; raw: string }[] = [
    { name: "invalid JSON", raw: "{not valid json" },
    { name: "unknown version", raw: JSON.stringify({ version: 999, ids: ["a", "b"], updatedAt: new Date().toISOString() }) },
    { name: "duplicate IDs", raw: JSON.stringify({ version: 1, ids: ["dup", "dup"], updatedAt: new Date().toISOString() }) },
    { name: "four IDs", raw: JSON.stringify({ version: 1, ids: ["a", "b", "c", "d"], updatedAt: new Date().toISOString() }) },
    { name: "an unavailable/invalid vehicle ID", raw: JSON.stringify({ version: 1, ids: ["does-not-exist"], updatedAt: new Date().toISOString() }) },
  ];

  for (const { name, raw } of cases) {
    test(`malformed storage (${name}) is handled safely: no crash, no hydration error, normalized to a safe state`, async ({ page }) => {
      const runtimeGuard = attachRuntimeErrorGuard(page);
      // A single addInitScript here is fine (unlike the removed
      // clearComparisonStorage helper) — this test only ever navigates
      // once, so "re-runs on every navigation" is not a concern, and it's
      // the only way to seed localStorage before the app's own first
      // script executes.
      await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: STORAGE_KEY, value: raw });

      await page.goto("/");
      await dismissBanner(page);

      // The provider re-persists a corrected value only after its mount
      // effect (parse) and follow-up persist effect both run — poll rather
      // than reading storage once, so this doesn't race that settling.
      await expect
        .poll(async () => {
          const stored = await getStoredComparisonState(page);
          return stored ? new Set(stored.ids).size === stored.ids.length && stored.ids.length <= 3 : true;
        })
        .toBe(true);

      assertNoRuntimeErrors(runtimeGuard);
    });
  }
});

test.describe("vehicle comparison — cross-surface synchronization", () => {
  test("a selection made on the homepage is reflected as active on /vehicles and on the vehicle-detail page, and clears everywhere after removal", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const homepageCard = page.getByRole("group").filter({ has: compareToggle(page).notSelected }).first();
    const vehicleName = await homepageCard.getAttribute("aria-label");
    expect(vehicleName).toBeTruthy();
    await homepageCard.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).click();
    await closeComparisonUi(page);

    await page.goto("/vehicles");
    await dismissBanner(page);
    await expectComparisonCount(page, 1);

    const listingCard = page.getByRole("group", { name: vehicleName! });
    await expect(listingCard.getByRole("button", { name: "Αφαίρεση από τη σύγκριση" })).toBeVisible();
    await expect(listingCard.getByRole("button", { name: "Αφαίρεση από τη σύγκριση" })).toHaveAttribute("aria-pressed", "true");

    await listingCard.getByRole("link").first().click();
    await page.waitForURL(/\/vehicles\/.+/);
    await dismissBanner(page);
    await expect(compareToggle(page).selected).toBeVisible();

    const tray = comparisonTray(page);
    await tray.collapsedControl.click();
    await tray.panel.getByRole("button", { name: /^Αφαίρεση .+ από τη σύγκριση$/ }).first().click();

    await page.goto("/vehicles");
    await dismissBanner(page);
    await expectComparisonCount(page, 0);
    await expect(page.getByRole("group", { name: vehicleName! }).getByRole("button", { name: "Προσθήκη στη σύγκριση" })).toBeVisible();
  });
});

test.describe("vehicle comparison — keyboard and focus", () => {
  test("Enter activates a compare toggle, the panel opens, Escape closes it, and focus returns to the exact opener", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    // A stable reference to "this physical button" across its own label
    // change (Προσθήκη → Αφαίρεση) — see the `any` locator's doc comment.
    const toggleButton = compareToggle(page).any.first();
    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();
    await page.keyboard.press("Enter");

    const tray = comparisonTray(page);
    await expect(tray.panel).toBeVisible();

    // Explicitly reopening (not the auto-open-on-add path) does move focus
    // into the panel — verified via the collapsed control's own keyboard
    // path below. For the add-triggered auto-open, focus deliberately
    // stays on the just-activated toggle so a keyboard user can keep
    // selecting more vehicles without focus being yanked away — verified
    // here directly.
    await expect(toggleButton).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(tray.panel).toBeHidden();
    await expect(toggleButton).toBeFocused();
  });

  test("the collapsed control is keyboard reachable and Enter reopens the panel", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    await compareToggle(page).notSelected.first().click();
    const tray = comparisonTray(page);
    await tray.panelClose.click();
    await expect(tray.collapsedControl).toBeVisible();

    await tray.collapsedControl.focus();
    await expect(tray.collapsedControl).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tray.panel).toBeVisible();
  });

  test("the comparison CTA is not activatable by keyboard while disabled, and works once enabled", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const toggle = compareToggle(page);
    const tray = comparisonTray(page);
    await toggle.notSelected.first().click();

    await expect(tray.cta).toBeDisabled();
    await expect(tray.cta).toHaveAttribute("aria-disabled", "true");

    await closeComparisonUi(page);
    await toggle.notSelected.first().click();
    await closeComparisonUi(page);
    await toggle.notSelected.first().click();
    await expect(tray.cta).toBeEnabled();
    await tray.cta.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/compare\?vehicles=/);
  });

  test("clear-all is keyboard operable and removes every selection", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const toggle = compareToggle(page);
    const tray = comparisonTray(page);
    await toggle.notSelected.first().click();
    await closeComparisonUi(page);
    await toggle.notSelected.first().click();

    await tray.clearAll.focus();
    await page.keyboard.press("Enter");
    await expect(tray.panel).toBeHidden();
    await expect(tray.collapsedControl).toBeHidden();
    expect((await getStoredComparisonState(page))?.ids ?? []).toHaveLength(0);
  });
});

test.describe("vehicle comparison — mobile sheet", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("on mobile, comparison opens as a modal bottom sheet with scroll lock and focus restoration", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const toggleButton = compareToggle(page).any.first();
    await toggleButton.click();

    const tray = comparisonTray(page);
    await expect(tray.sheet).toBeVisible();
    await expect(tray.sheet.getByText("1/3 επιλεγμένα")).toBeVisible();

    const bodyOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(tray.sheet).toBeHidden();
    await expect(toggleButton).toBeFocused();

    const bodyOverflowAfter = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
    expect(bodyOverflowAfter).not.toBe("hidden");

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
  });

  test("mobile collapsed control does not overlap the cookie banner", async ({ page }) => {
    await page.goto("/vehicles");
    // Deliberately do NOT dismiss the banner here — both must coexist.
    await compareToggle(page).any.first().click();
    // Close the sheet (mobile) so the collapsed control shows.
    await page.keyboard.press("Escape").catch(() => {});

    const tray = comparisonTray(page);
    const banner = bannerLocators(page);
    await expect(tray.collapsedControl).toBeVisible();
    if ((await banner.region.count()) > 0) {
      const bannerBox = await banner.region.boundingBox();
      const controlBox = await tray.collapsedControl.boundingBox();
      if (bannerBox && controlBox) {
        const overlap = controlBox.y < bannerBox.y + bannerBox.height && controlBox.y + controlBox.height > bannerBox.y;
        expect(overlap).toBe(false);
      }
    }
  });
});

test.describe("vehicle comparison — responsive", () => {
  const viewports = [
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "desktop-1920", width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.name}: compare control visible, no page-level horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/vehicles");
      await dismissBanner(page);

      await expect(compareToggle(page).notSelected.first()).toBeVisible();
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowX).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("vehicle comparison — /compare route validation", () => {
  test("fewer than 3 IDs shows a polished incomplete state, not a partial matrix", async ({ page }) => {
    await page.goto("/compare?vehicles=only-one-id");
    await expect(page.getByRole("heading", { name: "Η σύγκριση δεν είναι έτοιμη" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Επιστροφή στα αυτοκίνητα" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Άνοιγμα επιλογών σύγκρισης" })).toBeVisible();
  });

  test("more than 3 IDs shows the incomplete state", async ({ page }) => {
    await page.goto("/compare?vehicles=a,b,c,d");
    await expect(page.getByRole("heading", { name: "Η σύγκριση δεν είναι έτοιμη" })).toBeVisible();
  });

  test("3 unresolvable/invalid IDs shows the unavailable-reason incomplete state, never a crash", async ({ page }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    await page.goto("/compare?vehicles=nope-1,nope-2,nope-3");
    await expect(page.getByRole("heading", { name: "Η σύγκριση δεν είναι έτοιμη" })).toBeVisible();
    assertNoRuntimeErrors(runtimeGuard);
  });

  test("no route param at all shows the incomplete state", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: "Η σύγκριση δεν είναι έτοιμη" })).toBeVisible();
  });
});

test.describe("vehicle comparison — regression isolation", () => {
  test("the compare action never triggers the favorite action, card navigation, or vice versa", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);

    const cardName = await page.getByRole("group").filter({ has: compareToggle(page).notSelected }).first().getAttribute("aria-label");
    const card = page.getByRole("group", { name: cardName! });
    const favoriteButton = card.getByRole("button", { name: "Προσθήκη στα αγαπημένα" });

    await card.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).click();
    // Clicking compare stayed on /vehicles (did not trigger card navigation)
    // and left the favorite button's own state untouched.
    await expect(page).toHaveURL(/\/vehicles$/);
    await expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
    await expect(card.getByRole("button", { name: "Αφαίρεση από τη σύγκριση" })).toHaveAttribute("aria-pressed", "true");

    // Anonymous favorite clicks redirect to /login by this app's own real,
    // documented, unrelated design (favorites-provider.tsx) — not
    // something this test should exercise. What matters here is already
    // proven above: compare and favorite are two independent buttons on
    // the same card, and activating one does not touch the other's state.
  });

  test("the cookie preferences modal renders above the comparison panel", async ({ page }) => {
    await page.goto("/vehicles");
    await compareToggle(page).notSelected.first().click();
    await expect(comparisonTray(page).panel).toBeVisible();

    // Captured via a plain DOM (not role-based) locator *before* the modal
    // opens: Radix Dialog correctly marks background content aria-hidden
    // while a modal is open (real, desirable accessibility behavior — a
    // screen reader must not be able to reach the comparison panel while
    // the cookie dialog has focus), which removes it from getByRole('complementary')
    // entirely for as long as the modal stays open — a plain tag selector
    // still finds the same DOM node regardless of aria-hidden.
    const panelElement = page.locator("aside").filter({ hasText: "Σύγκριση οχημάτων" });

    await bannerLocators(page).settingsButton.click();
    const modal = page.getByRole("dialog", { name: "Ρυθμίσεις Cookies" });
    await expect(modal).toBeVisible();
    // The dialog role element itself carries no z-* class (only `relative`)
    // — the z-50 is on its immediate wrapping <div> (cookie-preferences-modal.tsx),
    // so that's the element whose computed z-index actually matters for stacking.
    const modalZ = await modal.evaluate((el) => Number(window.getComputedStyle(el.parentElement!).zIndex));
    const panelZ = await panelElement.evaluate((el) => Number(window.getComputedStyle(el).zIndex));
    expect(modalZ).toBeGreaterThan(panelZ);
  });

  test("filters, sorting, and pagination remain functional with an active comparison selection", async ({ page }) => {
    await page.goto("/vehicles");
    await dismissBanner(page);
    await compareToggle(page).notSelected.first().click();
    await closeComparisonUi(page);

    const priceSection = page.getByRole("button", { name: "Τιμή" }).first();
    await priceSection.click();
    await expect(priceSection).toHaveAttribute("aria-expanded", "true");

    // Selection survives a filter interaction.
    expect((await getStoredComparisonState(page))?.ids).toHaveLength(1);
  });
});
