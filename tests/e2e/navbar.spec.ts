import { test, expect, type Page } from "@playwright/test";
import { bannerLocators, loginAsAdmin } from "./helpers";

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

async function openCompanyDropdown(page: Page) {
  const trigger = page.getByRole("navigation").getByRole("button", { name: /Η Εταιρεία μας/ });
  const box = await trigger.boundingBox();
  if (!box) throw new Error("company dropdown trigger not found");
  // openOn="hover" — a real mouse move onto the trigger, not a click.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  // The panel's open transition (opacity/transform, 200ms) must fully
  // settle before measuring its box, or a mid-transition translateY
  // reading undershoots the real resting gap.
  await page.waitForTimeout(250);
  return trigger;
}

test.describe("desktop navbar: company dropdown", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("panel is a separate floating card, never fused to the trigger", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    const trigger = await openCompanyDropdown(page);

    const panelId = await trigger.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();

    const [triggerBox, panelBox] = await Promise.all([trigger.boundingBox(), panel.boundingBox()]);
    // A genuine visual gap, not a flush/zero-gap seam.
    expect(panelBox!.y - (triggerBox!.y + triggerBox!.height)).toBeGreaterThanOrEqual(4);

    const [triggerBg, panelStyle] = await Promise.all([
      trigger.evaluate((el) => getComputedStyle(el).backgroundColor),
      panel.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          borderTopWidth: cs.borderTopWidth,
          borderTopLeftRadius: cs.borderTopLeftRadius,
          borderTopRightRadius: cs.borderTopRightRadius,
          borderBottomLeftRadius: cs.borderBottomLeftRadius,
          borderBottomRightRadius: cs.borderBottomRightRadius,
          backgroundColor: cs.backgroundColor,
        };
      }),
    ]);

    // Open state is communicated by the chevron + a faint navy hover tint
    // only — the trigger must never take on the panel's solid white fill.
    expect(triggerBg).not.toBe("rgb(255, 255, 255)");

    // A real floating card: full top border and all four corners rounded,
    // not a bottom-only shape that shares the trigger's own border.
    expect(panelStyle.borderTopWidth).not.toBe("0px");
    expect(panelStyle.borderTopLeftRadius).not.toBe("0px");
    expect(panelStyle.borderTopRightRadius).not.toBe("0px");
    expect(panelStyle.borderTopLeftRadius).toBe(panelStyle.borderBottomLeftRadius);
    expect(panelStyle.borderTopRightRadius).toBe(panelStyle.borderBottomRightRadius);
    expect(panelStyle.backgroundColor).toBe("rgb(255, 255, 255)");
    // The same restrained rounded-md radius the plain nav links use (6px)
    // — not the rounder rounded-xl (12px) "floating bubble" look this
    // replaced, which read as a separate card system from the rest of
    // the Navbar rather than part of it.
    expect(panelStyle.borderTopLeftRadius).toBe("6px");
  });

  test("FAQ spans the panel's full usable width edge-to-edge, with no left/right gutter", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    const trigger = await openCompanyDropdown(page);
    const panelId = await trigger.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);
    const item = page.getByRole("link", { name: "FAQ" });

    const [panelBox, itemBox, panelStyle] = await Promise.all([
      panel.boundingBox(),
      item.boundingBox(),
      panel.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { padding: cs.padding, overflow: cs.overflow, borderWidth: parseFloat(cs.borderTopWidth) };
      }),
    ]);

    // The panel itself carries no gutter padding — the row owns the whole
    // inner width instead of sitting in an inset mini-card.
    expect(panelStyle.padding).toBe("0px");
    // Only the panel's own 1px border ring separates the row from its
    // edges — a small tolerance covers subpixel rounding, not a real
    // gutter (the old design's gutter was ~6px, an order of magnitude more).
    const leftInset = itemBox!.x - panelBox!.x;
    const rightInset = panelBox!.x + panelBox!.width - (itemBox!.x + itemBox!.width);
    expect(leftInset).toBeGreaterThanOrEqual(panelStyle.borderWidth - 0.5);
    expect(leftInset).toBeLessThanOrEqual(panelStyle.borderWidth + 1);
    expect(rightInset).toBeGreaterThanOrEqual(panelStyle.borderWidth - 0.5);
    expect(rightInset).toBeLessThanOrEqual(panelStyle.borderWidth + 1);
  });

  test("FAQ hover fills the full row and is clipped cleanly at the panel's own rounded corners", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    const trigger = await openCompanyDropdown(page);
    const panelId = await trigger.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);
    const item = page.getByRole("link", { name: "FAQ" });

    await item.hover();
    // The color transitions in (`transition-colors`), so a one-shot read
    // right after hover() can race it — toHaveCSS retries until it
    // actually settles instead of guessing a fixed delay.
    // The approved subtle navy tint (primary/5) — unchanged; only its
    // coverage changed to fill the whole row.
    await expect(item).toHaveCSS("background-color", "rgba(2, 56, 89, 0.05)");
    const [itemRadius, panelOverflow] = await Promise.all([
      item.evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
      panel.evaluate((el) => getComputedStyle(el).overflow),
    ]);
    // The row carries no radius of its own — the outer panel's own
    // rounded-md + overflow-hidden is what clips its corners, so there's
    // no independent rounded "mini-card" hover shape inside the panel.
    expect(itemRadius).toBe("0px");
    expect(panelOverflow).toBe("hidden");

    const [panelBox, itemBox] = await Promise.all([panel.boundingBox(), item.boundingBox()]);
    // The hovered row's box already spans (within the border) the panel's
    // own width — confirming the hover background has nothing narrower to
    // paint into, it fills exactly what the row itself now occupies.
    expect(itemBox!.width).toBeGreaterThanOrEqual(panelBox!.width - 4);
  });

  test("opens via keyboard and closes on Escape", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    const trigger = page.getByRole("navigation").getByRole("button", { name: /Η Εταιρεία μας/ });

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("closes on outside click", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    const trigger = await openCompanyDropdown(page);
    await page.mouse.click(20, 500);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("the hover-close bridge survives crossing the visual gap toward the panel", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    const trigger = await openCompanyDropdown(page);
    const box = await trigger.boundingBox();

    // The gap between trigger and panel is empty hit-test space (the panel
    // is absolutely positioned and contributes no layout height), so a
    // literal mouseleave fires the instant the pointer leaves the trigger.
    // Stepping gradually down through that gap exercises the delayed-close
    // timer that keeps the dropdown open through it.
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height + i * 2);
      await page.waitForTimeout(30);
    }
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test("FAQ link navigates to /faq", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    await openCompanyDropdown(page);
    await Promise.all([page.waitForURL(/\/faq/), page.getByRole("link", { name: "FAQ" }).click()]);
    await expect(page).toHaveURL(/\/faq/);
  });
});

