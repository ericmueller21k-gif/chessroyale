import { defineConfig, devices } from "@playwright/test";

/** The local Worker's admins (asServerAdmin, e2e/helpers.ts): one address per lane, spec file and project, as files run side by side. */
const ADMINS = [["ops", "problems"], ["chat", "chat-mod"], ["chat", "town-chat"], ["chat", "town-chat-history"]]
  .flatMap(([who, file]) => ["phone", "desktop"].map((project) => `${who}-admin-${file}-${project}@e2e.test`))
  .join(",");

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  reporter: "list",
  use: { baseURL: "http://localhost:8788", trace: "retain-on-failure" },
  webServer: {
    // The real Worker and Durable Objects, run locally by wrangler, serving the built app.
    // (Without the engine server container, so the phones' own re-checks are what's tested; see DEPLOY.md.)
    // E2E_PREBUILT=1: the app is already built (CI builds it in its own step), so start wrangler at once.
    command: (process.env.E2E_PREBUILT ? "" : "npm run build && ") + "npx wrangler dev --port 8788 --enable-containers=false --var MATCH_FILL_SECONDS:8 --var ENGINE_OFF:1 --var SQUADS_TEST:1 --var MAIA_TEST:1 --var TEST_SWITCHES:1 --var FAIRPLAY_REVIEW_TOKEN:e2e-review-token-0123456789 --var ADMIN_EMAILS:" + ADMINS,
    url: "http://localhost:8788",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
