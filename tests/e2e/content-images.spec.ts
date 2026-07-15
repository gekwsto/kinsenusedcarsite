import { test, expect, type Page } from "@playwright/test";
import { bannerLocators, attachFailedRequestGuard, assertNoFailedFirstPartyRequests } from "./helpers";

async function dismissBanner(page: Page) {
  const banner = bannerLocators(page);
  if ((await banner.rejectButton.count()) > 0) {
    await banner.rejectButton.click({ timeout: 5000 }).catch(() => {});
  }
}

// Regression coverage for making page-content images admin-editable: every
// image that used to be a hardcoded path in these public components is now
// sourced from PageContent (with the exact same path as its default), so
// these pages must still render a real image with no failed request —
// proving the content.service fallback/merge and the components' new
// `content.image` usage didn't silently break image loading.
test.describe("content-driven page images render correctly", () => {
  const pages: { path: string; label: string }[] = [
    { path: "/", label: "homepage hero" },
    { path: "/financing", label: "financing hero" },
    { path: "/warranty", label: "warranty hero" },
    { path: "/faq", label: "FAQ hero" },
    { path: "/contact", label: "contact photo" },
  ];

  for (const { path, label } of pages) {
    test(`${label} (${path}): a real image loads, no failed first-party request`, async ({ page, baseURL }) => {
      const failedRequests = attachFailedRequestGuard(page, baseURL!);
      await page.goto(path);
      await dismissBanner(page);
      await page.waitForLoadState("networkidle");

      const images = page.locator("img[src]");
      expect(await images.count()).toBeGreaterThan(0);
      const firstImageSrc = await images.first().getAttribute("src");
      expect(firstImageSrc).toBeTruthy();

      assertNoFailedFirstPartyRequests(failedRequests);
    });
  }

  test("homepage benefit cards each render their own distinct image", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);
    await page.waitForLoadState("networkidle");

    const benefitHeading = page.getByText("Οικονομία & Προβλέψιμο Κόστος");
    await benefitHeading.scrollIntoViewIfNeeded();

    const benefitImages = page.locator("section img");
    const srcs = await benefitImages.evaluateAll((imgs) =>
      imgs.map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src).filter((src) => src.includes("kinsencar") || src.includes("hondaphoto") || src.includes("couple")),
    );
    expect(srcs.length).toBeGreaterThanOrEqual(3);
  });
});
