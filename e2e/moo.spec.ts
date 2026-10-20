import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, test, bossAloneFromHome, submitMove } from "./helpers.ts";
import { REFUSED } from "../packages/app/src/refused.ts";

/**
 * Moo & Moon (id moo; his rules built, his art not yet: met through the test link `?boss=moo&wip=1`), played alone on
 * a phone, the state read from the game (docs/decisions/2026-10-20-moo-rules.md). The wiring lane adds what the board
 * shows (the beam, its glow, his Full Moon).
 * - Moonbeam: after his 3rd move a beam stuns one of your pieces (its moment as your turn begins): its moves are left out
 *   of your allowed moves, a tap that tries one is refused with the dock's words, and on your next turn it's free.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const state = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board?.fen as string, boss: m.boss, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null, stunned: (m.boss?.powers?.stunned ?? []) as string[] };
  });

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

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

/** A quiet move of yours, allowed now (no capture, no promotion; a knight's first). */
function quiet(fen: string, allowed: string[] | null): string {
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to, piece: m.piece, quiet: !m.captured && !m.promotion }));
  const ok = legal.filter((m) => !allowed || allowed.includes(m.uci));
  return (ok.find((m) => m.quiet && m.piece === "n") ?? ok.find((m) => m.quiet) ?? ok[0])!.uci;
}

test("Moo & Moon: a moonbeam stuns one of your pieces for your next turn", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=moo&wip=1");
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
  expect((await state(page)).boss.id).toBe("moo");

  // Your moves until his 3rd move has brought the beam (none before it).
  for (let i = 0; i < 3; i++) {
    await yourMove(page);
    const s = await state(page);
    expect(s.stunned).toEqual([]);
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const s = await state(page);
  expect(s.stunned).toHaveLength(1);
  const sq = s.stunned[0]!;
  const board = new Chess(s.fen);
  const piece = board.get(sq as never) as { color: string; type: string } | undefined;
  expect(piece?.color).toBe(s.boss.crowdSide);
  expect(piece?.type).not.toBe("k");
  await expect.poll(() => page.evaluate(() => (window as any).__kinds as string[]), { timeout: 10_000 }).toContain("moonbeam");
  // Its moves are legal in chess but not allowed this turn.
  const its = board.moves({ verbose: true }).filter((m) => m.from === sq).map((m) => m.from + m.to);
  expect(its.length).toBeGreaterThan(0);
  expect(s.allowed).not.toBeNull();
  expect(s.allowed!.some((m) => m.startsWith(sq))).toBe(false);
  // A tap that tries one: it stays where it was, and the dock says why.
  await tap(page, its[0]!.slice(0, 2));
  await tap(page, its[0]!.slice(2, 4));
  await expect(page.locator(".boss-dock .refused-note")).toHaveText(REFUSED.stunned);
  expect(await phase(page)).toBe("play");
  expect(await page.evaluate(() => (window as any).match.phase.board.fen)).toBe(s.fen);

  // Another move; on your next turn the piece is free (his 4th move brings no beam).
  await submitMove(page, quiet(s.fen, s.allowed), s.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  await yourMove(page);
  const t = await state(page);
  expect(t.stunned).toEqual([]);
  expect(t.allowed).toBeNull();
  expect(errors).toEqual([]);
});
