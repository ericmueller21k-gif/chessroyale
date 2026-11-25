import { expect, type Browser, type Page } from "@playwright/test";
import { RANKED_1V1, rankView } from "@chessroyale/core";
import { BOARD_SEL, REAL_SCREENS, asSignedIn, endGaps, named, realLayout, realScreenContext, test, watchFor, watchSpans } from "./helpers.ts";

/**
 * Ranked 1 v 1 through the real server (docs/areas/ranked.md), two players on emulated phones (and computers): both
 * queue (one tap: /1v1, as the home screen's button), meet, vote on the time control on the game's own board (a real
 * drag, a tap and a tap), see "Timer: …" over it, and play to a result with real taps on the board: checkmate,
 * resigning, flagging. Ranks move (placements). Also: a first move that never comes aborts as a dodge (ranked's leave
 * rules, L1: the one who didn't move pays, the other nothing), leaving during the vote (the confirm's words, home's note), and
 * the no-opponent fallback (Keep waiting; Play a bot, unranked). Each test queues in a pool of its own (`?pool=`, a
 * test switch), so tests never meet; `clock=` (each side's seconds, a test switch) makes a flag quick, and `fewAfter=`
 * brings the "Few players online" choice forward.
 */

const isComputer = () => test.info().project.name === "desktop";

/** This test's players, by name: on a failure, each one's game and breadcrumbs go into the report. */
let players: [string, Page][] = [];
test.beforeEach(() => {
  players = [];
});

/**
 * A failure's report keeps each player's `window.duel.snapshot()` (the game as that page holds it) and the app's breadcrumbs
 * (`1v1 move e2e4`: a move the page sent), so a lost move shows which side lost it (docs/decisions/2026-11-20-duel-flake-diagnostics.md).
 */
test.afterEach(async ({}, info) => {
  if (info.status === info.expectedStatus) return;
  for (const [name, page] of players) {
    const state = await Promise.race([
      page
        .evaluate(() => {
          const w = window as unknown as { duel?: { snapshot(): unknown } | null; __crumbs?: () => string[] };
          return { at: Date.now(), url: location.href, duel: w.duel?.snapshot() ?? null, crumbs: w.__crumbs?.() ?? null };
        })
        .catch((e: unknown) => ({ error: String(e) })),
      new Promise((r) => setTimeout(() => r({ error: "no answer in 5 s" }), 5000)),
    ]);
    await info.attach(`duel state: ${name}`, { body: JSON.stringify(state, null, 2), contentType: "application/json" });
  }
});

async function player(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  players.push([name, page]);
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  return page;
}

/** Eric's spacing rule on an end page (Nov 25): every gap between two containers the stack's one gap, to 2 px; nothing set to stretch. */
async function expectEvenGaps(page: Page, root: string, at: string) {
  const g = await endGaps(page, root);
  expect(g.token, `${at}: the stack's gap`).toBeGreaterThanOrEqual(8);
  for (const x of g.gaps) expect(Math.abs(x.px - g.token), `${at}: ${x.between}: ${x.px.toFixed(1)} px, not the one gap (${g.token} px)`).toBeLessThanOrEqual(2);
  expect(g.spread, `${at}: nothing spread apart`).toEqual([]);
  expect(g.grow, `${at}: nothing grows to fill`).toEqual([]);
}

/** A pool of this test's own. */
const poolName = () => `d${test.info().project.name.slice(0, 1)}${Math.random().toString(36).slice(2, 9)}`;

/** Your standing with ranked's leave rules, from the server (your profile). */
const leavesOf = (page: Page) => page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.leaves as { marks: number; dodged: { rp: number } | null } | null));

/** Your 1 v 1 record, from the server (your profile). */
const record = (page: Page) => page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.ranked1v1 as { games: number; wins: number; losses: number; draws: number; rank: { label: string } }));

/** Which side this page plays (its own strip says). */
const sideOf = async (page: Page) => (await page.locator(".dv-strip.dv-you").getAttribute("data-side")) as "w" | "b";

/** A square's center on screen, from this page's side. */
async function squareAt(page: Page, square: string): Promise<{ x: number; y: number }> {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const white = (await sideOf(page)) === "w";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = white ? f : 7 - f;
  const row = white ? 7 - r : r;
  return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
}

