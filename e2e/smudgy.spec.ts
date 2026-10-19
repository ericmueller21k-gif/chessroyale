import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * Smudgy (id smudgy; his rules built, his art not yet: met through the test link `?boss=smudgy&wip=1`), played alone,
 * the state read from the game (docs/decisions/2026-10-19-smudgy-rules.md). The wiring lane adds what the board shows
 * (the hidden rook drawn as a pawn, the paint, the strike).
 * - Camouflage: from the starting position, his first two moves are the forced pair (an end pawn two squares, then
 *   that side's rook out to its third rank), then the swap: a real pawn on the rook's square, the rook on one of his
 *   pawns' squares, its moment as your turn begins; his own moves only those two while they're due.
 * A move refused for the hidden rook ("paint") needs a position the opening never reaches (your king or a pinned piece
 * on its line): packages/chess/test/smudgy.test.ts and packages/server/test/smudgy-lobby.test.ts cover it, and the
 * wiring lane's e2e shows its words.
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

/** A quiet move of yours that keeps both his sides open (a knight first, never a d- or e-pawn), allowed now. */
function quiet(fen: string, allowed: string[] | null): string {
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion).map((m) => ({ uci: m.from + m.to, piece: m.piece, from: m.from }));
  const ok = legal.filter((m) => !allowed || allowed.includes(m.uci)).filter((m) => m.from[0] !== "d" && m.from[0] !== "e");
  return (ok.find((m) => m.piece === "n") ?? ok[0] ?? legal[0])!.uci;
}

test("Smudgy: his two forced moves, then the swap", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=smudgy&wip=1");
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
  expect(first.boss.id).toBe("smudgy");
  // From the starting position (his opening), you White.
  expect(first.fen.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  const start = first.history.length;

  // Your moves, until his two forced moves are played and the swap has come.
  for (let i = 0; i < 4; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers?.camo?.swap) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const s = await state(page);
  const camo = s.boss.powers.camo;
  expect(camo).toMatchObject({ step: 2, off: false });
  const side = camo.side as "a" | "h";
  // His two moves of the battle: the end pawn two squares, then the rook out through the gap.
  const his = s.history.slice(start).filter((_, i) => i % 2 === 1);
  expect(his.slice(0, 2)).toEqual([`${side}7${side}5`, `${side}8${side}6`]);
  // The swap: a real pawn on the rook's square, the rook hidden on one of his pawns' squares.
  expect(camo.swap.rook).toBe(`${side}6`);
  expect(camo.square).toBe(camo.swap.pawn);
  const board = new Chess(s.fen);
  expect(board.get(camo.swap.rook as never)).toMatchObject({ type: "p", color: "b" });
  expect(board.get(camo.square as never)).toMatchObject({ type: "r", color: "b" });
  await expect.poll(() => page.evaluate(() => (window as any).__kinds as string[]), { timeout: 10_000 }).toContain("camouflage");
  expect(errors).toEqual([]);
});
