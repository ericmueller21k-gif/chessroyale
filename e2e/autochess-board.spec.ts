import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, named, test } from "./helpers.ts";
import { QUICK_CHAT } from "../packages/app/src/autochess/chat.ts";
import {
  phone, PLAIN, NEVER, FIGHT, TWOQ, MOVE, HELD, PRICES, watchErrors, root, goldOf, soundCount, clockOf, stepLabel, say, center, tap,
  tapGreyed, tapSquare, dragMouse, middle, offers, card, silhouette, piece, lockButton, xpButton, youBench, theirBench, held, benchMiddle,
  shopMiddle, buyAll,
} from "./autochess-helpers.ts";

/** Auto chess, part two (split from autochess.spec.ts on Nov 10, unchanged): the layouts, the hexagon timer, income, the computer's
 * screen, drags cut off by a step's end, star-ups, stars and outlines, the meeting before round 1, the action box. */
// (A tap or click that finds nothing fails in seconds, not at the test's end.)
test.use({ actionTimeout: 15_000 });
test.beforeEach(async ({ page }) => {
  await named(page, "Pawnder");
  await page.addInitScript(() => ((window as any).__soundLog = []));
});

/** What the page measures of the screen's layout (read in the browser), for `layouts` (Nov 8: the v4 screen). */
const measure = (p: Page) =>
  p.evaluate(() => {
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const all = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
    const mid = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const board = rect(".hb-board");
    const frame = rect(".ac-frame");
    const dock = rect(".ac-dock");
    const you = rect(".ac-bench.you");
    const hex = rect(".ac-clock");
    const row = rect(".ac-goldrow");
    return {
      down: document.documentElement.scrollHeight - innerHeight,
      side: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      board: { w: board.width, h: board.height },
      frame: { l: frame.left, r: frame.right, w: frame.width, h: frame.height, t: frame.top, b: frame.bottom },
      dock: { l: dock.left, r: dock.right, w: dock.width, t: dock.top, b: dock.bottom },
      col: rect(".ac-col").width,
      bench: { w: you.width, gap: frame.left - you.right },
      free: innerHeight - dock.bottom,
      // Everything on the screen, each box's left and right edges.
      edges: all(".ac-head, .ac-side, .ac-bench, .ac-slot, .ac-frame, .ac-dock, .ac-buy, .ac-btn, .ac-od").map((r) => ({ l: r.left, r: r.right })),
      cards: all(".ac-buy").map((b) => ({ w: b.width, h: b.height })),
      buttons: all(".ac-btn").map((b) => ({ w: b.width, h: b.height })),
      tiles: all(".ac-slot").map((b) => ({ w: b.width, h: b.height })),
      // (A phone's row under the board, v5: your block and your bench with its labels.)
      rowB: Math.max(rect(".ac-me").bottom, ...all(".ac-bench.you .ac-slot em").map((r) => r.bottom), you.bottom),
      benchPieces: all(".ac-bench .ac-slot.has .ac-pc").map((b) => b.width),
      overflow: {
        names: [...document.querySelectorAll(".ac-nm")].map((e) => e.scrollWidth - e.clientWidth),
        buttons: [...document.querySelectorAll(".ac-btn > span:first-child")].map((e) => (e as HTMLElement).getBoundingClientRect().right - (e.closest(".ac-btn")!.querySelector(".ac-btn-icon") as Element).getBoundingClientRect().left),
        row: (document.querySelector(".ac-goldrow") as HTMLElement).scrollWidth - (document.querySelector(".ac-goldrow") as HTMLElement).clientWidth,
      },
      // The hexagon: centered on the box, its words centered in it; the income left of it, the odds right of it.
      hex: { c: mid(hex), step: mid(rect(".ac-clock .ac-step")), time: mid(rect(".ac-clock b")), l: hex.left, r: hex.right, t: hex.top, b: hex.bottom },
      row: { c: mid(row), t: row.top, b: row.bottom, income: rect(".ac-income b").right, odds: rect(".ac-odds").left, oddsR: rect(".ac-odds").right },
    };
  });

test("layouts (Nov 8, the brief's numbers): nothing scrolls and everything is inside the screen; a square board; the action box as wide as the board; square cards, the same ratio on a phone and a computer; the hexagon's words centered; the benches' sizes; the band holds the widest gold and income; the board as big as fits", async ({ page }) => {
  const errors = watchErrors(page);
  const sizes = phone()
    ? ([[320, 568], [360, 640], [375, 667], [390, 664], [390, 844], [414, 896], [430, 932]] as const)
    : ([[1280, 800], [1280, 600], [1366, 768], [1440, 900], [1920, 1080]] as const);
  // A card's width over its height wherever it is 44 px or wider (under that, at 320 x 568, it is 44 tall: a real target).
  const ratios: number[] = [];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(HELD);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    // (Their bench filled, so a bench piece is measured too.)
    await expect(theirBench(page).locator(".ac-slot.has")).toHaveCount(2, { timeout: 10_000 });
    // The band at its widest (Eric: check at the widest realistic value): 3 digits of gold and an income of +200.
    await page.evaluate(() => {
      document.querySelector(".ac-gold-you b")!.textContent = "999";
      document.querySelector(".ac-income b")!.textContent = "+200";
    });
    const m = await measure(page);
    const where = `${w}×${h}`;
    expect(m.down, `${where}: scrolling down`).toBeLessThanOrEqual(0);
    expect(m.side, `${where}: sideways`).toBe(0);
    for (const e of m.edges) {
      expect(e.l, `${where}: inside the screen`).toBeGreaterThanOrEqual(-0.5);
      expect(e.r, `${where}: inside the screen`).toBeLessThanOrEqual(w + 0.5);
    }
    // A square board, and the action box exactly as wide as it, under it.
    expect(Math.abs(m.board.w - m.board.h), `${where}: a square board`).toBeLessThan(1);
    expect(Math.abs(m.frame.w - m.frame.h), `${where}: a square frame`).toBeLessThan(1);
    expect(Math.abs(m.dock.w - m.frame.w), `${where}: the action box is the board's width`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.dock.l - m.frame.l), `${where}: and lined up with it`).toBeLessThanOrEqual(0.5);
    // (v5: a bit below your row under the board.)
    expect(m.dock.t - m.rowB, `${where}: a bit below your row`).toBeGreaterThanOrEqual(4);
    expect(m.dock.t - m.rowB).toBeLessThanOrEqual(24);
    expect(m.dock.b, `${where}: the box on screen`).toBeLessThanOrEqual(h);
    // Four cards, each 44 px tall at least; square wherever it is 44 wide.
    expect(m.cards, `${where}: four cards`).toHaveLength(4);
    for (const c of m.cards) {
      expect(c.h, `${where}: a card's height`).toBeGreaterThanOrEqual(43.5);
      if (c.w >= 44) ratios.push(c.w / c.h);
      else expect(w, `${where}: only the narrowest phone has cards under 44 wide`).toBeLessThanOrEqual(320);
    }
    // Buy XP and Reroll: as tall as half a card each, at least 44 wide, their words clear of their icons.
    for (const b of m.buttons) expect(b.w, `${where}: a button's width`).toBeGreaterThanOrEqual(44);
    expect(m.overflow.buttons.every((x) => x <= 0.5), `${where}: the buttons' words`).toBe(true);
    expect(m.overflow.names.every((x) => x <= 0), `${where}: card labels`).toBe(true);
    // The benches (v5, phone and computer): 8 slots, each a board square (±0.5 px), a bench piece the board's piece size.
    expect(m.tiles, `${where}: four slots a bench`).toHaveLength(8);
    const square = m.board.w / 8;
    for (const t of m.tiles) {
      expect(Math.abs(t.w - square), `${where}: a tile is a square wide`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(t.h - square), `${where}: and tall`).toBeLessThanOrEqual(0.5);
    }
    expect(m.benchPieces.length, `${where}: their two held pieces`).toBe(2);
    for (const pc of m.benchPieces) expect(Math.abs(pc - square), `${where}: a bench piece is a board piece's size`).toBeLessThanOrEqual(0.5);
    // (A computer at 1280 x 800: squares about 50 px, Eric.)
    if (w === 1280 && h === 800) expect(square, "1280 x 800: about 50 px squares").toBeGreaterThanOrEqual(46);
    // The hexagon: centered on the box; its step name and time centered in it, the name over the time; the income left of it and the odds right of it.
    expect(Math.abs(m.hex.c.x - (m.dock.l + m.dock.w / 2)), `${where}: the hexagon is centered on the box`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.hex.c.y - m.row.c.y), `${where}: in the band's middle`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.hex.step.x - m.hex.c.x), `${where}: the step name centered`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.hex.time.x - m.hex.c.x), `${where}: the time centered`).toBeLessThanOrEqual(1);
    expect(Math.abs((m.hex.step.y + m.hex.time.y) / 2 - m.hex.c.y), `${where}: the words centered top to bottom`).toBeLessThanOrEqual(3);
    expect(m.hex.step.y, `${where}: the name over the time`).toBeLessThan(m.hex.time.y);
    expect(m.hex.t, `${where}: inside the band`).toBeGreaterThanOrEqual(m.row.t - 0.5);
    expect(m.hex.b).toBeLessThanOrEqual(m.row.b + 0.5);
    expect(m.row.income, `${where}: the income left of the hexagon`).toBeLessThanOrEqual(m.hex.l + 6);
    expect(m.row.odds, `${where}: the odds right of the hexagon`).toBeGreaterThanOrEqual(m.hex.r - 6);
    expect(m.row.oddsR, `${where}: the odds inside the box`).toBeLessThanOrEqual(m.dock.r);
    expect(m.overflow.row, `${where}: nothing overflows the band`).toBeLessThanOrEqual(0);
    await expect(page.locator(".ac-income b")).toHaveText("+200");
    if (phone()) {
      // Every phone gets some free room at the bottom; the board is as big as fits (v5): the frame 8 px from each edge (to the 8 px the board
      // snaps to: within 1 px at 360, 390, 430 wide), or as tall as the height allows (under 360 wide, 36 px kept free for the fight's words). Centered.
      expect(m.free, `${where}: free room at the bottom`).toBeGreaterThanOrEqual(11.5);
      expect(Math.abs(m.frame.l - (w - m.frame.r)), `${where}: centered`).toBeLessThanOrEqual(1);
      expect(m.frame.l >= 7.5 && (m.frame.l <= 12.5 || m.free <= (w < 360 ? 50 : 26)), `${where}: the board is as big as fits (frame at ${m.frame.l}, ${m.free} free)`).toBe(true);
      if (w === 390 && h === 844) expect(Math.abs(m.frame.l - 8), "390 x 844: the frame 8 px from each edge").toBeLessThanOrEqual(0.5);
    }
  }
  // The same card ratio everywhere (square), phone or computer.
  for (const r of ratios) expect(Math.abs(r - 1), `a card's ratio ${r}`).toBeLessThanOrEqual(0.04);
  expect(errors).toEqual([]);
});

