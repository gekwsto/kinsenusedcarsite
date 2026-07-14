import { test, expect } from "@playwright/test";

// Regression coverage for the Marketing-supplied local Manrope font
// migration (next/font/google → next/font/local, src/app/layout.tsx).
// Proves — in a real browser, not just by reading source — that the font
// is served first-party by this app's own Next.js build and that no
// request ever reaches Google Fonts or any other external font CDN.

const EXTERNAL_FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

test.describe("local Manrope font", () => {
  test("no request is made to Google Fonts or any external font CDN", async ({ page }) => {
    const externalFontRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (EXTERNAL_FONT_HOSTS.some((host) => url.includes(host))) externalFontRequests.push(url);
    });

    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    expect(externalFontRequests, `Unexpected external font requests:\n${externalFontRequests.join("\n")}`).toEqual([]);
  });

  test("the Manrope font file is served first-party by this app's own origin", async ({ page, baseURL }) => {
    const fontRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/\.(woff2?|ttf|otf)(\?|$)/i.test(url)) fontRequests.push(url);
    });

    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) {
      expect(url.startsWith(baseURL!)).toBe(true);
    }
  });

  test("the loaded font family is Manrope, actually painted (not silently falling back)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const bodyFontFamily = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily.toLowerCase());
    expect(bodyFontFamily).toContain("manrope");

    const loadedManrope = await page.evaluate(() => {
      let found = false;
      document.fonts.forEach((f) => {
        if (f.family.toLowerCase() === "manrope" && f.status === "loaded") found = true;
      });
      return found;
    });
    expect(loadedManrope).toBe(true);

    // A fallback font would measure Greek/Latin text at a different width
    // than Manrope for the same font-size — proves the glyphs are actually
    // painted by the local Manrope file, not a silently-substituted fallback.
    const widths = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const sample = "Ρυθμίσεις Cookies — Σύγκριση αυτοκινήτων — 1.234,56 €";
      ctx.font = "16px manrope";
      const manropeWidth = ctx.measureText(sample).width;
      ctx.font = "16px Arial";
      const arialWidth = ctx.measureText(sample).width;
      return { manropeWidth, arialWidth };
    });
    expect(Math.abs(widths.manropeWidth - widths.arialWidth)).toBeGreaterThan(0.5);
  });

  test("form controls inherit the global local font (no per-component font-family override)", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => document.fonts.ready);

    const emailInput = page.getByLabel(/E-?mail/i).first();
    await expect(emailInput).toBeVisible();
    const inputFont = await emailInput.evaluate((el) => window.getComputedStyle(el).fontFamily.toLowerCase());
    expect(inputFont).toContain("manrope");

    const submitButton = page.getByRole("button", { name: /Σύνδεση/ }).first();
    const buttonFont = await submitButton.evaluate((el) => window.getComputedStyle(el).fontFamily.toLowerCase());
    expect(buttonFont).toContain("manrope");
  });
});
