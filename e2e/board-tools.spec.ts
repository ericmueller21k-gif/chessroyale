import { expect, type Browser, type Page } from "@playwright/test";
import { BOARD_SEL, named, test } from "./helpers.ts";

/**
 * chess.com's board habits on our board (docs/decisions/2026-10-28-arrows-and-premoves.md), in a Ranked 1 v 1 game
 * between two players through the real server: on a computer, arrows by right-drag in each color (Ctrl, Alt, Shift),
 * squares by right-click, a left-click clearing them, and never the browser's menu over the board; a queue of two
 * premoves playing out, one cancelled by a reply that makes it illegal, and a right-click cancelling one. On a phone, a
 * premove by tap-tap and one by a finger's drag, each played as the turn comes, and one cancelled by a tap elsewhere.
 * Each test queues in a pool of its own (`?pool=`, a test switch).
 */

const isComputer = () => test.info().project.name === "desktop";

async function player(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  return page;
}

const poolName = () => `bt${test.info().project.name.slice(0, 1)}${Math.random().toString(36).slice(2, 9)}`;

/** Both players queue in a pool of their own, meet, and the game's first move is due (the vote left to its default). */
async function game(browser: Browser, names: [string, string]): Promise<{ white: Page; black: Page }> {
  const a = await player(browser, names[0]);
  const b = await player(browser, names[1]);
  const pool = poolName();
  await a.goto(`/1v1?nolanding&debug&pool=${pool}`);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  await b.goto(`/1v1?nolanding&debug&pool=${pool}`);
  for (const p of [a, b]) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 40_000 });
  const white = (await a.locator(".dv-strip.dv-you").getAttribute("data-side")) === "w";
  return white ? { white: a, black: b } : { white: b, black: a };
}

const board = (page: Page) => page.locator(`.board-area ${BOARD_SEL.squares}`);

/** A square's center on screen, either way up. */
async function center(page: Page, square: string): Promise<{ x: number; y: number }> {
  const box = (await board(page).boundingBox())!;
  const white = (await page.locator(`.board-area ${BOARD_SEL.wrap}`).getAttribute("class"))!.includes("orientation-white");
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = white ? f : 7 - f;
  const row = white ? 7 - r : r;
  return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
}

/** A move by two clicks, as a player makes it with a mouse. */
async function clickMove(page: Page, uci: string) {
  const a = await center(page, uci.slice(0, 2));
  const b = await center(page, uci.slice(2, 4));
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

/** A move by two taps of a finger. */
async function tapMove(page: Page, uci: string) {
  for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const p = await center(page, sq);
    await page.touchscreen.tap(p.x, p.y);
  }
}

/** A finger dragging a piece from one square to another (real touch events). */
async function touchDrag(page: Page, uci: string) {
  const a = await center(page, uci.slice(0, 2));
  const b = await center(page, uci.slice(2, 4));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** A right-drag from one square to another (or a right-click on one), holding a key. */
async function rightDrag(page: Page, from: string, to: string, key?: "Control" | "Alt" | "Shift") {
  const a = await center(page, from);
  const b = await center(page, to);
  if (key) await page.keyboard.down(key);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button: "right" });
  if (from !== to) await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up({ button: "right" });
  if (key) await page.keyboard.up(key);
}

/** The piece on a square ("bp", "wn"), or "" for none. */
const pieceOn = (page: Page, square: string) =>
  page.evaluate(
    ([sel, sq]) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.getAttribute("data-square") === sq && !e.classList.contains("fading") && !e.classList.contains("ghost"));
      if (!el) return "";
      const c = el.classList;
      const role = ["pawn", "knight", "bishop", "rook", "queen", "king"].find((r) => c.contains(r))!;
      return (c.contains("white") ? "w" : "b") + (role === "knight" ? "n" : role[0]);
    },
    [`.board-area ${BOARD_SEL.piece}`, square] as const,
  );

/** The squares in the premove color. */
const premoveSquares = (page: Page) => page.locator(`.board-area ${BOARD_SEL.square}.premove`);

/** The squares the board marks as the last move (both players see each move land). */
async function lastMoveIs(page: Page, uci: string) {
  await expect.poll(() => Promise.all([pieceOn(page, uci.slice(2, 4)), pieceOn(page, uci.slice(0, 2))]).then(([to, from]) => !!to && !from), { timeout: 10_000 }).toBe(true);
}