test("layouts: the short words of every message fit over the board's foot at 320 px (at most 2 lines, inside the board), and neither they nor the Sell button move anything", async ({ page }) => {
  test.skip(!phone(), "320 px");
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(TWOQ);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await tap(page, card(page, 0));
  // (A real message first, so its box is there to lay the others into.)
  await card(page, 3).click({ force: true });
  await expect(say(page)).toBeVisible();
  // Every message the screen can say (the longest first), laid into the spot.
  const words = [
    "Board full. Drag to bench",
    "Tap a piece, then a square",
    "Undo the other first",
    "Moved. Tap ↩ to undo.",
    "Board full: buy XP",
    "Level 10: 10 pieces",
    "Too many pieces",
    "Only the lit piece",
    "No piece can move",
    "Not on back rank",
    "Need 9 more",
    "King: set by game",
    "You're locked in",
    "First: +3 gold",
    "Top level (10)",
    "One queen max",
    "8 pawns max",
    "h4 rolled again",
  ];
  const where = () => page.evaluate(() => ({ frame: document.querySelector(".ac-frame")!.getBoundingClientRect().toJSON(), dock: document.querySelector(".ac-dock")!.getBoundingClientRect().toJSON() }));
  const before = await where();
  for (const text of words) {
    const r = await page.evaluate((t) => {
      const sp = document.querySelector(".ac-frame > .ac-msg")!;
      sp.textContent = t;
      const b = sp.getBoundingClientRect();
      const lineH = parseFloat(getComputedStyle(sp).lineHeight);
      const pad = parseFloat(getComputedStyle(sp).paddingTop) + parseFloat(getComputedStyle(sp).paddingBottom);
      const f = document.querySelector(".ac-frame")!.getBoundingClientRect();
      return { lines: Math.round((b.height - pad) / lineH), l: b.left, r: b.right, b: b.bottom, fl: f.left, fr: f.right, fb: f.bottom, over: sp.scrollWidth - sp.clientWidth };
    }, text);
    expect(r.lines, `"${text}": lines`).toBeLessThanOrEqual(2);
    expect(r.l, `"${text}": inside the board`).toBeGreaterThanOrEqual(r.fl);
    expect(r.r, `"${text}": inside the board`).toBeLessThanOrEqual(r.fr);
    expect(r.b, `"${text}": over the board's foot`).toBeLessThanOrEqual(r.fb);
    expect(r.over, `"${text}": no overflow`).toBeLessThanOrEqual(0);
  }
  // The Sell button (a piece of yours selected) is over the cards, a real target; nothing moves for it.
  await tapSquare(page, "g3");
  const sell = page.getByRole("button", { name: /^Sell \d+$/ });
  await expect(sell).toBeVisible();
  const sb = (await sell.boundingBox())!;
  expect(sb.height).toBeGreaterThanOrEqual(44);
  expect(sb.width).toBeGreaterThanOrEqual(44);
  const after = await where();
  expect(after).toEqual(before);
  expect(errors).toEqual([]);
});

test("layouts: the board never moves from step to step (buy, move, fight, result), nothing scrolls, and the fight's and the result's boxes hold their words, at the narrowest screen, a phone and a computer", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  const sizes = phone() ? ([[320, 568], [390, 844]] as const) : ([[1280, 800]] as const);
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(FIGHT);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await buyAll(page, 4);
    const where = `${w}×${h}`;
    const grab = async () => {
      const board = (await page.locator(".hb-board").boundingBox())!;
      const frame = (await page.locator(".ac-frame").boundingBox())!;
      const me = (await page.locator(".ac-me").boundingBox())!;
      const dock = (await page.locator(".ac-dock").boundingBox())!;
      const m = await page.evaluate(() => ({ down: document.documentElement.scrollHeight - innerHeight, side: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      return { board, frame, me, dockTop: dock.y, dockBottom: dock.y + dock.height, ...m };
    };
    const buy = await grab();
    await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
    const move = await grab();
    await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 15_000 });
    // (After the banner's first moments: the fight's box with its rules.)
    await expect(page.locator(".ac-card-text")).toBeVisible();
    const fight = await grab();
    const clipped = () => page.locator(".ac-card").evaluate((el) => Array.from(el.children).filter((c) => c.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 0.5).length + (el.scrollHeight > el.clientHeight ? 1 : 0));
    expect(await clipped(), `${where}: the fight's box holds its words`).toBe(0);
    await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 200_000 });
    const result = await grab();
    expect(await clipped(), `${where}: the result's box holds its words`).toBe(0);
    for (const [name, step] of [["buy", buy], ["move", move], ["fight", fight], ["result", result]] as const) {
      expect(step.down, `${where}, ${name}: scrolling down`).toBeLessThanOrEqual(0);
      expect(step.side, `${where}, ${name}: sideways`).toBe(0);
      // The board, its frame, your pawn and the top of the dock stay where they were: nothing moves when the step changes.
      expect(Math.abs(step.board.x - buy.board.x) + Math.abs(step.board.y - buy.board.y) + Math.abs(step.board.width - buy.board.width), `${where}, ${name}: the board`).toBeLessThan(1);
      expect(Math.abs(step.frame.y - buy.frame.y) + Math.abs(step.me.y - buy.me.y), `${where}, ${name}: your row under the board`).toBeLessThan(1);
      expect(Math.abs(step.dockTop - buy.dockTop), `${where}, ${name}: the dock's top`).toBeLessThan(1);
      expect(step.dockBottom, `${where}, ${name}: the box on screen`).toBeLessThanOrEqual(h);
    }
  }
  expect(errors).toEqual([]);
});

test("the hexagon timer (Nov 8): between the income and the odds, the step's name over the time, counting down and red as the step locks; no timer bars", async ({ page }) => {
  const errors = watchErrors(page);
  for (const [w, h] of phone() ? ([[320, 568], [428, 777]] as const) : ([[1280, 800]] as const)) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(PLAIN);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    const where = `${w}×${h}`;
    const order = await page.locator(".ac-goldrow > *").evaluateAll((els) => els.map((e) => (e as HTMLElement).className.split(" ")[0]));
    expect(order, `${where}: gold, income, the hexagon, the odds`).toEqual(["ac-gold-you", "ac-income", "ac-clock", "ac-odds"]);
    await expect(page.locator(".ac-root .timer-bar")).toHaveCount(0);
    // Its own border: the gold edge round a dark middle.
    const look = await page.evaluate(() => ({ edge: getComputedStyle(document.querySelector(".ac-clock")!).backgroundImage, middle: getComputedStyle(document.querySelector(".ac-clock-in")!).backgroundColor, clip: getComputedStyle(document.querySelector(".ac-clock")!).clipPath }));
    expect(look.edge, `${where}: a gold edge`).toContain("gradient");
    expect(look.clip, `${where}: a hexagon`).toContain("polygon");
    expect(look.middle, `${where}: a dark middle`).not.toBe("rgba(0, 0, 0, 0)");
    await expect(clockOf(page)).toHaveText(/^0:0[4-7]$/);
    await expect(stepLabel(page)).toHaveText("Planning");
    const first = Number((await clockOf(page).innerText()).slice(2));
    await expect.poll(async () => Number((await clockOf(page).innerText()).slice(2))).toBeLessThan(first);
    await expect(stepLabel(page)).toHaveText("Locked", { timeout: 8000 });
    expect(await page.locator(".ac-clock").evaluate((el) => el.classList.contains("low"))).toBe(true);
    expect(await clockOf(page).evaluate((el) => getComputedStyle(el).color), `${where}: red`).toBe("rgb(240, 86, 75)");
  }
  expect(errors).toEqual([]);
});

test("Income (Nov 8): '+N' in green, a tap opens the breakdown (base, interest, the streak, the round bonus, the total) over the board's foot, a tap closes it, and nothing moves", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const income = page.locator(".ac-income");
  await expect(income.locator("b")).toHaveText("+10");
  expect(await income.locator("b").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(74, 222, 128)");
  const place = () => page.evaluate(() => [".ac-frame", ".ac-dock", ".ac-bench.you", ".ac-me"].map((s) => document.querySelector(s)!.getBoundingClientRect().toJSON()));
  const before = await place();
  await expect(income).toHaveAttribute("aria-expanded", "false");
  await income.click();
  const box = page.getByRole("group", { name: "Income this round" });
  await expect(box).toBeVisible();
  await expect(income).toHaveAttribute("aria-expanded", "true");
  await expect(box.locator(".ac-income-line span")).toHaveText(["Base", "Interest (0 gold)", "Win streak (0)", "Round bonus", "Total"]);
  await expect(box.locator(".ac-income-line b")).toHaveText(["+10", "+0", "+0", "+0", "+10"]);
  // Over the board's foot, from the box's left edge, inside the screen.
  const [b, frame, dock] = [(await box.boundingBox())!, (await page.locator(".ac-frame").boundingBox())!, (await page.locator(".ac-dock").boundingBox())!];
  expect(b.y + b.height).toBeLessThanOrEqual(dock.y);
  expect(b.y).toBeGreaterThanOrEqual(frame.y);
  expect(Math.abs(b.x - dock.x)).toBeLessThanOrEqual(4);
  expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await place()).toEqual(before);
  await income.click();
  await expect(box).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a computer (Nov 8): the left menu and the right column stand where home has them (nothing shifts on the way in); the column's top slot says AUTO CHESS and the round and step; no title block or back button", async ({ page }) => {
  test.skip(phone(), "a computer's frame");
  const errors = watchErrors(page);
  for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]] as const) {
    await page.setViewportSize({ width: w, height: h });
    const sides = () => page.evaluate(() => [".fd-side", ".fd-right", ".fd-side .fd-menu-item"].map((s) => document.querySelector(s)!.getBoundingClientRect().toJSON()));
    await page.goto("/");
    await expect(page.locator(".fd-right .rc-friends")).toBeVisible();
    const home = await sides();
    await page.goto(PLAIN);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    expect(await sides(), `${w}×${h}: the menu and the column`).toEqual(home);
    await expect(page.locator(".rc-slot .rc-h")).toHaveText("AUTO CHESS");
    await expect(page.locator(".rc-slot .ac-slot-line")).toHaveText("Round 1 · Planning phase");
    await expect(page.locator(".ac-title")).toBeHidden();
    await expect(page.getByRole("button", { name: "Back to home" })).toHaveCount(0);
    // The screen is between them, nothing under either.
    const [col, menu, right] = [(await page.locator(".ac-col").boundingBox())!, home[0]!, home[1]!];
    expect(col.x).toBeGreaterThanOrEqual(menu.right);
    expect(col.x + col.width).toBeLessThanOrEqual(right.left);
  }
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Drags cut off, silhouettes that are only tapped, a sale of a piece that isn't there (Eric's first test of the new fights, Oct 21:
// docs/decisions/2026-10-21-autochess-drag-fixes.md). Each of these failed on main (bc9a97e) before its fix.
// ---------------------------------------------------------------------------------------------------------------------------------

