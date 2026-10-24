import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { boardAltered } from "@chessroyale/chess";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * The God King's Last Stand sits out while a boss's power has changed the board (Eric, Oct 24: inside Babur's burning
 * hoop his save took back a capture, fearing a recapture the walls forbid; docs/decisions/2026-10-24-king-save-off-on-
 * altered-boards.md). Babur alone (`?power=hoops`): once the hoops are up, every move is made one the save would take
 * back (the bar set to nothing in the runner's settings), yet the two moves inside the walls stand, a capture within a
 * ring first when there is one; once the hoops are out he saves the next move. Watched every frame: no Last Stand while
 * the walls stand.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const state = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return {
      fen: m.phase.board?.fen as string,
      history: (m.phase.board?.history ?? []) as string[],
      boss: m.runner.state.boss,
      allowed: (m.boss?.powers?.allowed ?? null) as string[] | null,
    };
  });

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

const allowedOf = (fen: string, allowed: string[] | null) =>
  new Chess(fen)
    .moves({ verbose: true })
    .map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), from: m.from, to: m.to, captured: !!m.captured, piece: m.piece }))
    .filter((m) => !allowed || allowed.includes(m.uci));

/** A quiet move of yours, allowed now (a knight first). */
const quiet = (fen: string, allowed: string[] | null) => {
  const ok = allowedOf(fen, allowed).filter((m) => !m.captured && !m.uci[4]);
  return (ok.find((m) => m.piece === "n") ?? ok[0] ?? allowedOf(fen, allowed)[0])!.uci;
};

/** The hoop (2x2 block, named by its lowest file and rank) a square is in, or null. */
const ringOf = (sq: string, blocks: readonly string[]) =>
  blocks.find((c) => {
    const df = sq.charCodeAt(0) - c.charCodeAt(0);
    const dr = Number(sq[1]) - Number(c[1]);
    return df >= 0 && df <= 1 && dr >= 0 && dr <= 1;
  }) ?? null;

/** Every frame: was the Last Stand on screen. */
async function watchStand(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__stand = false;
    const look = () => {
      if (document.querySelector(".last-stand")) w.__stand = true;
      requestAnimationFrame(look);
    };
    look();
  });
}
const standSeen = (page: Page) => page.evaluate(() => (window as any).__stand as boolean);

test("Babur's hoops: a move the God King would save stands inside the walls, a capture within a ring first; once they're out he saves the next", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (?laststand=0 until the hoops are up: no save on the way there.)
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&power=hoops");
  await bossAloneFromHome(page);
  for (let i = 0; i < 6; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.hoops) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const cast = await state(page);
  const blocks: string[] = cast.boss.powers.hoops.blocks;
  expect(blocks.length).toBeGreaterThan(0);
  // From here every move the crowd plays calls for him, whatever it gives away: the bar at nothing, never "already lost".
  await page.evaluate(() => {
    const r = (window as any).match.runner;
    r.opts.settings = { ...r.opts.settings, lastStandFrom: 0, lastStandLoss: 0, lastStandLossFloor: 0, lastStandChargedExtra: 0 };
  });
  await watchStand(page);

  // The two moves inside the walls: each stands, his charges and his fall untouched.
  let rings = 0;
  for (let i = 0; i < 2; i++) {
    if (i) await yourMove(page);
    const s = await state(page);
    expect(s.boss.powers.hoops, "the walls stand").toBeTruthy();
    expect(boardAltered(s.boss, s.fen)).toBe(true);
    const ring = allowedOf(s.fen, s.allowed).find((m) => m.captured && ringOf(m.from, blocks) && ringOf(m.from, blocks) === ringOf(m.to, blocks));
    if (ring) rings++;
    const mine = ring?.uci ?? quiet(s.fen, s.allowed);
    await submitMove(page, mine, s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
    await yourMove(page);
    const after = await state(page);
    expect(after.history.slice(s.history.length, s.history.length + 1), "your move stood").toEqual([mine]);
    expect(after.boss.lastStand ?? null).toBeNull();
    expect(after.boss.barred ?? null).toBeNull();
    expect(after.boss.kingCharges).toBe(cast.boss.kingCharges);
    expect(await standSeen(page), "no Last Stand inside the walls").toBe(false);
  }
  test.info().annotations.push({ type: "captures within a ring", description: String(rings) });

  // The hoops are out: the next move on a plain board calls him (a quiet move first if another power is on).
  let saved = false;
  for (let i = 0; i < 4 && !saved; i++) {
    const s = await state(page);
    if (i === 0) expect(s.boss.powers.hoops ?? null, "the hoops out").toBeNull();
    const plain = !boardAltered(s.boss, s.fen);
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    if (plain) {
      await expect(page.locator(".last-stand")).toBeVisible({ timeout: 30_000 });
      await yourMove(page);
      const back = await state(page);
      expect(back.fen, "the move taken back").toBe(s.fen);
      expect(back.boss.lastStand).toBeTruthy();
      saved = true;
    } else {
      await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
      await yourMove(page);
    }
  }
  expect(saved, "he saves again once the board is plain").toBe(true);
  expect(errors).toEqual([]);
});
