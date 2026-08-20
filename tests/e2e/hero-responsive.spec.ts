import { test, expect, type Page } from "@playwright/test";
import { bannerLocators } from "./helpers";

// Locks the hard-won properties of the homepage Hero
// (src/components/home/hero.tsx), a single semantic tree — one
// `<section>`, one `<Image>`, one `<h1>`, one `<p>` — where every
// portrait/landscape-phone/tablet/desktop difference is expressed as
// responsive class variants on those same elements (an earlier version
// duplicated the whole Hero into a separate CSS-hidden mobile copy and a
// desktop copy; that duplication is why this file used to need `:visible`
// filters to disambiguate two `<h1>`s and two `<img>`s — now there's
// exactly one of each, so plain `h1`/`img` locators are unambiguous):
//
// 1. Landscape-phone vs. short-desktop typography. An earlier attempt to
//    harden the landscape media query by extracting it into a JS constant
//    and interpolating it into a template literal —
//    `` `${LANDSCAPE_PHONE}:text-2xl` `` — compiled and built without any
//    error, but Tailwind's static content scanner never executes JS, so
//    the class never matched any real utility and silently generated
//    *zero* CSS. `typecheck`/`lint`/`build` all stayed green throughout;
//    only a real computed-style check against a rendered page catches it.
//
// 2. Portrait-phone image integrity. At a portrait aspect ratio,
//    `object-cover` on a full-bleed container can only ever show ~37-45%
//    of the source photo's width, regardless of `object-position` — an
//    earlier fix biased that crop toward the left wall to make room for
//    the text, which is exactly what made the blue SUV and silver sedan
//    disappear on real phones. The fix was to size the mobile image
//    container to the photo's own exact aspect ratio (no crop possible)
//    and overlay the text on the real clean wall area the photo already
//    contains. This test protects both halves of that: the image must
//    never carry a crop-biased `object-position` again, and the text must
//    genuinely overlap the photo (not sit in a separate panel above/below
//    it, which was also tried and rejected along the way).
//
// 3. Exactly one heading and one image in the DOM at every viewport —
//    the actual consolidation this file's history is about.
//
// 4. The Hero image is never responsively cropped, at ANY viewport, with
//    NO exceptions — portrait phone, landscape phone, tablet (either
//    orientation), desktop, or wide desktop. Three passes found and fixed
//    violations of this: a first tablet-readability attempt shifted the
//    crop window with `object-left` (still cropped the locked source
//    photo, just aimed differently); the desktop/wide-desktop path used a
//    `70vh`-driven box that cropped the image vertically (sky/floor) at
//    every desktop width; and short landscape phones kept a similar
//    `70vh`-driven exception on the reasoning that a full 16:9 box there
//    would exceed the phone's own viewport height — rejected, since this
//    is a normal scrollable document, not a presentation slide, and image
//    integrity outranks fitting the Hero inside one screen. All three
//    were the same underlying mismatch: an explicit `height`/`min-height`
//    competing with (and, per the CSS spec, always winning over)
//    `aspect-ratio`. The fix, now applied completely unconditionally, is
//    what the portrait-phone tier always used: `aspect-[16/9]` with no
//    competing height at all, so `object-cover` has nothing left to crop
//    on any edge, at any width, ever. This suite protects that geometry
//    (rendered aspect ratio must match the image's natural ratio,
//    `object-position` must stay at the untouched browser default) across
//    every representative viewport tier, including short landscape
//    phones — there is no longer a tier this check excludes.

const IMAGE_ASPECT_TOLERANCE = 0.02;

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

test.describe("homepage Hero — single semantic tree, no duplicated content", () => {
  for (const [width, height, label] of [
    [375, 667, "portrait phone"],
    [667, 375, "landscape phone"],
    [1920, 1000, "desktop"],
  ] as const) {
    test(`${label} (${width}×${height}): exactly one Hero heading and one Hero image exist`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await dismissBanner(page);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('img[alt="Kinsen hero image"]')).toHaveCount(1);
    });
  }
});

test.describe("homepage Hero — landscape-phone vs. short-desktop typography", () => {
  test("a genuine landscape phone gets the compact heading, on the same uncropped 16:9 image as every other tier", async ({
    page,
  }) => {
    // 667×375 is the iPhone-SE-landscape case the original bug was found on.
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto("/");
    await dismissBanner(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const fontSize = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    // Compact landscape-phone tier is 24px (text-2xl); the desktop-bound
    // tier this viewport's *width* would otherwise land on (sm:text-5xl)
    // is 48px, so a generous ceiling well below that still catches the
    // "rule silently didn't apply" failure mode without being brittle to
    // a future few-pixel retune.
    expect(fontSize).toBeLessThan(32);

    // This tier used to keep its own shorter, `min-height`-floored Hero
    // box (a crop exception) — removed. It now shares the exact same
    // `aspect-[16/9]` geometry as every other tier: no crop, box taller
    // than this short viewport, page scrolls to reveal the rest of it.
    const heroImage = page.locator('img[alt="Kinsen hero image"]');
    const { renderedAspect } = await heroImage.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { renderedAspect: rect.width / rect.height };
    });
    expect(Math.abs(renderedAspect - 16 / 9)).toBeLessThanOrEqual(0.05);
  });

  test("a short DESKTOP window keeps full desktop typography, not the mobile-landscape override", async ({ page }) => {
    // Same short height as the phone case above, but a desktop-scale
    // width — this is the exact scenario the hardened query exists to
    // exclude (a bare `max-height` rule would incorrectly fire here too).
    await page.setViewportSize({ width: 1440, height: 450 });
    await page.goto("/");
    await dismissBanner(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const fontSize = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    // Desktop tier at 1440px width is xl:text-7xl (72px) — well clear of
    // the 24px phone-landscape size. (This exact case briefly regressed
    // during the single-tree consolidation: Tailwind emits arbitrary
    // `[@media(...)]:` variants after every named screen regardless of
    // source order, so an unbounded `[@media(min-width:481px)]:text-3xl`
    // kept beating `xl:text-7xl` here too — fixed by bounding that rule to
    // `481px-639px` so it hands off cleanly to `sm:` at 640px.)
    expect(fontSize).toBeGreaterThan(50);

    // The Hero box itself must still be governed by the source image's
    // 16:9 aspect ratio here (not the compact landscape-phone override,
    // which would make it far shorter than its own width implies) —
    // `min-height` is no longer the mechanism that protects this (the
    // desktop path carries no explicit height/min-height at all now, by
    // design, so `aspect-ratio` can actually govern), so this checks the
    // real invariant directly: rendered width÷height ≈ 16:9.
    const heroImage = page.locator('img[alt="Kinsen hero image"]');
    const { renderedAspect } = await heroImage.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { renderedAspect: rect.width / rect.height };
    });
    expect(Math.abs(renderedAspect - 16 / 9)).toBeLessThanOrEqual(0.05);
  });
});

