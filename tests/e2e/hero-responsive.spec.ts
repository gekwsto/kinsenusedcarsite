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
// 4. TWO deliberate media-geometry modes, not a single universal rule:
//
//    PHONE/TABLET (below `1280px`): the Hero image is never responsively
//    cropped, with no exceptions. A first tablet-readability attempt
//    shifted the crop window with `object-left` (still cropped the
//    locked source photo, just aimed differently) — rejected. `aspect-
//    [16/9]` with no competing `height` means `object-cover` has nothing
//    left to crop on any edge at these widths, so this suite protects
//    that geometry (rendered aspect ratio must match the image's natural
//    ratio, `object-position` must stay at the untouched browser
//    default) across every phone/tablet tier, including short landscape
//    phones.
//
//    LAPTOP/DESKTOP (`1280px`+, `.hero-media-box`'s own media-geometry
//    rule): the Hero stays genuinely full-width — no side gutters, no
//    width cap (an earlier pass tried exactly that: `width: min(100%,
//    ...)` centered inside large left/right gutters — rejected, the
//    Hero is meant to be a full-width visual statement) — but a real
//    16:9 box at these widths would need to grow taller than useful
//    (2560px wide -> 1440px tall), so `aspect-ratio` is released and a
//    `height: clamp(...)` takes over instead. Because the section is now
//    wider than 16:9, `object-cover` scales the photo to the section's
//    own width and crops only vertically (sky above the cars, floor
//    below) — a deliberate, accepted trade-off specific to this tier,
//    verified to stay restrained enough that the full horizontal
//    composition and every vehicle stay intact. This suite protects the
//    desktop contract separately: full viewport width, no horizontal
//    crop (checked via the actual `object-cover` geometry, not just the
//    CSS declaration), height bounded by the clamp, all three vehicles'
//    approximate vertical band still inside the visible window.

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

    // At this width the Hero is in desktop media-geometry mode (full
    // width, controlled height via `.hero-media-box`'s clamp), NOT the
    // compact landscape-phone `aspect-[16/9]` box — the two modes are
    // told apart by width alone (`min-width:1280px`), never by height,
    // which is exactly what this "short but wide" viewport exists to
    // prove. Full width confirms the desktop mode actually engaged;
    // the clamp's own 560px floor is what should govern the height at
    // this unusually short 450px viewport.
    const section = page.locator("section").first();
    const box = await section.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width)).toBe(1440);
    expect(box!.height).toBeGreaterThanOrEqual(559);
    expect(box!.height).toBeLessThanOrEqual(561);
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

