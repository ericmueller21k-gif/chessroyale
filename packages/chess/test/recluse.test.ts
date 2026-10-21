import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  BOSS_BRAIN,
  BOSS_POWERS,
  BOSS_ROSTER,
  DEFAULT_SETTINGS,
  RAID_SETTINGS,
  adminPlayable,
  bossBrainFor,
  bossDef,
  bossStrength,
  chooseBoss,
  crowdFinalBoss,
  hiddenBosses,
  isPlayable,
  maiaRatingFor,
  menuBosses,
  mulberry32,
  playableBosses,
  type Settings,
} from "@chessroyale/core";
import { MatchRunner, RECLUSE_FX, WIN_TEST_MOVES, bossTurnShowMs, bulletClock, bulletIncrement, bulletIncrementAt, bulletMeter, kingHelpBlocked, legalMoves, powerMomentMs, rageOf, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

/**
 * The Hidden Boss, phase 1 (Eric, Oct 14): hidden from players (an admin's Boss alone only), Maia at its strongest as
 * his brain whatever the player's rating, the God King's help blocked (a try spends its charge), no strikes on the crowd,
 * and his ultimate: the bullet clock (his meter full at crowd turn bulletTurn, then every bank bulletBankSeconds for the
 * rest of the battle, no increment for its first bulletPlainMoves moves, then bulletIncrementSeconds a move made in time;
 * a bank that runs out loses on time).
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const isKnight = (fen: string, m: string) => new Chess(fen).get(m.slice(0, 2) as never)?.type === "n";
const empty = (fen: string, m: string) => !new Chess(fen).get(m.slice(2, 4) as never);
/** A stand-in engine (as rage.test.ts's): knights shuffle onto empty squares when they can, so the game lasts. */
function fakeEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    topMovesAt: async (fen) => [{ move: "0000", expected: 0.3 + 0.4 * hash(fen) }],
    playAtElo: async (fen) => {
      const all = legalMoves(fen).sort();
      return all.find((m) => isKnight(fen, m) && empty(fen, m)) ?? all[0]!;
    },
  };
}
const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });

/** Boss alone against him (an admin's: bossHidden), the God King's Last Stand left on (it must not come anyway). */
function alone(extra: Partial<Settings> = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1400, bossId: "recluse", bossHidden: true, ...extra } as Settings;
  return new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
}
/** The crowd's move: a knight shuffle when it may (the game lasts), else the first allowed move. */
function crowdMove(r: MatchRunner): string {
  const fen = r.boards.get(0)!.fen;
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  return [...allowed].sort().find((m) => isKnight(fen, m) && empty(fen, m)) ?? [...allowed].sort()[0]!;
}
/** Plays until the crowd's turn `turn` begins (the boss's moves in between), the crowd thinking `thinkMs` a move. */
async function untilTurn(r: MatchRunner, turn: number, thinkMs = 1000) {
  for (let i = 0; i < 200 && r.boss!.powers!.turn < turn && !r.stageComplete(); i++) {
    if (r.bossToMove()) {
      await r.playBoss();
      continue;
    }
    r.deal();
    await r.score(new Map([["h0", { move: crowdMove(r), thinkMs }]]));
  }
  // (The crowd to move on that turn.)
  if (r.bossToMove()) await r.playBoss();
}

