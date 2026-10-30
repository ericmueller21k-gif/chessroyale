import { devices, expect, type Browser, type Page } from "@playwright/test";
import { BOARD_SEL, bossAloneFromHome, engineTop, named, openBossRaid, soloFromHome, submitMove, test } from "./helpers.ts";

/**
 * A computer's board as big as the window's height lets it, as chess.com's (Eric, Oct 29;
 * docs/decisions/2026-10-29-desktop-board-size.md; packages/app/src/board-size.css):
 * - every game screen with a chessboard sizes its board by the window's height less the room the screen needs above and
 *   below it, never wider than its column: Boss alone, a raid, the Crowd's 50 v 50 and its opening vote, 1 v 1, Squads;
 * - nothing overlaps and nothing scrolls, at 1280 × 800, 1440 × 900, 1920 × 1080 and a short 1366 × 768; the move list,
 *   the God King's corner and the scoreboard where they belong;
 * - a resize grows and shrinks it; through a game it never changes size;
 * - phones and tablets: the board's box is main's, to the pixel.
 * (Auto chess has its own board and frame: not changed, not here.)
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const SIZES = ["1920x1080", "1440x900", "1366x768", "1280x800"] as const;
type Size = (typeof SIZES)[number];
const dims = (s: string) => s.split("x").map(Number) as [number, number];

/** Each screen's room above and below the board (board-size.css' --bd-room): its board is never taller than the rest. */
const ROOM = { alone: 200, raid: 200, crowd: 170, vote: 170, duel: 170, squads: 230 } as const;
type Screen = keyof typeof ROOM;
/**
 * The board's side, measured with this change (testers' eval bar on, as `?debug` shows it), and on main before it. At 1280 × 800
 * and 1366 × 768 a raid's, the Crowd's and Squads' are width-bound: their scoreboard (360 px) and the column beside the board
 * (340 px) leave the board no more.
 */
const NOW: Record<Screen, Record<Size, number>> = {
  alone: { "1920x1080": 880, "1440x900": 696, "1366x768": 568, "1280x800": 600 },
  raid: { "1920x1080": 880, "1440x900": 616, "1366x768": 536, "1280x800": 456 },
  crowd: { "1920x1080": 904, "1440x900": 616, "1366x768": 536, "1280x800": 456 },
  vote: { "1920x1080": 904, "1440x900": 616, "1366x768": 536, "1280x800": 456 },
  duel: { "1920x1080": 904, "1440x900": 728, "1366x768": 592, "1280x800": 624 },
  squads: { "1920x1080": 848, "1440x900": 664, "1366x768": 536, "1280x800": 504 },
};
const MAIN: Record<Screen, Record<Size, number>> = {
  alone: { "1920x1080": 552, "1440x900": 552, "1366x768": 480, "1280x800": 456 },
  raid: { "1920x1080": 552, "1440x900": 552, "1366x768": 480, "1280x800": 456 },
  crowd: { "1920x1080": 552, "1440x900": 552, "1366x768": 536, "1280x800": 456 },
  vote: { "1920x1080": 552, "1440x900": 552, "1366x768": 536, "1280x800": 456 },
  duel: { "1920x1080": 704, "1440x900": 648, "1366x768": 512, "1280x800": 544 },
  squads: { "1920x1080": 600, "1440x900": 600, "1366x768": 536, "1280x800": 504 },
};
/** chess.com's board against its window's height (Eric's screenshot, Oct 29: 921 px of 1036). */
const CHESS_COM = 921 / 1036;

