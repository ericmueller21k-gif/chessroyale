import { devices, expect, type Page } from "@playwright/test";
import { gunzipSync } from "node:zlib";
import { Chess } from "chess.js";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { createLobbyFromHome, joinFromInvite, named, test } from "./helpers.ts";

/**
 * The Maia boss (DECISIONS.md, "A human-like boss: Maia-3 for Ginger", Oct 11; "Every boss on Maia", Oct 12): for an
 * admin every boss plays with Maia by default, in Boss alone and online (the host's device plays it, everyone gets its
 * one move); an admin can pick another brain in Boss alone's boss menu, and a debug line says what the brain did.
 * Maia's moves come through the Maia box's worker, spoken to in text. Players never load Maia.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
}

/** Waits for your move and plays a legal one (one a power allows). */
async function play(page: Page, timeout = 60_000) {
  await expect.poll(() => phase(page), { timeout }).toBe("play");
  const { fen, allowed } = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });
  const legal = new Chess(fen)
    .moves({ verbose: true })
    .map((mv) => mv.from + mv.to + (mv.promotion ?? ""))
    .filter((mv) => !allowed || allowed.includes(mv));
  // (A quiet, safe-ish move: the God King's Last Stand isn't what's tested here.)
  const move = legal.find((m) => /^[a-h]2[a-h][34]$/.test(m)) ?? legal[0]!;
  await page.evaluate((mv) => (window as any).match.submit(mv), move);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
}

