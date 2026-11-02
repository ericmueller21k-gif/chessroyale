import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  reporter: "list",
  use: { baseURL: "http://localhost:8877", trace: "off" },
  webServer: {
    command: "npx wrangler dev --port 8877 --inspector-port 9377 --enable-containers=false --var MATCH_FILL_SECONDS:8 --var ENGINE_OFF:1 --var TEST_SWITCHES:1",
    url: "http://localhost:8877",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