/** Into each screen at the board, as a player gets there. */
async function into(page: Page, screen: Screen) {
  await named(page, "Wide Window");
  if (screen === "alone" || screen === "raid") {
    await page.goto("/?debug&pace=quick&clock=60&laststand=0&boss=gardener");
    if (screen === "raid") {
      await openBossRaid(page);
      await page.getByRole("button", { name: /^Raid with bots/ }).click();
    } else await bossAloneFromHome(page);
    await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  } else if (screen === "crowd" || screen === "vote") {
    await page.goto(screen === "vote" ? "/?debug&mode=crowd&augments=1" : "/?debug&pace=quick&mode=crowd&rounds=2&clock=60&augments=0");
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 120_000 }).toMatch(screen === "vote" ? /^vote$/ : /^(play|watching)$/);
  } else if (screen === "duel") {
    await page.goto(`/1v1?nolanding&pool=wide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}&fewAfter=2`);
    await page.locator(".dv-few").getByRole("button", { name: "Play a bot (unranked)" }).click();
    await expect(page.locator(".dv-status")).toContainText(/first move|Your move|Their move/, { timeout: 30_000 });
  } else {
    await page.goto("/squads/test/pairs?nolanding&debug&clock=90,0,3,0");
    await page.getByRole("button", { name: "Skip votes" }).click({ timeout: 40_000 });
    await expect(page.locator(".sq-game .board-area .board-wrap")).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.locator(`.board-area .board-row > .board-wrap ${BOARD_SEL.container}`).first()).toBeVisible();
}

type Box = { x: number; y: number; r: number; b: number };
/** The board and everything around it that must keep clear of it and of each other. */
const BESIDE: Record<string, string> = {
  title: ".screen.game > .hud-row",
  bar: ".screen.game > .boss-bar",
  moves: ".mv-side",
  scoreboard: ".tower-side",
  king: ".boss-dock .gk-unit",
  pawn: ".boss-dock .you-pawn",
  row: ".boss-dock-main",
  pump: ".tg-side-pump",
  panel: ".screen.game > .play-footer",
  cards: ".screen.game .vote-cards",
  chat: ".screen.game > .under-board",
  squadPanel: ".screen.game .sq-panel",
  strips: ".screen.game .dv-strip",
};
async function look(page: Page) {
  return page.evaluate(
    ({ beside, container }) => {
      const box = (e: Element): Box => {
        const b = e.getBoundingClientRect();
        return { x: b.left, y: b.top, r: b.right, b: b.bottom };
      };
      const shown = (e: Element) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== "hidden";
      const board = box(document.querySelector(`.board-area .board-row > .board-wrap ${container}`)!);
      const wrap = box(document.querySelector(".board-area .board-row > .board-wrap")!);
      const around: Record<string, Box[]> = {};
      for (const [k, sel] of Object.entries(beside)) {
        const all = [...document.querySelectorAll(sel)].filter(shown).map(box);
        if (all.length) around[k] = all;
      }
      // The boss beside the board: his drawn pixels, not his frame.
      const c = document.querySelector<HTMLCanvasElement>(".boss-char.place-side .boss-char-sprite");
      let boss: Box | null = null;
      if (c && shown(c)) {
        const cb = c.getBoundingClientRect();
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let l = c.width, r = -1, t = c.height, b = -1;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++)
            if (d[(y * c.width + x) * 4 + 3]! > 0) {
              l = Math.min(l, x);
              r = Math.max(r, x);
              t = Math.min(t, y);
              b = Math.max(b, y);
            }
        if (r >= 0) boss = { x: cb.left + (l * cb.width) / c.width, r: cb.left + ((r + 1) * cb.width) / c.width, y: cb.top + (t * cb.height) / c.height, b: cb.top + ((b + 1) * cb.height) / c.height };
      }
      const ev = document.querySelector(".board-row > .eval-bar");
      return {
        board,
        wrap,
        around,
        boss,
        evalBar: ev && shown(ev) ? box(ev) : null,
        scrollY: document.documentElement.scrollHeight - innerHeight,
        scrollX: document.documentElement.scrollWidth - innerWidth,
      };
    },
    { beside: BESIDE, container: BOARD_SEL.container },
  );
}
const overlap = (a: Box, b: Box) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
const side = (b: Box) => b.r - b.x;