describe("who meets him: hidden from players, an admin's Boss alone, and the Crowd's boss final for everyone", () => {
  const def = bossDef("recluse")!;

  it("is one roster entry, 'Hidden Boss', with his kit and powers, hidden from players", () => {
    expect(def).toMatchObject({ name: "Hidden Boss", kit: "Hidden Boss", powers: { passive: "nohelp", ultimate: "bullet" }, adminOnly: true, crowdFinal: true });
    expect(BOSS_ROSTER.filter((b) => b.adminOnly).map((b) => b.id)).toEqual(["recluse"]);
    expect(isPlayable(def)).toBe(false);
    expect(adminPlayable(def)).toBe(true);
    expect(playableBosses().map((b) => b.id)).not.toContain("recluse");
    expect(hiddenBosses().map((b) => b.id)).toEqual(["recluse"]);
  });

  it("is never chosen at random, nor when a player asks for him (a link, a stored pick, ?wip=1); an admin's Boss alone meets him", () => {
    for (let i = 0; i < 200; i++) {
      expect(chooseBoss(i / 200).id).not.toBe("recluse");
      expect(chooseBoss(i / 200, null, null, undefined, false, true).id, "random, even for an admin").not.toBe("recluse");
      expect(chooseBoss(i / 200, "recluse").id).not.toBe("recluse");
      expect(chooseBoss(i / 200, "recluse", null, undefined, true).id, "?wip=1, a player").not.toBe("recluse");
    }
    expect(chooseBoss(0.3, "recluse", null, undefined, false, true).id).toBe("recluse");
    expect(chooseBoss(0.3, "recluse", "recluse", undefined, false, true).id, "even met last").toBe("recluse");
  });

  it("the boss menu lists him for an admin picking for Boss alone, after the rest; never for a player, never for a raid", () => {
    const ids = (admin: boolean, raid: boolean) => menuBosses({ admin, raid }).map((b) => b.id);
    expect(ids(true, false).at(-1)).toBe("recluse");
    expect(ids(true, false).slice(0, -1)).toEqual(playableBosses().map((b) => b.id));
    for (const [admin, raid] of [[false, false], [false, true], [true, true]] as const) expect(ids(admin, raid)).toEqual(playableBosses().map((b) => b.id));
  });

  it("starts from the starting position, never a book opening (he has no memorized lines); as White he moves first", async () => {
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const r = alone();
    expect(r.boards.get(0)!.fen).toBe(START);
    expect(r.boards.get(0)!.history).toEqual([]);
    expect(r.boss!.crowdSide).toBe("w");
    // (Every raid starts there now, Eric, Oct 21; with raidOpening another boss gets the book opening, he never does.)
    expect(alone({ bossId: "clown", bossHidden: false }).boards.get(0)!.history).toEqual([]);
    expect(alone({ bossId: "clown", bossHidden: false, raidOpening: true }).boards.get(0)!.history.length).toBeGreaterThan(0);
    expect(alone({ raidOpening: true }).boards.get(0)!.history).toEqual([]);
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1400, bossId: "recluse", bossHidden: true } as Settings;
    const white = new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"]))], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "b" });
    expect(white.boards.get(0)!.fen).toBe(START);
    expect(white.boss!.crowdSide).toBe("b");
    expect(white.bossToMove()).toBe(true);
    await white.playBoss();
    expect(white.boards.get(0)!.history).toHaveLength(1);
  });

  it("in the match: Boss alone for an admin (bossHidden) meets him; without it (a player, a raid), never", () => {
    expect(alone().boss!.id).toBe("recluse");
    for (const extra of [{ bossHidden: false }, { bossHidden: undefined }] as Partial<Settings>[]) expect(alone(extra).boss!.id).not.toBe("recluse");
  });

  it("the one exception (Eric, Oct 14): the Crowd's boss final is always him, for everyone (crowdFinalBoss); still never playable, picked or listed anywhere else", () => {
    expect(crowdFinalBoss()).toBe(def);
    expect(BOSS_ROSTER.filter((b) => b.crowdFinal).map((b) => b.id)).toEqual(["recluse"]);
    // (Still hidden from players everywhere else: the rule above is untouched.)
    expect(isPlayable(def)).toBe(false);
    for (const [admin, raid] of [[false, false], [false, true]] as const) expect(menuBosses({ admin, raid }).map((b) => b.id)).not.toContain("recluse");
    // The match runner's Crowd final meets him: crowd.test.ts ("50 v 50 boss final"); the lobby's: crowd-hidden-boss.test.ts.
  });
});

