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
 */

/** Measured on main before this change (3cf8aba0), Boss alone and a Solo raid alike: the board's width on a phone. */
const MAIN_BOARD: Record<string, number> = { "390x844": 312, "360x640": 282.7, "320x568": 237.3 };
/** …the raid's scoreboard beside the board on a computer (x, y, width; its height the window's). */
const MAIN_TOWER: Record<string, { x: number; y: number; w: number }> = {
  "1280x800": { x: 10, y: 0, w: 360 },
  "1440x900": { x: 40, y: 0, w: 360 },
  "1920x1080": { x: 280, y: 0, w: 360 },
};
/** …and the "Your move" row's height (two lines' room). */
const MAIN_ROW_H = 62;

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

test("a computer: Boss alone has no scoreboard; a raid's is where it was; the moves right of the board, off the board and the God King", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "it opens its own windows");
  test.setTimeout(12 * 60_000);
  for (const raid of [false, true]) {
    for (const size of ["1280x800", "1440x900", "1920x1080"]) {
      const [w, h] = size.split("x").map(Number) as [number, number];
      const at = `${raid ? "raid" : "alone"} ${size}`;
      const { ctx, page } = await open(browser, w, h);
      await into(page, raid);
      const b = await boxes(page);
      expect(b.board && b.king && b.side, at).toBeTruthy();
      if (raid) {
        // The scoreboard on the left, the same box as on main.
        const t = b.tower!;
        expect(t, `${at}: the scoreboard`).toBeTruthy();
        const m = MAIN_TOWER[size]!;
        for (const [k, v] of [["x", t.x - m.x], ["y", t.y - m.y], ["width", t.r - t.x - m.w], ["height", t.b - t.y - h]] as const) expect(Math.abs(v), `${at}: the scoreboard's ${k}`).toBeLessThanOrEqual(1);
      } else {
        expect(b.tower, `${at}: no scoreboard on the left`).toBeNull();
        expect(b.mini, `${at}: nor in the column`).toBeNull();
      }
      // The moves: right of the board, from its top, above the God King, over neither.
      const { board, king, side } = { board: b.board!, king: b.king!, side: b.side! };
      expect(side.x, `${at}: right of the board`).toBeGreaterThanOrEqual(board.r);
      expect(Math.abs(side.y - board.y), `${at}: from the board's top`).toBeLessThanOrEqual(30);
      expect(side.b, `${at}: above the God King`).toBeLessThanOrEqual(king.y);
      expect(overlap(side, board), at).toBe(false);
      expect(overlap(side, king), at).toBe(false);
      expect(side.r, `${at}: inside the window`).toBeLessThanOrEqual(w);
      expect(side.b - side.y, `${at}: room for rows`).toBeGreaterThanOrEqual(150);
      expect(b.scroll, at).toBeLessThanOrEqual(0);
      if (SHOTS && size === "1280x800") {
        await play(page, 2);
        await page.screenshot({ path: `${SHOTS}/computer-${raid ? "raid" : "alone"}.png` });
      }
      await ctx.close();
    }
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
