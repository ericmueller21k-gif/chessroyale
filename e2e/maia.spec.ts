import { devices, expect, type Page } from "@playwright/test";
import { gunzipSync } from "node:zlib";
import { Chess } from "chess.js";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { createLobbyFromHome, joinFromInvite, named, test, watchFor, bossAloneFromHome } from "./helpers.ts";

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
    // (A battle's result refetches your profile as it ends: the test may close the page while that's in flight.)
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
    } catch {
      // The page is gone: nothing to answer.
    }
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
  await bossAloneFromHome(page, "Ginger");
  const menu = page.getByRole("dialog", { name: "Boss alone" });
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
    await bossAloneFromHome(page);
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

/**
 * Every Worker the page makes, in order, with when (ms since the page began): made, each command sent to it, ended
 * (Stockfish's: /engine/stockfish…; Maia's: /engine/maia/…).
 */
function workerLog() {
  const log: { t: number; worker: number; url: string; what: string }[] = [];
  (window as any).__workers = log;
  const Real = window.Worker;
  let n = 0;
  (window as any).Worker = class extends Real {
    constructor(url: string | URL, opts?: WorkerOptions) {
      super(url, opts);
      const worker = ++n;
      const u = String(url);
      log.push({ t: performance.now(), worker, url: u, what: "new" });
      const post = this.postMessage.bind(this);
      this.postMessage = (m: unknown, ...rest: unknown[]) => {
        log.push({ t: performance.now(), worker, url: u, what: `send ${String(m)}` });
        return (post as (...a: unknown[]) => void)(m, ...rest);
      };
      const end = this.terminate.bind(this);
      this.terminate = () => {
        log.push({ t: performance.now(), worker, url: u, what: "end" });
        end();
      };
    }
  };
}

test("the loading step: Stockfish's workers end, Maia loads alone behind \"Loading the boss…\", then the battle on Maia", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  await asAdmin(page);
  await page.addInitScript(workerLog);
  await page.goto("/?debug&clock=40&bossMoves=4&laststand=0&boss=gingerbread");
  // (The service worker in control, so it keeps Maia's files for the next battle.)
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });
  // (The app's Stockfish is up before the battle: the pool made as the app opens.)
  await expect.poll(() => page.evaluate(() => (window as any).__workers.filter((w: any) => w.what === "send isready" && w.url.includes("stockfish")).length)).toBeGreaterThan(0);
  const seen = await watchFor(page, { overlay: { selector: ".boss-loading", text: /Loading the boss…/ }, starting: { selector: ".boss-loading", text: /Starting…/ } });
  // Every frame from here: the step's card, the intro's card (and how opaque), so the hand-over is seen frame by frame.
  await page.evaluate(() => {
    const w = window as any;
    w.__frames = [] as { t: number; step: boolean; intro: number | null }[];
    const look = () => {
      const intro = document.querySelector(".boss-intro");
      const step = !!document.querySelector(".boss-loading");
      w.__frames.push({ t: performance.now(), step, intro: intro ? Number(getComputedStyle(intro).opacity) : null });
      if (step && w.__stepFrom === undefined) w.__stepFrom = performance.now();
      if (!step && w.__stepFrom !== undefined && w.__stepTo === undefined) w.__stepTo = performance.now();
      // (Until the intro's card has been up 30 frames.)
      if (intro) w.__introFrames = (w.__introFrames ?? 0) + 1;
      if ((w.__introFrames ?? 0) < 30 && w.__frames.length < 20_000) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 60_000 });
  expect(await seen.seen()).toEqual({ overlay: true, starting: true });
  // Frame by frame: from the step's card to the intro's, always one of them, and the intro's whole from its first frame
  // (no entrance: the board never shows between the two).
  const frames = await page.evaluate(() => (window as any).__frames as { step: boolean; intro: number | null }[]);
  const first = frames.findIndex((f) => f.step);
  const introAt = frames.findIndex((f) => f.intro !== null);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(introAt).toBeGreaterThan(first);
  expect(frames.slice(first, introAt + 1).filter((f) => !f.step && f.intro === null), "a frame with neither card").toEqual([]);
  expect(frames[introAt]!.intro).toBe(1);
  // Ready before the battle began (its line says so from the intro on).
  expect(await page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/^Maia \d+ · no guard · ready$/);
  const { log, from, to } = await page.evaluate(() => ({ log: (window as any).__workers as { t: number; worker: number; url: string; what: string }[], from: (window as any).__stepFrom as number, to: (window as any).__stepTo as number }));
  const sf = (w: { url: string }) => w.url.includes("stockfish");
  const maiaReady = log.find((w) => w.url.includes("/engine/maia/") && w.what === "send isready")!;
  expect(maiaReady, JSON.stringify(log)).toBeTruthy();
  // Every Stockfish worker made before the step ended before Maia's model began to load, and none searched in the step.
  const before = [...new Set(log.filter((w) => sf(w) && w.what === "new" && w.t < from).map((w) => w.worker))];
  expect(before.length).toBeGreaterThan(0);
  for (const id of before) {
    const end = log.find((w) => w.worker === id && w.what === "end");
    expect(end && end.t, `Stockfish worker ${id} ended before Maia's load`).toBeLessThan(maiaReady.t);
  }
  const searching = log.filter((w) => sf(w) && w.what.startsWith("send go") && w.t > from && w.t < to);
  expect(searching, "Stockfish searched during the step").toEqual([]);
  // Fresh Stockfish workers after it, as many as before, and the battle goes on: Maia's moves come through.
  const after = new Set(log.filter((w) => sf(w) && w.what === "new" && w.t >= maiaReady.t).map((w) => w.worker));
  expect(after.size).toBe(before.length);
  console.log(`loading step: ${Math.round(to - from)} ms (files fetched first by the boss menu's prefetch, or by the step)`);
  const lines: string[] = [];
  for (let i = 0; i < 2 && (await phase(page)) !== "results"; i++) {
    await play(page);
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
    lines.push(await page.evaluate(() => ((window as any).match.brainLine as string | null) ?? ""));
  }
  expect(lines.filter((l) => /Maia \d+ · no guard · Maia's #\d+ · \d+ ms/.test(l)).length, lines.join(" | ")).toBeGreaterThanOrEqual(1);
  // The next battle on this device: its files are saved, so it's straight to "Starting…", with no word of a download.
  await page.goto("/?debug&clock=40&bossMoves=4&laststand=0&boss=gingerbread");
  const again = await watchFor(page, { first: { selector: ".boss-loading-first" }, download: { selector: '.boss-loading[data-stage="download"]' }, starting: { selector: ".boss-loading", text: /Starting…/ } });
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 60_000 });
  expect(await again.seen()).toEqual({ first: false, download: false, starting: true });
  expect(await page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/· ready$/);
});