test.describe("homepage Hero — portrait-phone image stays complete, text overlays the real photo", () => {
  for (const [width, height] of [
    [375, 667],
    [414, 896],
  ] as const) {
    test(`${width}×${height}: image is uncropped and the heading genuinely overlays it`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await dismissBanner(page);

      const heroImage = page.locator('img[alt="Kinsen hero image"]');
      await expect(heroImage).toBeVisible();

      // No crop bias: `object-position` must stay at the browser default
      // (50% 50%) — a non-default value here means a crop-shifting trick
      // has been reintroduced, which is exactly what previously hid the
      // blue SUV and silver sedan on narrow phones.
      const objectPosition = await heroImage.evaluate((el) => getComputedStyle(el).objectPosition);
      expect(objectPosition).toBe("50% 50%");

      // The container must be sized to the photo's own ~16:9 aspect ratio
      // (not squashed into a fixed viewport-height band) — that's what
      // guarantees `object-cover` has nothing left to crop. A wide
      // tolerance (1.6-1.95) catches "someone reintroduced a fixed/forced
      // height" without being brittle to sub-pixel layout rounding.
      const imageBox = await heroImage.boundingBox();
      expect(imageBox).not.toBeNull();
      const aspectRatio = imageBox!.width / imageBox!.height;
      expect(aspectRatio).toBeGreaterThan(1.6);
      expect(aspectRatio).toBeLessThan(1.95);

      // The heading must genuinely sit ON the photo — vertically inside
      // the image's own bounding box — not in a separate block above or
      // below it (both a plain white panel and a sampled-color "matte"
      // extension were tried and rejected specifically because the text
      // ended up outside the photo instead of on it).
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();
      const h1Box = await h1.boundingBox();
      expect(h1Box).not.toBeNull();
      expect(h1Box!.y).toBeGreaterThanOrEqual(imageBox!.y - 1);
      expect(h1Box!.y + h1Box!.height).toBeLessThanOrEqual(imageBox!.y + imageBox!.height + 1);
    });
  }
});

test.describe("homepage Hero — the full source image renders uncropped on every edge, at every viewport tier", () => {
  for (const [width, height, label] of [
    [375, 667, "portrait phone"],
    [430, 932, "portrait phone"],
    [568, 320, "landscape phone"],
    [667, 375, "landscape phone"],
    [844, 390, "landscape phone"],
    [956, 440, "landscape phone"],
    [768, 1024, "portrait tablet (iPad Mini)"],
    [820, 1180, "portrait tablet (iPad Air)"],
    [1024, 768, "landscape tablet (iPad Mini)"],
    [1180, 820, "landscape tablet (iPad Air)"],
    [1194, 834, "landscape tablet"],
    [1280, 800, "desktop"],
    [1366, 768, "desktop"],
    [1440, 900, "desktop"],
    [1600, 900, "desktop"],
    [1920, 1000, "wide desktop"],
    [1920, 1080, "wide desktop"],
    [2560, 1440, "wide desktop"],
  ] as const) {
    test(`${label} (${width}×${height}): image renders at the source's own 16:9 ratio — object-cover has nothing left to crop on any edge`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await dismissBanner(page);

      const heroImage = page.locator('img[alt="Kinsen hero image"]');
      await expect(heroImage).toBeVisible();

      // No crop-biased object-position (a first pass tried `object-left`
      // here specifically — rejected: it still crops the locked source
      // photo, just aimed differently). Must stay at the untouched
      // browser default, same invariant the portrait-phone tier already
      // protects above.
      const objectPosition = await heroImage.evaluate((el) => getComputedStyle(el).objectPosition);
      expect(objectPosition).toBe("50% 50%");

      // The real proof of "nothing cropped": the rendered box's own
      // aspect ratio must match the image's natural (source) aspect
      // ratio. If the box were any other shape, `object-cover` would
      // necessarily crop whichever axis overflows — this is exactly what
      // every `70vh`-driven box this file used to have (at every tier,
      // including this one) would fail.
      const { renderedAspect, naturalAspect } = await heroImage.evaluate((el) => {
        const img = el as HTMLImageElement;
        const rect = img.getBoundingClientRect();
        return { renderedAspect: rect.width / rect.height, naturalAspect: img.naturalWidth / img.naturalHeight };
      });
      expect(Math.abs(renderedAspect - naturalAspect)).toBeLessThanOrEqual(IMAGE_ASPECT_TOLERANCE);

      // No horizontal overflow at this deliberately-narrow text budget.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      // Exactly one Hero heading/image still holds at these tiers too.
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(heroImage).toHaveCount(1);
    });
  }
});
