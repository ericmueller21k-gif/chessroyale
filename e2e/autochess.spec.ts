import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, asAdmin, named, test } from "./helpers.ts";

/**
 * Auto chess, the demo (/autochess; docs/areas/autochess.md; shelved: Settings' Testing section, for admins, opens it): a
 * round is played from buying to the fight's end, on a phone and a computer. `?quick=1` (a test switch) shortens the steps (buy 7 s with the last
 * 2 locked, circles half a second behind, a reveal every 1.5 s, adjust 8 s, a fight move every 60 ms); `?adjust=0` turns the adjust step off; `?seed=` fixes the kings, the shop and the bot.
 */
const phone = () => test.info().project.name === "phone";
// (A tap or click that finds nothing fails in seconds, not at the test's end.)
test.use({ actionTimeout: 15_000 });

// Seeds (each fixes round 1's kings, its five offers and the bot; the bot's lock-in time comes from a draw of its own, so it holds
// whatever else the bot's buying becomes). `quick` = the steps' short times.
// (One offer to a square since Oct 21: the shop never rolls two offers onto one square, so these are the seeds' shops since then.)
//  9: rook b4, pawn d4, pawn g3, pawn h3, pawn a3; king d2; the bot never locks in.
//  5: pawn f2, pawn g2, pawn h3, pawn b2, knight g1; king c1; the bot locks in at 3.79 s (of the 4 s open).
// 11: pawn b2, pawn c4, pawn b3, pawn f4, knight e3; king h1; the bot locks in at 1.33 s.
// 60: queen g3, rook e3, pawn h4, pawn a3, pawn f4; king h1.
//  3: pawn g3, pawn b4, pawn h3, rook e4, pawn c4; king e2.
// 3328: queen c2, bishop b3, pawn c4, queen c1, pawn d4; king d1 (two queens, to show the limit and the reasons).
// 10412: rook f4, pawn f2, bishop g4, pawn c3, pawn d3; king b2. Holding the rook, the slot rolls a pawn onto f4 (the held piece's square);
//        holding the pawn for d3, the slot rolls a pawn onto d3 too: the two ways an offer can meet a held piece's square.
const PLAIN = "/autochess?quick=1&seed=9";
const LATE = "/autochess?quick=1&seed=5";
const EARLY = "/autochess?quick=1&seed=11";
const POOR = "/autochess?quick=1&seed=60";
const TWOQ = "/autochess?quick=1&seed=3328";
const FIGHT = "/autochess?quick=1&seed=3";
const NEVER = PLAIN;
/** Every way a fight's result line can begin (the reason it ended), then the HP line. */
const RESULT_WHY =
  /^(Checkmate\.|Stalemate\.|(You|Your opponent) gained 3\+ pawns and held it for 6 moves\.|Fight stalled \((moves repeated|10 moves each, no capture|60 moves each)\): ((you|your opponent) gained (\d+ pawns?|the edge|a winning edge)|neither side gained the edge, a draw)\.|Draw by the fifty-move rule\.|Draw: not enough pieces left to mate\.|A side left with only its king loses at once\.|Both sides are down to a king: a draw\.) /;
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

/**
 * Watches the fight from before it can begin (a short one, decided early in a few quick moves, can come and go between two
 * looks of a poll): what the box said, the step's name and whether a move was highlighted; read with `fightSeen`.
 */
async function watchFight(p: Page) {
  await p.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const seen = { fight: false, say: "", text: "", label: "", lastMove: false };
    (window as any).__fight = seen;
    new MutationObserver(() => {
      if (root.dataset.phase !== "fight") return;
      seen.fight = true;
      seen.say ||= document.querySelector(".ac-card-say")?.textContent ?? "";
      seen.text ||= document.querySelector(".ac-card-text")?.textContent ?? "";
      seen.label ||= document.querySelector(".ac-clock span")?.textContent ?? "";
      if (document.querySelector(".hb-board square.last-move")) seen.lastMove = true;
    }).observe(root, { attributes: true, subtree: true, childList: true, characterData: true });
  });
}
const fightSeen = (p: Page) => p.evaluate(() => (window as any).__fight as { fight: boolean; say: string; text: string; label: string; lastMove: boolean });

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

