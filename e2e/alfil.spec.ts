import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { fusionOptions } from "@chessroyale/chess";
import { BOARD_SEL, engineTop, test, bossAloneFromHome } from "./helpers.ts";

/**
 * Alfil, the woolly mammoth, through his test link (?boss=alfil&wip=1: his rules are built before his art, so he's
 * hidden from players), played alone with real taps on a phone and a computer. Rules only: the app shows nothing new
 * for him yet (his art is a later build), so these read the battle's state (window.match) and the board's pieces.
 * - Tusks (?power=tusks: his cast from his first turn): two of his pawns marked before his move; his next turn is the
 *   fusion: the elephant (a bishop) on one of their squares, the pawns gone, and no move after it.
 * - The Mammoth Slam (?power=slam: warned as turn 2 begins, at the start of his turn after your move): up to three of
 *   your pieces off the board, their shadows' sizes 1, 2, 3 over your next turns, back down as the turn after begins.
 *   (A Slam that lifts nothing, every lift past its cap, keeps the meter and comes again on his next turn: the test
 *   plays on until one lifts.)
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const fenNow = (p: Page) => p.evaluate(() => (window as any).match.phase.board.fen as string);

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
/** A good move now (the engine's, as the judge ranks them; never a promotion) that keeps the battle going and isn't one of `avoid`. */
async function goodMove(page: Page, avoid: (fen: string, move: string) => boolean = () => false): Promise<string> {
  await yourMove(page);
  const { fen, top } = await engineTop(page);
  const goesOn = (mv: string) => {
    const after = new Chess(fen);
    after.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] ?? "q" });
    return !after.isGameOver();
  };
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  return [...top.map((m) => m.move), ...legal].find((m) => !m.slice(4) && goesOn(m) && !avoid(fen, m))!;
}
/** The pieces drawn on the board now, by color and kind (what the app shows: ghosts and fading pieces aside). */
const drawn = (page: Page, color: "white" | "black", kind: string) => page.locator(`${BOARD_SEL.piece}.${color}.${kind}:not(.ghost):not(.fading)`).count();
/** The pieces a position has, by color and kind. */
const counted = (fen: string, color: "w" | "b", type: string) => new Chess(fen).board().flat().filter((p) => p && p.color === color && p.type === type).length;

test("Alfil's Tusks (the test switch): two of his pawns marked before his move, then the elephant on one of their squares as his move", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=alfil&wip=1&power=tusks&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.name).toBe("Alfil");
  expect(boss.powers.passive).toBe("tusks");
  const his = boss.crowdSide === "w" ? "b" : "w";
  /** Your move gives check (his turn must answer it: no cast, no fusion then). */
  const checks = (fen: string, m: string) => {
    const after = new Chess(fen);
    after.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
    return after.inCheck();
  };
  // Your first move (no check); his turn begins with the cast, then his move.
  await play(page, await goodMove(page, checks));
  await yourMove(page);
  const cast = await powers(page);
  expect(cast.tusks.pawns).toHaveLength(2);
  const fen1 = await fenNow(page);
  for (const sq of cast.tusks.pawns) expect(new Chess(fen1).get(sq as never)).toMatchObject({ color: his, type: "p" });
  // Your move is quiet: it takes nothing (no counter here, and his pieces as they were), gives no check (in check, the
  // fusion waits a turn) and leaves the fusion a square (fusionOptions: the rules' own list); his next turn is the fusion.
  const marked: string[] = cast.tusks.pawns;
  const bishops = counted(fen1, his, "b");
  const pawns = counted(fen1, his, "p");
  const plies = await page.evaluate(() => (window as any).match.phase.board.history.length as number);
  const loud = (fen: string, m: string) => {
    const after = new Chess(fen);
    return !!after.move({ from: m.slice(0, 2), to: m.slice(2, 4) }).captured || after.inCheck() || !fusionOptions(after.fen(), marked, his).length;
  };
  await play(page, await goodMove(page, loud));
  await yourMove(page);
  const fused = await powers(page);
  const fen2 = await fenNow(page);
  expect(fused.tusks).toBeNull();
  expect([...fused.fusion.from].sort()).toEqual([...marked].sort());
  // The elephant (uncountered, with a square allowed, it comes): a bishop of his on one of the two squares, and that
  // was his move: no move of his on the board since
  // yours, none shown, exactly two pawns fewer and a bishop more.
  expect(fused.fusion.why).toBeUndefined();
  expect(fused.fusion.from).toContain(fused.fusion.to);
  expect(fused.elephants).toEqual([fused.fusion.to]);
  expect(new Chess(fen2).get(fused.fusion.to as never)).toMatchObject({ color: his, type: "b" });
  expect(await page.evaluate(() => (window as any).match.phase.board.history.length)).toBe(plies + 1);
  expect(await page.evaluate(() => (window as any).match.boss.lastMove)).toBeNull();
  expect(counted(fen2, his, "b")).toBe(bishops + 1);
  expect(counted(fen2, his, "p")).toBe(pawns - 2);
  // The board draws the position: his bishops and pawns as the state has them.
  await expect.poll(() => drawn(page, his === "b" ? "black" : "white", "bishop")).toBe(counted(fen2, his, "b"));
  await expect.poll(() => drawn(page, his === "b" ? "black" : "white", "pawn")).toBe(counted(fen2, his, "p"));
  expect(errors).toEqual([]);
});

