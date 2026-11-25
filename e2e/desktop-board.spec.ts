import { devices, expect, type Browser, type Page } from "@playwright/test";
import { SIDE_FEEL } from "../packages/app/src/characters/side-size.ts";
import { BOARD_SEL, REAL_SCREENS, boardTarget, bossAloneFromHome, engineTop, named, openBossRaid, realLayout, realScreenContext, soloFromHome, submitMove, test, type RealScreen } from "./helpers.ts";

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

/** Each screen's room above and below the board (board-size.css' --bd-room): its board is never taller than the rest. (1 v 1's: 108 since
 * Nov 25, its computer frame: no title line, the two strips.) */
const ROOM = { alone: 123, raid: 123, crowd: 170, vote: 170, duel: 108, squads: 230 } as const;
type Screen = keyof typeof ROOM;
/**
 * The board's side, measured with this change. Nov 1 (the eval bar off for everyone, as every player's board is: a raid's,
 * the Crowd's and its opening vote's 1280 to 1440 px boards are 504, 584 and 664 now, were 456, 536 and 616 with the testers'
 * bar on; Boss alone's and 1v1's and Squads' are the same). Round 2 (Nov 1): the side menu is icons only below 1800 px (80 px,
 * not 232), and the columns beside the board give the room back: the right column is 280 px where the window is what limits
 * the board (340 where its height does), a leaderboard 340 px (was 360), Boss alone's empty column 196 px (was 216). Every
 * screen's board is at least main's at these sizes (MAIN below). Nov 25: 1 v 1's computer frame (no title line, the board the window's
 * height less its two strips): 968, 792, 656 and 688 (were 904, 728, 592, 624).
 */
const NOW: Record<Screen, Record<Size, number>> = {
  alone: { "1920x1080": 952, "1440x900": 760, "1366x768": 640, "1280x800": 600 },
  raid: { "1920x1080": 952, "1440x900": 664, "1366x768": 584, "1280x800": 504 },
  crowd: { "1920x1080": 904, "1440x900": 664, "1366x768": 584, "1280x800": 504 },
  vote: { "1920x1080": 904, "1440x900": 664, "1366x768": 584, "1280x800": 504 },
  duel: { "1920x1080": 968, "1440x900": 792, "1366x768": 656, "1280x800": 688 },
  squads: { "1920x1080": 848, "1440x900": 664, "1366x768": 536, "1280x800": 504 },
};
/**
 * Main at a2f721a, before the Nov 1 changes (measured with the eval bar on, as the sizes were then): the board's side must be at least
 * this at every size, no allowance. (Nov 1, round 2: replaces the older main sizes these checks had since Oct 29, which were
 * smaller: Boss alone at 1920 × 1080 was 552, main's is 880.)
 */