test("the shop: five offers, each a piece and a square of your own, drawn as glowing silhouettes on the board, one to a square, each filling it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const king = (await root(page).getAttribute("data-king"))!;
  expect(king).toBe("d2");
  const shown = await offers(page);
  expect(shown).toEqual([
    { kind: "r", square: "b4" },
    { kind: "p", square: "d4" },
    { kind: "p", square: "g3" },
    { kind: "p", square: "h3" },
    { kind: "p", square: "a3" },
  ]);
  // Each card: the piece, its price, and its square under it ("Rook b4"). All on your half, none on your king; pawns on your 2nd to 4th rank.
  await expect(page.locator(".ac-buy b")).toHaveText(shown.map((o) => String(PRICES[o.kind])));
  await expect(page.locator(".ac-buy small")).toHaveText(shown.map((o) => `${NAMES[o.kind]} ${o.square}`));
  for (const o of shown) {
    expect(Number(o.square[1])).toBeLessThanOrEqual(4);
    expect(o.square).not.toBe(king);
    if (o.kind === "p") expect(Number(o.square[1])).toBeGreaterThanOrEqual(2);
  }
  // On the board: five silhouettes, each on its own square (never two on one: Eric, Oct 21), and each fills its square.
  expect(new Set(shown.map((o) => o.square)).size).toBe(5);
  await expect(page.locator(".ac-sil")).toHaveCount(5);
  const boardBox = (await page.locator(".ac-layer").boundingBox())!;
  const sq = boardBox.width / 8;
  const boxes = await Promise.all(shown.map(async (_, slot) => (await silhouette(page, slot).boundingBox())!));
  for (const [slot, o] of shown.entries()) {
    const c = await center(page, o.square);
    const b = boxes[slot]!;
    expect(Math.abs(b.y + b.height / 2 - c.y), `${o.square}: vertically on its square`).toBeLessThan(1.5);
    expect(Math.abs(b.x + b.width / 2 - c.x), `${o.square}: horizontally on its square`).toBeLessThan(1.5);
    expect(b.width, `${o.square}: a whole square wide`).toBeGreaterThan(sq - 2);
    expect(b.width, `${o.square}: and no wider`).toBeLessThan(sq + 1);
  }
  // Soft green: the silhouette's fill is green-led (red and blue lower), on the classic board's squares.
  const [r, g, b] = (await page.locator(".ac-sil-shape").first().evaluate((el) => getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number))) as number[];
  expect(g!).toBeGreaterThan(r!);
  expect(g!).toBeGreaterThan(b!);
  // The board holds only your king: nothing is placed for free. The bench has its four slots, empty.
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(1);
  await expect(page.locator(".ac-slot")).toHaveCount(4);
  await expect(held(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the shop: a reroll costs 2 and rolls all five offers (the same for the same seed), and is refused without the gold", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const first = await offers(page);
  expect(await goldOf(page)).toBe(100);
  await expect(reroll(page)).toContainText("Reroll");
  await expect(reroll(page)).toContainText("2");
  await tap(page, reroll(page));
  expect(await goldOf(page)).toBe(98);
  // (A shuffle and a coin's clink.)
  expect(await soundCount(page, "acReroll")).toBe(1);
  const rolled = await offers(page);
  expect(rolled).toHaveLength(5);
  expect(rolled).not.toEqual(first);
  await expect(page.locator(".ac-sil")).toHaveCount(5);
  await expect(page.locator(".ac-buy b")).toHaveText(rolled.map((o) => String(PRICES[o.kind])));
  // Seeded by the round and the reroll count: a fresh start rerolled once shows the same five.
  await page.goto(PLAIN);
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

test("one offer to a square (Eric, Oct 21): over several seeds, rerolls and buys, no two offers share a square, none is on your king or a piece of yours, and each square shows one silhouette", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const check = async (where: string) => {
    const shown = await offers(page);
    expect(shown, `${where}: five offers`).toHaveLength(5);
    const squares = shown.map((o) => o.square);
    expect(new Set(squares).size, `${where}: ${squares}`).toBe(5);
    const mine = await page.locator(`${BOARD_SEL.piece}.white`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.square!));
    for (const sqr of squares) expect(mine, `${where}: ${sqr} is free`).not.toContain(sqr);
    await expect(page.locator(".ac-sil")).toHaveCount(5);
    const centers = await page.locator(".ac-sil").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return `${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`;
      }),
    );
    expect(new Set(centers).size, `${where}: five silhouettes, each on its own square`).toBe(5);
  };
  // (Seeds 9, 5 and 60 had two offers on one square before; the rest are a spread. `gold=900` pays for the rerolls and the buys.)
  for (const seed of [9, 5, 60, 3, 11, 3328, 21, 33]) {
    await page.goto(`/autochess?seed=${seed}&gold=900`);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await check(`seed ${seed}`);
    for (let i = 0; i < 4; i++) {
      await tap(page, reroll(page));
      await check(`seed ${seed}, reroll ${i + 1}`);
    }
    for (let i = 0; i < 3; i++) {
      await tap(page, page.locator(".ac-buy:not(.off)").first());
      await check(`seed ${seed}, buy ${i + 1}`);
    }
  }
  expect(errors).toEqual([]);
});

