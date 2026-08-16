import { test, expect, type Page } from "@playwright/test";
import { bannerLocators } from "./helpers";

// Locks the premium-corporate refinement contract for the comparison
// launcher/panel: the launcher sits flush against the viewport's right
// edge (never centered) with a minimal gutter, and has a three-state
// relationship with the real global Footer (see
// useFooterAwareCompareState in vehicle-comparison-tray.tsx, backed by
// the pure calculateCompareFooterState in
// src/lib/compare-footer-state.ts) built on a baseline/extra split:
// `baselineLift` is the lift the page's natural, unscrolled geometry
// already requires (derived from the Footer's document-space position —
// can legitimately be large on a short page / tall viewport, and must
// NEVER by itself hide the launcher) and `extraLift` is the additional
// lift caused by the user actually scrolling further (small, bounded by
// `maxExtraLift`, the only quantity that can ever retire the launcher).
// "normal" = neither baseline nor extra lift is needed; "avoiding" =
// some lift is needed (baseline, extra, or both) and it's visible/
// interactive either way; "hidden" = extraLift alone has exceeded its
// bounded budget. This is what lets a page short enough that the Footer
// is already close at page-top (the /contact reproduction case) still
// show the launcher at every viewport, including very large desktop
// displays where the natural baseline is large — while still never
// letting it chase the Footer indefinitely as the user scrolls. The
// panel header's "Εκκαθάριση όλων" and the close X are geometrically
// distinct (never overlapping, at any viewport), and both the launcher
// and the panel's "Δείτε τη σύγκριση" CTA reuse the same static Kinsen
// corporate CTA — solid navy at rest, unchanged on hover, never cyan
// (see kinsen-cta-button.tsx).

const PRIMARY_NAVY = "rgb(2, 56, 89)"; // primary
const PRIMARY_DARK = "rgb(1, 38, 56)"; // primary-dark — the CTA's own border color
const WHITE = "rgb(255, 255, 255)";

async function dismissBanner(page: Page) {
  const banner = bannerLocators(page);
  // The banner mounts client-side after a short delay — checking count()
  // immediately races that mount (a 0 count can mean "not mounted yet",
  // not "no banner"), which then leaves it to intercept a later click.
  const appeared = await banner.region
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await banner.rejectButton.click({ timeout: 5000 }).catch(() => {});
    await banner.region.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

/** Adds the first available vehicle to the comparison via its card toggle — the same real interaction users perform, not a localStorage shortcut. */
async function addFirstVehicleToComparison(page: Page) {
  await page.goto("/vehicles");
  await dismissBanner(page);
  const addBtn = page.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).first();
  await addBtn.waitFor({ state: "visible" });
  await addBtn.click();
}

function launcherLocator(page: Page) {
  return page.getByRole("button", { name: /Άνοιγμα σύγκρισης οχημάτων/ });
}

// A role-independent locator for the footer-visibility tests below: once
// the Footer is in view the launcher correctly gets `aria-hidden="true"`
// (see vehicle-comparison-tray.tsx's CollapsedControl) — which removes it
// from the accessibility tree, so `getByRole` above stops matching it by
// design. This CSS attribute locator keeps finding the same element
// regardless of its aria-hidden state, needed to assert the hidden values
// themselves.
function launcherLocatorAlways(page: Page) {
  return page.locator('button[aria-label^="Άνοιγμα σύγκρισης οχημάτων"]');
}

async function scrollToFooter(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
}

async function scrollToTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

interface LauncherReadout {
  opacity: string;
  pointerEvents: string;
  ariaHidden: string | null;
  tabIndex: number;
  /** Upward translateY distance in px (0 = normal position, unlifted). */
  lift: number;
}

/** Reads the launcher's full visual/interaction state, including the current upward "avoiding" lift (parsed from its own transform matrix). */
async function readLauncher(page: Page): Promise<LauncherReadout> {
  return page.evaluate(() => {
    const btn = document.querySelector('button[aria-label^="Άνοιγμα σύγκρισης οχημάτων"]') as HTMLButtonElement;
    const cs = getComputedStyle(btn);
    const match = /matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[\d.]+)\)/.exec(cs.transform);
    const lift = match?.[1] ? Math.round(-parseFloat(match[1])) : 0;
    return {
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      ariaHidden: btn.getAttribute("aria-hidden"),
      tabIndex: btn.tabIndex,
      lift,
    };
  });
}

