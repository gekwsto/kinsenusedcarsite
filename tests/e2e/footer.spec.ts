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
      { name: "Δείτε τα οχήματα", href: /\/vehicles$/ },
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

  test("the CTA link has no trailing arrow icon — plain underlined text only", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const cta = page.locator("footer").getByRole("link", { name: "Δείτε τα οχήματα", exact: true });
    await expect(cta).toBeVisible();
    // Exact accessible name (not a substring match) already rules out any
    // extra accessible content; this additionally confirms there's no
    // decorative (aria-hidden) icon left behind in the markup either.
    await expect(cta.locator("svg")).toHaveCount(0);
  });

  test("Βρείτε μας is a single icon-only row with a stable accessible name and correct href per platform, and is not duplicated lower in the footer", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const footer = page.locator("footer");
    const expected: { name: string; href: RegExp }[] = [
      { name: "Facebook", href: /facebook\.com/ },
      { name: "Instagram", href: /instagram\.com/ },
      { name: "LinkedIn", href: /linkedin\.com/ },
      { name: "YouTube", href: /youtube\.com\/@KinsenHellas$/ },
    ];
    for (const { name, href } of expected) {
      // exact:true also guards against a leftover duplicate elsewhere in
      // the footer (getByRole would fail its "resolves to one element"
      // contract with a strict-mode violation if the label appeared twice).
      const link = footer.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noreferrer/);

      // Icon-only: no visible platform-name text node inside the link.
      const visibleText = (await link.textContent())?.trim();
      expect(visibleText).toBe("");

      await link.hover();
      // No scramble/animation left on socials — accessible name and href
      // must be completely static on hover, not just eventually-consistent.
      await expect(link).toHaveAccessibleName(name);
      await expect(link).toHaveAttribute("href", href);
    }
  });

  test("the partner row (Europcar/Goldcar/Saracakis) keeps its scramble hover effect, unaffected by the socials animation removal", async ({ page }) => {
    await page.goto("/");
    await dismissBanner(page);

    const link = page.locator("footer").getByRole("link", { name: "Europcar", exact: true });
    await expect(link.locator("span")).toHaveText("EUROPCAR");

    // Polling textContent() via round-trip Playwright calls races hover():
    // under load each round trip can take long enough that the whole
    // polling loop finishes before the mouseenter event even fires.
    // Polling in-page (waitForFunction) is fast enough to reliably observe
    // the mid-animation frame instead of missing it.
    const [sawScrambled] = await Promise.all([
      page
        .waitForFunction(
          () => {
            const el = document.querySelector<HTMLElement>('footer a[aria-label="Europcar"] span');
            return el?.textContent !== "EUROPCAR";
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
    await expect(link.locator("span")).toHaveText("EUROPCAR", { timeout: 2000 });
  });

  test("respects prefers-reduced-motion: hovering a partner link never scrambles the text", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await dismissBanner(page);

    const link = page.locator("footer").getByRole("link", { name: "Europcar", exact: true });
    await link.hover();
    await page.waitForTimeout(300);
    await expect(link.locator("span")).toHaveText("EUROPCAR");

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

  test("legal/copyright is the true final row — it appears after the Kinsen logo in document order, not before it", async ({ page }) => {
    // The lower Footer hierarchy is intentionally: partner links -> Kinsen
    // logo -> legal/copyright row. This used to be logo *last*; the legal
    // row moved below it so the corporate/legal baseline is the actual
    // final thing the page shows. Checking direct-child index order (via
    // stable identifiers — the logo's own asset filename, the copyright
    // text) rather than pixel position keeps this robust across every
    // breakpoint's own stacking/wrapping behavior.
    await page.goto("/");
    await dismissBanner(page);

    const order = await page.evaluate(() => {
      const footer = document.querySelector("footer");
      const children = Array.from(footer!.children);
      const logoIndex = children.findIndex((el) => el.querySelector('img[src*="kinsen_logowhite"]'));
      const legalIndex = children.findIndex((el) => el.textContent?.includes("Kinsen Hellas. All rights reserved."));
      return { logoIndex, legalIndex };
    });
    expect(order.logoIndex).toBeGreaterThanOrEqual(0);
    expect(order.legalIndex).toBeGreaterThanOrEqual(0);
    expect(order.legalIndex).toBeGreaterThan(order.logoIndex);
  });

  test.describe("landscape structural layout — CTA left, Πλοήγηση right, no unnecessary stacking", () => {
    // A landscape phone at e.g. 844×390 is wide enough for a real
    // two-column top area, but the old grid only switched to two columns
    // at the `lg` (1024px) *width* breakpoint — never checking orientation
    // or height — so it stayed on the single-column portrait layout despite
    // having plenty of horizontal room. These three are the task's mandatory
    // acceptance viewports for that fix.
    // Compares the two GRID COLUMNS themselves (the `<h2>`'s own parent
    // div vs. the `<nav aria-label="Πλοήγηση">`'s own parent div) rather
    // than two arbitrary sub-elements inside them. That distinction
    // matters: the CTA link sits near the *bottom* of the left column
    // (below the heading and paragraph) while the "Πλοήγηση" label sits
    // at the *top* of the right column, so comparing those two elements
    // directly would show them at different heights even in a correctly
    // side-by-side layout. The column wrappers themselves, being CSS grid
    // siblings in the same row, share the same top Y in landscape mode and
    // are offset vertically (no overlap) in the locked portrait mode.
    function topGridColumns(page: Page) {
      const footer = page.locator("footer");
      return {
        left: footer.locator("h2").locator("xpath=.."),
        right: footer.locator('nav[aria-label="Πλοήγηση"]').locator("xpath=.."),
      };
    }

    for (const [width, height] of [
      [844, 390],
      [915, 412],
      [956, 440],
    ] as const) {
      test(`${width}×${height}: CTA and Πλοήγηση occupy the same horizontal band, side by side`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const { left, right } = topGridColumns(page);
        const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
        expect(leftBox).not.toBeNull();
        expect(rightBox).not.toBeNull();

        // Side by side, not stacked: the two columns' vertical ranges
        // overlap substantially (grid siblings in the same row)...
        const verticalOverlap = Math.min(leftBox!.y + leftBox!.height, rightBox!.y + rightBox!.height) - Math.max(leftBox!.y, rightBox!.y);
        expect(verticalOverlap).toBeGreaterThan(Math.min(leftBox!.height, rightBox!.height) * 0.5);
        // ...and the right column starts to the right of the left column's
        // own right edge, not underneath it.
        expect(rightBox!.x).toBeGreaterThanOrEqual(leftBox!.x + leftBox!.width);
      });
    }

    test("portrait 375×667: stacked behavior is unchanged (locked) — Πλοήγηση sits below the CTA column, not beside it", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await dismissBanner(page);

      const { left, right } = topGridColumns(page);
      const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
      expect(leftBox).not.toBeNull();
      expect(rightBox).not.toBeNull();

      // Stacked: the right column starts clearly below the bottom of the
      // left column, and their vertical ranges do not overlap.
      expect(rightBox!.y).toBeGreaterThanOrEqual(leftBox!.y + leftBox!.height);
    });

    test("tablet landscape 1024×768: horizontal structure remains correct", async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto("/");
      await dismissBanner(page);

      const { left, right } = topGridColumns(page);
      const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
      expect(leftBox).not.toBeNull();
      expect(rightBox).not.toBeNull();

      const verticalOverlap = Math.min(leftBox!.y + leftBox!.height, rightBox!.y + rightBox!.height) - Math.max(leftBox!.y, rightBox!.y);
      expect(verticalOverlap).toBeGreaterThan(Math.min(leftBox!.height, rightBox!.height) * 0.5);
      expect(rightBox!.x).toBeGreaterThanOrEqual(leftBox!.x + leftBox!.width);
    });

    test("568×320: the four Βρείτε μας icons stay fully inside the footer, none clipped by its own overflow-hidden", async ({ page }) => {
      // This is the specific bug this task found: at the narrowest
      // landscape-phone widths, the icon row didn't fit its equal third of
      // the 3-column grid and silently overflowed *within* the footer,
      // clipped by the footer's own `overflow-hidden` — invisible to a
      // page-level `scrollWidth` check (see the "no page-level horizontal
      // overflow" tests below) since it never reached the document edge.
      // `flex-wrap` fixed it; this asserts every icon's right edge stays
      // inside the footer's own right edge, not just that the page doesn't
      // scroll.
      await page.setViewportSize({ width: 568, height: 320 });
      await page.goto("/");
      await dismissBanner(page);

      const footer = page.locator("footer");
      const footerBox = await footer.boundingBox();
      expect(footerBox).not.toBeNull();

      for (const name of ["Facebook", "Instagram", "LinkedIn", "YouTube"]) {
        const box = await footer.getByRole("link", { name, exact: true }).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x + box!.width).toBeLessThanOrEqual(footerBox!.x + footerBox!.width + 1);
      }
    });

    test("short-landscape phones force the supporting paragraph into its balanced 3-line shape; tablet/desktop widths get their own balanced 2-line break instead; narrow portrait keeps natural wrapping", async ({
      page,
    }) => {
      // Structural check (are the three `<br>` toggles in the state the
      // CSS rules intend?) rather than a brittle pixel/line-count
      // assertion. There are now three `<br>`s in DOM order: [outer
      // short-landscape-only, middle sm:+/tablet-desktop-only, outer
      // short-landscape-only] — two independent, non-overlapping
      // mechanisms (see the paragraph's own comment in footer.tsx):
      // - outer two: self-bounded
      //   `[@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:block`,
      //   producing the balanced 3-line shape only on genuinely short
      //   landscape phones.
      // - middle one: `sm:block` (tablet-portrait/tablet-landscape/desktop,
      //   wherever this paragraph reaches its `max-w-lg` cap) with an
      //   explicit `...:hidden` override for the short-landscape-phone
      //   tier, so the two mechanisms can never both fire at once.
      const paragraphBreaks = () =>
        page
          .locator("footer p")
          .filter({ hasText: "Επιλέξτε όχημα" })
          .locator("br")
          .evaluateAll((els) => els.map((el) => getComputedStyle(el).display));

      // 844×390: a mandatory short-landscape-phone acceptance viewport —
      // the two OUTER forced breaks are active (3-line shape), the middle
      // one is explicitly suppressed so it can't add a conflicting 4th
      // break.
      await page.setViewportSize({ width: 844, height: 390 });
      await page.goto("/");
      await dismissBanner(page);
      expect(await paragraphBreaks()).toEqual(["block", "none", "block"]);

      // 1024×768 (tablet landscape) and 1440×900 (desktop): the MIDDLE
      // break is active (balanced 2-line shape), the two outer
      // short-landscape-only breaks stay off.
      for (const [width, height] of [
        [1024, 768],
        [1440, 900],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.reload();
        await dismissBanner(page);
        expect(await paragraphBreaks()).toEqual(["none", "block", "none"]);
      }

      // 390×844 (the short-landscape-phone viewport rotated to portrait,
      // and also below the middle break's own `sm:` 640px floor): no
      // break is forced at all — this is the locked, unforced
      // natural-wrap behavior.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await dismissBanner(page);
      expect(await paragraphBreaks()).toEqual(["none", "none", "none"]);
    });

    test("the ΕΠΙΚΟΙΝΩΝΙΑ address gets a balanced forced break wherever its column is narrow (landscape/tablet-landscape/desktop), and stays on one natural line wherever it already fits (portrait, tablet-portrait)", async ({
      page,
    }) => {
      // Structural check on the single `<br>` inside the address link —
      // mirrors the CTA paragraph's own break-toggle tests above. Gated to
      // the same `[@media(orientation:landscape)]:block lg:block`
      // condition ZONE_GRID_COLS itself uses, so it only fires exactly
      // where ΕΠΙΚΟΙΝΩΝΙΑ's column narrows to ~277px.
      const addressBreakDisplay = () =>
        page
          .locator('footer a[href*="google.com/maps"] br')
          .evaluate((el) => getComputedStyle(el).display);

      // 844×390 (short-landscape phone) and 1440×900 (desktop): the
      // column is narrow, so the break is active.
      for (const [width, height] of [
        [844, 390],
        [1440, 900],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);
        expect(await addressBreakDisplay()).toBe("block");
      }

      // 768×1024 (tablet portrait) and 375×667 (small portrait): the
      // stacked full-width column already fits the whole address on one
      // line, so the break stays inert.
      for (const [width, height] of [
        [768, 1024],
        [375, 667],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.reload();
        await dismissBanner(page);
        expect(await addressBreakDisplay()).toBe("none");
      }
    });
  });

  test.describe("centered corporate rail — one real three-zone grid across all five rows", () => {
    // Measures the actual VISIBLE CONTENT wrapper for each block, not the
    // abstract CSS Grid cell — a grid cell is centered/positioned by
    // definition of the column track, so asserting against it proves
    // nothing about whether the content a person actually sees is
    // centered (this is exactly the trap that hid a real bug: Επικοινωνία's
    // grid cell was always correctly centered, while the visible address/
    // email/phone text inside it sat flush against the cell's left edge).
    // For block-level text (`<p>`/`<ul>` list items, which stretch to fill
    // their grid cell by default) this uses a DOM Range over the element's
    // contents — `Range.getBoundingClientRect()` returns the actual glyph
    // bounds regardless of the container's block width. For elements that
    // are already content-sized (anchors, the `<img>`), a plain bounding
    // box is equivalent and simpler.
    function measureFooterContentCenters(page: Page) {
      return page.evaluate(() => {
        const footer = document.querySelector("footer")!;
        const byText = (tag: string, text: string) =>
          Array.from(footer.querySelectorAll(tag)).find((el) => el.textContent?.trim() === text) as HTMLElement;
        const textRect = (el: Element) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return { x: r.x, right: r.x + r.width, width: r.width };
        };
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, right: r.x + r.width, width: r.width };
        };
        const union = (rects: { x: number; right: number }[]) => {
          const x = Math.min(...rects.map((r) => r.x));
          const right = Math.max(...rects.map((r) => r.right));
          return { x, right, width: right - x, centerX: (x + right) / 2 };
        };

        const h2 = footer.querySelector("h2")!;
        const ctaP = h2.nextElementSibling as HTMLElement;
        const ctaCell = h2.parentElement!;
        const ploigisiNav = footer.querySelector('nav[aria-label="Πλοήγηση"]')!;
        const ploigisiCell = ploigisiNav.parentElement!;

        const etaireiaP = byText("p", "Εταιρεία");
        const etaireiaCol = etaireiaP.parentElement!;
        const etaireia = union([textRect(etaireiaP), ...Array.from(etaireiaCol.querySelectorAll("a")).map(textRect)]);

        const epikoinoniaP = byText("p", "Επικοινωνία");
        const epikoinoniaCol = epikoinoniaP.parentElement!;
        const epikoinoniaContactLinks = Array.from(epikoinoniaCol.querySelectorAll("a")).map(textRect);
        const epikoinonia = union([textRect(epikoinoniaP), ...epikoinoniaContactLinks]);
        // The label alone and the contact content (address/email/phone)
        // alone, kept separate from the combined union above — landscape/
        // desktop verifies the label's own visible start lines up with
        // where the contact content itself starts, not just their shared
        // bounding box.
        const epikoinoniaLabelX = textRect(epikoinoniaP).x;
        const epikoinoniaContactX = union(epikoinoniaContactLinks).x;

        const vreiteMasP = byText("p", "Βρείτε μας");
        const vreiteMasCol = vreiteMasP.parentElement!;
        const vreiteMas = union([textRect(vreiteMasP), ...Array.from(vreiteMasCol.querySelectorAll("a")).map(rect)]);

        const goldcar = footer.querySelector('a[aria-label="Goldcar"]')!;
        const europcar = footer.querySelector('a[aria-label="Europcar"]')!;
        const saracakis = footer.querySelector('a[aria-label="Saracakis Leasing"]')!;
        const partnerGroup = union([rect(goldcar), rect(europcar), rect(saracakis)]);

        const logo = footer.querySelector("img")!;

        const copyrightP = Array.from(footer.querySelectorAll("p")).find((p) => p.textContent?.includes("Kinsen Hellas"))!;
        const legalUl = Array.from(footer.querySelectorAll("ul")).find((ul) =>
          ul.textContent?.includes("Πολιτική Προστασίας Δεδομένων"),
        )!;
        const legalGroup = union(Array.from(legalUl.querySelectorAll("li")).map(rect));

        return {
          viewportCenterX: window.innerWidth / 2,
          ctaHeadingX: rect(h2).x,
          ctaParagraphX: rect(ctaP).x,
          ploigisiNavX: rect(ploigisiNav).x,
          ctaHeadingCenterX: rect(h2).x + rect(h2).width / 2,
          ctaParagraphCenterX: rect(ctaP).x + rect(ctaP).width / 2,
          ploigisiNavCenterX: rect(ploigisiNav).x + rect(ploigisiNav).width / 2,
          // The three ROW 2 grid CELLS (not their text content) — the
          // zone/wrapper geometry itself, used to verify structural
          // LEFT↔CENTER↔RIGHT symmetry the way the architecture defines
          // it, not by chasing where each row's own text happens to end.
          etaireiaCell: rect(etaireiaCol),
          epikoinoniaCell: rect(epikoinoniaCol),
          vreiteMasCell: rect(vreiteMasCol),
          ctaCell: rect(ctaCell),
          ploigisiCell: rect(ploigisiCell),
          etaireia,
          epikoinonia,
          epikoinoniaLabelX,
          epikoinoniaContactX,
          vreiteMas,
          goldcar: rect(goldcar),
          europcar: rect(europcar),
          saracakis: rect(saracakis),
          partnerGroup,
          logo: rect(logo),
          copyrightText: textRect(copyrightP),
          legalGroup,
        };
      });
    }

    // A 2px tolerance absorbs sub-pixel grid-track/font rounding without
    // being loose enough to hide a real misalignment.
    const AXIS_TOLERANCE = 2;

    // Architecture note: an earlier pass tried to equalize the VISIBLE
    // TEXT gap on each side (ΕΤΑΙΡΕΙΑ↔ΕΠΙΚΟΙΝΩΝΙΑ vs. ΕΠΙΚΟΙΝΩΝΙΑ↔ΒΡΕΙΤΕ
    // ΜΑΣ) by giving ΕΤΑΙΡΕΙΑ/Goldcar `justify-self-end` while leaving
    // ΒΡΕΙΤΕ ΜΑΣ/Saracakis at the grid default — two different alignment
    // rules for the two outer zones, chasing glyph bounding boxes instead
    // of the grid. That was reverted (see LEFT_ZONE_OPEN's comment in
    // footer.tsx). The real, restored invariant is STRUCTURAL: LEFT,
    // CENTER and RIGHT are three equal-width grid tracks, so their own
    // CELL centers are symmetric by construction, and LEFT/RIGHT share
    // ONE mirrored alignment rule (LEFT_ZONE_OPEN/RIGHT_ZONE_OPEN) rather
    // than each picking whatever makes its own text line up.
    for (const [width, height, label] of [
      [1280, 800, "desktop"],
      [1440, 900, "desktop"],
      [1920, 1000, "wide desktop"],
      [844, 390, "short-landscape phone"],
    ] as const) {
      test(`${label} ${width}×${height}: ROW 2's LEFT/CENTER/RIGHT zone cells are structurally symmetric around CENTER, Επικοινωνία's wrapper still centers on Kinsen while its label/Europcar share the contact-content axis, and ΕΤΑΙΡΕΙΑ/Goldcar + Βρείτε μας/Saracakis + Πλοήγηση share one mirrored LEFT/RIGHT alignment rule`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const m = await measureFooterContentCenters(page);

        // CENTER zone — the wrapper itself (which sets the zone's
        // structural position) still centers exactly on the same axis as
        // the Kinsen logo, unchanged by the label/Europcar micro-polish
        // below. Επικοινωνία's cell is valid to measure directly because
        // it carries `justify-self-center`, making it content-sized
        // rather than stretched full-column.
        const centerAxis = m.logo.x + m.logo.width / 2;
        const epikoinoniaCenterX = m.epikoinoniaCell.x + m.epikoinoniaCell.width / 2;
        expect(Math.abs(epikoinoniaCenterX - centerAxis)).toBeLessThanOrEqual(AXIS_TOLERANCE);

        // Within that wrapper, Επικοινωνία's label is left-aligned (no
        // `text-center` override), so its own visible start lines up with
        // where the contact content (address/email/phone) below it
        // starts — both are left-aligned siblings of the same wrapper.
        expect(Math.abs(m.epikoinoniaLabelX - m.epikoinoniaContactX)).toBeLessThanOrEqual(AXIS_TOLERANCE);

        // Europcar carries one small additional leftward nudge
        // (EUROPCAR_CONTACT_ALIGN) on top of its own CENTER_ZONE_LOCK
        // centering, landing it on that same label/contact-content axis
        // rather than on Kinsen's true center.
        expect(Math.abs(m.europcar.x - m.epikoinoniaLabelX)).toBeLessThanOrEqual(AXIS_TOLERANCE);

        // Structural zone symmetry — the actual architectural invariant:
        // the distance from the LEFT zone cell's center to the CENTER
        // zone cell's center must (approximately) equal the distance from
        // the CENTER zone cell's center to the RIGHT zone cell's center.
        // This is measured from the grid's own zone/wrapper geometry, not
        // from where any row's text happens to end — the correction from
        // the previous, rejected micro-pass.
        const leftZoneCenterX = m.etaireiaCell.x + m.etaireiaCell.width / 2;
        const rightZoneCenterX = m.vreiteMasCell.x + m.vreiteMasCell.width / 2;
        const leftToCenter = epikoinoniaCenterX - leftZoneCenterX;
        const centerToRight = rightZoneCenterX - epikoinoniaCenterX;
        expect(Math.abs(leftToCenter - centerToRight)).toBeLessThanOrEqual(AXIS_TOLERANCE);

        // ΕΤΑΙΡΕΙΑ and Goldcar share ROW 2/3's mirrored LEFT-zone rule —
        // both carry the identical `LEFT_ZONE_OPEN` outward nudge from
        // the same column 1 start, so they move together.
        expect(Math.abs(m.etaireiaCell.x - m.goldcar.x)).toBeLessThanOrEqual(AXIS_TOLERANCE);

        // Βρείτε μας and Saracakis share ROW 2/3's mirrored RIGHT-zone
        // rule, and — because ROW 1's Πλοήγηση also still uses the same
        // shared RIGHT_ZONE_OPEN constant — all three now sit on one
        // common RIGHT axis again (the relationship the previous,
        // rejected pass had deliberately broken for ROW 2/3).
        expect(Math.abs(m.vreiteMasCell.x - m.saracakis.x)).toBeLessThanOrEqual(AXIS_TOLERANCE);
        expect(Math.abs(m.vreiteMasCell.x - m.ploigisiCell.x)).toBeLessThanOrEqual(AXIS_TOLERANCE);

        // CTA and ΕΤΑΙΡΕΙΑ/Goldcar likewise share the common LEFT axis.
        expect(Math.abs(m.ctaCell.x - m.etaireiaCell.x)).toBeLessThanOrEqual(AXIS_TOLERANCE);

        // The three zones remain genuinely distinct.
        expect(epikoinoniaCenterX).toBeGreaterThan(leftZoneCenterX + 50);
        expect(rightZoneCenterX).toBeGreaterThan(epikoinoniaCenterX + 50);
      });
    }

    test("desktop 1440×900: the corporate rail is centered on the page with meaningfully large, roughly balanced outer gutters, and stays narrower than the viewport", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await dismissBanner(page);

      const footer = page.locator("footer");
      const cta = footer.locator("h2").locator("xpath=..");
      const railBox = await cta.locator("xpath=..").boundingBox();
      expect(railBox).not.toBeNull();

      const leftGutter = railBox!.x;
      const rightGutter = 1440 - (railBox!.x + railBox!.width);

      // The rail must be meaningfully narrower than the viewport — this is
      // the core "outer gutters, not content spread edge to edge" claim.
      expect(railBox!.width).toBeLessThan(1440 * 0.75);
      // Both outer gutters exist and are roughly balanced (the rail is
      // `mx-auto`-centered), not lopsided to one side.
      expect(leftGutter).toBeGreaterThan(100);
      expect(Math.abs(leftGutter - rightGutter)).toBeLessThanOrEqual(2);
    });

    test("wide desktop 1920×1000 vs 1440×900: the rail width does not keep growing with the viewport, and the CENTER axis stays put — extra space becomes outer gutter instead", async ({
      page,
    }) => {
      const footer = page.locator("footer");
      const railLocator = footer.locator("h2").locator("xpath=../..");

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await dismissBanner(page);
      const narrowRailBox = await railLocator.boundingBox();
      const narrowM = await measureFooterContentCenters(page);
      expect(narrowRailBox).not.toBeNull();

      await page.setViewportSize({ width: 1920, height: 1000 });
      await page.reload();
      await dismissBanner(page);
      const wideRailBox = await railLocator.boundingBox();
      const wideM = await measureFooterContentCenters(page);
      expect(wideRailBox).not.toBeNull();

      // Same rail width at both viewports — the extra 480px of viewport
      // width became outer gutter, not extra column spread.
      expect(Math.abs(wideRailBox!.width - narrowRailBox!.width)).toBeLessThanOrEqual(2);
      // The wider viewport's outer gutter is correspondingly larger.
      expect(wideRailBox!.x).toBeGreaterThan(narrowRailBox!.x + 100);
      // Both viewports' CENTER axis (logo center) sits at their own true
      // viewport center — the rail recenters itself, the axis doesn't
      // drift with viewport width.
      const narrowLogoCenter = narrowM.logo.x + narrowM.logo.width / 2;
      const wideLogoCenter = wideM.logo.x + wideM.logo.width / 2;
      expect(Math.abs(narrowLogoCenter - narrowM.viewportCenterX)).toBeLessThanOrEqual(AXIS_TOLERANCE);
      expect(Math.abs(wideLogoCenter - wideM.viewportCenterX)).toBeLessThanOrEqual(AXIS_TOLERANCE);
    });

    test("portrait 375×667: ROW 1's CTA/Πλοήγηση and ROW 5's copyright/legal both fall back to stacked, not side by side", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await dismissBanner(page);

      const footer = page.locator("footer");
      const cta = footer.locator("h2").locator("xpath=..");
      const ploigisi = footer.locator('nav[aria-label="Πλοήγηση"]').locator("xpath=..");
      const copyright = footer.locator("p", { hasText: "Kinsen Hellas" });
      const legalUl = footer.locator("ul").filter({ hasText: "Πολιτική Προστασίας Δεδομένων" });

      const [ctaBox, ploigisiBox, copyrightBox, legalUlBox] = await Promise.all([
        cta.boundingBox(),
        ploigisi.boundingBox(),
        copyright.boundingBox(),
        legalUl.boundingBox(),
      ]);
      expect(ctaBox).not.toBeNull();
      expect(ploigisiBox).not.toBeNull();
      expect(copyrightBox).not.toBeNull();
      expect(legalUlBox).not.toBeNull();

      expect(ploigisiBox!.y).toBeGreaterThanOrEqual(ctaBox!.y + ctaBox!.height);
      expect(legalUlBox!.y).toBeGreaterThanOrEqual(copyrightBox!.y + copyrightBox!.height);
    });

    // Protects the "one common mobile center axis" requirement across the
    // full portrait test matrix: every intentionally-centered stacked
    // block — Εταιρεία, Επικοινωνία, Βρείτε μας, the social icon group,
    // the partner-link group, the Kinsen logo and the stacked legal
    // group — must share the SAME center X as the viewport itself, at
    // every portrait width, not just one. Measures actual content
    // wrappers (via the same Range/union technique as desktop), never a
    // full-width parent container. This entire matrix (320-820px) also
    // sits inside the <=820px centered-portrait tier, so the CTA/Πλοήγηση
    // top area is asserted centered here too, not left-anchored.
    for (const [width, height] of [
      [320, 568],
      [360, 640],
      [375, 667],
      [390, 844],
      [393, 852],
      [414, 896],
      [430, 932],
      [440, 956],
      [768, 1024],
      [820, 1180],
    ] as const) {
      test(`portrait ${width}×${height}: Εταιρεία, Επικοινωνία, Βρείτε μας, social icons, partners, Kinsen and legal all share one mobile center axis`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const m = await measureFooterContentCenters(page);
        for (const [name, block] of [
          ["Εταιρεία", m.etaireia],
          ["Επικοινωνία", m.epikoinonia],
          ["Βρείτε μας", m.vreiteMas],
          ["partner group", m.partnerGroup],
          ["legal group", m.legalGroup],
        ] as const) {
          expect(Math.abs(block.centerX - m.viewportCenterX), `${name} center`).toBeLessThanOrEqual(AXIS_TOLERANCE);
        }
        const logoCenterX = m.logo.x + m.logo.width / 2;
        expect(Math.abs(logoCenterX - m.viewportCenterX), "Kinsen logo center").toBeLessThanOrEqual(AXIS_TOLERANCE);

        // Every width tested here is inside the <=820px centered-portrait
        // tier (PORTRAIT_CENTERED_TOP_AREA in footer.tsx), so the top text
        // content (CTA heading/paragraph, Πλοήγηση nav) now joins the same
        // centered composition as everything else, instead of keeping its
        // own separate left reading axis — that older, left-anchored
        // behavior only survives above 820px, covered separately below.
        expect(Math.abs(m.ctaHeadingCenterX - m.viewportCenterX), "CTA heading center").toBeLessThanOrEqual(
          AXIS_TOLERANCE,
        );
        expect(Math.abs(m.ctaParagraphCenterX - m.viewportCenterX), "CTA paragraph center").toBeLessThanOrEqual(
          AXIS_TOLERANCE,
        );
        expect(Math.abs(m.ploigisiNavCenterX - m.viewportCenterX), "Πλοήγηση nav center").toBeLessThanOrEqual(
          AXIS_TOLERANCE,
        );
      });
    }
  });

  // Protects the portrait vertical-rhythm rewrite: every row-level
  // container gained a bounded `[@media(orientation:portrait)_and_
  // (max-width:1023px)]:` override (PORTRAIT_SECTION_PT/PB,
  // PORTRAIT_MAJOR_PT/PB, PORTRAIT_SECTION_GAP in footer.tsx) replacing
  // what had been independently-tuned desktop-band padding leaking into
  // the single-column stack. Relationships only, never exact Y
  // coordinates — a real content change (e.g. a longer address) will
  // shift every Y value, but should never reorder sections, create an
  // overlap, or blow the gap ceiling.
  test.describe("portrait vertical rhythm — one coherent stacked flow, no leftover desktop-band spacing", () => {
    function measurePortraitFlow(page: Page) {
      return page.evaluate(() => {
        const footer = document.querySelector("footer")!;
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left };
        };
        const byText = (tag: string, text: string) =>
          Array.from(footer.querySelectorAll(tag)).find((el) => el.textContent?.trim() === text) as HTMLElement;

        const ctaLink = Array.from(footer.querySelectorAll("a")).find(
          (a) => a.textContent?.trim() === "Δείτε τα οχήματα",
        ) as HTMLElement;
        const ploigisiHeading = byText("p", "Πλοήγηση");
        const lastNavItem = byText("a", "Σύγκριση οχημάτων");
        const etaireiaHeading = byText("p", "Εταιρεία");
        const lastEtaireiaItem = byText("a", "Η Kinsen");
        const epikoinoniaHeading = byText("p", "Επικοινωνία");
        const phoneLink = footer.querySelector('a[href^="tel:"]') as HTMLElement;
        const vreiteMasHeading = byText("p", "Βρείτε μας");
        const socialIcons = Array.from(
          footer.querySelectorAll(
            'a[aria-label="Facebook"], a[aria-label="Instagram"], a[aria-label="LinkedIn"], a[aria-label="YouTube"]',
          ),
        );
        const goldcar = footer.querySelector('a[aria-label="Goldcar"]')!;
        const saracakis = footer.querySelector('a[aria-label="Saracakis Leasing"]')!;
        const logo = footer.querySelector("img")!;
        const copyright = Array.from(footer.querySelectorAll("p")).find((p) =>
          p.textContent?.includes("Kinsen Hellas"),
        ) as HTMLElement;

        const partnerTop = Math.min(rect(goldcar).top, rect(saracakis).top);
        const partnerBottom = Math.max(rect(goldcar).bottom, rect(saracakis).bottom);
        const socialTop = Math.min(...socialIcons.map((a) => rect(a).top));
        const socialBottom = Math.max(...socialIcons.map((a) => rect(a).bottom));

        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          sections: {
            ctaLink: rect(ctaLink),
            ploigisiHeading: rect(ploigisiHeading),
            lastNavItem: rect(lastNavItem),
            etaireiaHeading: rect(etaireiaHeading),
            lastEtaireiaItem: rect(lastEtaireiaItem),
            epikoinoniaHeading: rect(epikoinoniaHeading),
            phoneLink: rect(phoneLink),
            vreiteMasHeading: rect(vreiteMasHeading),
            socials: { top: socialTop, bottom: socialBottom },
            partners: { top: partnerTop, bottom: partnerBottom },
            logo: rect(logo),
            copyright: rect(copyright),
          },
        };
      });
    }

    // The portrait rhythm targets 32px (SECTION) / 48px (MAJOR) gaps —
    // this ceiling is deliberately generous (comfortably above both) so
    // the test catches a real regression (leftover desktop padding, a
    // reintroduced large margin) without being a pixel-exact tripwire on
    // every content-length change.
    const MAX_SENSIBLE_GAP = 90;

    for (const [width, height] of [
      [320, 568],
      [375, 667],
      [412, 915],
      [430, 932],
      [440, 956],
      [768, 1024],
      [820, 1180],
    ] as const) {
      test(`portrait ${width}×${height}: sections flow top-to-bottom in order, never overlap, and no gap exceeds a sensible ceiling`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const { overflow, sections: s } = await measurePortraitFlow(page);

        expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(0);

        // Vertical order + no-overlap, expressed as one ordered chain: each
        // step's top must be at or after the previous step's bottom.
        const chain: [string, { top: number; bottom: number }][] = [
          ["CTA link", s.ctaLink],
          ["Πλοήγηση heading", s.ploigisiHeading],
          ["last nav item", s.lastNavItem],
          ["Εταιρεία heading", s.etaireiaHeading],
          ["last Εταιρεία item", s.lastEtaireiaItem],
          ["Επικοινωνία heading", s.epikoinoniaHeading],
          ["phone link", s.phoneLink],
          ["Βρείτε μας heading", s.vreiteMasHeading],
          ["social icons", s.socials],
          ["partner group", s.partners],
          ["Kinsen logo", s.logo],
          ["legal/copyright", s.copyright],
        ];
        for (let i = 1; i < chain.length; i++) {
          const [prevName, prev] = chain[i - 1]!;
          const [name, cur] = chain[i]!;
          expect(cur.top, `${name} starts at/after ${prevName} ends`).toBeGreaterThanOrEqual(prev.bottom);
        }

        // Section-to-section gaps (the actual whitespace between one
        // Footer section ending and the next beginning) stay under the
        // sensible ceiling — this is what would catch a reintroduced
        // desktop-band `pt-*`/`pb-*` leaking back into the portrait stack.
        const gaps: [string, number][] = [
          ["CTA link → Πλοήγηση heading", s.ploigisiHeading.top - s.ctaLink.bottom],
          ["last nav item → Εταιρεία heading", s.etaireiaHeading.top - s.lastNavItem.bottom],
          ["last Εταιρεία item → Επικοινωνία heading", s.epikoinoniaHeading.top - s.lastEtaireiaItem.bottom],
          ["phone link → Βρείτε μας heading", s.vreiteMasHeading.top - s.phoneLink.bottom],
          ["social icons → partner group", s.partners.top - s.socials.bottom],
          ["partner group → Kinsen logo", s.logo.top - s.partners.bottom],
          ["Kinsen logo → legal/copyright", s.copyright.top - s.logo.bottom],
        ];
        for (const [name, gap] of gaps) {
          expect(gap, `${name} gap`).toBeGreaterThan(0);
          expect(gap, `${name} gap ceiling`).toBeLessThanOrEqual(MAX_SENSIBLE_GAP);
        }
      });
    }
  });

  // Protects the two-tier portrait alignment split (PORTRAIT_CENTERED_TOP_AREA
  // in footer.tsx): ROW 2/3/4/5 (Εταιρεία/Επικοινωνία/Βρείτε μας, partners,
  // Kinsen, legal) were already unconditionally centered at every portrait
  // width — only ROW 1 (CTA/Πλοήγηση) lacked a text-align rule, so it read
  // left-aligned while everything below it was centered. This tier centers
  // ROW 1 too, but only up to 820px width in portrait (an iPad Air's own
  // portrait width) — wider portrait tablets (821-1023px) keep the
  // pre-existing plain-left default, and landscape/desktop are untouched at
  // every width, including 1024px+ where `lg:` already governs regardless
  // of orientation.
  test.describe("portrait top-area alignment — centered up to 820px, left above it, untouched outside portrait", () => {
    const AXIS_TOLERANCE = 2;

    function measureTopAreaAlign(page: Page) {
      return page.evaluate(() => {
        const footer = document.querySelector("footer")!;
        const h2 = footer.querySelector("h2")!;
        const ctaContainer = h2.parentElement!;
        const ploigisiHeading = Array.from(footer.querySelectorAll("p")).find(
          (p) => p.textContent?.trim() === "Πλοήγηση",
        ) as HTMLElement;
        const ctaRect = h2.getBoundingClientRect();
        return {
          ctaTextAlign: getComputedStyle(ctaContainer).textAlign,
          ploigisiTextAlign: getComputedStyle(ploigisiHeading.parentElement!).textAlign,
          ctaCenterX: ctaRect.x + ctaRect.width / 2,
          viewportCenterX: window.innerWidth / 2,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
    }

    for (const [width, height] of [
      [375, 667],
      [412, 915],
      [430, 932],
      [440, 956],
      [768, 1024],
      [820, 1180],
    ] as const) {
      test(`portrait ${width}×${height} (<=820px): CTA and Πλοήγηση are centered, joining the rest of the already-centered portrait composition`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const m = await measureTopAreaAlign(page);
        expect(m.overflow, "no horizontal overflow").toBeLessThanOrEqual(0);
        expect(m.ctaTextAlign).toBe("center");
        expect(m.ploigisiTextAlign).toBe("center");
        // The CTA heading itself visibly centers on the viewport (not just
        // a CSS property present with no visible effect).
        expect(Math.abs(m.ctaCenterX - m.viewportCenterX)).toBeLessThanOrEqual(AXIS_TOLERANCE);
      });
    }

    for (const [width, height] of [
      [821, 1180],
      [900, 1180],
      [1023, 1300],
    ] as const) {
      test(`portrait ${width}×${height} (>820px): CTA and Πλοήγηση stay left-aligned — the pre-existing wider-portrait-tablet default, unchanged`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const m = await measureTopAreaAlign(page);
        expect(m.overflow, "no horizontal overflow").toBeLessThanOrEqual(0);
        expect(m.ctaTextAlign).toBe("start");
        expect(m.ploigisiTextAlign).toBe("start");
      });
    }

    for (const [width, height, label] of [
      [844, 390, "landscape phone"],
      [1024, 768, "landscape tablet"],
      [1280, 800, "desktop"],
    ] as const) {
      test(`${label} ${width}×${height}: CTA/Πλοήγηση stay left-aligned — the centered-portrait tier never fires outside portrait`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await dismissBanner(page);

        const m = await measureTopAreaAlign(page);
        expect(m.overflow, "no horizontal overflow").toBeLessThanOrEqual(0);
        expect(m.ctaTextAlign).toBe("start");
        expect(m.ploigisiTextAlign).toBe("start");
      });
    }
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