test("an admin's Brain picker: Ginger on Maia with the full guard, on a phone; Maia's moves come through", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(4 * 60_000);
  await asAdmin(page);
  const maiaFiles: string[] = [];
  page.on("request", (r) => r.url().includes("/engine/maia/") && maiaFiles.push(new URL(r.url()).pathname));
  await page.goto("/?debug&clock=40&bossMoves=6&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  const brain = menu.getByRole("combobox", { name: "Boss brain (testing)" });
  await expect(brain).toBeVisible();
  // (Each boss's own is the default: Ginger's is Maia, no guard.)
  await expect(brain).toHaveValue("");
  await brain.selectOption("maia-full");
  // The menu fetches Maia's files ahead (into the service worker's cache).
  await expect.poll(() => maiaFiles.some((f) => f.endsWith(".onnx")), { timeout: 10_000 }).toBe(true);
  await menu.getByRole("button", { name: /Ginger/ }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("gingerbread");
  const debug = page.locator(".brain-debug");
  await expect(debug).toContainText(/Maia \d+ · full guard/, { timeout: 30_000 });
  // (The model loads during the intro; it's ready before long.)
  await expect.poll(() => page.evaluate(() => (window as any).match.brainLine as string), { timeout: 60_000 }).toMatch(/· ready$|Maia's/);
  const lines: string[] = [];
  for (let i = 0; i < 4 && (await phase(page)) !== "results"; i++) {
    await play(page);
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
    lines.push(await debug.innerText());
  }
  // Maia played the boss's moves (its own, or its next likely move where the guard turned one down), quickly.
  const maia = lines.filter((l) => /Maia \d+ · full guard · (guard → )?Maia's #\d+ · \d+ ms/.test(l));
  expect(maia.length, lines.join("\n")).toBeGreaterThanOrEqual(2);
  for (const l of maia) expect(Number(l.match(/(\d+) ms/)![1])).toBeLessThan(1500);
  // The line fits the phone's width.
  const box = await debug.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("every boss is on Maia, no guard, by default for an admin (Boss alone, a phone): its moves are Maia's", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  const bosses = BOSS_ROSTER.filter(isPlayable).map((b) => b.id);
  test.setTimeout(bosses.length * 120_000);
  await asAdmin(page);
  for (const id of bosses) {
    const t0 = Date.now();
    await page.goto(`/?debug&clock=40&bossMoves=3&laststand=0&boss=${id}`);
    await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.id ?? null), { timeout: 30_000 }).toBe(id);
    const debug = page.locator(".brain-debug");
    await expect(debug, id).toContainText(/Maia \d+ · no guard/, { timeout: 30_000 });
    const lines: string[] = [];
    for (let i = 0; i < 3 && (await phase(page)) !== "results"; i++) {
      await play(page);
      await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
      // (What the brain did with the boss's move just played; the line itself goes with the battle's screen.)
      lines.push(await page.evaluate(() => ((window as any).match.brainLine as string | null) ?? ""));
    }
    console.log(`${id}: ${Math.round((Date.now() - t0) / 1000)} s · ${lines.join(" | ")}`);
    expect(lines.filter((l) => /Maia \d+ · no guard · Maia's #\d+ · \d+ ms/.test(l)).length, `${id}: ${lines.join(" | ")}`).toBeGreaterThanOrEqual(1);
  }
});

test("an online raid on the Maia brain: the host's device plays Maia's move, everyone gets the same one, a player's never loads it", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "one run covers both devices");
  test.setTimeout(5 * 60_000);
  // (wrangler dev's MAIA_TEST counts everyone as an admin for the lobby's choice; only the admin's app may run Maia.)
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestCtx = await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any);
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  await asAdmin(host);
  const guestMaia: string[] = [];
  guest.on("request", (r) => r.url().includes("/engine/maia/") && guestMaia.push(r.url()));
  await named(host, "Hosty");
  await named(guest, "Guesty");
  await host.goto("/?debug&pace=quick&mode=raid&boss=gingerbread&bossMoves=4&clock=40&laststand=0");
  await createLobbyFromHome(host);
  await expect(host.getByRole("heading", { name: /^Lobby / })).toBeVisible();
  const code = (await host.locator(".invite-code").textContent())!.trim();
  await guest.goto(`/lobby/${code}?debug`);
  await joinFromInvite(guest);
  await expect(host.locator(".lobby-players li")).toHaveCount(2);
  await host.getByRole("button", { name: /^Start with 2 players/ }).click();
  const debug = host.locator(".brain-debug");
  await expect(debug).toContainText(/Maia \d+ · no guard/, { timeout: 60_000 });
  const lines: string[] = [];
  for (let i = 0; i < 4; i++) {
    if ((await phase(host)) === "results") break;
    await play(host, 90_000);
    if ((await phase(guest)) === "play") await play(guest);
    await expect.poll(() => phase(host), { timeout: 60_000 }).toMatch(/^(play|results)$/);
    lines.push(await host.evaluate(() => ((window as any).match.brainLine as string | null) ?? ""));
    // Everyone gets the one move the host's Maia played.
    const played = await host.evaluate(() => (window as any).match.boss?.lastMove?.move ?? null);
    await expect.poll(() => guest.evaluate(() => (window as any).match.boss?.lastMove?.move ?? null), { timeout: 10_000 }).toBe(played);
  }
  expect(lines.filter((l) => /Maia \d+ · no guard · Maia's #\d+ · \d+ ms/.test(l)).length, lines.join(" | ")).toBeGreaterThanOrEqual(1);
  // The player's device never downloaded Maia, and shows no debug line.
  expect(guestMaia).toEqual([]);
  await expect(guest.locator(".brain-debug")).toHaveCount(0);
});

test("players meet Stockfish: no Brain picker, no Maia download, no debug line", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  const maiaFiles: string[] = [];
  page.on("request", (r) => r.url().includes("/engine/maia/") && maiaFiles.push(r.url()));
  await page.goto("/?debug&clock=40&bossMoves=6&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu.getByRole("button", { name: /Ginger/ })).toBeVisible();
  await expect(menu.getByRole("combobox", { name: "Boss brain (testing)" })).toHaveCount(0);
  await menu.getByRole("button", { name: /Ginger/ }).click();
  await play(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
  await expect(page.locator(".brain-debug")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).match.brainLine)).toBeNull();
  expect(maiaFiles).toEqual([]);
});

test("the credits name Maia-3 and Stockfish, with the Maia box's license beside it and both engines' source to download", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  await page.goto("/settings");
  const credit = page.locator(".maia-credit");
  await expect(credit).toContainText("Maia-3");
  await expect(credit).toContainText("Stockfish");
  await expect(credit).not.toContainText("on request");
  await expect(credit.getByRole("link", { name: "Maia-3" })).toHaveAttribute("href", "https://github.com/CSSLab/maia3");
  const licence = await page.request.get("/engine/maia/LICENSE.txt");
  expect(licence.ok()).toBe(true);
  expect(await licence.text()).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
  // The engines' complete source, served by the site itself (DECISIONS.md, "The Maia box's source on the site"): real
  // gzip files (not the app's page, which any unknown path gets), saved as they are, holding the source.
  const archives = [
    { link: "source code", href: "/engine/maia/maia-box-source.tar.gz", holds: ["maia-box/src/worker.ts", "maia-box/scripts/convert.py", "maia-box/LICENSE", "maia-box/package-lock.json"] },
    { link: "its source", href: "/engine/stockfish-source.tar.gz", holds: ["stockfish.js-19.0.0/Copying.txt", "stockfish.js-19.0.0/src/nn-61e7af4bb97d.nnue", "SOURCE-FOR-HUNCHESS.txt"] },
  ];
  for (const a of archives) {
    await expect(credit.getByRole("link", { name: a.link })).toHaveAttribute("href", a.href);
    const res = await page.request.get(a.href);
    expect(res.status(), a.href).toBe(200);
    expect(res.headers()["content-encoding"], a.href).toBeUndefined();
    const body = await res.body();
    expect([body[0], body[1]], a.href).toEqual([0x1f, 0x8b]);
    const tar = gunzipSync(body).toString("latin1");
    for (const path of a.holds) expect(tar, `${a.href}: ${path}`).toContain(path);
  }
  // A tap saves the file.
  const [download] = await Promise.all([page.waitForEvent("download"), credit.getByRole("link", { name: "source code" }).click()]);
  expect(download.suggestedFilename()).toBe("maia-box-source.tar.gz");
  // The service worker never fetches them for the game (it precaches the engine, not its source).
  const sw = await (await page.request.get("/sw.js")).text();
  expect(sw).toContain('"/engine/stockfish-19-lite-single.wasm"');
  for (const a of archives) expect(sw).not.toContain(`"${a.href}"`);
});