test.describe("comparison launcher — right-anchored Kinsen CTA geometry", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("is fixed to the right edge, never centered, with a structured (non-pill) radius", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    // Adding a vehicle auto-opens the panel; close it so the collapsed
    // launcher (only rendered while the panel is closed) becomes visible.
    await page.keyboard.press("Escape");

    const launcher = launcherLocator(page);
    await expect(launcher).toBeVisible();

    // `position: fixed` lives directly on the launcher button itself — the
    // static CTA has no separate wrapper/depth-layer element anymore.
    const [box, position, radius] = await Promise.all([
      launcher.boundingBox(),
      launcher.evaluate((el) => getComputedStyle(el).position),
      launcher.evaluate((el) => getComputedStyle(el).borderRadius),
    ]);
    expect(position).toBe("fixed");
    // Flush against the viewport's right edge — a minimal (env-safe-area
    // aware) gutter, not the old generous breakpoint-scaled spacing and
    // nowhere near centered.
    const distanceFromRight = 1440 - (box!.x + box!.width);
    expect(distanceFromRight).toBeLessThan(20);
    expect(distanceFromRight).toBeGreaterThan(0);
    // Structured corporate radius (rounded-md family), not rounded-full.
    expect(radius).not.toBe("9999px");
    expect(parseFloat(radius)).toBeLessThan(16);
  });

  test("solid navy at rest, unchanged on hover — no cyan, no color shift", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");

    const launcher = launcherLocator(page);
    await expect(launcher).toHaveCSS("background-color", PRIMARY_NAVY);
    await expect(launcher).toHaveCSS("color", WHITE);
    await expect(launcher).toHaveCSS("border-color", PRIMARY_DARK);

    await launcher.hover();
    // The static CTA contract: hover must not change background, text, or
    // border color at all — no animated fill, no darkening.
    await expect(launcher).toHaveCSS("background-color", PRIMARY_NAVY);
    await expect(launcher).toHaveCSS("color", WHITE);
    await expect(launcher).toHaveCSS("border-color", PRIMARY_DARK);
  });

  test("shows the real dynamic selected count, not a fixed label", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");

    await expect(launcherLocator(page)).toHaveAccessibleName("Άνοιγμα σύγκρισης οχημάτων, 1 από 3 επιλεγμένα");
    await expect(launcherLocator(page)).toContainText("1/3");
  });
});

test.describe("comparison launcher — responsive right gutter", () => {
  const viewports = [
    ["small-phone-320", 320, 568],
    ["phone-390", 390, 844],
    ["tablet-768", 768, 1024],
    ["desktop-1440", 1440, 900],
    ["large-desktop-1920", 1920, 1080],
  ] as const;

  for (const [label, width, height] of viewports) {
    test(`${label}: launcher stays right-anchored with no page-level horizontal overflow`, async ({ page }) => {
      // Dismiss the banner and add the vehicle at a stable default
      // viewport first, then resize to the target size — resizing before
      // the banner has finished its own dismiss transition/re-render (it
      // measures and adapts its height to viewport width, see
      // vehicle-comparison-tray.tsx's useCookieBannerClearance comment)
      // was racy and could leave it still intercepting clicks.
      await addFirstVehicleToComparison(page);
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(200);

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowX).toBeLessThanOrEqual(1);

      const launcher = launcherLocator(page);
      await expect(launcher).toBeVisible();
      const box = await launcher.boundingBox();
      const distanceFromRight = width - (box!.x + box!.width);
      const distanceFromLeft = box!.x;
      // Right-anchored: much closer to the right edge than the left —
      // the geometric signature that distinguishes it from centering.
      expect(distanceFromRight).toBeLessThan(distanceFromLeft);
    });
  }
});

