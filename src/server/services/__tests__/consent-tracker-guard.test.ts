import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * [31] Static tracker guard — task section 20.
 *
 * Supplements (does not replace) src/lib/consent-integrations.ts as the
 * source of truth. Flags an optional tracker/script literal appearing
 * anywhere in `src` OUTSIDE the small allowlist of files that are allowed
 * to reference one — i.e. a future engineer bypassing the registry and
 * dropping a <Script src="googletagmanager.com/..."> directly into a page
 * or component instead of registering it properly.
 *
 * Deliberately narrow patterns (real domains/call-shapes, not bare words
 * like "analytics") so this never fires on unrelated prose, the registry's
 * own worked-example comment, or this guard's own source.
 */

const SRC_DIR = path.join(process.cwd(), "src");

// Files allowed to mention a tracker identifier — the registry (worked
// example comment only, never an enabled entry), the script gate (its own
// loader map + doc comment), and this guard itself. Extend this list the
// same day a real loader file is added.
const ALLOWLIST = new Set(
  [
    "src/lib/consent-integrations.ts",
    "src/components/cookie-consent/consent-script-gate.tsx",
    "src/server/services/__tests__/consent-tracker-guard.test.ts",
  ].map((p) => path.join(process.cwd(), p)),
);

const SUSPICIOUS_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "googletagmanager.com", pattern: /googletagmanager\.com/ },
  { name: "gtag(", pattern: /\bgtag\s*\(/ },
  { name: "clarity(", pattern: /\bclarity\s*\(/ },
  { name: "hotjar", pattern: /\bhotjar\b/i },
  { name: "fbq(", pattern: /\bfbq\s*\(/ },
  { name: "connect.facebook.net", pattern: /connect\.facebook\.net/ },
  { name: "MetaPixel", pattern: /\bMetaPixel\b/ },
  { name: "next/script import", pattern: /from\s+["']next\/script["']/ },
];

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

test("[31] no optional tracker/script literal appears outside the approved consent-integration files", async () => {
  const files = await walk(SRC_DIR);
  const violations: string[] = [];

  for (const file of files) {
    if (ALLOWLIST.has(file)) continue;
    const contents = await fs.readFile(file, "utf8");
    for (const { name, pattern } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(contents)) {
        violations.push(`${path.relative(process.cwd(), file)} matches "${name}"`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found tracker/script references outside the approved consent architecture:\n${violations.join("\n")}`,
  );
});

test("guard sanity: the allowlist mechanism itself works (this file's own path is excluded from being flagged for mentioning tracker names in patterns)", () => {
  const self = path.join(process.cwd(), "src/server/services/__tests__/consent-tracker-guard.test.ts");
  assert.equal(ALLOWLIST.has(self), true);
});
