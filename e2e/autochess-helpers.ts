import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, test } from "./helpers.ts";

/** Auto chess's shared test helpers (autochess.spec.ts and autochess-board.spec.ts; split Nov 10, unchanged). */
export const phone = () => test.info().project.name === "phone";

// Seeds (each fixes round 1's kings, its four offers and the bot). `quick` = the steps' short times. The shop rolls by the level (4 to begin with: pawns,
// knights and bishops only; `?level=10` for rooks and queens), so these are the seeds' shops since v7 (4 slots, odds by level).
//  9: bishop b4, pawn d4, pawn g3, pawn h3; king d2. With lock-in on the bot never locks in.
//  5: pawn f2, pawn g2, pawn h3, pawn b2; king c1. With lock-in on the bot locks in at 3.79 s (of the 4 s open).
// 11: pawn b2, pawn c4, pawn b3, pawn f4; king h1. With lock-in on the bot locks in at 1.33 s.
//  3: pawn g3, pawn b4, pawn h3, bishop e4; king e2.
// 60 with `level=10`: queen g3, queen e3, pawn h4, bishop d3; king h1 (two queens, to show the limit and the reasons).
// 19512: bishop b4, pawn h4, pawn g2, pawn e2; king c1. Holding the bishop rolls a pawn onto b4 (the held piece's square); holding the pawn for e2 rolls a pawn
//       onto e2 too: the two ways an offer can meet a held piece's square (v8: the roll with a starrable piece held is the new one, so the seed was found again: 6298 before).
// 24 (quick): knight e2, pawn a3, pawn h3, bishop a1; king d1. Buying the first three, the move step lights the knight on e2 (c1, c3, d4, f4, g1, g3) with `?adjustmode=legal`.
// 66 (quick, gold=60): the bot (king h8, yours h1) holds a bishop for a8 and a rook for f8 by 3 s, and nothing more (the TFT-style economy changed its buys: 1291
//       before, with gold=600; v8's star-ups had changed its rolls before that: 316).
export const PLAIN = "/autochess?quick=1&seed=9&intro=0";
export const NEVER = PLAIN;
export const LATE = "/autochess?quick=1&seed=5&intro=0";
export const EARLY = "/autochess?quick=1&seed=11&intro=0";
export const FIGHT = "/autochess?quick=1&seed=3&intro=0";
export const TWOQ = "/autochess?quick=1&seed=60&level=10&intro=0";
export const MOVE = "/autochess?quick=1&seed=24&intro=0";
export const HELD = "/autochess?quick=1&seed=66&gold=60&intro=0";
/** Every way a fight's result line can begin (the reason it ended), then the HP line. */
export const RESULT_WHY =
  /^(Checkmate\.|Stalemate\.|(You|Your opponent) gained 3\+ pawns and held it for 6 moves\.|Fight stalled \((moves repeated|10 moves each, no capture|60 moves each)\): ((you|your opponent) gained (\d+ pawns?|the edge|a winning edge)|neither side gained the edge, a draw)\.|Draw by the fifty-move rule\.|Draw: not enough pieces left to mate\.|A side left with only its king loses at once\.|Both sides are down to a king: a draw\.) /;
export const PRICES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
export const NAMES: Record<string, string> = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen" };
/** A dark square (a bench tile and a shop card's tile take the color of the square the piece lands on). */
export const isDark = (sq: string) => (sq.charCodeAt(0) - 96 + Number(sq[1])) % 2 === 0;

/** Every page error and console error of a test: none may happen. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

export const root = (p: Page) => p.locator(".ac-root");
export const goldOf = async (p: Page) => Number(await p.locator(".ac-gold-you b").innerText());
export const hp = async (p: Page, who: "you" | "bot") => Number(await p.locator(`.ac-hp-${who} b`).innerText());
export const soundCount = (p: Page, name: string) => p.evaluate((n) => (window as any).__soundLog.filter((l: string) => l.startsWith(`${n}:`)).length, name);
/** The hexagon timer, in the action box's band between the income and the odds (Nov 8): the step's name over the time. A short message shows for a moment over the board's foot. */
export const clockOf = (p: Page) => p.locator(".ac-clock b");
export const stepLabel = (p: Page) => p.locator(".ac-clock .ac-step");
export const say = (p: Page) => p.locator(".ac-frame > .ac-msg");
/** Your level (the badge on your pawn) and the XP toward the next (its bar), and theirs. */
export const youBadge = (p: Page) => p.locator(".ac-badge");
export const botLevel = (p: Page) => p.locator(".ac-who .ac-lv");
export async function expectLevel(p: Page, level: number | string, xp: string) {
  await expect(youBadge(p)).toHaveText(String(level));
  await expect(p.locator(".ac-xp-you b")).toHaveText(xp);
}