test("the loading step gives up when Maia can't load (its model missing): the battle goes on with Stockfish, the admins' line says why", async ({ browser }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  // (No service worker: the route answers every request, the Maia worker's own too.)
  const ctx = await browser.newContext({ ...devices["iPhone 13"], browserName: undefined, serviceWorkers: "block" } as any);
  const page = await ctx.newPage();
  await asAdmin(page);
  await ctx.route("**/engine/maia/maia3-23m-int8.onnx", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/?debug&clock=40&bossMoves=4&laststand=0&boss=gingerbread");
  const seen = await watchFor(page, { overlay: { selector: ".boss-loading", text: /Loading the boss…/ } });
  const t0 = Date.now();
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 60_000 });
  expect(await seen.seen()).toEqual({ overlay: true });
  // (A missing file isn't tried again, nor waited on to the step's limit.)
  expect(Date.now() - t0).toBeLessThan(15_000);
  await expect(page.locator(".boss-loading")).toHaveCount(0);
  const debug = page.locator(".brain-debug");
  await expect(debug).toContainText(/failed: Stockfish \(load failed: model: HTTP 404\)/, { timeout: 10_000 });
  // The whole reason shows: the line wraps, nothing cut.
  expect(await debug.evaluate((el) => getComputedStyle(el).textOverflow)).not.toBe("ellipsis");
  await play(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
  // The boss played Stockfish's move: the battle went on.
  expect(await page.evaluate(() => (window as any).match.boss.lastMove?.move ?? null)).toBeTruthy();
  expect(await page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/Stockfish/);
});

test("players meet Maia too (forPlayers on): no Brain picker and no debug line; Maia downloads", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  const maiaFiles: string[] = [];
  page.on("request", (r) => r.url().includes("/engine/maia/") && maiaFiles.push(r.url()));
  await page.goto("/?debug&clock=40&bossMoves=6&laststand=0");
  await bossAloneFromHome(page, "Ginger");
  const menu = page.getByRole("dialog", { name: "Boss alone" });
  await expect(menu.getByRole("button", { name: /Ginger/ })).toBeVisible();
  await expect(menu.getByRole("combobox", { name: "Boss brain (testing)" })).toHaveCount(0);
  await menu.getByRole("button", { name: /Ginger/ }).click();
  await play(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
  await expect(page.locator(".brain-debug")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).match.brainLine)).toBeNull();
  // Maia is on for players (BOSS_BRAIN.forPlayers): the player's device downloads it for the boss's moves.
  await expect.poll(() => maiaFiles.length, { timeout: 30_000 }).toBeGreaterThan(0);
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