const MAIN: Record<Screen, Record<Size, number>> = {
  alone: { "1920x1080": 880, "1440x900": 696, "1366x768": 568, "1280x800": 600 },
  raid: { "1920x1080": 880, "1440x900": 616, "1366x768": 536, "1280x800": 456 },
  crowd: { "1920x1080": 904, "1440x900": 616, "1366x768": 536, "1280x800": 456 },
  vote: { "1920x1080": 904, "1440x900": 616, "1366x768": 536, "1280x800": 456 },
  duel: { "1920x1080": 904, "1440x900": 728, "1366x768": 592, "1280x800": 624 },
  squads: { "1920x1080": 848, "1440x900": 664, "1366x768": 536, "1280x800": 504 },
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
      await page.getByRole("button", { name: /^Play with bots/ }).click();
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
  side: ".screen.game > .dv-side",
  tools: ".screen.game > .gm-tools",
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
        // (Mirrored to face the board (kits.ts placeFacing), its frame's columns run right to left.)
        if (new DOMMatrixReadOnly(getComputedStyle(c).transform).a < 0) [l, r] = [c.width - r - 1, c.width - l - 1];
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
  // Nothing over anything else. (By design: the boss in a raid stands over the scoreboard's edge, as before this change. And Nov 4, round 2:
  // the figures by the board's bottom corners, the boss, your pawn and the God King, may come over the board's edge by at most
  // SIDE_FEEL.over of its side, where their room needs it: docs/decisions/2026-11-04-bigger-side-figures.md.)
  const over = (g.board.r - g.board.x) * SIDE_FEEL.over;
  const figure = (p: string) => ["boss", "pawn", "king"].includes(p);
  const allowed = (p: string, q: string) => [p, q].includes("boss") && [p, q].includes("scoreboard");
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const [p, a] = all[i]!;
      const [q, c] = all[j]!;
      if (allowed(p, q)) continue;
      if ((p === "board" && figure(q)) || (q === "board" && figure(p))) {
        const across = Math.min(a.r, c.r) - Math.max(a.x, c.x);
        expect(across, `${at}: the ${p === "board" ? q : p} over the board's edge by at most ${over}: ${JSON.stringify([a, c])}`).toBeLessThanOrEqual(over + 1);
      } else expect(overlap(a, c), `${at}: the ${p} clear of the ${q}: ${JSON.stringify([a, c])}`).toBe(false);
    }
  // What sits beside the board follows it.
  const m = g.around.moves?.[0];
  if (m) {
    // (Nov 14, Eric: "move up the moves thing so it's flush with the top of the chessboard… move up the tools so it sits level with
    // the banner". A boss battle's ⚡, fish and gear sit in the banner's row, above the board's top line, right of the banner's text.
    // Was: the moves 36 px under the tools, the tools at the board's top (Nov 1).)
    expect(Math.abs(m.y - g.board.y), `${at}: the moves' top = the board's top`).toBeLessThanOrEqual(1);
    if (g.around.tools) {
      const t = g.around.tools[0]!;
      expect(t.b, `${at}: the tools above the board's top line`).toBeLessThanOrEqual(g.board.y);
      const bar = g.around.bar?.[0];
      if (bar) expect(t.y >= bar.y - 1 && t.b <= bar.b + 1, `${at}: the tools level with the banner`).toBe(true);
    }
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
      // (A small gap off the board, or over its edge by at most SIDE_FEEL.over of its side: was 24 to 32 px off it.)
      expect(p.x - g.board.r, `${at}: your pawn by the board`).toBeGreaterThanOrEqual(-over - 1);
      expect(p.x - g.board.r, `${at}: your pawn by the board`).toBeLessThanOrEqual(32);
      expect(k.x, `${at}: the God King right of your pawn`).toBeGreaterThanOrEqual(p.r - 1);
    }
    // The dock's row under the board, its width.
    const row = g.around.row![0]!;
    expect(Math.abs(row.x - g.board.x) + Math.abs(row.r - g.board.r), `${at}: the dock's row the board's width`).toBeLessThanOrEqual(2);
    expect(row.y, `${at}: the row under the board`).toBeGreaterThanOrEqual(g.board.b);
  }
  if (g.boss) expect(g.boss.r, `${at}: the boss by the board's left, over it by at most ${over}`).toBeLessThanOrEqual((g.evalBar ?? g.board).x + over + 1);
  const t = g.around.scoreboard?.[0];
  if (t) {
    expect(t.r, `${at}: the scoreboard left of the board`).toBeLessThanOrEqual((g.evalBar ?? g.board).x);
    expect(t.y, `${at}: the scoreboard from the window's top`).toBeLessThanOrEqual(0.5);
  }
  // The title line and a boss's bar over the board, the board's width (a boss battle: straight with its edges).
  const title = g.around.title?.[0];
  if (title) expect(title.b, `${at}: the title line above the board`).toBeLessThanOrEqual(g.board.y);
  if (g.around.bar) for (const x of [g.around.bar[0]!, title].filter(Boolean) as Box[]) expect(Math.abs(x.x - g.board.x), `${at}: straight with the board's left edge`).toBeLessThanOrEqual(1);
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
    // (Until what each screen goes through has happened, polled, not a fixed 8 or 15 s that, on the duel, saw only its countdown.)
    if (screen === "alone" || screen === "raid") await playBoss(page, 2);
    else if (screen === "duel") {
      // Your first move and the bot's reply: the board as you play (its line: "Your first move", "Their move", then "Your move").
      await expect(page.locator(".dv-status")).toContainText("Your first move", { timeout: 30_000 });
      const white = (await page.locator(".dv-strip.dv-you").getAttribute("data-side")) === "w";
      const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
      for (const sq of white ? ["e2", "e4"] : ["e7", "e5"]) {
        const col = white ? sq.charCodeAt(0) - 97 : 104 - sq.charCodeAt(0);
        const row = white ? 8 - Number(sq[1]) : Number(sq[1]) - 1;
        await page.mouse.click(box.x + ((col + 0.5) * box.width) / 8, box.y + ((row + 0.5) * box.height) / 8);
      }
      await expect(page.locator(".dv-status")).toHaveText("Your move", { timeout: 30_000 });
    } else if (screen === "crowd") {
      // A turn's end: the scoring, the reveal and what follows it: the next turn (yours to play or the other team's to watch) or,
      // after a stage's last turn, its break. (Not "play" itself: you never pick here, so a stage's end can knock you out and
      // the rest is "simulating", with no next turn of yours. Main run 42768777492, Nov 10.)
      await expect.poll(() => phase(page), { timeout: 60_000, intervals: [100] }).toBe("reveal");
      await expect.poll(() => phase(page), { timeout: 30_000, intervals: [100] }).toMatch(/^(play|watching|stageBreak)$/);
    } else if (screen === "vote") {
      // A vote's end (its result) and the next one's start.
      await expect.poll(() => page.evaluate(() => (window as any).match?.phase.vote?.index ?? 0), { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
    } else {
      // Squads: the half played out and its show after.
      await expect.poll(() => page.evaluate(() => [...(window as any).squads.matches.values()].some((m: any) => m.state === "show")), { timeout: 60_000 }).toBe(true);
    }
    const seen = await sizesSeen(page);
    expect(seen.length, `${screen}: one board size through the game: ${JSON.stringify(seen)}`).toBe(1);
    expect(Math.abs(seen[0]![0] - NOW[screen]["1280x800"]), `${screen}: that size`).toBeLessThanOrEqual(1);
    await ctx.close();
  });
}

