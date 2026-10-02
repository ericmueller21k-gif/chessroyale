import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  reporter: "list",
  use: { baseURL: "http://localhost:8788", trace: "retain-on-failure" },
  webServer: {
    // The real Worker and Durable Objects, run locally by wrangler, serving the built app.
    command: "npm run build && npx wrangler dev --port 8788",
    url: "http://localhost:8788",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
