import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, asAdmin, named, test } from "./helpers.ts";

/**
 * Auto chess, the demo (/autochess; docs/areas/autochess.md; shelved: Settings' Testing section, for admins, opens it): a
 * round is played from buying to the fight's end, on a phone and a computer. `?quick=1` (a test switch) shortens the steps (buy 7 s with the last
 * 2 locked, circles half a second behind, adjust 5 s, a fight move every 60 ms); `?seed=` fixes the kings, the shop and the bot.
 */
const phone = () => test.info().project.name === "phone";
// (A tap or click that finds nothing fails in seconds, not at the test's end.)
test.use({ actionTimeout: 15_000 });

// Seeds (each fixes round 1's kings, its five offers and the bot; the bot's lock-in time comes from a draw of its own, so it holds
// whatever else the bot's buying becomes). `quick` = the steps' short times.
//  9: rook b4, pawn d4, pawn g3, pawn d4, pawn b4 (two offers share b4 and d4); king d2; the bot never locks in.
//  5: pawn f2, pawn g2, pawn f2, pawn g3, pawn c4; king c1; the bot locks in at 3.79 s (of the 4 s open).
// 11: pawn b2, pawn c4, pawn b3, pawn f4, knight e3; king h1; the bot locks in at 1.33 s.
// 60: queen g3, rook e3, pawn e3, queen f3, pawn b3; king h1.
//  3: pawn g3, pawn b4, pawn h3, rook e4, pawn c4; king e2.
const DUP = "/autochess?quick=1&seed=9";
const LATE = "/autochess?quick=1&seed=5";
const EARLY = "/autochess?quick=1&seed=11";
const POOR = "/autochess?quick=1&seed=60";
const FIGHT = "/autochess?quick=1&seed=3";
const NEVER = DUP;
const PRICES: Record<string, number> = { p: 10, n: 30, b: 32, r: 50, q: 90 };
const NAMES: Record<string, string> = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen" };

/** Every page error and console error of a test: none may happen. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

const root = (p: Page) => p.locator(".ac-root");
const goldOf = async (p: Page) => Number(await p.locator(".ac-gold-you b").innerText());
const hp = async (p: Page, who: "you" | "bot") => Number(await p.locator(`.ac-hp-${who} b`).innerText());
const soundCount = (p: Page, name: string) => p.evaluate((n) => (window as any).__soundLog.filter((l: string) => l.startsWith(`${n}:`)).length, name);

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
/** A tap on something greyed (aria-disabled): Playwright won't act on it unless forced; a player can. */
const tapGreyed = async (p: Page, l: Locator) => (phone() ? l.tap({ force: true }) : l.click({ force: true }));
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

const middle = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

interface Shown {
  kind: string;
  square: string;
}
/** The five offers now, in slot order (each shop card says its piece and its square). */
const offers = (p: Page): Promise<Shown[]> => p.locator(".ac-buy").evaluateAll((els) => els.map((e) => ({ kind: e.getAttribute("data-kind")!, square: e.getAttribute("data-square")! })));
const card = (p: Page, slot: number) => p.locator(`.ac-buy[data-slot="${slot}"]`);
const silhouette = (p: Page, slot: number) => p.locator(`.ac-sil[data-slot="${slot}"]`);
/** A tap on an offer's silhouette on the board (the layer takes the tap and finds the offer by its square and its side of it). */
async function tapSilhouette(p: Page, slot: number) {
  const c = middle((await silhouette(p, slot).boundingBox())!);
  await tapAt(p, c.x, c.y);
}
const reroll = (p: Page) => p.getByRole("button", { name: /^Reroll the shop/ });
const piece = (p: Page, color: "white" | "black", role: string, square: string) => p.locator(`${BOARD_SEL.piece}.${color}.${role}[data-square="${square}"]`);
const lockButton = (p: Page) => p.getByRole("button", { name: /^Lock(ed)? in/ });
const xpButton = (p: Page) => p.getByRole("button", { name: /^Buy \d+ XP/ });
/** A side's level line ("Lv 4 · 2/4 XP"). */
const youLevel = (p: Page) => p.locator(".ac-me .ac-lv");
const botLevel = (p: Page) => p.locator(".ac-opp .ac-lv");
const bench = (p: Page) => p.locator(".ac-bench");
const held = (p: Page) => p.locator(".ac-slot.has");
/** The bench row's middle (where an offer is dropped to hold it), and the shop row's (where a piece is dropped to sell it). */
const benchMiddle = async (p: Page) => middle((await bench(p).boundingBox())!);
const shopMiddle = async (p: Page) => middle((await p.locator(".ac-shop").boundingBox())!);