/**
 * Real screens (Nov 25; docs/decisions/2026-11-25-real-screens.md; e2e/helpers.ts REAL_SCREENS): every computer game screen at a 1080p
 * laptop at 125% (Eric's, 1536 × 730), at 150% (1280 × 600), a 768p laptop (1366 × 650) and a desktop (1920 × 960), each at its own device
 * scale: nothing scrolls either way, nothing is cut off at the window's top, every chat shows at least 120 px of messages, and the board
 * is at least the window's height less two name bars and 40 px. Boss alone and the 50 v 50 go on to their end pages (a resign).
 *
 * Known gaps (measured Nov 25, before the shared game layout, Part 3's mockup): today every game screen's board is under that target, and
 * the 50 v 50's chat on the two shortest laptops is under 120 px. Each is held here at today's number (it may grow, never shrink) and
 * written in the test's annotations; when a screen reaches the target, its entry goes.
 */
const realKey = (s: RealScreen) => `${s.width}x${s.height}`;
const BOARD_TODAY: Record<Screen, Record<string, number>> = {
  alone: { "1536x730": 600, "1280x600": 472, "1366x650": 520, "1920x960": 832 },
  raid: { "1536x730": 600, "1280x600": 472, "1366x650": 520, "1920x960": 832 },
  crowd: { "1536x730": 560, "1280x600": 424, "1366x650": 480, "1920x960": 784 },
  vote: { "1536x730": 560, "1280x600": 424, "1366x650": 480, "1920x960": 784 },
  // (1 v 1: none since Nov 25, its computer frame: its board is the target, to its 8 device pixel step.)
  duel: {},
  squads: { "1536x730": 496, "1280x600": 368, "1366x650": 416, "1920x960": 728 },
};
const END_SCROLL_TODAY: Partial<Record<Screen, Record<string, number>>> = {
  alone: { "1536x730": 35, "1280x600": 165, "1366x650": 115 },
  crowd: { "1280x600": 111, "1366x650": 61 },
};
const CHAT_TODAY: Partial<Record<Screen, Record<string, number>>> = { crowd: { "1536x730": 119, "1280x600": 8, "1366x650": 42 } };