describe("his brain: Maia-3 at its strongest, raw, whatever the player's rating", () => {
  const top = BOSS_BRAIN.maiaRating.at(-1)!;

  it("is Maia at its top rating (2500 in our setup), no guard, no Stockfish share, at any strength, alone or a crowd, whatever an admin picked", () => {
    expect(top).toEqual([2650, 2500]);
    expect(maiaRatingFor(5000)).toBe(2500);
    const plan = { brain: "maia-raw", rating: 2500, stockfishShare: 0 };
    for (const strength of [800, 1500, 2400, 2650, 2800, 3190])
      for (const crowd of [false, true]) for (const picked of ["", "stockfish", "maia-strict"] as const) expect(bossBrainFor("recluse", strength, picked, true, { crowd })).toEqual(plan);
    // (Where Maia isn't on offer, Stockfish, as for every boss: he's admins only, and they always may.)
    expect(bossBrainFor("recluse", 2650, "", false)).toEqual({ brain: "stockfish", rating: null, stockfishShare: 0 });
    // Once Maia is on for players (BOSS_BRAIN.forPlayers), the same plan.
    expect(bossBrainFor("recluse", 1200, "", true, {}, { ...BOSS_BRAIN, forPlayers: true })).toEqual(plan);
    // (The other bosses are untouched: the band.)
    expect(bossBrainFor("pig", 1700, "", true)).not.toEqual(plan);
  });

  it("has a fixed strength (the level where Maia reaches its top, 2650), whatever the player's rating or the difficulty", () => {
    const def = bossDef("recluse")!;
    for (const base of [800, 1400, 2200, 3000]) for (const extra of [-300, 0, 500]) expect(bossStrength(base, def, extra)).toBe(2650);
    expect(bossStrength(1400, bossDef("pig"), 0)).toBe(1150);
  });

  it("in Boss alone: the runner's plan is that, at the fixed strength, with no slips", () => {
    const r = alone();
    expect(r.boss!.elo).toBe(2650);
    expect(r.bossBrainPlan("", true)).toEqual({ brain: "maia-raw", rating: 2500, stockfishShare: 0 });
    expect(r.bossBrainPlan("stockfish", true)).toEqual({ brain: "maia-raw", rating: 2500, stockfishShare: 0 });
    expect(r.bossStumbles()).toBe(false);
  });
});

