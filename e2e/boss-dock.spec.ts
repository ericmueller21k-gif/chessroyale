import { devices, expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, submitMove, test } from "./helpers.ts";

/**
 * The boss battle's dock under the board, on every screen (Eric, Oct 15, after his Hidden Boss playtest):
 * - the row (« status ») exactly the board's width, under its left and right edges, at every width;
 * - the God King on a line of his own under the row, in its middle, on a phone or a tablet upright; beside the row where
 *   the screen's column has room right of the board (a phone on its side); by the board's corner on a computer;
 * - your clock bold at the status box's right, on every boss's screens: counting down on your move, holding what was
 *   left once it's in, never gone and never moving between moves; the words, centered, without the time.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Boss alone against Ginger (any boss's dock is the same component), a minute a move so nothing runs out. */
async function intoBattle(page: Page) {
  await page.goto("/?debug&laststand=0&boss=gingerbread&clock=60");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 15_000 }).toBe(true);
}

/**
 * A quiet move once it's your move, one the game takes: Ginger's freeze takes a piece's moves away for a turn
 * (`crowdAllowed`), and a frozen pawn's move would be ignored (docs/decisions/2026-10-15-flaky-e2e-batch.md).
 */
async function quietMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const { fen, allowed } = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.runner.crowdAllowed() ?? null) as string[] | null };
  });
  const moves = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion && (!allowed || allowed.includes(m.lan)));
  await submitMove(page, (moves.find((m) => m.piece === "p") ?? moves[0]!).lan, fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

type Box = { x: number; r: number; y: number; b: number };
const boxes = (page: Page) =>
  page.evaluate((sel) => {
    const r = (s: string): Box | null => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.left, r: b.right, y: b.top, b: b.bottom };
    };
    return { board: r(`.board-area .board-row > .board-wrap ${sel}`), row: r(".boss-dock-main"), status: r(".boss-dock-status"), clock: r(".dk-clock"), king: r(".gk-unit-btn") };
  }, BOARD_SEL.container);

test("the row is exactly the board's width under its edges at every width; the God King under it (phone, tablet upright), beside it with room (a phone on its side), by the board's corner (computer)", async ({ browser }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: it opens its own screens");
  test.setTimeout(6 * 60_000);
  const sizes = [
    { name: "320", viewport: { width: 320, height: 640 }, phone: true, king: "under" },
    { name: "390", viewport: { width: 390, height: 664 }, phone: true, king: "under" },
    { name: "768", viewport: { width: 768, height: 1024 }, phone: false, king: "under" },
    { name: "844x390", viewport: { width: 844, height: 390 }, phone: true, king: "beside" },
    { name: "1024", viewport: { width: 1024, height: 768 }, phone: false, king: "corner" },
    { name: "1280", viewport: { width: 1280, height: 800 }, phone: false, king: "corner" },
  ] as const;
  for (const s of sizes) {
    const ctx = await browser.newContext(s.phone ? { ...devices["iPhone 13"], viewport: s.viewport } : { viewport: s.viewport });
    const page = await ctx.newPage();
    await intoBattle(page);
    const b = await boxes(page);
    expect(b.board && b.row && b.status && b.clock && b.king, s.name).toBeTruthy();
    // The row's edges are the board's, within a pixel.
    expect(Math.abs(b.row!.x - b.board!.x), `${s.name}: left edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(b.row!.r - b.board!.r), `${s.name}: right edge`).toBeLessThanOrEqual(1);
    // The clock inside the status box, at its right.
    expect(b.clock!.r, `${s.name}: clock inside the box`).toBeLessThanOrEqual(b.status!.r);
    expect(b.status!.r - b.clock!.r, `${s.name}: clock at the box's right`).toBeLessThan(16);
    await expect(page.locator(".dk-clock.running .dk-time")).toHaveText(/^\d:\d\d$/);
    const kingMid = (b.king!.x + b.king!.r) / 2;
    if (s.king === "under") {
      expect(b.king!.y, `${s.name}: the God King under the row`).toBeGreaterThanOrEqual(b.row!.b);
      expect(Math.abs(kingMid - (b.row!.x + b.row!.r) / 2), `${s.name}: in the row's middle`).toBeLessThanOrEqual(1);
    } else if (s.king === "beside") {
      expect(b.king!.x, `${s.name}: beside the row`).toBeGreaterThanOrEqual(b.row!.r);
      expect(b.king!.y, `${s.name}: on the row's line`).toBeLessThan(b.row!.b);
    } else {
      expect(b.king!.x, `${s.name}: by the board's corner`).toBeGreaterThanOrEqual(b.board!.r);
      expect(b.king!.b, `${s.name}: his feet by the board's bottom edge`).toBeLessThanOrEqual(b.row!.y);
    }
    // Everything in view across (nothing past the screen's edges).
    expect(b.king!.r, `${s.name}: the God King in view`).toBeLessThanOrEqual(s.viewport.width);
    await ctx.close();
  }
  // A phone whose board is held back by its height: the board grows as the scoreboard is minimized, and the row with it.
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 600 } });
  const page = await ctx.newPage();
  await intoBattle(page);
  const before = await boxes(page);
  await page.getByRole("button", { name: "Minimize the leaderboard" }).click();
  await expect.poll(async () => (await boxes(page)).board!.r - (await boxes(page)).board!.x).toBeGreaterThan(before.board!.r - before.board!.x + 10);
  const after = await boxes(page);
  expect(Math.abs(after.row!.x - after.board!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.row!.r - after.board!.r)).toBeLessThanOrEqual(1);
  await ctx.close();
});