test.describe("desktop navbar: primary links", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("real nav links point to the right routes", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    const nav = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Οχήματα" }) });
    const expected: { name: string; href: RegExp }[] = [
      { name: "Οχήματα", href: /\/vehicles$/ },
      { name: "Δανειοδότηση", href: /\/financing$/ },
      { name: "Εγγύηση", href: /\/warranty$/ },
      { name: "Επικοινωνία", href: /\/contact$/ },
    ];
    for (const { name, href } of expected) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }
  });
});

test.describe("responsive breakpoint", () => {
  test("desktop nav and mobile hamburger switch exactly at the lg (1024px) breakpoint", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    await page.setViewportSize({ width: 1023, height: 900 });
    await expect(page.getByRole("navigation").getByRole("link", { name: "Οχήματα" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Άνοιγμα μενού" })).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole("navigation").getByRole("link", { name: "Οχήματα" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Άνοιγμα μενού" })).toBeHidden();
  });
});

test.describe("mobile navbar", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hamburger opens the sheet, and Escape closes it and restores the trigger", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const openButton = page.getByRole("button", { name: "Άνοιγμα μενού" });
    await openButton.click();
    // While the Sheet is open, Radix's Dialog correctly aria-hides the rest
    // of the page (including the header's own trigger) from the
    // accessibility tree — so the open state is asserted via the dialog
    // itself, not by re-querying the now-hidden header trigger.
    const dialog = page.getByRole("dialog", { name: "Μενού" });
    await expect(dialog).toBeVisible();
    // The dialog being visible in the DOM is not the same as Radix's own
    // DismissableLayer having actually attached its document-level Escape
    // listener yet — under load that mount effect can still be pending the
    // instant the content becomes visible. The same class of race is
    // already handled for the Accordion (see waitForAccordionSettled in
    // helpers.ts); this waits for this dialog's own open transition
    // (animate-slide-up) to actually finish, the same deterministic signal.
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Μενού" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Άνοιγμα μενού" })).toBeVisible();
  });

  test("inline company accordion expands and its FAQ row navigates, closing the sheet", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    await page.getByRole("button", { name: "Άνοιγμα μενού" }).click();

    await page.getByRole("button", { name: "Η Εταιρεία μας" }).click();
    const faqLink = page.getByRole("link", { name: "FAQ" });
    await expect(faqLink).toBeVisible();

    await Promise.all([page.waitForURL(/\/faq/), faqLink.click()]);
    await expect(page).toHaveURL(/\/faq/);
    // SheetClose wraps the link, so navigating away auto-closes the sheet.
    await expect(page.getByRole("button", { name: "Κλείσιμο μενού" })).toBeHidden();
  });
});

