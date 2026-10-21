import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * The hippo gardener (id gardener; his rules built, his art not yet: met through the test link `?boss=gardener&wip=1`),
 * played alone, the state read from the game (docs/decisions/2026-10-21-gardener-rules.md). The wiring lane adds what
 * the screens show (his seed meter, the toss, the watering's sweep and each outcome's board art, the plants).
 * - Seeds: five as the battle begins (`plantMany`), the meter's two numbers in the view.
 * - Watering with the test switches (`&power=water&seeds=10`): at the start of his turn after the warning, his whole turn:
 *   ten seeds rolled, each outcome where its rules allow it on the board, his gain under the band's top (unless the
 *   queen came up), the plain plants in the view blocking for 3 turns, the watering's moment as your turn begins.
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

test("the hippo gardener: his seeds, then a watering of ten seeds within the band", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=gardener&wip=1&power=water&seeds=10");
  await bossAloneFromHome(page);
  await yourMove(page);
  // Every power event the boss view shows, watched every frame.
  await page.evaluate(() => {
    const w = window as any;
    w.__kinds = [] as string[];
    const look = () => {
      for (const e of w.match?.boss?.powers?.events ?? []) if (!w.__kinds.includes(e.kind)) w.__kinds.push(e.kind);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  const first = await state(page);
  expect(first.boss.id).toBe("gardener");
  expect(first.fen.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  expect(first.boss.powers.garden).toMatchObject({ base: BOSS_POWERS.seedsAtStart, fixed: 10, plants: [], water: null, waterings: 0 });
  await expect.poll(() => page.evaluate(() => (window as any).__kinds as string[]), { timeout: 10_000 }).toContain("plantMany");

  // Your moves until he has watered (the warning as the second turn begins, the watering at the start of his turn after it).
  let before = first;
  for (let i = 0; i < 5; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.garden.waterings) break;
    before = s;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const s = await state(page);
  const g = s.boss.powers.garden;
  expect(g.waterings).toBe(1);
  const w = g.water;
  expect(w.seeds).toBe(10);
  expect(w.rolled).toHaveLength(10);
  expect(w.growth).toHaveLength(10);
  // His whole turn: no move of his after your last; your turn again.
  expect(s.history.length).toBe(before.history.length + 1);
  // Each outcome where its rules allow it.
  const board = new Chess(s.fen);
  const his = s.boss.crowdSide === "w" ? "b" : "w";
  for (const o of w.growth) {
    if (o.kind === "killer") expect(board.get(o.square)).toBeFalsy();
    else if (o.kind === "plant" || o.kind === "nothing") expect(board.get(o.square)).toBeFalsy();
    else expect(board.get(o.square)).toMatchObject({ type: o.kind, color: his });
  }
  // His gain by this device's engines: under the band's top, unless the queen came up (the jackpot).
  expect(w.gain).not.toBeNull();
  if (!w.jackpot) expect(w.gain).toBeLessThanOrEqual(BOSS_POWERS.waterBand[1]);
  // The plain plants in the view, each blocking for 3 turns from this one.
  expect(g.plants.map((p: { square: string }) => p.square).sort()).toEqual(w.growth.filter((o: { kind: string }) => o.kind === "plant").map((o: { square: string }) => o.square).sort());
  for (const p of g.plants) expect(p.left).toBe(BOSS_POWERS.plantTurns);
  for (const m of s.allowed ?? []) for (const p of g.plants) expect(m.slice(2, 4)).not.toBe(p.square);
  // The meter reset to none.
  expect(g.base).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__kinds as string[]), { timeout: 10_000 }).toContain("water");
  expect(errors).toEqual([]);
});
