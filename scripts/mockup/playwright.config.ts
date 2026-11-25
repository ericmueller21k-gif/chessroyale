import base from "../../playwright.config.ts";
/** The game-layout mockup's stills (Nov 25): `npx playwright test -c scripts/mockup/playwright.config.ts` (a local server: E2E_REUSE=1). */
export default {
  ...base,
  testDir: ".",
  projects: [{ name: "desktop", use: { ...base.projects![1]!.use, ...(process.env.PW_CHROME ? { launchOptions: { executablePath: process.env.PW_CHROME } } : {}) } }],
};