test("buying: tap an offer's silhouette or its shop card, and it lands on its square; a new offer rolls into the slot, on a square no piece or other offer is on", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
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

  // The rook on b4 (slot 0) by its silhouette: it lands on b4, 50 gold. No other offer was on b4, so none rolls again and nothing says so.
  const before = await offers(page);
  await tapSilhouette(page, 0);
  await expect(piece(page, "white", "rook", "b4")).toBeVisible();
  expect(await goldOf(page)).toBe(50);
  await expect(page.locator(".ac-msg")).not.toContainText("Another offer was on");
  // (A solid thunk as it lands: one place sound for each piece bought onto its square.)
  expect(await soundCount(page, "acPlace")).toBe(1);
  const after = await offers(page);
  expect(after).toHaveLength(5);
  // The new offer in slot 0 is on a free square: not b4 (the rook), and none of the other four offers' squares.
  expect(after[0]!.square).not.toBe("b4");
  expect(new Set(after.map((o) => o.square)).size).toBe(5);
  expect(after.slice(1)).toEqual(before.slice(1));
  // The pawn on g3 (slot 2) by its shop card: it lands on g3, 10 gold.
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "pawn", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(40);
  expect(await soundCount(page, "acPlace")).toBe(2);
  await expect(piece(page, "white", "rook", "b4")).toBeVisible();
  // The pawn on d4 (slot 1) by its silhouette: a pawn stands on d4, 30 gold left.
  await tapSilhouette(page, 1);
  await expect(piece(page, "white", "pawn", "d4")).toBeVisible();
  expect(await goldOf(page)).toBe(30);
  // After every buy the five offers are on five squares, none of them the king's or a piece's.
  const squares = (await offers(page)).map((o) => o.square);
  expect(new Set(squares).size).toBe(5);
  for (const sqr of ["d2", "b4", "g3", "d4"]) expect(squares).not.toContain(sqr);
  // Nothing was placed for free, and nothing of yours on the board but what was bought: the king, a rook and two pawns.
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("buying: a greyed offer says why (gold, the one-queen limit), whole when it is tapped; selling by tap and by drag; the lock", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(TWOQ);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await offers(page)).toEqual([
    { kind: "q", square: "c2" },
    { kind: "b", square: "b3" },
    { kind: "p", square: "c4" },
    { kind: "q", square: "c1" },
    { kind: "p", square: "d4" },
  ]);
  // The queen on c2: 90 gold. Then 10 are left: the bishop can't be had (greyed, "No gold", whole when tapped), and the second queen is over the limit.
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "queen", "c2")).toBeVisible();
  expect(await goldOf(page)).toBe(10);
  await expect(card(page, 1)).toHaveAttribute("aria-disabled", "true");
  await expect(card(page, 1)).toContainText("No gold");
  await card(page, 1).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Not enough gold: a bishop costs 32 and you have 10.");
  await expect(card(page, 3)).toContainText("Max 1");
  await card(page, 3).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("One queen at most.");
  await expect(piece(page, "white", "bishop", "b3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(10);
  // Buy XP (4 XP for 20 gold) is greyed too, with its reason.
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(page.locator(".ac-msg")).toContainText("Not enough gold: 4 XP cost 20 and you have 10.");
  expect(await goldOf(page)).toBe(10);
  // The king is the game's: tapping it says so.
  await tapSquare(page, "d1");
  await expect(page.locator(".ac-msg")).toContainText("Your king is placed by the game.");
  // Sell by tapping your queen: it says what it gives, "Sell 67" (75% of 90, rounded down), and the sell sound plays.
  await tapSquare(page, "c2");
  await expect(page.locator(".ac-msg")).toContainText("Queen selected. Tap Sell to sell it for 67.");
  await tap(page, page.getByRole("button", { name: "Sell 67", exact: true }));
  await expect(piece(page, "white", "queen", "c2")).toHaveCount(0);
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
  // (The full 30 s step: a drag takes a while, and the quick step's 5 open seconds are a tap-test's. Seed 10412: see the list at the top.)
  await page.goto("/autochess?seed=10412");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const before = await offers(page);
  expect(before.map((o) => `${o.kind}${o.square}`)).toEqual(["rf4", "pf2", "bg4", "pc3", "pd3"]);
  // The rook for f4 (slot 0) is dragged from its shop card onto the bench: 50 gold, it waits there with its square, nothing lands on the board.
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "r");
  await expect(held(page).first()).toHaveAttribute("data-square", "f4");
  await expect(held(page).first().locator("small")).toHaveText("f4");
  expect(await goldOf(page)).toBe(50);
  await expect(page.locator(".ac-msg")).toContainText("Held the rook for f4. Tap it on the bench to place it.");
  // (A soft pop for a hold, not the thunk of a piece landing.)
  expect(await soundCount(page, "acHold")).toBe(1);
  expect(await soundCount(page, "acPlace")).toBe(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(1);
  // A new offer rolled into slot 0 (a pawn, and on f4 itself: the rook only waits there, so f4 is empty); the others stay.
  const after = await offers(page);
  expect(after).toHaveLength(5);
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(after[0]).toEqual({ kind: "p", square: "f4" });
  // The pawn for d3 (slot 4) is dragged from its card the same way (a silhouette on the board is only tapped, never dragged); its slot rolls a pawn onto d3 too.
  await dragMouse(page, middle((await card(page, 4).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(2);
  expect(await goldOf(page)).toBe(40);
  expect(await soundCount(page, "acHold")).toBe(2);
  expect((await offers(page))[4]).toEqual({ kind: "p", square: "d3" });
  // Tapping the held pawn places it on d3 (free): the bench slot empties, and the offer on d3 (slot 4) rolls again, onto a square that is free.
  await tap(page, held(page).nth(1));
  await expect(piece(page, "white", "pawn", "d3")).toBeVisible();
  expect(await soundCount(page, "acPlace")).toBe(1);
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(40);
  await expect(page.locator(".ac-msg")).toContainText("Another offer was on d3: it rolled again.");
  const rolled = (await offers(page)).map((o) => o.square);
  expect(rolled).not.toContain("d3");
  expect(new Set(rolled).size).toBe(5);
  // The pawn offered for f4 (slot 0) is bought onto f4: the held rook's square is taken, so tapping the rook says so and nothing happens.
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "pawn", "f4")).toBeVisible();
  expect(await goldOf(page)).toBe(30);
  await expect(held(page).first()).toHaveClass(/off/);
  await tapGreyed(page, held(page).first());
  await expect(page.locator(".ac-msg")).toContainText("f4 is taken.");
  await expect(held(page)).toHaveCount(1);
  // Sell the held rook by dragging it onto the shop row: 75% of 50, rounded down, is 37.
  const slotBox = (await held(page).first().boundingBox())!;
  await dragMouse(page, middle(slotBox), await shopMiddle(page));
  await expect(held(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(67);
  // The 37 floats up right over the slot the rook was sold from (it is in the bench row, over the first slot), and is gone a moment later.
  const bench0 = (await bench(page).boundingBox())!;
  const flo = page.locator(".ac-float");
  await expect(flo).toHaveCount(1);
  await expect(flo).toHaveText("+37");
  const fb = (await flo.boundingBox())!;
  expect(fb.x + fb.width / 2).toBeGreaterThan(slotBox.x - 2);
  expect(fb.x + fb.width / 2).toBeLessThan(slotBox.x + slotBox.width + 2);
  expect(fb.y).toBeLessThan(bench0.y + bench0.height);
  expect(fb.y + fb.height).toBeGreaterThan(bench0.y - 45);
  await expect(flo).toHaveCount(0, { timeout: 3000 });
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
  // (A small rising chime for the XP, a bigger one as the level comes.)
  expect(await soundCount(page, "acXp")).toBe(1);
  expect(await soundCount(page, "acLevel")).toBe(1);
  expect(await goldOf(page)).toBe(before - 20);
  await expect(page.locator(".ac-msg")).toContainText("Level 5: your board may hold 5 pieces.");
  await tap(page, held(page).first());
  await expect(held(page)).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(6);
  // Another 4 XP is no level yet: it says so in the numbers (6 of 8), no pop of its own.
  await tap(page, xpButton(page));
  await expect(youLevel(page)).toHaveText("Lv 5 · 6/8 XP");
  await expect(page.locator(".ac-msg")).toContainText("Bought 4 XP.");
  expect(await soundCount(page, "acXp")).toBe(2);
  expect(await soundCount(page, "acLevel")).toBe(1);
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

test("avatars: your pawn sits under your side of the board and theirs above theirs, each with its name, level and XP", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const board = (await page.locator(".hb-board").boundingBox())!;
  const me = (await page.locator(".ac-me").boundingBox())!;
  const opp = (await page.locator(".ac-opp").boundingBox())!;
  // By the board: theirs right above its top edge, yours right under its bottom edge.
  expect(board.y - (opp.y + opp.height), "their strip is right above the board").toBeLessThanOrEqual(10);
  expect(board.y - (opp.y + opp.height)).toBeGreaterThanOrEqual(-1);
  expect(me.y - (board.y + board.height), "your strip is right under the board").toBeLessThanOrEqual(10);
  expect(me.y - (board.y + board.height)).toBeGreaterThanOrEqual(-1);
  // Each has a pawn drawn (your color to match your pieces: White in round 1; theirs Black), its name and its level line.
  for (const [who, color, name] of [["me", "white", "Pawnder"], ["opp", "black", "Bot"]] as const) {
    const strip = page.locator(`.ac-${who}`);
    await expect(strip.locator(".ac-avatar .avatar")).toHaveCount(1);
    await expect(strip.locator(`.ac-avatar .avatar piece.${color}.pawn, .ac-avatar .avatar .avatar-skin`).first()).toBeAttached();
    const box = (await strip.locator(".ac-avatar").boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(28);
    expect(box.height).toBeGreaterThanOrEqual(28);
    expect(box.x).toBeGreaterThanOrEqual(0);
    await expect(strip.locator(".ac-name")).toHaveText(name);
    await expect(strip.locator(".ac-lv")).toHaveText("Lv 4 · 2/4 XP");
    // The XP toward the next level is the gold line under the words: half of it (2 of 4).
    expect(await strip.locator(".ac-lv").evaluate((el) => getComputedStyle(el).getPropertyValue("--xp"))).toBe("0.5");
    // (The pawn's drawing is not blank: its box holds a piece or a skin with size.)
    const drawn = await strip.locator(".ac-avatar .avatar").evaluate((el) => ({ w: el.getBoundingClientRect().width, kids: el.children.length }));
    expect(drawn.w).toBeGreaterThan(20);
    expect(drawn.kids).toBeGreaterThan(0);
  }
  // Their numbers stay in their strip, and the long name of an account fits its strip (ellipsis, no overflow) at the narrowest screen.
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.locator(".ac-me")).toBeVisible();
  expect(await page.locator(".ac-me").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.locator(".ac-opp").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("feel: every button presses down while it is held (Reroll sinks onto its shadow) and comes back up", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const sunk = (loc: Locator) => loc.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform).m42);
  const buttons: [string, Locator, number][] = [
    ["Reroll", reroll(page), 3],
    ["Buy XP", xpButton(page), 3],
    ["Lock in", lockButton(page), 3],
    ["a shop card", card(page, 2), 2],
    ["the back button", page.getByRole("button", { name: "Back to home" }), 2],
  ];
  for (const [name, loc, least] of buttons) {
    const c = middle((await loc.boundingBox())!);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await expect.poll(() => sunk(loc), { message: `${name} sinks while it is held`, timeout: 2000 }).toBeGreaterThanOrEqual(least - 0.6);
    // Let go away from it (so nothing is bought, rerolled or locked), and it comes back up.
    await page.mouse.move(c.x, c.y - 200);
    await page.mouse.up();
    await expect.poll(() => sunk(loc), { message: `${name} comes back up`, timeout: 2000 }).toBeLessThan(0.5);
  }
  expect(await goldOf(page)).toBe(100);
  expect(errors).toEqual([]);
});

test("a sale floats its gold up from the square the piece stood on (+67 for a queen), light CSS that is gone a moment later; nothing floats for a purchase", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(POOR);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "queen", "g3")).toBeVisible();
  // Buying needs no animation.
  await expect(page.locator(".ac-float")).toHaveCount(0);
  const g3 = await center(page, "g3");
  const sq = (await page.locator(".ac-layer").boundingBox())!.width / 8;
  await tapSquare(page, "g3");
  await tap(page, page.getByRole("button", { name: "Sell 67", exact: true }));
  const flo = page.locator(".ac-float");
  await expect(flo).toHaveCount(1);
  await expect(flo).toHaveText("+67");
  // Its box is the square's; the number starts on it and rises (a CSS animation: the number's own box moves, the script does nothing per frame).
  const box = (await flo.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - g3.x)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - g3.y)).toBeLessThan(2);
  expect(Math.abs(box.width - sq)).toBeLessThan(2);
  const num = flo.locator("b");
  const early = (await num.boundingBox())!;
  expect(early.y + early.height / 2).toBeGreaterThan(g3.y - sq / 2 - 6);
  await page.waitForTimeout(450);
  const later = (await num.boundingBox())!;
  expect(later.y, "the number rises").toBeLessThan(early.y - 4);
  expect(Math.abs(later.x + later.width / 2 - g3.x), "straight up").toBeLessThan(3);
  expect(await num.evaluate((el) => getComputedStyle(el).animationName)).toBe("ac-float");
  await expect(flo).toHaveCount(0, { timeout: 3000 });
  expect(errors).toEqual([]);
});