test.describe("authenticated header state", () => {
  test("account dropdown keeps its own sizing separate from the company dropdown, and its controls work", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/");
    await dismissBanner(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Seeded admin's first name (see prisma/seed.ts) — the only header
    // button carrying this accessible name, distinct from the company
    // dropdown's "Η Εταιρεία μας" trigger, so NavDropdown's reuse across
    // both call sites can't be cross-contaminating either one.
    const accountTrigger = page.getByRole("banner").getByRole("button", { name: /Kinsen/ });
    await accountTrigger.click();

    const panelId = await accountTrigger.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);
    const panelStyle = await panel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.width, borderTopLeftRadius: cs.borderTopLeftRadius, padding: cs.padding, overflow: cs.overflow };
    });
    // header.tsx's own w-48/rounded-lg override — not nav.tsx's w-44/rounded-md.
    expect(panelStyle.width).toBe("192px");
    expect(panelStyle.borderTopLeftRadius).toBe("8px");
    // The company dropdown's edge-to-edge override (p-0 + overflow-hidden,
    // scoped to nav.tsx's own panelClassName) must not leak into this
    // shared component's other consumer — the account menu keeps its
    // original padded, non-clipped design with its own inset rounded items.
    expect(panelStyle.padding).not.toBe("0px");
    expect(panelStyle.overflow).not.toBe("hidden");

    await expect(page.getByRole("link", { name: "Πίνακας Διαχείρισης" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ο λογαριασμός μου" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Αποσύνδεση" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(accountTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("mobile menu shows the authenticated account section instead of Σύνδεση", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/");
    await dismissBanner(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole("button", { name: "Άνοιγμα μενού" }).click();
    await expect(page.getByRole("link", { name: "Ο λογαριασμός μου" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Αποσύνδεση" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Σύνδεση" })).toBeHidden();
  });
});

test.describe("mobile header composition (hamburger-left / logo-center / CTA-right)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hamburger sits left of a truly centered logo, which sits left of the Σύνδεση CTA, with no collisions", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const hamburger = page.getByRole("button", { name: "Άνοιγμα μενού" });
    const logo = page.getByRole("banner").getByRole("link", { name: "Αρχική" });
    const cta = page.getByRole("banner").getByRole("link", { name: "Σύνδεση" });

    const [hamburgerBox, logoBox, ctaBox, viewportWidth] = await Promise.all([
      hamburger.boundingBox(),
      logo.boundingBox(),
      cta.boundingBox(),
      page.evaluate(() => window.innerWidth),
    ]);

    // Geometric proof, not just a `justify-center` class check — this is
    // exactly what protects against a future asymmetric hamburger/CTA
    // width silently dragging the logo off the true center again.
    const logoCenterX = logoBox!.x + logoBox!.width / 2;
    expect(Math.abs(logoCenterX - viewportWidth / 2)).toBeLessThanOrEqual(1);

    expect(hamburgerBox!.x).toBeLessThan(logoBox!.x);
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(ctaBox!.x);
  });

  test("exactly one Σύνδεση access point exists: the header CTA, never the drawer", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    await expect(page.getByRole("banner").getByRole("link", { name: "Σύνδεση" })).toHaveCount(1);

    await page.getByRole("button", { name: "Άνοιγμα μενού" }).click();
    const dialog = page.getByRole("dialog", { name: "Μενού" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Σύνδεση" })).toHaveCount(0);
  });

  test("the drawer opens flush against the left viewport edge", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    await page.getByRole("button", { name: "Άνοιγμα μενού" }).click();
    const dialog = page.getByRole("dialog", { name: "Μενού" });
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox!.x).toBe(0);
  });

  test("the company accordion reveals exactly one FAQ row, not a duplicate/floating panel", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    await page.getByRole("button", { name: "Άνοιγμα μενού" }).click();

    const companyTrigger = page.getByRole("button", { name: "Η Εταιρεία μας" });
    await expect(companyTrigger).toHaveAttribute("aria-expanded", "false");
    await companyTrigger.click();
    await expect(companyTrigger).toHaveAttribute("aria-expanded", "true");

    // Scoped to the whole page, not just the drawer — proves the desktop
    // dropdown's separate floating FAQ panel isn't also mounted/visible
    // underneath at this viewport.
    await expect(page.getByRole("link", { name: "FAQ" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "FAQ" })).toBeVisible();
  });
});

test.describe("responsive size system (representative viewports)", () => {
  const viewports = [
    ["small-phone-320", 320, 568],
    ["large-phone-430", 430, 932],
    ["tablet-768", 768, 1024],
    ["desktop-1024", 1024, 768],
    ["desktop-1440", 1440, 900],
    ["desktop-1920", 1920, 1080],
  ] as const;

  for (const [label, width, height] of viewports) {
    test(`${label}: no page-level horizontal overflow, and the correct nav architecture is active`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await dismissBanner(page);

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowX).toBeLessThanOrEqual(1);

      const isDesktop = width >= 1024;
      await expect(page.getByRole("navigation").getByRole("link", { name: "Οχήματα" })).toBeVisible({ visible: isDesktop });
      await expect(page.getByRole("button", { name: "Άνοιγμα μενού" })).toBeVisible({ visible: !isDesktop });
    });
  }
});
