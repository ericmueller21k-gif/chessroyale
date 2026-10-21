import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, asAdmin, named, test } from "./helpers.ts";

/**
 * Auto chess, the demo (/autochess; docs/areas/autochess.md; shelved: Settings' Testing section, for admins, opens it): a
 * round is played from buying to the fight's end, on a phone and a computer. `?quick=1` (a test switch) shortens the steps (buy 7 s with the last
 * 2 locked, circles half a second behind, a reveal every 1.5 s, the move step still 7 s, a fight move every 60 ms); `?adjust=0` turns the move step
 * off; `?seed=` fixes the kings, the shop and the bot; `?gold=N` adds gold; `?level=N` starts both sides at level N (rooks and queens in the shop at
 * once); `?lockin=1` turns lock-in on (it is off since v7) and `?adjustmode=teleport` the v6 adjust step.
 *
 * The screen is v7's (docs/decisions/2026-10-21-autochess-v7.md): their bench top left, their pawn top right, the board in its frame with the move clock's
 * bars, your pawn bottom left, the clock's small numbers and your bench bottom right, then the dock (gold and the odds pill, Buy XP, Reroll, four cards).
 */
const phone = () => test.info().project.name === "phone";
// (A tap or click that finds nothing fails in seconds, not at the test's end.)
test.use({ actionTimeout: 15_000 });

// Seeds (each fixes round 1's kings, its four offers and the bot). `quick` = the steps' short times. The shop rolls by the level (4 to begin with: pawns,
// knights and bishops only; `?level=10` for rooks and queens), so these are the seeds' shops since v7 (4 slots, odds by level).
//  9: bishop b4, pawn d4, pawn g3, pawn h3; king d2. With lock-in on the bot never locks in.
//  5: pawn f2, pawn g2, pawn h3, pawn b2; king c1. With lock-in on the bot locks in at 3.79 s (of the 4 s open).
// 11: pawn b2, pawn c4, pawn b3, pawn f4; king h1. With lock-in on the bot locks in at 1.33 s.
//  3: pawn g3, pawn b4, pawn h3, bishop e4; king e2.
// 60 with `level=10`: queen g3, queen e3, pawn h4, bishop d3; king h1 (two queens, to show the limit and the reasons).
// 6298: bishop f3, pawn f2, pawn h2, pawn h4; king b1. Holding the bishop rolls a pawn onto f3 (the held piece's square); holding the pawn for h4 rolls a pawn
//       onto h4 too: the two ways an offer can meet a held piece's square.
// 24 (quick): knight e2, pawn a3, pawn h3, bishop a1; king d1. Buying the first three, the move step lights the knight on e2 (c1, c3, d4, f4, g1, g3).
// 25 (quick, gold=600): pawn b3, pawn f4, pawn d3, pawn g4; king f1. The bot buys XP and holds a rook for h6 and a bishop for e7 by 3 s.
const PLAIN = "/autochess?quick=1&seed=9";
const NEVER = PLAIN;
const LATE = "/autochess?quick=1&seed=5";
const EARLY = "/autochess?quick=1&seed=11";
const FIGHT = "/autochess?quick=1&seed=3";
const TWOQ = "/autochess?quick=1&seed=60&level=10";
const MOVE = "/autochess?quick=1&seed=24";
const HELD = "/autochess?quick=1&seed=25&gold=600";
/** Every way a fight's result line can begin (the reason it ended), then the HP line. */
const RESULT_WHY =
  /^(Checkmate\.|Stalemate\.|(You|Your opponent) gained 3\+ pawns and held it for 6 moves\.|Fight stalled \((moves repeated|10 moves each, no capture|60 moves each)\): ((you|your opponent) gained (\d+ pawns?|the edge|a winning edge)|neither side gained the edge, a draw)\.|Draw by the fifty-move rule\.|Draw: not enough pieces left to mate\.|A side left with only its king loses at once\.|Both sides are down to a king: a draw\.) /;
const PRICES: Record<string, number> = { p: 10, n: 30, b: 32, r: 50, q: 90 };
const NAMES: Record<string, string> = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen" };
/** A dark square (a bench tile and a shop card's tile take the color of the square the piece lands on). */
const isDark = (sq: string) => (sq.charCodeAt(0) - 96 + Number(sq[1])) % 2 === 0;

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
/** The small spot under the board, in the gap beside your pawn: the clock's numbers, and under them the step's name, or a short message for a moment. */
const clockOf = (p: Page) => p.locator(".ac-timer b");
const stepLabel = (p: Page) => p.locator(".ac-timer span");
const say = (p: Page) => p.locator(".ac-timer span.say");
/** Your level (the badge on your pawn) and the XP toward the next (its bar), and theirs. */
const youBadge = (p: Page) => p.locator(".ac-badge");
const botLevel = (p: Page) => p.locator(".ac-who .ac-lv");
async function expectLevel(p: Page, level: number | string, xp: string) {
  await expect(youBadge(p)).toHaveText(String(level));
  await expect(p.locator(".ac-xp-you b")).toHaveText(xp);
}

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
/** The offers now, in slot order (each shop card says its piece and its square). */
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
/** Your bench (bottom right) and theirs (top left): four tiles each, a held piece on the color of the square it keeps with that square's name. */
const youBench = (p: Page) => p.locator(".ac-bench.you");
const theirBench = (p: Page) => p.locator(".ac-bench.them");
const held = (p: Page) => youBench(p).locator(".ac-slot.has");
/** The bench row's middle (where an offer is dropped to hold it), and the shop row's (where a piece is dropped to sell it). */
const benchMiddle = async (p: Page) => middle((await youBench(p).boundingBox())!);
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
      seen.say ||= document.querySelector(".ac-timer span")?.textContent ?? "";
      seen.text ||= document.querySelector(".ac-card-text")?.textContent ?? "";
      seen.label ||= document.querySelector(".ac-timer b")?.textContent ?? "";
      if (document.querySelector(".hb-board square.last-move")) seen.lastMove = true;
    }).observe(root, { attributes: true, subtree: true, childList: true, characterData: true });
  });
}
const fightSeen = (p: Page) => p.evaluate(() => (window as any).__fight as { fight: boolean; say: string; text: string; label: string; lastMove: boolean });

/** Every banner on the board from now on (the phase words and the 3-2-1), in the order they first showed, each with when. */
async function watchBanners(p: Page) {
  await p.evaluate(() => {
    const seen: { text: string; at: number }[] = [];
    (window as any).__banners = seen;
    const t0 = performance.now();
    const look = () => {
      const text = document.querySelector(".ac-banner .cc-num")?.textContent?.trim() ?? "";
      if (text && seen[seen.length - 1]?.text !== text) seen.push({ text, at: performance.now() - t0 });
    };
    new MutationObserver(look).observe(document.body, { childList: true, subtree: true, characterData: true });
    look();
  });
}
const bannersSeen = (p: Page) => p.evaluate(() => (window as any).__banners as { text: string; at: number }[]);

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

test("the shop: four offers, each a piece and a square of your own, on a square tile of that square's color, drawn as glowing silhouettes on the board, one to a square, each filling it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const king = (await root(page).getAttribute("data-king"))!;
  expect(king).toBe("d2");
  const shown = await offers(page);
  expect(shown).toEqual([
    { kind: "b", square: "b4" },
    { kind: "p", square: "d4" },
    { kind: "p", square: "g3" },
    { kind: "p", square: "h3" },
  ]);
  // Four cards (v7: was five), each: the piece on a square tile, its name and square ("Bishop b4"), its price. All on your half, none on your king; pawns on your 2nd to 4th rank.
  await expect(page.locator(".ac-buy")).toHaveCount(4);
  await expect(page.locator(".ac-buy .ac-cost b")).toHaveText(shown.map((o) => String(PRICES[o.kind])));
  await expect(page.locator(".ac-buy .ac-nm")).toHaveText(shown.map((o) => `${NAMES[o.kind]} ${o.square}`));
  for (const [slot, o] of shown.entries()) {
    expect(Number(o.square[1])).toBeLessThanOrEqual(4);
    expect(o.square).not.toBe(king);
    if (o.kind === "p") expect(Number(o.square[1])).toBeGreaterThanOrEqual(2);
    // The tile is square (never a tall one) and in the color of the square it lands on; the piece sits on it.
    const tile = card(page, slot).locator(".ac-tile");
    await expect(tile).toHaveClass(isDark(o.square) ? /\bd\b/ : /\bl\b/);
    const tb = (await tile.boundingBox())!;
    expect(Math.abs(tb.width - tb.height), `${o.square}: a square tile`).toBeLessThan(1.5);
    const pb = (await tile.locator("piece").boundingBox())!;
    expect(pb.x).toBeGreaterThanOrEqual(tb.x - 1);
    expect(pb.x + pb.width).toBeLessThanOrEqual(tb.x + tb.width + 1);
  }
  // On the board: four silhouettes, each on its own square (never two on one: Eric, Oct 21), and each fills its square.
  expect(new Set(shown.map((o) => o.square)).size).toBe(4);
  await expect(page.locator(".ac-sil")).toHaveCount(4);
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
  // The board holds only your king: nothing is placed for free. Both benches are always there, four slots each, empty ones faint tile outlines.
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(1);
  await expect(youBench(page).locator(".ac-slot")).toHaveCount(4);
  await expect(theirBench(page).locator(".ac-slot")).toHaveCount(4);
  await expect(held(page)).toHaveCount(0);
  await expect(theirBench(page).locator(".ac-slot.has")).toHaveCount(0);
  expect(await youBench(page).locator(".ac-slot.empty").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await youBench(page).locator(".ac-slot.empty").first().evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  expect(errors).toEqual([]);
});

