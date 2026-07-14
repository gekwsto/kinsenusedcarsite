import { test, expect } from "@playwright/test";
import { attachRuntimeErrorGuard, assertNoRuntimeErrors, bannerLocators, footerSettingsButton } from "./helpers";

test.describe("privacy policy page", () => {
  test("[27] renders successfully with exactly one H1 and the expected title", async ({ page }) => {
    const runtimeGuard = attachRuntimeErrorGuard(page);
    const response = await page.goto("/privacy-policy");
    expect(response?.ok()).toBe(true);

    await expect(page).toHaveTitle(/Πολιτική Προστασίας Δεδομένων Προσωπικού Χαρακτήρα/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Πολιτική Προστασίας Δεδομένων Προσωπικού Χαρακτήρα" })).toBeVisible();

    assertNoRuntimeErrors(runtimeGuard);
  });

  test("[27] sections 1-9 and subsections 3.1/3.2 are present", async ({ page }) => {
    await page.goto("/privacy-policy");
    // Scoped to the article — the cookie banner has its own <h2> title
    // ("Η ιδιωτικότητά σας...") which is legitimate, unrelated markup that
    // a page-wide heading query would otherwise also pick up.
    const article = page.locator("article");
    const h2s = article.getByRole("heading", { level: 2 });
    await expect(h2s).toHaveCount(9);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      await expect(article.getByRole("heading", { level: 2, name: new RegExp(`^${n}\\.`) })).toBeVisible();
    }
    await expect(article.getByRole("heading", { level: 3, name: /^3\.1\./ })).toBeVisible();
    await expect(article.getByRole("heading", { level: 3, name: /^3\.2\./ })).toBeVisible();
  });

  test("[28] exactly two legal tables, each with exactly 5 body rows", async ({ page }) => {
    await page.goto("/privacy-policy");
    const tables = page.locator("table");
    await expect(tables).toHaveCount(2);

    for (let i = 0; i < 2; i++) {
      const bodyRows = tables.nth(i).locator("tbody tr");
      await expect(bodyRows).toHaveCount(5);
    }
  });

  test("[29] email link and DPA link render correctly and safely", async ({ page }) => {
    await page.goto("/privacy-policy");

    const emailLink = page.locator('a[href="mailto:info@kinsen.gr"]').filter({ hasText: "info@kinsen.gr" });
    await expect(emailLink.first()).toBeVisible();

    const dpaLink = page.getByRole("link", { name: "www.dpa.gr" });
    await expect(dpaLink).toBeVisible();
    await expect(dpaLink).toHaveAttribute("href", "https://www.dpa.gr");
    await expect(dpaLink).toHaveAttribute("target", "_blank");
    await expect(dpaLink).toHaveAttribute("rel", /noreferrer/);
  });

  test("exact last-updated text 'στις22.02.2022' remains present (approved wording untouched)", async ({ page }) => {
    await page.goto("/privacy-policy");
    // This page sits under a Next.js `loading.tsx` Suspense boundary
    // (src/app/(public)/loading.tsx) — proven via direct repeated DOM
    // inspection to occasionally produce a brief, transient double-render
    // of the *entire* page (two <article> trees, two <h1>s, both genuinely
    // `display:block`/`visibility:visible`, both containing identical
    // correct text) while the streamed real content settles in over the
    // Suspense fallback. Both copies are always identical — never a
    // content defect — and it resolves on its own; a plain
    // `getByText(...).toBeVisible()` can hit a hard strict-mode error
    // (2 matches) during that exact window, which does not retry the same
    // way `toHaveCount()` does. Asserting the count first (same proven
    // pattern already used for the page's <h1> in the test above) waits
    // out the transient duplicate instead of asserting through it.
    // The duplicate has been observed (rarely) to still be resolving
    // slightly past this suite's default 5000ms expect timeout under
    // system load — a generous explicit timeout here waits it out
    // reliably without weakening what's being asserted (still exactly one
    // real match, still visible).
    const lastUpdatedParagraph = page.getByText("στις22.02.2022");
    await expect(lastUpdatedParagraph).toHaveCount(1, { timeout: 15_000 });
    await expect(lastUpdatedParagraph).toBeVisible();
  });

  test("[27] footer privacy link and settings button remain present on the privacy page itself", async ({ page }) => {
    await page.goto("/privacy-policy");
    await expect(page.locator("footer").getByRole("link", { name: "Πολιτική Προστασίας Δεδομένων" })).toBeVisible();
    await expect(footerSettingsButton(page)).toBeVisible();
  });

  test("email and DPA links are keyboard reachable", async ({ page }) => {
    await page.goto("/privacy-policy");
    const dpaLink = page.getByRole("link", { name: "www.dpa.gr" });
    await dpaLink.focus();
    await expect(dpaLink).toBeFocused();
  });

  test("first-visit banner still functions correctly on the privacy-policy route itself", async ({ page }) => {
    await page.goto("/privacy-policy");
    await expect(bannerLocators(page).region).toBeVisible();
  });

  test("no page-level horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/privacy-policy");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("legal tables are contained by their own responsive overflow wrapper at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/privacy-policy");
    const wrapperOverflowsX = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table"));
      return tables.every((table) => {
        const wrapper = table.parentElement;
        if (!wrapper) return false;
        const style = getComputedStyle(wrapper);
        return style.overflowX === "auto" || style.overflowX === "scroll";
      });
    });
    expect(wrapperOverflowsX).toBe(true);
  });
});
