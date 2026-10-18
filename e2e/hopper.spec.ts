import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, test, bossAloneFromHome, engineTop } from "./helpers.ts";

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

/**
 * Their Carrot Patch, through the test switch (?power=carrotpatch: the battle starts from 1.e4 e5 2.Nf3 Nc6, your move,
 * the warning as the first turn begins): your first move (a quiet one), then the cast at the start of his turn (his
 * whole turn: the turn passes to you, the carrots planted, a base on the board), the race (you play the judge's best,
 * which weighs the carrots, so you pull them), the race over, and his spin with the prize on his side. Rules only: the
 * art is a later build, so this reads the battle's state (window.match), with real taps.
 */
test("Chub & Chirp's Carrot Patch (the test switch): the cast, the race's pulls, its end and his spin", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=hopper&wip=1&power=carrotpatch&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.powers.ultimate).toBe("carrotpatch");
  expect(boss.powers.warned).toBe(true);
  expect(boss.powers.carrots).toBeNull();
  const crowd: "w" | "b" = boss.crowdSide;
  const his = crowd === "w" ? "b" : "w";
  const plies = await page.evaluate(() => (window as any).match.phase.board.history.length as number);
  // (Watch from before his turn: the first frame the carrots are in the state, which phase it showed in, and the board then.)
  await page.evaluate(() => {
    const w = window as any;
    w.__castSeen = null;
    const look = () => {
      const m = w.match;
      const c = m?.boss?.powers?.carrots;
      if (!w.__castSeen && c) w.__castSeen = { phase: m.phase.kind, plies: m.boss.board.history.length, last: m.boss.lastMove, toMove: m.boss.board.fen.split(" ")[1], events: (m.boss.powers.events ?? []).map((e: { kind: string }) => e.kind) };
      if (!w.__castSeen) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  // (A quiet first move: passing after it costs him nothing, so the pass guard lets the cast come at once. After a move
  // like 3.d4, passing would lose real material, and it waits: docs/decisions/2026-10-18-turn-passing-guard.md.)
  await yourMove(page);
  await play(page, crowd === "w" ? "d2d3" : "d7d6");
  await yourMove(page);
  const seen = await page.evaluate(() => (window as any).__castSeen);
  // The cast was his whole turn: no move of his, the turn passed to you (the cast's moment on that screen), a base at its ply.
  expect(seen).toMatchObject({ phase: "boss", plies: plies + 1, last: null, toMove: crowd });
  expect(seen.events).toContain("carrots");
  const cast = await page.evaluate(() => (window as any).match.boss);
  expect(cast.powers.carrots.squares).toHaveLength(5);
  expect(cast.powers.carrots).toMatchObject({ at: 1, crowdLeft: 12, bossLeft: 12, over: null, spin: null });
  expect(cast.board.history).toHaveLength(plies + 1);
  expect(cast.board.bases.some((b: { ply: number }) => b.ply === plies + 1)).toBe(true);
  expect(cast.powers.rage).toBeNull();
  // The race: you play the judge's best move (it weighs the carrots), turn by turn, until it's over and he has spun.
  for (let turn = 0; turn < 14; turn++) {
    const c = await page.evaluate(() => (window as any).match.boss?.powers?.carrots);
    if (c.spin || c.over === "won") break;
    const top = await engineTop(page);
    await play(page, top.top[0]!.move);
    await expect.poll(() => page.evaluate(() => (window as any).match.phase.kind), { timeout: 90_000 }).toMatch(/^(play|results)$/);
    if ((await phase(page)) === "results") break;
  }
  const end = await page.evaluate(() => (window as any).match.boss);
  const c = end.powers.carrots;
  // A pull (yours or his), the race over, his spin rolled on his tier, the prize on his side of the board.
  expect(c.by.filter((x: string | null) => x).length).toBeGreaterThan(0);
  if (c.over === "won") {
    // (Rare: his race brain pulled all five before your judge's moves stopped him. The battle is his at once, with its
    // own line, and no spin.)
    expect(c.boss).toBe(5);
    expect(c.spin).toBeNull();
    await expect(page.locator(".team-result")).toHaveText(/won with their fifth carrot\./, { timeout: 30_000 });
    expect(errors).toEqual([]);
    return;
  }
  expect(c.over).toMatch(/^(pulled|moves)$/);
  expect(c.spin).toBeTruthy();
  expect(c.spin.tier).toBe(c.boss);
  const board = new Chess(end.board.fen);
  for (const sq of c.spin.squares) expect(board.get(sq as never)).toMatchObject({ color: his });
  expect(end.result ?? null).toBeNull();
  expect(errors).toEqual([]);
});
