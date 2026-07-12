// Multilingual, locale-aware search/sort/group support for the /vehicles
// color filter. The database's `color` field is NOT normalized into a
// fixed set of canonical families at ingestion (see normalizeColor in
// vehicle-normalization.ts — it only trims whitespace and capitalizes the
// first letter), so production data may genuinely mix Greek, English,
// mixed casing, accented/unaccented Greek and manufacturer-specific paint
// names (e.g. "Black Metallic", "Λευκό", "Pearl White"). Everything below
// operates on whatever raw values getPublicFilterOptions() returns — no
// component-local hardcoded color list, no runtime translation service.

// Diacritic/case-insensitive, whitespace-normalized comparison key — the
// same pipeline already proven for manufacturer search (NFD-split accents
// into a base letter + combining mark, then strip the marks).
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Bilingual search metadata for well-known standard automotive color
// families ONLY — this is local option *discoverability*, never a query
// value substitution (buildPublicFilterWhere always filters on the raw
// selected `color` string as-is; see vehicle.service.ts). An unknown color
// not listed here still matches its own raw text via the direct-substring
// branch in colorMatchesSearch below, so it's never hidden for lack of an
// entry here.
interface ColorFamilyMetadata {
  canonicalFamily: string;
  labels: { el?: string; en?: string };
  searchTerms: string[];
}

const COLOR_FAMILIES: ColorFamilyMetadata[] = [
  { canonicalFamily: "black", labels: { el: "Μαύρο", en: "Black" }, searchTerms: ["black", "μαυρο"] },
  { canonicalFamily: "white", labels: { el: "Λευκό", en: "White" }, searchTerms: ["white", "λευκο", "ασπρο"] },
  { canonicalFamily: "silver", labels: { el: "Ασημί", en: "Silver" }, searchTerms: ["silver", "ασημι", "ασημενιο"] },
  { canonicalFamily: "grey", labels: { el: "Γκρι", en: "Grey" }, searchTerms: ["grey", "gray", "γκρι"] },
  { canonicalFamily: "red", labels: { el: "Κόκκινο", en: "Red" }, searchTerms: ["red", "κοκκινο"] },
  { canonicalFamily: "blue", labels: { el: "Μπλε", en: "Blue" }, searchTerms: ["blue", "μπλε"] },
  { canonicalFamily: "yellow", labels: { el: "Κίτρινο", en: "Yellow" }, searchTerms: ["yellow", "κιτρινο"] },
  { canonicalFamily: "green", labels: { el: "Πράσινο", en: "Green" }, searchTerms: ["green", "πρασινο"] },
  { canonicalFamily: "orange", labels: { el: "Πορτοκαλί", en: "Orange" }, searchTerms: ["orange", "πορτοκαλι"] },
  { canonicalFamily: "brown", labels: { el: "Καφέ", en: "Brown" }, searchTerms: ["brown", "καφε"] },
  { canonicalFamily: "beige", labels: { el: "Μπεζ", en: "Beige" }, searchTerms: ["beige", "μπεζ"] },
  { canonicalFamily: "gold", labels: { el: "Χρυσό", en: "Gold" }, searchTerms: ["gold", "χρυσο"] },
  { canonicalFamily: "purple", labels: { el: "Μωβ", en: "Purple" }, searchTerms: ["purple", "μωβ", "βιολετι"] },
  { canonicalFamily: "pink", labels: { el: "Ροζ", en: "Pink" }, searchTerms: ["pink", "ροζ"] },
];

function findColorFamily(normalizedValue: string): ColorFamilyMetadata | undefined {
  return COLOR_FAMILIES.find((family) => family.searchTerms.some((term) => normalizedValue.includes(term)));
}

// True if `rawColor` should be shown for the user's (already-normalized)
// search term. Two independent paths, either is sufficient:
//  1. Direct substring match against the raw value's own normalized text —
//     works for every color regardless of language, including unknown/new
//     database values with no family entry above.
//  2. Cross-language family match — e.g. raw "Black" (English) is found
//     for a Greek search "μαυρο" because both belong to the "black" family.
export function colorMatchesSearch(rawColor: string, normalizedTerm: string): boolean {
  if (!normalizedTerm) return true;
  const normalizedColor = normalizeForSearch(rawColor);
  if (normalizedColor.includes(normalizedTerm)) return true;
  const family = findColorFamily(normalizedColor);
  if (!family) return false;
  return family.searchTerms.some((term) => term.includes(normalizedTerm) || normalizedTerm.includes(term));
}

type ColorScript = "greek" | "latin" | "other";

function detectScript(char: string): ColorScript {
  if (/[\u0370-\u03ff\u1f00-\u1fff]/.test(char)) return "greek";
  if (/[A-Za-z]/.test(char)) return "latin";
  return "other";
}

// Dynamic grouping key — whatever letters are actually present in the
// (already-loaded) color list, never a hardcoded Greek or Latin alphabet.
// Values that don't start with a letter in either script fall under a
// single "#" bucket rather than being hidden or crashing.
export function colorGroupKey(value: string): { letter: string; script: ColorScript } {
  const first = value.trim().charAt(0);
  const script = detectScript(first);
  if (script === "other") return { letter: "#", script };
  return { letter: first.toLocaleUpperCase(script === "greek" ? "el-GR" : "en"), script };
}

const GREEK_COLLATOR = new Intl.Collator("el-GR", { sensitivity: "base", numeric: true });
const LATIN_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const SCRIPT_RANK: Record<ColorScript, number> = { greek: 0, latin: 1, other: 2 };

// Deterministic script-then-alphabetical ordering: every Greek-lettered
// group sorts before every Latin-lettered group, which sorts before the
// single "#" group — scripts are never interleaved. Within a script, the
// matching Intl.Collator instance orders the raw (unmutated) values.
export function compareColors(a: string, b: string): number {
  const scriptA = colorGroupKey(a).script;
  const scriptB = colorGroupKey(b).script;
  if (scriptA !== scriptB) return SCRIPT_RANK[scriptA] - SCRIPT_RANK[scriptB];
  if (scriptA === "greek") return GREEK_COLLATOR.compare(a, b);
  if (scriptA === "latin") return LATIN_COLLATOR.compare(a, b);
  return a.localeCompare(b);
}