test.describe("comparison launcher — three-state Footer relationship (normal / avoiding / hidden)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("normal: no Footer interference means lift 0 and the launcher's exact approved fixed position", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");

    const launcher = launcherLocatorAlways(page);
    await expect(launcher).toBeVisible();
    const readout = await readLauncher(page);
    expect(readout).toMatchObject({ opacity: "1", pointerEvents: "auto", ariaHidden: null, tabIndex: 0, lift: 0 });
  });

  test("long page (/vehicles): progresses normal → avoiding → hidden while scrolling down, with a bounded (never huge) lift and no backward jump, then reverses cleanly back to normal", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");

    let sawNormal = false;
    let sawAvoiding = false;
    let sawHidden = false;
    let maxLiftObserved = 0;
    let previousLiftWhileVisible = 0;

    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    // Under the baseline/extra model, the visible "avoiding" band on a
    // long page (baselineLift 0) is only as wide as maxExtraLift itself —
    // a small, deliberately bounded budget (~64-140px), not the old,
    // much larger total-lift cap. A coarse scan can step clean over that
    // narrow band in one jump; enough steps to keep each one well under
    // the smallest possible maxExtraLift ensures at least one step lands
    // inside it.
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const target = Math.round((pageHeight * i) / steps);
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), target);
      await page.waitForTimeout(60);
      const readout = await readLauncher(page);
      if (readout.opacity === "1" && readout.lift === 0) sawNormal = true;
      if (readout.opacity === "1" && readout.lift > 0) sawAvoiding = true;
      if (readout.opacity === "0") sawHidden = true;
      if (readout.opacity === "1") {
        expect(readout.lift, `lift decreased while scrolling further down at ${target}/${pageHeight}`).toBeGreaterThanOrEqual(previousLiftWhileVisible);
        previousLiftWhileVisible = readout.lift;
        maxLiftObserved = Math.max(maxLiftObserved, readout.lift);
      }
    }

    expect(sawNormal, "expected a normal (unlifted) state near the top").toBe(true);
    expect(sawAvoiding, "expected an avoiding (lifted, still visible) state as the Footer approached").toBe(true);
    expect(sawHidden, "expected a hidden state once the Footer was fully scrolled into view").toBe(true);
    // /vehicles has baselineLift 0 at its own top (a long page, not the
    // short-page case) — every bit of visible lift here is extraLift, so
    // this bound is the small, bounded maxExtraLift budget itself (see
    // COMPARE_FOOTER_MAX_EXTRA_LIFT_CAP), not the old, much larger
    // total-lift cap.
    expect(maxLiftObserved).toBeLessThan(200);

    await scrollToTop(page);
    // The lift is applied inside a rAF-scheduled measurement (see
    // useFooterAwareCompareState), not synchronously with the scroll
    // itself — poll for that one scheduled frame to land.
    await expect.poll(() => readLauncher(page)).toMatchObject({ opacity: "1", lift: 0 });
  });

  test("a hidden launcher is non-interactive: pointer-events disabled, removed from the tab order and the accessibility tree, and a forced click never opens the panel", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await scrollToFooter(page);

    const launcher = launcherLocatorAlways(page);
    await expect(launcher).toHaveCSS("opacity", "0");
    const readout = await readLauncher(page);
    expect(readout.pointerEvents).toBe("none");
    expect(readout.ariaHidden).toBe("true");
    expect(readout.tabIndex).toBe(-1);

    // `force: true` bypasses Playwright's own actionability wait but the
    // real click is still dispatched through the browser's own
    // hit-testing, which correctly ignores a `pointer-events: none` element.
    await launcher.click({ force: true, timeout: 3000 }).catch(() => {});
    const panel = page.locator('[role="complementary"][aria-labelledby]');
    await expect(panel).toBeHidden();
  });

  test("a launcher in the avoiding state remains fully interactive: normal aria semantics, keyboard reachable, click opens the panel", async ({ page }) => {
    // 1920x1080: /contact's real baselineLift here is a measured, nonzero
    // ~152px (a large-desktop viewport tall enough that the launcher's
    // normal fixed position collides with the Footer's document-space top
    // even before any scrolling) — a reliable way to exercise "avoiding"
    // at page-load. 1440x900 has a measured baselineLift of 0 on this
    // page (normal, not avoiding) and is intentionally not used here.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await page.goto("/contact");

    const launcher = launcherLocatorAlways(page);
    await expect(launcher).toBeVisible();
    // The initial measurement runs synchronously (useLayoutEffect) on
    // mount, but mount itself only happens after hydration — poll rather
    // than assume it's already landed on the very next microtask after
    // navigation.
    await expect.poll(() => readLauncher(page).then((r) => r.lift), {
      message: "expected /contact at 1920x1080 to require a nonzero baselineLift, and thus start in 'avoiding'",
    }).toBeGreaterThan(0);
    const readout = await readLauncher(page);
    expect(readout.opacity).toBe("1");
    expect(readout.pointerEvents).toBe("auto");
    expect(readout.ariaHidden).toBeNull();
    expect(readout.tabIndex).toBe(0);

    await launcher.click();
    const panel = page.locator('[role="complementary"][aria-labelledby]');
    await expect(panel).toBeVisible();
  });

  test("the dynamic count and click-to-open remain correct after a full hide/show cycle", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    const secondAdd = page.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).first();
    await secondAdd.click();
    await page.keyboard.press("Escape");

    await scrollToFooter(page);
    await scrollToTop(page);

    const launcher = launcherLocator(page); // back in the a11y tree now that it's visible again
    await expect(launcher).toHaveAccessibleName("Άνοιγμα σύγκρισης οχημάτων, 2 από 3 επιλεγμένα");
    await expect(launcher).toContainText("2/3");

    await launcher.click();
    const panel = page.locator('[role="complementary"][aria-labelledby]');
    await expect(panel).toBeVisible();
  });

  test("no page-level horizontal overflow is introduced by the tight right-edge gutter", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
  });
});

