import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../playwright.config.ts";

/**
 * The landing reel's recorder (scripts/reel/record-reel.ts) under the e2e's own local server (its webServer: started and stopped
 * with the run, on E2E_PORT). Only the recorder runs; one worker, no retries.
 *   npx playwright test -c scripts/reel/reel.config.ts [-g crowd|town|ranked|hidden|captions]
 * (PW_CHROMIUM=/path/to/chrome where Playwright's own browser isn't installed.)
 * then scripts/encode-demo.sh joins the scenes into packages/app/public/media/hunchess-reel.{mp4,webm,jpg}.
 */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: /record-reel\.ts$/,
  retries: 0,
  workers: 1,
  timeout: 600_000,
  webServer: { ...(base.webServer as object), cwd: resolve(import.meta.dirname, "../..") } as typeof base.webServer,
  projects: [{ name: "reel", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light", launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} } }],
});
