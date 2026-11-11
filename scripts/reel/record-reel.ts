/**
 * Records the landing page's demo reel (Eric, Nov 11; docs/decisions/2026-11-11-landing-reel.md), scene by scene, from the real
 * game on a phone screen (390 × 844 at 2x) under the e2e's local server. Each scene's frames go to
 * reports/demo/<scene>/frames/ (2x screenshots, back to back), with an ffconcat list (frames.txt) and a timeline of its moments
 * (marks.json, seconds from its first
 * frame), which scripts/encode-demo.sh cuts and joins. The Hidden Boss (scene 4) is pixel art drawn here, not a game screen; the
 * captions are drawn in the game's pixel font as see-through pictures (reports/demo/captions/).
 *   npx playwright test -c scripts/reel/reel.config.ts [-g crowd|town|ranked|hidden|captions]
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
// (The e2e's own `test`: every context starts with the first-time walkthrough and the quests overlay marked seen.)
import { BOARD_SEL, test } from "../../e2e/helpers.ts";
import { HIDDEN_BOSS_CAPTION, REEL_CAPTIONS, drawHiddenBoss } from "./hidden-boss.ts";

const OUT = "reports/demo";

/** Frames of `page` from now until `stop()`, written as JPEGs with their times; `mark(name)` notes a moment. */
async function recorder(page: Page, scene: string) {
  const dir = `${OUT}/${scene}`;
  let dropped = false;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(`${dir}/frames`, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames: { file: string; t: number }[] = [];
  const marks: Record<string, number> = {};
  // Back-to-back sharp (2x) screenshots of the part the reel shows (the top 700 CSS px), each stamped with its time. (Chrome's
  // screencast would give every painted frame, but only at 1x in a headless browser.)
  let capturing = true;
  const loop = (async () => {
    while (capturing) {
      const t = Date.now() / 1000;
      const shot = await cdp
        .send("Page.captureScreenshot", { format: "jpeg", quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 390, height: 700, scale: 2 } })
        .catch(() => null);
      if (!shot) continue;
      const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
      writeFileSync(`${dir}/frames/${file}`, Buffer.from(shot.data, "base64"));
      frames.push({ file, t });
    }
  })();
  const t0 = Date.now() / 1000;
  return {
    /** Stops and throws its frames away (the other player's view). */
    async drop() {
      dropped = true;
      capturing = false;
      await loop;
      rmSync(dir, { recursive: true, force: true });
    },
    mark(name: string) {
      marks[name] = Date.now() / 1000 - t0;
      console.log(`${scene}: ${name} at ${marks[name]!.toFixed(2)} s`);
    },
    async stop(rename?: string) {
      if (dropped) return;
      await page.waitForTimeout(300);
      capturing = false;
      await loop;
      // (Marks are in wall time since the start; the frames' own times start at the first frame: shift the marks onto those.)
      const first = frames[0]?.t ?? t0;
      for (const k of Object.keys(marks)) marks[k] = Math.max(0, marks[k]! - (first - t0));
      const lines = ["ffconcat version 1.0"];
      frames.forEach((f, i) => lines.push(`file frames/${f.file}`, `duration ${((frames[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`));
      writeFileSync(`${dir}/frames.txt`, lines.join("\n") + "\n");
      writeFileSync(`${dir}/marks.json`, JSON.stringify(marks, null, 2));
      if (rename) {
        rmSync(`${OUT}/${rename}`, { recursive: true, force: true });
        renameSync(dir, `${OUT}/${rename}`);
      }
      console.log(`${scene}: ${frames.length} frames over ${((frames.at(-1)?.t ?? first) - first).toFixed(1)} s`);
    },
  };
}

/** The page's name (as e2e/helpers.ts `named`), sound off. */
async function setUp(page: Page, name: string) {
  await page.addInitScript((n) => {
    try {
      localStorage.setItem("brc.name", n);
      localStorage.setItem("brc.sound", "0");
    } catch {
      // No storage.
    }
  }, name);
}

/** Your profile says you're an admin (e2e/helpers.ts `asAdmin`): for `?rank=` on the ranked stage. */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
    } catch {
      // The page is gone.
    }
  });
}