const ghosts = (p: Page) => p.locator(".ac-ghost");
const sellZone = (p: Page) => p.locator(".ac-sell-drop");
/**
 * What a drag that does nothing must leave alone: your gold, your pieces on the board (each one's color, kind and square) and the bench. Only those: a piece's other
 * classes (a slide, its stars' outline, the reveal's gray, which can change on any tick of the step) aren't what it holds.
 */
const holdings = (p: Page) =>
  p.evaluate(() => ({
    gold: Number(document.querySelector(".ac-gold-you b")?.textContent),
    board: [...document.querySelectorAll(".hb-board piece.white")]
      .map((e) => `white ${["pawn", "knight", "bishop", "rook", "queen", "king"].find((k) => e.classList.contains(k)) ?? "?"}@${(e as HTMLElement).dataset.square}`)
      .sort(),
    bench: [...document.querySelectorAll(".ac-bench.you .ac-slot.has")].map((e) => `${(e as HTMLElement).dataset.kind}@${(e as HTMLElement).dataset.square}`),
  }));
/** Every white piece drawn on the page (not the avatar's pawn, the side menu's Profile pawn or the shop's, the bench's and the odds' little icons), and those on the board itself: a ghost is drawn outside the board. */
const whitePieces = (p: Page) =>
  p.evaluate(() => ({
    all: [...document.querySelectorAll("piece.white")].filter((e) => !e.closest(".ac-pawn, .ac-pc, .fd-side")).length,
    board: document.querySelectorAll(".hb-board piece.white").length,
  }));
/** The mouse button goes down on a point and the pointer moves off it: a drag in progress, the button still down. */
async function pickUp(p: Page, from: { x: number; y: number }, by = { x: 14, y: -40 }) {
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move(from.x + 6, from.y - 6, { steps: 2 });
  await p.mouse.move(from.x + by.x, from.y + by.y, { steps: 4 });
}
/** A finger down on a point and moved to another, still down: `end` lifts it, `cancel` has the browser cancel it. */
async function holdTouch(p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await p.context().newCDPSession(p);
  const point = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from.x, from.y) });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8) });
  const finish = async (type: "touchEnd" | "touchCancel") => {
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [] });
    await cdp.detach();
  };
  return { end: () => finish("touchEnd"), cancel: () => finish("touchCancel") };
}

// (The stars step, the default since v8, with a 2-star knight on e2 to pick up; and v7's, behind its setting, with the knight bought on e2 and lit.)
for (const mode of ["stars", "legal"] as const) {
test(`a drag cut off by the end of the move step ends with it: no frozen ghost over the fight, the result or the next round (Eric's second queen on g1; ${mode} step)`, async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.goto(mode === "stars" ? `${MOVE}&stars=n@e2:2` : `${MOVE}&adjustmode=legal`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The knight on e2: the lit piece of v7's move step (seed 24), or a 2-star's.
  if (mode === "legal") await tap(page, card(page, 0));
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  // Pick the knight up, as Eric picked up his queen, and keep holding: the drag is live, its ghost under the pointer.
  await pickUp(page, await center(page, "e2"), { x: 24, y: -36 });
  await expect(ghosts(page)).toHaveCount(1);
  // The step ends under the finger: the fight begins, and the drag is over: no ghost, only the pieces that are really there.
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result)$/, { timeout: 15_000 });
  await expect(ghosts(page)).toHaveCount(0);
  const mid = await whitePieces(page);
  expect(mid.all, "no white piece drawn off the board").toBe(mid.board);
  expect(mid.board, "the king and the knight at most").toBeLessThanOrEqual(2);
  // Letting go afterwards changes nothing.
  await page.mouse.move(300, 300, { steps: 3 });
  await page.mouse.up();
  await expect(ghosts(page)).toHaveCount(0);
  await expect(root(page)).toHaveAttribute("data-phase", "result", { timeout: 200_000 });
  await expect(ghosts(page)).toHaveCount(0);
  const end = await whitePieces(page);
  expect(end.all).toBe(end.board);
  // The next round starts clean: no ghost, no "Drop to sell" over the shop, and drags work (an offer is held by dragging its card onto the bench).
  await tap(page, page.getByRole("button", { name: "Next round" }));
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(ghosts(page)).toHaveCount(0);
  await expect(sellZone(page)).toHaveCount(0);
  await expect(page.locator(".ac-shop")).not.toHaveClass(/selling/);
  const gold = await goldOf(page);
  const price = PRICES[(await offers(page))[0]!.kind]!;
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(gold - price);
  expect(errors).toEqual([]);
});
}

for (const via of ["a shop card", "a piece on the board", "a held piece"] as const) {
  test(`a drag from ${via} that is still held when the buy step locks ends there with no action, and stays ended through the end of the step`, { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.goto("/autochess?quick=1&seed=9&intro=0");
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    const shown = await offers(page);
    const pawn = shown.findIndex((o) => o.kind === "p");
    let from: { x: number; y: number };
    let to: { x: number; y: number };
    if (via === "a shop card") {
      from = middle((await card(page, pawn).boundingBox())!);
      to = await benchMiddle(page);
    } else if (via === "a piece on the board") {
      await tap(page, card(page, pawn));
      await expect(piece(page, "white", "pawn", shown[pawn]!.square)).toBeVisible();
      from = await center(page, shown[pawn]!.square);
      to = await shopMiddle(page);
    } else {
      await dragMouse(page, middle((await card(page, pawn).boundingBox())!), await benchMiddle(page));
      await expect(held(page)).toHaveCount(1);
      from = middle((await held(page).first().boundingBox())!);
      to = await shopMiddle(page);
    }
    const before = await holdings(page);
    await pickUp(page, from);
    await expect(ghosts(page)).toHaveCount(1);
    // The last seconds lock the step: the drag ends there (nothing follows the finger through the lock), and the drop does nothing.
    await expect(stepLabel(page)).toHaveText("Locked", { timeout: 8000 });
    // (Within a moment of "Locked" showing, not by the end of the two locked seconds.)
    await expect(ghosts(page)).toHaveCount(0, { timeout: 700 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await expect(ghosts(page)).toHaveCount(0);
    await expect(sellZone(page)).toHaveCount(0);
    expect(await holdings(page)).toEqual(before);
    // The step ends with the button still down: still no ghost, and then the release changes nothing either.
    await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 8000 });
    await expect(ghosts(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(ghosts(page)).toHaveCount(0);
    expect(await goldOf(page)).toBe(before.gold);
    expect((await holdings(page)).board).toEqual(before.board);
    expect(errors).toEqual([]);
  });
}

test("locking in under a drag ends the drag: the bonus is the only gold that moves, and nothing is held (lock-in behind `?lockin=1`)", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${NEVER}&lockin=1`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await pickUp(page, middle((await card(page, 1).boundingBox())!));
  await expect(ghosts(page)).toHaveCount(1);
  // (A click on the button while the mouse button is down on the card: a second pointer, a keyboard or a switch does the same.)
  await lockButton(page).evaluate((b) => (b as HTMLButtonElement).click());
  await expect(ghosts(page)).toHaveCount(0);
  const b = await benchMiddle(page);
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await expect(ghosts(page)).toHaveCount(0);
  // (10 gold and the lock-in bonus, 3: nothing was bought.)
  expect(await goldOf(page)).toBe(13);
  await expect(held(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a drag whose pointer is cancelled or loses its capture ends with no action: nothing bought, held or sold, no ghost", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => document.addEventListener("pointerdown", (e) => ((window as any).__pointer = e.pointerId), true));
  await page.goto("/autochess?seed=9&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const shown = await offers(page);
  const pawn = shown.findIndex((o) => o.kind === "p");
  const before = await holdings(page);
  // The capture is lost mid-drag (the browser took the pointer away): the drag is dropped, so the bench gets nothing.
  const cardBox = (await card(page, pawn).boundingBox())!;
  await pickUp(page, middle(cardBox));
  await expect(ghosts(page)).toHaveCount(1);
  await page.evaluate((slot) => document.querySelector(`.ac-buy[data-slot="${slot}"]`)!.releasePointerCapture((window as any).__pointer), pawn);
  await expect(ghosts(page)).toHaveCount(0);
  const b = await benchMiddle(page);
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  expect(await holdings(page)).toEqual(before);
  // A cancelled pointer (a phone's touch the browser takes for a scroll) does the same.
  if (phone()) {
    const finger = await holdTouch(page, middle((await card(page, pawn).boundingBox())!), b);
    await expect(ghosts(page)).toHaveCount(1);
    await finger.cancel();
    await expect(ghosts(page)).toHaveCount(0);
    expect(await holdings(page)).toEqual(before);
  }
  // Nothing is stuck: a drag after both still holds the card's piece.
  await dragMouse(page, middle((await card(page, pawn).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(before.gold - PRICES[shown[pawn]!.kind]!);
  expect(errors).toEqual([]);
});

test("a silhouette on the board is only tapped: pressing it and dragging it picks nothing up and drops nothing, on the sell zone, the bench or the board (Eric: 'it just sold a piece that didn't exist')", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const shown = await offers(page);
  const pawns = shown.flatMap((o, slot) => (o.kind === "p" ? [slot] : []));
  const [first, second] = pawns as [number, number];
  // One of yours to be sold if the silhouette's drag could reach it: the first pawn, bought by tap.
  await tap(page, card(page, first));
  await expect(piece(page, "white", "pawn", shown[first]!.square)).toBeVisible();
  const before = await holdings(page);
  const offersBefore = await offers(page);
  const at = middle((await silhouette(page, second).boundingBox())!);
  const targets = { "the sell zone": await shopMiddle(page), "the bench": await benchMiddle(page), "the board": await center(page, "e3"), "the shop's edge": { x: at.x, y: (await page.locator(".ac-shop").boundingBox())!.y + 2 } };
  for (const [name, to] of Object.entries(targets)) {
    await pickUp(page, at, { x: 8, y: -8 });
    await page.mouse.move(to.x, to.y, { steps: 8 });
    // (Nothing follows the pointer, and neither the shop nor the bench lights up for a drop.)
    await expect(ghosts(page), `a silhouette dragged to ${name}: no ghost`).toHaveCount(0);
    await expect(sellZone(page), `${name}: no drop zone`).toHaveCount(0);
    await expect(youBench(page), `${name}: the bench isn't lit`).not.toHaveClass(/lit/);
    await page.mouse.up();
    expect(await holdings(page), `dropped on ${name}: nothing changed`).toEqual(before);
    expect(await offers(page), `${name}: the shop is as it was`).toEqual(offersBefore);
    await expect(page.locator(".ac-sil")).toHaveCount(4);
    expect(await soundCount(page, "sell"), `${name}: nothing sold`).toBe(0);
  }
  await expect(page.locator(".ac-float")).toHaveCount(0);
  // A finger does the same.
  if (phone()) {
    for (const [name, to] of Object.entries(targets)) {
      const finger = await holdTouch(page, at, to);
      await expect(ghosts(page), `a finger dragging a silhouette to ${name}: no ghost`).toHaveCount(0);
      await finger.end();
      expect(await holdings(page), `a finger's drop on ${name}`).toEqual(before);
    }
  }
  // A tap still buys it, though a finger wobbles a little (a few pixels) as it taps.
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 3, at.y - 2, { steps: 2 });
  await page.mouse.up();
  await expect(piece(page, "white", "pawn", shown[second]!.square)).toBeVisible();
  expect(await goldOf(page)).toBe(before.gold - PRICES.p!);
  expect(errors).toEqual([]);
});

