import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { bannerLocators, attachRuntimeErrorGuard, assertNoRuntimeErrors } from "./helpers";

// Covers the vehicle-detail "Χαρακτηριστικά / Έξτρα εξοπλισμός" selector
// (VehicleSpecsTabs) and the restyled Compare button beside it. Extras-count
// -dependent scenarios (empty state / pagination) need a vehicle whose
// VehicleExtra rows this suite controls directly — done via a real Prisma
// connection, guarded exactly like skipIfDbUnreachable in the unit test
// suite (src/server/services/__tests__), since the Playwright test-runner
// process (unlike the `npm run start` webServer it drives) has no
// guaranteed DATABASE_URL in every environment this can run in.
const prisma = new PrismaClient();

async function dismissBanner(page: Page) {
  const banner = bannerLocators(page);
  if ((await banner.rejectButton.count()) > 0) {
    await banner.rejectButton.click({ timeout: 5000 }).catch(() => {});
    await banner.region.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

/** Navigates to the first vehicle card's detail page from /vehicles — same "any real vehicle" pattern vehicle-comparison.spec.ts uses, so this suite never depends on a specific seeded slug. */
async function goToFirstVehicleDetail(page: Page) {
  await page.goto("/vehicles");
  await dismissBanner(page);
  await page.locator("main a[href^='/vehicles/']").first().click();
  await page.waitForURL(/\/vehicles\/.+/);
  await dismissBanner(page);
}

function specsTabsLocators(page: Page) {
  return {
    specsTab: page.getByRole("tab", { name: /Χαρακτηριστικά/ }),
    extrasTab: page.getByRole("tab", { name: /Έξτρα εξοπλισμός/ }),
    specsPanel: page.getByRole("tabpanel", { name: /Χαρακτηριστικά/ }),
    extrasPanel: page.getByRole("tabpanel", { name: /Έξτρα εξοπλισμός/ }),
  };
}

async function skipIfDbUnreachable(): Promise<boolean> {
  try {
    await prisma.vehicle.count();
    return false;
  } catch {
    return true;
  }
}

test.describe("vehicle detail — Χαρακτηριστικά / Έξτρα εξοπλισμός selector", () => {
  test("Χαρακτηριστικά is selected by default and its specification grid is visible", async ({ page }) => {
    await goToFirstVehicleDetail(page);
    const { specsTab, extrasTab, specsPanel } = specsTabsLocators(page);

    await expect(specsTab).toHaveAttribute("aria-selected", "true");
    await expect(extrasTab).toHaveAttribute("aria-selected", "false");
    await expect(specsPanel).toBeVisible();
    await expect(specsPanel.getByText("Μάρκα")).toBeVisible();
  });

  test("selecting Έξτρα εξοπλισμός switches the visible panel, and switching back to Χαρακτηριστικά restores the specs grid", async ({ page }) => {
    await goToFirstVehicleDetail(page);
    const { specsTab, extrasTab, specsPanel, extrasPanel } = specsTabsLocators(page);

    await extrasTab.click();
    await expect(extrasTab).toHaveAttribute("aria-selected", "true");
    await expect(extrasPanel).toBeVisible();
    await expect(specsPanel).toBeHidden();

    await specsTab.click();
    await expect(specsTab).toHaveAttribute("aria-selected", "true");
    await expect(specsPanel).toBeVisible();
    await expect(specsPanel.getByText("Μάρκα")).toBeVisible();
    await expect(extrasPanel).toBeHidden();
  });

  test("the selector is keyboard operable: focusing a tab and pressing the arrow key moves selection and switches the panel", async ({ page }) => {
    await goToFirstVehicleDetail(page);
    const { specsTab, extrasTab, extrasPanel } = specsTabsLocators(page);

    await specsTab.focus();
    await expect(specsTab).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(extrasTab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(extrasTab).toHaveAttribute("aria-selected", "true");
    await expect(extrasPanel).toBeVisible();
  });

  test("the Compare button beside the title keeps working and shows a visible keyboard focus state", async ({ page }) => {
    await goToFirstVehicleDetail(page);

    const compareButton = page.getByRole("button", { name: "Προσθήκη στη σύγκριση" }).first();
    await expect(compareButton).toBeVisible();

    await compareButton.focus();
    const outlineWidth = await compareButton.evaluate((el) => window.getComputedStyle(el).getPropertyValue("--tw-ring-color") || window.getComputedStyle(el).boxShadow);
    expect(outlineWidth).not.toBe("none");

    await compareButton.click();
    await expect(page.getByRole("button", { name: "Αφαίρεση από τη σύγκριση" }).first()).toBeVisible();
    // Restore selection state so this test doesn't leak into others via localStorage.
    await page.getByRole("button", { name: "Αφαίρεση από τη σύγκριση" }).first().click();
  });

  test("the Leasing CTA in the price panel still opens the interest modal", async ({ page }) => {
    await goToFirstVehicleDetail(page);

    const cta = page.getByRole("button", { name: /Ενδιαφέρομαι για Leasing/ }).first();
    if ((await cta.count()) === 0) test.skip(true, "this seeded vehicle has no leasing offer");

    await cta.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  // Regression guard for a real bug found during review: an earlier layout
  // gave the selector and the CTA their own independent Leasing/Αγορά state
  // (two separate <Tabs> roots, one nested inside the other's action row),
  // which rendered a SECOND "Ενδιαφέρομαι για …" button on the page. There
  // must always be exactly one interest CTA, driven by the single
  // Leasing/Αγορά toggle in VehiclePricingSection.
  test("exactly one interest CTA exists on the page, in both Leasing and Αγορά mode", async ({ page }) => {
    await goToFirstVehicleDetail(page);

    const anyCta = page.getByRole("button", { name: /Ενδιαφέρομαι για (Leasing|Αγορά)/ });
    await expect(anyCta).toHaveCount(1);

    const purchaseToggle = page.getByRole("button", { name: "Αγορά" });
    if ((await purchaseToggle.count()) > 0) {
      await purchaseToggle.click();
      await expect(anyCta).toHaveCount(1);
    }
  });

  // Regression guard for the full-width action-row restructure: the
  // Χαρακτηριστικά/Έξτρα εξοπλισμός selector and the single interest CTA
  // live in one grid row, a sibling of (not nested inside) the upper
  // two-column vehicle-info/pricing grid — selector on the left, CTA on the
  // right, never overlapping. Below the `lg:` breakpoint they stack instead.
  test("the selector and CTA sit side by side without overlapping at desktop widths, and align with the left/right columns above them", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goToFirstVehicleDetail(page);

    const { specsTab } = specsTabsLocators(page);
    const cta = page.getByRole("button", { name: /Ενδιαφέρομαι για (Leasing|Αγορά)/ }).first();
    if ((await cta.count()) === 0) test.skip(true, "this seeded vehicle has no offer, so there is no CTA to check");

    const tablist = page.getByRole("tablist").first();
    const title = page.getByRole("heading", { level: 1 });

    const [tablistBox, ctaBox, titleBox] = await Promise.all([
      tablist.boundingBox(),
      cta.boundingBox(),
      title.boundingBox(),
    ]);
    if (!tablistBox || !ctaBox || !titleBox) throw new Error("expected boundingBox() for tablist, CTA and title");

    // Same row (not stacked).
    expect(Math.abs(tablistBox.y - ctaBox.y)).toBeLessThan(20);
    // No overlap: the selector's right edge must not cross into the CTA.
    expect(tablistBox.x + tablistBox.width).toBeLessThanOrEqual(ctaBox.x);
    // Selector is left-aligned with the title above it (same left column),
    // not centered or stretched across its cell.
    expect(Math.abs(tablistBox.x - titleBox.x)).toBeLessThan(2);
    // CTA sits in the right half of the row.
    expect(ctaBox.x).toBeGreaterThan(tablistBox.x + tablistBox.width);
  });

  // Regression guard: below the `lg:` breakpoint, a `minmax(0,1fr)` grid
  // column does not grow to protect a non-stretched child's content width,
  // so keeping the selector/CTA side by side too early (previously `sm:`,
  // 640px) let the selector's ~370px natural content width visually spill
  // into the CTA's cell. Below `lg:` they must stack full-width instead.
  for (const width of [640, 768]) {
    test(`at ${width}px the selector and CTA stack (full width, no side-by-side overlap)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await goToFirstVehicleDetail(page);

      const cta = page.getByRole("button", { name: /Ενδιαφέρομαι για (Leasing|Αγορά)/ }).first();
      if ((await cta.count()) === 0) test.skip(true, "this seeded vehicle has no offer, so there is no CTA to check");

      const tablist = page.getByRole("tablist").first();
      const [tablistBox, ctaBox] = await Promise.all([tablist.boundingBox(), cta.boundingBox()]);
      if (!tablistBox || !ctaBox) throw new Error("expected boundingBox() for tablist and CTA");

      expect(ctaBox.y).toBeGreaterThanOrEqual(tablistBox.y + tablistBox.height);
    });
  }

  test.describe("responsive — no horizontal overflow with the selector present", () => {
    const viewports = [
      { name: "mobile-320", width: 320, height: 900 },
      { name: "mobile-390", width: 390, height: 900 },
      { name: "mobile-640", width: 640, height: 900 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "laptop-1024", width: 1024, height: 900 },
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "wide-1600", width: 1600, height: 1000 },
    ];

    for (const viewport of viewports) {
      test(`${viewport.name}: no page-level horizontal overflow in either tab state`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const runtimeGuard = attachRuntimeErrorGuard(page);
        await goToFirstVehicleDetail(page);

        const overflowDefault = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflowDefault, `${viewport.name} default tab`).toBeLessThanOrEqual(1);

        await specsTabsLocators(page).extrasTab.click();
        const overflowExtras = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflowExtras, `${viewport.name} extras tab`).toBeLessThanOrEqual(1);

        assertNoRuntimeErrors(runtimeGuard);
      });
    }
  });
});

test.describe("vehicle detail — extras content (DB-dependent, self-skips if unreachable)", () => {
  test("a vehicle with zero extras shows the premium empty state, and Έξτρα εξοπλισμός stays selectable", async ({ page }) => {
    if (await skipIfDbUnreachable()) {
      test.skip(true, "DATABASE_URL not reachable from the Playwright test-runner process");
      return;
    }

    await goToFirstVehicleDetail(page);
    const slugMatch = page.url().match(/\/vehicles\/([^/?#]+)/);
    const slug = slugMatch?.[1];
    if (!slug) throw new Error("could not determine vehicle slug from URL");

    const vehicle = await prisma.vehicle.findUnique({ where: { slug }, select: { id: true } });
    if (!vehicle) throw new Error(`seeded vehicle for slug ${slug} not found`);
    await prisma.vehicleExtra.deleteMany({ where: { vehicleId: vehicle.id } });

    await page.reload();
    await dismissBanner(page);
    const { extrasTab, extrasPanel } = specsTabsLocators(page);
    await extrasTab.click();
    await expect(extrasTab).toHaveAttribute("aria-selected", "true");
    await expect(extrasPanel.getByText("Δεν έχει δηλωθεί έξτρα εξοπλισμός για το συγκεκριμένο όχημα.")).toBeVisible();
  });

  test("a vehicle with 6 or fewer extras renders no pagination controls", async ({ page }) => {
    if (await skipIfDbUnreachable()) {
      test.skip(true, "DATABASE_URL not reachable from the Playwright test-runner process");
      return;
    }

    await goToFirstVehicleDetail(page);
    const slug = page.url().match(/\/vehicles\/([^/?#]+)/)?.[1];
    if (!slug) throw new Error("could not determine vehicle slug from URL");
    const vehicle = await prisma.vehicle.findUnique({ where: { slug }, select: { id: true } });
    if (!vehicle) throw new Error(`seeded vehicle for slug ${slug} not found`);

    await prisma.vehicleExtra.deleteMany({ where: { vehicleId: vehicle.id } });
    await prisma.vehicleExtra.createMany({
      data: ["Κλιματισμός", "Bluetooth", "Cruise Control"].map((displayName) => ({ vehicleId: vehicle.id, displayName })),
    });

    try {
      await page.reload();
      await dismissBanner(page);
      const { extrasTab, extrasPanel } = specsTabsLocators(page);
      await extrasTab.click();
      await expect(extrasPanel.getByText("Κλιματισμός")).toBeVisible();
      await expect(page.getByRole("button", { name: "Επόμενη σελίδα" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Προηγούμενη σελίδα" })).toHaveCount(0);
    } finally {
      await prisma.vehicleExtra.deleteMany({ where: { vehicleId: vehicle.id } });
    }
  });

  test("a vehicle with more than 6 extras paginates 6-per-page, and Next/Previous change the visible items correctly", async ({ page }) => {
    if (await skipIfDbUnreachable()) {
      test.skip(true, "DATABASE_URL not reachable from the Playwright test-runner process");
      return;
    }

    await goToFirstVehicleDetail(page);
    const slug = page.url().match(/\/vehicles\/([^/?#]+)/)?.[1];
    if (!slug) throw new Error("could not determine vehicle slug from URL");
    const vehicle = await prisma.vehicle.findUnique({ where: { slug }, select: { id: true } });
    if (!vehicle) throw new Error(`seeded vehicle for slug ${slug} not found`);

    const names = Array.from({ length: 8 }, (_, i) => `Δοκιμαστικό Έξτρα ${i + 1}`);
    await prisma.vehicleExtra.deleteMany({ where: { vehicleId: vehicle.id } });
    await prisma.vehicleExtra.createMany({ data: names.map((displayName) => ({ vehicleId: vehicle.id, displayName })) });

    try {
      await page.reload();
      await dismissBanner(page);
      const { extrasTab, extrasPanel } = specsTabsLocators(page);
      await extrasTab.click();

      await expect(extrasPanel.getByText("Σελίδα 1 από 2")).toBeVisible();
      for (let i = 1; i <= 6; i++) await expect(extrasPanel.getByText(`Δοκιμαστικό Έξτρα ${i}`)).toBeVisible();
      await expect(extrasPanel.getByText("Δοκιμαστικό Έξτρα 7")).toBeHidden();

      const prevButton = page.getByRole("button", { name: "Προηγούμενη σελίδα" });
      const nextButton = page.getByRole("button", { name: "Επόμενη σελίδα" });
      await expect(prevButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();

      await nextButton.click();
      await expect(extrasPanel.getByText("Σελίδα 2 από 2")).toBeVisible();
      await expect(extrasPanel.getByText("Δοκιμαστικό Έξτρα 7")).toBeVisible();
      await expect(extrasPanel.getByText("Δοκιμαστικό Έξτρα 8")).toBeVisible();
      await expect(extrasPanel.getByText("Δοκιμαστικό Έξτρα 1")).toBeHidden();
      await expect(nextButton).toBeDisabled();
      await expect(prevButton).toBeEnabled();

      await prevButton.click();
      await expect(extrasPanel.getByText("Σελίδα 1 από 2")).toBeVisible();
      await expect(extrasPanel.getByText("Δοκιμαστικό Έξτρα 1")).toBeVisible();
    } finally {
      await prisma.vehicleExtra.deleteMany({ where: { vehicleId: vehicle.id } });
    }
  });

  test("a long displayName wraps without breaking layout or causing horizontal overflow", async ({ page }) => {
    if (await skipIfDbUnreachable()) {
      test.skip(true, "DATABASE_URL not reachable from the Playwright test-runner process");
      return;
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await goToFirstVehicleDetail(page);
    const slug = page.url().match(/\/vehicles\/([^/?#]+)/)?.[1];
    if (!slug) throw new Error("could not determine vehicle slug from URL");
    const vehicle = await prisma.vehicle.findUnique({ where: { slug }, select: { id: true } });
    if (!vehicle) throw new Error(`seeded vehicle for slug ${slug} not found`);

    const longName =
      "Πολύ μεγάλη περιγραφή εξοπλισμού που θα πρέπει να αναδιπλωθεί ομαλά χωρίς να σπάσει το layout της κάρτας ή να προκαλέσει οριζόντια υπερχείλιση στη σελίδα";
    await prisma.vehicleExtra.deleteMany({ where: { vehicleId: vehicle.id } });
    await prisma.vehicleExtra.create({ data: { vehicleId: vehicle.id, displayName: longName } });

    try {
      await page.reload();
      await dismissBanner(page);
      await specsTabsLocators(page).extrasTab.click();
      await expect(page.getByText(longName)).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    } finally {
      await prisma.vehicleExtra.deleteMany({ where: { vehicleId: vehicle.id } });
    }
  });
});