test("a computer: right-drag arrows in four colors, right-click squares, a left-click clears them, no browser menu over the board", async ({ browser }) => {
  test.skip(!isComputer(), "arrows and highlights are drawn with a mouse");
  test.setTimeout(2 * 60_000);
  const { white } = await game(browser, ["Ann Arrow", "Bo Arrow"]);
  // (Whether the browser's menu was let open: every contextmenu over the board is turned down.)
  await white.evaluate(() => {
    (window as any).menus = [];
    addEventListener("contextmenu", (e) => (window as any).menus.push(e.defaultPrevented));
  });

  // Arrows: plain yellow-orange, Ctrl red, Alt blue, Shift green; a knight's is an L.
  await rightDrag(white, "e2", "e4");
  await rightDrag(white, "d2", "d4", "Control");
  await rightDrag(white, "c2", "c4", "Alt");
  await rightDrag(white, "g1", "f3", "Shift");
  const arrows = white.locator(".board-area svg.hb-user-arrows g");
  await expect(arrows).toHaveCount(4);
  const colors = await arrows.evaluateAll((gs) => gs.map((g) => [g.getAttribute("class"), getComputedStyle(g).color, g.querySelector("polyline")!.getAttribute("points")!.split(" ").length]));
  expect(colors).toEqual([
    ["ua-orange", "rgb(255, 170, 0)", 2],
    ["ua-red", "rgb(248, 85, 63)", 2],
    ["ua-blue", "rgb(72, 193, 249)", 2],
    // (The knight's L: a corner.)
    ["ua-green", "rgb(159, 207, 63)", 4],
  ]);
  // The same arrow again takes it away.
  await rightDrag(white, "c2", "c4", "Alt");
  await expect(arrows).toHaveCount(3);

  // Squares: plain red, Ctrl yellow, Alt blue, Shift green; the same again clears one.
  await rightDrag(white, "e5", "e5");
  await rightDrag(white, "d5", "d5", "Control");
  await rightDrag(white, "c5", "c5", "Alt");
  await rightDrag(white, "f5", "f5", "Shift");
  const marked = white.locator(`.board-area ${BOARD_SEL.square}.uh`);
  await expect(marked).toHaveCount(4);
  for (const [sq, cls] of [
    ["e5", "uh-red"],
    ["d5", "uh-yellow"],
    ["c5", "uh-blue"],
    ["f5", "uh-green"],
  ] as const) {
    const box = (await white.locator(`.board-area ${BOARD_SEL.square}.${cls}`).boundingBox())!;
    const c = await center(white, sq);
    expect(Math.abs(box.x + box.width / 2 - c.x)).toBeLessThan(1.5);
    expect(Math.abs(box.y + box.height / 2 - c.y)).toBeLessThan(1.5);
  }
  await rightDrag(white, "f5", "f5", "Shift");
  await expect(marked).toHaveCount(3);
  // Only on this device: Bo sees none of it.

  // A left-click anywhere on the board clears every arrow and square.
  const empty = await center(white, "a5");
  await white.mouse.click(empty.x, empty.y);
  await expect(arrows).toHaveCount(0);
  await expect(marked).toHaveCount(0);
  // A plain move made with the mouse is unchanged, and clears them too.
  await rightDrag(white, "e2", "e4");
  await expect(arrows).toHaveCount(1);
  await clickMove(white, "e2e4");
  await expect(arrows).toHaveCount(0);
  await lastMoveIs(white, "e2e4");

  const menus = (await white.evaluate(() => (window as any).menus)) as boolean[];
  expect(menus.length).toBeGreaterThan(10);
  expect(menus.every(Boolean)).toBe(true);
});

