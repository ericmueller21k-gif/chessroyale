import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  reporter: "list",
  use: { baseURL: "http://localhost:4180", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build -w @chessroyale/app && npm run preview -w @chessroyale/app -- --port 4180 --strictPort",
    url: "http://localhost:4180",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
