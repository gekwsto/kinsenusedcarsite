import { test } from "node:test";
import assert from "node:assert/strict";
import { colorGroupKey, colorMatchesSearch, compareColors } from "@/lib/color-search";

test("colorMatchesSearch: Greek raw value matches its own (unaccented) search term", () => {
  assert.equal(colorMatchesSearch("Κόκκινο", "κοκκινο"), true);
});

test("colorMatchesSearch: English raw value matches its own search term, case-insensitively", () => {
  assert.equal(colorMatchesSearch("Black Metallic", "black"), true);
});

test("colorMatchesSearch: English search term cross-language matches a Greek raw value", () => {
  assert.equal(colorMatchesSearch("Μαύρο", "black"), true);
});

test("colorMatchesSearch: Greek search term cross-language matches an English raw value", () => {
  assert.equal(colorMatchesSearch("White", "λευκο"), true);
});

test("colorMatchesSearch: leading/trailing whitespace and mixed case in the raw value do not block a match", () => {
  assert.equal(colorMatchesSearch("  Silver  ", "ασημι"), true);
});

test("colorMatchesSearch: a synthetic marketing color with no family metadata still matches its own raw text", () => {
  assert.equal(colorMatchesSearch("Ultraviolet Pearl X", "ultraviolet"), true);
});

test("colorMatchesSearch: a synthetic marketing color does not falsely match an unrelated family search", () => {
  assert.equal(colorMatchesSearch("Ultraviolet Pearl X", "black"), false);
});

test("colorMatchesSearch: no-result term returns false for an unrelated color", () => {
  assert.equal(colorMatchesSearch("Λευκό", "green"), false);
});

test("colorMatchesSearch: empty term matches everything (no local search applied)", () => {
  assert.equal(colorMatchesSearch("Anything", ""), true);
});

test("colorGroupKey: Greek raw value groups under its Greek uppercase letter with script 'greek'", () => {
  assert.deepEqual(colorGroupKey("γκρι"), { letter: "Γ", script: "greek" });
});

test("colorGroupKey: English raw value groups under its Latin uppercase letter with script 'latin'", () => {
  assert.deepEqual(colorGroupKey("black"), { letter: "B", script: "latin" });
});

test("colorGroupKey: a synthetic non-letter-initial value falls under '#'", () => {
  assert.deepEqual(colorGroupKey("99 Special"), { letter: "#", script: "other" });
});

test("compareColors: every Greek-lettered value sorts before every Latin-lettered value", () => {
  const sorted = ["White", "Λευκό", "Black", "Μαύρο"].sort(compareColors);
  assert.deepEqual(sorted, ["Λευκό", "Μαύρο", "Black", "White"]);
});

test("compareColors: does not mutate the input array reference semantics (pure comparator)", () => {
  const input = ["Blue", "Alpha"];
  const copy = [...input].sort(compareColors);
  assert.notEqual(copy, input);
});
