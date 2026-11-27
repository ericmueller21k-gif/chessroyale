import { describe, expect, it } from "vitest";
import { BATTLE_TOWER, BOSS_POWERS, BOSS_ROSTER, adminFirst, adminFirstBosses, bossDef, canPick, chooseBoss, finishFloor, floorBoss, floorUnlocks, isPlayable, menuBosses, mulberry32, newRun, startFloor, towerPool, unlockBosses, unlockFloor, unlockReady, type BossDef } from "@chessroyale/core";
import { FINISHERS, FINISHER_TEST, MatchRunner, POWER_FX, STRANGER_FX, bossRules, finisherOf, icedSquares, burnJudged, burnLoss, chooseStrike, crowdAllowed, frostfireOutcome, legalMoves, pieceAt, prepareTurn, triggerUltimate, type EngineLike } from "../src/index.ts";
import { KIT_OPENING, fakeEngine, kitSettings } from "./boss-kit-lib.ts";
import { powerRoll } from "../src/bosses/base.ts";

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

/** A crowd that opens its queen's diagonal first (e2, then d2), so the piece he strikes (the queen) has a move off its tile. */
const OPENERS = ["e2e4", "e2e3", "d2d4", "d2d3"];
const opener = (_fen: string, allowed: string[]) => OPENERS.find((m) => allowed.includes(m)) ?? [...allowed].sort()[0]!;

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

  it("spares his own piece pinned to his king: the gap would check him (the review of #1000, S2)", () => {
    // His e7 knight on the tile, pinned to his e8 king by your e1 rook; him to move: burning it would check him through the gap.
    const fen = "4k3/4n3/8/8/8/8/8/4R1K1 b - - 0 1";
    expect(frostfireOutcome(fen, "e7")).toMatchObject({ piece: "n", side: "b", spared: true, fen });
  });

  it("never strikes your piece on your back rank with his pawn right behind it: the burn would hand him the promotion", () => {
    // Your e1 queen, his e2 pawn behind it (burning e1 would let it promote there): the a3 knight is struck instead.
    expect(chooseStrike("4k3/8/8/8/8/N7/4p3/K3Q3 w - - 0 1", "w", 1, 3)).toEqual({ square: "a3", piece: "n" });
  });

  it("no strike, and no event, when its burn would fall at the move cap (no burn comes then)", async () => {
    // (The test switch strikes as crowd turn 2 begins, its burn on turn 3.)
    const capped = (maxMoves: number) => new MatchRunner({ settings: kitSettings({ boss: "stranger", test: "frostfire", maxMoves }), rng: mulberry32(5), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });
    const open = capped(4);
    await untilTurn(open, 2, opener);
    expect(strangerOf(open)!.strike).toMatchObject({ turn: 2, burnAt: 3 });
    const last = capped(3);
    await untilTurn(last, 2, opener);
    expect(last.boss!.crowdMoves + 1).toBe(2);
    expect(strangerOf(last)?.strike ?? null).toBeNull();
    expect(last.boss!.powers!.events.some((e) => e.kind === "frostfire")).toBe(false);
    expect(bossRules(last.boss)!.powerTurn!(last.boss!)).toBe(false);
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
    await untilTurn(r, s.strikeFrom, opener);
    const st = strangerOf(r)!.strike!;
    expect(st).toMatchObject({ turn: s.strikeFrom, frozenUntil: s.strikeFrom, burnAt: s.strikeFrom + 1 });
    expect(r.boss!.powers!.events.some((e) => e.kind === "frostfire" && e.square === st.square)).toBe(true);
    // Frozen: no move of it allowed this turn; its ice shown.
    const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
    expect(allowed.some((m) => m.startsWith(st.square))).toBe(false);
    expect(icedSquares(r.boss, fenOf(r))).toContain(st.square);
    await crowdMove(r, opener);
    await r.playBoss();
    // The flee turn: thawed (it may move), no ice; the judge weighs the tile.
    r.deal();
    const before = pieceAt(fenOf(r), st.square);
    expect(before?.color, "the struck piece still there, yours").toBe("w");
    expect((r.crowdAllowed() ?? legalMoves(fenOf(r))).some((m) => m.startsWith(st.square))).toBe(true);
    expect(icedSquares(r.boss, fenOf(r))).not.toContain(st.square);
    // Leave it there (a move of another piece): the burn takes it as the move lands.
    await crowdMove(r, (_fen, ms) => ms.filter((m) => !m.startsWith(st.square)).sort()[0]!);
    const burn = strangerOf(r)!.burn!;
    expect(burn).toMatchObject({ at: st.burnAt, square: st.square, piece: before!.type, side: "w" });
    expect(burn.spared).toBeUndefined();
    expect(strangerOf(r)!.strike).toBeNull();
    expect(pieceAt(fenOf(r), st.square)).toBeNull();
    expect(r.boss!.powers!.events.some((e) => e.kind === "frostfireBurn" && e.square === st.square)).toBe(true);
  });

  it("a piece moved off on the flee turn is saved: the tile burns empty", async () => {
    const r = battle(5, "w", "frostfire");
    await untilTurn(r, 2, opener);
    const st = strangerOf(r)!.strike!;
    expect(st.turn).toBe(2);
    await crowdMove(r, opener);
    await r.playBoss();
    r.deal();
    const fen = fenOf(r);
    expect(pieceAt(fen, st.square)?.color, "the struck piece still there, yours").toBe("w");
    const off = (r.crowdAllowed() ?? legalMoves(fen)).filter((m) => m.startsWith(st.square)).sort();
    expect(off.length, "a move off its tile").toBeGreaterThan(0);
    const kind = pieceAt(fen, st.square)!.type;
    await crowdMove(r, () => off[0]!);
    const burn = strangerOf(r)!.burn!;
    expect(burn).toMatchObject({ at: st.burnAt, square: st.square });
    expect(burn.piece).toBeUndefined();
    expect(pieceAt(fenOf(r), off[0]!.slice(2, 4))?.type).toBe(kind);
  });

  it("the frozen turn and the flee turn are power turns (no fair-play signal, no Last Stand); the turn after isn't", async () => {
    const r = battle(11, "w");
    const s = BOSS_POWERS.stranger;
    await untilTurn(r, s.strikeFrom);
    expect(bossRules(r.boss)!.powerTurn!(r.boss!), "the frozen turn").toBe(true);
    await untilTurn(r, s.strikeFrom + 1);
    expect(bossRules(r.boss)!.powerTurn!(r.boss!), "the flee turn").toBe(true);
    await untilTurn(r, s.strikeFrom + 2);
    expect(strangerOf(r)!.strike).toBeNull();
    expect(bossRules(r.boss)!.powerTurn!(r.boss!), "the turn after the burn").toBe(false);
  });

  it("the test switch strikes from his first move, then again on the turn after the burn", async () => {
    const r = battle(3, "w", "frostfire");
    await untilTurn(r, 2);
    expect(strangerOf(r)!.strike?.turn).toBe(2);
    expect(strangerOf(r)!.next).toBe(4);
    await untilTurn(r, 4);
    expect(strangerOf(r)!.burn?.at).toBe(3);
    expect(strangerOf(r)!.strike?.turn).toBe(4);
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
  it("never at random, never in a deck; on floors 10, 30 and 50 alone for an admin's climb (admins first), else those floors deal as ever", () => {
    const def = bossDef("stranger")!;
    expect(def.kit).toBe("Stranger");
    expect(isPlayable(def)).toBe(false);
    for (let i = 0; i < 40; i++) expect(chooseBoss(i / 40).id).not.toBe("stranger");
    // (Admins first, Nov 27: a player's climb never meets him, his floors deal as any other.)
    expect(adminFirst(def)).toBe(true);
    expect(towerPool()).not.toContain("stranger");
    expect(floorBoss(10, towerPool())).toBeNull();
    // An admin's climb: in the pool for his floors only.
    const pool = towerPool(undefined, undefined, { admin: true });
    expect(pool).toEqual([...towerPool(), "stranger"]);
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
    const off = towerPool(["stranger"], undefined, { admin: true });
    let r2 = newRun(77, off);
    for (let f = 1; f < 10; f++) r2 = finishFloor(startFloor(r2, off)!.run, "won", off);
    expect(r2.floors[9]).toHaveLength(2);
    expect(r2.floors[9]).not.toContain("stranger");
  });

  it("admins first: his picker card and Boss alone for an admin only, never one of an admin's plain tiles; a test's server (unfinished) meets him as an admin does", () => {
    expect(unlockBosses()).toEqual([]);
    expect(unlockBosses(BOSS_ROSTER, false, true).map((b) => b.id)).toEqual(["stranger"]);
    expect(unlockBosses(BOSS_ROSTER, true).map((b) => b.id)).toEqual(["stranger"]);
    expect(towerPool(undefined, BOSS_ROSTER, { unfinished: true })).toContain("stranger");
    // (An admin's tiles are the bosses in the game for admins first but him: he's his card, locked until won.)
    expect(adminFirstBosses().map((b) => b.id)).not.toContain("stranger");
    expect(menuBosses({ admin: true, raid: false }).map((b) => b.id)).not.toContain("stranger");
    // (A floor the tower dealt him, or a pick the unlock allowed: the runner meets him, never a stand-in.)
    expect(chooseBoss(0.5, "stranger").id).toBe("stranger");
    expect([unlockReady(bossDef("stranger")), unlockReady(bossDef("stranger"), false, true)]).toEqual([false, true]);
  });

  it("unlocked only by a floor of his own won with him on it (Eric: \"you have to beat him to unlock him\"); picked only then", () => {
    expect(unlockFloor("stranger")).toBe(10);
    expect(unlockFloor("gingerbread")).toBeNull();
    // His floors, him on them: each unlocks him (10 the first; 30 and 50 too, beaten there after a life spent on 10).
    for (const f of [10, 30, 50]) expect(floorUnlocks(f, ["stranger"]), `floor ${f}`).toEqual(["stranger"]);
    // Any other floor won: nothing (floor 11 climbed past his 10 with a life spent on it; floor 9).
    expect(floorUnlocks(11, ["clown", "gingerbread"])).toEqual([]);
    expect(floorUnlocks(9, ["clown"])).toEqual([]);
    // His floor dealt to others (no art yet, or resting): beating them isn't beating him.
    expect(floorUnlocks(10, ["clown", "gingerbread"])).toEqual([]);
    const def = bossDef("stranger")!;
    // An admin (admins first): his once won, never before.
    expect(canPick(def, [], false, true)).toBe(false);
    expect(canPick(def, floorUnlocks(10, ["stranger"]), false, true)).toBe(true);
    // Anyone else (and the server's online picks, which pass no admin): not while he's admins first; a test's server, once won.
    expect(canPick(def, ["stranger"])).toBe(false);
    expect(canPick(def, ["stranger"], true)).toBe(true);
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

describe("his finisher (Eric, Nov 27: a capture of a piece that isn't a pawn shows as his leap and a finisher, then the move)", () => {
  /** His battle on `fen` (him to move), after a crowd move so his powers have a turn. */
  async function onPosition(fen: string, crowd: "w" | "b" = "w") {
    const r = battle(5, crowd);
    await crowdMove(r);
    const id = r.state.boards[0]!;
    const board = r.boards.get(id)!;
    r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
    r.state = { ...r.state, boss: { ...r.boss!, crowdSide: crowd } };
    return r;
  }
  const finishers = (r: MatchRunner) => r.boss!.powers!.events.filter((e) => e.kind === "finisher");

  it("a capture of your knight, bishop, rook or queen holds his move for it; a pawn, a quiet move or another boss: none", async () => {
    // Black (him) to move: his pawn on c5 (or his rook on d8) can take your knight on d4.
    const fen = "3r2k1/8/8/2p5/3N4/8/7P/3QK3 b - - 0 1";
    const r = await onPosition(fen);
    expect(r.bossMoveMoment("g8f7")).toBe(0);
    expect(r.bossMoveMoment("c5d4")).toBe(STRANGER_FX.finisher);
    expect(finishers(r)).toEqual([{ kind: "finisher", turn: r.boss!.powers!.turn, square: "d4", shape: "n", pick: expect.any(Number) }]);
    // (Marked once: the server asks again as it plays the held move.)
    expect(r.bossMoveMoment("c5d4")).toBe(0);
    expect(finishers(r)).toHaveLength(1);
    // A pawn taken: no finisher (his slash plays where he stands).
    const r2 = await onPosition("6k1/8/8/2p5/3P4/8/8/4K3 b - - 0 1");
    expect(r2.bossMoveMoment("c5d4")).toBe(0);
    expect(finishers(r2)).toEqual([]);
    // Each kind but the pawn and the king, by the same rook.
    for (const [type, at] of [["b", "d4"], ["r", "d4"], ["q", "d4"]] as const) {
      const rr = await onPosition(`3r2k1/8/8/8/3${type.toUpperCase()}4/8/8/4K3 b - - 0 1`);
      expect(rr.bossMoveMoment("d8d4"), type).toBe(STRANGER_FX.finisher);
      expect(finishers(rr)[0]).toMatchObject({ square: at, shape: type });
    }
  });

  it("its pick is the seed's (the same on every device) and plays one of four finishers; the move itself is an ordinary capture", async () => {
    const fen = "3r2k1/8/8/8/3Q4/8/8/4K3 b - - 0 1";
    const a = await onPosition(fen);
    const b = await onPosition(fen);
    a.bossMoveMoment("d8d4");
    b.bossMoveMoment("d8d4");
    expect(finishers(a)[0]!.pick).toBe(finishers(b)[0]!.pick);
    expect(FINISHERS).toEqual(["flame", "ice", "cut", "frostfire"]);
    expect(FINISHERS.map((_, i) => finisherOf(i))).toEqual([...FINISHERS]);
    expect(finisherOf(4097)).toBe("ice");
    // (Every pick across many seeds and turns: all four come up.)
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) seen.add(finisherOf(Math.floor(powerRollFor(seed) * 4096)));
    expect([...seen].sort()).toEqual([...FINISHERS].sort());
    a.applyBossMove("d8d4");
    expect(pieceAt(fenOf(a), "d4")).toEqual({ color: "b", type: "r" });
    // (His move shown, the crowd's turn's events are its own: the finisher doesn't play again after the move.)
    expect(finishers(a)).toEqual([]);
    expect(POWER_FX.finisher).toBe(STRANGER_FX.finisher);
  });
});

describe("the finisher's test switch (?power=finisher, finisher-<kind>)", () => {
  it("starts where your bishop takes his knight; he takes it back, his finisher on it, the kind forced by finisher-<kind>", async () => {
    for (const side of ["w", "b"] as const)
      for (const test of ["finisher", "finisher-cut"]) {
        const r = battle(9, side, test);
        r.deal();
        expect(fenOf(r)).toBe(FINISHER_TEST[side]);
        // Your bishop takes his knight.
        const take = side === "w" ? "g5f6" : "g4f3";
        await crowdMove(r, () => take);
        expect(r.bossToMove()).toBe(true);
        // His move takes your bishop back (the test move), held for his finisher.
        let held = 0;
        const move = await r.playBoss(undefined, async (ms) => void (held = ms));
        expect(move.slice(2, 4)).toBe(side === "w" ? "f6" : "f3");
        expect(held).toBe(STRANGER_FX.finisher);
        r.deal();
        expect(pieceAt(fenOf(r), move.slice(2, 4))?.color).toBe(side === "w" ? "b" : "w");
      }
  });

  it("the forced kind is the event's pick (finisher-ice: the ice)", async () => {
    const r = battle(9, "w", "finisher-ice");
    r.deal();
    await crowdMove(r, () => "g5f6");
    await r.playBoss(undefined, async () => {
      const e = r.boss!.powers!.events.find((x) => x.kind === "finisher")!;
      expect(finisherOf(e.pick)).toBe("ice");
    });
  });
});

/** The roll his finisher's pick is made from, at a seed (his first crowd turn, d4). */
const powerRollFor = (seed: number) => powerRoll(seed, "finisher", 1, "d4");
