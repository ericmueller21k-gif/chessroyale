import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../playwright.config.ts";

/**
 * The landing reel's recorder (scripts/reel/record-reel.ts) under the e2e's own local server (its webServer: started and stopped
 * with the run, on E2E_PORT). Only the recorder runs; one worker, no retries.
 *   npx playwright test -c scripts/reel/reel.config.ts [-g crowd|town|ranked|hidden|captions]
 * (PW_CHROMIUM=/path/to/chrome where Playwright's own browser isn't installed.)
 * then scripts/reel/encode-trailer.py joins the scenes into packages/app/public/media/hunchess-reel.{mp4,webm,jpg}.
 */
const launchOptions = process.env.PW_CHROMIUM
  ? { executablePath: process.env.PW_CHROMIUM }
  : {};

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: /record-reel\.ts$/,
  retries: 0,
  workers: 1,
  timeout: 600_000,
  webServer: {
    ...(base.webServer as object),
    cwd: resolve(import.meta.dirname, "../.."),
  } as typeof base.webServer,
  projects: [
    // The phone's reel: a phone at 2.5x (the reel is 860 px wide). The computer's: a 1920 × 1080 window (the game's computer layouts).
    {
      name: "reel",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2.5,
        isMobile: true,
        hasTouch: true,
        colorScheme: "light",
        launchOptions,
      },
    },
    {
      name: "wide",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        colorScheme: "light",
        launchOptions,
      },
    },
  ],
});