test("mute is respected: with sound off every one of these sounds is asked for muted", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  await page.goto("/autochess?seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await tap(page, card(page, 2));
  await dragMouse(page, middle((await card(page, 3).boundingBox())!), await benchMiddle(page));
  await tap(page, xpButton(page));
  await tapSquare(page, "g3");
  await tap(page, page.getByRole("button", { name: /^Sell \d+$/ }));
  await tap(page, reroll(page));
  await tap(page, lockButton(page));
  const log = await page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => /^(ac|sell)/.test(l)));
  // A sound of each kind was asked for, and none of them is un-muted.
  for (const name of ["acReroll", "acPlace", "acHold", "acXp", "sell", "acLock"]) expect(log.some((l) => l.startsWith(`${name}:`)), name).toBe(true);
  expect(log.every((l) => l.endsWith(":muted"))).toBe(true);
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
  expect(await soundCount(page, "acLock")).toBe(1);
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

test("while you buy their pieces are plain circles (pawns too), 2 s behind; every few seconds one is revealed at random and stays shown", async ({ page }) => {
  const errors = watchErrors(page);
  // (Quick: a reveal every 1.5 s, the circles half a second behind.)
  await page.goto("/autochess?quick=1&seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect.poll(() => page.locator(".ac-circle").count(), { timeout: 6000 }).toBeGreaterThan(0);
  // Watch the board for the step's open part: the real black pieces (not the king) only ever grow, by one at a time, never a pawn drawn as a pawn without being revealed,
  // and a revealed piece's square has no circle on it (it turned into the piece) but its gold ring.
  const seen = await page.evaluate(
    () =>
      new Promise<{ real: number[]; clash: number; unringed: number }>((resolve) => {
        const real: number[] = [];
        let clash = 0;
        let unringed = 0;
        const t0 = performance.now();
        const look = () => {
          // (Only while buying: the next step shows everything for real.)
          if (document.querySelector(".ac-root")?.getAttribute("data-phase") !== "buy") return resolve({ real, clash, unringed });
          const pieces = [...document.querySelectorAll<HTMLElement>(".hb-board piece.black:not(.king)")];
          real.push(pieces.length);
          for (const p of pieces) {
            const sq = p.getAttribute("data-square");
            if (document.querySelector(`.ac-circle[data-square="${sq}"]`)) clash++;
            if (!document.querySelector(`.ac-ping[data-square="${sq}"]`)) unringed++;
          }
          if (performance.now() - t0 < 6200) setTimeout(look, 80);
          else resolve({ real, clash, unringed });
        };
        look();
      }),
  );
  const real = seen.real;
  expect(Math.max(...real), "something was revealed").toBeGreaterThan(0);
  for (let i = 1; i < real.length; i++) {
    expect(real[i]!, "a revealed piece stays shown").toBeGreaterThanOrEqual(real[i - 1]!);
    expect(real[i]! - real[i - 1]!, "one reveal at a time").toBeLessThanOrEqual(1);
  }
  expect(seen.clash).toBe(0);
  expect(seen.unringed).toBe(0);
  // A ping as each circle turns into its piece: one for each reveal.
  expect(await soundCount(page, "acReveal")).toBe(Math.max(...real));
  // The reveal shows everything for real: the circles go, and each shows its piece (the revealed ones stayed where they were).
  const circles = await page.locator(".ac-circle").count();
  const shown = await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count();
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  expect(await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count()).toBeGreaterThanOrEqual(shown + circles);
  expect(errors).toEqual([]);
});

test("the reveals come every 5 seconds of the 30 (the first at 5 s, the next at 10 s)", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  const real = () => page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count();
  expect(await real()).toBe(0);
  // (Polled every 50 ms: the clock is read every 120 ms, so a reveal shows within a tick of its time.)
  const waitFor = async (n: number) => {
    await expect.poll(real, { timeout: 15_000, intervals: [50] }).toBeGreaterThanOrEqual(n);
    return (Date.now() - t0) / 1000;
  };
  const first = await waitFor(1);
  expect(first).toBeGreaterThan(4.7);
  expect(first).toBeLessThan(6.4);
  const second = await waitFor(2);
  expect(second).toBeGreaterThan(9.7);
  expect(second).toBeLessThan(11.4);
  expect(errors).toEqual([]);
});