/** Taps the first offer that isn't greyed, up to `max` times (the board holds as many pieces as your level, 4 to begin with); how many taps. */
async function buyAll(p: Page, max: number) {
  let n = 0;
  for (; n < max; n++) {
    const slot = p.locator(".ac-buy:not(.off)").first();
    if (!(await slot.count())) break;
    await tap(p, slot);
  }
  return n;
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

test("the shop: five offers, each a piece and a square of your half, drawn as glowing silhouettes on the board (two on one square smaller, side by side)", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(DUP);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const king = (await root(page).getAttribute("data-king"))!;
  expect(king).toBe("d2");
  const shown = await offers(page);
  expect(shown).toEqual([
    { kind: "r", square: "b4" },
    { kind: "p", square: "d4" },
    { kind: "p", square: "g3" },
    { kind: "p", square: "d4" },
    { kind: "p", square: "b4" },
  ]);
  // Each card: the piece, its price, and its square under it ("Rook b4"). All on your half, none on your king; pawns on your 2nd to 4th rank.
  await expect(page.locator(".ac-buy b")).toHaveText(shown.map((o) => String(PRICES[o.kind])));
  await expect(page.locator(".ac-buy small")).toHaveText(shown.map((o) => `${NAMES[o.kind]} ${o.square}`));
  for (const o of shown) {
    expect(Number(o.square[1])).toBeLessThanOrEqual(4);
    expect(o.square).not.toBe(king);
    if (o.kind === "p") expect(Number(o.square[1])).toBeGreaterThanOrEqual(2);
  }
  // On the board: five silhouettes, each on its own square. A square's single offer fills it; two on one square are half a square wide, side by side.
  await expect(page.locator(".ac-sil")).toHaveCount(5);
  const boardBox = (await page.locator(".ac-layer").boundingBox())!;
  const sq = boardBox.width / 8;
  const boxes = await Promise.all(shown.map(async (_, slot) => (await silhouette(page, slot).boundingBox())!));
  for (const [slot, o] of shown.entries()) {
    const c = await center(page, o.square);
    const b = boxes[slot]!;
    expect(Math.abs(b.y + b.height / 2 - c.y), `${o.square}: vertically on its square`).toBeLessThan(1.5);
    expect(Math.abs(b.x + b.width / 2 - c.x), `${o.square}: horizontally within its square`).toBeLessThanOrEqual(sq / 4 + 1.5);
  }
  expect(boxes[2]!.width, "g3 alone: a whole square").toBeGreaterThan(sq - 2);
  for (const [a, b] of [[1, 3], [0, 4]] as const) {
    expect(boxes[a]!.width, `slot ${a}: half a square`).toBeLessThan(sq / 2 + 2);
    expect(boxes[b]!.width, `slot ${b}: half a square`).toBeLessThan(sq / 2 + 2);
    expect(boxes[b]!.x - boxes[a]!.x, `slots ${a} and ${b}: side by side`).toBeGreaterThan(sq / 2 - 2);
    expect(Math.abs(boxes[b]!.y - boxes[a]!.y)).toBeLessThan(1);
  }
  // Soft green: the silhouette's fill is green-led (red and blue lower), on the classic board's squares.
  const [r, g, b] = (await page.locator(".ac-sil-shape").first().evaluate((el) => getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number))) as number[];
  expect(g!).toBeGreaterThan(r!);
  expect(g!).toBeGreaterThan(b!);
  // The board holds only the kings: nothing is placed for free. The bench has its four slots, empty.
  await expect(page.locator(BOARD_SEL.piece)).toHaveCount(2);
  await expect(page.locator(".ac-slot")).toHaveCount(4);
  await expect(held(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the shop: a reroll costs 2 and rolls all five offers (the same for the same seed), and is refused without the gold", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(DUP);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const first = await offers(page);
  expect(await goldOf(page)).toBe(100);
  await expect(reroll(page)).toContainText("Reroll");
  await expect(reroll(page)).toContainText("2");
  await tap(page, reroll(page));
  expect(await goldOf(page)).toBe(98);
  const rolled = await offers(page);
  expect(rolled).toHaveLength(5);
  expect(rolled).not.toEqual(first);
  await expect(page.locator(".ac-sil")).toHaveCount(5);
  await expect(page.locator(".ac-buy b")).toHaveText(rolled.map((o) => String(PRICES[o.kind])));
  // Seeded by the round and the reroll count: a fresh start rerolled once shows the same five.
  await page.goto(DUP);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await offers(page)).toEqual(first);
  await tap(page, reroll(page));
  expect(await offers(page)).toEqual(rolled);
  // Without the gold it is refused, with the reason (the other 49 rerolls in one go: the same button, the same code).
  await page.evaluate(() => {
    const b = document.querySelector<HTMLButtonElement>(".ac-reroll")!;
    for (let i = 0; i < 49; i++) b.click();
  });
  expect(await goldOf(page)).toBe(0);
  await expect(reroll(page)).toHaveAttribute("aria-disabled", "true");
  const before = await offers(page);
  await reroll(page).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Not enough gold: a reroll costs 2 and you have 0.");
  expect(await goldOf(page)).toBe(0);
  expect(await offers(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("buying: tap an offer's silhouette or its shop card, and it lands on its square; a new offer rolls into the slot, and another offer on that square rolls again", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(DUP);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Round 1: no start gold, an income of 100; the kings are placed by the game, mirrored; you are White, at the bottom.
  expect(await goldOf(page)).toBe(100);
  await expect(page.locator(".ac-income b")).toHaveText("+100");
  expect(await hp(page, "you")).toBe(20);
  expect(await hp(page, "bot")).toBe(20);
  const botKing = (await root(page).getAttribute("data-bot-king"))!;
  expect(botKing).toBe("d7");
  await expect(piece(page, "white", "king", "d2")).toBeVisible();
  await expect(piece(page, "black", "king", botKing)).toBeVisible();
  await expect(page.locator(BOARD_SEL.wrap)).toHaveClass(/orientation-white/);
  await expect(page.locator(".ac-msg")).toContainText("Tap an offer to buy it: it lands on its square.");

  // The rook on b4 (slot 0) by its silhouette: it lands on b4, 50 gold, and the pawn offered on b4 too (slot 4) rolls again.
  const before = await offers(page);
  await tapSilhouette(page, 0);
  await expect(piece(page, "white", "rook", "b4")).toBeVisible();
  expect(await goldOf(page)).toBe(50);
  await expect(page.locator(".ac-msg")).toContainText("Another offer was on b4: it rolled again.");
  const after = await offers(page);
  expect(after).toHaveLength(5);
  expect(after.map((o) => o.square)).not.toContain("b4");
  expect([after[1], after[2], after[3]]).toEqual([before[1], before[2], before[3]]);
  // The pawn on g3 (slot 2) by its shop card: it lands on g3, 10 gold.
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "pawn", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(40);
  await expect(piece(page, "white", "rook", "b4")).toBeVisible();
  // Two pawns share d4 (slots 1 and 3, side by side): tap the right one's silhouette (slot 3) and a pawn stands on d4; the left one rolled again.
  const right = await silhouette(page, 3).boundingBox();
  const left = await silhouette(page, 1).boundingBox();
  expect(right!.x).toBeGreaterThan(left!.x);
  await tapSilhouette(page, 3);
  await expect(piece(page, "white", "pawn", "d4")).toBeVisible();
  expect(await goldOf(page)).toBe(30);
  expect((await offers(page)).map((o) => o.square)).not.toContain("d4");
  // Nothing was placed for free, and nothing on the board but what was bought: the kings, a rook and two pawns.
  await expect(page.locator(BOARD_SEL.piece)).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("buying: a greyed offer says why (gold, the one-queen limit), whole when it is tapped; selling by tap and by drag; the lock", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(POOR);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await offers(page)).toEqual([
    { kind: "q", square: "g3" },
    { kind: "r", square: "e3" },
    { kind: "p", square: "e3" },
    { kind: "q", square: "f3" },
    { kind: "p", square: "b3" },
  ]);
  // The queen on g3: 90 gold. Then 10 are left: the rook can't be had (greyed, "No gold", whole when tapped), and the second queen is over the limit.
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "queen", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(10);
  await expect(card(page, 1)).toHaveAttribute("aria-disabled", "true");
  await expect(card(page, 1)).toContainText("No gold");
  await card(page, 1).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Not enough gold: a rook costs 50 and you have 10.");
  await expect(card(page, 3)).toContainText("Max 1");
  await card(page, 3).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("One queen at most.");
  await expect(piece(page, "white", "rook", "e3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(10);
  // Buy XP (4 XP for 20 gold) is greyed too, with its reason.
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Not enough gold: 4 XP cost 20 and you have 10.");
  expect(await goldOf(page)).toBe(10);
  // The king is the game's: tapping it says so.
  await tapSquare(page, "h1");
  await expect(page.locator(".ac-msg")).toContainText("Your king is placed by the game.");
  // Sell by tapping your queen: it says what it gives, "Sell 67" (75% of 90, rounded down), and the sell sound plays.
  await tapSquare(page, "g3");
  await expect(page.locator(".ac-msg")).toContainText("Queen selected. Tap Sell to sell it for 67.");
  await tap(page, page.getByRole("button", { name: "Sell 67", exact: true }));
  await expect(piece(page, "white", "queen", "g3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(77);
  expect(await soundCount(page, "sell")).toBe(1);
  // Buy a pawn (10) and sell it by dragging it onto the shop row: 75% of 10 is 7.
  const now = await offers(page);
  const pawnSlot = now.findIndex((o) => o.kind === "p");
  const pawnSquare = now[pawnSlot]!.square;
  await tap(page, card(page, pawnSlot));
  await expect(piece(page, "white", "pawn", pawnSquare)).toBeVisible();
  expect(await goldOf(page)).toBe(67);
  await dragMouse(page, await center(page, pawnSquare), await shopMiddle(page));
  await expect(piece(page, "white", "pawn", pawnSquare)).toHaveCount(0);
  expect(await goldOf(page)).toBe(74);
  expect(await soundCount(page, "sell")).toBe(2);
  // The last 2 seconds are locked: "Locked" on the timer, and nothing is bought, sold or moved; the silhouettes dim.
  await expect(page.locator(".ac-clock span")).toHaveText("Locked", { timeout: 15_000 });
  const gold = await goldOf(page);
  await card(page, 0).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Locked: no buying, selling or moving.");
  expect(await goldOf(page)).toBe(gold);
  await expect(page.locator(".ac-buy small").first()).toHaveText("Locked");
  await expect(page.locator(".ac-sil.off")).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("the bench: drag an offer onto it to hold it (it keeps its square), tap it to place it when its square is free, sell it by dragging it onto the shop", async ({ page }) => {
  const errors = watchErrors(page);
  // (The full 30 s step: a drag takes a while, and the quick step's 5 open seconds are a tap-test's.)
  await page.goto("/autochess?seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const before = await offers(page);
  // The rook for b4 (slot 0) is dragged from its shop card onto the bench: 50 gold, it waits there with its square, nothing lands on the board.
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "r");
  await expect(held(page).first()).toHaveAttribute("data-square", "b4");
  await expect(held(page).first().locator("small")).toHaveText("b4");
  expect(await goldOf(page)).toBe(50);
  await expect(page.locator(".ac-msg")).toContainText("Held the rook for b4. Tap it on the bench to place it.");
  await expect(page.locator(BOARD_SEL.piece)).toHaveCount(2);
  // A new offer rolled into slot 0; the others stay, the pawn offered for b4 too (nothing stands on b4).
  const after = await offers(page);
  expect(after).toHaveLength(5);
  expect(after.slice(1)).toEqual(before.slice(1));
  // An offer's silhouette is dragged the same way: the pawn for d4 (the right one of the pair, slot 3).
  await dragMouse(page, middle((await silhouette(page, 3).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(2);
  expect(await goldOf(page)).toBe(40);
  // Tapping the held pawn places it on d4 (free): the bench slot empties, and the other offer on d4 (slot 1) rolls again.
  await tap(page, held(page).nth(1));
  await expect(piece(page, "white", "pawn", "d4")).toBeVisible();
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(40);
  await expect(page.locator(".ac-msg")).toContainText("Another offer was on d4: it rolled again.");
  expect((await offers(page)).map((o) => o.square)).not.toContain("d4");
  // The pawn offered for b4 (slot 4) is bought onto b4: the held rook's square is taken, so tapping the rook says so and nothing happens.
  await tap(page, card(page, 4));
  await expect(piece(page, "white", "pawn", "b4")).toBeVisible();
  expect(await goldOf(page)).toBe(30);
  await expect(held(page).first()).toHaveClass(/off/);
  await tapGreyed(page, held(page).first());
  await expect(page.locator(".ac-msg")).toContainText("b4 is taken.");
  await expect(held(page)).toHaveCount(1);
  // Sell the held rook by dragging it onto the shop row: 75% of 50, rounded down, is 37.
  await dragMouse(page, middle((await held(page).first().boundingBox())!), await shopMiddle(page));
  await expect(held(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(67);
  await expect(page.locator(".ac-msg")).toContainText("Sold the rook for 37.");
  expect(await soundCount(page, "sell")).toBe(1);
  expect(errors).toEqual([]);
});

test("the bench holds 4: a fifth is refused with the reason; the shop's offers stay holdable when the board has no room", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&gold=300");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await goldOf(page)).toBe(430);
  // Four pawns onto the bench (a pawn offer each time).
  for (let i = 0; i < 4; i++) {
    await dragMouse(page, middle((await page.locator('.ac-buy[data-kind="p"]').first().boundingBox())!), await benchMiddle(page));
    await expect(held(page)).toHaveCount(i + 1);
  }
  // (`gold=300` adds 300 to round 1: the income 100 and the interest on 300, 30, make 430; four pawns are 40.)
  expect(await goldOf(page)).toBe(430 - 40);
  // The fifth: refused, with the reason; gold and the bench unchanged.
  const gold = await goldOf(page);
  await dragMouse(page, middle((await page.locator('.ac-buy[data-kind="p"]').first().boundingBox())!), await benchMiddle(page));
  await expect(page.locator(".ac-msg")).toContainText("Your bench is full: 4 pieces at most. Place or sell one first.");
  await expect(held(page)).toHaveCount(4);
  expect(await goldOf(page)).toBe(gold);
  // Two pawns held for squares of one file and a third: each is placed on its own square when tapped, never anywhere else.
  const squares = await held(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-square")!));
  await tap(page, held(page).first());
  await expect(piece(page, "white", "pawn", squares[0]!)).toBeVisible();
  await expect(held(page)).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("levels: you start at level 4 (4 pieces on the board), the 5th is refused with the reason, Buy XP (4 XP for 20 gold) makes room, and the number pops", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&gold=800");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // 800 more, the income 100 and the interest, 30 at the most: 930. Round 1's free 2 XP: level 4, 2 of 4.
  expect(await goldOf(page)).toBe(930);
  await expect(youLevel(page)).toHaveText("Lv 4 · 2/4 XP");
  await expect(botLevel(page)).toContainText("Lv 4");
  await expect(xpButton(page)).toContainText("Buy XP");
  await expect(xpButton(page)).toContainText("20");
  // Four pieces on the board: the level's number.
  await buyAll(page, 4);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  // The fifth is refused: the offers say "Level full" (not greyed: they can still be held), and a tap says why.
  const gold = await goldOf(page);
  const slot = page.locator(".ac-buy.hold-only").first();
  await expect(slot).toContainText("Level full");
  await expect(page.locator(".ac-sil.off")).toHaveCount(5);
  await tapGreyed(page, slot);
  await expect(page.locator(".ac-msg")).toContainText("Your level allows 4 pieces on the board. Buy XP to level up. Drag the offer to the bench to hold it.");
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  expect(await goldOf(page)).toBe(gold);
  // Held on the bench instead, and placed once there is room.
  await dragMouse(page, middle((await slot.boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  await tapGreyed(page, held(page).first());
  await expect(page.locator(".ac-msg")).toContainText("Your level allows 4 pieces on the board. Buy XP to level up.");
  await expect(held(page)).toHaveCount(1);
  // Buy XP: 20 gold, 4 XP: 2 + 4 reaches the 4 for level 5, with 2 over: "Lv 5 · 2/8 XP"; the number pops, and the board may hold 5.
  const before = await goldOf(page);
  await tap(page, xpButton(page));
  await expect(youLevel(page)).toHaveText("Lv 5 · 2/8 XP");
  await expect(youLevel(page).locator("b.pop")).toBeVisible();
  expect(await goldOf(page)).toBe(before - 20);
  await expect(page.locator(".ac-msg")).toContainText("Level 5: your board may hold 5 pieces.");
  await tap(page, held(page).first());
  await expect(held(page)).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(6);
  // Another 4 XP is no level yet: it says so in the numbers (6 of 8), no pop of its own.
  await tap(page, xpButton(page));
  await expect(youLevel(page)).toHaveText("Lv 5 · 6/8 XP");
  await expect(page.locator(".ac-msg")).toContainText("Bought 4 XP.");
  // All the way up: 82 XP in all from level 4's 2 is 21 buys (the first two are done): level 10, "max", and no more to buy.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll<HTMLButtonElement>(".ac-xp")][0]!;
    for (let i = 0; i < 19; i++) b.click();
  });
  await expect(youLevel(page)).toHaveText("Lv 10 · max");
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("You are at the top level, 10.");
  expect(await goldOf(page)).toBe(before - 21 * 20);
  expect(errors).toEqual([]);
});

test("lock in: the first side to lock gets 25 gold at once, and your board, bench and shop freeze", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(NEVER);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The button says what it is worth while the bonus is open.
  await expect(lockButton(page)).toContainText("Lock in");
  await expect(lockButton(page)).toContainText("+25 gold");
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "pawn", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(90);
  // Lock in: +25 at once (the bot never locks with this seed, so you are first), the button and the timer say so.
  await tap(page, lockButton(page));
  expect(await goldOf(page)).toBe(115);
  await expect(root(page)).toHaveAttribute("data-bonus", "you");
  await expect(root(page)).toHaveAttribute("data-you-locked", "1");
  await expect(lockButton(page)).toHaveText("Locked in");
  await expect(lockButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".ac-clock span")).toHaveText("Locked in");
  await expect(page.locator(".ac-msg")).toContainText("You locked in first: +25 gold.");
  // Frozen: no buying, rerolling or selling; each says why, and nothing changes.
  const frozen = "You're locked in: your board, bench and shop are frozen.";
  await card(page, 0).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText(frozen);
  const kinds = await offers(page);
  await reroll(page).click({ force: true });
  expect(await offers(page)).toEqual(kinds);
  await xpButton(page).click({ force: true });
  await expect(youLevel(page)).toHaveText("Lv 4 · 2/4 XP");
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(0);
  await tapSquare(page, "g3");
  await expect(page.locator(".ac-msg")).toContainText(frozen);
  await expect(page.getByRole("button", { name: /^Sell/ })).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(2);
  await lockButton(page).click({ force: true });
  expect(await goldOf(page)).toBe(115);
  // The bot never locks here, so the step runs its time out; the gold is kept.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  expect(await goldOf(page)).toBe(115);
  expect(errors).toEqual([]);
});

test("lock in: when the opponent locks first you see it, get no bonus, and both locked ends the step at once", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(EARLY);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  await expect(lockButton(page)).toContainText("+25 gold");
  // At 1.33 s the opponent locks in: "Locked in" by their name, the bonus gone from the button.
  await expect(page.locator(".ac-bot-locked")).toHaveText("Locked in", { timeout: 6000 });
  await expect(page.getByLabel("Opponent locked in")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-bonus", "bot");
  await expect(lockButton(page)).not.toContainText("+25");
  // Their row still fits at the narrowest screen, with the tag in it.
  expect(await page.locator(".ac-opp").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await goldOf(page)).toBe(100);
  // You lock in second: no bonus, and the step ends at once (it would run to 7 s).
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 1500 });
  expect(Date.now() - t0).toBeLessThan(6500);
  expect(await goldOf(page)).toBe(100);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("lock in: you lock before the opponent, and when it locks too the step ends at once", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LATE);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-bonus", "you");
  expect(await goldOf(page)).toBe(125);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  // The opponent locks at 3.79 s: both locked, so the adjust step begins then, not at the 7 s end.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(6000);
  expect(await goldOf(page)).toBe(125);
  expect(errors).toEqual([]);
});

test("the opponent's pawns show as real pawns while you buy (2 s behind), their other pieces as circles until the reveal", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?quick=1&seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Both kinds show up: a real black pawn, and a circle for something else.
  await expect.poll(() => page.locator(`${BOARD_SEL.piece}.black.pawn`).count(), { timeout: 6000 }).toBeGreaterThan(0);
  await expect.poll(() => page.locator(".ac-circle").count(), { timeout: 6000 }).toBeGreaterThan(0);
  // No circle sits on a pawn, and no black piece but a pawn and the king is drawn for real.
  const clash = await page.locator(".ac-circle").evaluateAll((els) => els.filter((e) => document.querySelector(`piece.black.pawn[data-square="${e.getAttribute("data-square")}"]`)).length);
  expect(clash).toBe(0);
  await expect(page.locator(`${BOARD_SEL.piece}.black:not(.pawn):not(.king)`)).toHaveCount(0);
  const pawns = await page.locator(`${BOARD_SEL.piece}.black.pawn`).count();
  const circles = await page.locator(".ac-circle").count();
  // The reveal shows everything for real: the circles go, and each shows its piece (the pawns stayed where they were).
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  expect(await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count()).toBeGreaterThanOrEqual(pawns + circles);
  expect(errors).toEqual([]);
});

test("a drag with a finger: a placed piece onto the shop row sells it", async ({ page }) => {
  test.skip(!phone(), "real touch events, as a phone makes them");
  const errors = watchErrors(page);
  await page.goto(POOR);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await card(page, 4).tap();
  await expect(piece(page, "white", "pawn", "b3")).toBeVisible();
  await dragTouch(page, await center(page, "b3"), await shopMiddle(page));
  await expect(piece(page, "white", "pawn", "b3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(97);
  expect(errors).toEqual([]);
});

test("the reveal: their real pieces show, stay shown through the adjust step; one chess move in all: an illegal one refused, a second refused, the move taken back, the king may take it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LATE);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Two pawns on their start rank: f2 and g2 (the second f2 offer rolled again).
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await expect(piece(page, "white", "pawn", "f2")).toBeVisible();
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  // Circles first (where, not what), over the 30 (here 7) seconds.
  await expect.poll(() => page.locator(".ac-circle").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  const circles = await page.locator(".ac-circle").count();
  const pawnsSeen = await page.locator(`${BOARD_SEL.piece}.black.pawn`).count();
  await expect(page.locator(`${BOARD_SEL.piece}.black:not(.pawn):not(.king)`)).toHaveCount(0);
  // The reveal: their real pieces, kept shown as they were when it locked (the circles' squares hold real pieces).
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-theirs-line")).toHaveText("Your opponent is moving their pieces…");
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  const theirs = await page.locator(`${BOARD_SEL.piece}.black`).count();
  expect(theirs).toBeGreaterThanOrEqual(circles + pawnsSeen + 1);
  // (The line is plain: no blur over their half.)
  expect(await page.locator(".ac-theirs-line").evaluate((el) => getComputedStyle(el).filter + getComputedStyle(el).backdropFilter)).toBe("nonenone");
  await expect(page.locator(".ac-clock span")).toHaveText("Move");
  await expect(page.locator(".ac-card-say")).toHaveText("One chess move. Tap a piece, then a square.");

  // An illegal move is refused (a pawn onto a square it can't reach), and nothing is used up.
  await tapSquare(page, "g2");
  await tapSquare(page, "e4");
  await expect(page.locator(".ac-card-say")).toContainText("That piece can't move there");
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  // Your one move: the pawn on its start rank pushes two (a dot on each square, then the move), and is marked.
  await tapSquare(page, "f2");
  await expect(page.locator(".ac-dot")).toHaveCount(2);
  await tapSquare(page, "f4");
  await expect(piece(page, "white", "pawn", "f4")).toBeVisible();
  await expect(page.locator('.ac-moved[data-square="f4"]')).toBeVisible();
  // The opponent's pieces haven't changed meanwhile, and are still shown.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  // One move in all: no other piece may move now, nor the same one again.
  const used = "You've made your move. Tap the piece you moved (↩) to take it back.";
  await tapSquare(page, "g2");
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await tapSquare(page, "g3");
  await expect(page.locator(".ac-card-say")).toContainText(used);
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  await dragMouse(page, await center(page, "f4"), await center(page, "f5"));
  await expect(page.locator(".ac-card-say")).toContainText(used);
  await expect(piece(page, "white", "pawn", "f4")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  // A tap on the moved piece takes its move back.
  await tapSquare(page, "f4");
  await expect(piece(page, "white", "pawn", "f2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  // The king may take the one move too, and takes it back.
  await tapSquare(page, "c1");
  expect(await page.locator(".ac-dot").count()).toBeGreaterThan(1);
  await tapSquare(page, "c2");
  await expect(piece(page, "white", "king", "c2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  await tapSquare(page, "c2");
  await expect(piece(page, "white", "king", "c1")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  // Their pieces were shown all through.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  expect(errors).toEqual([]);
});

test("a fight plays to a result, HP changes by the rule, and the next round starts empty but for the new kings, with the colors turned", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  await page.goto(FIGHT);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Hold the rook offered for e4 (slot 3): 50 now, and it stays on the bench through the fight and into the next round.
  await dragMouse(page, middle((await card(page, 3).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(50);
  // Buy what the shop shows with the rest (pawns), up to four times (level 4: four pieces on the board).
  await expect(youLevel(page)).toHaveText("Lv 4 · 2/4 XP");
  const bought = await buyAll(page, 4);
  expect(bought).toBeGreaterThanOrEqual(2);
  const left = await goldOf(page);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 15_000 });
  // The fight: moves appear (the board changes, a last-move highlight), "Move N of 60".
  await expect(page.locator(".ac-card-say")).toContainText(/Move \d+ of 60/);
  await expect(page.locator(`${BOARD_SEL.square}.last-move`).first()).toBeAttached({ timeout: 10_000 });
  await expect(page.locator(".ac-clock span")).toHaveText("Fight");
  await expect(page.locator(".ac-card-text")).toContainText("A side left with only its king loses. After 30 moves each, moves play twice as fast.");
  // The board's usual knocks play for the engine's moves (a capture sounds as it does everywhere).
  expect(await page.evaluate(() => (window as any).__soundLog.filter((l: string) => /^(move|capture):/.test(l)).length)).toBeGreaterThan(0);
  // To a result.
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 150_000 });
  const head = (await page.locator(".ac-card-head").innerText()).trim();
  expect(head).toMatch(/^(You win the round\.|You lose the round\.|The round is a draw\.)$/);
  const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
  const lost = words.match(/(?:You|Your opponent) loses? (\d+) HP\./);
  const gold = (await page.locator(".ac-card-gold").innerText()).trim();
  expect(gold).toMatch(/^Next round: \d+ saved \+ \d+ income( \+ \d+ interest)?( \+ \d+ streak)?( \+ \d+ survivors)? = \d+ gold$/);
  expect(gold).toMatch(new RegExp(`^Next round: ${left} saved \\+ 120 income`));
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
  await expect(root(page)).toHaveAttribute("data-phase", "result");

  // The next round: the kings alone (new squares, mirrored), you are Black and your half is at the bottom; the gold is what the line said.
  const total = Number(gold.match(/= (\d+) gold$/)![1]);
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(root(page)).toHaveAttribute("data-round", "2");
  await expect(page.locator(".ac-title span")).toHaveText("Round 2 · you play Black");
  await expect(page.locator(BOARD_SEL.wrap)).toHaveClass(/orientation-black/);
  await expect(page.locator(BOARD_SEL.piece)).toHaveCount(2);
  // Round 2's free 2 XP made level 5 (2 + 2 of 4): the number pops at the round's start. The opponent got its 2 XP too.
  await expect(youLevel(page)).toHaveText("Lv 5 · 0/8 XP");
  await expect(youLevel(page).locator("b.pop")).toBeVisible();
  await expect(botLevel(page)).toContainText(/Lv [5-9] · /);
  // What was held stays: the rook is on the bench still, for the square turned with the colors (e4 for White, e5 for Black), and tapping it places it there.
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "r");
  await expect(held(page).first()).toHaveAttribute("data-square", "e5");
  await expect(held(page).first().locator("small")).toHaveText("e5");
  // The shop refilled free: five offers, on Black's half (ranks 5 to 8), and the gold is only the round's pay.
  const shown = await offers(page);
  expect(shown).toHaveLength(5);
  for (const o of shown) expect(Number(o.square[1])).toBeGreaterThanOrEqual(5);
  expect(await goldOf(page)).toBe(total);
  await expect(page.locator(".ac-income b")).toHaveText("+120");
  const k2 = (await root(page).getAttribute("data-king"))!;
  const b2 = (await root(page).getAttribute("data-bot-king"))!;
  expect(Number(k2[1])).toBeGreaterThanOrEqual(7);
  expect(b2[0]).toBe(k2[0]);
  expect(Number(k2[1]) + Number(b2[1])).toBe(9);
  // Black's pieces land on the half at the bottom of the screen, on the offered square; the held rook lands on its own.
  const slot = shown.findIndex((o) => o.kind === "p" && o.square !== "e5");
  await tap(page, card(page, slot));
  await expect(piece(page, "black", "pawn", shown[slot]!.square)).toBeVisible();
  await tap(page, held(page).first());
  await expect(piece(page, "black", "rook", "e5")).toBeVisible();
  await expect(held(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(total - 10);
  expect(errors).toEqual([]);
});

test("a side that starts the fight with only its king loses at once: the round is over with no move played", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  // (At the narrowest screen: the result's box must hold its words and buttons.)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(NEVER);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Buy nothing: your king stands alone against the bot's army.
  await expect(root(page)).toHaveAttribute("data-phase", "result", { timeout: 40_000 });
  await expect(page.locator(".ac-card-head")).toHaveText("You lose the round.");
  const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
  expect(words).toMatch(/^A side left with only its king loses at once\. You lose (\d+) HP\.$/);
  const lost = Number(words.match(/You lose (\d+) HP/)![1]);
  // 2 for the loss and 1 for each of their pieces left (all of them: nothing was played).
  expect(lost).toBeGreaterThanOrEqual(3);
  expect(await hp(page, "you")).toBe(20 - lost);
  expect(await hp(page, "bot")).toBe(20);
  // No move was played: the board is the position the fight started from (every piece of theirs still there).
  await expect(page.locator(`${BOARD_SEL.square}.last-move`)).toHaveCount(0);
  expect(await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count()).toBe(lost - 2);
  // Nothing spent, nothing lost: the gold is saved, with the interest and the income.
  await expect(page.locator(".ac-card-gold")).toHaveText("Next round: 100 saved + 120 income + 10 interest = 230 gold");
  const box = await page.locator(".ac-card").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, buttons: (el.querySelector(".ac-go") as HTMLElement).getBoundingClientRect().bottom - el.getBoundingClientRect().bottom }));
  expect(box.scroll, "the result's box holds its words").toBeLessThanOrEqual(box.client);
  expect(box.buttons, "the button is inside the box").toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("layouts: the board, shop and your row fit the screen with no scrolling, at 320 px and on a computer", async ({ page }) => {
  const errors = watchErrors(page);
  const sizes = phone()
    ? ([[320, 568], [360, 640], [375, 667], [390, 664], [390, 844], [430, 932]] as const)
    : ([[1280, 800], [1280, 600], [1366, 768], [1920, 1080]] as const);
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(POOR);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await tap(page, card(page, 0));
    const m = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const board = r(".hb-board");
      return {
        scroll: document.documentElement.scrollHeight - innerHeight,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        board: { w: board.width, h: board.height, top: board.top, left: board.left, right: board.right },
        me: r(".ac-me").bottom,
        buttons: [...document.querySelectorAll(".ac-buy")].map((b) => b.getBoundingClientRect()).map((b) => ({ r: b.right, l: b.left })),
        labels: [...document.querySelectorAll(".ac-buy small")].map((s) => s.scrollWidth - s.clientWidth),
        slots: [...document.querySelectorAll(".ac-slot")].map((b) => ({ w: b.getBoundingClientRect().width, l: b.getBoundingClientRect().left, r: b.getBoundingClientRect().right, over: b.scrollWidth - b.clientWidth })),
        clock: r(".ac-clock").right,
        rows: [".ac-opp", ".ac-me"].map((sel) => {
          const el = document.querySelector(sel)!;
          return el.scrollWidth - el.clientWidth;
        }),
        ctl: [...document.querySelectorAll(".ac-ctl button")].map((b) => ({ l: b.getBoundingClientRect().left, r: b.getBoundingClientRect().right, over: b.scrollWidth - b.clientWidth, h: b.getBoundingClientRect().height })),
      };
    });
    expect(m.scroll, `${w}×${h}: scrolling`).toBeLessThanOrEqual(0);
    expect(m.sideways, `${w}×${h}: sideways`).toBe(0);
    expect(Math.abs(m.board.w - m.board.h), `${w}×${h}: a square board`).toBeLessThan(1.5);
    expect(m.board.left, `${w}×${h}`).toBeGreaterThanOrEqual(0);
    expect(m.board.right, `${w}×${h}`).toBeLessThanOrEqual(w);
    expect(m.me, `${w}×${h}: your row on screen`).toBeLessThanOrEqual(h);
    expect(m.clock, `${w}×${h}: the clock inside`).toBeLessThanOrEqual(w);
    expect(m.rows.every((x) => x <= 0), `${w}×${h}: both strips (name, level, numbers) fit their width`).toBe(true);
    expect(m.ctl, `${w}×${h}: Reroll, Buy XP and Lock in`).toHaveLength(3);
    expect(m.ctl.every((b) => b.l >= 0 && b.r <= w && b.over <= 0 && b.h >= 30), `${w}×${h}: the three buttons fit, with their words`).toBe(true);
    expect(m.buttons.every((b) => b.l >= 0 && b.r <= w), `${w}×${h}: the shop inside`).toBe(true);
    expect(m.labels.every((x) => x <= 0), `${w}×${h}: each offer's label ("Bishop c2") fits under its price`).toBe(true);
    expect(m.slots).toHaveLength(4);
    expect(m.slots.every((b) => b.w >= 50 && b.l >= 0 && b.r <= w && b.over <= 0), `${w}×${h}: the bench's four slots inside the screen`).toBe(true);
    // A phone's board is as wide as the room allows; the others' room is the height.
    if (w <= 430) expect(m.board.w, `${w}×${h}`).toBeGreaterThan(Math.min(w - 40, h - 334) - 10);
  }
  // The adjust step's box at the narrowest screen, with its longest words: nothing is cut off. (An army of a few pieces, so the fight lasts.)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(FIGHT);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await buyAll(page, 4);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  const clipped = () => page.locator(".ac-card").evaluate((el) => Array.from(el.children).filter((c) => c.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 0.5).length + (el.scrollHeight > el.clientHeight ? 1 : 0));
  expect(await clipped(), "the adjust step's box holds its words").toBe(0);
  // And the fight's, with its rules.
  await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 15_000 });
  expect(await clipped(), "the fight's box holds its words").toBe(0);
  // The step's box is the same size as the shop and buttons it replaces: the board doesn't move when the step changes.
  await page.setViewportSize({ width: phone() ? 390 : 1280, height: phone() ? 664 : 800 });
  await page.goto(POOR);
  const before = (await page.locator(".hb-board").boundingBox())!;
  const bottom = (await page.locator(".ac-me").boundingBox())!;
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  const during = (await page.locator(".hb-board").boundingBox())!;
  const bottom2 = (await page.locator(".ac-me").boundingBox())!;
  expect(Math.abs(during.y - before.y) + Math.abs(during.width - before.width)).toBeLessThan(1);
  expect(Math.abs(bottom2.y - bottom.y)).toBeLessThan(1);
  expect(errors).toEqual([]);
});