// Locks the exact primary bug fix: the launcher must NEVER start hidden
// on a normal short page merely because the page's natural, unscrolled
// geometry (baselineLift) already requires some lift — no matter how
// large that baseline is. Only excessive *additional* scroll-driven lift
// (extraLift, bounded by maxExtraLift — see its own comment in
// src/lib/compare-footer-state.ts) may ever hide it. Covers the full
// required viewport matrix from small phones through very large desktop
// displays (2560x1440/2560x1600), where a short page's baseline is at
// its largest.
test.describe("comparison launcher — the /contact short-page reproduction case", () => {
  const viewportsWhereContactFitsWithoutScrolling = [
    ["320x568", 320, 568],
    ["375x812", 375, 812],
    ["390x844", 390, 844],
    ["768x1024", 768, 1024],
    ["1024x768", 1024, 768],
    ["1280x720", 1280, 720],
    ["1366x768", 1366, 768],
    ["1440x900", 1440, 900],
    ["1536x864", 1536, 864],
    ["1920x1080", 1920, 1080],
    ["2560x1440", 2560, 1440],
    ["2560x1600", 2560, 1600],
  ] as const;

  for (const [label, width, height] of viewportsWhereContactFitsWithoutScrolling) {
    test(`${label}: launcher is visible on initial load (normal or avoiding, never hidden), fully interactive`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await addFirstVehicleToComparison(page);
      await page.keyboard.press("Escape");
      await page.goto("/contact");
      await page.waitForTimeout(400);

      const launcher = launcherLocatorAlways(page);
      await expect(launcher).toBeVisible();
      const readout = await readLauncher(page);
      expect(readout.opacity, `launcher must not start hidden on /contact at ${label}`).toBe("1");
      expect(readout.pointerEvents).toBe("auto");
      expect(readout.ariaHidden).toBeNull();
      expect(readout.tabIndex).toBe(0);
      // No upper bound asserted on `lift` here — under the baseline/extra
      // model an arbitrarily large baselineLift is expected and correct
      // at the largest viewports (see the dedicated "huge baseline never
      // hides" test below); the only thing this test locks is visibility.

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowX).toBeLessThanOrEqual(1);
    });
  }

  test("2560x1440: a genuinely large baselineLift alone (no extra scroll at all) never hides the launcher — the central rule this architecture exists to guarantee", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await page.goto("/contact");
    await page.waitForTimeout(400);

    const readout = await readLauncher(page);
    // A measured, large baseline (~299px at this viewport) — proves this
    // is genuinely exercising the "large baseline" case, not accidentally
    // landing on a zero-lift viewport.
    expect(readout.lift, "expected a large nonzero baselineLift at 2560x1440").toBeGreaterThan(200);
    expect(readout.opacity).toBe("1");
    expect(readout.pointerEvents).toBe("auto");
    expect(readout.ariaHidden).toBeNull();
    expect(readout.tabIndex).toBe(0);
  });

  test("full acceptance sequence at 1920x1080 (nonzero baselineLift): visible at load → scrolling deeper eventually hides it once extraLift exceeds budget → scrolling back up restores EXACTLY the original baseline position, not merely lift 0", async ({ page }) => {
    // Deliberately a viewport with a measured nonzero baselineLift
    // (~152px) so this sequence actually proves the distinction the user
    // called out: returning to "the top" must restore the *baseline*
    // position, not the raw unlifted bottom-fixed position.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await page.goto("/contact");
    await page.waitForTimeout(400);

    const launcher = launcherLocatorAlways(page);
    const initialReadout = await readLauncher(page);
    expect(initialReadout.opacity).toBe("1"); // visible at load
    expect(initialReadout.lift, "expected a nonzero baselineLift at 1920x1080").toBeGreaterThan(0);
    const baselineLift = initialReadout.lift;
    const normalBox = await launcher.boundingBox();

    await scrollToFooter(page); // scroll deep enough that extraLift exceeds maxExtraLift
    await expect(launcher).toHaveCSS("opacity", "0");
    const hiddenReadout = await readLauncher(page);
    expect(hiddenReadout.pointerEvents).toBe("none");
    expect(hiddenReadout.ariaHidden).toBe("true");
    expect(hiddenReadout.tabIndex).toBe(-1);

    await scrollToTop(page);
    await expect(launcher).toHaveCSS("opacity", "1");
    // Must settle back to the *baseline* lift/position exactly — not 0 —
    // since scrolling to the document top makes extraLift 0 again, but
    // baselineLift (the page's own natural geometry) is still real.
    await expect.poll(() => readLauncher(page).then((r) => r.lift)).toBe(baselineLift);
    const backBox = await launcher.boundingBox();
    expect(Math.round(backBox!.x)).toBe(Math.round(normalBox!.x));
    expect(Math.round(backBox!.y)).toBe(Math.round(normalBox!.y));

    // selected comparison count is untouched by any of the above.
    await expect(launcherLocator(page)).toHaveAccessibleName("Άνοιγμα σύγκρισης οχημάτων, 1 από 3 επιλεγμένα");
  });

  test("on mobile widths, /contact's taller reflow naturally starts in the normal (unlifted) state — the model needs no route-specific handling either way", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await page.goto("/contact");
    await page.waitForTimeout(400);

    const launcher = launcherLocatorAlways(page);
    await expect(launcher).toBeVisible();
    const readout = await readLauncher(page);
    expect(readout.opacity).toBe("1");
  });

  test("client-side route navigation (/vehicles → /contact → /login → /vehicles) recalculates baselineLift fresh per route with no stale lift or stuck-hidden state, and preserves the comparison selection", async ({ page }) => {
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);

    const launcherAlways = launcherLocatorAlways(page);

    await page.goto("/vehicles");
    await launcherAlways.waitFor({ state: "attached" });
    await expect.poll(() => readLauncher(page).then((r) => r.opacity)).toBe("1");
    const atVehicles = await readLauncher(page);
    expect(atVehicles.lift).toBe(0); // long page, top of page: baselineLift 0

    await page.getByRole("link", { name: "Επικοινωνία" }).first().click();
    await page.waitForURL("**/contact");
    await launcherAlways.waitFor({ state: "attached" });
    await expect.poll(() => readLauncher(page).then((r) => r.opacity), {
      message: "must not still be hidden/stale from whatever state /vehicles was in",
    }).toBe("1");
    const atContact = await readLauncher(page);
    expect(atContact.lift).toBeGreaterThan(0); // /contact's own real baseline at 1920x1080
    expect(atContact.ariaHidden).toBeNull();

    await page.getByRole("link", { name: "Σύνδεση" }).first().click().catch(async () => {
      await page.goto("/login");
    });
    await page.waitForURL("**/login");
    await launcherAlways.waitFor({ state: "attached" });
    await expect.poll(() => readLauncher(page).then((r) => r.opacity)).toBe("1");

    await page.goto("/vehicles");
    await launcherAlways.waitFor({ state: "attached" });
    await expect.poll(() => readLauncher(page).then((r) => r.opacity)).toBe("1");
    const backAtVehicles = await readLauncher(page);
    expect(backAtVehicles.lift).toBe(0);

    await expect(launcherLocator(page)).toHaveAccessibleName("Άνοιγμα σύγκρισης οχημάτων, 1 από 3 επιλεγμένα");
  });

  test("resizing without a reload (1440x900 → 2560x1440 → 768x1024 → 390x844 → 1440x900) keeps baselineLift/visibility correct at every size with no staleness", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await page.goto("/contact");
    await page.waitForTimeout(400);

    const sizes = [
      { w: 1440, h: 900 },
      { w: 2560, h: 1440 },
      { w: 768, h: 1024 },
      { w: 390, h: 844 },
      { w: 1440, h: 900 },
    ];
    for (const size of sizes) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.waitForTimeout(300);
      const readout = await readLauncher(page);
      expect(readout.opacity, `expected visible at ${size.w}x${size.h} after resize without reload`).toBe("1");
      expect(readout.ariaHidden).toBeNull();
    }

    await expect(launcherLocator(page)).toHaveAccessibleName("Άνοιγμα σύγκρισης οχημάτων, 1 από 3 επιλεγμένα");
  });
});