test("crowd", async ({ page }) => {
  test.setTimeout(150_000);
  // Scene 1: a solo 50 v 50 (as the old demo): you pick the engine's move after a moment, like a person.
  await setUp(page, "Hunter");
  await page.goto(`/?debug&mode=crowd&augments=0&clock=10&nolanding`);
  // Home: 50 v 50, Bots, PLAY, the Bot level box's OK (as e2e/helpers.ts soloFromHome).
  const row = page.getByRole("radiogroup", { name: "RANKED" });
  await row.getByRole("radio", { name: /^50 v 50/ }).click();
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  const box = page.getByRole("dialog", { name: "Bot level" });
  const ok = box.getByRole("button", { name: "OK", exact: true });
  if (await ok.isDisabled()) await box.getByRole("radio", { name: /^Medium/ }).click();
  const rec = await recorder(page, "crowd");
  await ok.click();
  rec.mark("start");
  const stopAt = Date.now() + 40_000;
  let lastBoard = "";
  while (Date.now() < stopAt) {
    const state = await page.evaluate(() => {
      const m = (window as any).match;
      return m ? { kind: m.phase.kind, key: m.phase.board ? `${m.phase.board.ply}` : "" } : { kind: "none", key: "" };
    });
    if (state.kind === "results") break;
    if (state.kind === "play" && state.key !== lastBoard) {
      lastBoard = state.key;
      rec.mark(`ply${state.key}`);
      await page.waitForTimeout(1800 + Math.random() * 1200);
      await page.evaluate(async () => {
        const m = (window as any).match;
        if (m.phase.kind !== "play") return;
        const top = await Promise.race([m.runner.topMovesFor(m.phase.board.fen), new Promise((r) => setTimeout(() => r(null), 4000))]);
        const fallback = [...(m.runner.planned?.values() ?? [])][0];
        if (m.phase.kind === "play") m.submit(top ? (top as any)[Math.random() < 0.6 ? 0 : 1]?.move ?? (top as any)[0].move : fallback);
      });
      rec.mark(`picked${state.key}`);
    }
    await page.waitForTimeout(150);
  }
  await rec.stop();
});

type TownHooks = {
  __townWalk?: (sq: readonly [number, number]) => boolean;
  __townYou?: () => { c: number; r: number; moving: boolean } | null;
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townGlide?: (id: string | readonly [number, number]) => void;
  __townCam?: () => { focus: [number, number] } | null;
  __shopIntro?: () => { step: string } | null;
};

