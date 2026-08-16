import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCompareFooterState,
  calculateFooterDocumentTop,
  calculateCompareFooterMaxExtraLift,
  calculateCompareFooterGap,
  COMPARE_FOOTER_MAX_EXTRA_LIFT_MIN,
  COMPARE_FOOTER_MAX_EXTRA_LIFT_CAP,
} from "@/lib/compare-footer-state";

const MAX_EXTRA = 100;

test("1. long page: baselineLift 0, currentRequiredLift 0 → normal", () => {
  const result = calculateCompareFooterState({ baselineLift: 0, currentRequiredLift: 0, maxExtraLift: MAX_EXTRA });
  assert.deepEqual(result, { state: "normal", baselineLift: 0, extraLift: 0, visualLift: 0 });
});

test("2. short page: baselineLift 500, currentRequiredLift 500 (extraLift 0) → visible, NOT hidden", () => {
  const result = calculateCompareFooterState({ baselineLift: 500, currentRequiredLift: 500, maxExtraLift: MAX_EXTRA });
  assert.notEqual(result.state, "hidden");
  assert.equal(result.extraLift, 0);
  assert.equal(result.visualLift, 500);
});

test("3. short page: baselineLift 500, currentRequiredLift 540, maxExtraLift 100 → avoiding, visualLift 540", () => {
  const result = calculateCompareFooterState({ baselineLift: 500, currentRequiredLift: 540, maxExtraLift: MAX_EXTRA });
  assert.deepEqual(result, { state: "avoiding", baselineLift: 500, extraLift: 40, visualLift: 540 });
});

test("4. short page: baselineLift 500, currentRequiredLift 601, maxExtraLift 100 → hidden", () => {
  const result = calculateCompareFooterState({ baselineLift: 500, currentRequiredLift: 601, maxExtraLift: MAX_EXTRA });
  assert.equal(result.state, "hidden");
  // frozen at baseline + maxExtraLift, never grows further
  assert.equal(result.visualLift, 600);
  assert.equal(result.extraLift, 100);
});

test("5. huge baseline (800), extraLift 0 → visible — proves baseline size alone never causes hide", () => {
  const result = calculateCompareFooterState({ baselineLift: 800, currentRequiredLift: 800, maxExtraLift: MAX_EXTRA });
  assert.notEqual(result.state, "hidden");
  assert.equal(result.extraLift, 0);
  assert.equal(result.visualLift, 800);

  // even a genuinely enormous baseline (well beyond anything realistic)
  const extreme = calculateCompareFooterState({ baselineLift: 5000, currentRequiredLift: 5000, maxExtraLift: MAX_EXTRA });
  assert.notEqual(extreme.state, "hidden");
  assert.equal(extreme.extraLift, 0);
});

test("6. long page: baseline 0, current 60, maxExtra 100 → avoiding", () => {
  const result = calculateCompareFooterState({ baselineLift: 0, currentRequiredLift: 60, maxExtraLift: MAX_EXTRA });
  assert.deepEqual(result, { state: "avoiding", baselineLift: 0, extraLift: 60, visualLift: 60 });
});

test("7. long page: baseline 0, current 101, maxExtra 100 → hidden", () => {
  const result = calculateCompareFooterState({ baselineLift: 0, currentRequiredLift: 101, maxExtraLift: MAX_EXTRA });
  assert.equal(result.state, "hidden");
  assert.equal(result.visualLift, 100);
});

test("8. scrolling upward reverses correctly: hidden → avoiding → normal as currentRequiredLift falls back toward/below baseline", () => {
  const deep = calculateCompareFooterState({ baselineLift: 0, currentRequiredLift: 400, maxExtraLift: MAX_EXTRA });
  assert.equal(deep.state, "hidden");

  const partial = calculateCompareFooterState({ baselineLift: 0, currentRequiredLift: 50, maxExtraLift: MAX_EXTRA });
  assert.equal(partial.state, "avoiding");

  const back = calculateCompareFooterState({ baselineLift: 0, currentRequiredLift: 0, maxExtraLift: MAX_EXTRA });
  assert.deepEqual(back, { state: "normal", baselineLift: 0, extraLift: 0, visualLift: 0 });
});

