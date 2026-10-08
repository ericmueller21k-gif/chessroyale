import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  reporter: "list",
  use: { baseURL: "http://localhost:8788", trace: "retain-on-failure" },
  webServer: {
    // The real Worker and Durable Objects, run locally by wrangler, serving the built app.
    // (Without the engine server container, so the phones' own re-checks are what's tested; see DEPLOY.md.)
    command: "npm run build && npx wrangler dev --port 8788 --enable-containers=false --var MATCH_FILL_SECONDS:8 --var ENGINE_OFF:1 --var FAIRPLAY_REVIEW_TOKEN:e2e-review-token-0123456789",
    url: "http://localhost:8788",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