test("town", async ({ page }) => {
  // Scene 2: you run round the park (the town everyone gets), then Big Boy: his card, Fight, in to his Crib, his intro, the battle.
  await setUp(page, "Hunter");
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
  await page.goto("/town?debug&nolanding&sky=day");
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await page.waitForTimeout(2500);
  const you = () => page.evaluate(() => (window as unknown as TownHooks).__townYou?.() ?? null);
  const walk = async (sq: [number, number]) => {
    await page.evaluate((s) => (window as unknown as TownHooks).__townWalk?.(s), sq);
    await page.waitForTimeout(150);
    await expect.poll(async () => (await you())?.moving, { timeout: 20_000, intervals: [100] }).toBe(false);
  };
  console.log("you start at", await you());
  const route = (process.env.REEL_PARK ?? "17,17 28,17 28,12 18,12 18,16").split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  const rec = await recorder(page, "town");
  rec.mark("park");
  for (const sq of route) await walk(sq);
  rec.mark("parkEnd");
  // Big Boy: the camera glides to his Crib (as his chip would), a tap on him, Challenge alone, Fight.
  await page.evaluate(() => (window as unknown as TownHooks).__townGlide?.("bigboy"));
  await page.waitForTimeout(1800);
  rec.mark("glided");
  const card = page.getByRole("dialog", { name: "Big Boy", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    const at = await page.evaluate(() => (window as unknown as TownHooks).__townAt?.("boss", "bigboy") ?? null);
    if (!at) await page.evaluate(() => (window as unknown as TownHooks).__townGlide?.("bigboy"));
    expect(at).not.toBeNull();
    const cv = (await page.locator("canvas.town-canvas").boundingBox())!;
    await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  rec.mark("card");
  await expect.poll(async () => (await you())?.moving, { timeout: 30_000 }).toBe(false);
  await page.waitForTimeout(600);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  await page.waitForTimeout(700);
  rec.mark("confirm");
  await page.getByRole("dialog", { name: "Challenge Big Boy?" }).getByRole("button", { name: "Fight" }).click();
  rec.mark("fight");
  await expect(page.locator("canvas.town-shop-canvas")).toHaveAttribute("data-room", "bigboy", { timeout: 30_000 });
  rec.mark("room");
  const steps = new Set<string>();
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    const s = await page.evaluate(() => (window as unknown as TownHooks).__shopIntro?.()?.step ?? null);
    const m = await page.evaluate(() => (window as any).match?.phase?.kind ?? null);
    if (s && !steps.has(s)) {
      steps.add(s);
      rec.mark(`intro:${s}`);
    }
    if (m && !steps.has(`match:${m}`)) {
      steps.add(`match:${m}`);
      rec.mark(`match:${m}`);
      if (m === "play" || m === "boss") break;
    }
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(3500);
  rec.mark("end");
  await rec.stop();
});

/** Both players queue in their own pool and meet; the vote; then a known opening, played with taps from both sides. */
async function rankedPlayer(browser: Browser, name: string, rank: string) {
  const ctx = await browser.newContext({ ...test.info().project.use });
  const page = await ctx.newPage();
  await setUp(page, name);
  await asAdmin(page);
  await page.goto(`/?nolanding&rank=${rank}`);
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  return page;
}

test("ranked", async ({ browser }) => {
  test.setTimeout(150_000);
  // Scene 3: a ranked 1 v 1 between two players (two pages), recorded from one: the stage, the vote, a quick opening.
  const a = await rankedPlayer(browser, "Hunter", "gold-2");
  const b = await rankedPlayer(browser, "Knightowl", "gold-3");
  const pool = `reel${Math.random().toString(36).slice(2, 8)}`;
  // (Both players' views are recorded until the board is up; the one playing White is kept: the board the right way up.)
  const recA = await recorder(a, "ranked-a");
  const recB = await recorder(b, "ranked-b");
  const both = (name: string) => [recA, recB].forEach((r) => r.mark(name));
  await a.goto(`/1v1?nolanding&debug&pool=${pool}&rank=gold-2`);
  both("search");
  await b.goto(`/1v1?nolanding&debug&pool=${pool}&rank=gold-3`);
  for (const p of [a, b]) await expect(p.locator(".dv-versus .dv-st-them .dv-st-pawn")).toBeVisible({ timeout: 30_000 });
  both("versus");
  for (const p of [a, b]) await expect(p.locator(".dv-vote")).toBeVisible({ timeout: 15_000 });
  both("vote");
  await a.waitForTimeout(800);
  for (const p of [a, b]) {
    await p.locator(".vote-me").click();
    await p.getByRole("button", { name: "Pick Blitz 3+2" }).click();
  }
  for (const p of [a, b]) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 20_000 });
  both("play");
  const side = async (p: Page) => (await p.locator(".dv-strip.dv-you").getAttribute("data-side")) as "w" | "b";
  const white = (await side(a)) === "w" ? a : b;
  const black = white === a ? b : a;
  const rec = white === a ? recA : recB;
  await (white === a ? recB : recA).drop();
  const squareAt = async (p: Page, sq: string) => {
    const box = (await p.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
    const w = (await side(p)) === "w";
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    const col = w ? f : 7 - f;
    const row = w ? 7 - r : r;
    return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
  };
  const line = ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6", "c1e3", "e7e5"];
  for (const [i, uci] of line.entries()) {
    const p = i % 2 === 0 ? white : black;
    await p.waitForTimeout(500 + Math.random() * 700);
    const from = await squareAt(p, uci.slice(0, 2));
    const to = await squareAt(p, uci.slice(2, 4));
    await p.mouse.click(from.x, from.y);
    await p.waitForTimeout(120);
    await p.mouse.click(to.x, to.y);
    rec.mark(`move${i + 1}`);
  }
  await a.waitForTimeout(1500);
  rec.mark("end");
  await rec.stop("ranked");
});

test("hidden", async ({ page }) => {
  // Scene 4: the Hidden Boss, pixel art (hidden-boss.ts) on the app's own page (its fonts), its loop recorded as the others.
  await page.goto("/?nolanding");
  await page.waitForTimeout(1000);
  await page.evaluate(drawHiddenBoss);
  const rec = await recorder(page, "hidden");
  rec.mark("start");
  await page.waitForTimeout(7000);
  rec.mark("end");
  await rec.stop();
});

test("captions", async ({ page }) => {
  // The captions: one see-through picture each, 600 px wide (the reel's width), in the game's pixel font.
  mkdirSync(`${OUT}/captions`, { recursive: true });
  await page.setViewportSize({ width: 300, height: 538 });
  await page.goto("/?nolanding");
  await page.waitForTimeout(800);
  for (const [i, text] of [...REEL_CAPTIONS, HIDDEN_BOSS_CAPTION].entries()) {
    await page.evaluate((t) => {
      document.body.innerHTML = "";
      document.documentElement.style.background = "transparent";
      document.body.style.cssText = "margin:0;background:transparent";
      const d = document.createElement("div");
      d.id = "cap";
      d.style.cssText =
        "position:absolute;left:0;right:0;top:0;padding:10px 12px;font:12px/1.7 'Press Start 2P',monospace;text-align:center;color:#f4b740;" +
        "text-shadow:2px 0 0 #1a1406,-2px 0 0 #1a1406,0 2px 0 #1a1406,0 -2px 0 #1a1406,2px 2px 0 #1a1406;" +
        "background:rgba(14,15,19,0.78);border-top:2px solid #f4b740;border-bottom:2px solid #f4b740;white-space:pre-line";
      d.textContent = t;
      document.body.append(d);
    }, text);
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#cap").screenshot({ path: `${OUT}/captions/c${i + 1}.png`, omitBackground: true });
  }
});