/** A move by two taps on the board, as a player makes it. */
async function tapMove(page: Page, uci: string) {
  const a = await squareAt(page, uci.slice(0, 2));
  const b = await squareAt(page, uci.slice(2, 4));
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

/**
 * Each page's game is on its board (the vote, the "Timer" line or play) and not over: a state that lasts from the vote to the
 * result. (The versus moment lasts 2.5 s and the vote up to 10: a test process slowed for longer missed them, the page went on, and the
 * wait timed out on a game that was fine. The versus moment has its own test, "the stage", below.)
 */
async function inGame(pages: Page[], timeout = 30_000) {
  for (const p of pages)
    await expect
      .poll(
        () =>
          p
            .evaluate(() => {
              const s = (window as unknown as { duel?: { snapshot(): { phase: string; end: unknown } } | null }).duel?.snapshot();
              return s && !s.end ? s.phase : null;
            })
            .catch(() => null),
        { timeout },
      )
      .toMatch(/^(vote|overlay|play)$/);
}

/** Both players queue in `pool` and meet: their game on the board (from the vote on). */
async function meet(a: Page, b: Page, pool: string, extra = "") {
  await a.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  await b.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  await inGame([a, b]);
}

/** The two players by side, once the board is up. */
async function bySide(a: Page, b: Page): Promise<{ white: Page; black: Page }> {
  return (await sideOf(a)) === "w" ? { white: a, black: b } : { white: b, black: a };
}

/** Waits for play: the overlay gone, the first move due. */
async function waitForPlay(...pages: Page[]) {
  for (const p of pages) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 25_000 });
}

/** Resign (or Leave: an abort) from the match's gear and its list, on a phone or a computer; then confirm. */
async function resign(page: Page, word: "Resign" | "Leave" = "Resign", says?: string) {
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: new RegExp(word) }).click();
  // (The confirm's words: what going now costs in a ranked game, L1.)
  if (says) await expect(page.getByRole("alertdialog")).toContainText(says);
  await page.getByRole("alertdialog").getByRole("button", { name: word }).click();
}

import { writeFileSync as __w } from "node:fs";
const GEOM = () => {
  const r = (q: string) => { const e = [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0); if (!e) return null; const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(2), r: +b.right.toFixed(2), t: +b.top.toFixed(2), b: +b.bottom.toFixed(2) }; };
  return { win: [innerWidth, innerHeight], labels: document.querySelector(".gm-frame")?.classList.contains("gm-labels"), frame: r(".gm-frame"), menu: r(".gm-frame > .fd-side"), screen: r(".screen.game"), area: r(".board-area"),
    wrap: r(".board-area .board-row > .board-wrap"), board: r(".board-area .board-row > .board-wrap .hb-container"), them: r(".dv-strip.dv-them"), you: r(".dv-strip.dv-you"), side: r(".dv-side"), box: r(".dv-side > .dv-box"), col: r(".dv-end-col"), chat: r(".dv-box > .dv-chat"), actions: r(".dv-actions"), gear: r(".dv-gear") };
};
const SZ = [{ name: "laptop 1536x730", width: 1536, height: 730, scale: 1.25 }, { name: "desktop 1920x960", width: 1920, height: 960, scale: 1 }, { name: "desktop 1858x1040", width: 1858, height: 1040, scale: 1 }, { name: "laptop 1280x600", width: 1280, height: 600, scale: 1.5 }, { name: "laptop 1366x650", width: 1366, height: 650, scale: 1 }];
test("geom", async ({ browser }) => {
  test.setTimeout(8 * 60_000);
  const out: Record<string, unknown> = {};
  for (const s of SZ) {
    const open = async (name: string) => {
      const page = await (await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale, isMobile: false, hasTouch: false })).newPage();
      players.push([name, page]);
      await named(page, name);
      await page.goto("/?nolanding");
      await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
      return page;
    };
    const a = await open(`Ann ${s.width}`);
    const b = await open(`Bo ${s.width}`);
    await meet(a, b, poolName());
    await waitForPlay(a, b);
    const { white, black } = await bySide(a, b);
    await tapMove(white, "e2e4");
    await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
    await tapMove(black, "e7e5");
    await expect(white.locator(".dv-status")).toHaveText("Your move", { timeout: 10_000 });
    await white.waitForTimeout(500);
    const play = await white.evaluate(GEOM);
    if (process.env.SHOTS) await white.screenshot({ path: `${process.env.PROBE_OUT}/duel-play-${s.width}x${s.height}.png` });
    await resign(white);
    await expect(white.getByTestId("es-quests")).toHaveText("Quests No quests this game.", { timeout: 15_000 });
    await white.waitForTimeout(800);
    const end = await white.evaluate(GEOM);
    if (process.env.SHOTS) await white.screenshot({ path: `${process.env.PROBE_OUT}/duel-end-${s.width}x${s.height}.png` });
    out[s.name] = { play, end };
    for (const p of [a, b]) await p.context().close();
  }
  __w(`${process.env.PROBE_OUT}/duelgeom.json`, JSON.stringify(out, null, 1));
});