test("a computer: two premoves play out, one a reply makes illegal is cancelled, and a right-click cancels one", async ({ browser }) => {
  test.skip(!isComputer(), "a computer queues premoves; the phone's one is tested below");
  test.setTimeout(3 * 60_000);
  const { white, black } = await game(browser, ["Ann Premove", "Bo Premove"]);

  // While White thinks, Black lines up two: ...e5 and ...Nf6. Each shows on its square, its squares in the premove red.
  await clickMove(black, "e7e5");
  await expect(premoveSquares(black)).toHaveCount(2);
  expect(await pieceOn(black, "e5")).toBe("bp");
  expect(await pieceOn(black, "e7")).toBe("");
  await clickMove(black, "g8f6");
  await expect(premoveSquares(black)).toHaveCount(4);
  // (Premoves are yours only: White sees nothing of them.)
  await expect(premoveSquares(white)).toHaveCount(0);
  expect(await pieceOn(white, "e5")).toBe("");

  // 1. e4: ...e5 plays at once; ...Nf6 waits for Black's next turn.
  await clickMove(white, "e2e4");
  await lastMoveIs(white, "e7e5");
  await expect(premoveSquares(black)).toHaveCount(2);
  // 2. d4: ...Nf6.
  await clickMove(white, "d2d4");
  await lastMoveIs(white, "g8f6");
  await expect(premoveSquares(black)).toHaveCount(0);

  // Black premoves ...exd4; White's 3. dxe5 takes the pawn that would play it: cancelled, the pawn shown back, no colors.
  await clickMove(black, "e5d4");
  await expect(premoveSquares(black)).toHaveCount(2);
  await clickMove(white, "d4e5");
  await lastMoveIs(black, "d4e5");
  await expect(premoveSquares(black)).toHaveCount(0);
  expect(await pieceOn(black, "e5")).toBe("wp");
  expect(await pieceOn(black, "d4")).toBe("");
  await expect(black.locator(".dv-status")).toHaveText("Your move");

  // 3... Nc6; then a premove ...Nxe5 that a right-click cancels, before White's 4. Nf3: nothing plays.
  await clickMove(black, "b8c6");
  await lastMoveIs(white, "b8c6");
  await clickMove(black, "c6e5");
  await expect(premoveSquares(black)).toHaveCount(2);
  const anywhere = await center(black, "h4");
  await black.mouse.click(anywhere.x, anywhere.y, { button: "right" });
  await expect(premoveSquares(black)).toHaveCount(0);
  expect(await pieceOn(black, "c6")).toBe("bn");
  // (Nor did the right-click leave a square colored.)
  await expect(black.locator(`.board-area ${BOARD_SEL.square}.uh`)).toHaveCount(0);
  await clickMove(white, "g1f3");
  await lastMoveIs(black, "g1f3");
  await expect(black.locator(".dv-status")).toHaveText("Your move");
  expect(await pieceOn(black, "c6")).toBe("bn");
  expect(await pieceOn(white, "c6")).toBe("bn");
});

test("a phone: a premove by tap-tap and one by a drag, each played as the turn comes; a tap elsewhere cancels one", async ({ browser }) => {
  test.skip(isComputer(), "a phone's premove (the computer's queue is tested above)");
  test.setTimeout(3 * 60_000);
  const { white, black } = await game(browser, ["Ann Phone", "Bo Phone"]);

  // Tap-tap: ...e5 while White thinks; 1. e4 and it plays.
  await tapMove(black, "e7e5");
  await expect(premoveSquares(black)).toHaveCount(2);
  expect(await pieceOn(black, "e5")).toBe("bp");
  await tapMove(white, "e2e4");
  await lastMoveIs(white, "e7e5");
  await expect(premoveSquares(black)).toHaveCount(0);

  // A finger's drag: ...Nf6; 2. Nf3 and it plays.
  await touchDrag(black, "g8f6");
  await expect(premoveSquares(black)).toHaveCount(2);
  expect(await pieceOn(black, "f6")).toBe("bn");
  await tapMove(white, "g1f3");
  await lastMoveIs(white, "g8f6");
  await expect(premoveSquares(black)).toHaveCount(0);

  // ...Bc5, then a tap on a3 cancels it: the bishop back on f8, no colors; 3. Nc3 and nothing plays.
  await tapMove(black, "f8c5");
  await expect(premoveSquares(black)).toHaveCount(2);
  expect(await pieceOn(black, "c5")).toBe("bb");
  const a3 = await center(black, "a3");
  await black.touchscreen.tap(a3.x, a3.y);
  await expect(premoveSquares(black)).toHaveCount(0);
  expect(await pieceOn(black, "f8")).toBe("bb");
  await tapMove(white, "b1c3");
  await lastMoveIs(black, "b1c3");
  await expect(black.locator(".dv-status")).toHaveText("Your move");
  expect(await pieceOn(black, "f8")).toBe("bb");
  expect(await pieceOn(white, "c5")).toBe("");
});
