import { defineConfig, devices } from '@playwright/test';

// Runs against a real API + database (the same one `next build`'s static
// pages fetch from — see the root README's CI section), not a mocked
// backend, so these tests are the closest thing this app has to an
// end-to-end guarantee that a full user flow — not just a component in
// isolation — actually works. Requires the API already running (see
// e2e/README.md) — this config only starts the web app itself.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false, // several specs share seeded catalog data/admin state
  // One worker, not just fullyParallel: false — these hit a real shared
  // DB/API, not an isolated fixture per test, so running spec *files*
  // concurrently adds both load-based flakiness (slower responses can
  // exceed an assertion's timeout) and cross-file data races (e.g. two
  // files' moderation-queue checks racing each other's writes). Mirrors
  // api/test/jest-e2e.json's maxWorkers: 1 for the same reason.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