test("a drag with a finger: a placed piece onto the shop row sells it", async ({ page }) => {
  test.skip(!phone(), "real touch events, as a phone makes them");
  const errors = watchErrors(page);
  await page.goto(POOR);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await card(page, 4).tap();
  await expect(piece(page, "white", "pawn", "f4")).toBeVisible();
  await dragTouch(page, await center(page, "f4"), await shopMiddle(page));
  await expect(piece(page, "white", "pawn", "f4")).toHaveCount(0);
  expect(await goldOf(page)).toBe(97);
  expect(errors).toEqual([]);
});

test("the reveal: their full board shows and stays through the adjust step; one change: a piece to any legal empty square of your half, the refusals say why, a second is refused, it can be taken back, the king stays", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LATE);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Two pawns on their start rank: f2 and g2.
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await expect(piece(page, "white", "pawn", "f2")).toBeVisible();
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  // Circles first (where, not what), over the 30 (here 7) seconds.
  await expect.poll(() => page.locator(".ac-circle").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  const circles = await page.locator(".ac-circle").count();
  const revealed = await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count();
  // The full reveal: their real pieces, kept shown as they were when it locked (the circles' squares hold real pieces).
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-theirs-line")).toHaveText("Your opponent is moving their pieces…");
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  const theirs = await page.locator(`${BOARD_SEL.piece}.black`).count();
  expect(theirs).toBeGreaterThanOrEqual(circles + revealed + 1);
  // (The line is plain: no blur over their half.)
  expect(await page.locator(".ac-theirs-line").evaluate((el) => getComputedStyle(el).filter + getComputedStyle(el).backdropFilter)).toBe("nonenone");
  await expect(page.locator(".ac-clock span")).toHaveText("Move");
  await expect(page.locator(".ac-card-say")).toHaveText("Move one piece to any empty square of your half. Tap a piece, then a square.");

  // Refused, each with its reason, and nothing is used up: their half, a taken square, the king's square, your back rank (for a pawn).
  // (Dragged: a tap on a square with one of your pieces, the king too, picks that one up instead.)
  const refused = async (to: string, words: string) => {
    await dragMouse(page, await center(page, "g2"), await center(page, to));
    await expect(page.locator(".ac-card-say")).toContainText(words);
    await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
    await expect(page.locator(".ac-moved")).toHaveCount(0);
  };
  await refused("e6", "Pieces go on your half of the board.");
  await refused("f2", "That square is taken.");
  await refused("c1", "That's your king's square.");
  await refused("a1", "Pawns can't stand on your back rank.");
  // Your one change: not a chess move. The pawn on g2 (picked up by the last drag) may go to any empty square of ranks 2 to 4: 24 less the two
  // pawns' squares, 22 dots; here to h4 by a tap.
  await expect(page.locator(".ac-dot")).toHaveCount(22);
  await tapSquare(page, "h4");
  await expect(piece(page, "white", "pawn", "h4")).toBeVisible();
  await expect(piece(page, "white", "pawn", "g2")).toHaveCount(0);
  await expect(page.locator('.ac-moved[data-square="h4"]')).toBeVisible();
  // The opponent's pieces haven't changed meanwhile, and are still shown.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  // One change in all: no other piece may move now, nor the same one again.
  const used = "You've made your move. Tap the piece you moved (↩) to take it back.";
  await tapSquare(page, "f2");
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await tapSquare(page, "f3");
  await expect(page.locator(".ac-card-say")).toContainText(used);
  await expect(piece(page, "white", "pawn", "f2")).toBeVisible();
  await dragMouse(page, await center(page, "h4"), await center(page, "h3"));
  await expect(page.locator(".ac-card-say")).toContainText(used);
  await expect(piece(page, "white", "pawn", "h4")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  // A tap on the moved piece takes its move back; then the other pawn may use the change (by a drag, this time).
  await tapSquare(page, "h4");
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  await dragMouse(page, await center(page, "f2"), await center(page, "a4"));
  await expect(piece(page, "white", "pawn", "a4")).toBeVisible();
  await tapSquare(page, "a4");
  await expect(piece(page, "white", "pawn", "f2")).toBeVisible();
  // The king stays where the game put it: no squares to go to, and it says so.
  await tapSquare(page, "c1");
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await expect(page.locator(".ac-card-say")).toContainText("Your king stays where the game put it.");
  await expect(piece(page, "white", "king", "c1")).toBeVisible();
  // Their pieces were shown all through.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  expect(errors).toEqual([]);
});

