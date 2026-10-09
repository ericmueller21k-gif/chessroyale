import { devices, expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { soloFromHome, test } from "./helpers.ts";

/**
 * The match screen's board furniture (Eric, Oct 9, 2026): the green ring on the move the crowd played sits exactly on
 * its square; the move clock's bars (above and below the board) and the small clock at the board's top right sit
 * outside the squares and clear of the line above the board; and on a computer, chat under the vote results stays put
 * from one phase to the next.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

/** The board's furniture while a move is being chosen: the board, the bars, the clock and the line above. */
function furniture(p: Page) {
  return p.evaluate(() => {
    const box = (e: Element | null): Box | null => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const area = document.querySelector(".board-area")!;
    const line = area.querySelector(".opening-name")!;
    // The line's text as drawn (whatever of it shows), to check it never runs under the clock.
    const range = document.createRange();
    range.selectNodeContents(line);
    const text = [...range.getClientRects()].filter((r) => r.width > 0);
    return {
      board: box(area.querySelector("cg-container")),
      bars: [...area.querySelectorAll(".timer-bar")].map(box) as Box[],
      clock: box(area.querySelector(".board-clock")),
      clockText: (area.querySelector(".board-clock") as HTMLElement | null)?.innerText ?? "",
      textRight: Math.max(...text.map((r) => r.right)),
      textCut: line.scrollWidth > line.clientWidth + 0.5,
      line: (line as HTMLElement).innerText,
    };
  });
}

/** How far the reveal's ring is from the square it marks (the move's own last-move square): the worst edge, in px. */
function ringOff(p: Page) {
  return p.evaluate(() => {
    const ring = document.querySelector(".square-ring")!.getBoundingClientRect();
    const squares = [...document.querySelectorAll(".board-area cg-board square.last-move")].map((s) => s.getBoundingClientRect());
    const off = (s: DOMRect) => Math.max(Math.abs(s.left - ring.left), Math.abs(s.top - ring.top), Math.abs(s.right - ring.right), Math.abs(s.bottom - ring.bottom));
    const board = document.querySelector(".board-area cg-container")!.getBoundingClientRect().width;
    const wrap = document.querySelector(".board-area .board-wrap")!.getBoundingClientRect().width;
    return { off: Math.min(...squares.map(off)), size: ring.width, board, wrap, flipped: !!document.querySelector(".board-area .orientation-black") };
  });
}

test("the reveal's ring sits exactly on its square at two widths; the bars and the board's clock stay off the squares", async ({ browser }, info) => {
  test.setTimeout(3 * 60_000);
  const phone = info.project.name === "phone";
  // Chessground draws the squares in a box it rounds down to a whole multiple of 8 device pixels, a little smaller
  // than the board's wrap, and the old ring was placed in % of the wrap. The sizes are picked where that gap is
  // widest: a phone (3 device pixels to a pixel) where it's 2.3 px, and a computer at a 125% display scale, as Eric's
  // is, where it's 5-6 px.
  const ctx = await browser.newContext(
    phone ? ({ ...devices["iPhone 13"], browserName: undefined } as any) : { viewport: { width: 1396, height: 733 }, deviceScaleFactor: 1.25 },
  );
  const page = await ctx.newPage();
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0");
  await soloFromHome(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).match?.phase.kind === "play" && Date.now() > (window as any).match.phase.startsAt + 800), { timeout: 60_000 })
    .toBe(true);

  // Your move: two bars (above and below the board), a few pixels thick, outside the squares; the clock above the
  // board's top right corner, clear of the bar and of the line's text.
  const f = await furniture(page);
  const where = JSON.stringify(f);
  const [above, below] = f.bars;
  expect(f.bars, where).toHaveLength(2);
  expect(above!.height, where).toBeGreaterThanOrEqual(5);
  expect(above!.bottom, where).toBeLessThanOrEqual(f.board!.top + 1);
  expect(below!.top, where).toBeGreaterThanOrEqual(f.board!.bottom - 1);
  expect(f.clock, where).not.toBeNull();
  expect(f.clockText, where).toMatch(/^\d+s\s*\d+:\d\d$/);
  expect(Math.abs(f.clock!.right - f.board!.right), where).toBeLessThanOrEqual(2);
  expect(f.clock!.bottom, where).toBeLessThanOrEqual(above!.top + 0.5);
  expect(f.textRight, where).toBeLessThanOrEqual(f.clock!.left);
  expect(f.textCut, where).toBe(false);

  // The crowd's move lands with the ring on its square. Hold the reveal there and look at two widths.
  await page.evaluate(async () => {
    const m = (window as any).match;
    const top = await m.runner.topMovesFor(m.phase.board.fen);
    if (m.phase.kind === "play") m.submit(top[0].move);
  });
  await expect(page.locator(".square-ring")).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => clearTimeout((window as any).match.timer));
  await page.waitForTimeout(700); // (its entrance)
  for (const width of phone ? [361, 425] : [1396, 1300]) {
    await page.setViewportSize({ width, height: phone ? Math.round(width * 2.16) : 733 });
    await page.waitForTimeout(400);
    const r = await ringOff(page);
    expect(r.off, `${width} px: ${JSON.stringify(r)}`).toBeLessThanOrEqual(1);
    // The clock stays through the reveal (your bank alone: no move clock runs).
    await expect(page.locator(".board-clock")).toHaveText(/^\d+:\d\d$/);
  }
});

test("on a computer, chat under the vote results stays put from your move to the reveal", async ({ browser }, info) => {
  test.setTimeout(4 * 60_000);
  test.skip(info.project.name !== "desktop", "a computer's layout");
  const page = await (await browser.newContext({ viewport: { width: 1396, height: 800 } })).newPage();
  await page.goto("/?debug&mode=crowd&pool=match-screen-chat");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match?.chat?.enabled ?? false), { timeout: 90_000 }).toBe(true);
  await expect
    .poll(() => page.evaluate(() => (window as any).match?.phase.kind === "play" && Date.now() > (window as any).match.phase.startsAt + 800), { timeout: 90_000 })
    .toBe(true);
  const chatTop = () => page.evaluate(() => Math.round(document.querySelector(".under-board .qchat")!.getBoundingClientRect().top));
  const during = await chatTop();
  // Your move (any legal one: the layout is what's tested).
  const fen: string = await page.evaluate(() => (window as any).match.phase.board.fen);
  const m = new Chess(fen).moves({ verbose: true })[0]!;
  await page.evaluate((uci) => (window as any).match.submit(uci), m.from + m.to + (m.promotion ?? ""));
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("reveal");
  await expect(page.locator(".poll-result")).toBeVisible();
  const poll = await page.locator(".poll").boundingBox();
  expect(await chatTop()).toBe(during);
  expect(during).toBeGreaterThanOrEqual(Math.round(poll!.y + poll!.height));
});