test("9. negative/no-collision inputs clamp to zero rather than going negative", () => {
  const result = calculateCompareFooterState({ baselineLift: -50, currentRequiredLift: -100, maxExtraLift: MAX_EXTRA });
  assert.deepEqual(result, { state: "normal", baselineLift: 0, extraLift: 0, visualLift: 0 });
});

test("10. baseline never contributes to extraLift — extraLift is exactly (current - baseline), clamped, never inflated by baseline's own magnitude", () => {
  const small = calculateCompareFooterState({ baselineLift: 10, currentRequiredLift: 50, maxExtraLift: MAX_EXTRA });
  const large = calculateCompareFooterState({ baselineLift: 900, currentRequiredLift: 940, maxExtraLift: MAX_EXTRA });
  // Same *delta* (40) above baseline in both cases should produce the exact same extraLift, regardless of how large the baseline itself is.
  assert.equal(small.extraLift, 40);
  assert.equal(large.extraLift, 40);
  assert.equal(small.state, large.state);
});

test("currentRequiredLift below baselineLift (Footer receded relative to baseline) still floors extraLift at 0, never negative", () => {
  const result = calculateCompareFooterState({ baselineLift: 300, currentRequiredLift: 100, maxExtraLift: MAX_EXTRA });
  assert.equal(result.extraLift, 0);
  assert.equal(result.visualLift, 300); // still shows the baseline lift, not 0 — baseline alone is real, unavoidable geometry
});

test("extraLift exactly at maxExtraLift is still avoiding, not yet hidden (boundary inclusive)", () => {
  const result = calculateCompareFooterState({ baselineLift: 200, currentRequiredLift: 300, maxExtraLift: MAX_EXTRA });
  assert.equal(result.state, "avoiding");
  assert.equal(result.extraLift, 100);
});

test("calculateFooterDocumentTop: cancels out the current scroll offset, recovering the page-top-relative position", () => {
  // A Footer whose top sits 3000px down the document; user has scrolled 2500px, so its viewport-relative top reads 500.
  assert.equal(calculateFooterDocumentTop(500, 2500), 3000);
  // At scrollY 0 (page top), the document-space value equals the raw viewport-relative reading.
  assert.equal(calculateFooterDocumentTop(706, 0), 706);
  // Independent of scroll position for the same real document layout — three different scroll positions, same underlying Footer document position, all recover the same value.
  const documentTop = 3000;
  for (const scrollY of [0, 800, 2500, 2999]) {
    const viewportTop = documentTop - scrollY;
    assert.equal(calculateFooterDocumentTop(viewportTop, scrollY), documentTop);
  }
});

test("calculateCompareFooterMaxExtraLift: never returns less than the configured minimum", () => {
  assert.equal(calculateCompareFooterMaxExtraLift(1), COMPARE_FOOTER_MAX_EXTRA_LIFT_MIN);
  assert.equal(calculateCompareFooterMaxExtraLift(100), COMPARE_FOOTER_MAX_EXTRA_LIFT_MIN);
});

test("calculateCompareFooterMaxExtraLift: never exceeds the configured cap, even for a very large viewport — this is a MODEST, mostly viewport-insensitive budget, unlike the old total-lift cap", () => {
  assert.equal(calculateCompareFooterMaxExtraLift(4000), COMPARE_FOOTER_MAX_EXTRA_LIFT_CAP);
  assert.ok(calculateCompareFooterMaxExtraLift(2560) <= COMPARE_FOOTER_MAX_EXTRA_LIFT_CAP);
});

test("calculateCompareFooterMaxExtraLift: stays within a modest bounded range for the entire realistic viewport height matrix", () => {
  for (const h of [568, 720, 768, 844, 900, 932, 1024, 1080, 1180, 1440]) {
    const lift = calculateCompareFooterMaxExtraLift(h);
    assert.ok(lift >= COMPARE_FOOTER_MAX_EXTRA_LIFT_MIN && lift <= COMPARE_FOOTER_MAX_EXTRA_LIFT_CAP, `unexpected maxExtraLift for height ${h}: ${lift}`);
  }
});

test("calculateCompareFooterGap: uses the mobile gap below the desktop breakpoint, and the desktop gap at/above it", () => {
  assert.equal(calculateCompareFooterGap(375), 16);
  assert.equal(calculateCompareFooterGap(639), 16);
  assert.equal(calculateCompareFooterGap(640), 20);
  assert.equal(calculateCompareFooterGap(1920), 20);
});