test("the shop: a reroll costs 2 and rolls all four offers (the same for the same seed), and is refused without the gold", async ({ page }) => {
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
  expect(rolled).toHaveLength(4);
  expect(rolled).not.toEqual(first);
  await expect(page.locator(".ac-sil")).toHaveCount(4);
  await expect(page.locator(".ac-buy .ac-cost b")).toHaveText(rolled.map((o) => String(PRICES[o.kind])));
  // Seeded by the round and the reroll count: a fresh start rerolled once shows the same four.
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
  await expect(say(page)).toHaveText("Need 2 more");
  expect(await goldOf(page)).toBe(0);
  expect(await offers(page)).toEqual(before);
  // Buy XP says so too (4 XP cost 20).
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(say(page)).toHaveText("Need 20 more");
  expect(await goldOf(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("one offer to a square (Eric, Oct 21): over several seeds, rerolls and buys, no two offers share a square, none is on your king or a piece of yours, and each square shows one silhouette", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const check = async (where: string) => {
    const shown = await offers(page);
    expect(shown, `${where}: four offers`).toHaveLength(4);
    const squares = shown.map((o) => o.square);
    expect(new Set(squares).size, `${where}: ${squares}`).toBe(4);
    const mine = await page.locator(`${BOARD_SEL.piece}.white`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.square!));
    for (const sqr of squares) expect(mine, `${where}: ${sqr} is free`).not.toContain(sqr);
    await expect(page.locator(".ac-sil")).toHaveCount(4);
    const centers = await page.locator(".ac-sil").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return `${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`;
      }),
    );
    expect(new Set(centers).size, `${where}: four silhouettes, each on its own square`).toBe(4);
  };
  // (`gold=900` pays for the rerolls and the buys.)
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
  // No hint text under the board any more (the small spot is for the clock, the step's name and a short message).
  await expect(page.locator(".ac-msg, .ac-card-say")).toHaveCount(0);
  await expect(say(page)).toHaveCount(0);

  // The bishop on b4 (slot 0) by its silhouette: it lands on b4, 32 gold. No other offer was on b4, so none rolls again and nothing says so.
  const before = await offers(page);
  await tapSilhouette(page, 0);
  await expect(piece(page, "white", "bishop", "b4")).toBeVisible();
  expect(await goldOf(page)).toBe(68);
  await expect(say(page)).toHaveCount(0);
  // (A solid thunk as it lands: one place sound for each piece bought onto its square.)
  expect(await soundCount(page, "acPlace")).toBe(1);
  const after = await offers(page);
  expect(after).toHaveLength(4);
  // The new offer in slot 0 is on a free square: not b4 (the bishop), and none of the other offers' squares.
  expect(after[0]!.square).not.toBe("b4");
  expect(new Set(after.map((o) => o.square)).size).toBe(4);
  expect(after.slice(1)).toEqual(before.slice(1));
  // The pawn on g3 (slot 2) by its shop card: it lands on g3, 10 gold.
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "pawn", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(58);
  expect(await soundCount(page, "acPlace")).toBe(2);
  await expect(piece(page, "white", "bishop", "b4")).toBeVisible();
  // The pawn on d4 (slot 1) by its silhouette: a pawn stands on d4, 48 gold left.
  await tapSilhouette(page, 1);
  await expect(piece(page, "white", "pawn", "d4")).toBeVisible();
  expect(await goldOf(page)).toBe(48);
  // After every buy the four offers are on four squares, none of them the king's or a piece's.
  const squares = (await offers(page)).map((o) => o.square);
  expect(new Set(squares).size).toBe(4);
  for (const sqr of ["d2", "b4", "g3", "d4"]) expect(squares).not.toContain(sqr);
  // Nothing was placed for free, and nothing of yours on the board but what was bought: the king, a bishop and two pawns.
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("buying: a greyed offer says why (gold, the one-queen limit), in a few words when it is tapped; selling by tap and by drag; the lock", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(TWOQ);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // (Level 10 for the queens: 7% a slot.)
  expect(await offers(page)).toEqual([
    { kind: "q", square: "g3" },
    { kind: "q", square: "e3" },
    { kind: "p", square: "h4" },
    { kind: "b", square: "d3" },
  ]);
  // The queen on g3: 90 gold. Then 10 are left: the bishop can't be had (greyed, "No gold", "Need 22 more" when tapped), and the second queen is over the limit.
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "queen", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(10);
  await expect(card(page, 3)).toHaveAttribute("aria-disabled", "true");
  await expect(card(page, 3)).toHaveAttribute("aria-label", /No gold/);
  await card(page, 3).click({ force: true });
  await expect(say(page)).toHaveText("Need 22 more");
  await expect(card(page, 1)).toHaveAttribute("aria-label", /Max 1/);
  await card(page, 1).click({ force: true });
  await expect(say(page)).toHaveText("One queen max");
  await expect(piece(page, "white", "bishop", "d3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(10);
  // Buy XP at the top level says so (the next round of its words, "Need N more", is in the reroll test).
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(say(page)).toHaveText("Top level (10)");
  expect(await goldOf(page)).toBe(10);
  // The king is the game's: tapping it says so.
  await tapSquare(page, "h1");
  await expect(say(page)).toHaveText("King: set by game");
  // Sell by tapping your queen: the Sell button (in the gap under the clock) says what it gives, "Sell 67" (75% of 90, rounded down), and the sell sound plays.
  await tapSquare(page, "g3");
  const sellButton = page.getByRole("button", { name: "Sell 67", exact: true });
  await expect(sellButton).toBeVisible();
  const sb = (await sellButton.boundingBox())!;
  const clock = (await page.locator(".ac-timer").boundingBox())!;
  const frame = (await page.locator(".ac-frame").boundingBox())!;
  expect(sb.height).toBeGreaterThanOrEqual(44);
  expect(sb.y, "under the board, in the gap").toBeGreaterThan(frame.y + frame.height);
  expect(sb.x + sb.width / 2, "centered in the gap").toBeGreaterThan(clock.x + 4);
  expect(sb.x + sb.width / 2).toBeLessThan(clock.x + clock.width - 4);
  await tap(page, sellButton);
  await expect(piece(page, "white", "queen", "g3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(77);
  expect(await soundCount(page, "sell")).toBe(1);
  await expect(say(page)).toHaveText("Sold for 67");
  // Buy a pawn (10) and sell it by dragging it onto the shop: 75% of 10 is 7.
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
  // The last 2 seconds are locked: "Locked" under the clock, and nothing is bought, sold or moved; the shop and the silhouettes dim.
  await expect(stepLabel(page)).toHaveText("Locked", { timeout: 15_000 });
  const gold = await goldOf(page);
  await card(page, 0).click({ force: true });
  await expect(say(page)).toHaveText("Shop locked");
  expect(await goldOf(page)).toBe(gold);
  await expect(page.locator(".ac-shop")).toHaveClass(/shut/);
  await expect(page.locator(".ac-sil.off")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("the bench: drag an offer onto it to hold it (it keeps its square), tap it to place it when its square is free, sell it by dragging it onto the shop", async ({ page }) => {
  const errors = watchErrors(page);
  // (The full 30 s step: a drag takes a while, and the quick step's 5 open seconds are a tap-test's. Seed 6298: see the list at the top.)
  await page.goto("/autochess?seed=6298");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const before = await offers(page);
  expect(before.map((o) => `${o.kind}${o.square}`)).toEqual(["bf3", "pf2", "ph2", "ph4"]);
  // The bishop for f3 (slot 0) is dragged from its shop card onto the bench: 32 gold, it waits there with its square, nothing lands on the board.
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "b");
  await expect(held(page).first()).toHaveAttribute("data-square", "f3");
  await expect(held(page).first().locator("em")).toHaveText("f3");
  // (The tile is the color of the square the piece keeps: f3 is a light square.)
  await expect(held(page).first()).toHaveClass(isDark("f3") ? /\bd\b/ : /\bl\b/);
  expect(await goldOf(page)).toBe(68);
  await expect(say(page)).toHaveText("Held f3");
  // (A soft pop for a hold, not the thunk of a piece landing.)
  expect(await soundCount(page, "acHold")).toBe(1);
  expect(await soundCount(page, "acPlace")).toBe(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(1);
  // A new offer rolled into slot 0 (a pawn, and on f3 itself: the bishop only waits there, so f3 is empty); the others stay.
  const after = await offers(page);
  expect(after).toHaveLength(4);
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(after[0]).toEqual({ kind: "p", square: "f3" });
  // The pawn for h4 (slot 3) is dragged from its card the same way (a silhouette on the board is only tapped, never dragged); its slot rolls a pawn onto h4 too.
  await dragMouse(page, middle((await card(page, 3).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(2);
  expect(await goldOf(page)).toBe(58);
  expect(await soundCount(page, "acHold")).toBe(2);
  expect((await offers(page))[3]).toEqual({ kind: "p", square: "h4" });
  // Tapping the held pawn places it on h4 (free): the bench slot empties, and the offer on h4 (slot 3) rolls again, onto a square that is free.
  await tap(page, held(page).nth(1));
  await expect(piece(page, "white", "pawn", "h4")).toBeVisible();
  expect(await soundCount(page, "acPlace")).toBe(1);
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(58);
  await expect(say(page)).toHaveText("h4 rolled again");
  const rolled = (await offers(page)).map((o) => o.square);
  expect(rolled).not.toContain("h4");
  expect(new Set(rolled).size).toBe(4);
  // The pawn offered for f3 (slot 0) is bought onto f3: the held bishop's square is taken, so tapping the bishop says so and nothing happens.
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "pawn", "f3")).toBeVisible();
  expect(await goldOf(page)).toBe(48);
  await expect(held(page).first()).toHaveClass(/off/);
  await tapGreyed(page, held(page).first());
  await expect(say(page)).toHaveText("f3 is taken");
  await expect(held(page)).toHaveCount(1);
  // Sell the held bishop by dragging it onto the shop: 75% of 32, rounded down, is 24.
  const slotBox = (await held(page).first().boundingBox())!;
  await dragMouse(page, middle(slotBox), await shopMiddle(page));
  await expect(held(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(72);
  // The 24 floats up right over the slot the bishop was sold from (it is in the bench row, over the first slot), and is gone a moment later.
  const bench0 = (await youBench(page).boundingBox())!;
  const flo = page.locator(".ac-float");
  await expect(flo).toHaveCount(1);
  await expect(flo).toHaveText("+24");
  const fb = (await flo.boundingBox())!;
  expect(fb.x + fb.width / 2).toBeGreaterThan(slotBox.x - 2);
  expect(fb.x + fb.width / 2).toBeLessThan(slotBox.x + slotBox.width + 2);
  expect(fb.y).toBeLessThan(bench0.y + bench0.height);
  expect(fb.y + fb.height).toBeGreaterThan(bench0.y - 45);
  await expect(flo).toHaveCount(0, { timeout: 3000 });
  await expect(say(page)).toHaveText("Sold for 24");
  expect(await soundCount(page, "sell")).toBe(1);
  expect(errors).toEqual([]);
});

test("while you drag an offer, your whole bench row lights up (gold ring), and only yours: theirs never takes a drag", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(youBench(page)).not.toHaveClass(/lit/);
  const card0 = middle((await card(page, 1).boundingBox())!);
  await page.mouse.move(card0.x, card0.y);
  await page.mouse.down();
  await page.mouse.move(card0.x + 6, card0.y - 6, { steps: 2 });
  const b = await benchMiddle(page);
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await expect(youBench(page)).toHaveClass(/lit/);
  await expect(theirBench(page)).not.toHaveClass(/lit/);
  // The ring is the app's gold, around the whole row (the empty tiles included).
  expect(await youBench(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.mouse.up();
  await expect(youBench(page)).not.toHaveClass(/lit/);
  await expect(held(page)).toHaveCount(1);
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
  await expect(say(page)).toHaveText("Bench full");
  await expect(held(page)).toHaveCount(4);
  expect(await goldOf(page)).toBe(gold);
  // Pawns held for squares: each is placed on its own square when tapped, never anywhere else.
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
  await expectLevel(page, 4, "2/4");
  await expect(botLevel(page)).toContainText("Lv 4");
  await expect(xpButton(page)).toContainText("Buy XP");
  await expect(xpButton(page)).toContainText("20");
  // Four pieces on the board: the level's number.
  await buyAll(page, 4);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  // The fifth is refused: the offers aren't greyed (they can still be held; their squares show in gold), and a tap says why.
  const gold = await goldOf(page);
  const slot = page.locator(".ac-buy.hold-only").first();
  await expect(slot).toHaveAttribute("aria-label", /Level full/);
  await expect(page.locator(".ac-sil.off")).toHaveCount(4);
  await tapGreyed(page, slot);
  await expect(say(page)).toHaveText("Board full. Drag to bench");
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  expect(await goldOf(page)).toBe(gold);
  // Held on the bench instead, and placed once there is room.
  await dragMouse(page, middle((await slot.boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  await tapGreyed(page, held(page).first());
  await expect(say(page)).toHaveText("Board full: buy XP");
  await expect(held(page)).toHaveCount(1);
  // Buy XP: 20 gold, 4 XP: 2 + 4 reaches the 4 for level 5, with 2 over: level 5, 2/8; the number pops, and the board may hold 5.
  const before = await goldOf(page);
  await tap(page, xpButton(page));
  await expectLevel(page, 5, "2/8");
  await expect(page.locator(".ac-badge.pop")).toBeVisible();
  // (A small rising chime for the XP, a bigger one as the level comes.)
  expect(await soundCount(page, "acXp")).toBe(1);
  expect(await soundCount(page, "acLevel")).toBe(1);
  expect(await goldOf(page)).toBe(before - 20);
  await expect(say(page)).toHaveText("Level 5: 5 pieces");
  await tap(page, held(page).first());
  await expect(held(page)).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(6);
  // Another 4 XP is no level yet: it says so in the numbers (6 of 8), no pop of its own.
  await tap(page, xpButton(page));
  await expectLevel(page, 5, "6/8");
  await expect(say(page)).toHaveText("+4 XP");
  expect(await soundCount(page, "acXp")).toBe(2);
  expect(await soundCount(page, "acLevel")).toBe(1);
  // All the way up: 82 XP in all from level 4's 2 is 21 buys (the first two are done): level 10, "max", and no more to buy.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll<HTMLButtonElement>(".ac-xp")][0]!;
    for (let i = 0; i < 19; i++) b.click();
  });
  await expectLevel(page, 10, "max");
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(say(page)).toHaveText("Top level (10)");
  expect(await goldOf(page)).toBe(before - 21 * 20);
  expect(errors).toEqual([]);
});

test("the odds pill in the gold row: each piece's icon with its percent under it at your level (no 'Odds' word, no strip of its own), on the gold number's baseline, and it follows a level-up", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&gold=200");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const pill = page.locator(".ac-odds");
  const shownOdds = () => page.locator(".ac-od").evaluateAll((els) => els.map((e) => ({ kind: (e as HTMLElement).dataset.kind!, pct: e.querySelector("b")!.textContent!, faded: e.classList.contains("none") })));
  // Level 4 (L4 74/14/12/0/0): rooks and queens are not on offer yet, and say so, faded.
  expect(await shownOdds()).toEqual([
    { kind: "p", pct: "74%", faded: false },
    { kind: "n", pct: "14%", faded: false },
    { kind: "b", pct: "12%", faded: false },
    { kind: "r", pct: "0%", faded: true },
    { kind: "q", pct: "0%", faded: true },
  ]);
  await expect(pill).toHaveAttribute("aria-label", "Chance of each piece in the shop at level 4: pawn 74%, knight 14%, bishop 12%, rook 0%, queen 0%");
  // The pill lives in the gold row (gold, income, the pill, the streak), with no word "Odds" and no row of its own above Buy XP.
  expect(await pill.evaluate((el) => !!el.closest(".ac-goldrow"))).toBe(true);
  await expect(page.locator(".ac-dock")).not.toContainText(/odds/i);
  await expect(page.locator(".ac-dock .ac-pc")).toHaveCount(5 + 4);
  // Each icon is a piece's picture with its percent under it.
  const parts = await page.locator(".ac-od").evaluateAll((els) => els.map((e) => ({ icon: e.querySelector(".ac-pc")!.getBoundingClientRect().bottom, pct: e.querySelector("b")!.getBoundingClientRect().top })));
  for (const p of parts) expect(p.icon, "the percent is under its icon").toBeLessThanOrEqual(p.pct + 1);
  // The bottom of the percent numbers sits on the same line as the bottom of the gold number (their baselines).
  const baselines = await page.evaluate(() => {
    const base = (el: Element) => {
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      el.appendChild(probe);
      const y = probe.getBoundingClientRect().bottom;
      probe.remove();
      return y;
    };
    return { gold: base(document.querySelector(".ac-gold-you b")!), pcts: [...document.querySelectorAll(".ac-od b")].map(base) };
  });
  for (const y of baselines.pcts) expect(Math.abs(y - baselines.gold), "a percent's baseline is the gold number's").toBeLessThanOrEqual(1);
  // The icons sit higher than the gold number's top (a little), as Eric allowed; the pill is small (its height under a button's).
  const gold = (await page.locator(".ac-gold-you b").boundingBox())!;
  const pb = (await pill.boundingBox())!;
  expect(pb.y).toBeLessThan(gold.y + 4);
  expect(pb.height).toBeLessThan(44);
  // A level-up: Buy XP (2 + 4 reaches level 5): 66/14/13/7/0, the rook no longer faded.
  await tap(page, xpButton(page));
  await expectLevel(page, 5, "2/8");
  expect(await shownOdds()).toEqual([
    { kind: "p", pct: "66%", faded: false },
    { kind: "n", pct: "14%", faded: false },
    { kind: "b", pct: "13%", faded: false },
    { kind: "r", pct: "7%", faded: false },
    { kind: "q", pct: "0%", faded: true },
  ]);
  await expect(pill).toHaveAttribute("aria-label", /level 5: pawn 66%, knight 14%, bishop 13%, rook 7%, queen 0%/);
  // Up to level 7 (5 more XP buys: 8 and 12 XP to the next two levels): queens appear, 54/18/16/11/1.
  for (let i = 0; i < 5; i++) await tap(page, xpButton(page));
  await expectLevel(page, 7, "2/16");
  expect(await shownOdds()).toEqual([
    { kind: "p", pct: "54%", faded: false },
    { kind: "n", pct: "18%", faded: false },
    { kind: "b", pct: "16%", faded: false },
    { kind: "r", pct: "11%", faded: false },
    { kind: "q", pct: "1%", faded: false },
  ]);
  // The rows come from the same table the shop rolls by: a game started at level 10 shows 36/21/20/16/7.
  await page.goto("/autochess?seed=9&level=10");
  await expect(page.locator(".ac-od b")).toHaveText(["36%", "21%", "20%", "16%", "7%"]);
  expect(errors).toEqual([]);
});

test("the screen's kitty-corner: their bench top left and their pawn top right above the board; your pawn bottom left and your bench bottom right under it, the same gap from the board; name and level, thin HP and XP bars", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
  const frame = await box(".ac-frame");
  const theirs = await box(".ac-bench.them");
  const yours = await box(".ac-bench.you");
  const opp = await box(".ac-opp");
  const me = await box(".ac-me");
  const timer = await box(".ac-timer");
  // Their bench top left and their pawn top right, both above the board; yours bottom right and your pawn bottom left, both under it.
  expect(theirs.y + theirs.height).toBeLessThanOrEqual(frame.y + 0.5);
  expect(opp.y + opp.height).toBeLessThanOrEqual(frame.y + 12);
  expect(theirs.x + theirs.width, "their bench is left of their pawn").toBeLessThan(opp.x);
  expect(yours.y).toBeGreaterThanOrEqual(frame.y + frame.height - 0.5);
  expect(me.y).toBeGreaterThanOrEqual(frame.y + frame.height - 0.5);
  expect(me.x + me.width, "your pawn is left of your bench").toBeLessThan(yours.x);
  // The clock's numbers sit in the gap between your pawn and your bench.
  expect(timer.x).toBeGreaterThanOrEqual(me.x + me.width - 12);
  expect(timer.x + timer.width).toBeLessThanOrEqual(yours.x + 1);
  // Kitty-corner: their bench at the top left of the column, their pawn at its top right; your pawn at the bottom left, your bench at the bottom right.
  const top = await box(".ac-top");
  const bottom = await box(".ac-bottom");
  expect(Math.abs(theirs.x - top.x), "their bench starts at the column's left edge").toBeLessThanOrEqual(1);
  expect(Math.abs(top.x + top.width - (opp.x + opp.width)), "their pawn ends at its right edge").toBeLessThanOrEqual(1);
  expect(Math.abs(me.x - bottom.x), "your pawn starts at its left edge").toBeLessThanOrEqual(1);
  expect(Math.abs(bottom.x + bottom.width - (yours.x + yours.width)), "your bench ends at its right edge").toBeLessThanOrEqual(1);
  // The same gap from the board for both (the clock's bar and a little air), and identical tiles.
  const gapTop = frame.y - (theirs.y + theirs.height);
  const gapBottom = yours.y - (frame.y + frame.height);
  expect(Math.abs(gapTop - gapBottom), `the benches' gaps: ${gapTop} and ${gapBottom}`).toBeLessThanOrEqual(1.5);
  expect(gapTop).toBeGreaterThanOrEqual(6);
  expect(gapTop).toBeLessThanOrEqual(16);
  const tiles = async (sel: string) => page.locator(`${sel} .ac-slot`).evaluateAll((els) => els.map((e) => ({ w: Math.round(e.getBoundingClientRect().width * 10) / 10, h: Math.round(e.getBoundingClientRect().height * 10) / 10 })));
  expect(await tiles(".ac-bench.them")).toEqual(await tiles(".ac-bench.you"));
  // The name and the level beside their pawn; their and your numbers in thin bars under the pawns.
  await expect(page.locator(".ac-who .ac-name")).toHaveText("Bot");
  await expect(botLevel(page)).toHaveText("Lv 4");
  await expect(page.locator(".ac-hp-you b")).toHaveText("20");
  await expect(page.locator(".ac-hp-bot b")).toHaveText("20");
  await expect(page.locator(".ac-xp-you b")).toHaveText("2/4");
  await expect(page.locator(".ac-xp-bot b")).toHaveText("2/4");
  await expectLevel(page, 4, "2/4");
  for (const sel of [".ac-me", ".ac-opp"]) {
    const bars = await page.locator(`${sel} .ac-bar i`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(bars, `${sel}: HP and XP`).toHaveLength(2);
    for (const h of bars) expect(h, `${sel}: a thin bar`).toBeLessThanOrEqual(8);
    const pawn = (await page.locator(`${sel} .ac-pawn`).boundingBox())!;
    const first = (await page.locator(`${sel} .ac-bar`).first().boundingBox())!;
    expect(first.y, `${sel}: the bars are under the pawn`).toBeGreaterThanOrEqual(pawn.y + pawn.height - 2);
    expect(pawn.height, `${sel}: a big pawn`).toBeGreaterThanOrEqual(40);
  }
  // HP is green at full (the move clock's own colors: hue 135) and the bar's length is the share left.
  expect(await page.locator(".ac-hp-you").evaluate((el) => getComputedStyle(el).getPropertyValue("--f"))).toBe("1");
  expect(await page.locator(".ac-xp-you").evaluate((el) => getComputedStyle(el).getPropertyValue("--f"))).toBe("0.5");
  // Each has a dressed pawn drawn (your color to match your pieces: White in round 1; theirs Black).
  for (const [sel, color] of [[".ac-me", "white"], [".ac-opp", "black"]] as const) {
    await expect(page.locator(`${sel} .avatar`)).toHaveCount(1);
    await expect(page.locator(`${sel} .avatar piece.${color}.pawn, ${sel} .avatar .avatar-skin`).first()).toBeAttached();
    const drawn = await page.locator(`${sel} .avatar`).evaluate((el) => ({ w: el.getBoundingClientRect().width, kids: el.children.length }));
    expect(drawn.w).toBeGreaterThan(30);
    expect(drawn.kids).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test("both custom pawns hop, out of step (about 1.8 s and 2.1 s loops), crouch, rise, squash and settle with the shadow shrinking and fading as it rises; transforms and opacity only; off under reduced motion", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const anims = () =>
    page.evaluate(() =>
      document.getAnimations().flatMap((a) => {
        const el = (a.effect as KeyframeEffect | null)?.target as HTMLElement | null;
        if (!el || !/^ac-(hop|shade)$/.test((a as CSSAnimation).animationName ?? "")) return [];
        const keys = (a.effect as KeyframeEffect).getKeyframes();
        const props = new Set<string>();
        for (const k of keys) for (const p of Object.keys(k)) if (!["offset", "easing", "composite", "computedOffset"].includes(p)) props.add(p);
        return [{ name: (a as CSSAnimation).animationName, who: el.closest(".ac-me") ? "me" : "opp", duration: (a.effect as KeyframeEffect).getTiming().duration, delay: (a.effect as KeyframeEffect).getTiming().delay, props: [...props].sort(), iterations: (a.effect as KeyframeEffect).getTiming().iterations }];
      }),
    );
  const running = await anims();
  // Two animations each (the pawn, and its shadow), looping for ever.
  expect(running.filter((a) => a.who === "me")).toHaveLength(2);
  expect(running.filter((a) => a.who === "opp")).toHaveLength(2);
  for (const a of running) {
    expect(a.iterations).toBe(Infinity);
    // Transforms and opacity only (nothing that lays out or paints a lot): the pawn moves by transform, its shadow by transform and opacity.
    expect(a.props.every((p) => p === "transform" || p === "opacity"), `${a.name}: ${a.props}`).toBe(true);
  }
  const mine = running.find((a) => a.who === "me" && a.name === "ac-hop")!;
  const theirsHop = running.find((a) => a.who === "opp" && a.name === "ac-hop")!;
  expect(mine.duration).toBe(1800);
  expect(theirsHop.duration).toBe(2100);
  // Out of step: theirs starts 0.8 s along.
  expect(mine.delay).not.toBe(theirsHop.delay);
  expect(running.find((a) => a.who === "me" && a.name === "ac-shade")!.props).toContain("opacity");
  // The pawn rises (and the shadow shrinks and fades as it does): at the loop's top the pawn is higher than at rest and the shadow smaller and fainter.
  const pose = async (who: string, ms: number) =>
    page.evaluate(
      ([w, t]) => {
        const all = document.getAnimations() as CSSAnimation[];
        const hop = all.find((a) => a.animationName === "ac-hop" && !!((a.effect as KeyframeEffect).target as HTMLElement).closest(w === "me" ? ".ac-me" : ".ac-opp"))!;
        const shade = all.find((a) => a.animationName === "ac-shade" && !!((a.effect as KeyframeEffect).target as HTMLElement).closest(w === "me" ? ".ac-me" : ".ac-opp"))!;
        for (const a of [hop, shade]) {
          a.pause();
          a.currentTime = Number(t) + Number((a.effect as KeyframeEffect).getTiming().delay);
        }
        const h = new DOMMatrix(getComputedStyle((hop.effect as KeyframeEffect).target as HTMLElement).transform);
        const s = getComputedStyle((shade.effect as KeyframeEffect).target as HTMLElement);
        return { y: h.m42, shadowScale: new DOMMatrix(s.transform).a, shadowOpacity: Number(s.opacity) };
      },
      [who, ms] as const,
    );
  const rest = await pose("me", 0);
  const top = await pose("me", 0.37 * 1800);
  expect(top.y, "the pawn rises").toBeLessThan(rest.y - 5);
  expect(top.shadowScale, "the shadow shrinks as it rises").toBeLessThan(rest.shadowScale - 0.2);
  expect(top.shadowOpacity, "and fades").toBeLessThan(rest.shadowOpacity - 0.05);
  // Off under reduced motion.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await anims()).toEqual([]);
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
    ["a shop card", card(page, 2), 2],
    ["the back button", page.getByRole("button", { name: "Back to home" }), 2],
  ];
  for (const [name, loc, least] of buttons) {
    const c = middle((await loc.boundingBox())!);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await expect.poll(() => sunk(loc), { message: `${name} sinks while it is held`, timeout: 2000 }).toBeGreaterThanOrEqual(least - 0.6);
    // Let go away from it (so nothing is bought or rerolled), and it comes back up.
    await page.mouse.move(c.x, c.y - 200);
    await page.mouse.up();
    await expect.poll(() => sunk(loc), { message: `${name} comes back up`, timeout: 2000 }).toBeLessThan(0.5);
  }
  expect(await goldOf(page)).toBe(100);
  expect(errors).toEqual([]);
});

test("a sale floats its gold up from the square the piece stood on (+67 for a queen), light CSS that is gone a moment later; nothing floats for a purchase", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(TWOQ);
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
  // (Lock-in is off since v7; `?lockin=1` turns it back on, for its sound.)
  await page.goto("/autochess?seed=9&lockin=1");
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

test("lock-in is off (v7): no button, no bonus for anyone (the bot never locks), and the buy step runs its whole 30 s, only the last 3 locked", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  // (Seed 5: with lock-in on, the bot would lock in at about 21 s of the 30's open 26. The real step, not the quick one.)
  await page.goto("/autochess?seed=5");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await expect(lockButton(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Lock in/ })).toHaveCount(0);
  await expect(root(page)).not.toHaveAttribute("data-bonus", /.+/);
  await expect(root(page)).not.toHaveAttribute("data-lockin", /.+/);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  await expect(clockOf(page)).toHaveText(/^0:(30|29)$/);
  await expect(stepLabel(page)).toHaveText("Buy");
  expect(await goldOf(page)).toBe(100);
  // Open at 15 s and still at 25 s: nobody ended it early, the opponent's lock-in time (with lock-in on) came and went.
  await page.waitForTimeout(Math.max(0, 15_000 - (Date.now() - t0)));
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(stepLabel(page)).toHaveText("Buy");
  await page.waitForTimeout(Math.max(0, 25_000 - (Date.now() - t0)));
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  // The last 3 seconds still lock: "Locked" at 27 s, in red, and the step ends at 30.
  await expect(stepLabel(page)).toHaveText("Locked", { timeout: 4000 });
  const lockedAt = (Date.now() - t0) / 1000;
  expect(lockedAt).toBeGreaterThan(26.6);
  expect(lockedAt).toBeLessThan(28);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 5000 });
  const endedAt = (Date.now() - t0) / 1000;
  expect(endedAt).toBeGreaterThan(29.6);
  expect(endedAt).toBeLessThan(31.5);
  // No bonus came to anyone: your gold is what it was (nothing bought), and the bot's lock-in gold is not in its numbers.
  expect(await goldOf(page)).toBe(100);
  expect(errors).toEqual([]);
});

test("lock in (behind `?lockin=1`): the first side to lock gets 25 gold at once, and your board, bench and shop freeze", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${NEVER}&lockin=1`);
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
  await expect(say(page)).toHaveText("First: +25 gold");
  // Frozen: no buying, rerolling or selling; each says why, and nothing changes.
  await card(page, 0).click({ force: true });
  await expect(say(page)).toHaveText("You're locked in");
  const kinds = await offers(page);
  await reroll(page).click({ force: true });
  expect(await offers(page)).toEqual(kinds);
  await xpButton(page).click({ force: true });
  await expectLevel(page, 4, "2/4");
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(0);
  await tapSquare(page, "g3");
  await expect(say(page)).toHaveText("You're locked in");
  await expect(page.getByRole("button", { name: /^Sell/ })).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(2);
  await lockButton(page).click({ force: true });
  expect(await goldOf(page)).toBe(115);
  await expect(stepLabel(page)).toHaveText("Locked in", { timeout: 6000 });
  // The bot never locks here, so the step runs its time out; the gold is kept.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  expect(await goldOf(page)).toBe(115);
  expect(errors).toEqual([]);
});

test("lock in (behind `?lockin=1`): when the opponent locks first you see it, get no bonus, and both locked ends the step at once", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${EARLY}&lockin=1`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  await expect(lockButton(page)).toContainText("+25 gold");
  // At 1.33 s the opponent locks in: "Locked in" by their name, the bonus gone from the button.
  await expect(page.locator(".ac-bot-locked")).toHaveText("Locked in", { timeout: 6000 });
  await expect(page.getByLabel("Opponent locked in")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-bonus", "bot");
  await expect(lockButton(page)).not.toContainText("+25");
  // Their name and level still fit at the narrowest screen, with the tag in it.
  expect(await page.locator(".ac-who").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await goldOf(page)).toBe(100);
  // You lock in second: no bonus, and the step ends at once (it would run to 7 s).
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 1500 });
  expect(Date.now() - t0).toBeLessThan(6500);
  expect(await goldOf(page)).toBe(100);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("lock in (behind `?lockin=1`): you lock before the opponent, and when it locks too the step ends at once", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${LATE}&lockin=1`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-bonus", "you");
  expect(await goldOf(page)).toBe(125);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  // The opponent locks at 3.79 s: both locked, so the move step begins then, not at the 7 s end.
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

test("tap one of their bench pieces: a red ring on it and its landing square lights red on their half; a second tap or another piece clears it; their bench never drags", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(HELD);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Their bench shows real pieces (a rook for h6 and a bishop for e7 here), each with its square, on the color of that square, and the pieces are drawn black.
  const tiles = theirBench(page).locator(".ac-slot.has");
  await expect(tiles).toHaveCount(2, { timeout: 8000 });
  await expect(tiles.nth(0)).toHaveAttribute("data-kind", "r");
  await expect(tiles.nth(0)).toHaveAttribute("data-square", "h6");
  await expect(tiles.nth(0).locator("em")).toHaveText("h6");
  await expect(tiles.nth(0)).toHaveClass(isDark("h6") ? /\bd\b/ : /\bl\b/);
  await expect(tiles.nth(0).locator("piece")).toHaveClass(/black/);
  await expect(tiles.nth(1)).toHaveAttribute("data-kind", "b");
  await expect(tiles.nth(1)).toHaveAttribute("data-square", "e7");
  // A tile is a real target: 44 px tall.
  expect((await tiles.nth(0).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".ac-red")).toHaveCount(0);
  await expect(tiles.nth(0)).not.toHaveClass(/tapped/);
  // Tapped: a red ring on the tile, and the landing square lights red, exactly on that square of their half.
  await tap(page, tiles.nth(0));
  await expect(tiles.nth(0)).toHaveClass(/tapped/);
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(page.locator(".ac-red")).toHaveAttribute("data-square", "h6");
  const red = (await page.locator(".ac-red").boundingBox())!;
  const h6 = await center(page, "h6");
  expect(Math.abs(red.x + red.width / 2 - h6.x)).toBeLessThan(1.5);
  expect(Math.abs(red.y + red.height / 2 - h6.y)).toBeLessThan(1.5);
  expect(await page.locator(".ac-red").evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/^rgba\(220, 38, 38/);
  expect(await tiles.nth(0).evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/220, 38, 38/);
  // It is on their half (the top, as White is at the bottom), and over the whole square.
  const boardBox = (await page.locator(".ac-layer").boundingBox())!;
  expect(red.y + red.height).toBeLessThanOrEqual(boardBox.y + boardBox.height / 2 + 1);
  expect(red.width).toBeGreaterThan(boardBox.width / 8 - 2);
  // Another of their pieces: the ring and the red square move to it.
  await tap(page, tiles.nth(1));
  await expect(tiles.nth(0)).not.toHaveClass(/tapped/);
  await expect(tiles.nth(1)).toHaveClass(/tapped/);
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(page.locator(".ac-red")).toHaveAttribute("data-square", "e7");
  // A second tap on the same one clears it.
  await tap(page, tiles.nth(1));
  await expect(page.locator(".ac-red")).toHaveCount(0);
  await expect(tiles.nth(1)).not.toHaveClass(/tapped/);
  // Their bench never drags: a press and a drag on a tile picks nothing up, and nothing lights up for a drop.
  const at = middle((await tiles.nth(0).boundingBox())!);
  const goldBefore = await goldOf(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 8, at.y + 8, { steps: 2 });
  const to = await shopMiddle(page);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(page.locator(".ac-ghost")).toHaveCount(0);
  await expect(page.locator(".ac-sell-drop")).toHaveCount(0);
  await page.mouse.up();
  expect(await goldOf(page)).toBe(goldBefore);
  await expect(theirBench(page).locator(".ac-slot.has")).toHaveCount(2);
  // The tap holds through the move step (their pieces are shown for real then) and is gone when the fight begins.
  await tap(page, tiles.nth(0));
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 15_000 });
  await expect(page.locator(".ac-red")).toHaveCount(0);
  await expect(theirBench(page).locator(".ac-slot.has")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("a drag with a finger: a placed piece onto the shop sells it", async ({ page }) => {
  test.skip(!phone(), "real touch events, as a phone makes them");
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await card(page, 3).tap();
  await expect(piece(page, "white", "pawn", "h3")).toBeVisible();
  await dragTouch(page, await center(page, "h3"), await shopMiddle(page));
  await expect(piece(page, "white", "pawn", "h3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(97);
  expect(errors).toEqual([]);
});

test("the phase banners on the board: ACTION PHASE as buying begins, the big 3-2-1 for its last seconds, MOVE PHASE, BATTLE PHASE: the words about half the 3-2-1's size in a frosted box; the move clock's bars along the board; no hint text", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(MOVE);
  await watchBanners(page);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // (The knight and the two pawns, so there is a move to make and a fight to play.)
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await tap(page, card(page, 2));
  // ACTION PHASE as buying begins: words in the board's middle, in a rounded frosted box, upper case, and it fits inside the board.
  const action = page.locator(".ac-banner .cc-num.ac-phase");
  await expect(action).toHaveText("ACTION PHASE");
  const board = (await page.locator(".hb-board").boundingBox())!;
  const box = (await action.boundingBox())!;
  expect(box.x).toBeGreaterThan(board.x);
  expect(box.x + box.width).toBeLessThan(board.x + board.width);
  // (The banner is centered on the board's wrap, which is up to 8 device pixels wider than its squares: half of that at most.)
  expect(Math.abs(box.x + box.width / 2 - (board.x + board.width / 2)), "centered").toBeLessThan(4.5);
  expect(Math.abs(box.y + box.height / 2 - (board.y + board.height / 2)), "in the middle").toBeLessThan(board.height * 0.14);
  const style = await action.evaluate((el) => {
    const s = getComputedStyle(el);
    return { blur: s.backdropFilter || s.webkitBackdropFilter, radius: parseFloat(s.borderTopLeftRadius), bg: s.backgroundColor, fontSize: parseFloat(s.fontSize), board: el.closest(".board-wrap")!.getBoundingClientRect().width };
  });
  expect(style.blur).toContain("blur");
  expect(style.radius).toBeGreaterThan(8);
  expect(style.bg).toMatch(/^rgba\(/);
  // No hint text under the board any more: nothing but the clock's numbers, its name and the benches.
  await expect(page.locator(".ac-msg, .ac-card-say, .ac-hint")).toHaveCount(0);
  // The move clock: the app's own bars along the board's top and bottom (6 px, green at the start), shrinking toward the middle as the step runs.
  await expect(page.locator(".ac-frame > .timer-bar")).toHaveCount(2);
  await expect(page.locator(".ac-frame > .timer-bar.below")).toHaveCount(1);
  const barH = await page.locator(".ac-frame > .timer-bar").first().evaluate((el) => el.getBoundingClientRect().height);
  expect(barH).toBeGreaterThanOrEqual(5.5);
  expect(barH).toBeLessThanOrEqual(6.5);
  const frame = (await page.locator(".ac-frame").boundingBox())!;
  const top = (await page.locator(".ac-frame > .timer-bar").first().boundingBox())!;
  const bottom = (await page.locator(".ac-frame > .timer-bar.below").boundingBox())!;
  expect(Math.abs(top.y + top.height - frame.y), "the top bar sits on the frame's top edge").toBeLessThan(1.5);
  expect(Math.abs(bottom.y - (frame.y + frame.height)), "the bottom bar under the frame").toBeLessThan(1.5);
  const fill = () => page.locator(".ac-frame > .timer-bar").first().locator(".timer-fill").evaluate((el) => ({ w: el.getBoundingClientRect().width, bg: getComputedStyle(el).backgroundColor }));
  const f0 = await fill();
  await page.waitForTimeout(1200);
  const f1 = await fill();
  expect(f1.w, "the bar shrinks as the time runs").toBeLessThan(f0.w - 10);
  expect(f1.bg).not.toBe("rgba(0, 0, 0, 0)");
  // The clock's numbers and the step's name under the board, small, with no box.
  await expect(clockOf(page)).toHaveText(/^0:0[4-7]$/);
  await expect(stepLabel(page)).toHaveText("Buy");
  expect(await page.locator(".ac-timer").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  // The 3-2-1 for the last seconds, the app's own big numbers, and the shop shut with them.
  const count = page.locator(".ac-banner[data-banner=count] .cc-num");
  await expect(count).toHaveText(/^[321]$/, { timeout: 8000 });
  const countSize = await count.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  // The words are about half the 3-2-1's size (9 against 44 hundredths of the board: well under half; "about half" is the designer's reading of the app's countdown).
  expect(style.fontSize).toBeLessThan(countSize * 0.5);
  expect(style.fontSize).toBeGreaterThan(countSize * 0.1);
  // The move step, and the fight.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 10_000 });
  await expect(page.locator(".ac-banner .cc-num.ac-phase")).toHaveText("MOVE PHASE");
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 20_000 });
  await expect(page.locator(".ac-banner .cc-num.ac-phase")).toHaveText("BATTLE PHASE");
  // Each banner goes after its pop (about 1.6 s), none stays over the fight.
  await expect(page.locator(".ac-banner")).toHaveCount(0, { timeout: 4000 });
  const seen = (await bannersSeen(page)).map((b) => b.text);
  expect(seen).toEqual(["ACTION PHASE", "3", "2", "1", "MOVE PHASE", "BATTLE PHASE"]);
  const times = await bannersSeen(page);
  // (One every second for the 3-2-1.)
  expect(times[2]!.at - times[1]!.at).toBeGreaterThan(800);
  expect(times[2]!.at - times[1]!.at).toBeLessThan(1300);
  // The bars are gone for the fight.
  await expect(page.locator(".ac-frame > .timer-bar")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the move step (v7): one piece of yours is lit at random and you get 7 seconds for one legal chess move with it that stays on your half; the refusals say why; it can be taken back", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(MOVE);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The knight for e2, the pawns for a3 and h3.
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(piece(page, "white", "pawn", "a3")).toBeVisible();
  await expect(piece(page, "white", "pawn", "h3")).toBeVisible();
  const circles = await page.locator(".ac-circle").count();
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const marks: { phase: string; at: number }[] = [{ phase: root.dataset.phase!, at: performance.now() }];
    (window as any).__phases = marks;
    new MutationObserver(() => {
      if (marks[marks.length - 1]!.phase !== root.dataset.phase) marks.push({ phase: root.dataset.phase!, at: performance.now() });
    }).observe(root, { attributes: true, attributeFilter: ["data-phase"] });
  });
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  // Their full board shows (the circles are the pieces now) and stays; nothing says "your opponent is moving"; the shop is shut.
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  const theirs = await page.locator(`${BOARD_SEL.piece}.black`).count();
  expect(theirs).toBeGreaterThanOrEqual(circles + 1);
  await expect(page.locator(".ac-theirs-line")).toHaveCount(0);
  await expect(page.locator(".ac-shop")).toHaveClass(/shut/);
  await expect(page.locator(".ac-sil")).toHaveCount(0);
  await expect(stepLabel(page)).toHaveText("Move");
  await expect(clockOf(page)).toHaveText(/^0:0[67]$/);
  // The lit piece: the knight on e2 (seed 24), its box glowing, with its six legal squares as dots; the king and the pawns aren't lit.
  await expect(page.locator(".ac-pick")).toHaveCount(1);
  await expect(page.locator(".ac-pick")).toHaveAttribute("data-square", "e2");
  const lit = (await page.locator(".ac-pick").boundingBox())!;
  const e2 = await center(page, "e2");
  expect(Math.abs(lit.x + lit.width / 2 - e2.x)).toBeLessThan(1.5);
  expect(Math.abs(lit.y + lit.height / 2 - e2.y)).toBeLessThan(1.5);
  const dots = () => page.locator(".ac-dot").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.square!).sort());
  expect(await dots()).toEqual(["c1", "c3", "d4", "f4", "g1", "g3"]);
  expect(await page.locator(".ac-pick").evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  // Refused, each with its reason in a few words, and nothing is used up: another piece of yours, your king, their half, a square the knight can't reach.
  await tapSquare(page, "a3");
  await expect(say(page)).toHaveText("Only the lit piece");
  await tapSquare(page, "d1");
  await expect(say(page)).toHaveText("King stays put");
  await tapSquare(page, "e5");
  await expect(say(page)).toHaveText("Your half only");
  await tapSquare(page, "e3");
  await expect(say(page)).toHaveText("Not a legal move");
  await dragMouse(page, await center(page, "e2"), await center(page, "a3"));
  await expect(say(page)).toHaveText("Square taken");
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  expect(await dots()).toEqual(["c1", "c3", "d4", "f4", "g1", "g3"]);
  // One legal move: the knight to g3, by a tap on its dot. It lands, is marked (tap ↩ to take it back), the dots and the glow go, the move sound plays.
  await tapSquare(page, "g3");
  await expect(piece(page, "white", "knight", "g3")).toBeVisible();
  await expect(piece(page, "white", "knight", "e2")).toHaveCount(0);
  await expect(page.locator('.ac-moved[data-square="g3"]')).toBeVisible();
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  expect(await soundCount(page, "move")).toBeGreaterThanOrEqual(1);
  // The opponent's pieces haven't changed meanwhile, and are still shown.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  // No second move: not another square for the knight, not another piece.
  await tapSquare(page, "c3");
  await expect(say(page)).toHaveText("Moved. Tap ↩ to undo.");
  await expect(piece(page, "white", "knight", "g3")).toBeVisible();
  await dragMouse(page, await center(page, "a3"), await center(page, "a4"));
  await expect(piece(page, "white", "pawn", "a3")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  // A tap on the moved piece takes its move back: the knight is lit again with its squares, and may go elsewhere, here by a drag.
  await tapSquare(page, "g3");
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  await expect(page.locator(".ac-pick")).toHaveAttribute("data-square", "e2");
  expect(await dots()).toEqual(["c1", "c3", "d4", "f4", "g1", "g3"]);
  await dragMouse(page, await center(page, "e2"), await center(page, "f4"));
  await expect(piece(page, "white", "knight", "f4")).toBeVisible();
  await expect(page.locator('.ac-moved[data-square="f4"]')).toBeVisible();
  // The step is 7 seconds, then the fight (with the knight on f4: skipping would leave it on e2).
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 12_000 });
  const marks = await page.evaluate(() => (window as any).__phases as { phase: string; at: number }[]);
  const adjust = marks.find((m) => m.phase === "adjust")!;
  const next = marks.find((m) => m.at > adjust.at && m.phase !== "adjust")!;
  expect((next.at - adjust.at) / 1000).toBeGreaterThan(6.9);
  expect((next.at - adjust.at) / 1000).toBeLessThan(7.7);
  expect(errors).toEqual([]);
});

test("the move step with no piece of yours able to move: a short line says so, nothing is lit, and the step still runs (the bot may move) before the fight", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto(NEVER);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Buy nothing: only your king. The step still runs for the bot's move.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(say(page)).toHaveText("No piece can move");
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await tapSquare(page, "d2");
  await expect(say(page)).toHaveText("King stays put");
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 12_000 });
  expect(errors).toEqual([]);
});

test("the move step off (?adjust=0): the buy step goes straight to the fight, with both boards in full from the first move", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
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
  await tap(page, card(page, 3));
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result)$/, { timeout: 15_000 });
  const seen = await page.evaluate(() => (window as any).__seen as string[]);
  expect(seen).not.toContain("adjust");
  expect(seen[0]).toBe("buy");
  expect(seen[1]).toBe("fight");
  // Their pieces are all real for the fight (no circle is left).
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  expect(await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("the old adjust step stays in code behind `adjustMode: teleport` (`?adjustmode=teleport`): any piece to any empty square of your half, the refusals say why, it can be taken back, the king stays", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto(`${LATE}&adjustmode=teleport`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Two pawns on their start rank: f2 and g2.
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await expect(piece(page, "white", "pawn", "f2")).toBeVisible();
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  await expect(say(page)).toHaveText("Tap a piece, then a square");
  // Refused, each with its reason, and nothing is used up: their half, a taken square, the king's square, your back rank (for a pawn).
  const refused = async (to: string, words: string) => {
    await dragMouse(page, await center(page, "g2"), await center(page, to));
    await expect(say(page)).toHaveText(words);
    await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
    await expect(page.locator(".ac-moved")).toHaveCount(0);
  };
  await refused("e6", "Your half only");
  await refused("f2", "Square taken");
  await refused("c1", "King's square");
  await refused("a1", "Not on back rank");
  // Your one change: not a chess move. The pawn on g2 (picked up by the last drag) may go to any empty square of ranks 2 to 4: 24 less the two pawns' squares, 22 dots; here to h4 by a tap.
  await expect(page.locator(".ac-dot")).toHaveCount(22);
  await tapSquare(page, "h4");
  await expect(piece(page, "white", "pawn", "h4")).toBeVisible();
  await expect(page.locator('.ac-moved[data-square="h4"]')).toBeVisible();
  await tapSquare(page, "f2");
  await tapSquare(page, "f3");
  await expect(say(page)).toHaveText("Moved. Tap ↩ to undo.");
  // A tap on the moved piece takes its move back.
  await tapSquare(page, "h4");
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  // The king stays where the game put it.
  await tapSquare(page, "c1");
  await expect(say(page)).toHaveText("King stays put");
  expect(errors).toEqual([]);
});

test("a fight plays to a result, HP changes by the rule, and the next round starts empty but for the new kings, with the colors turned", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  await page.goto(FIGHT);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Hold the bishop offered for e4 (slot 3): 32 now, and it stays on the bench through the fight and into the next round.
  const heldOffer = (await offers(page))[3]!;
  expect(heldOffer).toEqual({ kind: "b", square: "e4" });
  await dragMouse(page, middle((await card(page, 3).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(68);
  // Buy what the shop shows with the rest (pawns), up to four times (level 4: four pieces on the board).
  await expectLevel(page, 4, "2/4");
  const bought = await buyAll(page, 4);
  expect(bought).toBeGreaterThanOrEqual(2);
  const left = await goldOf(page);
  await watchFight(page);
  // To a result (through the move step and the fight).
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 150_000 });
  // The fight: "Move N of 60" under "Fight" by the board, with its rules in the box, the moves highlighted on the board.
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
  // Both benches are still there for the result: yours holds the bishop.
  await expect(held(page)).toHaveCount(1);
  await expect(youBench(page).locator(".ac-slot")).toHaveCount(4);
  await expect(theirBench(page).locator(".ac-slot")).toHaveCount(4);

  // The next round: the kings alone (new squares, mirrored), you are Black and your half is at the bottom; the gold is what the line said.
  const total = Number(gold.match(/= (\d+) gold$/)![1]);
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(root(page)).toHaveAttribute("data-round", "2");
  await expect(page.locator(".ac-title span")).toHaveText("Round 2 · you play Black");
  await expect(page.locator(BOARD_SEL.wrap)).toHaveClass(/orientation-black/);
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(1);
  // Round 2's free 2 XP made level 5 (2 + 2 of 4): the number pops at the round's start. The opponent got its 2 XP too.
  await expectLevel(page, 5, "0/8");
  await expect(page.locator(".ac-badge.pop")).toBeVisible();
  await expect(botLevel(page)).toHaveText(/^Lv [5-9]$/);
  // What was held stays: the bishop is on the bench still, for the square turned with the colors (e4 for White, e5 for Black), and tapping it places it there.
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "b");
  await expect(held(page).first()).toHaveAttribute("data-square", "e5");
  await expect(held(page).first().locator("em")).toHaveText("e5");
  // The shop refilled free: four offers, on Black's half (ranks 5 to 8), and the gold is only the round's pay. Its odds are level 5's now.
  const shown = await offers(page);
  expect(shown).toHaveLength(4);
  for (const o of shown) expect(Number(o.square[1])).toBeGreaterThanOrEqual(5);
  expect(await goldOf(page)).toBe(total);
  await expect(page.locator(".ac-income b")).toHaveText("+120");
  await expect(page.locator(".ac-od b")).toHaveText(["66%", "14%", "13%", "7%", "0%"]);
  const k2 = (await root(page).getAttribute("data-king"))!;
  const b2 = (await root(page).getAttribute("data-bot-king"))!;
  expect(Number(k2[1])).toBeGreaterThanOrEqual(7);
  expect(b2[0]).toBe(k2[0]);
  expect(Number(k2[1]) + Number(b2[1])).toBe(9);
  // Black's pieces land on the half at the bottom of the screen, on the offered square; the held bishop lands on its own.
  const slot = shown.findIndex((o) => o.kind === "p" && o.square !== "e5");
  await tap(page, card(page, slot));
  await expect(piece(page, "black", "pawn", shown[slot]!.square)).toBeVisible();
  await tap(page, held(page).first());
  await expect(piece(page, "black", "bishop", "e5")).toBeVisible();
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
  await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 15_000 });
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 90_000 });
  await expect(page.locator(".ac-card-head")).toHaveText(/^(You win the round\.|You lose the round\.|The round is a draw\.)$/);
  expect(errors).toEqual([]);
});

test("the result says why, by the gains: a side that gained 3 pawns wins early, a stall goes to the side that gained (at 320 px, the box holds it and the page doesn't scroll)", async ({ page }) => {
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
    await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 60_000 });
    await expect(page.locator(".ac-card-head")).toHaveText(c.head);
    const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
    expect(words.startsWith(c.why), words).toBe(true);
    const box = await page.locator(".ac-card").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, buttons: (el.querySelector(".ac-go") as HTMLElement).getBoundingClientRect().bottom - el.getBoundingClientRect().bottom }));
    expect(box.scroll, "the result's box holds its words").toBeLessThanOrEqual(box.client);
    expect(box.buttons, "the button is inside the box").toBeLessThanOrEqual(0);
    const page2 = await page.evaluate(() => ({ down: document.documentElement.scrollHeight - innerHeight, side: document.documentElement.scrollWidth - document.documentElement.clientWidth, goBox: (document.querySelector(".ac-go") as HTMLElement).getBoundingClientRect() }));
    expect(page2.down, "no scrolling down at 320 x 568").toBeLessThanOrEqual(0);
    expect(page2.side).toBe(0);
    expect(page2.goBox.height, "the button is a real target").toBeGreaterThanOrEqual(44);
    expect(page2.goBox.bottom).toBeLessThanOrEqual(568);
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

/** What the page measures of the screen's layout (read in the browser), for `layouts`. */
const measure = (p: Page) =>
  p.evaluate(() => {
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const all = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
    const base = (el: Element) => {
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      el.appendChild(probe);
      const y = probe.getBoundingClientRect().bottom;
      probe.remove();
      return y;
    };
    const board = rect(".hb-board");
    const frame = rect(".ac-frame");
    const them = rect(".ac-bench.them");
    const you = rect(".ac-bench.you");
    const bottomRow = rect(".ac-bottom");
    const topRow = rect(".ac-top");
    const dock = rect(".ac-dock");
    const incomeWord = document.querySelector(".ac-income-word") as HTMLElement;
    return {
      down: document.documentElement.scrollHeight - innerHeight,
      side: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      board: { w: board.width, h: board.height, left: board.left, right: board.right, top: board.top },
      dockBottom: dock.bottom,
      gaps: { top: frame.top - them.bottom, bottom: you.top - frame.bottom },
      benchRight: you.right,
      bottomRight: bottomRow.right,
      benchLeft: them.left,
      topLeft: topRow.left,
      targets: {
        buttons: all(".ac-btn").map((b) => ({ w: b.width, h: b.height })),
        cards: all(".ac-buy").map((b) => ({ w: b.width, h: b.height, l: b.left, r: b.right })),
        tiles: all(".ac-slot").map((b) => ({ w: b.width, h: b.height, l: b.left, r: b.right })),
        back: [rect(".fd-back")].map((b) => ({ w: b.width, h: b.height })),
      },
      overflow: {
        names: [...document.querySelectorAll(".ac-nm")].map((e) => e.scrollWidth - e.clientWidth),
        buttons: [...document.querySelectorAll(".ac-btn")].map((e) => e.scrollWidth - e.clientWidth),
        who: (() => {
          const el = document.querySelector(".ac-who")!;
          return el.scrollWidth - el.clientWidth;
        })(),
      },
      goldRow: (() => {
        const row = rect(".ac-goldrow");
        const pill = rect(".ac-odds");
        const gold = document.querySelector(".ac-gold-you b")!;
        return { left: row.left, right: row.right, pillLeft: pill.left, pillRight: pill.right, pillH: pill.height, baselineGold: base(gold), baselines: [...document.querySelectorAll(".ac-od b")].map(base), incomeWord: incomeWord ? getComputedStyle(incomeWord).display : "none", income: (document.querySelector(".ac-income b") as HTMLElement).getBoundingClientRect().right };
      })(),
      timer: (() => {
        const t = rect(".ac-timer");
        return { l: t.left, r: t.right, bench: you.left, pawnR: rect(".ac-me").right };
      })(),
      who: (() => {
        const w = rect(".ac-who");
        return { l: w.left, r: w.right, bench: them.right, pawn: rect(".ac-opp").left };
      })(),
    };
  });

test("layouts: nothing scrolls, every target is at least 44 px (a tile 34 or more wide), the benches' gaps from the board are equal, and the odds pill fits the gold row, at every phone size and on a computer", async ({ page }) => {
  const errors = watchErrors(page);
  const sizes = phone()
    ? ([[320, 568], [360, 640], [375, 667], [390, 664], [390, 844], [414, 896], [430, 932]] as const)
    : ([[1280, 800], [1280, 600], [1366, 768], [1920, 1080]] as const);
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(TWOQ);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await tap(page, card(page, 0));
    // Your gold at its widest, a real one: a message in the small spot too ("Need 22 more").
    await card(page, 3).click({ force: true });
    await expect(say(page)).toHaveText("Need 22 more");
    const m = await measure(page);
    const where = `${w}×${h}`;
    expect(m.down, `${where}: scrolling down`).toBeLessThanOrEqual(0);
    expect(m.side, `${where}: sideways`).toBe(0);
    expect(Math.abs(m.board.w - m.board.h), `${where}: a square board`).toBeLessThan(1.5);
    expect(m.board.left, `${where}`).toBeGreaterThanOrEqual(0);
    expect(m.board.right, `${where}`).toBeLessThanOrEqual(w);
    expect(m.dockBottom, `${where}: the shop on screen`).toBeLessThanOrEqual(h);
    // Every target is at least 44 px tall (a card, Buy XP, Reroll, the back button, a bench tile); a phone's tiles are 34 to 40 wide, a card 56 and over.
    const minH = 44;
    for (const b of [...m.targets.buttons, ...m.targets.cards, ...m.targets.back, ...m.targets.tiles]) expect(b.h, `${where}: a target's height`).toBeGreaterThanOrEqual(minH - 0.5);
    for (const b of [...m.targets.buttons, ...m.targets.cards, ...m.targets.back]) expect(b.w, `${where}: a target's width`).toBeGreaterThanOrEqual(minH - 0.5);
    for (const t of m.targets.tiles) {
      expect(t.w, `${where}: a bench tile's width`).toBeGreaterThanOrEqual(33.5);
      expect(t.l, `${where}`).toBeGreaterThanOrEqual(0);
      expect(t.r, `${where}`).toBeLessThanOrEqual(w);
    }
    for (const c of m.targets.cards) {
      expect(c.l, `${where}: the shop inside`).toBeGreaterThanOrEqual(0);
      expect(c.r, `${where}: the shop inside`).toBeLessThanOrEqual(w);
    }
    expect(m.targets.cards, `${where}: four cards`).toHaveLength(4);
    expect(m.targets.tiles, `${where}: four tiles a bench`).toHaveLength(8);
    // Each name ("Bishop d3") fits under its tile, Buy XP and Reroll their words, their name and level beside their pawn.
    expect(m.overflow.names.every((x) => x <= 0), `${where}: card labels`).toBe(true);
    expect(m.overflow.buttons.every((x) => x <= 0), `${where}: the two buttons`).toBe(true);
    expect(m.overflow.who, `${where}: their name and level`).toBeLessThanOrEqual(0);
    expect(m.who.l, `${where}: their name is right of their bench`).toBeGreaterThanOrEqual(m.who.bench - 1);
    expect(m.who.r, `${where}: and left of their pawn`).toBeLessThanOrEqual(m.who.pawn + 2);
    // The benches are the same distance from the board (the clock's bar and a little air), theirs top left and yours bottom right.
    expect(Math.abs(m.gaps.top - m.gaps.bottom), `${where}: the benches' gaps ${m.gaps.top} and ${m.gaps.bottom}`).toBeLessThanOrEqual(1.5);
    expect(Math.abs(m.benchRight - m.bottomRight), `${where}: your bench ends at the column's right edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.benchLeft - m.topLeft), `${where}: their bench starts at its left edge`).toBeLessThanOrEqual(1);
    // The clock's numbers and the message sit in the gap, clear of the pawn and the bench.
    expect(m.timer.l, `${where}: the gap`).toBeGreaterThanOrEqual(m.timer.pawnR - 14);
    expect(m.timer.r, `${where}: the gap`).toBeLessThanOrEqual(m.timer.bench + 1);
    // The gold row: gold, income, and the odds pill, inside the screen, on one baseline; "Income" is dropped at 320 (the "+140" stays).
    expect(m.goldRow.pillRight, `${where}: the pill inside the row`).toBeLessThanOrEqual(m.goldRow.right + 0.5);
    expect(m.goldRow.pillLeft, `${where}: the pill clear of the income`).toBeGreaterThan(m.goldRow.income + 4);
    expect(m.goldRow.pillH, `${where}: a small pill`).toBeLessThan(44);
    for (const y of m.goldRow.baselines) expect(Math.abs(y - m.goldRow.baselineGold), `${where}: baselines`).toBeLessThanOrEqual(1);
    expect(m.goldRow.incomeWord, `${where}: "Income"`).toBe(w <= 350 ? "none" : "inline");
    await expect(page.locator(".ac-income b")).toHaveText("+100");
    // Every phone gets some free room at the bottom (the odds strip's room: the shop moved up). On a computer the dock isn't at the bottom.
    if (phone()) expect(h - m.dockBottom, `${where}: free room at the bottom`).toBeGreaterThanOrEqual(8);
    // A phone's board is as wide as the room allows; the others' room is the height.
    if (w <= 430) expect(m.board.w, `${where}`).toBeGreaterThan(Math.min(w - 40, h - 420) - 6);
  }
  expect(errors).toEqual([]);
});

test("layouts: the short words of every message fit the small spot at 320 px (at most 3 lines, clear of the pawn and the bench), and the 'Sell' button sits in the gap without moving a row", async ({ page }) => {
  test.skip(!phone(), "320 px");
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(TWOQ);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await tap(page, card(page, 0));
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
    "Need 100 more",
    "King: set by game",
    "You're locked in",
    "First: +25 gold",
    "Top level (10)",
    "One queen max",
    "8 pawns max",
    "h4 rolled again",
  ];
  const before = await page.evaluate(() => ({ bottom: document.querySelector(".ac-bottom")!.getBoundingClientRect().height, dock: document.querySelector(".ac-dock")!.getBoundingClientRect().top }));
  for (const text of words) {
    const r = await page.evaluate((t) => {
      const spans = document.querySelector(".ac-timer")!;
      const sp = spans.querySelector("span")!;
      sp.className = "say";
      sp.textContent = t;
      const b = sp.getBoundingClientRect();
      const lineH = parseFloat(getComputedStyle(sp).lineHeight);
      const me = document.querySelector(".ac-me")!.getBoundingClientRect();
      const bench = document.querySelector(".ac-bench.you")!.getBoundingClientRect();
      return { lines: Math.round(b.height / lineH), l: b.left, r: b.right, me: me.right, bench: bench.left, bottom: document.querySelector(".ac-bottom")!.getBoundingClientRect().height, dock: document.querySelector(".ac-dock")!.getBoundingClientRect().top, over: sp.scrollWidth - sp.clientWidth };
    }, text);
    expect(r.lines, `"${text}": lines`).toBeLessThanOrEqual(3);
    expect(r.l, `"${text}": clear of the pawn`).toBeGreaterThanOrEqual(r.me - 8);
    expect(r.r, `"${text}": clear of the bench`).toBeLessThanOrEqual(r.bench + 1);
    expect(r.over, `"${text}": no overflow`).toBeLessThanOrEqual(0);
    expect(r.bottom, `"${text}": the row doesn't grow`).toBeLessThanOrEqual(before.bottom + 0.5);
    expect(r.dock, `"${text}": the dock doesn't move`).toBeLessThanOrEqual(before.dock + 0.5);
  }
  // The Sell button (a piece of yours selected) is in the gap, a real target, and the row doesn't grow for it either.
  await tapSquare(page, "g3");
  const sell = page.getByRole("button", { name: /^Sell \d+$/ });
  await expect(sell).toBeVisible();
  const sb = (await sell.boundingBox())!;
  expect(sb.height).toBeGreaterThanOrEqual(44);
  expect(sb.width).toBeGreaterThanOrEqual(44);
  const timer = (await page.locator(".ac-timer").boundingBox())!;
  const bench = (await youBench(page).boundingBox())!;
  expect(sb.x).toBeGreaterThanOrEqual(timer.x - 1);
  expect(sb.x + sb.width).toBeLessThanOrEqual(bench.x + 1);
  const after = await page.evaluate(() => ({ bottom: document.querySelector(".ac-bottom")!.getBoundingClientRect().height, dock: document.querySelector(".ac-dock")!.getBoundingClientRect().top }));
  expect(after.bottom).toBeLessThanOrEqual(before.bottom + 0.5);
  expect(after.dock).toBeLessThanOrEqual(before.dock + 0.5);
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
    bench: [...document.querySelectorAll(".ac-bench.you .ac-slot.has")].map((e) => `${(e as HTMLElement).dataset.kind}@${(e as HTMLElement).dataset.square}`),
  }));
/** Every white piece drawn on the page (not the avatar's pawn or the shop's, the bench's and the odds' little icons), and those on the board itself: a ghost is drawn outside the board. */
const whitePieces = (p: Page) =>
  p.evaluate(() => ({
    all: [...document.querySelectorAll("piece.white")].filter((e) => !e.closest(".ac-pawn, .ac-pc")).length,
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

test("a drag cut off by the end of the move step ends with it: no frozen ghost over the fight, the result or the next round (Eric's second queen on g1)", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.goto(MOVE);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The knight for e2 (the lit piece of the move step, seed 24).
  await tap(page, card(page, 0));
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

test("locking in under a drag ends the drag: the bonus is the only gold that moves, and nothing is held (lock-in behind `?lockin=1`)", async ({ page }) => {
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
  await expect(say(page)).toHaveText("Sold for 7");
  expect(errors).toEqual([]);
});
