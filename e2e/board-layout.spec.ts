import { devices, expect, type Browser, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, bossAloneFromHome, engineTop, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * The boss battle's board screen (Eric, Oct 25; docs/decisions/2026-10-25-board-layout.md):
 * - a phone: under the "Your move" row one strip, the God King at its far right, the panel to his left (Boss alone: the
 *   moves; a raid: "Players" / "Moves"), the board no smaller than before, the page never scrolling; a tap opens the panel
 *   full size over the board, with a ✕ that closes it;
 * - a computer: Boss alone has no scoreboard; a raid's is where it was; the moves right of the board, clear of the board and
 *   the God King;
 * - both: one row per move with its piece, square and capture; the "Your move" row one line tall.
 * (Babur's pump against the move list: tiger.spec.ts, which counts `.mv-side` among what the pump must stay off.)
 *
 * Eric, Oct 28 (docs/decisions/2026-10-28-your-pawn-on-board.md):
 * - Boss alone: your own pawn beside the God King, about his size, on his line: left of him in a phone's strip (the panel gives
 *   up its width), by the board's corner on a computer with him to its right; it bobs, and hops as your move lands; a raid has
 *   none (not yet);
 * - a computer's move list: its top level with the board's, half its old height, the same width, 12 to 16 px from the board;
 *   what's under it in the column moves up with it;
 * - the board's box is main's at every size (Oct 29: the new sizes by the window's height; desktop-board.spec.ts checks every
 *   board screen).
 */

/** Measured on main before this change (3cf8aba0), Boss alone and a Solo raid alike: the board's width on a phone. */
const MAIN_BOARD: Record<string, number> = { "390x844": 312, "360x640": 282.7, "320x568": 237.3 };
/**
 * …the raid's scoreboard beside the board on a computer (x, y, width; its height the window's). Since Oct 29 the screen beside it
 * grows with the board (docs/decisions/2026-10-29-desktop-board-size.md), so the two together sit further left where the board
 * is bigger: 1440 × 900 x 40 → 10, 1920 × 1080 x 280 → 118; 1280 × 800 as before.
 */
const MAIN_TOWER: Record<string, { x: number; y: number; w: number }> = {
  // (Nov 1: the side menu sits left of the screens, so the scoreboard moved right by its width: 1280 × 800 x 10 → 90, 1920 × 1080
  // x 118 → 242.)
  "1280x800": { x: 90, y: 0, w: 360 },
  "1440x900": { x: 10, y: 0, w: 360 },
  "1920x1080": { x: 242, y: 0, w: 360 },
};
/** …and the "Your move" row's height (two lines' room). */
const MAIN_ROW_H = 62;
/**
 * Boss alone: the board's box on a computer (x, y, width = height). Measured on main before the pawn (b9712062); since Oct 29
 * sized by the window's height (docs/decisions/2026-10-29-desktop-board-size.md); since Nov 1 (docs/decisions/2026-11-01-game-screens-computer.md:
 * no title line, the bar at the top, the side menu beside the screen, the room 123 px), old → new: 1280 × 800 264, 600 → 344, 520;
 * 1440 × 900 294, 696 → 496, 528; 1536 × 864 360, 664 → 496, 624; 1920 × 1080 444, 880 → 521.5, 952; 1024 × 768 96, 464 → 176, 384
 * (the side menu's 80 px). The top is the bar's: y 121.3 → 63.2.
 */
const MAIN_BOARD_BOX: Record<string, { x: number; y: number; w: number }> = {
  "1280x800": { x: 344, y: 63.2, w: 520 },
  "1440x900": { x: 496, y: 63.2, w: 528 },
  "1536x864": { x: 496, y: 63.2, w: 624 },
  "1920x1080": { x: 521.5, y: 63.2, w: 952 },
  "1024x768": { x: 176, y: 63.2, w: 384 },
};
/** A raid's board box at 1280 × 800 (its scoreboard beside it keeps the board width-bound there: main's, before and after Oct 29). */
const RAID_BOARD_BOX: Record<string, { x: number; y: number; w: number }> = { "1280x800": { x: 488, y: 63.2, w: 376 } };
/** …and the move list's height, twice: the board's half less 73 px, at least 120 px (styles.css, `--mv-h`; Nov 1: a smaller board). */
const mainSideH = (board: number) => Math.max(240, board - 146);

const SHOTS = process.env.LAYOUT_SHOTS;
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

async function open(browser: Browser, w: number, h: number) {
  const ctx = await browser.newContext(w < 900 ? { ...devices["iPhone 13"], viewport: { width: w, height: h } } : { viewport: { width: w, height: h } });
  return { ctx, page: await ctx.newPage() };
}

/** Into the battle, at your first move (Ginger; a minute a move). A raid: a Solo raid, you and the bots. */
async function into(page: Page, raid: boolean) {
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&boss=gingerbread");
  if (raid) {
    await openBossRaid(page);
    await page.getByRole("button", { name: /^Raid with bots/ }).click();
  } else await bossAloneFromHome(page);
  await yourMove(page);
}

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(300);
}

