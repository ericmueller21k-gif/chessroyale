import { expect, type Page } from "@playwright/test";
import { Chess, type Square } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { crossesCrease } from "@chessroyale/chess";
import { BOARD_SEL, test, bossAloneFromHome, submitMove } from "./helpers.ts";
import { REFUSED } from "../packages/app/src/refused.ts";

/**
 * Folio, the paper crane (its rules built, its art not yet: met through the test link `?boss=folio&wip=1`), played alone,
 * the state read from the game (docs/decisions/2026-10-27-folio-rules.md). The wiring lane adds what the screens show
 * (the ink, the fold, the crease, the crossing out) and its own visual e2e.
 * - Draft (`&power=draft`: from turn 2, again every turn once a mark is gone): a mark you leave standing for your two moves
 *   folds the piece; its moves are refused, and the dock says why.
 * - Crease (`&power=crease`): its line shown with the warning, then four turns no move crosses it; yours refused with why.
 * - Revision (`&power=revision`): after your fifth move, both moves crossed out, the board back, its move in their place.
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

/** Your quiet moves allowed now (no capture, no promotion, no check), knights first; `keep` filters them. */
function quiet(fen: string, allowed: string[] | null, keep: (m: string) => boolean = () => true): string {
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion && !m.san.includes("+")).map((m) => ({ uci: m.from + m.to, piece: m.piece }));
  const ok = legal.filter((m) => (!allowed || allowed.includes(m.uci)) && keep(m.uci));
  const any = legal.filter((m) => !allowed || allowed.includes(m.uci));
  return (ok.find((m) => m.piece === "n") ?? ok[0] ?? any[0] ?? legal[0])!.uci;
}

async function play(page: Page, move: string, fen: string) {
  await submitMove(page, move, fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
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

async function tap(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  await page.mouse.click(board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8));
}

/** A legal move tapped that the turn doesn't allow: it stays put, and the dock says `why`. */
async function refused(page: Page, fen: string, move: string, why: string) {
  await tap(page, move.slice(0, 2));
  await tap(page, move.slice(2, 4));
  await expect(page.locator(".boss-dock .refused-note")).toHaveText(why);
  expect(await phase(page)).toBe("play");
  expect(await page.evaluate(() => (window as any).match.phase.board.fen)).toBe(fen);
}

test("Folio's Draft: a mark left standing for your two moves folds the piece; its moves are refused, and the dock says why", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio&wip=1&power=draft");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watchKinds(page);
  expect((await state(page)).boss.id).toBe("folio");
  let folded: { fen: string; square: string; allowed: string[] | null } | null = null;
  for (let i = 0; i < 30 && !folded; i++) {
    await yourMove(page);
    const s = await state(page);
    const p = s.boss.powers;
    if (p.folded?.length) {
      folded = { fen: s.fen, square: p.folded[0], allowed: s.allowed };
      break;
    }
    // A mark up: a move that leaves its attack standing (not the piece, not the line, not the attacker).
    const mark = p.draft as { square: string; attacker: string } | null;
    const keeps = (m: string) => {
      if (!mark) return true;
      const c = new Chess(s.fen);
      c.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
      return c.attackers(mark.square as Square, s.boss.crowdSide === "w" ? "b" : "w").includes(mark.attacker as Square);
    };
    await play(page, quiet(s.fen, s.allowed, keeps), s.fen);
  }
  expect(folded, "a fold within 30 moves").not.toBeNull();
  expect(await kinds(page)).toEqual(expect.arrayContaining(["draft", "fold"]));
  // Its moves aren't yours to play while it's folded; a tap on one is refused, and the dock says why.
  const own = new Chess(folded!.fen).moves({ verbose: true }).filter((m) => m.from === folded!.square && !m.promotion);
  for (const m of own) expect(folded!.allowed ?? [], m.from + m.to).not.toContain(m.from + m.to);
  if (own.length) await refused(page, folded!.fen, own[0]!.from + own[0]!.to, REFUSED.folded);
  expect(errors).toEqual([]);
});

test("Folio's Crease: its line shown with the warning, then for four turns no move crosses it; yours refused with why; then it unfolds", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio&wip=1&power=crease");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watchKinds(page);
  let line: string | null = null;
  let tried = false;
  let held = 0;
  for (let i = 0; i < 10; i++) {
    await yourMove(page);
    const s = await state(page);
    const p = s.boss.powers;
    if (p.creaseNext) line = p.creaseNext;
    if (p.crease) {
      expect(p.crease.line).toBe(line);
      held++;
      for (const m of s.allowed ?? []) expect(crossesCrease(m, p.crease.line, s.fen), m).toBe(false);
      const across = new Chess(s.fen).moves({ verbose: true }).find((m) => crossesCrease(m.from + m.to, p.crease.line, s.fen) && !m.promotion);
      if (!tried && across && s.allowed) {
        tried = true;
        await refused(page, s.fen, across.from + across.to, REFUSED.crease);
      }
    } else if (held) break;
    await play(page, quiet(s.fen, s.allowed), s.fen);
  }
  expect(line).not.toBeNull();
  expect(held).toBe(BOSS_POWERS.creaseTurns);
  expect(tried).toBe(true);
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toEqual(expect.arrayContaining(["warn", "creaseWarn", "crease", "creaseEnd"]));
  expect(errors).toEqual([]);
});

test("Folio's Revision: after your fifth move both moves are crossed out, the board goes back, and its move comes in their place", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio&wip=1&power=revision");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watchKinds(page);
  let fourth: { fen: string; history: string[] } | null = null;
  for (let i = 0; i < 5; i++) {
    await yourMove(page);
    const s = await state(page);
    expect(s.boss.powers.revision ?? null).toBeNull();
    if (i === 4) fourth = { fen: s.fen, history: s.history };
    await play(page, quiet(s.fen, s.allowed), s.fen);
  }
  await yourMove(page);
  const after = await state(page);
  const r = after.boss.powers.revision;
  expect(r).toMatchObject({ at: 5 });
  // Crossed out: its fourth move and your fifth; the board back to before its fourth, then its move in their place.
  const n = fourth!.history.length;
  expect(r.moves).toEqual([fourth!.history[n - 1], after.history[n]]);
  expect(after.history).toHaveLength(n + 2);
  expect(r.move).toBe(after.history[n + 1]);
  // (Its move in their place was legal from the position before its fourth: the battle's moves up to it, then this one.)
  const replay = new Chess();
  for (const m of fourth!.history.slice(0, n - 1)) replay.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  replay.move({ from: r.move.slice(0, 2), to: r.move.slice(2, 4), promotion: r.move[4] });
  expect(replay.fen().split(" ").slice(0, 4)).toEqual(after.fen.split(" ").slice(0, 4));
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toContain("revision");
  expect(errors).toEqual([]);
});