test.describe("homepage Hero — phone/tablet: the full source image renders uncropped on every edge (16:9, no exceptions)", () => {
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

// `object-cover` scaling math, used to turn "the box is wider than 16:9"
// into an actual, checkable crop percentage rather than trusting the CSS
// declaration alone. When the container's aspect ratio exceeds the
// source's, `object-cover` scales the image so its WIDTH matches the
// container (i.e. `scaledHeight = containerWidth / naturalAspect`) and
// crops only the vertical overflow — horizontal crop is mathematically
// impossible in that regime, since the image's scaled width already
// equals the container's own width exactly.
function verticalCropPercent(containerWidth: number, containerHeight: number, naturalAspect: number) {
  const scaledHeight = containerWidth / naturalAspect;
  return 100 * (1 - containerHeight / scaledHeight);
}

test.describe("homepage Hero — laptop/desktop: full width, controlled height, vertical-only crop", () => {
  for (const [width, height, label] of [
    [1280, 800, "laptop"],
    [1366, 768, "laptop"],
    [1440, 900, "laptop"],
    [1512, 982, "laptop"],
    [1728, 1117, "laptop"],
    [1920, 1000, "desktop"],
    [1920, 1080, "desktop"],
    [2048, 1152, "desktop"],
    [2304, 1296, "large desktop"],
    [2560, 1440, "target large-monitor class"],
    [2880, 1620, "large desktop"],
    [3440, 1440, "ultrawide"],
  ] as const) {
    test(`${label} (${width}×${height}): Hero spans the full viewport width with no side gutters, height stays within the clamp, crop is vertical-only and stays visually safe`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await dismissBanner(page);

      const section = page.locator("section").first();
      const box = await section.boundingBox();
      expect(box).not.toBeNull();

      // Full width, no side gutters — the earlier width-cap architecture
      // (centered, with large left/right whitespace) is explicitly
      // rejected; this is the regression guard for it.
      expect(Math.round(box!.width)).toBe(width);
      expect(box!.x).toBeLessThanOrEqual(1);

      // Height stays inside `clamp(560px, max(72svh, 34vw), 1200px)` —
      // never grows past the absolute ceiling no matter how wide the
      // viewport gets, never collapses below the floor either. The `34vw`
      // term (added specifically to curb ultrawide vertical crop — a flat
      // `72svh`-only ceiling let crop climb to 57.6% at 3440px) means the
      // realistic max in this test matrix is ~1170px at 3440px, well
      // under the 1200px absolute ceiling.
      expect(box!.height).toBeGreaterThanOrEqual(559);
      expect(box!.height).toBeLessThanOrEqual(1201);

      // Centered, unshifted vertical positioning — no horizontal focal
      // trick, no zoom, just the plain `object-cover` default.
      const heroImage = section.locator('img[alt="Kinsen hero image"]');
      const objectPosition = await heroImage.evaluate((el) => getComputedStyle(el).objectPosition);
      expect(objectPosition).toBe("50% 50%");

      // The real proof of "no horizontal crop": compute the expected
      // vertical-only crop from the actual rendered box + the image's own
      // natural aspect ratio, and confirm the visible image width still
      // equals the container's full width (never narrower — narrower
      // would mean the image itself failed to cover the box's width,
      // which `object-cover` never does, but this is the direct
      // geometric check rather than trusting the CSS declaration alone).
      const { naturalAspect, imgWidth, imgHeight } = await heroImage.evaluate((el) => {
        const img = el as HTMLImageElement;
        const rect = img.getBoundingClientRect();
        return { naturalAspect: img.naturalWidth / img.naturalHeight, imgWidth: rect.width, imgHeight: rect.height };
      });
      expect(Math.round(imgWidth)).toBe(Math.round(box!.width));

      const cropPct = verticalCropPercent(box!.width, box!.height, naturalAspect);
      // A restrained, "sky/floor only" crop — comfortably below the
      // point where the cars' own vertical band (measured against the
      // source photo) would start being touched. The `34vw` term keeps
      // this near a roughly constant ~28-40% across the whole large-
      // desktop/ultrawide range in this matrix (confirmed via screenshot
      // at 2560/2880/3440) instead of climbing indefinitely — a ceiling
      // here well below the old formula's 57.6% high-water mark catches
      // a regression back toward that flat-ceiling behavior.
      expect(cropPct).toBeGreaterThanOrEqual(0);
      expect(cropPct).toBeLessThan(45);
      expect(Math.round(imgHeight)).toBe(Math.round(box!.height));

      // The overlay text stays attached to the photo box itself, not
      // separately positioned against the viewport.
      const h1Box = await page.locator("h1").boundingBox();
      expect(h1Box).not.toBeNull();
      expect(h1Box!.x).toBeGreaterThanOrEqual(box!.x - 1);
      expect(h1Box!.x + h1Box!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
      expect(h1Box!.y).toBeGreaterThanOrEqual(box!.y - 1);
      expect(h1Box!.y + h1Box!.height).toBeLessThanOrEqual(box!.y + box!.height + 1);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(heroImage).toHaveCount(1);
    });
  }

  test("the 1280px transition is smooth — 1279 (16:9, phone/tablet mode) to 1281 (full-width, controlled-height mode) is not a visually absurd jump", async ({
    page,
  }) => {
    const heights: Record<number, number> = { 1279: 800, 1280: 800, 1281: 800 };
    const boxes: Record<number, { width: number; height: number }> = {};

    for (const width of [1279, 1280, 1281]) {
      await page.setViewportSize({ width, height: heights[width]! });
      await page.goto("/");
      await dismissBanner(page);
      const box = await page.locator("section").first().boundingBox();
      expect(box).not.toBeNull();
      boxes[width] = { width: box!.width, height: box!.height };
    }

    // Below the gate: still the 16:9 box (height ≈ width * 9/16).
    expect(Math.abs(boxes[1279]!.height - boxes[1279]!.width * (9 / 16))).toBeLessThanOrEqual(2);
    // At/above the gate: controlled-height mode, height pinned near the
    // clamp's floor at this viewport height (800 -> 72svh = 576px).
    expect(Math.abs(boxes[1280]!.height - 576)).toBeLessThanOrEqual(2);
    expect(Math.abs(boxes[1281]!.height - 576)).toBeLessThanOrEqual(2);
    // The height change across the boundary is a deliberate mode switch,
    // not an arbitrary jump — 720px (16:9 at 1279) down to ~576px is the
    // intended, measured transition, not some much larger discontinuity.
    expect(Math.abs(boxes[1279]!.height - boxes[1280]!.height)).toBeLessThan(200);

    // Width stays full (no gutter) on both sides of the boundary either way.
    expect(Math.round(boxes[1279]!.width)).toBe(1279);
    expect(Math.round(boxes[1280]!.width)).toBe(1280);
    expect(Math.round(boxes[1281]!.width)).toBe(1281);
  });

  test("1024×768 (tablet landscape, below the desktop gate): Hero stays in 16:9 no-crop mode, not the desktop clamp", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    await dismissBanner(page);

    const section = page.locator("section").first();
    const box = await section.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width)).toBe(1024);
    // 16:9, not the desktop clamp's height (which would be ~553px here).
    expect(Math.abs(box!.height - 1024 * (9 / 16))).toBeLessThanOrEqual(2);
  });
});