/** `n` moves of yours (the engine's best, so a raid's strike doesn't take you), each with the boss's reply. */
async function play(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await yourMove(page);
    const { fen, top } = await engineTop(page);
    const allowed = await page.evaluate(() => ((window as any).match.runner.crowdAllowed() ?? null) as string[] | null);
    const move = top.map((t) => t.move).find((x) => !allowed || allowed.includes(x)) ?? allowed?.[0] ?? top[0]?.move;
    await submitMove(page, move, fen);
    await expect.poll(() => phase(page), { timeout: 15_000 }).not.toBe("play");
  }
  await yourMove(page);
}

type Box = { x: number; y: number; r: number; b: number };
const boxes = (page: Page) =>
  page.evaluate((sel) => {
    const r = (s: string): Box | null => {
      const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.left, y: b.top, r: b.right, b: b.bottom };
    };
    return {
      board: r(`.board-area .board-row > .board-wrap ${sel}`),
      row: r(".boss-dock-main"),
      text: r(".boss-dock-status .dk-text"),
      king: r(".boss-dock .gk-unit"),
      pawn: r(".boss-dock .you-pawn"),
      panel: r(".boss-dock .dk-panel"),
      side: r(".mv-side"),
      tower: r(".tower-side"),
      mini: r(".mini-tower"),
      scroll: document.documentElement.scrollHeight - innerHeight,
      sideways: document.documentElement.scrollWidth - innerWidth,
    };
  }, BOARD_SEL.container);

const overlap = (a: Box, b: Box) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;

/**
 * The God King's words never cover the panel's switch (the director's review of #347: "he talks a lot, including right at
 * the start"): while his words are up, each tab's center is the tab for a tap, and the words' box is clear of the switch's
 * row; each tab still switches. (He speaks as your first move begins: watched for, then measured while it's up.)
 */
async function switchUnderHisWords(page: Page, at: string, shot: string) {
  const words = page.locator(".dk-strip .gk-bubble:not(.leaving)");
  await expect(words, `${at}: his words`).toBeVisible({ timeout: 30_000 });
  const look = () =>
    page.evaluate(() => {
      const row = document.querySelector(".dk-panel .bp-tabs")!.getBoundingClientRect();
      const w = document.querySelector(".dk-strip .gk-bubble")?.getBoundingClientRect() ?? null;
      const tabs = [...document.querySelectorAll<HTMLElement>(".dk-panel .bp-tab")].map((t) => {
        const r = t.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { name: t.textContent, hit: !!hit && (hit === t || t.contains(hit)) };
      });
      const clear = !w || w.bottom <= row.top + 0.5 || w.top >= row.bottom - 0.5 || w.right <= row.left + 0.5 || w.left >= row.right - 0.5;
      return { up: !!w, tabs, clear, row: [row.top, row.bottom], words: w && [w.top, w.bottom, w.left, w.right] };
    });
  const seen = await look();
  expect(seen.up, `${at}: his words still up`).toBe(true);
  expect(seen.tabs.length, at).toBeGreaterThanOrEqual(2);
  for (const t of seen.tabs) expect(t.hit, `${at}: the ${t.name} tab takes a tap under his words: ${JSON.stringify(seen)}`).toBe(true);
  expect(seen.clear, `${at}: his words clear of the switch: ${JSON.stringify(seen)}`).toBe(true);
  // Each tab switches while he speaks.
  const tabs = page.locator(".dk-panel").getByRole("tab");
  await tabs.filter({ hasText: "Moves" }).click();
  await expect(page.locator(".dk-panel .mv-box")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${shot}-moves.png` });
  await tabs.filter({ hasText: "Players" }).click();
  await expect(page.locator(".dk-panel .bp-tower")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${shot}-players.png` });
  expect((await look()).clear, `${at}: still clear`).toBe(true);
}

