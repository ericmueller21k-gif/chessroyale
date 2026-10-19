import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, asAdmin, named, test } from "./helpers.ts";

/**
 * Auto chess, the demo (/autochess; docs/areas/autochess.md; shelved: Settings' Testing section, for admins, opens it): a
 * round is played from buying to the fight's end, on a phone and a computer. `?quick=1` (a test switch) shortens the steps (buy 7 s with the last
 * 2 locked, circles half a second behind, adjust 5 s, a fight move every 60 ms); `?seed=` fixes the kings and the bot.
 */
const phone = () => test.info().project.name === "phone";
const QUICK = "/autochess?quick=1&seed=7";

/** Every page error and console error of a test: none may happen. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

const root = (p: Page) => p.locator(".ac-root");
const phase = (p: Page) => root(p).getAttribute("data-phase");
const goldOf = async (p: Page) => Number(await p.locator(".ac-gold-you b").innerText());
const botGold = async (p: Page) => Number(await p.locator(".ac-gold-bot b").innerText());
const hp = async (p: Page, who: "you" | "bot") => Number(await p.locator(`.ac-hp-${who} b`).innerText());

/** The center of a square on the page (the board drawn either way up: your half is always at the bottom). */
async function center(p: Page, square: string) {
  const b = (await p.locator(".ac-layer").boundingBox())!;
  const white = (await root(p).getAttribute("data-you")) === "w";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]);
  const col = white ? f : 7 - f;
  const row = white ? 8 - r : r - 1;
  return { x: b.x + ((col + 0.5) * b.width) / 8, y: b.y + ((row + 0.5) * b.height) / 8 };
}

/** A tap: a finger on a phone, a click on a computer. */
async function tapAt(p: Page, x: number, y: number) {
  if (phone()) await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
}
const tap = async (p: Page, l: Locator) => (phone() ? l.tap() : l.click());
const tapSquare = async (p: Page, sq: string) => {
  const c = await center(p, sq);
  await tapAt(p, c.x, c.y);
};

/** A drag from one point to another, with the mouse. */
async function dragMouse(p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move(from.x + 6, from.y - 6, { steps: 2 });
  await p.mouse.move(to.x, to.y, { steps: 8 });
  await p.mouse.up();
}

/** A drag with a finger (real touch events), as a phone makes it. */
async function dragTouch(p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await p.context().newCDPSession(p);
  const point = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from.x, from.y) });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const buyPiece = (p: Page, name: string) => p.getByRole("button", { name: new RegExp(`^Buy a ${name}`) });
const benchPieces = (p: Page) => p.locator(".ac-slot.has");
const piece = (p: Page, color: "white" | "black", role: string, square: string) => p.locator(`${BOARD_SEL.piece}.${color}.${role}[data-square="${square}"]`);

/** Squares of the half (rank 1 to 4 for White), not the king's. */
async function freeSquares(p: Page, ranks: number[]) {
  const king = (await root(p).getAttribute("data-king"))!;
  return ranks.flatMap((r) => [..."abcdefgh"].map((f) => `${f}${r}`)).filter((s) => s !== king);
}

test.beforeEach(async ({ page }) => {
  await named(page, "Pawnder");
  await page.addInitScript(() => ((window as any).__soundLog = []));
});

