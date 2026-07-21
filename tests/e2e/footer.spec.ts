import { test, expect, type Page } from "@playwright/test";
import { bannerLocators } from "./helpers";

async function dismissBanner(page: Page) {
  const banner = bannerLocators(page);
  // The banner mounts client-side after a short delay, so checking count()
  // immediately after goto() races the mount: a 0 count here doesn't mean
  // "no banner this session", it can just mean "not mounted yet", leaving
  // it to appear later and intercept pointer events on the footer below.
  // Waiting for it to actually appear (or definitively not) removes the race.
  const appeared = await banner.region
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await banner.rejectButton.click({ timeout: 5000 }).catch(() => {});
    await banner.region.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

test.describe("premium footer redesign", () => {
  test("nav columns render real links pointing to the right routes", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const footer = page.locator("footer");
    const expectedLinks: { name: string; href: RegExp }[] = [
      { name: "Οχήματα", href: /\/vehicles$/ },
      { name: "Δανειοδότηση", href: /\/financing$/ },
      { name: "Εγγύηση", href: /\/warranty$/ },
      { name: "Σύγκριση οχημάτων", href: /\/compare$/ },
      { name: "Επικοινωνία", href: /\/contact$/ },
      { name: "Συχνές Ερωτήσεις", href: /\/faq$/ },
      { name: "Η Kinsen", href: /kinsen\.gr/ },
    ];
    for (const { name, href } of expectedLinks) {
      const link = footer.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }
  });

  test("social links keep a stable accessible name and correct href even though their visible text scrambles on hover", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const footer = page.locator("footer");
    for (const name of ["Facebook", "Instagram", "LinkedIn"]) {
      const link = footer.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      const hrefBefore = await link.getAttribute("href");
      expect(hrefBefore).toBeTruthy();

      await link.hover();
      // Accessible name (aria-label) must never change, even mid-scramble —
      // screen readers must always get the real link name, never garbled
      // scrambled characters.
      await expect(link).toHaveAccessibleName(name);
      await expect(link).toHaveAttribute("href", hrefBefore!);
    }
  });

  test("the scramble hover effect actually animates the visible text and settles back to the real word", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const link = page.locator("footer").getByRole("link", { name: "LinkedIn", exact: true });
    await expect(link.locator("span")).toHaveText("LINKEDIN");

    // Polling textContent() via round-trip Playwright calls races hover():
    // under load each round trip can take long enough that the whole
    // polling loop finishes before the mouseenter event even fires.
    // Polling in-page (waitForFunction) is fast enough to reliably observe
    // the mid-animation frame instead of missing it.
    const [sawScrambled] = await Promise.all([
      page
        .waitForFunction(
          () => {
            const el = document.querySelector<HTMLElement>('footer a[aria-label="LinkedIn"] span');
            return el?.textContent !== "LINKEDIN";
          },
          undefined,
          { timeout: 2000, polling: 5 },
        )
        .then(() => true)
        .catch(() => false),
      link.hover(),
    ]);
    expect(sawScrambled).toBe(true);

    // Settles back to the real word once the animation completes.
    await expect(link.locator("span")).toHaveText("LINKEDIN", { timeout: 2000 });
  });

  test("respects prefers-reduced-motion: hovering never scrambles the text", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await dismissBanner(page);

    const link = page.locator("footer").getByRole("link", { name: "LinkedIn", exact: true });
    await link.hover();
    await page.waitForTimeout(300);
    await expect(link.locator("span")).toHaveText("LINKEDIN");

    await context.close();
  });

  test("legal row keeps the exact previously-tested link text (privacy policy, cookie settings)", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Πολιτική Προστασίας Δεδομένων" })).toBeVisible();
    await expect(footer.getByRole("button", { name: "Ρυθμίσεις Cookies", exact: true })).toBeVisible();
  });

  test("the decorative Kinsen watermark logo is present but inert (aria-hidden, no pointer events, not a real link)", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    // The watermark is the real Kinsen logo asset (kinsen_logowhite.png,
    // the same image used in transactional emails — see footer.tsx), not a
    // "KINSEN" text wordmark; it was intentionally redesigned from text to
    // this image. Target the actual asset by its src rather than by text.
    const watermarkWrapper = page.locator("footer > div[aria-hidden='true']").filter({
      has: page.locator('img[src*="kinsen_logowhite"]'),
    });
    const watermarkImg = watermarkWrapper.locator("img");

    await watermarkImg.scrollIntoViewIfNeeded();
    await expect(watermarkImg).toBeVisible();
    await expect(watermarkWrapper).toHaveAttribute("aria-hidden", "true");
    await expect(watermarkWrapper).toHaveClass(/pointer-events-none/);

    // Real, correctly-loaded image, not a broken/zero-size asset. The
    // browser hasn't necessarily finished decoding the image bytes just
    // because layout has reserved its box (Next/Image sets width/height
    // attributes upfront) — wait for the actual load to complete rather
    // than racing it, since naturalWidth is legitimately 0 until then.
    const box = await watermarkImg.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    const naturalWidth = await watermarkImg.evaluate(
      (img: HTMLImageElement) =>
        img.complete
          ? img.naturalWidth
          : new Promise<number>((resolve) => {
              img.addEventListener("load", () => resolve(img.naturalWidth), { once: true });
              img.addEventListener("error", () => resolve(0), { once: true });
            }),
    );
    expect(naturalWidth).toBeGreaterThan(0);

    // Not a real link/button — purely decorative, must never be focusable
    // or expose an accessible name that would make a screen reader announce
    // it as interactive content.
    await expect(watermarkImg).not.toHaveAttribute("role", "link");
    const tagName = await watermarkWrapper.evaluate((el) => el.tagName);
    expect(tagName).toBe("DIV");
  });

  test.describe("responsive", () => {
    const viewports = [
      { name: "mobile-390", width: 390, height: 900 },
      { name: "tablet-768", width: 768, height: 900 },
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "large-desktop-1920", width: 1920, height: 1000 },
    ];

    for (const { name, width, height } of viewports) {
      test(`${name}: footer renders with no page-level horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const footer = page.locator("footer");
        await footer.scrollIntoViewIfNeeded();
        await expect(footer).toBeVisible();

        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflowX).toBeLessThanOrEqual(1);
      });
    }
  });
});