test("a phone: the God King at the strip's right edge, the panel to his left, the board as big as before, no scrolling; Players / Moves in a raid, the moves alone in Boss alone; a tap opens it over the board, ✕ and Escape close it", async ({ browser }) => {
  test.skip(test.info().project.name !== "phone", "it opens its own phones");
  test.setTimeout(12 * 60_000);
  for (const raid of [false, true]) {
    for (const size of ["390x844", "360x640", "320x568"]) {
      const [w, h] = size.split("x").map(Number) as [number, number];
      const at = `${raid ? "raid" : "alone"} ${size}`;
      const { ctx, page } = await open(browser, w, h);
      await into(page, raid);
      if (raid && size !== "360x640") await switchUnderHisWords(page, at, size === "390x844" ? "phone-raid-bubble" : "phone-raid-bubble-320");
      const b = await boxes(page);
      expect(b.board && b.row && b.king && b.panel, at).toBeTruthy();
      const { board, row, king, panel } = { board: b.board!, row: b.row!, king: b.king!, panel: b.panel! };
      // The board no smaller than on main.
      expect(board.r - board.x, `${at}: the board's width`).toBeGreaterThanOrEqual(MAIN_BOARD[size]! - 0.5);
      // The strip under the row: the God King at its right edge (the board's), the panel to his left, side by side.
      expect(king.y, `${at}: he's under the row`).toBeGreaterThanOrEqual(row.b);
      expect(Math.abs(king.r - board.r), `${at}: he's at the right edge`).toBeLessThanOrEqual(1);
      expect(panel.y, `${at}: the panel under the row`).toBeGreaterThanOrEqual(row.b);
      expect(Math.abs(panel.x - board.x), `${at}: the panel from the left edge`).toBeLessThanOrEqual(1);
      expect(panel.r, `${at}: the panel left of him`).toBeLessThanOrEqual(king.x);
      expect(overlap(panel, king), at).toBe(false);
      expect(panel.b - panel.y, `${at}: the panel at least his height`).toBeGreaterThanOrEqual(king.b - king.y);
      expect(panel.b, `${at}: inside the screen`).toBeLessThanOrEqual(h);
      // Your pawn (Boss alone only, Oct 28): between the panel and him, his size, on his line, nothing over it; a raid has none yet.
      if (raid) expect(b.pawn, `${at}: no pawn in a raid`).toBeNull();
      else {
        const pawn = b.pawn!;
        expect(pawn, `${at}: your pawn`).toBeTruthy();
        expect(Math.abs(pawn.r - king.x), `${at}: just left of him`).toBeLessThanOrEqual(1);
        expect(Math.abs(pawn.r - pawn.x - (king.r - king.x)), `${at}: his width`).toBeLessThanOrEqual(1);
        expect(Math.abs(pawn.b - pawn.y - (king.b - king.y)), `${at}: his height`).toBeLessThanOrEqual(1);
        expect(Math.abs(pawn.y - king.y), `${at}: on his line`).toBeLessThanOrEqual(1);
        expect(panel.r, `${at}: the panel left of your pawn`).toBeLessThanOrEqual(pawn.x + 1);
        expect(overlap(panel, pawn) || overlap(pawn, king) || overlap(pawn, row), `${at}: your pawn over nothing`).toBe(false);
        expect(pawn.y, `${at}: under the row`).toBeGreaterThanOrEqual(row.b);
        expect(pawn.x, `${at}: inside the screen`).toBeGreaterThanOrEqual(0);
        // (Drawn in the crowd's color, as the list's rows are.)
        const side = await page.evaluate(() => (window as any).match.boss.crowdSide as string);
        await expect(page.locator(".you-pawn piece")).toHaveClass(new RegExp(side === "w" ? "white" : "black"));
      }
      // The page never scrolls; no scoreboard under the board but the panel's.
      expect(b.scroll, `${at}: no scrolling`).toBeLessThanOrEqual(0);
      expect(b.sideways, at).toBeLessThanOrEqual(0);
      expect(b.mini, `${at}: the old scoreboard`).toBeNull();
      // The switch: in a raid, "Players" (the scoreboard) and "Moves" in the same box; alone, none.
      const tabs = page.locator(".dk-panel").getByRole("tab");
      if (raid) {
        await expect(tabs).toHaveText(["Players", "Moves"]);
        await expect(page.locator(".dk-panel .bp-tower .tower-row.you")).toBeVisible();
        await tabs.filter({ hasText: "Moves" }).click();
        await expect(page.locator(".dk-panel .mv-box")).toBeVisible();
        expect((await boxes(page)).panel, `${at}: the same box with the moves`).toEqual(panel);
        if (SHOTS && size === "390x844") await page.screenshot({ path: `${SHOTS}/phone-raid-moves.png` });
        await tabs.filter({ hasText: "Players" }).click();
        await expect(page.locator(".dk-panel .bp-tower")).toBeVisible();
        expect((await boxes(page)).panel, `${at}: the same box with the players`).toEqual(panel);
        if (SHOTS && size === "390x844") await page.screenshot({ path: `${SHOTS}/phone-raid-players.png` });
      } else {
        await expect(tabs).toHaveCount(0);
        await expect(page.locator(".dk-panel .mv-box")).toBeVisible();
        if (SHOTS && size === "390x844") await page.screenshot({ path: `${SHOTS}/phone-alone-panel.png` });
      }
      // A tap: full size over the board, ✕ at its top right closes it; again, then Escape.
      const sheet = page.getByRole("dialog", { name: raid ? "Leaderboard" : "Moves" });
      await page.locator(".dk-panel .bp-body > *").first().click();
      await expect(sheet).toBeVisible();
      const s = (await sheet.boundingBox())!;
      expect(s.y, `${at}: over the board's top`).toBeLessThanOrEqual(board.y + 1);
      expect(s.y + s.height, `${at}: down past the board`).toBeGreaterThanOrEqual(board.b);
      expect(s.y + s.height, `${at}: inside the screen`).toBeLessThanOrEqual(h);
      const x = (await sheet.getByRole("button", { name: "Close" }).boundingBox())!;
      expect(x.x + x.width, `${at}: ✕ at the right`).toBeGreaterThan(s.x + s.width - 60);
      expect(x.y, `${at}: ✕ at the top`).toBeLessThan(s.y + 50);
      if (SHOTS && size === "390x844") await page.screenshot({ path: `${SHOTS}/phone-${raid ? "raid" : "alone"}-open.png` });
      await sheet.getByRole("button", { name: "Close" }).click();
      await expect(sheet).toHaveCount(0);
      await page.locator(".dk-panel .bp-body > *").first().click();
      await expect(sheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      expect((await boxes(page)).scroll, at).toBeLessThanOrEqual(0);
      await ctx.close();
    }
  }
});

test("a computer: Boss alone has no scoreboard and your pawn left of the God King by the board's corner; a raid's is where it was; the moves right of the board, from its top, half as tall, a small gap off it; the board's box main's", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "it opens its own windows");
  test.setTimeout(15 * 60_000);
  const runs = [
    ...["1280x800", "1440x900", "1536x864", "1920x1080", "1024x768"].map((size) => ({ raid: false, size })),
    ...["1280x800", "1920x1080", "1024x768"].map((size) => ({ raid: true, size })),
  ];
  for (const { raid, size } of runs) {
    const [w, h] = size.split("x").map(Number) as [number, number];
    const at = `${raid ? "raid" : "alone"} ${size}`;
    const { ctx, page } = await open(browser, w, h);
    await into(page, raid);
    const b = await boxes(page);
    expect(b.board && b.king && b.side, at).toBeTruthy();
    if (raid) {
      // The scoreboard on the left (a column beside the board from 900 to 1099 px), the same box as on main.
      if (size !== "1024x768") {
        const t = b.tower!;
        expect(t, `${at}: the scoreboard`).toBeTruthy();
        const m = MAIN_TOWER[size]!;
        for (const [k, v] of [["x", t.x - m.x], ["y", t.y - m.y], ["width", t.r - t.x - m.w], ["height", t.b - t.y - h]] as const) expect(Math.abs(v), `${at}: the scoreboard's ${k}`).toBeLessThanOrEqual(1);
      } else expect(b.mini, `${at}: the scoreboard under the moves`).toBeTruthy();
      expect(b.pawn, `${at}: no pawn in a raid`).toBeNull();
    } else {
      expect(b.tower, `${at}: no scoreboard on the left`).toBeNull();
      expect(b.mini, `${at}: nor in the column`).toBeNull();
    }
    const { board, king, side } = { board: b.board!, king: b.king!, side: b.side! };
    // The board is exactly where and as big as on main.
    // (A raid at 1280 × 800: its own box, main's, unchanged since its scoreboard leaves the board width-bound. It was checked
    // against Boss alone's, the same box until Oct 29, when Boss alone's grew.)
    const main = raid ? RAID_BOARD_BOX[size]! : MAIN_BOARD_BOX[size]!;
    if (!raid || size === "1280x800") for (const [k, v] of [["x", board.x - main.x], ["y", board.y - main.y], ["width", board.r - board.x - main.w], ["height", board.b - board.y - main.w]] as const) expect(Math.abs(v), `${at}: the board's ${k}`).toBeLessThanOrEqual(1);
    // The moves: from the board's top, half as tall as they were, the column's width, a small gap off the board; over nothing.
    // (Nov 1: the column's ⚡, fish and gear sit at the board's top, the list 36 px under them.)
    expect(Math.abs(side.y - board.y - 36), `${at}: 36 px under the board's top, the tools above`).toBeLessThanOrEqual(1);
    expect(side.x - board.r, `${at}: a small gap off the board`).toBeGreaterThanOrEqual(12);
    expect(side.x - board.r, `${at}: a small gap off the board`).toBeLessThanOrEqual(16.5);
    expect(Math.abs(side.r - side.x - 340), `${at}: the same width`).toBeLessThanOrEqual(1);
    expect(Math.abs(side.b - side.y - mainSideH(board.r - board.x) / 2), `${at}: half the height`).toBeLessThanOrEqual(2);
    expect(side.b - side.y, `${at}: room for rows`).toBeGreaterThanOrEqual(120);
    expect(side.b, `${at}: above the God King`).toBeLessThanOrEqual(king.y);
    expect(overlap(side, board), at).toBe(false);
    expect(overlap(side, king), at).toBe(false);
    expect(side.r, `${at}: inside the window`).toBeLessThanOrEqual(w);
    // What's under the moves in the column moves up with them (a raid's scoreboard from 900 to 1099 px).
    if (b.mini) expect(Math.abs(b.mini.y - side.b - 12), `${at}: the scoreboard under the moves`).toBeLessThanOrEqual(1);
    if (!raid) {
      // Your pawn: right of the board, by it, standing on the God King's line, he to its right, about his size. (As far from the
      // board as the boss is on its other side: 26 px, the director's --bs-out keeps that without the eval bar too.)
      const pawn = b.pawn!;
      expect(pawn, `${at}: your pawn`).toBeTruthy();
      expect(pawn.x - board.r, `${at}: clear of the board as the boss is`).toBeGreaterThanOrEqual(24);
      expect(pawn.x - board.r, `${at}: by the board`).toBeLessThanOrEqual(32);
      expect(Math.abs(pawn.b - king.b), `${at}: on his line`).toBeLessThanOrEqual(1);
      expect(Math.abs(pawn.r - pawn.x - (king.r - king.x)), `${at}: his width`).toBeLessThanOrEqual(1);
      expect(Math.abs(pawn.b - pawn.y - (king.b - king.y)), `${at}: his height`).toBeLessThanOrEqual(1);
      expect(king.x, `${at}: the God King to its right`).toBeGreaterThanOrEqual(pawn.r - 1);
      expect(king.x - pawn.r, `${at}: beside it`).toBeLessThanOrEqual(8);
      expect(pawn.b, `${at}: the board's bottom line`).toBeLessThanOrEqual(b.row!.b);
      expect(king.r, `${at}: inside the window`).toBeLessThanOrEqual(w);
      expect(side.b, `${at}: the moves above your pawn`).toBeLessThanOrEqual(pawn.y);
      expect(overlap(pawn, board) || overlap(pawn, side) || overlap(pawn, king) || overlap(pawn, b.row!), `${at}: your pawn over nothing`).toBe(false);
      // His words open above him: clear of your pawn and of the board (they can reach up over the end of the list, never the other way).
      const words = page.locator(".boss-dock .gk-bubble:not(.leaving)");
      if (await words.isVisible()) {
        const v = (await words.boundingBox())!;
        expect(v.y + v.height, `${at}: his words above him`).toBeLessThanOrEqual(king.y + 8);
        expect(overlap({ x: v.x, y: v.y, r: v.x + v.width, b: v.y + v.height }, pawn), `${at}: his words clear of your pawn`).toBe(false);
        expect(v.x, `${at}: his words right of the board`).toBeGreaterThanOrEqual(board.r);
      }
    } else expect(king.x - board.r, `${at}: the God King where he was`).toBeLessThanOrEqual(30);
    expect(b.scroll, at).toBeLessThanOrEqual(0);
    if (SHOTS && size === "1280x800") {
      await play(page, 2);
      await page.screenshot({ path: `${SHOTS}/computer-${raid ? "raid" : "alone"}.png` });
    }
    await ctx.close();
  }
});