test("the adjust step is 5 seconds, then the fight; with the step off (?adjust=0) the buy step goes straight to the fight", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  // (Seed 11: the opponent locks in at about 8.7 s of the 30; locking in after it ends the buy step at once.)
  await page.goto("/autochess?seed=11");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const marks: { phase: string; at: number }[] = [{ phase: root.dataset.phase!, at: performance.now() }];
    (window as any).__phases = marks;
    new MutationObserver(() => {
      if (marks[marks.length - 1]!.phase !== root.dataset.phase) marks.push({ phase: root.dataset.phase!, at: performance.now() });
    }).observe(root, { attributes: true, attributeFilter: ["data-phase"] });
  });
  await expect(page.locator(".ac-bot-locked")).toBeVisible({ timeout: 20_000 });
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 2000 });
  // The clock starts at 0:05 (it rounds up), and the fight comes 5 seconds after the step began.
  await expect(page.locator(".ac-clock b")).toHaveText(/^0:0[45]$/);
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result)$/, { timeout: 8000 });
  const marks = await page.evaluate(() => (window as any).__phases as { phase: string; at: number }[]);
  const adjust = marks.find((m) => m.phase === "adjust")!;
  const next = marks.find((m) => m.at > adjust.at && m.phase !== "adjust")!;
  expect((next.at - adjust.at) / 1000).toBeGreaterThan(4.9);
  expect((next.at - adjust.at) / 1000).toBeLessThan(5.6);

  // The step off: buy, then the fight (never the adjust step), with both boards in full from the first move.
  await page.goto("/autochess?quick=1&seed=11&adjust=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const seen: string[] = [root.dataset.phase!];
    (window as any).__seen = seen;
    new MutationObserver(() => {
      if (seen[seen.length - 1] !== root.dataset.phase) seen.push(root.dataset.phase!);
    }).observe(root, { attributes: true, attributeFilter: ["data-phase"] });
  });
  await tap(page, card(page, 4));
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result)$/, { timeout: 15_000 });
  await expect(page.locator(".ac-theirs-line")).toHaveCount(0);
  const seen = await page.evaluate(() => (window as any).__seen as string[]);
  expect(seen).not.toContain("adjust");
  expect(seen[0]).toBe("buy");
  expect(seen[1]).toBe("fight");
  // Their pieces are all real for the fight (no circle is left).
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  expect(await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count()).toBeGreaterThan(0);
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
  await watchFight(page);
  // To a result (through the adjust step and the fight).
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 150_000 });
  // The fight: "Move N of 60" with its rules in the box, the step named "Fight", the moves highlighted on the board.
  const fight = await fightSeen(page);
  expect(fight.fight).toBe(true);
  expect(fight.say).toMatch(/^Move \d+ of 60/);
  expect(fight.label).toBe("Fight");
  expect(fight.text).toContain("A side left with only its king loses. Gains count, not army size: 3 pawns gained for 6 moves wins,");
  expect(fight.text).toContain("and a stall (repeats, 10 moves each with no capture, or 60) goes to the side that gained more.");
  expect(fight.text).not.toMatch(/checks? in a row/);
  expect(fight.text).toContain("A pawn at the far end cashes in for +5 gold.");
  expect(fight.lastMove).toBe(true);
  // The board's usual knocks play for the engine's moves (a capture sounds as it does everywhere).
  expect(await page.evaluate(() => (window as any).__soundLog.filter((l: string) => /^(move|capture):/.test(l)).length)).toBeGreaterThan(0);
  const head = (await page.locator(".ac-card-head").innerText()).trim();
  expect(head).toMatch(/^(You win the round\.|You lose the round\.|The round is a draw\.)$/);
  const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
  // The result says why the fight ended (a stall: why, and who the engine's score favors by how much).
  expect(words).toMatch(RESULT_WHY);
  const lost = words.match(/(?:You|Your opponent) loses? (\d+) HP\./);
  const gold = (await page.locator(".ac-card-gold").innerText()).trim();
  expect(gold).toMatch(/^Next round: \d+ saved \+ \d+ income( \+ \d+ interest)?( \+ \d+ streak)?( \+ \d+ survivors)?( \+ \d+ from cash-ins)? = \d+ gold$/);
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
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(1);
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

