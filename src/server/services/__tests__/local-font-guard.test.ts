import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression guard for the Marketing-supplied local Manrope font
 * migration (next/font/google → next/font/local). Prevents a future edit
 * from silently reintroducing a Google Fonts fetch, dropping the local
 * font file, or losing the shared `--font-sans` CSS variable that the
 * entire site's typography depends on (tailwind.config.ts `fontFamily.sans`).
 */

const ROOT = process.cwd();
const LAYOUT_PATH = "src/app/layout.tsx";
const FONT_DIR = "src/assets/fonts/manrope";
const FONT_FILE = "Manrope-VariableFont_wght.ttf";
const LICENSE_FILE = "OFL.txt";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("root layout uses next/font/local, not next/font/google", () => {
  const content = read(LAYOUT_PATH);
  assert.match(content, /from ["']next\/font\/local["']/);
  assert.ok(!/from ["']next\/font\/google["']/.test(content), "next/font/google must not be imported");
  assert.ok(!/\bManrope\s*\(/.test(content), "the old next/font/google Manrope(...) call must be gone");
});

test("root layout references the supplied local Manrope variable font file", () => {
  const content = read(LAYOUT_PATH);
  assert.match(content, new RegExp(FONT_FILE.replace(".", "\\.")));
});

test("the local Manrope variable font file and its OFL license are present on disk as tracked source assets", () => {
  assert.ok(fs.existsSync(path.join(ROOT, FONT_DIR, FONT_FILE)), `expected ${FONT_DIR}/${FONT_FILE} to exist`);
  assert.ok(fs.existsSync(path.join(ROOT, FONT_DIR, LICENSE_FILE)), `expected ${FONT_DIR}/${LICENSE_FILE} to exist`);
});

test("the root Manrope.zip source archive is not present in the working tree", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "Manrope.zip")), "Manrope.zip must be removed once the font has been extracted and verified");
});

test("the font ZIP is not exposed through public/", () => {
  const publicDir = path.join(ROOT, "public");
  const found = fs.existsSync(publicDir) ? fs.readdirSync(publicDir).filter((f) => /manrope/i.test(f) || f.endsWith(".zip")) : [];
  assert.deepEqual(found, []);
});

test("the existing --font-sans CSS variable is preserved and still wired into layout.tsx and Tailwind", () => {
  const layout = read(LAYOUT_PATH);
  assert.match(layout, /variable:\s*["']--font-sans["']/);

  const tailwindConfig = read("tailwind.config.ts");
  assert.match(tailwindConfig, /var\(--font-sans\)/);
});

test("no Google Fonts URL or import exists anywhere in application source", () => {
  const searchDirs = ["src"];
  // Import-statement syntax only (not a bare substring) — a code comment is
  // allowed to mention "next/font/google" in prose (e.g. explaining what
  // the migration replaced) without tripping this guard; only an actual
  // import of it is banned.
  const bannedPatterns = [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /from\s+["']next\/font\/google["']/];

  function walk(dir: string): string[] {
    const entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        files = files.concat(walk(rel));
      } else if (/\.(tsx?|css)$/.test(entry.name)) {
        files.push(rel);
      }
    }
    return files;
  }

  for (const dir of searchDirs) {
    for (const file of walk(dir)) {
      const content = read(file);
      for (const pattern of bannedPatterns) {
        assert.ok(!pattern.test(content), `${file} must not contain a Google Fonts reference matching ${pattern}`);
      }
    }
  }
});

test("body applies font-sans, so all form controls and descendants inherit the local font (no separate per-component font-family overrides)", () => {
  const layout = read(LAYOUT_PATH);
  assert.match(layout, /className="font-sans antialiased"/);
});
