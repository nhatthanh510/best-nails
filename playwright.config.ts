import { defineConfig, devices } from "@playwright/test";

// The E2E helpers seed and clean up with the service-role key, read from the same file Next uses.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI can pass the variables in the environment instead.
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Settings and rewards are shared by the whole app, so tests run one at a time (see docs/AUTOMATED_TESTS.md).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The dev server compiles each route on first visit, which can take a while.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    locale: "en-AU",
    timezoneId: "Australia/Hobart",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/, teardown: "teardown" },
    { name: "teardown", testMatch: /global\.teardown\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /global\.(setup|teardown)\.ts/,
      // The shop's iPad in landscape, the kiosk's main layout.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 }, storageState: "e2e/.auth/admin.json" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/admin/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