test("no eval bar (every player's board): your pawn is as far from the board as the boss is on its other side, and the list is still a small gap off the board", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "it opens its own windows");
  test.setTimeout(6 * 60_000);
  for (const size of ["1280x800", "1920x1080"]) {
    const [w, h] = size.split("x").map(Number) as [number, number];
    const { ctx, page } = await open(browser, w, h);
    await page.addInitScript(() => localStorage.setItem("brc.evalBar", "0"));
    await into(page, false);
    await expect(page.locator(".eval-bar")).toHaveCount(0);
    const g = await page.evaluate(() => {
      const r = (s: string) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return { x: b.left, r: b.right, w: b.width };
      };
      return { wrap: r(".board-area .board-row > .board-wrap"), board: r(".board-area .board-row > .board-wrap .hb-container"), pawn: r(".boss-dock .you-pawn"), boss: r(".boss-char.place-side"), king: r(".boss-dock .gk-unit"), side: r(".mv-side") };
    });
    const at = `no eval bar ${size}`;
    // (The mirror, middle to middle, as boss-character.spec.ts checks it with the eval bar: the boss stands 24 px further out then.)
    expect(Math.abs(g.pawn.x + g.pawn.w / 2 - g.wrap.r - (g.wrap.x - (g.boss.x + g.boss.w / 2))), `${at}: your pawn's middle as far from the board as the boss's`).toBeLessThanOrEqual(2);
    expect(g.pawn.x - g.board.r, `${at}: as clear of the board as with the bar`).toBeGreaterThanOrEqual(24);
    expect(g.pawn.x - g.board.r, `${at}: as clear of the board as with the bar`).toBeLessThanOrEqual(32);
    expect(g.king.x, `${at}: the God King to its right`).toBeGreaterThanOrEqual(g.pawn.r - 1);
    expect(g.side.x - g.board.r, `${at}: the list a small gap off the board`).toBeGreaterThanOrEqual(12);
    expect(g.side.x - g.board.r, `${at}: the list a small gap off the board`).toBeLessThanOrEqual(16.5);
    await ctx.close();
  }
});