test("a pawn reaching the far end cashes in: it lands, a coin sounds, \"+5\" floats up from its square, it leaves, and the 5 gold is in the next round's line", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  // (A test switch, `?fightfen=`: the fight starts from this position. White's king on h1 is shut in and its h-pawn blocked, so its one
  // move is the b-pawn's step onto b8: a cash-in. You are White in round 1.)
  const fen = "6r1/1P6/8/4k3/8/7p/7P/7K w - - 0 1";
  // (The screen never loads Stockfish: the HunChess engine plays the fight.)
  const stockfish: string[] = [];
  page.on("request", (r) => /stockfish/i.test(r.url()) && stockfish.push(r.url()));
  await page.goto(`/autochess?quick=1&seed=3&adjust=0&fightfen=${encodeURIComponent(fen)}`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Every frame from here: a pawn drawn on b8, and the floating gold (its amount and the square it sits on).
  await page.evaluate(() => {
    const seen = { pawnOnB8: false, floats: [] as { amount: string; x: string; y: string }[], pawnAfter: true };
    (window as any).__cash = seen;
    const look = () => {
      if (document.querySelector('.hb-board piece.white.pawn[data-square="b8"]')) seen.pawnOnB8 = true;
      for (const f of document.querySelectorAll<HTMLElement>(".ac-float.on-board")) {
        const at = { amount: f.dataset.amount!, x: f.style.getPropertyValue("--sq-x"), y: f.style.getPropertyValue("--sq-y") };
        if (!seen.floats.some((s) => s.amount === at.amount && s.x === at.x && s.y === at.y)) seen.floats.push(at);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 60_000 });
  const cash = await page.evaluate(() => (window as any).__cash as { pawnOnB8: boolean; floats: { amount: string; x: string; y: string }[] });
  // The pawn stood on b8 for a moment, then left: "+5" floated from b8 (column 1, row 0 with White at the bottom).
  expect(cash.pawnOnB8).toBe(true);
  expect(cash.floats).toContainEqual({ amount: "5", x: "1", y: "0" });
  await expect(page.locator(`${BOARD_SEL.piece}.white.pawn[data-square="b8"]`)).toHaveCount(0);
  expect(await soundCount(page, "acCash")).toBe(1);
  // The 5 gold waits for the next round, in its own part of the line.
  await expect(page.locator(".ac-card-gold")).toContainText("+ 5 from cash-ins");
  expect(stockfish).toEqual([]);
  expect(errors).toEqual([]);
});

test("a fight always ends even if the engine never answers (?stall=1): its looks time out to stand-in moves", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/autochess?quick=1&seed=3&adjust=0&stall=1");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await buyAll(page, 4);
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 15_000 });
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 90_000 });
  await expect(page.locator(".ac-card-head")).toHaveText(/^(You win the round\.|You lose the round\.|The round is a draw\.)$/);
  expect(errors).toEqual([]);
});

test("the result says why, by the gains: a side that gained 3 pawns wins early, a stall goes to the side that gained (at 320 px, the box holds it)", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  // (`?fightfen=`: fights from the sim's 80 (reports/autochess-gain.md), each played the same every time. You are White.)
  const cases = [
    // Black starts with the bigger army; White gains 3 pawns on its start and holds it for 6 of its moves: it wins at once (Eric, Oct 21).
    { fen: "8/p5k1/4pp1p/1rb1p3/4PP2/3B4/2PPN1KP/8 w - - 0 1", head: "You win the round.", why: "You gained 3+ pawns and held it for 6 moves. Your opponent loses " },
    // A stall Black wins by less than a pawn's gain (half a pawn is enough): "the edge", never "0 pawns".
    { fen: "6k1/5p2/2n2p1p/4p2r/P1P5/1P6/3P4/6K1 w - - 0 1", head: "You lose the round.", why: "Fight stalled (10 moves each, no capture): your opponent gained the edge. You lose " },
    // Even armies, a stall with nothing gained: a draw.
    { fen: "2k3r1/8/pp6/5p2/1P6/8/6PP/R1K5 w - - 0 1", head: "The round is a draw.", why: "Fight stalled (10 moves each, no capture): neither side gained the edge, a draw. Nobody loses HP." },
  ];
  for (const c of cases) {
    await page.goto(`/autochess?quick=1&seed=3&adjust=0&fightfen=${encodeURIComponent(c.fen)}`);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await tap(page, lockButton(page));
    await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 60_000 });
    await expect(page.locator(".ac-card-head")).toHaveText(c.head);
    const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
    expect(words.startsWith(c.why), words).toBe(true);
    const box = await page.locator(".ac-card").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, buttons: (el.querySelector(".ac-go") as HTMLElement).getBoundingClientRect().bottom - el.getBoundingClientRect().bottom }));
    expect(box.scroll, "the result's box holds its words").toBeLessThanOrEqual(box.client);
    expect(box.buttons, "the button is inside the box").toBeLessThanOrEqual(0);
  }
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
        foot: Math.max(r(".ac-ctl").bottom, r(".ac-me").bottom),
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
    expect(m.foot, `${w}×${h}: the buttons and your row on screen`).toBeLessThanOrEqual(h);
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
  const foot = async () => {
    const b = (await page.locator(".ac-card, .ac-ctl").first().boundingBox())!;
    return b.y + b.height;
  };
  const bottom = await foot();
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  const during = (await page.locator(".hb-board").boundingBox())!;
  const bottom2 = await foot();
  expect(Math.abs(during.y - before.y) + Math.abs(during.width - before.width)).toBeLessThan(1);
  expect(Math.abs(bottom2 - bottom), "the foot of the box under the board stays").toBeLessThan(1);
  // (And your strip, right under the board, stays put too.)
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Drags cut off, silhouettes that are only tapped, a sale of a piece that isn't there (Eric's first test of the new fights, Oct 21:
// docs/decisions/2026-10-21-autochess-drag-fixes.md). Each of these failed on main (bc9a97e) before its fix.
// ---------------------------------------------------------------------------------------------------------------------------------

