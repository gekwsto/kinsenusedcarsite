import { test, expect, type Page } from "@playwright/test";
import { bannerLocators, attachFailedRequestGuard, assertNoFailedFirstPartyRequests, waitForBackgroundRequestsSettled } from "./helpers";

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
      await page.goto(path, { waitUntil: "load" });
      await dismissBanner(page);

      const images = page.locator("img[src]");
      await expect(images.first()).toBeVisible();
      expect(await images.count()).toBeGreaterThan(0);
      const firstImageSrc = await images.first().getAttribute("src");
      expect(firstImageSrc).toBeTruthy();

      // Let this page's own trailing background requests actually settle
      // (excluding the permanent realtime SSE connection, which never
      // "finishes") before trusting that the failed-request guard has seen
      // everything it's going to see — a late-arriving failed request
      // shouldn't be able to slip past this assertion just because it
      // hadn't happened yet.
      await waitForBackgroundRequestsSettled(page);
      assertNoFailedFirstPartyRequests(failedRequests);
    });
  }

  test("homepage benefit cards each render their own distinct image", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await dismissBanner(page);

    const benefitHeading = page.getByText("Οικονομία & Προβλέψιμο Κόστος");
    await benefitHeading.scrollIntoViewIfNeeded();

    const benefitImages = page.locator("section img");
    // Scrolling into view can trigger these images' lazy load a tick after
    // the scroll itself, so poll rather than reading currentSrc immediately.
    await expect
      .poll(async () =>
        benefitImages.evaluateAll((imgs) =>
          imgs
            .map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src)
            .filter((src) => src.includes("kinsencar") || src.includes("hondaphoto") || src.includes("couple")).length,
        ),
      )
      .toBeGreaterThanOrEqual(3);
  });
});
