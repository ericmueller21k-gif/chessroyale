import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { hoopStops, hoopsValid } from "@chessroyale/chess";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * The circus tiger (id tiger; his rules built, his art not yet: met through the test link `?boss=tiger&wip=1`), played
 * alone, the state read from the game (docs/decisions/2026-10-23-tiger-rules.md). The wiring lane adds what the screens
 * show (the pump, the balloons' flight and landing, the burning hoops) and its own visual e2e.
 * - Hoops (`&power=hoops`): at the start of his turn after the warning, his whole turn: blocks within ranks 2 to 7, apart,
 *   your allowed moves never crossing their walls, for exactly your next 2 moves, then gone (`hoopsOut`).
 * - Balloons (`&balloon=pawn&stage=4`: every balloon a pawn, ready as it goes on, from 1.e4 d5 2.exd5 Qxd5): at the end
 *   of his first turn it lands as his pawn, on a square you don't attack, with no check; its gain measured.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const state = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board?.fen as string, history: (m.phase.board?.history ?? []) as string[], boss: m.boss, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** A quiet move of yours, allowed now (a knight first). */
function quiet(fen: string, allowed: string[] | null): string {
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion).map((m) => ({ uci: m.from + m.to, piece: m.piece }));
  const ok = legal.filter((m) => !allowed || allowed.includes(m.uci));
  return (ok.find((m) => m.piece === "n") ?? ok[0] ?? legal[0])!.uci;
}

/** Every power event the boss view shows, watched every frame (a moment can come and go between two looks). */
async function watchKinds(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__kinds = [] as string[];
    const look = () => {
      for (const e of w.match?.boss?.powers?.events ?? []) if (!w.__kinds.includes(e.kind)) w.__kinds.push(e.kind);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const kinds = (page: Page) => page.evaluate(() => (window as any).__kinds as string[]);

test("the circus tiger: a hoops cast walls off its blocks for exactly two of your moves", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&wip=1&power=hoops");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watchKinds(page);
  const first = await state(page);
  expect(first.boss.id).toBe("tiger");
  // Your moves until he has cast (the warning as the second turn begins, the cast at the start of his turn after it).
  let before = first;
  for (let i = 0; i < 6; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.hoops) break;
    before = s;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const cast = await state(page);
  const hoops = cast.boss.powers.hoops;
  expect(hoops).toMatchObject({ left: BOSS_POWERS.hoopsCrowdMoves });
  expect(hoopsValid(hoops.blocks)).toBe(true);
  // His whole turn: no move of his after your last.
  expect(cast.history.length).toBe(before.history.length + 1);
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toContain("hoops");
  // Your first move: none you may play crosses a wall.
  const allowed1 = cast.allowed ?? new Chess(cast.fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  for (const m of allowed1) expect(hoopStops(m, cast.fen, hoops.blocks), m).toBe(false);
  const mine = quiet(cast.fen, cast.allowed);
  const c = new Chess(cast.fen);
  c.move({ from: mine.slice(0, 2), to: mine.slice(2, 4) });
  const beforeHis = c.fen();
  await submitMove(page, mine, cast.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  // Your second: still walled (his move between them too), one move left.
  await yourMove(page);
  const second = await state(page);
  expect(second.boss.powers.hoops).toEqual({ blocks: hoops.blocks, left: 1 });
  const his = second.history[second.history.length - 1]!;
  expect(hoopStops(his, beforeHis, hoops.blocks), his).toBe(false);
  for (const m of second.allowed ?? []) expect(hoopStops(m, second.fen, hoops.blocks), m).toBe(false);
  await submitMove(page, quiet(second.fen, second.allowed), second.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  // Gone as your second lands.
  await yourMove(page);
  const after = await state(page);
  expect(after.boss.powers.hoops).toBeNull();
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toContain("hoopsOut");
  expect(errors).toEqual([]);
});

test("the circus tiger: a forced balloon lands at the end of his turn as his pawn, on a square the guards allow, its gain measured", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&wip=1&balloon=pawn&stage=4");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watchKinds(page);
  const first = await state(page);
  expect(first.boss.id).toBe("tiger");
  // (From 1.e4 d5 2.exd5 Qxd5: a pawn gone from each side, so a pawn of his can land.)
  expect(first.history).toEqual(["e2e4", "d7d5", "e4d5", "d8d5"]);
  expect(first.boss.powers.balloon ?? null).toBeNull();
  await submitMove(page, quiet(first.fen, first.allowed), first.fen);
  await yourMove(page);
  const s = await state(page);
  const last = s.boss.powers.balloonLast;
  expect(last).toMatchObject({ outcome: "land", shape: "p" });
  const his = s.boss.crowdSide === "w" ? "b" : "w";
  expect(new Chess(s.fen).get(last.square)).toMatchObject({ type: "p", color: his });
  // (Its gain by this device's engines: in the band, or the nearest of the squares weighed, which the unit test checks
  // square by square (tiger.test.ts, landFrom); here, that it was measured, and the guards on the board as it is.)
  expect(typeof last.gain).toBe("number");
  // Never a square you attack: with the pawn taken off, none of your pieces attacks its square.
  const before = new Chess(s.fen);
  before.remove(last.square);
  expect(before.isAttacked(last.square, s.boss.crowdSide)).toBe(false);
  expect(new Chess(s.fen).inCheck()).toBe(false);
  expect(s.boss.powers.balloons).toMatchObject({ landed: 1, popped: 0 });
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toContain("balloonLand");
  expect(errors).toEqual([]);
});