test("a sale only pays for a piece of yours that is there: selling a piece the pointer is still carrying (the Sell button, the keyboard) pays once, not again at the drop", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const shown = await offers(page);
  const pawn = shown.findIndex((o) => o.kind === "p");
  await tap(page, card(page, pawn));
  await expect(piece(page, "white", "pawn", shown[pawn]!.square)).toBeVisible();
  const gold = await goldOf(page);
  // Pick the pawn up (picking it up selects it, so "Sell 1" shows), then sell it with the keyboard while it is still held.
  await pickUp(page, await center(page, shown[pawn]!.square), { x: 10, y: -30 });
  await expect(ghosts(page)).toHaveCount(1);
  const sell = page.getByRole("button", { name: "Sell 1", exact: true });
  await sell.focus();
  await page.keyboard.press("Enter");
  await expect(piece(page, "white", "pawn", shown[pawn]!.square)).toHaveCount(0);
  expect(await goldOf(page)).toBe(gold + 1);
  // Dropping what is no longer there on the sell zone: no second payment (it was a NaN before), no second "Sold".
  const shop = await shopMiddle(page);
  await page.mouse.move(shop.x, shop.y, { steps: 6 });
  await page.mouse.up();
  await expect(ghosts(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(gold + 1);
  expect(await soundCount(page, "sell")).toBe(1);
  await expect(page.locator(".ac-float")).toHaveCount(1);
  await expect(say(page)).toHaveText("Sold for 1");
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Stars (v8, Eric Oct 22; docs/decisions/2026-10-22-autochess-stars.md)
//
// The seeds below are found by the pure code (the same rolls) with the test switches `?stars=` (your board), `?benchstars=` (your bench) and `?botbench=` (the bot's, which it places
// for nothing): the shop rolls for the army that is there, so a test never leans on luck. A star after a piece in a shop is the stars its star-up would make.
// 43, `stars=n@c2:1,b@d2:2,r@a1:1,n@g3:2` (a full board at level 4): king b1; shop bishop a4, knight c2*2, pawn e3, bishop d2*3: a gold card and a rainbow one. The bot (king b8) has no star.
// 43, `stars=n@g3:2,b@d2:3,r@a1:1,n@c2:1`: the move step with a 2-star knight on g3 (its squares e2, e4, f1, h1), a 3-star bishop on d2, a plain rook and a plain knight; nobody else is starred, so 5 s + 3 s x 2.
// 16, `benchstars=b@f3:1` (a bishop held for f3): king a2; shop pawn b3, knight c4, bishop f3*2, pawn e3: a gold card for the held bishop. The bot (king a7) has no star.
// 1, `botbench=n@c7:2,b@f8:3&stars=n@c2:1,b@d2:1`: the bot (king b7) places a 2-star knight on c7 (1.17 s) and a 3-star bishop on f8 (1.52 s) for nothing, and buys nothing starred;
// you (king b2) start with a plain knight on c2 and bishop on d2 (since Nov 2 a piece of theirs shows only with a match of yours: theirs were placed later, so c7 shows
// at 1.5 s, your c2 at 3 s, f8 at 4.5 s).
const STARS = "/autochess?quick=1&seed=43&stars=n@c2:1,b@d2:2,r@a1:1,n@g3:2&intro=0";
const STARMOVE = "/autochess?quick=1&seed=43&stars=n@g3:2,b@d2:3,r@a1:1,n@c2:1&intro=0";
const STARBENCH = "/autochess?quick=1&seed=16&benchstars=b@f3:1&intro=0";
const BOTSTARS = "/autochess?quick=1&seed=1&botbench=n@c7:2,b@f8:3&stars=n@c2:1,b@d2:1&intro=0";
const GOLD = "242, 193, 78";
/** The stars drawn on the board by square, each with its count: they are drawn inside their piece's own element (so they slide with it). */
const marks = (p: Page) => p.locator(`${BOARD_SEL.piece} .ac-art`).evaluateAll((els) => Object.fromEntries(els.map((e) => [(e.closest("piece") as HTMLElement).dataset.square!, Number((e as HTMLElement).dataset.stars)])));
/** The starred pieces on the board that have their outline on, by square, each with its count. */
const outlined = (p: Page) =>
  p.locator(`${BOARD_SEL.piece}.ac-drawn .ac-art[data-outline="1"]`).evaluateAll((els) => Object.fromEntries(els.map((e) => [(e.closest("piece") as HTMLElement).dataset.square!, Number((e as HTMLElement).dataset.stars)])));
/** The colors a starred piece's outline is drawn in (the stops of its gradient), as `#rrggbb` text. */
const outlineColors = (art: Locator) => art.locator("linearGradient stop").evaluateAll((els) => els.map((e) => (e.getAttribute("stop-color") ?? "").toLowerCase()));
const GOLD_STOPS = ["#ffd84d", "#f0a500"];
const PRISM_STOPS = ["#22bfa9", "#1fb6cf", "#2fa3e6", "#5b84f0", "#8d68e6", "#d25ccb", "#ff6f73", "#ff9a5c"];
/** Every phase change from now on, each with when and the stars on the board at that moment (`stepSeconds` reads the move step's length from it; `marksAt` the stars as a step began: the fight moves every 60 ms here, so a later read has seen moves). */
async function watchPhases(p: Page) {
  await p.evaluate((sel) => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const stars = () => Object.fromEntries([...document.querySelectorAll<HTMLElement>(`${sel} .ac-art`)].map((e) => [(e.closest("piece") as HTMLElement).dataset.square!, Number(e.dataset.stars)]));
    const list: { phase: string; at: number; marks: Record<string, number> }[] = [{ phase: root.dataset.phase!, at: performance.now(), marks: stars() }];
    (window as any).__phases = list;
    new MutationObserver(() => {
      if (list[list.length - 1]!.phase !== root.dataset.phase) list.push({ phase: root.dataset.phase!, at: performance.now(), marks: stars() });
    }).observe(root, { attributes: true, attributeFilter: ["data-phase"] });
  }, BOARD_SEL.piece);
}
const marksAt = async (p: Page, phase: string) => (await p.evaluate(() => (window as any).__phases as { phase: string; marks: Record<string, number> }[])).find((m) => m.phase === phase)!.marks;
const stepSeconds = async (p: Page) => {
  const list = await p.evaluate(() => (window as any).__phases as { phase: string; at: number }[]);
  const start = list.find((m) => m.phase === "adjust")!;
  const end = list.find((m) => m.at > start.at && m.phase !== "adjust")!;
  return (end.at - start.at) / 1000;
};
const dotSquares = (p: Page) => p.locator(".ac-dot").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.square!).sort());