const ghosts = (p: Page) => p.locator(".ac-ghost");
const sellZone = (p: Page) => p.locator(".ac-sell-drop");
/** What a drag that does nothing must leave alone: your gold, your pieces on the board and the bench. */
const holdings = (p: Page) =>
  p.evaluate(() => ({
    gold: Number(document.querySelector(".ac-gold-you b")?.textContent),
    board: [...document.querySelectorAll(".hb-board piece.white")].map((e) => `${e.className.replace(/ ?anim/, "")}@${(e as HTMLElement).dataset.square}`).sort(),
    bench: [...document.querySelectorAll(".ac-slot.has")].map((e) => `${(e as HTMLElement).dataset.kind}@${(e as HTMLElement).dataset.square}`),
  }));
/** Every white piece drawn on the page (not the avatar's pawn or the shop's and bench's little icons), and those on the board itself: a ghost is drawn outside the board. */
const whitePieces = (p: Page) =>
  p.evaluate(() => ({
    all: [...document.querySelectorAll("piece.white")].filter((e) => !e.closest(".ac-avatar, .ac-icon")).length,
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

test("a drag cut off by the end of the adjust step ends with it: no frozen ghost over the fight, the result or the next round (Eric's second queen on g1)", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.goto("/autochess?quick=1&seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const shown = await offers(page);
  const pawn = shown.findIndex((o) => o.kind === "p");
  const square = shown[pawn]!.square;
  await tap(page, card(page, pawn));
  await expect(piece(page, "white", "pawn", square)).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  // Pick the pawn up, as Eric picked up his queen, and keep holding: the drag is live, its ghost under the pointer.
  await pickUp(page, await center(page, square), { x: 24, y: -36 });
  await expect(ghosts(page)).toHaveCount(1);
  // The step ends under the finger: the fight begins, and the drag is over: no ghost, only the pieces that are really there.
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result)$/, { timeout: 15_000 });
  await expect(ghosts(page)).toHaveCount(0);
  const mid = await whitePieces(page);
  expect(mid.all, "no white piece drawn off the board").toBe(mid.board);
  expect(mid.board, "the king and the pawn at most").toBeLessThanOrEqual(2);
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

for (const via of ["a shop card", "a piece on the board", "a held piece"] as const) {
  test(`a drag from ${via} that is still held when the buy step locks ends there with no action, and stays ended through the end of the step`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.goto("/autochess?quick=1&seed=9");
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
    await expect(page.locator(".ac-clock span")).toHaveText("Locked", { timeout: 8000 });
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

test("locking in under a drag ends the drag: the bonus is the only gold that moves, and nothing is held", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(NEVER);
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
  expect(await goldOf(page)).toBe(125);
  await expect(held(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a drag whose pointer is cancelled or loses its capture ends with no action: nothing bought, held or sold, no ghost", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => document.addEventListener("pointerdown", (e) => ((window as any).__pointer = e.pointerId), true));
  await page.goto("/autochess?seed=9");
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

test("a silhouette on the board is only tapped: pressing it and dragging it picks nothing up and drops nothing, on the sell zone, the bench or the board (Eric: 'it just sold a piece that didn't exist')", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9");
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
    // (Nothing follows the pointer, and neither the shop row nor the bench lights up for a drop.)
    await expect(ghosts(page), `a silhouette dragged to ${name}: no ghost`).toHaveCount(0);
    await expect(sellZone(page), `${name}: no drop zone`).toHaveCount(0);
    await page.mouse.up();
    expect(await holdings(page), `dropped on ${name}: nothing changed`).toEqual(before);
    expect(await offers(page), `${name}: the shop is as it was`).toEqual(offersBefore);
    await expect(page.locator(".ac-sil")).toHaveCount(5);
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

test("a sale only pays for a piece of yours that is there: selling a piece the pointer is still carrying (the Sell button, the keyboard) pays once, not again at the drop", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const shown = await offers(page);
  const pawn = shown.findIndex((o) => o.kind === "p");
  await tap(page, card(page, pawn));
  await expect(piece(page, "white", "pawn", shown[pawn]!.square)).toBeVisible();
  const gold = await goldOf(page);
  // Pick the pawn up (picking it up selects it, so "Sell 7" shows), then sell it with the keyboard while it is still held.
  await pickUp(page, await center(page, shown[pawn]!.square), { x: 10, y: -30 });
  await expect(ghosts(page)).toHaveCount(1);
  const sell = page.getByRole("button", { name: "Sell 7", exact: true });
  await sell.focus();
  await page.keyboard.press("Enter");
  await expect(piece(page, "white", "pawn", shown[pawn]!.square)).toHaveCount(0);
  expect(await goldOf(page)).toBe(gold + 7);
  // Dropping what is no longer there on the sell zone: no second payment (it was a NaN before), no second "Sold".
  const shop = await shopMiddle(page);
  await page.mouse.move(shop.x, shop.y, { steps: 6 });
  await page.mouse.up();
  await expect(ghosts(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(gold + 7);
  expect(await soundCount(page, "sell")).toBe(1);
  await expect(page.locator(".ac-float")).toHaveCount(1);
  await expect(page.locator(".ac-msg")).toContainText("Sold the pawn for 7.");
  expect(errors).toEqual([]);
});
