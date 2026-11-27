import { describe, expect, it } from "vitest";
import { BATTLE_TOWER, BOSS_POWERS, BOSS_ROSTER, bossDef, canPick, chooseBoss, finishFloor, floorBoss, isPlayable, mulberry32, newRun, startFloor, towerPool, unlockBosses, unlockedBosses, type BossDef } from "@chessroyale/core";
import { MatchRunner, POWER_FX, bossRules, icedSquares, burnJudged, burnLoss, chooseStrike, crowdAllowed, frostfireOutcome, legalMoves, pieceAt, prepareTurn, triggerUltimate, type EngineLike } from "../src/index.ts";
import { KIT_OPENING, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * The Stranger's rules (docs/decisions/2026-11-27-stranger-rules.md; bosses/stranger.ts): his Frostfire strike (its pick, the freeze for
 * one turn, the flee turn, the burn of whatever is on the tile, never a king, the judge's view), the placeholder ultimate that never
 * fires, and his Battle Tower floors and unlock (core tower.ts).
 */

const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const strangerOf = (r: MatchRunner) => r.boss!.powers!.stranger ?? null;

function battle(seed = 7, side: "w" | "b" = "w", test = "", engines: EngineLike[] = [fakeEngine()]) {
  const settings = kitSettings({ boss: "stranger", test, maxMoves: 60 });
  return new MatchRunner({ settings: { ...settings, bossUnfinished: true }, rng: mulberry32(seed), engines, library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: side });
}

async function crowdMove(r: MatchRunner, pick?: (fen: string, allowed: string[]) => string) {
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = pick ? pick(fen, allowed) : [...allowed].sort()[0]!;
  return r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}

/** Plays until the crowd's turn `turn` has been dealt, the crowd picking `pick` (the first allowed move without one). */
async function untilTurn(r: MatchRunner, turn: number, pick?: (fen: string, allowed: string[]) => string) {
  for (let i = 0; i < 80 && !r.stageComplete(); i++) {
    if (r.bossToMove()) {
      await r.playBoss();
      continue;
    }
    r.deal();
    if (r.boss!.crowdMoves + 1 >= turn) return;
    await crowdMove(r, pick);
  }
}

describe("the Frostfire strike's pick", () => {
  it("your most valuable piece but the king; ties the most central, then the seed", () => {
    // White (the crowd): queen a1, rooks d4 and h1, king e1: the queen is the most valuable.
    expect(chooseStrike("4k3/8/8/8/3R4/8/8/Q3K2R w - - 0 1", "w", 1, 3)).toEqual({ square: "a1", piece: "q" });
    // Two rooks: d4 is more central than h1.
    expect(chooseStrike("4k3/8/8/8/3R4/8/8/4K2R w - - 0 1", "w", 1, 3)).toEqual({ square: "d4", piece: "r" });
    // Never the king: a bare king has nothing to strike.
    expect(chooseStrike("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "w", 1, 3)).toBeNull();
  });

  it("never a piece whose burning would be illegal now (its king's last shield), nor one whose freeze leaves no move", () => {
    // The e2 rook stands between your e1 king and his e8 rook: burning it would open your king; the a3 knight is struck instead.
    expect(chooseStrike("4r1k1/8/8/8/8/N7/4R3/4K3 w - - 0 1", "w", 1, 3)).toEqual({ square: "a3", piece: "n" });
    // Your only move is the h-pawn's (king boxed in by his rook): freezing it would leave none, so nothing is struck.
    expect(chooseStrike("6k1/8/8/8/8/6rp/7P/7K w - - 0 1", "w", 1, 3)).toBeNull();
  });
});

describe("the burn on its tile", () => {
  it("burns whatever stands there, either side's; spares a king; nothing there, nothing", () => {
    // Him (Black) to move: your d4 knight on the tile burns.
    const fen = "4k3/8/8/8/3N4/8/8/4K3 b - - 0 1";
    const out = frostfireOutcome(fen, "d4")!;
    expect(out.spared).toBeUndefined();
    expect([out.piece, out.side]).toEqual(["n", "w"]);
    expect(pieceAt(out.fen, "d4")).toBeNull();
    // His own piece left on the tile burns too ("whatever's on it").
    const his = frostfireOutcome("4k3/8/8/8/3n4/8/8/4K3 b - - 0 1", "d4")!;
    expect([his.piece, his.side, his.spared]).toEqual(["n", "b", undefined]);
    // A king on the tile: spared, the board unchanged.
    expect(frostfireOutcome("4k3/8/8/8/3K4/8/8/8 b - - 0 1", "d4")).toMatchObject({ piece: "k", spared: true, fen: "4k3/8/8/8/3K4/8/8/8 b - - 0 1" });
    expect(frostfireOutcome(fen, "c3")).toBeNull();
  });

  it("spares a piece whose loss would leave your king open to his piece", () => {
    // Your e2 knight shields your e1 king from his e8 rook; him to move: burning it would leave the side not to move in check.
    const out = frostfireOutcome("4r1k1/8/8/8/8/8/4N3/4K3 b - - 0 1", "e2")!;
    expect(out.spared).toBe(true);
  });

  it("the judge counts a piece left on the tile as gone, and one moved off it as saved", () => {
    const fen = "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1";
    expect(burnLoss(fen, "e1e2", "d4", "w")).toBe(3);
    expect(burnLoss(fen, "d4f5", "d4", "w")).toBe(0);
    const evaluation = { bestMove: "e1e2", bestExpected: 0.6, expectedAfter: { e1e2: 0.6, d4f5: 0.55 } };
    const judged = burnJudged(evaluation, fen, "d4", "w");
    expect(judged.bestMove).toBe("d4f5");
    expect(judged.expectedAfter.e1e2!).toBeLessThan(0.6);
  });
});

describe("the strike in a battle: frozen a turn, thawed a turn, then the tile burns", () => {
  it("comes with his move as crowd turn strikeFrom begins; the piece can't move that turn, can the next; then the burn", async () => {
    const r = battle(11, "w");
    const s = BOSS_POWERS.stranger;
    await untilTurn(r, s.strikeFrom);
    const st = strangerOf(r)!.strike!;
    expect(st).toMatchObject({ turn: s.strikeFrom, frozenUntil: s.strikeFrom, burnAt: s.strikeFrom + 1 });
    expect(r.boss!.powers!.events.some((e) => e.kind === "frostfire" && e.square === st.square)).toBe(true);
    // Frozen: no move of it allowed this turn; its ice shown.
    const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
    expect(allowed.some((m) => m.startsWith(st.square))).toBe(false);
    expect(icedSquares(r.boss, fenOf(r))).toContain(st.square);
    await crowdMove(r);
    await r.playBoss();
    // The flee turn: thawed (it may move), no ice; the judge weighs the tile.
    r.deal();
    if (pieceAt(fenOf(r), st.square)?.color === "w") {
      const now = r.crowdAllowed() ?? legalMoves(fenOf(r));
      expect(now.some((m) => m.startsWith(st.square)) || !legalMoves(fenOf(r)).some((m) => m.startsWith(st.square))).toBe(true);
    }
    expect(icedSquares(r.boss, fenOf(r))).not.toContain(st.square);
    // Leave it there (a move of another piece): the burn takes it as the move lands.
    const before = pieceAt(fenOf(r), st.square);
    await crowdMove(r, (_fen, ms) => ms.filter((m) => !m.startsWith(st.square)).sort()[0] ?? ms[0]!);
    const burn = strangerOf(r)!.burn!;
    expect(burn.at).toBe(st.burnAt);
    expect(strangerOf(r)!.strike).toBeNull();
    if (before && before.type !== "k" && !burn.spared) expect(pieceAt(fenOf(r), st.square)).toBeNull();
    expect(r.boss!.powers!.events.some((e) => e.kind === "frostfireBurn" && e.square === st.square)).toBe(true);
  });

  it("a piece moved off on the flee turn is saved: the tile burns empty", async () => {
    const r = battle(5, "w", "frostfire");
    await untilTurn(r, 2);
    const st = strangerOf(r)!.strike!;
    expect(st.turn).toBe(2);
    await crowdMove(r);
    await r.playBoss();
    r.deal();
    const fen = fenOf(r);
    const off = (r.crowdAllowed() ?? legalMoves(fen)).filter((m) => m.startsWith(st.square) && pieceAt(fen, st.square)?.color === "w");
    if (!off.length) return;
    const kind = pieceAt(fen, st.square)!.type;
    await crowdMove(r, () => off.sort()[0]!);
    const burn = strangerOf(r)!.burn!;
    expect(burn.piece).toBeUndefined();
    expect(pieceAt(fenOf(r), off.sort()[0]!.slice(2, 4))?.type).toBe(kind);
  });

  it("the frozen turn and the flee turn are power turns (no fair-play signal, no Last Stand)", async () => {
    const r = battle(11, "w");
    await untilTurn(r, BOSS_POWERS.stranger.strikeFrom);
    expect(bossRules(r.boss)!.powerTurn!(r.boss!)).toBe(true);
  });

  it("the test switch strikes from his first move, again once the last has burnt", async () => {
    const r = battle(3, "w", "frostfire");
    await untilTurn(r, 2);
    expect(strangerOf(r)!.strike?.turn).toBe(2);
    expect(strangerOf(r)!.next).toBe(4);
  });
});

describe("his ultimate: a placeholder that never fires (Eric's comes next)", () => {
  it("the admins' trigger is taken and waits; no ultimate comes", async () => {
    const r = battle(9, "w", "strangerult");
    await untilTurn(r, 4);
    const t = triggerUltimate(r.boss);
    expect(t.ok).toBe(true);
    expect(r.boss!.powers!.ultAt).toBeUndefined();
    expect(r.boss!.powers!.ults ?? 0).toBe(0);
    expect(POWER_FX.frostfire).toBeGreaterThan(0);
  });
});

describe("his Battle Tower floors and unlock", () => {
  const ready: BossDef[] = BOSS_ROSTER.map((b) => (b.id === "stranger" ? { ...b, kit: "The Stranger" } : b));

  it("never at random, never in a deck; on floors 10, 30 and 50 alone once ready, else those floors deal as ever", () => {
    const def = bossDef("stranger")!;
    expect(isPlayable(def)).toBe(false);
    for (let i = 0; i < 40; i++) expect(chooseBoss(i / 40).id).not.toBe("stranger");
    // (No art yet: not in the pool, his floors deal as any other.)
    expect(towerPool()).not.toContain("stranger");
    expect(floorBoss(10, towerPool())).toBeNull();
    // Ready (his art in): in the pool for his floors only.
    const pool = towerPool(undefined, ready);
    expect(pool).toContain("stranger");
    let run = newRun(77, pool);
    for (let f = 1; f < 52; f++) {
      const ids = run.floors[f - 1]!;
      if (BATTLE_TOWER.bossFloors[f]) expect(ids, `floor ${f}`).toEqual(["stranger"]);
      else expect(ids, `floor ${f}`).not.toContain("stranger");
      const start = startFloor(run, pool)!;
      expect(start.run.floors[f - 1]).toEqual(ids);
      run = finishFloor(start.run, "won", pool);
    }
    // Resting (a kill switch): his floor deals two bosses from the deck, as the pattern says.
    const off = towerPool(["stranger"], ready);
    let r2 = newRun(77, off);
    for (let f = 1; f < 10; f++) r2 = finishFloor(startFloor(r2, off)!.run, "won", off);
    expect(r2.floors[9]).toHaveLength(2);
    expect(r2.floors[9]).not.toContain("stranger");
  });

  it("a test's server (unfinished) meets him before his art", () => {
    expect(towerPool(undefined, BOSS_ROSTER, true)).toContain("stranger");
    expect(unlockBosses(BOSS_ROSTER, true).map((b) => b.id)).toEqual(["stranger"]);
    expect(unlockBosses()).toEqual([]);
  });

  it("unlocked by a best of floor 10 or more, solo or party; picked only then", () => {
    expect(unlockedBosses(9)).toEqual([]);
    expect(unlockedBosses(10)).toEqual(["stranger"]);
    expect(unlockedBosses(31)).toEqual(["stranger"]);
    const def = ready.find((b) => b.id === "stranger")!;
    expect(canPick(def, [])).toBe(false);
    expect(canPick(def, unlockedBosses(10))).toBe(true);
    expect(canPick(bossDef("gingerbread"), [])).toBe(true);
  });
});

describe("the strike's state survives a turn's set-up untouched when nothing is due", () => {
  it("prepareTurn before strikeFrom: no strike, no event", async () => {
    const r = battle(2, "w");
    r.deal();
    const p = prepareTurn(r.boss!, fenOf(r));
    expect(p?.powers?.stranger?.strike ?? null).toBeNull();
    expect(crowdAllowed(r.boss, fenOf(r))).toBeNull();
  });
});
