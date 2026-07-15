import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT_DEFAULTS } from "@/lib/content-defaults";
import { withDefaults } from "@/server/services/content.service";

// Every content section that renders an image on the public site must ship
// a real default image path — the whole point of adding `image` fields to
// these sections is that admins can now change what was previously a
// hardcoded path, and that starts from the exact same path so nothing
// changes visually until they actually do.
const IMAGE_DEFAULTS: { key: keyof typeof CONTENT_DEFAULTS; expected: string }[] = [
  { key: "home.hero", expected: "/images/banner.png" },
  { key: "financing.hero", expected: "/images/keys.jpg" },
  { key: "warranty.hero", expected: "/images/egguhsh.jpg" },
  { key: "contact.hero", expected: "/images/communication.jpg" },
  { key: "faq.hero", expected: "/images/faq.png" },
];

for (const { key, expected } of IMAGE_DEFAULTS) {
  test(`CONTENT_DEFAULTS["${key}"].image matches the previously-hardcoded path`, () => {
    const content = CONTENT_DEFAULTS[key] as { image: string };
    assert.equal(content.image, expected);
  });
}

test('CONTENT_DEFAULTS["home.benefits"] ships all 3 cards\' previously-hardcoded images, in order', () => {
  const { cards } = CONTENT_DEFAULTS["home.benefits"];
  assert.deepEqual(
    cards.map((c) => c.image),
    ["/images/kinsencar.png", "/images/hondaphoto.jpg", "/images/couple.jpg"],
  );
});

// ---------- withDefaults (backward-compat merge for pre-`image` overrides) ----------

test("withDefaults: a null/non-object stored value falls back entirely to defaults", () => {
  assert.deepEqual(withDefaults("home.hero", null), CONTENT_DEFAULTS["home.hero"]);
  assert.deepEqual(withDefaults("home.hero", "not-an-object"), CONTENT_DEFAULTS["home.hero"]);
});

test("withDefaults: a fully-populated stored override is used as-is (admin's real edit is not silently overwritten)", () => {
  const stored = { line1: "Custom 1", line2: "Custom 2", image: "/uploads/content/home.hero/custom.jpg" };
  assert.deepEqual(withDefaults("home.hero", stored), stored);
});

test("withDefaults: a stored override saved before `image` existed falls back to the default image only, keeping the saved text", () => {
  const legacyStored = { line1: "Admin's custom line 1", line2: "Admin's custom line 2" };
  const merged = withDefaults("home.hero", legacyStored);
  assert.equal(merged.line1, "Admin's custom line 1");
  assert.equal(merged.line2, "Admin's custom line 2");
  assert.equal(merged.image, CONTENT_DEFAULTS["home.hero"].image);
});

test("withDefaults: same backward-compat behavior for an InfoHeroContent section (financing.hero)", () => {
  const legacyStored = { title: "Custom title", subtitle: "Custom subtitle" };
  const merged = withDefaults("financing.hero", legacyStored);
  assert.equal(merged.title, "Custom title");
  assert.equal(merged.image, CONTENT_DEFAULTS["financing.hero"].image);
});