/** Checks one screen at one window size: the board's side by the rule, and everything beside it in place, clear, in view. */
async function check(page: Page, screen: Screen, size: Size) {
  const [w, h] = dims(size);
  const at = `${screen} ${size}`;
  const g = await look(page);
  const b = side(g.board);
  // Its size: what this change measured, never more than the window's height allows, never less than main's.
  expect(Math.abs(b - NOW[screen][size]), `${at}: the board's side (${b})`).toBeLessThanOrEqual(1);
  expect(b, `${at}: within the window's height less the screen's room`).toBeLessThanOrEqual(h - ROOM[screen] + 0.5);
  expect(b, `${at}: never smaller than main's`).toBeGreaterThanOrEqual(MAIN[screen][size] - 0.5);
  expect(Math.abs(g.board.b - g.board.y - b), `${at}: square`).toBeLessThanOrEqual(1);
  // Nothing scrolls; everything in the window.
  expect(g.scrollY, `${at}: no scrolling down`).toBeLessThanOrEqual(0);
  expect(g.scrollX, `${at}: no scrolling across`).toBeLessThanOrEqual(0);
  const all: [string, Box][] = [["board", g.board], ...Object.entries(g.around).flatMap(([k, bs]) => bs.map((x, i) => [bs.length > 1 ? `${k}${i}` : k, x] as [string, Box]))];
  if (g.boss) all.push(["boss", g.boss]);
  if (g.evalBar) all.push(["eval bar", g.evalBar]);
  for (const [k, x] of all) {
    expect(x.x, `${at}: the ${k} inside the window`).toBeGreaterThanOrEqual(-0.5);
    expect(x.r, `${at}: the ${k} inside the window`).toBeLessThanOrEqual(w + 0.5);
    if (k !== "scoreboard") expect(x.b, `${at}: the ${k} inside the window`).toBeLessThanOrEqual(h + 0.5);
  }
  // Nothing over anything else. (By design: the boss in a raid stands over the scoreboard's edge, as before this change.)
  const allowed = (p: string, q: string) => [p, q].includes("boss") && [p, q].includes("scoreboard");
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const [p, a] = all[i]!;
      const [q, c] = all[j]!;
      if (!allowed(p, q)) expect(overlap(a, c), `${at}: the ${p} clear of the ${q}: ${JSON.stringify([a, c])}`).toBe(false);
    }
  // What sits beside the board follows it.
  const m = g.around.moves?.[0];
  if (m) {
    expect(Math.abs(m.y - g.board.y), `${at}: the moves from the board's top`).toBeLessThanOrEqual(1);
    expect(m.x - g.board.r, `${at}: the moves a small gap off the board`).toBeGreaterThanOrEqual(12);
    expect(m.x - g.board.r, `${at}: the moves a small gap off the board`).toBeLessThanOrEqual(16.5);
    expect(Math.abs(m.b - m.y - Math.max(120, b / 2 - 73)), `${at}: the moves half the board less 73 px`).toBeLessThanOrEqual(2);
    const k = g.around.king![0]!;
    expect(m.b, `${at}: the moves above the God King`).toBeLessThanOrEqual(k.y);
  }
  const k = g.around.king?.[0];
  if (k) {
    // The God King (and your pawn, alone) by the board's bottom right corner, on its bottom line.
    expect(k.x, `${at}: the God King right of the board`).toBeGreaterThanOrEqual(g.board.r);
    expect(Math.abs(k.b - g.board.b - 14), `${at}: the God King on the board's bottom line`).toBeLessThanOrEqual(16);
    const p = g.around.pawn?.[0];
    if (p) {
      expect(p.x - g.board.r, `${at}: your pawn by the board`).toBeGreaterThanOrEqual(24);
      expect(p.x - g.board.r, `${at}: your pawn by the board`).toBeLessThanOrEqual(32);
      expect(k.x, `${at}: the God King right of your pawn`).toBeGreaterThanOrEqual(p.r - 1);
    }
    // The dock's row under the board, its width.
    const row = g.around.row![0]!;
    expect(Math.abs(row.x - g.board.x) + Math.abs(row.r - g.board.r), `${at}: the dock's row the board's width`).toBeLessThanOrEqual(2);
    expect(row.y, `${at}: the row under the board`).toBeGreaterThanOrEqual(g.board.b);
  }
  if (g.boss) expect(g.boss.r, `${at}: the boss left of the board`).toBeLessThanOrEqual((g.evalBar ?? g.board).x);
  const t = g.around.scoreboard?.[0];
  if (t) {
    expect(t.r, `${at}: the scoreboard left of the board`).toBeLessThanOrEqual((g.evalBar ?? g.board).x);
    expect(t.y, `${at}: the scoreboard from the window's top`).toBeLessThanOrEqual(0.5);
  }
  // The title line and a boss's bar over the board, the board's width (a boss battle: straight with its edges).
  const title = g.around.title?.[0];
  if (title) expect(title.b, `${at}: the title line above the board`).toBeLessThanOrEqual(g.board.y);
  if (g.around.bar) for (const x of [g.around.bar[0]!, title!]) expect(Math.abs(x.x - g.board.x), `${at}: straight with the board's left edge`).toBeLessThanOrEqual(1);
  return { b, ratio: b / h };
}

