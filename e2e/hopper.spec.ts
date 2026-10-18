import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, test, bossAloneFromHome } from "./helpers.ts";

/**
 * Chub & Chirp (id hopper), through their test link (?boss=hopper&wip=1: their rules are built before their art, so
 * they're hidden from players), played alone with real taps on a phone and a computer. Rules only: the app shows nothing
 * new for them yet (their art is a later build), so this reads the battle's state (window.match).
 * - Leapfrog (?power=leapfrog: the battle starts from 1.e4 e5, your move): whatever you play, at the start of his turn
 *   his pawn hops over yours to the square beyond (a base on the board, no move added), its moment before his move; then
 *   he plays his move.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

async function squareAt(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}
const tap = async (page: Page, square: string) => {
  const q = await squareAt(page, square);
  await page.mouse.click(q.x, q.y);
};
async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}
async function play(page: Page, move: string) {
  await yourMove(page);
  for (let i = 0; i < 5 && (await phase(page)) === "play"; i++) {
    await tap(page, move.slice(0, 2));
    await tap(page, move.slice(2, 4));
    await page.waitForTimeout(300);
  }
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

test("Chub & Chirp's Leapfrog (the test switch): his pawn hops over yours at the start of his turn, then he moves", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=hopper&wip=1&power=leapfrog&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.name).toBe("Chub & Chirp");
  expect(boss.powers.passive).toBe("leapfrog");
  expect(boss.powers.hop).toBeNull();
  const crowd: "w" | "b" = boss.crowdSide;
  const his = crowd === "w" ? "b" : "w";
  // From 1.e4 e5 (and 2.Nf3 when you're Black), your move.
  const start = new Chess();
  for (const m of crowd === "w" ? ["e4", "e5"] : ["e4", "e5", "Nf3"]) start.move(m);
  const fen0 = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  expect(fen0.split(" ").slice(0, 4)).toEqual(start.fen().split(" ").slice(0, 4));
  const plies = await page.evaluate(() => (window as any).match.phase.board.history.length as number);
  // (Watch from before his turn: the first frame the hop is in the state, which phase it showed in, and the moves then.)
  await page.evaluate(() => {
    const w = window as any;
    w.__hopSeen = null;
    const look = () => {
      const m = w.match;
      if (!w.__hopSeen && m?.boss?.powers?.hop) w.__hopSeen = { phase: m.phase.kind, plies: m.boss.board.history.length, last: m.boss.powers.events?.at(-1)?.kind ?? null };
      if (!w.__hopSeen) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await play(page, crowd === "w" ? "g1f3" : "b8c6");
  await yourMove(page);
  const after = await page.evaluate(() => (window as any).match.boss.powers);
  const [from, over, to] = crowd === "w" ? ["e5", "e4", "e3"] : ["e4", "e5", "e6"];
  expect(after.hop).toEqual({ at: 1, from, over, to });
  // It played before his move, on a screen of its own (his turn, the hop the last thing that happened).
  const seen = await page.evaluate(() => (window as any).__hopSeen);
  expect(seen).toEqual({ phase: "boss", plies: plies + 1, last: "hop" });
  // On the board: a base at the hop's ply (no move added for it) with his pawn on the square beyond, yours where it was;
  // then his move (one more ply).
  const board = await page.evaluate(() => (window as any).match.boss.board);
  expect(board.history).toHaveLength(plies + 2);
  const base = board.bases.find((b: { ply: number }) => b.ply === plies + 1);
  expect(base).toBeTruthy();
  const hopped = new Chess(base.fen);
  expect(hopped.get(to as never)).toMatchObject({ color: his, type: "p" });
  expect(hopped.get(from as never)).toBeFalsy();
  expect(hopped.get(over as never)).toMatchObject({ color: crowd, type: "p" });
  expect(base.fen.split(" ")[1]).toBe(his);
  expect(base.fen.split(" ")[3]).toBe("-");
  // His move was played from the hop's position.
  const move = board.history[plies + 1];
  expect(hopped.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""))).toContain(move);
  expect(errors).toEqual([]);
});