test("a star-up offer (v8): a gold card for a second star, a prismatic one for a third, the price 1, its piece drawn with the stars and outline it will have, nothing on the board for it and no silhouette; buying one adds no piece, takes 1, and the stars show on the piece", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(STARS);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // A full board (level 4: four pieces) and four offers: a bishop, the knight's star-up, a pawn, the bishop's star-up.
  expect(await offers(page)).toEqual([
    { kind: "b", square: "a4" },
    { kind: "n", square: "c2" },
    { kind: "p", square: "e3" },
    { kind: "b", square: "d2" },
  ]);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  expect(await marks(page)).toEqual({ g3: 2, d2: 2 });
  // The cards: gold for the knight (it would be a 2-star), prismatic for the bishop (a 3-star), the others plain; a star-up costs 1, whatever the piece.
  await expect(card(page, 1)).toHaveAttribute("data-up", "2");
  await expect(card(page, 1)).toHaveClass(/\bup2\b/);
  await expect(card(page, 3)).toHaveAttribute("data-up", "3");
  await expect(card(page, 3)).toHaveClass(/\bup3\b/);
  for (const slot of [0, 2]) await expect(card(page, slot)).not.toHaveClass(/\bup\b/);
  await expect(card(page, 1).locator(".ac-cost b")).toHaveText("1");
  await expect(card(page, 3).locator(".ac-cost b")).toHaveText("1");
  await expect(card(page, 0).locator(".ac-cost b")).toHaveText("3");
  await expect(card(page, 1)).toHaveAttribute("aria-label", /^Star up your knight on c2 to 2 stars, 1 gold/);
  // The piece on a card is drawn with the stars it will become (2, then 3) and the outline of that many (gold, then prismatic); a plain card has neither.
  await expect(card(page, 1).locator('.ac-art[data-stars="2"] .ac-star')).toHaveCount(2);
  await expect(card(page, 3).locator('.ac-art[data-stars="3"] .ac-star')).toHaveCount(3);
  await expect(card(page, 0).locator(".ac-art")).toHaveCount(0);
  await expect(card(page, 1).locator('.ac-art[data-outline="1"]')).toHaveCount(1);
  await expect(card(page, 3).locator('.ac-art[data-outline="1"]')).toHaveCount(1);
  expect(await outlineColors(card(page, 1))).toEqual(expect.arrayContaining(GOLD_STOPS));
  expect(await outlineColors(card(page, 3))).toEqual(expect.arrayContaining(PRISM_STOPS));
  // (Teal and cyan lead the prismatic one, as in Eric's mock: no yellow and no plain green among its colors.)
  expect((await outlineColors(card(page, 3)))[0]).toBe("#22bfa9");
  // Gold: a gold border (a ring) and a glow that pulses (an animation on a box of its own); prismatic: a masked gradient ring in the same palette, and a glow.
  const gold = await card(page, 1).evaluate((el) => ({ ring: getComputedStyle(el).boxShadow, glow: getComputedStyle(el, "::after").boxShadow, anim: getComputedStyle(el, "::after").animationName }));
  expect(gold.ring).toContain(GOLD);
  expect(gold.glow).not.toBe("none");
  expect(gold.anim).toContain("ac-aura");
  const prism = await card(page, 3).evaluate((el) => ({ bg: getComputedStyle(el, "::before").backgroundImage, glow: getComputedStyle(el, "::after").boxShadow, glowAnim: getComputedStyle(el, "::after").animationName }));
  expect(prism.bg).toContain("linear-gradient");
  expect(prism.bg).toContain("34, 191, 169");
  expect(prism.bg).toContain("255, 154, 92");
  expect(prism.glow).not.toBe("none");
  expect(prism.glowAnim).toContain("ac-aura");
  // The board is clean: nothing is drawn on a square or round a piece for a star-up (no ring, no box); the other two offers have their silhouettes.
  await expect(page.locator(".ac-uptarget, .ac-uptile, .ac-starmark")).toHaveCount(0);
  await expect(page.locator(".ac-sil")).toHaveCount(2);
  await expect(silhouette(page, 1)).toHaveCount(0);
  await expect(silhouette(page, 3)).toHaveCount(0);
  // The odds pill is still the odds of a new piece.
  await expect(page.locator(".ac-od[data-kind=p]")).toHaveAttribute("data-odds", "74");
  // Buy the gold one: 1 gold, no piece added (the board was full, and a merge adds none), the knight stays on c2 and gains its stars; the level-up sound, a short line.
  const before = await goldOf(page);
  await tap(page, card(page, 1));
  expect(await goldOf(page)).toBe(before - 1);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  await expect(piece(page, "white", "knight", "c2")).toBeVisible();
  await expect.poll(() => marks(page)).toEqual({ g3: 2, d2: 2, c2: 2 });
  await expect(page.locator(`${BOARD_SEL.piece}[data-square="c2"] .ac-art[data-stars="2"] .ac-star`)).toHaveCount(2);
  await expect(say(page)).toHaveText("c2 is 2 stars");
  expect(await soundCount(page, "acStar2")).toBe(1);
  expect(await soundCount(page, "acPlace")).toBe(0);
  // The merge: a copy of the piece pops over it with a flash behind it, for a moment.
  await expect(page.locator('.ac-merge[data-square="c2"]')).toHaveCount(1);
  await expect(page.locator('.ac-merge[data-square="c2"]')).toHaveCount(0, { timeout: 3000 });
  // The prismatic card is still there; buying it gives the bishop its third star, with the bigger sound, and the board still holds the same five.
  await expect(card(page, 3)).toHaveAttribute("data-up", "3");
  await tap(page, card(page, 3));
  expect(await goldOf(page)).toBe(before - 2);
  await expect.poll(() => marks(page)).toMatchObject({ d2: 3, c2: 2, g3: 2 });
  await expect(page.locator(`${BOARD_SEL.piece}[data-square="d2"] .ac-art[data-stars="3"] .ac-star`)).toHaveCount(3);
  await expect(say(page)).toHaveText("d2 is 3 stars");
  expect(await soundCount(page, "acStar3")).toBe(1);
  expect(await soundCount(page, "acStar2")).toBe(1);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  // A 3-star can't star up again: nothing is offered on its square (the pawn-like case of a piece that can't star up).
  for (const o of await offers(page)) expect(o.square).not.toBe("d2");
  expect(errors).toEqual([]);
});

