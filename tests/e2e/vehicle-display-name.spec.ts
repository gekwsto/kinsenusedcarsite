import { test, expect } from "@playwright/test";
import { bannerLocators } from "./helpers";

// versionName is now expected to already include the maker (e.g. "Volvo
// XC40"), so every place that used to render `${maker} ${versionName}`
// would otherwise show the brand twice ("Volvo Volvo XC40"). These tests
// prove the fix directly against real API data rather than just eyeballing
// a screenshot: fetch a vehicle's actual maker/versionName and assert the
// rendered text is exactly versionName, never maker-prefixed.

async function dismissBanner(page: import("@playwright/test").Page) {
  const banner = bannerLocators(page);
  if ((await banner.rejectButton.count()) > 0) {
    await banner.rejectButton.click({ timeout: 5000 }).catch(() => {});
  }
}

test.describe("vehicle display name — versionName only, no maker duplication", () => {
  test("a vehicle listing card's title is exactly versionName, not \"maker versionName\"", async ({ page, baseURL }) => {
    const res = await page.request.get(`${baseURL}/api/vehicles?page=1`);
    const data = await res.json();
    const vehicle = data.items?.[0];
    test.skip(!vehicle, "No vehicles available in this environment.");

    await page.goto("/vehicles");
    await dismissBanner(page);

    const card = page.getByRole("group", { name: vehicle.versionName }).first();
    await expect(card).toBeVisible();
    const title = card.locator("h3");
    await expect(title).toHaveText(vehicle.versionName);
    // The maker-prefixed form must not appear anywhere on the card.
    await expect(title).not.toHaveText(`${vehicle.maker} ${vehicle.versionName}`);
  });

  test("the vehicle detail page's big title (below the gallery) is versionName + year only, no maker prefix", async ({ page, baseURL }) => {
    const res = await page.request.get(`${baseURL}/api/vehicles?page=1`);
    const data = await res.json();
    const vehicle = data.items?.[0];
    test.skip(!vehicle, "No vehicles available in this environment.");

    await page.goto(`/vehicles/${vehicle.slug}`);
    await dismissBanner(page);

    const heading = page.getByRole("heading", { level: 1 });
    const headingText = (await heading.textContent())?.trim();
    expect(headingText?.startsWith(vehicle.maker)).toBe(false);
    expect(headingText?.startsWith(vehicle.versionName)).toBe(true);
  });

  test("the interest modal's \"Για το όχημα\" text uses versionName only, no maker prefix", async ({ page, baseURL }) => {
    const res = await page.request.get(`${baseURL}/api/vehicles?page=1`);
    const data = await res.json();
    const vehicle = data.items?.[0];
    test.skip(!vehicle, "No vehicles available in this environment.");

    await page.goto(`/vehicles/${vehicle.slug}`);
    await dismissBanner(page);

    const trigger = page.getByRole("button", { name: /Ενδιαφέρομαι για/ }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`Για το όχημα: ${vehicle.versionName}`, { exact: false })).toBeVisible();
    await expect(dialog.getByText(`Για το όχημα: ${vehicle.maker} ${vehicle.versionName}`, { exact: false })).toHaveCount(0);
  });
});