// Micro-hardening regression coverage: (A) React `state` must not get stuck
// on a stale value from a prior route once effect recreation resets any
// effect-local tracking variable — see useFooterAwareCompareState's
// `currentStateRef`. (B) the Footer's document position can shift on the
// *same* route with no navigation, resize, or Footer/button size change of
// its own (a same-route content-height change) — see the ResizeObserver now
// also watching `[data-public-main]`. (C) neither fix introduces duplicate
// observers/listeners across repeated route churn.
test.describe("comparison launcher — micro-hardening: stale state across routes, same-route content height changes", () => {
  test("A: HIDDEN on one route → client-side navigation to NORMAL geometry on another route → launcher becomes visible, no stuck hidden state", async ({ page }) => {
    // Deliberately navigates from a short page (/contact, scrolled to its
    // own bottom) to a long one (/vehicles, baselineLift 0 at its own top)
    // — the reverse direction avoids an unrelated, pre-existing browser/
    // router quirk where navigating *from* a page scrolled deep *to* a
    // shorter page can land the new page's scrollY clamped near its own
    // max instead of 0 (reproduced identically with this feature removed
    // entirely — not something this fix should special-case around).
    // Navigating to a long destination page always has scroll headroom,
    // so scrollY reliably lands at 0, giving a clean HIDDEN → NORMAL case.
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");

    await page.goto("/contact");
    // Let the page finish hydrating/settling at its own baseline first —
    // scrolling immediately on `goto` risks measuring `document.body.scrollHeight`
    // before the page has fully rendered, which can produce an
    // insufficient scroll target and never actually reach "hidden".
    await expect(launcherLocatorAlways(page)).toBeVisible();
    await page.waitForTimeout(400);
    await scrollToFooter(page);
    await expect(launcherLocatorAlways(page)).toHaveCSS("opacity", "0");
    const hiddenReadout = await readLauncher(page);
    expect(hiddenReadout.ariaHidden).toBe("true");

    await page.getByRole("link", { name: "Οχήματα" }).first().click();
    await page.waitForURL("**/vehicles");

    await expect.poll(() => readLauncher(page).then((r) => r.opacity), {
      message: "launcher must become visible again on the new route's normal geometry, not remain stuck hidden",
    }).toBe("1");
    const afterNav = await readLauncher(page);
    expect(afterNav.ariaHidden).toBeNull();
    expect(afterNav.pointerEvents).toBe("auto");
    expect(afterNav.tabIndex).toBe(0);
    // `lift` itself may still be mid-glide immediately after `opacity`
    // settles (a genuinely *decreasing* lift intentionally gets the full
    // smooth transition, not an instant snap — see applyVisual's
    // asymmetric-transition comment) — poll for its final resting value
    // rather than reading it in the same instant as the opacity check.
    await expect.poll(() => readLauncher(page).then((r) => r.lift)).toBe(0);
  });

  test("B: same route, no navigation/scroll/resize — a public-main content height change alone shifts the Footer's document position and the launcher recalculates", async ({ page }) => {
    // 1920x1080: /contact has a measured nonzero baselineLift (~152px,
    // avoiding) at page top — growing the content above the Footer moves
    // it further away and should measurably reduce (here, to exactly 0 /
    // "normal") the required lift, with nothing else triggered.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");
    await page.goto("/contact");
    await page.waitForTimeout(400);

    const before = await readLauncher(page);
    expect(before.lift, "expected a nonzero baselineLift at /contact 1920x1080 before the content change").toBeGreaterThan(0);

    // Grows `[data-public-main]`'s own rendered height directly (a real
    // child element, not a margin — ResizeObserver only fires on box-size
    // changes) — the same effect a realtime-driven content update would
    // have, with no scroll/resize/navigation of any kind performed here.
    await page.evaluate(() => {
      const main = document.querySelector("[data-public-main]");
      const spacer = document.createElement("div");
      spacer.style.height = "600px";
      spacer.setAttribute("data-test-spacer", "");
      main?.appendChild(spacer);
    });

    await expect.poll(() => readLauncher(page).then((r) => r.lift), {
      message: "expected the launcher's lift to recalculate once the public main container's height changed, with no navigation/scroll/resize",
    }).toBeLessThan(before.lift);

    // Clean up the injected spacer so it doesn't affect any later assertion.
    await page.evaluate(() => document.querySelector("[data-test-spacer]")?.remove());
  });

  test("C: observer cleanup remains correct under repeated route churn — no console errors, no degraded/duplicated measurement after many cycles", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstVehicleToComparison(page);
    await page.keyboard.press("Escape");

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const launcherAlways = launcherLocatorAlways(page);
    const routes = ["/vehicles", "/contact", "/login", "/vehicles", "/contact", "/vehicles"];
    for (const route of routes) {
      await page.goto(route);
      await launcherAlways.waitFor({ state: "attached" });
      await expect.poll(() => readLauncher(page).then((r) => r.opacity)).toBe("1");
    }

    expect(errors, `expected no console/page errors after repeated route churn, got: ${errors.join(" | ")}`).toEqual([]);

    // A final, correct measurement after the churn — proof the pipeline
    // still works cleanly rather than having silently degraded.
    await expect.poll(() => readLauncher(page).then((r) => r.lift)).toBe(0); // /vehicles at top, 1440x900
    const finalReadout = await readLauncher(page);
    expect(finalReadout.opacity).toBe("1");
  });
});