test("your pawn: it bobs all the time (a transform), hops once as your move lands and not for the boss's, and keeps still under reduced motion", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  test.setTimeout(5 * 60_000);
  await into(page, false);
  const pawn = page.locator(".you-pawn");
  await expect(pawn).toBeVisible();
  const names = (sel: string) => page.evaluate((s) => document.querySelector(s)!.getAnimations().map((a) => (a as CSSAnimation).animationName), sel);
  // The idle: a running animation, and its transform really changes.
  expect(await names(".you-pawn-bob")).toEqual(["you-bob"]);
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    seen.add(await page.evaluate(() => getComputedStyle(document.querySelector(".you-pawn-bob")!).transform));
    await page.waitForTimeout(200);
  }
  expect(seen.size, "the bob moves").toBeGreaterThan(2);
  // No hop before your move. Then your move lands: the hop, once, on whichever screen's dock stands then.
  expect(await names(".you-pawn-hop")).toEqual([]);
  const { fen, top } = await engineTop(page);
  // (As the move goes in and shows on the board, not later when the boss answers.)
  const hop = page.waitForFunction(() => document.querySelector(".you-pawn-hop.hop")?.getAnimations().map((a) => (a as CSSAnimation).animationName).join() === "fd-hop", null, { polling: "raf", timeout: 3000 });
  await submitMove(page, top[0]?.move, fen);
  await hop;
  await expect.poll(() => names(".you-pawn-hop"), { timeout: 5000, message: "the hop ends" }).toEqual([]);
  // The boss's reply doesn't hop it: your next move comes, a good second after your last one landed, and it's still.
  await yourMove(page);
  await page.waitForTimeout(800);
  expect(await names(".you-pawn-hop"), "no hop for the boss's move").toEqual([]);
  expect(await names(".you-pawn-bob"), "still bobbing").toEqual(["you-bob"]);
  // Reduced motion: no bob, no hop.
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await names(".you-pawn-bob"), "no bob under reduced motion").toEqual([]);
});