test("your clock: bold at the box's right on every boss's screens, counting down on your move, holding what was left once it's in, never gone and never moving", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await intoBattle(page);
  // Every frame from here: the clock's text, its state and its box, and the words beside it.
  await page.evaluate(() => {
    const w = window as any;
    w.__clock = [];
    const tick = () => {
      const c = document.querySelector(".dk-clock");
      const t = c?.querySelector(".dk-time");
      const b = c?.getBoundingClientRect();
      const row = document.querySelector(".boss-dock-main")?.getBoundingClientRect();
      const p = w.match?.phase;
      w.__clock.push({
        t: Date.now(),
        kind: p?.kind,
        left: p?.kind === "play" ? p.deadline - Math.max(Date.now(), p.startsAt) : null,
        text: t?.textContent ?? null,
        running: !!c?.classList.contains("running"),
        r: b ? Math.round(b.right) : null,
        row: row ? `${Math.round(row.left)}-${Math.round(row.right)}@${Math.round(row.top)}` : null,
        words: document.querySelector(".dk-text")?.textContent ?? "",
      });
      if (w.__clock.length < 20_000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(1200 + 400 * i);
    await quietMove(page);
  }
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.waitForTimeout(500);
  const frames = await page.evaluate(() => (window as any).__clock as { t: number; kind: string; left: number | null; text: string | null; running: boolean; r: number | null; row: string | null; words: string }[]);
  expect(frames.length).toBeGreaterThan(100);
  const secs = (s: string) => Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);
  // Never gone, never moving: every frame shows m:ss at the same right edge.
  expect(frames.filter((f) => !f.text || !/^\d:\d\d$/.test(f.text))).toEqual([]);
  expect(new Set(frames.map((f) => f.r)).size, "the clock's right edge never moves").toBe(1);
  // Nor the row, on any frame, as one screen hands over to the next (each lines it up before its first paint).
  expect([...new Set(frames.map((f) => f.row))], "the row never moves").toHaveLength(1);
  // The words never carry the time.
  expect(frames.filter((f) => /\d:\d\d/.test(f.words))).toEqual([]);
  // On your move it runs, and says what's left (whole seconds rounded up, as the big 3-2-1); otherwise it holds. (Not
  // counting a phase's first two frames: the new screen may draw a frame after the match moves on.)
  for (const [i, f] of frames.entries()) {
    if (i < 2 || frames[i - 1]!.kind !== f.kind || frames[i - 2]!.kind !== f.kind) continue;
    if (f.kind === "play") {
      expect(f.running).toBe(true);
      // (Within a second: the clock redraws itself a few times a second.)
      expect(Math.abs(secs(f.text!) - Math.ceil(f.left! / 1000))).toBeLessThanOrEqual(1);
    } else expect(f.running, f.kind).toBe(false);
  }
  // What it holds through the boss's turn is what was left as your move went in.
  for (let i = 1; i < frames.length; i++) {
    if (frames[i - 1]!.kind === "play" && frames[i]!.kind !== "play") {
      const held = frames.slice(i).find((f) => f.kind !== "play" && f.text)!;
      expect(Math.abs(secs(held.text!) - secs(frames[i - 1]!.text!))).toBeLessThanOrEqual(1);
      for (const f of frames.slice(i)) {
        if (f.kind === "play") break;
        expect(f.text).toBe(held.text);
      }
    }
  }
  expect(errors).toEqual([]);
});