/** The center of a square on the page (the board drawn either way up: your half is always at the bottom). */
export async function center(p: Page, square: string) {
  const b = (await p.locator(".ac-layer").boundingBox())!;
  const white = (await root(p).getAttribute("data-you")) === "w";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]);
  const col = white ? f : 7 - f;
  const row = white ? 8 - r : r - 1;
  return { x: b.x + ((col + 0.5) * b.width) / 8, y: b.y + ((row + 0.5) * b.height) / 8 };
}

/** A tap: a finger on a phone, a click on a computer. */
export async function tapAt(p: Page, x: number, y: number) {
  if (phone()) await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
}
export const tap = async (p: Page, l: Locator) => (phone() ? l.tap() : l.click());
/** A tap on something greyed (aria-disabled): Playwright won't act on it unless forced; a player can. */
export const tapGreyed = async (p: Page, l: Locator) => (phone() ? l.tap({ force: true }) : l.click({ force: true }));
export const tapSquare = async (p: Page, sq: string) => {
  const c = await center(p, sq);
  await tapAt(p, c.x, c.y);
};

/** A drag from one point to another, with the mouse. */
export async function dragMouse(p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move(from.x + 6, from.y - 6, { steps: 2 });
  await p.mouse.move(to.x, to.y, { steps: 8 });
  await p.mouse.up();
}

/** A drag with a finger (real touch events), as a phone makes it. */
export async function dragTouch(p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await p.context().newCDPSession(p);
  const point = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from.x, from.y) });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

export const middle = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

export interface Shown {
  kind: string;
  square: string;
}
/** The offers now, in slot order (each shop card says its piece and its square). */
export const offers = (p: Page): Promise<Shown[]> => p.locator(".ac-buy").evaluateAll((els) => els.map((e) => ({ kind: e.getAttribute("data-kind")!, square: e.getAttribute("data-square")! })));
export const card = (p: Page, slot: number) => p.locator(`.ac-buy[data-slot="${slot}"]`);
export const silhouette = (p: Page, slot: number) => p.locator(`.ac-sil[data-slot="${slot}"]`);
/** A tap on an offer's silhouette on the board (the layer takes the tap and finds the offer by its square and its side of it). */
export async function tapSilhouette(p: Page, slot: number) {
  const c = middle((await silhouette(p, slot).boundingBox())!);
  await tapAt(p, c.x, c.y);
}
export const reroll = (p: Page) => p.getByRole("button", { name: /^Reroll the shop/ });
export const piece = (p: Page, color: "white" | "black", role: string, square: string) => p.locator(`${BOARD_SEL.piece}.${color}.${role}[data-square="${square}"]`);
export const lockButton = (p: Page) => p.getByRole("button", { name: /^Lock(ed)? in/ });
export const xpButton = (p: Page) => p.getByRole("button", { name: /^Buy \d+ XP/ });
/** Your bench (bottom right) and theirs (top left): four tiles each, a held piece on the color of the square it keeps with that square's name. */
export const youBench = (p: Page) => p.locator(".ac-bench.you");
export const theirBench = (p: Page) => p.locator(".ac-bench.them");
export const held = (p: Page) => youBench(p).locator(".ac-slot.has");
/** The bench row's middle (where an offer is dropped to hold it), and the shop row's (where a piece is dropped to sell it). */
export const benchMiddle = async (p: Page) => middle((await youBench(p).boundingBox())!);
export const shopMiddle = async (p: Page) => middle((await p.locator(".ac-shop").boundingBox())!);

/** Taps the first offer that isn't greyed, up to `max` times (the board holds as many pieces as your level, 4 to begin with); how many taps. */
export async function buyAll(p: Page, max: number) {
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
export async function watchFight(p: Page) {
  await p.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const seen = { fight: false, say: "", count: "", text: "", label: "", lastMove: false };
    (window as any).__fight = seen;
    new MutationObserver(() => {
      if (root.dataset.phase !== "fight") return;
      seen.fight = true;
      seen.say ||= document.querySelector(".ac-clock")?.getAttribute("aria-label") ?? "";
      seen.count ||= document.querySelector(".ac-clock b")?.textContent ?? "";
      seen.text ||= document.querySelector(".ac-card-text")?.textContent ?? "";
      seen.label ||= document.querySelector(".ac-clock .ac-step")?.textContent ?? "";
      if (document.querySelector(".hb-board square.last-move")) seen.lastMove = true;
    }).observe(root, { attributes: true, subtree: true, childList: true, characterData: true });
  });
}
export const fightSeen = (p: Page) => p.evaluate(() => (window as any).__fight as { fight: boolean; say: string; count: string; text: string; label: string; lastMove: boolean });

/** Every banner on the board from now on (the phase words and the 3-2-1), in the order they first showed, each with when. */
export async function watchBanners(p: Page) {
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
export const bannersSeen = (p: Page) => p.evaluate(() => (window as any).__banners as { text: string; at: number }[]);