test("a star-up card is only tapped, never dragged to the bench, and with too little gold it says what is missing", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(STARS);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Pressed and dragged to the bench: no ghost, nothing held, nothing paid, the card still there.
  const from = middle((await card(page, 1).boundingBox())!);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y - 8, { steps: 2 });
  const to = await benchMiddle(page);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(ghosts(page)).toHaveCount(0);
  await page.mouse.up();
  expect(await goldOf(page)).toBe(10);
  await expect(held(page)).toHaveCount(0);
  await expect(card(page, 1)).toHaveAttribute("data-up", "2");
  // Spend the 10 gold: hold the pawn offered for e3 (slot 2, 1 gold) and the pawn that rolls into its slot (f2 with this seed, 1 more), then two
  // Buy XPs (4 each); the star-up cards (slots 1 and 3) stay. Then a tap on the star-up says what is missing (the 1, less the gold).
  expect((await offers(page))[2]).toEqual({ kind: "p", square: "e3" });
  await dragMouse(page, middle((await card(page, 2).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  expect((await offers(page))[2]).toEqual({ kind: "p", square: "f2" });
  await dragMouse(page, middle((await card(page, 2).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(2);
  for (let i = 0; i < 2; i++) await tap(page, xpButton(page));
  expect(await goldOf(page)).toBe(0);
  await expect(card(page, 1)).toHaveAttribute("data-up", "2");
  await tapGreyed(page, card(page, 1));
  await expect(say(page)).toHaveText("Need 1 more");
  await expect(card(page, 1)).toHaveClass(/\boff\b/);
  expect(await soundCount(page, "acStar2")).toBe(0);
  await expect.poll(() => marks(page)).toEqual({ g3: 2, d2: 2 });
  expect(errors).toEqual([]);
});

test("a star-up for a held piece merges on the bench (1 gold, no piece added, its tile then shows its stars and outline, never a ring), and the stars stay through the round turn (Eric: stars up on the bench too)", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(STARBENCH);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const tile = held(page).first();
  await expect(held(page)).toHaveCount(1);
  await expect(tile).toHaveAttribute("data-square", "f3");
  await expect(tile).toHaveAttribute("data-stars", "1");
  await expect(tile.locator(".ac-art")).toHaveCount(0);
  // The offer for the held bishop is a gold card (it would be a 2-star), the held piece's tile is not ringed (the outline, once it is a 2-star, marks it), and nothing is drawn on the board for it (nothing lands).
  expect((await offers(page))[2]).toEqual({ kind: "b", square: "f3" });
  await expect(card(page, 2)).toHaveAttribute("data-up", "2");
  await expect(card(page, 2).locator(".ac-cost b")).toHaveText("1");
  await expect(tile).not.toHaveClass(/\bac-uptile\b/);
  expect(await tile.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  await expect(page.locator(".ac-uptarget, .ac-uptile")).toHaveCount(0);
  await expect(silhouette(page, 2)).toHaveCount(0);
  await expect(page.locator(".ac-sil")).toHaveCount(3);
  // Buy it: 1 gold, the tile gains two stars and the gold outline, the board still has only the king, the bench still holds one piece, the sound and the line.
  const before = await goldOf(page);
  await tap(page, card(page, 2));
  expect(await goldOf(page)).toBe(before - 1);
  await expect(tile).toHaveAttribute("data-stars", "2");
  await expect(tile.locator('.ac-art[data-stars="2"] .ac-star')).toHaveCount(2);
  await expect(tile.locator('.ac-art[data-outline="1"]')).toHaveCount(1);
  expect(await outlineColors(tile)).toEqual(expect.arrayContaining(GOLD_STOPS));
  await expect(tile).toHaveAttribute("data-square", "f3");
  await expect(tile).toHaveClass(/\bmerged\b/);
  await expect(tile).not.toHaveClass(/\bmerged\b/, { timeout: 3000 });
  await expect(held(page)).toHaveCount(1);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(1);
  await expect(say(page)).toHaveText("f3 is 2 stars");
  expect(await soundCount(page, "acStar2")).toBe(1);
  expect(await soundCount(page, "acPlace")).toBe(0);
  // A held piece is not on the board: its stars don't count in the move step (5 s), and nothing glows.
  await watchPhases(page);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  await expect(held(page).first().locator('.ac-art[data-stars="2"] .ac-star')).toHaveCount(2);
  // Through the round (a side with only its king loses at once): the next round's bench holds it on the square turned with the colors, still with its two stars.
  await expect(root(page)).toHaveAttribute("data-phase", "result", { timeout: 60_000 });
  expect(await stepSeconds(page)).toBeLessThan(5.8);
  await tap(page, page.getByRole("button", { name: "Next round" }));
  await expect(root(page)).toHaveAttribute("data-round", "2");
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "b");
  await expect(held(page).first()).toHaveAttribute("data-square", "f6");
  await expect(held(page).first()).toHaveAttribute("data-stars", "2");
  await expect(held(page).first().locator('.ac-art[data-stars="2"] .ac-star')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("the move step (v8): every starred piece carries its outline (no pulsing box) and may move once, a 2-star one legal move and a 3-star to any empty square of your half; any other piece says 'Not starred'; a moved piece is taken back by a tap; 5 s and 3 s for each starred piece", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(STARMOVE);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await watchPhases(page);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(stepLabel(page)).toHaveText("Move");
  // Two starred pieces of yours and none of theirs: 5 s + 3 s x 2 = 11 s.
  await expect(clockOf(page)).toHaveText(/^0:1[01]$/);
  // Every starred piece has its outline (and no other piece does); no box pulses on any square (Eric Oct 22: the outline marks them), and no square is lit until one is picked. Their pieces show for real.
  expect(await outlined(page)).toEqual({ d2: 3, g3: 2 });
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  await expect(page.locator(".ac-shop")).toHaveClass(/shut/);
  // Any other piece of yours: "Not starred" (a plain rook, a plain knight); the king stays put; nothing lights.
  await tapSquare(page, "a1");
  await expect(say(page)).toHaveText("Not starred");
  await tapSquare(page, "c2");
  await expect(say(page)).toHaveText("Not starred");
  await tapSquare(page, "b1");
  await expect(say(page)).toHaveText("King stays put");
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  // The 2-star knight on g3: tapped, its legal squares light (e2, e4, f1, h1: the knight's jumps that stay on your half), and it is the picked piece.
  await tapSquare(page, "g3");
  expect(await dotSquares(page)).toEqual(["e2", "e4", "f1", "h1"]);
  await expect(page.locator(".ac-picked")).toHaveCount(1);
  // Refused, with the reason: their half, a square it can't reach (a drag onto a taken square too); nothing is used up.
  await tapSquare(page, "e5");
  await expect(say(page)).toHaveText("Your half only");
  await tapSquare(page, "g4");
  await expect(say(page)).toHaveText("Not a legal move");
  await dragMouse(page, await center(page, "g3"), await center(page, "c2"));
  await expect(say(page)).toHaveText("Square taken");
  await expect(piece(page, "white", "knight", "g3")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  expect(await dotSquares(page)).toEqual(["e2", "e4", "f1", "h1"]);
  // One legal move, by a tap on its dot: the knight lands on e2 with its stars and outline, is marked (tap ↩ to take it back), the dots go from it, the move sound plays.
  await tapSquare(page, "e2");
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(piece(page, "white", "knight", "g3")).toHaveCount(0);
  await expect(page.locator('.ac-moved[data-square="e2"]')).toBeVisible();
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  expect(await outlined(page)).toEqual({ e2: 2, d2: 3 });
  expect(await marks(page)).toEqual({ e2: 2, d2: 3 });
  expect(await soundCount(page, "move")).toBeGreaterThanOrEqual(1);
  // The 3-star bishop on d2 isn't held to a bishop's moves: every empty square of your half lights (32 less the king and the four pieces' squares: 27).
  await tapSquare(page, "d2");
  const dots = await dotSquares(page);
  expect(dots).toHaveLength(27);
  for (const sqr of ["h4", "h1", "g3", "a4", "f1"]) expect(dots).toContain(sqr);
  for (const sqr of ["b1", "a1", "c2", "d2", "e2"]) expect(dots).not.toContain(sqr);
  await tapSquare(page, "d5");
  await expect(say(page)).toHaveText("Your half only");
  // To h4, by a drag (not a bishop's line from d2 either way).
  await dragMouse(page, await center(page, "d2"), await center(page, "h4"));
  await expect(piece(page, "white", "bishop", "h4")).toBeVisible();
  await expect(page.locator('.ac-moved[data-square="h4"]')).toBeVisible();
  expect(await marks(page)).toEqual({ e2: 2, h4: 3 });
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  // Both have moved: no second move for either (a tap on a moved piece takes it back, and says nothing is used up).
  await tapSquare(page, "e2");
  await expect(piece(page, "white", "knight", "g3")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  expect(await outlined(page)).toEqual({ g3: 2, h4: 3 });
  expect(await marks(page)).toEqual({ g3: 2, h4: 3 });
  // The knight goes elsewhere this time: f1.
  await dragMouse(page, await center(page, "g3"), await center(page, "f1"));
  await expect(piece(page, "white", "knight", "f1")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(2);
  // The step is 11 seconds, then the fight: the pieces start where they were left, their stars on them.
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 15_000 });
  expect(await stepSeconds(page)).toBeGreaterThan(10.8);
  expect(await stepSeconds(page)).toBeLessThan(11.8);
  expect(await marksAt(page, "fight")).toEqual({ f1: 2, h4: 3 });
  expect(errors).toEqual([]);
});

test("the move step with nobody starred (v8): a flat 5 seconds to look at the board, nothing glows, any piece of yours says 'Not starred', then the fight", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto(MOVE);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The knight for e2 and the pawns for a3 and h3 (plain pieces).
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await watchPhases(page);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(clockOf(page)).toHaveText(/^0:0[45]$/);
  await expect(stepLabel(page)).toHaveText("Move");
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece} .ac-art`)).toHaveCount(0);
  await tapSquare(page, "e2");
  await expect(say(page)).toHaveText("Not starred");
  await tapSquare(page, "a3");
  await expect(say(page)).toHaveText("Not starred");
  await tapSquare(page, "d1");
  await expect(say(page)).toHaveText("King stays put");
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 12_000 });
  expect(await stepSeconds(page)).toBeGreaterThan(4.8);
  expect(await stepSeconds(page)).toBeLessThan(5.7);
  // The step runs even with nothing to move (no skip), also when neither side has a piece that can: here with only a king, as in v7's "no piece can move" case.
  expect(errors).toEqual([]);
});

test("the bot's stars (v8): a starred piece of theirs shows its stars once it is revealed (a circle shows none), all of them show in the move step, and the step runs 5 s plus 3 s for each", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto(BOTSTARS);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await watchPhases(page);
  // The 2-star knight on c7 is the first revealed (1.5 s); the 3-star bishop on f8 stays a plain circle until its reveal (4.5 s).
  await expect.poll(() => marks(page), { timeout: 4000 }).toEqual({ c7: 2 });
  await expect(page.locator('.ac-circle[data-square="f8"]')).toHaveCount(1);
  await expect.poll(() => marks(page), { timeout: 5000 }).toEqual({ c7: 2, f8: 3 });
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The move step: all of their stars show, none of yours; 5 s + 3 s x 2 = 11 s even though you have no star.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 10_000 });
  await expect(clockOf(page)).toHaveText(/^0:1[01]$/);
  expect(await marks(page)).toEqual({ c7: 2, f8: 3 });
  await expect(page.locator(`${BOARD_SEL.piece}.black[data-square="c7"] .ac-art[data-stars="2"] .ac-star`)).toHaveCount(2);
  await expect(page.locator(`${BOARD_SEL.piece}.black[data-square="f8"] .ac-art[data-stars="3"] .ac-star`)).toHaveCount(3);
  // (Theirs have the outline too, once shown, and white stars on their black pieces; yours would have black stars on your white ones.)
  expect(await outlined(page)).toEqual({ c7: 2, f8: 3 });
  expect(await page.locator(`${BOARD_SEL.piece}.black .ac-star`).first().evaluate((el) => getComputedStyle(el).fill)).toBe("rgb(255, 255, 255)");
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  // Their stars are theirs: nothing of theirs can be moved or lit by you.
  await tapSquare(page, "c7");
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 15_000 });
  expect(await stepSeconds(page)).toBeGreaterThan(10.8);
  expect(await stepSeconds(page)).toBeLessThan(11.8);
  // The fight begins from their pieces as they stood (their move shows a moment later, with the stars on the pieces moved).
  expect(await marksAt(page, "fight")).toEqual({ c7: 2, f8: 3 });
  expect(errors).toEqual([]);
});

test("stars follow their pieces through the fight, and the survivors' refund counts what was paid for them (the price and 1 for each star above the first)", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  // (The move step off: the fight starts from the board as bought.)
  await page.goto(`${STARMOVE}&adjust=0`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await watchPhases(page);
  await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 20_000 });
  expect(await marksAt(page, "fight")).toEqual({ g3: 2, d2: 3 });
  // A star is always on a piece, as a part of it (read in one go: the fight moves every 60 ms here): sampled through the fight, and once it is over; none is on a piece that is fading away.
  const consistent = () => page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(`${sel} .ac-art`)].every((a) => !!a.closest("piece[data-square]") && !a.closest("piece.fading")), BOARD_SEL.piece);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(700);
    if ((await root(page).getAttribute("data-phase")) !== "fight") break;
    await expect.poll(consistent, { timeout: 3000 }).toBe(true);
  }
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 200_000 });
  expect(await consistent()).toBe(true);
  // The refund in the result's gold line: 25% of what was paid for the pieces of yours still standing (their prices and 1 for each star above the first), to the nearest whole gold.
  // (Read once the last capture has faded off the board: a piece taken on the fight's last move is drawn for 220 ms more,
  // `.fading`, and isn't a survivor. Counted, it read 28 against the game's right 20, once in CI, Oct 24.)
  await expect(page.locator(`${BOARD_SEL.piece}.fading`)).toHaveCount(0);
  const left = await page.locator(`${BOARD_SEL.piece}.white:not(.king):not(.fading)`).evaluateAll((els) => els.map((e) => ({ square: (e as HTMLElement).dataset.square!, kind: ["knight", "bishop", "rook", "queen", "pawn"].find((k) => e.classList.contains(k))! })));
  const m = await marks(page);
  const kindPrice: Record<string, number> = { knight: 3, bishop: 3, rook: 5, queen: 9, pawn: 1 };
  const paid = left.reduce((sum, p) => sum + kindPrice[p.kind]! + 1 * ((m[p.square] ?? 1) - 1), 0);
  const gold = (await page.locator(".ac-card-gold").innerText()).match(/(\d+) survivors/);
  // (A refund that rounds to 0 is left out of the line, as every empty part is.)
  if (Math.round(paid * 0.25)) expect(Number(gold![1])).toBe(Math.round(paid * 0.25));
  else expect(gold).toBeNull();
  expect(errors).toEqual([]);
});

/** The geometry of every starred picture matching `sel`: its box (the piece's own), each star's box, and the box of the square's name beside it (a bench tile's). */
const starBoxes = (p: Page, sel: string) =>
  p.evaluate((q) => {
    const box = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    return [...document.querySelectorAll<SVGElement>(q)].map((art) => ({
      n: Number(art.dataset.stars),
      white: !!art.closest("piece.white, .ac-bench.you, .ac-buy"),
      art: box(art.getBoundingClientRect()),
      stars: [...art.querySelectorAll(".ac-star")].map((st) => ({ ...box(st.getBoundingClientRect()), fill: getComputedStyle(st).fill })),
      name: art.closest(".ac-slot")?.querySelector("em") ? box(art.closest(".ac-slot")!.querySelector("em")!.getBoundingClientRect()) : null,
    }));
  }, sel);

test("the stars' size and place (v8, Eric Oct 22: very tiny, in the body of the piece): at most 12% of the square, two side by side or three in a triangle of at most 28% of its width, inside the piece's box and clear of the square's name, black on white pieces; on the board, the bench and the card, at every phone size and on a computer, and nothing scrolls", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const sizes: [number, number][] = phone() ? [[320, 568], [360, 640], [393, 730], [428, 777]] : [[1280, 800], [1280, 600]];
  const rect = (r: { x: number; y: number; width: number; height: number }) => ({ l: r.x, r: r.x + r.width, t: r.y, b: r.y + r.height });
  const check = (boxes: Awaited<ReturnType<typeof starBoxes>>, what: string) => {
    expect(boxes.length, `${what}: pictures`).toBeGreaterThan(0);
    for (const o of boxes) {
      const art = rect(o.art);
      expect(o.stars, `${what}: one star each`).toHaveLength(o.n);
      let group = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 };
      for (const st of o.stars) {
        const r = rect(st);
        // Tiny: no star is wider than 12% of the piece (a pixel of room for the edge), and none is a speck under 7%.
        expect(st.width, `${what}: a star is at most 12% of the square`).toBeLessThanOrEqual(o.art.width * 0.12 + 1);
        expect(st.width, `${what}: a star is at least 7% of the square`).toBeGreaterThanOrEqual(o.art.width * 0.07 - 0.6);
        group = { l: Math.min(group.l, r.l), r: Math.max(group.r, r.r), t: Math.min(group.t, r.t), b: Math.max(group.b, r.b) };
        // Black on a white piece, white on a black one.
        expect(st.fill, `${what}: the stars' color`).toBe(o.white ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
      }
      // In the middle of the body: well inside the box, no more than 28% of its width and 24% of its height.
      expect(group.l, `${what}: left`).toBeGreaterThan(art.l + o.art.width * 0.2);
      expect(group.r, `${what}: right`).toBeLessThan(art.r - o.art.width * 0.2);
      expect(group.t, `${what}: top`).toBeGreaterThan(art.t + o.art.height * 0.2);
      expect(group.b, `${what}: bottom`).toBeLessThan(art.b - o.art.height * 0.1);
      expect(group.r - group.l, `${what}: width`).toBeLessThanOrEqual(o.art.width * 0.28 + 1);
      expect(group.b - group.t, `${what}: height`).toBeLessThanOrEqual(o.art.height * 0.24 + 1);
      if (o.n === 2) expect(Math.abs(o.stars[0]!.y - o.stars[1]!.y), `${what}: two stars side by side`).toBeLessThan(0.5);
      else expect(o.stars[0]!.y + o.stars[0]!.height / 2, `${what}: three stars, one above and two below`).toBeLessThan(o.stars[1]!.y + o.stars[1]!.height / 2 - 0.5);
      // Clear of the square's name (a bench tile's corner).
      if (o.name) {
        const nm = rect(o.name);
        expect(group.r <= nm.l + 0.5 || group.b <= nm.t + 0.5 || group.l >= nm.r - 0.5, `${what}: clear of the square's name`).toBe(true);
      }
    }
  };
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    // The board: starred pieces (g3, d2), and after the merge c2 too; the cards: a gold and a prismatic one.
    await page.goto(STARS);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await tap(page, card(page, 1));
    await expect.poll(() => marks(page)).toEqual({ g3: 2, d2: 2, c2: 2 });
    check(await starBoxes(page, `${BOARD_SEL.piece} .ac-art`), `${w}: board`);
    check(await starBoxes(page, ".ac-buy[data-up] .ac-art"), `${w}: cards`);
    const plainW = (await page.locator(".ac-buy").first().boundingBox())!.width;
    for (const c of await page.locator(".ac-buy[data-up]").all()) expect(Math.abs((await c.boundingBox())!.width - plainW), `${w}: a card keeps its width`).toBeLessThanOrEqual(0.5);
    // The pieces drawn whole by the outline sit on their square exactly: the piece's own box is the square's.
    for (const e of await page.locator(`${BOARD_SEL.piece}.ac-drawn`).all()) {
      const box = (await e.boundingBox())!;
      const sq = await center(page, (await e.getAttribute("data-square"))!);
      expect(Math.abs(box.x + box.width / 2 - sq.x), `${w}: a starred piece is centered on its square`).toBeLessThan(1);
      expect(Math.abs(box.y + box.height / 2 - sq.y)).toBeLessThan(1);
    }
    // The bench: a held 2-star and 3-star, stars in the tile, clear of the square's name.
    await page.goto("/autochess?quick=1&seed=16&benchstars=q@h3:3,b@f3:2&intro=0");
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await expect(held(page)).toHaveCount(2);
    check(await starBoxes(page, ".ac-bench.you .ac-slot .ac-art"), `${w}: bench`);
    // Nothing scrolls.
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= document.scrollingElement!.clientHeight + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("the stars' outlines (v8, Eric Oct 22: a gold border for the 2-star units, prismatic for the 3-star, as the cards'): on starred pieces on the board and the bench while buying, placing and moving, none on a square; off in the fight and the result (the tiny stars stay); `?fightglow=1` keeps them on", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  for (const glow of [false, true]) {
    // (The move step off: the fight starts from the board as bought, a 2-star knight on g3 and a 3-star bishop on d2, with the benched 2-star bishop and 3-star knight.)
    await page.goto(`${STARMOVE}&adjust=0&benchstars=b@f3:2,n@h2:3${glow ? "&fightglow=1" : ""}`);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    // Buying: the outline on both pieces of the board and both bench tiles (gold for a 2-star, prismatic for a 3-star), the pieces drawn whole by it (their CSS picture off), and nothing on the squares.
    expect(await outlined(page)).toEqual({ g3: 2, d2: 3 });
    await expect(page.locator(`${BOARD_SEL.piece}.ac-drawn`)).toHaveCount(2);
    expect(await outlineColors(page.locator(`${BOARD_SEL.piece}[data-square="g3"]`))).toEqual(expect.arrayContaining(GOLD_STOPS));
    expect(await outlineColors(page.locator(`${BOARD_SEL.piece}[data-square="d2"]`))).toEqual(expect.arrayContaining(PRISM_STOPS));
    for (const [slot, colors] of [[0, GOLD_STOPS], [1, PRISM_STOPS]] as const) {
      await expect(held(page).nth(slot).locator('.ac-art[data-outline="1"]')).toHaveCount(1);
      expect(await outlineColors(held(page).nth(slot))).toEqual(expect.arrayContaining(colors));
    }
    await expect(page.locator(".ac-uptarget, .ac-uptile, .ac-pick, .ac-starmark")).toHaveCount(0);
    expect(await page.evaluate((sel) => getComputedStyle(document.querySelector(`${sel}.ac-drawn`)!).backgroundImage, BOARD_SEL.piece)).toBe("none");
    await watchPhases(page);
    await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 20_000 });
    // The fight: only the tiny stars stay (outline and its drawn piece off, the board's own picture back), unless the setting keeps them. Read as the fight began and when it is over.
    const at = await page.evaluate(() => ({ stars: document.querySelectorAll(".hb-board piece .ac-star").length, outlines: document.querySelectorAll('.hb-board piece .ac-art[data-outline="1"]').length, drawn: document.querySelectorAll(".hb-board piece.ac-drawn").length }));
    expect(at.stars, "the stars are there in the fight").toBeGreaterThan(0);
    if (glow) expect(at.outlines, "outlines kept in the fight").toBeGreaterThan(0);
    else expect(at.outlines, "no outline in the fight").toBe(0);
    expect(at.drawn).toBe(at.outlines);
    await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 200_000 });
    const end = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".hb-board piece .ac-art")].map((a) => a.dataset.outline));
    for (const o of end) expect(o, glow ? "outlines kept in the result" : "no outline in the result").toBe(glow ? "1" : "0");
    // The bench tiles in the fight and the result: stars only, too.
    for (const o of await page.locator(".ac-bench.you .ac-art").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.outline))) expect(o).toBe(glow ? "1" : "0");
  }
  expect(errors).toEqual([]);
});