describe("his ultimate, the bullet clock (Eric, Oct 14)", () => {
  const BANK = BOSS_POWERS.bulletBankSeconds * 1000;

  it("his meter fills from turn 1 to full at bulletTurn (7), then none", () => {
    expect(BOSS_POWERS.bulletTurn).toBe(7);
    expect([1, 2, 4, 7].map((t) => bulletMeter({}, t))).toEqual([0, 1 / 6, 3 / 6, 1]);
    expect(bulletMeter({ ultAt: 7 }, 7)).toBe(1);
    expect(bulletMeter({ ultAt: 7 }, 8)).toBeNull();
  });

  it("comes as crowd turn 7 begins (no warning), sets every bank to the bullet bank, and from then on: no increment, no per-move cap", async () => {
    const r = alone();
    // (Before it: the usual clock, 20 s at most a move.)
    expect(r.allowedMsFor("h0")).toBe(RAID_SETTINGS.moveClockSeconds! * 1000);
    await untilTurn(r, 6);
    let p = r.boss!.powers!;
    expect(p.turn).toBe(6);
    expect(p.ultAt).toBeUndefined();
    expect(rageOf(r.boss)).toBeCloseTo(5 / 6);
    expect(bulletClock(r.boss)).toBe(false);
    // (Before: the usual clock, the increment going back into the bank.)
    const before = r.player("h0").bankMs;
    r.deal();
    await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: 4000 }]]));
    expect(r.player("h0").bankMs).toBe(before + DEFAULT_SETTINGS.timeIncrementSeconds * 1000 - 4000);
    await r.playBoss();
    p = r.boss!.powers!;
    expect(p.turn).toBe(7);
    expect(p.ultAt).toBe(7);
    expect(p.events.map((e) => e.kind)).toEqual(["bullet"]);
    expect(p.warnAt).toBeUndefined();
    expect(bulletClock(r.boss)).toBe(true);
    expect(rageOf(r.boss)).toBe(1);
    // Every bank is the bullet bank; a move may take all of it (no 20 s cap), nothing is added.
    expect(r.player("h0").bankMs).toBe(BANK);
    expect(r.allowedMsFor("h0")).toBe(BANK);
    // (Its first bulletPlainMoves (3) moves: 1+0.)
    expect(BOSS_POWERS.bulletPlainMoves).toBe(3);
    for (const think of [4000, 30_000, 2500]) {
      const bank = r.player("h0").bankMs;
      expect(bulletIncrement(r.boss), `turn ${r.boss!.powers!.turn}`).toBe(0);
      r.deal();
      await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: think }]]));
      expect(r.player("h0").bankMs, `after ${think} ms`).toBe(bank - think);
      await r.playBoss();
      // (It lasts the rest of the battle: no meter, no other ultimate, the test trigger refused.)
      expect(rageOf(r.boss)).toBeNull();
      expect(r.triggerUltimate()).toBe(false);
      expect(bulletClock(r.boss)).toBe(true);
    }
    expect(r.player("h0").bankMs).toBe(BANK - 36_500);
    expect(RECLUSE_FX.bullet).toBeGreaterThan(4000);
  });

  it("then he adds time per move: 3 moves at 1+0, his moment as the 4th begins, and from then on +2 s a move made in time", async () => {
    expect(BOSS_POWERS.bulletIncrementSeconds).toBe(2);
    const INC = BOSS_POWERS.bulletIncrementSeconds * 1000;
    const r = alone();
    await untilTurn(r, 7);
    expect(r.boss!.powers!.ultAt).toBe(7);
    const kinds: Record<number, string[]> = {};
    // Turns 7, 8, 9: the bank alone (what you take out of it is gone), and his moment hasn't come.
    for (const turn of [7, 8, 9]) {
      expect(r.boss!.powers!.turn).toBe(turn);
      kinds[turn] = r.boss!.powers!.events.map((e) => e.kind);
      const bank = r.player("h0").bankMs;
      expect(r.allowedMsFor("h0"), `turn ${turn}`).toBe(bank);
      r.deal();
      await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: 3000 }]]));
      expect(r.player("h0").bankMs, `turn ${turn}`).toBe(bank - 3000);
      await r.playBoss();
    }
    expect(kinds).toEqual({ 7: ["bullet"], 8: [], 9: [] });
    // Turn 10 begins: his moment (once), the increment on from this move.
    let p = r.boss!.powers!;
    expect(p.turn).toBe(10);
    expect(p.events).toEqual([{ kind: "bulletPlus", turn: 10 }]);
    expect(bulletIncrement(r.boss)).toBe(2);
    // (The clock starts after his moment, as after every power's: alone, his move's 0.45 s show and then the moment.)
    expect(RECLUSE_FX.bulletPlus).toBeGreaterThan(2000);
    expect(powerMomentMs(p.events)).toBe(RECLUSE_FX.bulletPlus);
    expect(bossTurnShowMs({ crowdSide: "w", board: { fen: r.boards.get(0)!.fen }, lastMove: null, powers: { events: p.events } }, true)).toBe(450 + RECLUSE_FX.bulletPlus);
    // Each move made in time: the increment into the bank, the time taken out; a move may take the bank and the increment.
    expect(r.player("h0").bankMs).toBe(BANK - 9000);
    for (const think of [1000, 5000, 2000]) {
      const bank = r.player("h0").bankMs;
      expect(r.allowedMsFor("h0")).toBe(bank + INC);
      r.deal();
      await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: think }]]));
      expect(r.player("h0").bankMs, `after ${think} ms`).toBe(bank + INC - think);
      await r.playBoss();
      p = r.boss!.powers!;
      // (His moment came once: none since.)
      expect(p.events).toEqual([]);
      expect(bulletIncrement(r.boss)).toBe(2);
    }
    expect(r.player("h0").bankMs).toBe(BANK - 9000 + 3 * INC - 8000);
    // A quick move makes the bank grow, past the bullet bank too: no cap (nothing caps a move below what the bank holds).
    for (let i = 0; i < 8; i++) {
      r.deal();
      await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: 0 }]]));
      await r.playBoss();
    }
    expect(r.player("h0").bankMs).toBe(BANK - 11_000 + 8 * INC);
    expect(r.player("h0").bankMs).toBeGreaterThan(BANK);
    expect(r.allowedMsFor("h0")).toBe(r.player("h0").bankMs + INC);
  });

  it("with the increment, running out still loses on time: a move not made in time adds nothing, and empties the bank", async () => {
    const r = alone({ bossPowerTest: "bullet" });
    await untilTurn(r, 2 + BOSS_POWERS.bulletPlainMoves);
    expect(bulletIncrement(r.boss)).toBe(2);
    const allowed = r.allowedMsFor("h0");
    expect(allowed).toBe(r.player("h0").bankMs + 2000);
    const ply = r.boards.get(0)!.history.length;
    r.deal();
    await r.score(new Map([["h0", { move: null, thinkMs: allowed }]]));
    expect(r.player("h0").bankMs).toBe(0);
    expect(r.bossOutOfTime()).toBe(true);
    expect(r.boards.get(0)!.history.length).toBe(ply);
    expect(r.finishBossBattle()).toBe("boss");
    expect(r.bossTimedOut).toBe(true);
  });

  it("the increment's rule: none before the bullet clock or for its first bulletPlainMoves turns, then the setting's", () => {
    const s = { bulletPlainMoves: 3, bulletIncrementSeconds: 2 };
    expect([7, 8, 9, 10, 11, 40].map((t) => bulletIncrementAt(t, 7, s))).toEqual([0, 0, 0, 2, 2, 2]);
    expect(bulletIncrementAt(12, undefined, s)).toBe(0);
    expect(bulletIncrementAt(12, null, s)).toBe(0);
    // (Easy to change: 1+1, or straight away.)
    expect(bulletIncrementAt(10, 7, { bulletPlainMoves: 3, bulletIncrementSeconds: 1 })).toBe(1);
    expect(bulletIncrementAt(7, 7, { bulletPlainMoves: 0, bulletIncrementSeconds: 2 })).toBe(2);
    // (Another boss, or before his ultimate: none.)
    expect(bulletIncrement(null)).toBe(0);
    expect(bulletIncrement({ id: "pig", powers: { turn: 20, ultAt: 7 } } as never)).toBe(0);
  });

  it("the admins' trigger brings it as the next crowd turn begins; the test switch (?power=bullet) on turn 2", async () => {
    const r = alone();
    await untilTurn(r, 2);
    expect(r.triggerUltimate()).toBe(true);
    r.deal();
    await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: 1000 }]]));
    await r.playBoss();
    expect(r.boss!.powers!).toMatchObject({ turn: 3, ultAt: 3 });
    expect(r.player("h0").bankMs).toBe(BANK);
    const t = alone({ bossPowerTest: "bullet" });
    await untilTurn(t, 2);
    expect(t.boss!.powers!).toMatchObject({ turn: 2, ultAt: 2 });
  });

  it("a bank that runs out loses the battle on time: no move is played for the crowd, the boss wins, and the runner says so", async () => {
    const r = alone({ bossPowerTest: "bullet" });
    await untilTurn(r, 2);
    r.deal();
    await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: BANK - 1000 }]]));
    expect(r.stageComplete()).toBe(false);
    await r.playBoss();
    expect(r.allowedMsFor("h0")).toBe(1000);
    const fen = r.boards.get(0)!.fen;
    const ply = r.boards.get(0)!.history.length;
    // Out of time: no pick in time (the clock ran out), as solo and the server send it.
    r.deal();
    await r.score(new Map([["h0", { move: null, thinkMs: 1000 }]]));
    expect(r.player("h0").bankMs).toBe(0);
    expect(r.bossOutOfTime()).toBe(true);
    expect(r.boards.get(0)!.fen).toBe(fen);
    expect(r.boards.get(0)!.history.length).toBe(ply);
    expect(r.stageComplete()).toBe(true);
    expect(r.finishBossBattle()).toBe("boss");
    expect(r.boss!.result).toBe("boss");
    expect(r.bossTimedOut).toBe(true);
  });
});

