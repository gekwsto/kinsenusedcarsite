import { defineConfig, devices } from "@playwright/test";

// Isolated port — never the developer's own `next dev` on 3001, and never
// the live production site. `webServer` below starts/stops this server
// automatically; it assumes `npm run build` has already been run (kept as
// a separate step, same as the task's own documented command sequence),
// not bundled into the webServer command itself, so repeated local
// `npm run test:e2e` runs during iteration don't rebuild every time.
const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // consent tests read/write real browser cookies per-context; keep runs simple and deterministic rather than racing multiple workers against one shared server process
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // do not hide a deterministic local failure behind a retry
  workers: process.env.CI ? 2 : 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Registered only when installed — see tests/e2e/README for the exact
    // `npx playwright install firefox webkit` attempt and result. Chromium
    // above is the mandatory, always-required project.
    ...(process.env.PLAYWRIGHT_FIREFOX ? [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }] : []),
    ...(process.env.PLAYWRIGHT_WEBKIT ? [{ name: "webkit", use: { ...devices["Desktop Safari"] } }] : []),
  ],

  webServer: {
    command: `npm run start -- -p ${PORT} -H 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
    // .env's NEXTAUTH_URL points at the dev server (localhost:3000), so
    // NextAuth v5 correctly rejects requests arriving on this isolated E2E
    // port as an untrusted host — the same mismatch a real deployment
    // would never hit, since there NEXTAUTH_URL matches the real domain.
    // AUTH_TRUST_HOST is Auth.js's own documented environment variable for
    // exactly this self-hosted/non-fixed-host scenario (https://authjs.dev/reference/core#trusthost)
    // — it only changes which Host header the library trusts to build its
    // own callback/session URLs, never credential/session/CSRF validation.
    // Scoped to this spawned test-server process only; not a change to
    // auth.ts or .env, and not in effect for `npm run dev`/`npm start` normally.
    env: { AUTH_TRUST_HOST: "true" },
  },
});