test("a starred piece moved in the move step slides like any other, its outline and stars riding it; one dragged carries them in its ghost (a real finger's drag), and lands with them (v8 star look)", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(STARMOVE);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 20_000 });
  // The knight on g3 to e2 by two taps, sampled every frame: its element slides (a class and a box that moves through in-between places), and its picture is in it, whole, each frame.
  await tapSquare(page, "g3");
  await page.evaluate((sel) => {
    const out: { t: number; square: string; anim: boolean; x: number; ax: number; aw: number; w: number; outline: string }[] = [];
    (window as any).__slide = out;
    const t0 = performance.now();
    const frame = () => {
      const e = [...document.querySelectorAll<HTMLElement>(sel)].find((q) => q.querySelector('.ac-art[data-stars="2"]'));
      if (e) {
        const r = e.getBoundingClientRect();
        const a = e.querySelector(".ac-art")!.getBoundingClientRect();
        out.push({ t: performance.now() - t0, square: e.dataset.square!, anim: e.classList.contains("anim"), x: r.x, ax: a.x - r.x, aw: a.width - r.width, w: r.width, outline: e.querySelector<HTMLElement>(".ac-art")!.dataset.outline! });
      }
      if (performance.now() - t0 < 900) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, BOARD_SEL.piece);
  await tapSquare(page, "e2");
  await page.waitForTimeout(1000);
  const samples = await page.evaluate(() => (window as any).__slide as { t: number; square: string; anim: boolean; x: number; ax: number; aw: number; w: number; outline: string }[]);
  const from = samples.find((s) => s.square === "g3")!;
  const last = samples[samples.length - 1]!;
  expect(last.square).toBe("e2");
  const between = samples.filter((s) => s.x < from.x - 3 && s.x > last.x + 3);
  expect(between.length, "the piece is seen between g3 and e2, not only at the ends").toBeGreaterThanOrEqual(3);
  expect(samples.some((s) => s.anim)).toBe(true);
  for (const s of samples) {
    expect(Math.abs(s.ax), "the picture is at the piece's own box").toBeLessThan(0.5);
    expect(Math.abs(s.aw)).toBeLessThan(0.5);
    expect(s.outline, "the outline is on through the slide").toBe("1");
  }
  for (let i = 1; i < samples.length; i++) expect(samples[i]!.x, "it moves one way").toBeLessThanOrEqual(samples[i - 1]!.x + 0.5);
  expect(await marks(page)).toEqual({ e2: 2, d2: 3 });
  // A finger's drag of the 3-star bishop: its ghost has the stars and the outline (the whole piece, no CSS picture), the board's own piece stays put under the usual picked highlight, and the drop lands them on h4.
  const hold = await holdTouch(page, await center(page, "d2"), await center(page, "h4"));
  await expect(ghosts(page)).toHaveCount(1);
  await expect(page.locator('.ac-ghost .ac-art[data-stars="3"][data-outline="1"]')).toHaveCount(1);
  await expect(page.locator(".ac-ghost .ac-art .ac-star")).toHaveCount(3);
  await expect(page.locator(".ac-ghost piece")).toHaveCount(0);
  expect(await outlineColors(page.locator(".ac-ghost"))).toEqual(expect.arrayContaining(PRISM_STOPS));
  await expect(page.locator(".ac-picked")).toHaveCount(1);
  expect(await marks(page)).toEqual({ e2: 2, d2: 3 });
  await hold.end();
  await expect(ghosts(page)).toHaveCount(0);
  await expect(piece(page, "white", "bishop", "h4")).toBeVisible();
  await expect.poll(() => marks(page)).toEqual({ e2: 2, h4: 3 });
  expect(await outlined(page)).toEqual({ e2: 2, h4: 3 });
  expect(errors).toEqual([]);
});

test("reduced motion (v8): a star-up card keeps its border and glow but nothing moves, the outlines are still there (and still), and a merge pops nothing", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(STARS);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const gold = await card(page, 1).evaluate((el) => ({ ring: getComputedStyle(el).boxShadow, glow: getComputedStyle(el, "::after").boxShadow, anim: getComputedStyle(el, "::after").animationName }));
  expect(gold.ring).toContain(GOLD);
  expect(gold.glow).not.toBe("none");
  expect(gold.anim).toBe("none");
  const prism = await card(page, 3).evaluate((el) => ({ bg: getComputedStyle(el, "::before").backgroundImage, anim: getComputedStyle(el, "::before").animationName, glowAnim: getComputedStyle(el, "::after").animationName }));
  expect(prism.bg).toContain("linear-gradient");
  expect(prism.anim).toBe("none");
  expect(prism.glowAnim).toBe("none");
  // The outlines are on (the cards', the board's), and the prismatic one does not shift its colors: no animation in it.
  await expect(card(page, 1).locator('.ac-art[data-outline="1"]')).toHaveCount(1);
  await expect(card(page, 3).locator('.ac-art[data-outline="1"]')).toHaveCount(1);
  await expect(card(page, 3).locator("animateTransform")).toHaveCount(0);
  expect(await outlined(page)).toEqual({ g3: 2, d2: 2 });
  await tap(page, card(page, 1));
  await expect.poll(() => marks(page)).toMatchObject({ c2: 2 });
  expect(await outlined(page)).toMatchObject({ c2: 2 });
  // (The copy of the piece that pops is not shown.)
  expect(await page.locator(".ac-merge").evaluateAll((els) => els.every((e) => getComputedStyle(e).display === "none"))).toBe(true);
  expect(errors).toEqual([]);
});