describe("the God King's help doesn't work against him (his passive); a try spends its charge", () => {
  it("his strike never comes; his move is never played for the crowd; his Last Stand never comes, even forced, and spends nothing", async () => {
    const r = alone();
    expect(kingHelpBlocked(r.boss)).toBe(true);
    expect(kingHelpBlocked({ id: "pig" })).toBe(false);
    await untilTurn(r, 2);
    const charges = r.boss!.kingCharges;
    expect(charges).toBe(DEFAULT_SETTINGS.kingChargesMax);
    r.deal();
    expect(r.callStrike("h0")).toEqual({ struck: false, calls: 0 });
    expect(r.boss!.staggerNext).toBeFalsy();
    // Calling him to play the move (no pick of one's own): he doesn't come; the turn is a missed move as any other.
    r.kingCallers.add("h0");
    r.forceLastStand = true;
    const report = await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: 1000 }]]));
    const b = report.boards[0]!;
    expect(b.king).toBe(false);
    expect(b.lastStand).toBeUndefined();
    expect(r.boss!.kingCharges).toBe(charges);
    expect(r.boss!.kingStrikes ?? []).toEqual([]);
    expect(r.boss!.kingMoves ?? []).toEqual([]);
    expect(r.boss!.lastStand).toBeUndefined();
  });

  it("a try at his move or his strike (the dock's) spends a charge as if it had worked, one a try, until none is left; nothing else changes", async () => {
    const r = alone();
    await untilTurn(r, 2);
    r.deal();
    const fen = r.boards.get(0)!.fen;
    const bank = r.player("h0").bankMs;
    const max = DEFAULT_SETTINGS.kingChargesMax;
    expect(max).toBe(3);
    for (let left = max - 1; left >= 0; left--) {
      expect(r.kingTried()).toBe(true);
      expect(r.boss!.kingCharges).toBe(left);
    }
    // None left: nothing more to spend (the dock's God King can't be called any more, as against any boss).
    expect(r.kingTried()).toBe(false);
    expect(r.boss!.kingCharges).toBe(0);
    // He never came: no move, no strike, no stagger, the position and your clock as they were; the move is still yours.
    expect(r.boss!).toMatchObject({ kingMoves: [], kingStrikes: [] });
    expect(r.boss!.staggerNext).toBeFalsy();
    expect(r.boards.get(0)!.fen).toBe(fen);
    expect(r.player("h0").bankMs).toBe(bank);
    const report = await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: 1000 }]]));
    expect(report.boards[0]!.king).toBe(false);
    expect(r.boards.get(0)!.history.length).toBeGreaterThan(0);
    // (Phase 1 won, phase 2 still tries against him: the battle's result doesn't stop it.)
    const won = alone({ bossWinTest: true });
    won.deal();
    await won.score(new Map([["h0", { move: "h5f7", thinkMs: 1000 }]]));
    won.finishBossBattle();
    expect(won.boss!.result).toBe("crowd");
    expect(won.kingTried()).toBe(true);
    expect(won.boss!.kingCharges).toBe(max - 1);
  });

  it("another boss: a try isn't this (his help works there, through his move and strike as before)", async () => {
    const r = alone({ bossId: "clown", bossHidden: false });
    const charges = r.boss!.kingCharges;
    expect(r.kingTried()).toBe(false);
    expect(r.boss!.kingCharges).toBe(charges);
  });
});

