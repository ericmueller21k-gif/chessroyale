import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { pausedLine } from "@chessroyale/core";
import { soloFromHome, test } from "./helpers.ts";

/**
 * The kill switches and the maintenance banner (docs/areas/ops.md, "Kill switches"): Worker variables, so they need a
 * server of their own. This file starts one (wrangler dev on port 8789, the built app, its own storage) with Squads
 * resting and a banner, and stops it after: its own process group only. The suite's server (8788) has neither, so no
 * other spec sees them. Phone only: one run is enough, and only one server may hold the port.
 */

const PORT = 8789;
const BASE = `http://localhost:${PORT}`;
const BANNER = "Maintenance tonight at 10 pm (UTC). Matches already running will finish.";
let server: ChildProcess | null = null;
let storage = "";

const up = () =>
  fetch(`${BASE}/api/status`)
    .then((r) => r.ok)
    .catch(() => false);

test.beforeAll(async ({}, info) => {
  if (info.project.name !== "phone") return;
  info.setTimeout(150_000);
  if (await up()) throw new Error(`Port ${PORT} is already serving: not starting a second server there.`);
  storage = mkdtempSync(join(tmpdir(), "kill-switches-"));
  const log = openSync(join(storage, "wrangler.log"), "a");
  // (Detached: its own process group, so afterAll stops wrangler and the runtime it starts, and nothing else.)
  server = spawn(
    "npx",
    ["wrangler", "dev", "--port", String(PORT), "--persist-to", join(storage, "state"), "--enable-containers=false", "--show-interactive-dev-session=false",
      "--var", "ENGINE_OFF:1", "--var", "PAUSE_SQUADS:1", "--var", `MAINTENANCE_BANNER:${BANNER}`],
    { detached: true, stdio: ["ignore", log, log], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
  const until = Date.now() + 120_000;
  while (!(await up())) {
    if (Date.now() > until || server.exitCode !== null) throw new Error(`The test server on ${PORT} didn't start (its log: ${join(storage, "wrangler.log")}).`);
    await new Promise((r) => setTimeout(r, 500));
  }
});

test.afterAll(async () => {
  const s = server;
  server = null;
  if (s?.pid) {
    const gone = new Promise((r) => s.once("exit", r));
    try {
      process.kill(-s.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
    await Promise.race([gone, new Promise((r) => setTimeout(r, 5000))]);
    try {
      process.kill(-s.pid, "SIGKILL");
    } catch {
      // Gone.
    }
  }
  if (storage) rmSync(storage, { recursive: true, force: true });
});

test("Squads resting: PLAY and Party are closed with its line, and the server refuses a new queue or party", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one server, one run");
  const line = pausedLine("squads");
  await page.goto(`${BASE}/?mode=squads`);
  await expect(page.getByRole("radio", { name: /^Squads/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeDisabled();
  await expect(page.locator(".fd-hint")).toHaveText(line);
  await expect(page.locator(".sq-party-btn")).toBeDisabled();
  await expect(page.locator(".sq-party-btn")).toContainText(line);
  // The server: 503, the same line.
  for (const path of ["/api/squads/play", "/api/squads/party"]) {
    const res = await page.request.post(`${BASE}${path}`);
    expect(res.status(), path).toBe(503);
    expect(await res.json(), path).toEqual({ message: line, paused: "squads" });
  }
  // Another mode is open as usual: Crowd's PLAY.
  await page.getByRole("radio", { name: /^Crowd/ }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeEnabled();
  await expect(page.locator(".fd-hint")).not.toHaveText(line);
});

test("the maintenance banner: at the top of every screen, over the page; ✕ hides it on this device", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one server, one run");
  const banner = page.locator(".maint-banner");
  for (const path of ["/", "/settings", "/shop", "/faq"]) {
    await page.goto(`${BASE}${path}`);
    await expect(banner, path).toHaveText(new RegExp(BANNER.replace(/[.()]/g, "\\$&")));
    expect((await banner.boundingBox())!.y, path).toBe(0);
    // (Over the page: nothing scrolls sideways or down because of it.)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBe(0);
  }
  // In a match too: Solo's queue.
  await page.goto(`${BASE}/`);
  await soloFromHome(page);
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(banner).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  // ✕: gone, and still gone after a reload (until the message changes).
  await page.getByRole("button", { name: "Hide this message" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(banner).toHaveCount(0);
});