/** Resign from the gear: the match's end page. */
async function resignFromGear(page: Page) {
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click();
  await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("results");
}

for (const screen of Object.keys(ROOM) as Screen[]) {
  const end = screen === "alone" || screen === "crowd";
  test(`real screens (Nov 25): ${screen} on laptop 1536×730, 1280×600, 1366×650 and desktop 1920×960: no scroll either way, nothing cut off at the top, chats with 120 px of messages, the board the window's height less two name bars and 40 (or today's, a known gap)${end ? "; its end page too" : ""}`, async ({ browser }) => {
    test.skip(test.info().project.name !== "desktop", "a computer only; it opens its own windows");
    test.setTimeout(10 * 60_000);
    const notes: string[] = [];
    for (const s of REAL_SCREENS) {
      const ctx = await realScreenContext(browser, s);
      const page = await ctx.newPage();
      await into(page, screen);
      await page.waitForTimeout(500);
      const at = `${screen} on the ${s.name}`;
      const g = await realLayout(page);
      expect(g.scrollX, `${at}: no scrolling across`).toBeLessThanOrEqual(0);
      expect(g.scrollY, `${at}: no scrolling down`).toBeLessThanOrEqual(0);
      expect(g.cut, `${at}: nothing cut off at the top`).toEqual([]);
      for (const f of g.feeds) {
        const today = CHAT_TODAY[screen]?.[realKey(s)];
        if (today === undefined) expect(f, `${at}: the chat's messages`).toBeGreaterThanOrEqual(120);
        else {
          expect(f, `${at}: the chat's messages, no less than today's (a known gap: 120 is the target)`).toBeGreaterThanOrEqual(today - 1);
          notes.push(`${s.name}: chat ${Math.round(f)} px of messages (target 120)`);
        }
      }
      const b = g.board!.h;
      const target = boardTarget(s);
      if (b < target) {
        // (A whole number of device pixels: a few px either way with the scale.)
        const today = BOARD_TODAY[screen][realKey(s)] ?? target;
        expect(b, `${at}: the board (${b}) no smaller than today's ${today} (a known gap: the target is ${target})`).toBeGreaterThanOrEqual(today - 8);
        notes.push(`${s.name}: board ${Math.round(b)} px, target ${target}`);
      }
      if (end) {
        await resignFromGear(page);
        await page.waitForTimeout(800);
        const e = await realLayout(page);
        expect(e.scrollX, `${at}, its end page: no scrolling across`).toBeLessThanOrEqual(0);
        expect(e.cut, `${at}, its end page: nothing cut off at the top`).toEqual([]);
        // (Known gap: these end pages scroll down on the laptops today, and on Windows a page that scrolls down shows a scrollbar that
        // makes its 100vw widths scroll sideways too, as ranked 1 v 1's did. Held at today's; 0 is the target.)
        const today = END_SCROLL_TODAY[screen]?.[realKey(s)] ?? 0;
        expect(e.scrollY, `${at}, its end page: scrolls down no more than today's ${today} px (0 is the target)`).toBeLessThanOrEqual(today + 2);
        if (e.scrollY > 0) notes.push(`${s.name}: its end page scrolls ${e.scrollY} px down`);
      }
      await ctx.close();
    }
    test.info().annotations.push({ type: "known gaps", description: notes.join("; ") || "none" });
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
  // (His column grows with the board, so the pump has room beside him. Nov 1, the eval bar off for everyone: the boards are a player's
  // now, 1280 × 800 600 (was 536), 1366 × 768 640 (was 624). Round 2 (Nov 1): the pump is beside him at 1440 × 900 and 1920 × 1080 too,
  // so the board is 728 at 1440 (was 680) and 952 at 1920 (was 832, the taller bar's): his column is 240 to 340 px by the window's
  // height (board-size.css), and the side menu is icons only below 1800 px. Nov 7: his pump stands in front of him, so his column and
  // board are everyone's: 760 at 1440 (was 728).)
  for (const [size, board] of [["1280x800", 600], ["1920x1080", 952], ["1366x768", 640], ["1440x900", 760], ["1280x800", 600]] as const) {
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
 * Phones and tablets: the board's box (x, y, side) is a player's (no eval bar; Nov 1: the phone and tablet boxes that were main's
 * with the testers' bar on are these now, 360 px on a phone, not 312), to the pixel. Each screen opened at 390 × 844 and the
 * window then set to each size in turn. A tablet on its side (1024 × 768 and 1180 × 820, touch) keeps its old layout too: the
 * new sizes are a computer's (a mouse).
 */
/**
 * A computer's 50 v 50 (Eric, Nov 25; docs/decisions/2026-11-25-crowd-desktop-flush.md): the status line ("Move 5 · cut in 10 · P38/50 ·
 * −0.8 · CUT +0.2") centered over the board and bigger (22 px, 1.4 times its 16, where the board is wide enough; a narrower board's as
 * big as its width holds: about 18 px on 1280 × 800's 504 px board), one line, clear of the gear; the scoreboard, the board (its frame: the clock's bar under it) and the chat end
 * on one bottom line; the chat starts right under the panel's one fixed slot. A phone's line and panel are as before.
 */
test("a computer's 50 v 50 (Eric, Nov 25): the status line centered over the board and bigger; the scoreboard, the board and the chat on one bottom line at 1280 × 800, 1440 × 900, 1920 × 1080 and 2000 × 1100; a phone's as before", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "a computer and a phone, in their own windows");
  test.setTimeout(5 * 60_000);
  const lines = (page: Page) =>
    page.evaluate(() => {
      const wrap = document.querySelector<HTMLElement>(".board-area .board-row > .board-wrap")!;
      const css = getComputedStyle(wrap);
      const side = parseFloat(css.getPropertyValue("--board-size"));
      const w = wrap.getBoundingClientRect();
      const hud = document.querySelector(".screen.game > .hud-row > .hud")!;
      let l = Infinity, r = -Infinity;
      for (const c of hud.children) {
        const b = c.getBoundingClientRect();
        if (b.width) [l, r] = [Math.min(l, b.left), Math.max(r, b.right)];
      }
      const box = (s: string) => document.querySelector(s)?.getBoundingClientRect();
      return {
        foot: w.top + side + parseFloat(css.getPropertyValue("--timer-bar-h")),
        scoreboard: box(".arena > .tower-side")?.bottom ?? NaN,
        tableTop: box(".arena > .tower-side > .tower")?.top ?? NaN,
        top: w.top,
        chat: box(".screen.game > .under-board.side") ?? null,
        slot: box(".screen.game > .play-footer, .screen.game > .poll") ?? null,
        mid: (l + r) / 2,
        board: w.left + side / 2,
        words: r,
        gear: box(".screen.game > .hud-row > .mm")!.left,
        hudH: hud.getBoundingClientRect().height,
        font: parseFloat(getComputedStyle(hud).fontSize),
      };
    });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await into(page, "crowd");
  for (const size of ["1280x800", "1440x900", "1920x1080", "2000x1100"]) {
    const [w, h] = dims(size);
    await page.setViewportSize({ width: w, height: h });
    // (Measured after the window settles: board-foot.ts writes the line on a resize.)
    await expect.poll(async () => {
      const g = await lines(page);
      return Math.max(Math.abs(g.scoreboard - g.foot), Math.abs((g.chat?.bottom ?? NaN) - g.foot), Math.abs(g.tableTop - g.top), Math.abs(g.mid - g.board) - 1);
    }, { message: `${size}: the scoreboard's top and bottom on the board's (Eric: "the same height as the chessboard"), the chat's bottom, the line over its middle`, timeout: 5_000 }).toBeLessThanOrEqual(1);
    const g = await lines(page);
    expect(Math.abs(g.mid - g.board), `${size}: the status line centered over the board (${g.mid} / ${g.board})`).toBeLessThanOrEqual(2);
    expect(g.font, `${size}: the status line bigger (${g.font} px)`).toBeGreaterThanOrEqual(w > 1300 ? 22 : 18);
    expect(g.hudH, `${size}: one line`).toBeLessThanOrEqual(42.5);
    expect(g.words, `${size}: the words clear of the gear`).toBeLessThanOrEqual(g.gear);
    expect(g.chat!.top - g.slot!.bottom, `${size}: the chat right under the panel's slot`).toBeLessThanOrEqual(24);
    expect(Math.abs(g.slot!.height - 206), `${size}: the panel one fixed slot (${g.slot!.height})`).toBeLessThanOrEqual(1);
  }
  await ctx.close();
  // A phone: the line and the panel as before (16 px, the words from the left; the panel the locked screen's --mid-h, 151 px since Nov 25: the power-up row, six vote rows and the status line).
  const phone = await touchPage(browser);
  await into(phone.page, "crowd");
  const p = await phone.page.evaluate(() => {
    const hud = document.querySelector(".screen.game > .hud-row > .hud")!;
    return { font: getComputedStyle(hud).fontSize, justify: getComputedStyle(hud).justifyContent, slot: document.querySelector(".screen.game > .play-footer")!.getBoundingClientRect().height };
  });
  expect(p, "a phone: the status line and the panel as before").toEqual({ font: "16px", justify: "normal", slot: 151 });
  await phone.ctx.close();
});

const TOUCH = ["390x844", "430x932", "768x1024", "844x390", "1024x768", "1180x820"] as const;
const MAIN_TOUCH: Record<"alone" | "crowd" | "duel", Record<(typeof TOUCH)[number], [number, number, number]>> = {
  alone: { "390x844": [14, 153, 360], "430x932": [14, 153, 400], "768x1024": [118, 153, 530.7], "844x390": [292, 175, 259], "1024x768": [96, 133, 464], "1180x820": [384, 133, 402.7] },
  crowd: { "390x844": [14, 70, 360], "430x932": [14, 70, 400], "768x1024": [118, 70, 530.7], "844x390": [292, 85, 259], "1024x768": [52, 95, 552], "1180x820": [384, 95, 402.7] },
  duel: { "390x844": [14, 90, 360], "430x932": [14, 90, 400], "768x1024": [118, 90, 531], "844x390": [312, 104, 219], "1024x768": [69, 114, 517], "1180x820": [121, 114, 568] },
};
async function touchPage(browser: Browser) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
  return { ctx, page: await ctx.newPage() };
}
for (const screen of ["alone", "crowd", "duel"] as const) {
  test(`phones and tablets: ${screen}'s board box is a player's at 390 × 844, 430 × 932, 768 × 1024, a phone on its side and a tablet on its side`, async ({ browser }) => {
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

/**
 * Nov 1 (docs/decisions/2026-11-01-game-screens-computer.md): on a computer a boss battle has no title line: the boss's bar is
 * the top of the screen, its "Move N" left of the status, the admins' ⚡ and 🐟 and the gear at the top of the column beside the
 * board, the move list under them. The Crowd keeps its title line.
 */
test("a computer's boss screen: no title line; the boss's bar at the top, 'Move 1' left of its status; the gear at the column's top, beside the board; the Crowd keeps its title line", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "a computer only; it opens its own windows");
  test.setTimeout(6 * 60_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await into(page, "alone");
  await expect(page.locator(".screen.game > .hud-row"), "no title line").toHaveCount(0);
  const bar = (await page.locator(".screen.game > .boss-bar").boundingBox())!;
  expect(bar.y, "the boss's bar at the window's top").toBeLessThanOrEqual(8);
  const move = page.locator(".boss-bar .boss-move");
  await expect(move).toHaveText(/^Move 1$/);
  const [mv, st] = await Promise.all([move.boundingBox(), page.locator(".boss-bar .boss-next").boundingBox()]);
  expect(mv!.x + mv!.width, "'Move 1' left of the status").toBeLessThanOrEqual(st!.x + 1);
  const gear = page.locator(".screen.game > .gm-tools").getByRole("button", { name: "Match options" });
  await expect(gear).toHaveCount(1);
  const gb = (await gear.boundingBox())!;
  const board = (await look(page)).board;
  expect(gb.x, "the gear beside the board").toBeGreaterThanOrEqual(board.r);
  expect(gb.y, "the gear at the board's top").toBeLessThanOrEqual(board.y + 28);
  const crowd = await ctx.newPage();
  await into(crowd, "crowd");
  await expect(crowd.locator(".screen.game > .hud-row"), "the Crowd keeps its title line").toHaveCount(1);
  await ctx.close();
});

/**
 * Nov 14 (Eric: "put the chat box below [the moves], make it the same width"; styles.css, `.under-board.side` under `.mv-side`):
 * a boss battle's chat box sits under the moves panel, the same left edge and width, 12 px under it, and its foot stops above the
 * God King's line (the room he and your pawn stand in). A bot raid has no chat, so one is put in the screen for the check: this
 * tests the placement only, not what the chat shows.
 */
test("a computer's boss battle with chat: the chat box under the moves, the same left edge and width, 12 px under them, above the God King", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "a computer only; it opens its own windows");
  test.setTimeout(4 * 60_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await into(page, "alone");
  for (const size of ["1280x800", "1920x1080"] as Size[]) {
    const [w, h] = dims(size);
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const ub = document.createElement("div");
      ub.className = "under-board side";
      ub.setAttribute("data-probe", "chat");
      ub.innerHTML = '<div class="qchat"></div>';
      document.querySelector(".screen.game")!.appendChild(ub);
    });
    const g = await page.evaluate(() => {
      const box = (s: string) => {
        const e = document.querySelector(s);
        return e ? e.getBoundingClientRect() : null;
      };
      const r = (b: DOMRect | null) => (b ? { x: b.left, y: b.top, r: b.right, b: b.bottom } : null);
      return { moves: r(box(".mv-side")), chat: r(box('[data-probe="chat"]')), king: r(box(".boss-dock .gk-unit")) };
    });
    const at = `alone ${size} with chat`;
    expect(g.moves && g.chat, `${at}: the moves and the chat box`).toBeTruthy();
    expect(Math.abs(g.chat!.x - g.moves!.x), `${at}: the chat's left edge the moves'`).toBeLessThanOrEqual(1);
    expect(Math.abs(g.chat!.r - g.moves!.r), `${at}: the chat's width the moves'`).toBeLessThanOrEqual(1);
    expect(Math.abs(g.chat!.y - g.moves!.b - 12), `${at}: 12 px under the moves`).toBeLessThanOrEqual(1.5);
    if (g.king) expect(g.chat!.b, `${at}: the chat's foot above the God King's line`).toBeLessThanOrEqual(g.king.y);
    await page.evaluate(() => document.querySelector('[data-probe="chat"]')?.remove());
  }
  await ctx.close();
});

/**
 * The front door's side menu on a computer's game screens (Boss alone, the Crowd, 1 v 1, Squads): its labels wherever they cost the board
 * nothing, else icons only (the labels as tooltips, read by screen readers). Nov 25 (Eric: "Why isn't the names on the left appearing
 * there's plenty of space?"; docs/decisions/2026-11-25-menu-labels.md): the frame keeps the labels where the board is the same size and inside
 * its column with them (was: from 1800 px wide, Nov 1 round 2). At 1280 × 800 that's 1 v 1 only; Eric's laptop (1536 × 730 at 125%) has them
 * on every screen. A phone and a touch tablet have none (the touch test above keeps their boards to the pixel).
 */
test("a computer's game screens: the side menu is on each; its labels wherever the board is the same with them (Eric's laptop: every screen), else icons with the labels as tooltips", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "a computer only; it opens its own windows");
  test.setTimeout(12 * 60_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  // (Daily Quests (Eric, Nov 10): its tooltip says "Sign in for quests" while quests aren't yours. The season ladder's Ladder since Nov 25.)
  const items = ["Main menu", "Chess Town", "Boss Battle", "Play with friends", "Ladder", "Daily Quests", "Shop & crates", "Profile", "Settings"];
  const check = async (at: string, labels: boolean) => {
    const side = page.locator(".gm-frame > .fd-side");
    await expect(side, `${at}: the side menu`).toBeVisible();
    await expect(side.locator(".fd-menu-item"), `${at}: its items`).toHaveCount(items.length);
    for (const name of items)
      await expect(side.getByRole("button", { name, exact: true }), `${at}: ${name}`).toHaveAttribute("title", name === "Daily Quests" ? /^(Daily Quests|Sign in for quests)$/ : name);
    const w = (await side.boundingBox())!.width;
    const label = (await side.locator(".fd-menu-item > span:last-child").first().boundingBox())!;
    expect(Math.abs(w - (labels ? 232 : 80)), `${at}: the menu ${w} px wide`).toBeLessThanOrEqual(1);
    if (labels) expect(label.width, `${at}: its labels show`).toBeGreaterThan(20);
    else expect(label.width, `${at}: icons only (the label read by screen readers, not seen)`).toBeLessThanOrEqual(2);
  };
  await into(page, "alone");
  await check("alone 1280 x 800", false);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(500);
  await check("alone 1366 x 768", false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await check("alone 1440 x 900", false);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  await check("alone 1920 x 1080", true);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const screen of ["crowd", "duel", "squads"] as Screen[]) {
    await into(page, screen);
    // (1 v 1's board, the window's height less its strips, leaves its column the room: the labels.)
    await check(`${screen} 1280 x 800`, screen === "duel");
  }
  await ctx.close();
  // Eric's laptop (1536 × 730 at 125%): the labels on 1 v 1 and the 50 v 50, and each board the size it is with icons only, inside its column.
  const laptop = REAL_SCREENS[0];
  for (const screen of ["duel", "crowd"] as Screen[]) {
    const lc = await realScreenContext(browser, laptop);
    const lp = await lc.newPage();
    await into(lp, screen);
    await lp.waitForTimeout(300);
    const side = lp.locator(".gm-frame > .fd-side");
    expect(Math.abs((await side.boundingBox())!.width - 232), `${screen} on the ${laptop.name}: the labels`).toBeLessThanOrEqual(1);
    expect((await side.locator(".fd-menu-item > span:last-child").first().boundingBox())!.width, `${screen} on the ${laptop.name}: its labels show`).toBeGreaterThan(20);
    const board = (menu: string) =>
      lp.evaluate(
        ({ menu, sel }) => {
          document.getElementById("probe-menu")?.remove();
          if (menu) document.head.insertAdjacentHTML("beforeend", `<style id="probe-menu">.gm-frame { --gm-menu: ${menu} !important; }</style>`);
          const b = document.querySelector(`.board-area .board-row > .board-wrap ${sel}`)!.getBoundingClientRect();
          const a = document.querySelector(".board-area")!.getBoundingClientRect();
          return { w: b.width, inside: b.left >= a.left - 0.5 && b.right <= a.right + 0.5 };
        },
        { menu, sel: BOARD_SEL.container },
      );
    const shown = await board("");
    const icons = await board("80px");
    await board("");
    expect(shown.inside, `${screen} on the ${laptop.name}: the board inside its column`).toBe(true);
    expect(Math.abs(shown.w - icons.w), `${screen} on the ${laptop.name}: the board with the labels (${shown.w}) as with icons only (${icons.w})`).toBeLessThanOrEqual(0.5);
    if (screen === "duel") expect(Math.abs(shown.w - 621), `the 1 v 1's board on the ${laptop.name}: 621`).toBeLessThanOrEqual(1);
    await lc.close();
  }
});

/**
 * Nov 1: the side menu leaves a match the way the gear's Resign or Leave does: its confirm first (Cancel keeps the battle on),
 * then the match is out and the page it asked for is shown.
 */
test("a computer's side menu on a boss battle: its confirm first (Cancel keeps the battle), then the match is out and the page it asked for shows", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "a computer only; it opens its own windows");
  test.setTimeout(6 * 60_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await into(page, "alone");
  const side = page.locator(".gm-frame > .fd-side");
  await side.getByRole("button", { name: "Settings", exact: true }).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(ask).toHaveCount(0);
  await expect.poll(() => phase(page)).toBe("play");
  await side.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^(Resign|Leave)$/ }).click();
  await expect(page.locator(".fd-root.fd-on-settings"), "the page it asked for").toBeVisible({ timeout: 30_000 });
  await ctx.close();
});