test("a narrow phone: the list's rows fit the panel, their times showing", async ({ browser }) => {
  test.skip(test.info().project.name !== "phone", "it opens its own phones");
  test.setTimeout(5 * 60_000);
  for (const size of ["320x640", "360x640"]) {
    const [w, h] = size.split("x").map(Number) as [number, number];
    const { ctx, page } = await open(browser, w, h);
    await into(page, false);
    await play(page, 3);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll(".dk-panel .mv-row:not(.mv-opening)")].map((r) => {
        const panel = document.querySelector(".dk-panel")!.getBoundingClientRect();
        const t = r.querySelector(".mv-time")?.getBoundingClientRect();
        return { over: r.scrollWidth - r.clientWidth, timeShown: !!t && t.right <= panel.right + 0.5 && t.width > 0, label: r.getAttribute("aria-label") };
      }),
    );
    expect(rows.length, size).toBeGreaterThanOrEqual(6);
    for (const r of rows) {
      expect(r.over, `${size}: ${r.label}`).toBeLessThanOrEqual(0);
      expect(r.timeShown, `${size}: ${r.label}`).toBe(true);
    }
    await ctx.close();
  }
});

test("after a few moves the list has one row per move with its piece, square and capture; the \"Your move\" row is one line", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await into(page, false);
  // The row: one line, about half its old height.
  const b = await boxes(page);
  expect(b.row!.b - b.row!.y, "the row's height").toBeLessThanOrEqual(MAIN_ROW_H * 0.6);
  await expect(page.locator(".boss-dock-status .dk-text")).toHaveText(/^Your move\./);
  expect(b.text!.b - b.text!.y, "one line of text").toBeLessThanOrEqual(22);
  await play(page, 3);
  const { history, start, side } = await page.evaluate(() => {
    const boss = (window as any).match.boss;
    return { history: boss.board.history as string[], start: (boss.startMove - 1) * 2, side: boss.crowdSide as string };
  });
  expect(history.length - start).toBeGreaterThanOrEqual(6);
  // What each move was, from the game itself.
  const chess = new Chess();
  const names: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  const want: string[] = [];
  history.forEach((uci, ply) => {
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (ply < start) return;
    const who = m.color === side ? "You" : "Boss";
    const what = m.san.startsWith("O-O") ? m.san.replace(/[+#]/g, "") : `${names[m.piece]} to ${m.to}${m.captured ? `, takes ${names[m.captured]}` : ""}`;
    want.push(`${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? "." : "…"} ${who}: ${what}`);
  });
  const list = page.locator(".mv-list").first();
  const rows = list.locator(".mv-row:not(.mv-opening)");
  await expect(rows).toHaveCount(want.length);
  const labels = await rows.evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? "").replace(/, \d+s$|, \d+:\d\d$/, "")));
  expect(labels).toEqual(want);
  // Each with its time (the moves this page watched), the newest at the bottom.
  await expect(rows.last().locator(".mv-time")).toHaveText(/^\d+s$/);
  // The row still one line through the moves.
  const after = await boxes(page);
  expect(after.row!.b - after.row!.y).toBeLessThanOrEqual(MAIN_ROW_H * 0.6);
});