test.describe("comparison panel header — Clear All and close X never overlap", () => {
  test("desktop: Clear All and close X are geometrically distinct, close button meets a 40px touch target", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstVehicleToComparison(page);

    const clearAll = page.getByRole("button", { name: "Εκκαθάριση όλων" });
    const closeBtn = page.getByRole("button", { name: "Κλείσιμο σύγκρισης" });
    await expect(clearAll).toBeVisible();
    await expect(closeBtn).toBeVisible();

    const [clearBox, closeBox] = await Promise.all([clearAll.boundingBox(), closeBtn.boundingBox()]);
    const overlaps = !(
      clearBox!.x + clearBox!.width <= closeBox!.x ||
      closeBox!.x + closeBox!.width <= clearBox!.x ||
      clearBox!.y + clearBox!.height <= closeBox!.y ||
      closeBox!.y + closeBox!.height <= clearBox!.y
    );
    expect(overlaps).toBe(false);

    expect(closeBox!.width).toBeGreaterThanOrEqual(40);
    expect(closeBox!.height).toBeGreaterThanOrEqual(40);
  });

  test("small mobile (320px): header wraps cleanly instead of colliding, no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await addFirstVehicleToComparison(page);

    const clearAll = page.getByRole("button", { name: "Εκκαθάριση όλων" });
    // The mobile Sheet's own built-in close button — accessible name
    // "Κλείσιμο" (see src/components/ui/sheet.tsx), distinct from the
    // desktop panel's custom "Κλείσιμο σύγκρισης" button.
    const closeBtn = page.getByRole("button", { name: "Κλείσιμο", exact: true });
    await expect(clearAll).toBeVisible();
    await expect(closeBtn).toBeVisible();

    const [clearBox, closeBox] = await Promise.all([clearAll.boundingBox(), closeBtn.boundingBox()]);
    const overlaps = !(
      clearBox!.x + clearBox!.width <= closeBox!.x ||
      closeBox!.x + closeBox!.width <= clearBox!.x ||
      clearBox!.y + clearBox!.height <= closeBox!.y ||
      closeBox!.y + closeBox!.height <= clearBox!.y
    );
    expect(overlaps).toBe(false);

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
  });
});

test.describe("panel CTA — static Kinsen corporate CTA, no cyan", () => {
  test("Δείτε τη σύγκριση: solid navy at rest, unchanged on hover", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstVehicleToComparison(page);
    // Add a 2nd vehicle so the CTA becomes enabled (MIN_COMPARISON_VEHICLES = 2).
    await page.keyboard.press("Escape");
    const secondAdd = page.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).first();
    await secondAdd.click();

    const cta = page.getByRole("link", { name: "Δείτε τη σύγκριση" });
    await expect(cta).toBeVisible();

    await expect(cta).toHaveCSS("background-color", PRIMARY_NAVY);
    await expect(cta).toHaveCSS("color", WHITE);

    await cta.hover();
    // No animated fill, no color shift — the static CTA contract.
    await expect(cta).toHaveCSS("background-color", PRIMARY_NAVY);
    await expect(cta).toHaveCSS("color", WHITE);
  });
});
