import { fileURLToPath } from "node:url";
import base from "../../playwright.config.ts";

/**
 * Stills scripts (Nov 25): `npm run stills:end-screens` (end-screens.spec.ts). The real app on the local server (base config's
 * webServer, started from the repo's root: builds, then wrangler; E2E_PREBUILT=1 to skip the build, E2E_REUSE=1 to use one already
 * running). Not CI: their output is pictures for a person to look at. PW_CHROME: a Chromium to use instead of Playwright's own.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
export default {
  ...base,
  testDir: ".",
  timeout: 600_000,
  webServer: { ...(base.webServer as object), cwd: root },
  projects: [{ name: "stills", use: { ...(process.env.PW_CHROME ? { launchOptions: { executablePath: process.env.PW_CHROME } } : {}) } }],
};