test("shelved (Eric, Oct 19): no button on home or in a player's Settings; an admin opens it from Settings' Testing; its back button goes home", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Auto chess/ })).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Auto chess/ })).toHaveCount(0);
  await asAdmin(page);
  await page.goto("/settings");
  const row = page.getByRole("button", { name: "Auto chess (shelved demo) ›" });
  await expect(row).toBeVisible();
  await row.click();
  await expect(root(page)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/autochess");
  await expect(page.locator(".ac-title strong")).toHaveText("Auto chess");
  await expect(page.locator(".ac-title span")).toHaveText("Round 1 · you play White");
  await page.getByRole("button", { name: "Back to home" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  // The address works by itself too (nothing is signed in or sent).
  await page.goto("/autochess");
  await expect(root(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("buy to the bench, place by tap and by drag, sell for 90% by drag and by tap, the reasons, and the lock", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(QUICK);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Round 1: no start gold, an income of 100; the kings are placed by the game, mirrored; you are White, at the bottom.
  expect(await goldOf(page)).toBe(100);
  await expect(page.locator(".ac-income b")).toHaveText("+100");
  expect(await hp(page, "you")).toBe(20);
  expect(await hp(page, "bot")).toBe(20);
  const king = (await root(page).getAttribute("data-king"))!;
  const botKing = (await root(page).getAttribute("data-bot-king"))!;
  expect(botKing[0]).toBe(king[0]);
  expect(Number(botKing[1]) + Number(king[1])).toBe(9);
  await expect(piece(page, "white", "king", king)).toBeVisible();
  await expect(piece(page, "black", "king", botKing)).toBeVisible();
  await expect(page.locator(BOARD_SEL.wrap)).toHaveClass(/orientation-white/);
  // The shop: five pieces with their prices (pawn 10, knight 30, bishop 32, rook 50, queen 90).
  await expect(page.locator(".ac-buy b")).toHaveText(["10", "30", "32", "50", "90"]);
  await expect(page.locator(".ac-slot")).toHaveCount(8);

  // Buy a pawn and a knight: onto the bench, gold down, a pop.
  await tap(page, buyPiece(page, "pawn"));
  await tap(page, buyPiece(page, "knight"));
  await expect(benchPieces(page)).toHaveCount(2);
  expect(await goldOf(page)).toBe(60);
  expect(await page.evaluate(() => (window as any).__soundLog.filter((l: string) => l.startsWith("pop:")).length)).toBe(2);
  // With 60 left a queen can't be had: greyed, with the reason under its price, and whole once it is tapped.
  await expect(buyPiece(page, "queen")).toHaveAttribute("aria-disabled", "true");
  await expect(buyPiece(page, "queen")).toContainText("No gold");
  await buyPiece(page, "queen").click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Not enough gold: a queen costs 90 and you have 60.");
  expect(await goldOf(page)).toBe(60);
  const squares = await freeSquares(page, [2, 3, 4]);

  // Place the pawn by tapping it, then a square; the king can't be picked up (it is the game's).
  await tap(page, benchPieces(page).first());
  await expect(page.locator(".ac-dot").first()).toBeVisible();
  await tapSquare(page, squares[0]!);
  await expect(piece(page, "white", "pawn", squares[0]!)).toBeVisible();
  await expect(benchPieces(page)).toHaveCount(1);
  await tapSquare(page, king);
  await expect(page.locator(".ac-msg")).toContainText("Your king is placed by the game.");
  // Place the knight by dragging it.
  const slot = (await benchPieces(page).first().boundingBox())!;
  await dragMouse(page, { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 }, await center(page, squares[10]!));
  await expect(piece(page, "white", "knight", squares[10]!)).toBeVisible();
  await expect(benchPieces(page)).toHaveCount(0);
  // Their half and the king's square refuse a piece: it stays on the bench with the reason.
  await tap(page, buyPiece(page, "pawn"));
  await tap(page, benchPieces(page).first());
  await tapSquare(page, king);
  await expect(page.locator(".ac-msg")).toContainText("That's your king's square.");
  await tapSquare(page, "e6");
  await expect(page.locator(".ac-msg")).toContainText("Pieces go on your half of the board.");
  // (A tap on your own piece picks that one up instead; a drop on it is refused.)
  const s1 = (await benchPieces(page).first().boundingBox())!;
  await dragMouse(page, { x: s1.x + s1.width / 2, y: s1.y + s1.height / 2 }, await center(page, squares[0]!));
  await expect(page.locator(".ac-msg")).toContainText("That square is taken.");
  expect(await goldOf(page)).toBe(50);
  await expect(benchPieces(page)).toHaveCount(1);
  // Drag the pawn on the bench onto the board's back rank: a pawn can't stand there.
  const back = await center(page, ["a1", "b1"].find((s) => s !== king)!);
  const s2 = (await benchPieces(page).first().boundingBox())!;
  await dragMouse(page, { x: s2.x + s2.width / 2, y: s2.y + s2.height / 2 }, back);
  await expect(page.locator(".ac-msg")).toContainText("Pawns can't stand on your back rank.");
  await expect(benchPieces(page)).toHaveCount(1);

  // Sell by tapping: the bench pawn (still picked up by the refused drag), "Sell 9" (90% of 10, rounded down), a sell sound.
  await expect(page.getByRole("button", { name: "Sell 9", exact: true })).toBeVisible();
  await tap(page, page.getByRole("button", { name: "Sell 9", exact: true }));
  await expect(benchPieces(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(59);
  expect(await page.evaluate(() => (window as any).__soundLog.filter((l: string) => l.startsWith("sell:")).length)).toBe(1);
  // Sell by dragging a placed piece (the knight: 90% of 30 is 27) onto the shop row.
  await dragMouse(page, await center(page, squares[10]!), await page.locator(".ac-shop").boundingBox().then((b) => ({ x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 })));
  await expect(piece(page, "white", "knight", squares[10]!)).toHaveCount(0);
  expect(await goldOf(page)).toBe(86);
  expect(await page.evaluate(() => (window as any).__soundLog.filter((l: string) => l.startsWith("sell:")).length)).toBe(2);
  // Sell a placed piece by tapping it, then "Sell 9".
  await tapSquare(page, squares[0]!);
  await tap(page, page.getByRole("button", { name: "Sell 9", exact: true }));
  await expect(piece(page, "white", "pawn", squares[0]!)).toHaveCount(0);
  expect(await goldOf(page)).toBe(95);

  // The reasons, at 95 gold: eight pawns fill the bench and the eight-pawn limit (the limits are named before the bench).
  for (let i = 0; i < 8; i++) await tap(page, buyPiece(page, "pawn"));
  await expect(benchPieces(page)).toHaveCount(8);
  expect(await goldOf(page)).toBe(15);
  await expect(buyPiece(page, "pawn")).toContainText("Max 8");
  await buyPiece(page, "pawn").click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("8 pawns at most.");
  await expect(buyPiece(page, "knight")).toContainText("Bench full");
  await buyPiece(page, "knight").click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Your bench is full. Place or sell a piece first.");
  expect(await goldOf(page)).toBe(15);

  // The opponent's pieces show as plain circles, behind; no real black piece but the king until the reveal.
  await expect.poll(() => page.locator(".ac-circle").count()).toBeGreaterThan(0);
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(1);
  expect(await botGold(page)).toBeLessThan(100);

  // The last 2 seconds are locked: "Locked" on the timer, and nothing is bought, sold or moved.
  await expect(page.locator(".ac-clock span")).toHaveText("Locked", { timeout: 15_000 });
  const before = await goldOf(page);
  await buyPiece(page, "pawn").click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Locked: no buying, selling or moving.");
  expect(await goldOf(page)).toBe(before);
  await expect(page.locator(".ac-shop small").first()).toHaveText("Locked");
  expect(errors).toEqual([]);
});

test("a drag with a finger: a bench piece onto the board and a placed piece back to the bench", async ({ page }) => {
  test.skip(!phone(), "real touch events, as a phone makes them");
  const errors = watchErrors(page);
  await page.goto(QUICK);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await buyPiece(page, "knight").tap();
  const squares = await freeSquares(page, [2, 3]);
  const slot = (await benchPieces(page).first().boundingBox())!;
  await dragTouch(page, { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 }, await center(page, squares[3]!));
  await expect(piece(page, "white", "knight", squares[3]!)).toBeVisible();
  await expect(benchPieces(page)).toHaveCount(0);
  // Back to the bench with a finger.
  const bench = (await page.locator(".ac-bench").boundingBox())!;
  await dragTouch(page, await center(page, squares[3]!), { x: bench.x + bench.width - 20, y: bench.y + bench.height / 2 });
  await expect(piece(page, "white", "knight", squares[3]!)).toHaveCount(0);
  await expect(benchPieces(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the reveal: their real pieces show, stay shown through the adjust step; one legal move each, an illegal one refused, a second refused, a move taken back", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(QUICK);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const king = (await root(page).getAttribute("data-king"))!;
  // A pawn on its start rank, a knight on the back rank, a rook next to it: 10 + 30 + 50 (and the rest saved).
  await tap(page, buyPiece(page, "pawn"));
  await tap(page, buyPiece(page, "knight"));
  await tap(page, buyPiece(page, "rook"));
  const file = king[0] === "f" ? "g" : "f";
  const pawnSq = `${file}2`;
  const knightSq = king === "b1" ? "h1" : "b1";
  const rookSq = `${file}1`;
  for (const sq of [pawnSq, knightSq, rookSq]) {
    await tap(page, benchPieces(page).first());
    await tapSquare(page, sq);
  }
  await expect(benchPieces(page)).toHaveCount(0);
  // Circles first (where, not what), over the 30 (here 6) seconds; the last ones come a moment after the bot is done.
  await expect.poll(() => page.locator(".ac-circle").count(), { timeout: 15_000 }).toBeGreaterThan(2);
  const circles = await page.locator(".ac-circle").count();
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(1);
  // The reveal: their real pieces, kept shown as they were when it locked (the circles' squares hold real pieces).
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-theirs-line")).toHaveText("Your opponent is moving their pieces…");
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  const theirs = await page.locator(`${BOARD_SEL.piece}.black`).count();
  expect(theirs).toBeGreaterThanOrEqual(circles + 1);
  // (The line is plain: no blur over their half.)
  expect(await page.locator(".ac-theirs-line").evaluate((el) => getComputedStyle(el).filter + getComputedStyle(el).backdropFilter)).toBe("nonenone");
  await expect(page.locator(".ac-clock span")).toHaveText("Move your pieces");

  // A legal move: the pawn on its start rank pushes two (a dot on each square, then the move), and is marked.
  await tapSquare(page, pawnSq);
  await expect(page.locator(".ac-dot")).toHaveCount(2);
  await tapSquare(page, `${file}4`);
  await expect(piece(page, "white", "pawn", `${file}4`)).toBeVisible();
  await expect(page.locator(`.ac-moved[data-square="${file}4"]`)).toBeVisible();
  // The opponent's pieces haven't changed meanwhile, and are still shown.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  // An illegal move is refused (a knight onto a square it can't reach; and into their half), and the piece stays.
  await tapSquare(page, knightSq);
  await tapSquare(page, "e4");
  await expect(page.locator(".ac-card-say")).toContainText("That piece can't move there");
  await expect(piece(page, "white", "knight", knightSq)).toBeVisible();
  await tapSquare(page, knightSq);
  await tapSquare(page, rookSq);
  await tapSquare(page, `${file}5`);
  await expect(page.locator(".ac-card-say")).toContainText("That piece can't move there");
  // A second move of the same piece is refused: dragging the moved pawn on.
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  await dragMouse(page, await center(page, `${file}4`), await center(page, `${file}3`));
  await expect(page.locator(".ac-card-say")).toContainText("That piece has moved already.");
  await expect(piece(page, "white", "pawn", `${file}4`)).toBeVisible();
  // The rook was shut in by the pawn; now the pawn has left, it may go up the file, once.
  await tapSquare(page, rookSq);
  await expect(page.locator(".ac-dot").first()).toBeVisible();
  await tapSquare(page, `${file}3`);
  await expect(piece(page, "white", "rook", `${file}3`)).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(2);
  // A tap on a moved piece takes its move back.
  await tapSquare(page, `${file}3`);
  await expect(piece(page, "white", "rook", rookSq)).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  // The king too may take one move.
  await tapSquare(page, king);
  await expect(page.locator(".ac-dot").first()).toBeVisible();
  const dots = await page.locator(".ac-dot").count();
  expect(dots).toBeGreaterThan(1);
  // Their pieces were shown all through.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  expect(errors).toEqual([]);
});

test("a fight plays to a result, HP changes by the rule, and the next round starts empty but for the new kings, with the colors turned", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  await page.goto(QUICK);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // 100 gold: a rook, a knight and two pawns, placed on the near side.
  for (const name of ["rook", "knight", "pawn", "pawn"]) await tap(page, buyPiece(page, name));
  const squares = await freeSquares(page, [3, 2, 1]);
  for (let i = 0; i < 4; i++) {
    await tap(page, benchPieces(page).first());
    await tapSquare(page, squares[i * 2]!);
  }
  await expect(benchPieces(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(0);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 15_000 });
  // The fight: moves appear (the board changes, a last-move highlight), "Move N of 60".
  await expect(page.locator(".ac-card-say")).toContainText(/Move \d+ of 60/);
  await expect(page.locator(`${BOARD_SEL.square}.last-move`).first()).toBeAttached({ timeout: 10_000 });
  await expect(page.locator(".ac-clock span")).toHaveText("Fight");
  // The board's usual knocks play for the engine's moves (a capture sounds as it does everywhere).
  expect(await page.evaluate(() => (window as any).__soundLog.filter((l: string) => /^(move|capture):/.test(l)).length)).toBeGreaterThan(0);
  // To a result.
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 150_000 });
  const head = (await page.locator(".ac-card-head").innerText()).trim();
  expect(head).toMatch(/^(You win the round\.|You lose the round\.|The round is a draw\.)$/);
  const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
  const lost = words.match(/(?:You|Your opponent) loses? (\d+) HP\./);
  const gold = (await page.locator(".ac-card-gold").innerText()).trim();
  expect(gold).toMatch(/^Next round: \d+ saved \+ \d+ income( \+ \d+ interest)?( \+ \d+ streak)?( \+ \d+ survivors)?( \+ \d+ bench)? = \d+ gold$/);
  expect(gold).toMatch(/^Next round: 0 saved \+ 120 income/);
  const [youHp, botHp] = [await hp(page, "you"), await hp(page, "bot")];
  if (head.startsWith("You win")) {
    expect(youHp).toBe(20);
    expect(botHp).toBe(20 - Number(lost![1]));
    expect(botHp).toBeLessThan(20);
  } else if (head.startsWith("You lose")) {
    expect(botHp).toBe(20);
    expect(youHp).toBe(20 - Number(lost![1]));
    expect(youHp).toBeLessThan(20);
  } else {
    expect([youHp, botHp]).toEqual([20, 20]);
    expect(words).toContain("Nobody loses HP.");
  }
  // The loss is 2 plus 1 for every enemy piece (not the king) left: never under 2 for a lost round.
  if (lost) expect(Number(lost[1])).toBeGreaterThanOrEqual(2);
  // The final position stays on the board for a look; the result is in the box under it.
  expect(await page.locator(BOARD_SEL.piece).count()).toBeGreaterThanOrEqual(2);
  // (A match can't end in one round: the most a lost round costs is 2 + 14.)
  expect(await phase(page)).toBe("result");

  // The next round: the kings alone (new squares, mirrored), you are Black and your half is at the bottom; the gold is what the line said.
  const total = Number(gold.match(/= (\d+) gold$/)![1]);
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(root(page)).toHaveAttribute("data-round", "2");
  await expect(page.locator(".ac-title span")).toHaveText("Round 2 · you play Black");
  await expect(page.locator(BOARD_SEL.wrap)).toHaveClass(/orientation-black/);
  await expect(page.locator(BOARD_SEL.piece)).toHaveCount(2);
  await expect(page.locator(".ac-slot.has")).toHaveCount(0);
  expect(await goldOf(page)).toBe(total);
  await expect(page.locator(".ac-income b")).toHaveText("+120");
  const k2 = (await root(page).getAttribute("data-king"))!;
  const b2 = (await root(page).getAttribute("data-bot-king"))!;
  expect(Number(k2[1])).toBeGreaterThanOrEqual(7);
  expect(b2[0]).toBe(k2[0]);
  expect(Number(k2[1]) + Number(b2[1])).toBe(9);
  // Black's pieces go on the half at the bottom: a tap-tap on the near side works.
  await tap(page, buyPiece(page, "pawn"));
  await tap(page, benchPieces(page).first());
  const sq = (await freeSquares(page, [6, 7])).find((s) => s !== k2)!;
  await tapSquare(page, sq);
  await expect(piece(page, "black", "pawn", sq)).toBeVisible();
  expect(errors).toEqual([]);
});

test("layouts: the board, bench, shop and your row fit the screen with no scrolling, at 320 px and on a computer", async ({ page }) => {
  const errors = watchErrors(page);
  const sizes = phone()
    ? ([[320, 568], [360, 640], [375, 667], [390, 664], [390, 844], [430, 932]] as const)
    : ([[1280, 800], [1280, 600], [1366, 768], [1920, 1080]] as const);
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(QUICK);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await tap(page, buyPiece(page, "knight"));
    const m = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const board = r(".hb-board");
      return {
        scroll: document.documentElement.scrollHeight - innerHeight,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        board: { w: board.width, h: board.height, top: board.top, left: board.left, right: board.right },
        me: r(".ac-me").bottom,
        shop: r(".ac-shop").bottom,
        buttons: [...document.querySelectorAll(".ac-buy")].map((b) => b.getBoundingClientRect()).map((b) => ({ r: b.right, l: b.left })),
        bench: [...document.querySelectorAll(".ac-slot")].map((b) => b.getBoundingClientRect().width),
        clock: r(".ac-clock").right,
      };
    });
    expect(m.scroll, `${w}×${h}: scrolling`).toBeLessThanOrEqual(0);
    expect(m.sideways, `${w}×${h}: sideways`).toBe(0);
    expect(Math.abs(m.board.w - m.board.h), `${w}×${h}: a square board`).toBeLessThan(1.5);
    expect(m.board.left, `${w}×${h}`).toBeGreaterThanOrEqual(0);
    expect(m.board.right, `${w}×${h}`).toBeLessThanOrEqual(w);
    expect(m.me, `${w}×${h}: your row on screen`).toBeLessThanOrEqual(h);
    expect(m.clock, `${w}×${h}: the clock inside`).toBeLessThanOrEqual(w);
    expect(m.buttons.every((b) => b.l >= 0 && b.r <= w), `${w}×${h}: the shop inside`).toBe(true);
    expect(m.bench.every((x) => x >= 28), `${w}×${h}: the bench's slots`).toBe(true);
    // A phone's board is as wide as the room allows; the others' room is the height.
    if (w <= 430) expect(m.board.w, `${w}×${h}`).toBeGreaterThan(Math.min(w - 40, h - 300) - 10);
  }
  // The result box is the same size as the shop and bench it replaces: the board doesn't move when the step changes.
  await page.setViewportSize({ width: phone() ? 390 : 1280, height: phone() ? 664 : 800 });
  await page.goto(QUICK);
  const before = (await page.locator(".hb-board").boundingBox())!;
  const bottom = (await page.locator(".ac-me").boundingBox())!;
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  const during = (await page.locator(".hb-board").boundingBox())!;
  const bottom2 = (await page.locator(".ac-me").boundingBox())!;
  expect(Math.abs(during.y - before.y) + Math.abs(during.width - before.width)).toBeLessThan(1);
  expect(Math.abs(bottom2.y - bottom.y)).toBeLessThan(1);
  expect(errors).toEqual([]);
});
