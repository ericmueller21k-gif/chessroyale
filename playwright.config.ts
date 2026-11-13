import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * The local server (Nov 6): each run starts its own wrangler on E2E_PORT (default 8788), so worktrees side by side each
 * set their own port instead of copying this file. An existing server on the port is used only with E2E_REUSE=1
 * (otherwise Playwright stops with "already used"), so a run never tests another worktree's server and code.
 */
const PORT = Number(process.env.E2E_PORT || 8788);
/**
 * The key of the e2e's SQL route (server/src/e2e-sql.ts), new each run: the local server gets it as E2E_SQL and every request to the
 * route must carry it (e2e/helpers.ts localSql). A dashboard var that survived deploys would still need this run's key. (Set before the
 * workers start, so they inherit it.)
 */
const E2E_SQL_KEY = (process.env.E2E_SQL_KEY ||= randomBytes(24).toString("hex"));
/**
 * Where that server keeps its D1 and Durable Objects: a fresh temp folder each run (removed when it ends), as the schema is made at run time
 * and an old `.wrangler` keeps old rows and columns. E2E_KEEP_STATE=1 keeps `.wrangler/state` across runs instead; with
 * E2E_REUSE, set E2E_STATE_DIR to the reused server's folder for the specs that read D1. Set here once, in the main
 * process, so its workers (which load this file again) inherit the same folder (e2e/helpers.ts, `E2E_STATE`).
 */
if (!process.env.E2E_STATE_DIR && process.env.E2E_KEEP_STATE !== "1") {
  const dir = mkdtempSync(join(tmpdir(), "hunchess-e2e-"));
  process.env.E2E_STATE_DIR = dir;
  // (Removed when the run ends, the server stopped: about 6 MB a run, and the disk is shared. Only the process that made it.)
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
}
process.env.E2E_STATE_DIR ||= ".wrangler/state";

/** The local Worker's admins (asServerAdmin, e2e/helpers.ts): one address per lane, spec file and project, as files run side by side. */
const ADMINS = [["ops", "problems"], ["ops", "profile"], ["chat", "chat-mod"], ["chat", "town-chat"], ["chat", "town-chat-history"], ["ops", "shop"], ["ops", "claw"], ["ops", "xp-rewards"], ["ops", "fairplay"], ["ops", "hidden-boss-room"]]
  .flatMap(([who, file]) => ["phone", "desktop"].map((project) => `${who}-admin-${file}-${project}@e2e.test`))
  .join(",");

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    // The real Worker and Durable Objects, run locally by wrangler, serving the built app.
    // (Without the engine server container, so the phones' own re-checks are what's tested; see DEPLOY.md.)
    // E2E_PREBUILT=1: the app is already built (CI builds it in its own step), so start wrangler at once.
    command: (process.env.E2E_PREBUILT ? "" : "npm run build && ") + `npx wrangler dev --port ${PORT} --persist-to ${JSON.stringify(process.env.E2E_STATE_DIR)} --enable-containers=false` + " --var MATCH_FILL_SECONDS:8 --var ENGINE_OFF:1 --var SQUADS_TEST:1 --var MAIA_TEST:1 --var TEST_SWITCHES:1 --var CUTSCENE_HOLD_MS:12000 --var E2E_SQL:" + E2E_SQL_KEY + " --var FAIRPLAY_REVIEW_TOKEN:e2e-review-token-0123456789 --var ADMIN_EMAILS:" + ADMINS,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !!process.env.E2E_REUSE,
    timeout: 120_000,
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    // `@phone-only` (Nov 6): a test whose subject is game logic, the server or a flow (powers, whole matches, chat,
    // lobbies) runs on the phone alone; layout, the board, home and every guard test of docs/rules/eric.md run on both.
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }, grepInvert: /@phone-only/ },
  ],
});