/** The board's sizes seen on every animation frame from now on (its container's width). */
const watchSize = (page: Page) =>
  page.evaluate((sel) => {
    const seen = ((window as any).__boardSizes = new Map<number, number>());
    const tick = () => {
      const el = document.querySelector(`.board-area .board-row > .board-wrap ${sel}`);
      if (el) {
        const w = Math.round(el.getBoundingClientRect().width * 2) / 2;
        seen.set(w, (seen.get(w) ?? 0) + 1);
      }
      if ((window as any).__boardSizes === seen) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, BOARD_SEL.container);
const sizesSeen = (page: Page) => page.evaluate(() => [...((window as any).__boardSizes as Map<number, number>).entries()]);

/** A few moves of yours (the engine's best) with the boss's replies. */
async function playBoss(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
    await page.waitForTimeout(400);
    const { fen, top } = await engineTop(page);
    const allowed = await page.evaluate(() => ((window as any).match.runner.crowdAllowed() ?? null) as string[] | null);
    await submitMove(page, top.map((t) => t.move).find((x) => !allowed || allowed.includes(x)) ?? allowed?.[0] ?? top[0]?.move, fen);
    await expect.poll(() => phase(page), { timeout: 15_000 }).not.toBe("play");
  }
  await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
}

for (const screen of Object.keys(ROOM) as Screen[]) {
  test(`a computer: ${screen}'s board by the window's height, every size; nothing over anything; a resize grows and shrinks it; the same size through the game`, async ({ browser }) => {
    test.skip(test.info().project.name !== "desktop", "a computer only; it opens its own windows");
    test.setTimeout(6 * 60_000);
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await into(page, screen);
    const got: string[] = [];
    // Big, smaller, short, smaller still, and back: the board follows the window each way.
    let last = 0;
    for (const size of [...SIZES, "1920x1080"] as Size[]) {
      const [w, h] = dims(size);
      await page.setViewportSize({ width: w, height: h });
      await expect.poll(async () => Math.abs(side((await look(page)).board) - NOW[screen][size]), { timeout: 5_000 }).toBeLessThanOrEqual(1);
      await page.waitForTimeout(300);
      const { b, ratio } = await check(page, screen, size);
      if (last) expect(b > last, `${screen} ${size}: grows or shrinks with the window`).toBe(NOW[screen][size] > last);
      last = b;
      got.push(`${size} ${b} px (${ratio.toFixed(3)} of the height; chess.com ${CHESS_COM.toFixed(3)})`);
    }
    test.info().annotations.push({ type: "sizes", description: got.join("; ") });
    // Through the game (between moves, banners, the boss's turn, a crowd's reveal): one size only.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    await watchSize(page);
    if (screen === "alone" || screen === "raid") await playBoss(page, 2);
    else if (screen === "duel") {
      // (The bot's move and yours: the board as you play.)
      await page.waitForTimeout(8_000);
    } else await page.waitForTimeout(15_000);
    const seen = await sizesSeen(page);
    expect(seen.length, `${screen}: one board size through the game: ${JSON.stringify(seen)}`).toBe(1);
    expect(Math.abs(seen[0]![0] - NOW[screen]["1280x800"]), `${screen}: that size`).toBeLessThanOrEqual(1);
    await ctx.close();
  });
}

test("a computer: Babur's pump beside him at every size, as big as the board's balloons, never flipping to the taller bar; the board one size through his game", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "a computer only; it opens its own windows");
  test.setTimeout(5 * 60_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&boss=tiger");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  // (His column grows with the board, so the pump has room beside him; at 1280 × 800 and 1440 × 900 the board gives up a little
  // width for it, testers' eval bar on: 536 and 680 px, the bar off 584 and 696.)
  for (const [size, board] of [["1280x800", 536], ["1920x1080", 880], ["1366x768", 568], ["1440x900", 680], ["1280x800", 536]] as const) {
    const [w, h] = dims(size);
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(800);
    await watchSize(page);
    await page.waitForTimeout(2_500);
    const seen = await sizesSeen(page);
    expect(seen.length, `${size}: one size: ${JSON.stringify(seen)}`).toBe(1);
    expect(Math.abs(seen[0]![0] - board), `${size}: the board ${seen[0]![0]}`).toBeLessThanOrEqual(1);
    await expect(page.locator(".tg-pump-slot.tg-tall"), `${size}: not in the taller bar`).toHaveCount(0);
    await expect(page.locator(".tg-side-pump"), `${size}: beside him`).toHaveCount(1);
    expect(seen[0]![0], `${size}: within the window's height less the room`).toBeLessThanOrEqual(h - ROOM.alone);
  }
  // Through his game (his turn, his balloons, your moves): one size.
  await watchSize(page);
  await playBoss(page, 2);
  const seen = await sizesSeen(page);
  expect(seen.length, `one board size through his game: ${JSON.stringify(seen)}`).toBe(1);
  await ctx.close();
});