test("Alfil's Mammoth Slam (the test switch): your pieces up for three turns, their shadows growing, then back down", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=alfil&wip=1&power=slam&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const crowd: "w" | "b" = await page.evaluate(() => (window as any).match.boss.crowdSide);
  const you = crowd === "w" ? "white" : "black";
  await play(page, await goodMove(page));
  await yourMove(page);
  expect((await powers(page)).warned).toBe(true);
  let p: any = null;
  let at = 0;
  let before = new Chess();
  for (let tries = 1; tries <= 4 && !p?.ults; tries++) {
    if (tries > 1) {
      // (The last lifted nothing, every lift past the cap: the meter kept, nothing up; it comes again on his next turn.)
      expect(p.warned).toBe(true);
      expect(p.airborne).toEqual([]);
    }
    const mine = await goodMove(page);
    before = new Chess(await fenNow(page));
    before.move({ from: mine.slice(0, 2), to: mine.slice(2, 4) });
    at = await page.evaluate(() => (window as any).match.boss.crowdMoves + 1);
    await play(page, mine);
    // At the start of his turn, before his move: the Slam (this device's engines pick the lift), then his move.
    await yourMove(page);
    p = await powers(page);
  }
  expect(p.ults).toBe(1);
  expect(p.slam.at).toBe(at);
  expect(p.slam.lands).toBe(at + 1 + BOSS_POWERS.slamTurns);
  expect(p.slam.pieces.length).toBeGreaterThan(0);
  expect(p.slam.pieces.length).toBeLessThanOrEqual(BOSS_POWERS.slamPawns + BOSS_POWERS.slamMinors);
  for (const x of p.slam.pieces) {
    expect(["p", "n", "b"]).toContain(x.piece);
    expect(before.get(x.square as never)).toMatchObject({ color: crowd, type: x.piece });
  }
  expect(p.airborne.map((x: { square: string }) => x.square)).toEqual(p.slam.pieces.map((x: { square: string }) => x.square));
  const up: { piece: string; square: string }[] = p.slam.pieces;
  expect(up.length).toBeGreaterThan(0);
  // Three of your turns with them up: off the board (drawn and in the state), their shadows' sizes 1, 2, 3.
  const total = (fen: string) => (["p", "n", "b"] as const).reduce((t, k) => t + counted(fen, crowd, k), 0);
  for (let i = 0; i < BOSS_POWERS.slamTurns; i++) {
    await yourMove(page);
    const v = await powers(page);
    // (Down early: he had a mate in one only because they were up. Then they're back now.)
    if (v.landed?.early) break;
    expect(v.airborne.map((x: { stage: number }) => x.stage)).toEqual(up.map(() => i + 1));
    expect(v.airborne.map((x: { left: number }) => x.left)).toEqual(up.map(() => BOSS_POWERS.slamTurns - i));
    expect(v.paused).toBe(true);
    const fen = await fenNow(page);
    for (const k of ["pawn", "knight", "bishop"] as const) await expect.poll(() => drawn(page, you, k)).toBe(counted(fen, crowd, k[0] === "k" ? "n" : k[0]!));
    await play(page, await goodMove(page));
  }
  // Back down as your next turn begins: each on its own square, or the nearest one allowed.
  await yourMove(page);
  const down = await powers(page);
  const fen = await fenNow(page);
  expect(down.airborne).toEqual([]);
  expect(down.landed.pieces.map((x: { from: string }) => x.from).sort()).toEqual(up.map((x) => x.square).sort());
  for (const x of down.landed.pieces as { piece: string; from: string; to: string }[]) {
    const now = new Chess(fen).get(x.to as never);
    // (Unless his move since took it.)
    if (now) expect(now).toMatchObject({ color: crowd, type: x.piece });
  }
  expect(total(fen)).toBeGreaterThan(0);
  for (const k of ["pawn", "knight", "bishop"] as const) await expect.poll(() => drawn(page, you, k)).toBe(counted(fen, crowd, k[0] === "k" ? "n" : k[0]!));
  expect(errors).toEqual([]);
});