describe("he never strikes the crowd (Oct 14: his fight is a squad's, who must all reach phase 2)", () => {
  /**
   * A crowd of five against a boss (a raid, people only), `turns` crowd moves: every one picking the same move, but h4
   * misses every move and h3 every other, so the worst since each strike is clear (a tie for the worst waits:
   * docs/decisions/2026-10-15-opening-allowance-and-ties.md).
   */
  async function crowdOf5(bossId: string, turns: number) {
    const ids = ["h0", "h1", "h2", "h3", "h4"];
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1400, bossId, bossHidden: true } as Settings;
    const r = new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)], entrants: ids.map((id) => ({ id, name: id, isBot: false })) });
    const due: number[] = [];
    const strikeIn: (number | null)[] = [];
    for (let i = 0; i < 200 && r.boss!.crowdMoves < turns && !r.stageComplete(); i++) {
      if (r.bossToMove()) {
        await r.playBoss();
        continue;
      }
      strikeIn.push(r.bossView()!.strikeIn);
      r.deal();
      const move = crowdMove(r);
      const turn = r.boss!.crowdMoves;
      const misses = (id: string) => id === "h4" || (id === "h3" && turn % 2 === 0);
      await r.score(new Map(ids.map((id) => [id, { move: misses(id) ? null : move, thinkMs: 1000 }])));
      if (r.bossKillDue()) {
        due.push(r.boss!.crowdMoves);
        r.bossKill();
      }
    }
    return { r, due, strikeIn };
  }

  it("no knockouts, ever, and no count to a strike on the boss card (Move N of M instead)", async () => {
    const { r, due, strikeIn } = await crowdOf5("recluse", 9);
    expect(r.boss!.id).toBe("recluse");
    expect(r.boss!.crowdMoves).toBe(9);
    expect(due).toEqual([]);
    expect(r.boss!.kills).toEqual([]);
    expect(r.alive()).toHaveLength(5);
    expect(strikeIn).toEqual(Array(9).fill(null));
  });

  it("other bosses still strike every bossKillEvery moves, the card counting down to it", async () => {
    const { r, due, strikeIn } = await crowdOf5("clown", 9);
    expect(r.boss!.id).toBe("clown");
    expect(RAID_SETTINGS.bossKillEvery ?? DEFAULT_SETTINGS.bossKillEvery).toBe(3);
    // (Five of them: down to half, rounded up, so two strikes.)
    expect(due).toEqual([3, 6]);
    expect(r.alive()).toHaveLength(3);
    expect(strikeIn.slice(0, 6)).toEqual([3, 2, 1, 3, 2, 1]);
    expect(strikeIn.slice(6)).toEqual([null, null, null]);
  });
});

describe("beaten (?win=1, Boss alone): a crowd win, then his fall", () => {
  it("the test switch starts the battle with the crowd White to move, mating in one; mating him is the crowd's win", async () => {
    const r = alone({ bossWinTest: true });
    expect(r.boards.get(0)!.history).toEqual([...WIN_TEST_MOVES]);
    expect(r.boss!.crowdSide).toBe("w");
    r.deal();
    await r.score(new Map([["h0", { move: "h5f7", thinkMs: 1000 }]]));
    expect(r.stageComplete()).toBe(true);
    expect(r.finishBossBattle()).toBe("crowd");
    expect(r.bossTimedOut).toBe(false);
  });
});
