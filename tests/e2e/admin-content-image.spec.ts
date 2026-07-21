import { test, expect } from "@playwright/test";
import path from "node:path";
import { loginAsAdmin } from "./helpers";

// Regression coverage for the admin content-image save flow
// (src/components/admin/content-manager.tsx). Root cause fixed: clicking
// "Αποθήκευση" while an image upload was still in flight PATCHed the
// section with the still-stale `value.image` (the upload's `onChange`
// hadn't landed in form state yet), persisting the *old* image — the new
// one appeared to "stick" locally (the upload's onChange fired moments
// later) but reverted on the next page load and was never applied on the
// public site. The fix disables Save for the section for as long as any of
// its image fields has an upload in flight.
//
// Uses the warranty.hero section specifically so it doesn't collide with
// manual testing on the homepage hero, and resets it back to defaults at
// the end of every test so re-runs are idempotent and no test image is
// left as the "real" persisted value.

const TEST_IMAGE = path.resolve(__dirname, "fixtures/test-image.png");

test.describe("admin content image upload/save", () => {
  test.afterEach(async ({ page }) => {
    await page.goto("/admin/content", { waitUntil: "networkidle" });
    const section = warrantySection(page);
    const resetBtn = section.getByRole("button", { name: "Προεπιλογή" });
    if (await resetBtn.isVisible().catch(() => false)) {
      await resetBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test("upload -> save persists the new image; survives a full admin reload and renders on the public page", async ({ page, baseURL }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/content", { waitUntil: "networkidle" });

    const section = warrantySection(page);
    await section.scrollIntoViewIfNeeded();

    await section.locator('input[type="file"]').setInputFiles(TEST_IMAGE);
    await expect(section.getByRole("button", { name: "Αποθήκευση" })).toBeEnabled({ timeout: 10000 });

    await section.getByRole("button", { name: "Αποθήκευση" }).click();
    await expect(page.getByText("Αποθηκεύτηκε", { exact: true })).toBeVisible({ timeout: 10000 });

    const savedSrc = await section.locator("img").getAttribute("src");
    expect(savedSrc).toBeTruthy();
    expect(savedSrc).toContain("uploads%2Fcontent%2Fwarranty.hero%2F");

    // Full admin reload: the persisted value (not the pre-save local state) must still show.
    await page.reload({ waitUntil: "networkidle" });
    const afterReloadSrc = await warrantySection(page).locator("img").getAttribute("src");
    expect(afterReloadSrc).toBe(savedSrc);

    // Public page must render the same stored image. Located by the hero's
    // alt text (its title, unchanged by this test) rather than "first img
    // on the page", since the header logo renders before it in DOM order.
    await page.goto("/warranty", { waitUntil: "networkidle" });
    const publicImg = page.getByAltText("Απόλυτη σιγουριά με την Εγγύηση Kinsen");
    const publicSrc = await publicImg.getAttribute("src");
    expect(publicSrc).toContain("uploads%2Fcontent%2Fwarranty.hero%2F");
    void baseURL;
  });

  test("clicking Save immediately after selecting a file does not persist a stale image (regression for the upload/save race)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/content", { waitUntil: "networkidle" });

    // Deterministically delay just the image-upload response so it is still
    // in flight at the moment we try to click Save — a flaky CDP network
    // throttle isn't reliable enough to guarantee that window.
    await page.route("**/api/admin/content/warranty.hero/image", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    let uploadResponseAt = 0;
    let saveRequestAt = 0;
    let savePayload = "";
    page.on("response", (res) => {
      if (res.url().endsWith("/api/admin/content/warranty.hero/image") && res.request().method() === "POST") {
        uploadResponseAt = Date.now();
      }
    });
    page.on("request", (req) => {
      if (req.url().endsWith("/api/admin/content/warranty.hero") && req.method() === "PATCH") {
        saveRequestAt = Date.now();
        savePayload = req.postData() ?? "";
      }
    });

    const section = warrantySection(page);
    await section.scrollIntoViewIfNeeded();

    const saveBtn = section.getByRole("button", { name: /Αποθήκευση/ });
    await section.locator('input[type="file"]').setInputFiles(TEST_IMAGE);

    // A real impatient admin click, fired immediately after picking the
    // file rather than after waiting for the upload toast. Playwright's
    // .click() auto-waits for the target to become actionable, so if Save
    // is correctly disabled while the upload is in flight, this call blocks
    // until it re-enables — exactly like a real disabled <button> would for
    // a human clicking it early. If the regression ever comes back (Save
    // wrongly stays clickable), this fires immediately, before the upload
    // response, and the assertions below on ordering/payload catch it.
    await saveBtn.click();
    await expect(page.getByText("Αποθηκεύτηκε", { exact: true })).toBeVisible({ timeout: 10000 });

    expect(uploadResponseAt, "upload response was never observed").toBeGreaterThan(0);
    expect(saveRequestAt, "save (PATCH) request was never observed").toBeGreaterThan(0);
    // The PATCH must never fire before the upload it depends on has
    // resolved — that ordering is exactly what "Save blocked while
    // uploading" guarantees, and what a stale-payload save would violate.
    expect(saveRequestAt).toBeGreaterThanOrEqual(uploadResponseAt);
    expect(savePayload).toContain("/uploads/content/warranty.hero/");

    const savedSrc = await section.locator("img").getAttribute("src");

    await page.reload({ waitUntil: "networkidle" });
    const afterReloadSrc = await warrantySection(page).locator("img").getAttribute("src");
    // The value that survives a reload (the DB-persisted one) must be the
    // freshly uploaded image, not the pre-upload default/old image.
    expect(afterReloadSrc).toBe(savedSrc);
    expect(afterReloadSrc).toContain("uploads%2Fcontent%2Fwarranty.hero%2F");
  });
});

function warrantySection(page: import("@playwright/test").Page) {
  return page.locator(".rounded-card").filter({ has: page.getByRole("heading", { name: "Εγγύηση — Τίτλος σελίδας" }) });
}