/**
 * Phones and tablets: the board's box (x, y, side) is main's at every size, to the pixel. Measured on main (613bf24e) the same
 * way: each screen opened at 390 × 844 and the window then set to each size in turn. A tablet on its side (1024 × 768 and
 * 1180 × 820, touch) keeps its old layout too: the new sizes are a computer's (a mouse).
 */
const TOUCH = ["390x844", "430x932", "768x1024", "844x390", "1024x768", "1180x820"] as const;
const MAIN_TOUCH: Record<"alone" | "crowd" | "duel", Record<(typeof TOUCH)[number], [number, number, number]>> = {
  alone: { "390x844": [38, 153, 312], "430x932": [38, 153, 352], "768x1024": [142, 153, 483], "844x390": [292, 175, 259], "1024x768": [96, 133, 464], "1180x820": [408, 133, 355] },
  crowd: { "390x844": [38, 70, 312], "430x932": [38, 70, 352], "768x1024": [142, 70, 483], "844x390": [292, 85, 259], "1024x768": [52, 95, 552], "1180x820": [408, 95, 355] },
  duel: { "390x844": [14, 90, 360], "430x932": [14, 90, 400], "768x1024": [118, 90, 531], "844x390": [312, 104, 219], "1024x768": [69, 114, 517], "1180x820": [121, 114, 568] },
};
async function touchPage(browser: Browser) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
  return { ctx, page: await ctx.newPage() };
}
for (const screen of ["alone", "crowd", "duel"] as const) {
  test(`phones and tablets: ${screen}'s board box is main's at 390 × 844, 430 × 932, 768 × 1024, a phone on its side and a tablet on its side`, async ({ browser }) => {
    test.skip(test.info().project.name !== "desktop", "it opens its own phone windows; once is enough");
    test.setTimeout(4 * 60_000);
    const { ctx, page } = await touchPage(browser);
    await into(page, screen);
    await page.waitForTimeout(1_500);
    for (const size of TOUCH) {
      const [w, h] = dims(size);
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(900);
      const b = (await look(page)).board;
      const [x, y, s] = MAIN_TOUCH[screen][size];
      const at = `${screen} ${size}`;
      expect(Math.abs(b.x - x), `${at}: the board's left (${b.x})`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.y - y), `${at}: the board's top (${b.y})`).toBeLessThanOrEqual(1);
      expect(Math.abs(side(b) - s), `${at}: the board's side (${side(b)})`).toBeLessThanOrEqual(1);
    }
    await ctx.close();
  });
}