test("the prismatic outline of the shop card shifts its colors slowly (and only that one: the board's and the bench's stay still)", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(STARS);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(card(page, 3).locator("animateTransform")).toHaveCount(1);
  await expect(card(page, 1).locator("animateTransform")).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece} animateTransform`)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a star-up's sound is asked for muted when sound is off, and unmuted when it is on", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  await page.goto(STARS);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await tap(page, card(page, 1));
  await tap(page, card(page, 3));
  const log = await page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => /^acStar/.test(l)));
  expect(log.some((l) => l.startsWith("acStar2:"))).toBe(true);
  expect(log.some((l) => l.startsWith("acStar3:"))).toBe(true);
  expect(log.every((l) => l.endsWith(":muted"))).toBe(true);
  expect(errors).toEqual([]);
});

// ---- The meeting before round 1 (v9, Eric Oct 24) ----

/** The corners' pawns, names and bars: hidden in the meeting, back as the middle pawns puff away. */
const corners = (p: Page) => p.locator(".ac-stage, .ac-info, .ac-bars");

test("the meeting before round 1 (Eric, Oct 24): both custom pawns stand in the board's middle, side by side, the corners' pawns, names and bars hidden, a countdown and the quick chat; then they puff away, the corners come in and ACTION PHASE begins", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/autochess?quick=1&seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "meet");
  for (const c of await corners(page).all()) await expect(c).toBeHidden();
  const frame = (await page.locator(".ac-frame").boundingBox())!;
  const corner = (await page.locator(".ac-me .ac-pawn").boundingBox())!;
  // (The pawns drop in first, a moment: measure them at rest.)
  await page.waitForFunction(() => [...document.querySelectorAll(".ac-meet-pawn")].every((e) => e.getAnimations().every((a) => a.playState !== "running")));
  const mine = (await page.locator(".ac-meet-side.you .ac-meet-pawn").boundingBox())!;
  const theirs = (await page.locator(".ac-meet-side.them .ac-meet-pawn").boundingBox())!;
  const mid = (b: { x: number; width: number }) => b.x + b.width / 2;
  const fx = frame.x + frame.width / 2;
  const fy = frame.y + frame.height / 2;
  // In the middle of the board, yours on the left and theirs on the right, side by side and not overlapping.
  expect(Math.abs((mid(mine) + mid(theirs)) / 2 - fx), "the pair is centered across the board").toBeLessThanOrEqual(3);
  expect(mid(mine), "yours is left").toBeLessThan(fx);
  expect(mid(theirs), "theirs is right").toBeGreaterThan(fx);
  expect(mine.x + mine.width, "they don't overlap").toBeLessThanOrEqual(theirs.x);
  expect(Math.abs(mine.y + mine.height / 2 - fy), "they stand on the board's middle row").toBeLessThanOrEqual(frame.height * 0.2);
  // About twice a corner pawn's size.
  expect(mine.height / corner.height, "each about twice a corner pawn").toBeGreaterThanOrEqual(1.6);
  // The countdown under them, the quick chat: four lines from the list.
  await expect(page.locator(".ac-meet-count")).toHaveText(/^Starting in [12]$/);
  const lines = await page.locator(".ac-meet-chat .ac-chat").allInnerTexts();
  expect(lines).toEqual([...QUICK_CHAT]);
  // (Each on its own card, never see-through over the board: v5 dropped their color, Nov 9.)
  for (const sel of [".ac-meet-count", ".ac-meet-chat .ac-chat"]) {
    expect(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor), `${sel} has a background`).not.toBe("rgba(0, 0, 0, 0)");
  }
  const count = (await page.locator(".ac-meet-count").boundingBox())!;
  const chat = (await page.locator(".ac-meet-chat").boundingBox())!;
  for (const b of [mine, theirs, count, chat]) {
    expect(b.x >= frame.x - 0.5 && b.x + b.width <= frame.x + frame.width + 0.5, "inside the board, across").toBe(true);
    expect(b.y >= frame.y - 0.5 && b.y + b.height <= frame.y + frame.height + 0.5, "inside the board, down").toBe(true);
  }
  expect(count.y, "the countdown is under the pawns").toBeGreaterThanOrEqual(mine.y + mine.height - 1);
  expect(chat.y, "the quick chat is under the countdown").toBeGreaterThanOrEqual(count.y + count.height - 1);
  // Then the buying begins: the middle pawns are gone, the corners and bars are back, and ACTION PHASE shows.
  await expect(root(page)).toHaveAttribute("data-phase", "buy", { timeout: 8000 });
  await expect(page.locator(".ac-meet")).toHaveCount(0, { timeout: 3000 });
  for (const c of await corners(page).all()) await expect(c).toBeVisible();
  await expect(page.locator(".ac-who .ac-name")).toHaveText("Bot");
  await expect(page.locator(".ac-banner .cc-num.ac-phase")).toHaveText("ACTION PHASE");
  expect(errors).toEqual([]);
});

test("the quick chat (v9): a tap shows its line in a bubble over your pawn; the bot answers once with a line from the same list; the next tap replaces the bubble; the shop can't be used in the meeting", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?quick=1&seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "meet");
  // The shop is shut: a tap on a card buys nothing, and the gold and the bench stay as they were.
  const gold = await goldOf(page);
  await tapGreyed(page, card(page, 0));
  expect(await goldOf(page)).toBe(gold);
  await expect(held(page)).toHaveCount(0);
  // A line of yours: its bubble, over your pawn.
  const yours = page.locator(".ac-meet-side.you .ac-say");
  const theirs = page.locator(".ac-meet-side.them .ac-say");
  await tap(page, page.getByRole("button", { name: "Hello!" }));
  await expect(yours).toHaveText("Hello!");
  const bubble = (await yours.boundingBox())!;
  // (The pawn drops in first: measure it at rest.)
  await page.waitForFunction(() => [...document.querySelectorAll(".ac-meet-pawn")].every((e) => e.getAnimations().every((a) => a.playState !== "running")));
  const pawn = (await page.locator(".ac-meet-side.you .ac-meet-pawn").boundingBox())!;
  expect(bubble.y + bubble.height, "the bubble is over the pawn").toBeLessThanOrEqual(pawn.y + 2);
  // The bot answers once, with a line of the same list, in a bubble over its pawn.
  await expect(theirs).toHaveCount(1, { timeout: 4000 });
  expect(QUICK_CHAT).toContain(await theirs.innerText());
  // The next line replaces yours: one bubble at a time.
  await tap(page, page.getByRole("button", { name: "Nice outfit." }));
  await expect(yours).toHaveText("Nice outfit.");
  await expect(yours).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the meeting fits the board: at 320, 390, 428 px wide and on a computer, the pawns, the countdown, the quick chat and the bubbles stay inside the board (and the screen)", async ({ page }) => {
  // (Its sizes are its own, a computer's among them: one project runs them, Nov 2.)
  test.skip(!phone(), "the sizes are the test's own: the phone project runs them all, the computer's too");
  test.setTimeout(180_000);
  // (The full 10 s meeting, so there is time to look at it.)
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [428, 926],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/autochess?seed=9");
    await expect(root(page)).toHaveAttribute("data-phase", "meet");
    await tap(page, page.getByRole("button", { name: "Hello!" }));
    await expect(page.locator(".ac-meet-side.them .ac-say")).toHaveCount(1, { timeout: 4000 });
    const frame = (await page.locator(".ac-frame").boundingBox())!;
    const inside = async (sel: string) => {
      for (const b of await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
        expect(b.x >= frame.x - 0.5 && b.x + b.width <= frame.x + frame.width + 0.5, `${sel} inside the board, across at ${w}`).toBe(true);
        expect(b.y >= frame.y - 0.5 && b.y + b.height <= frame.y + frame.height + 0.5, `${sel} inside the board, down at ${w}`).toBe(true);
      }
    };
    await inside(".ac-meet-pawn");
    await inside(".ac-meet-count");
    await inside(".ac-meet-chat");
    // The bubbles: over the board, and on the screen.
    for (const b of await page.locator(".ac-say").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(b.x >= 0 && b.x + b.width <= w, `a bubble on the screen at ${w}`).toBe(true);
      expect(b.y >= frame.y - 0.5, `a bubble below the board's top at ${w}`).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll at ${w}`).toBe(true);
    await expect(root(page)).toHaveAttribute("data-phase", "buy", { timeout: 15000 });
  }
});

test("the action box is one panel (Nov 8, was v9's): the band, Buy XP, Reroll and the four cards inside its double border (black, gold, black), on its dark ground", async ({ page }) => {
  const errors = watchErrors(page);
  if (phone()) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
  const dock = await box(".ac-dock");
  for (const sel of [".ac-goldrow", ".ac-btns", ".ac-cards"]) {
    const b = await box(sel);
    expect(b.x, `${sel} inside`).toBeGreaterThanOrEqual(dock.x + 3);
    expect(b.x + b.width, `${sel} inside`).toBeLessThanOrEqual(dock.x + dock.width - 3);
    expect(b.y + b.height, `${sel} inside`).toBeLessThanOrEqual(dock.y + dock.height - 3);
  }
  const look = await page.evaluate(() => {
    const d = getComputedStyle(document.querySelector(".ac-dock")!);
    const f = getComputedStyle(document.querySelector(".ac-frame")!);
    return { dock: [d.borderTopWidth, d.borderTopColor, d.outlineWidth, d.outlineColor, d.borderTopLeftRadius], frame: [f.borderTopWidth, f.borderTopColor, f.outlineWidth, f.outlineColor, f.borderTopLeftRadius], bg: d.backgroundColor };
  });
  expect(look.dock, "the board's own border").toEqual(look.frame);
  // (v5: 3 to 6 px, the frame's gold border taking the board's 8 px snap.)
  expect(["3px", "4px", "5px", "6px"]).toContain(look.dock[0]);
  expect(look.dock[4], "square corners").toBe("0px");
  expect(look.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(errors).toEqual([]);
});

test("the board's squares part (Eric, Nov 10: \"the colors fuse\"): Classic's dark square is a touch darker here (#b39c7c), only on this board", async ({ page }) => {
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await page.locator(".ac-board .hb-board").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(179, 156, 124)");
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sq-dark").trim())).toBe("#c0ad90");
});
