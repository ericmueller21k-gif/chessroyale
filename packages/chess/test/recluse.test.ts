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
  hiddenBosses,
  isPlayable,
  maiaRatingFor,
  menuBosses,
  mulberry32,
  playableBosses,
  type Settings,
} from "@chessroyale/core";
import { MatchRunner, RECLUSE_FX, WIN_TEST_MOVES, bulletClock, bulletMeter, kingHelpBlocked, legalMoves, rageOf, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

/**
 * The Hidden Boss, phase 1 (Eric, Oct 14): hidden from players (an admin's Boss alone only), Maia at its strongest as
 * his brain whatever the player's rating, the God King's help blocked, and his ultimate: the bullet clock (his meter full
 * at crowd turn bulletTurn, then every bank bulletBankSeconds with no increment for the rest of the battle; a bank that
 * runs out loses on time).
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

describe("who meets him: hidden from players, an admin's Boss alone only", () => {
  const def = bossDef("recluse")!;

  it("is one roster entry, 'Hidden Boss', with his kit and powers, hidden from players", () => {
    expect(def).toMatchObject({ name: "Hidden Boss", kit: "Hidden Boss", powers: { passive: "nohelp", ultimate: "bullet" }, adminOnly: true });
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

  it("in the match: Boss alone for an admin (bossHidden) meets him; without it (a player, a raid, the Crowd's final), never", () => {
    expect(alone().boss!.id).toBe("recluse");
    for (const extra of [{ bossHidden: false }, { bossHidden: undefined }] as Partial<Settings>[]) expect(alone(extra).boss!.id).not.toBe("recluse");
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
    for (const think of [4000, 30_000, 2500]) {
      const bank = r.player("h0").bankMs;
      r.deal();
      await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: think }]]));
      expect(r.player("h0").bankMs, `after ${think} ms`).toBe(bank - think);
      await r.playBoss();
      expect(r.allowedMsFor("h0")).toBe(bank - think);
      // (It lasts the rest of the battle: no meter, no other ultimate, the test trigger refused.)
      expect(rageOf(r.boss)).toBeNull();
      expect(r.triggerUltimate()).toBe(false);
      expect(bulletClock(r.boss)).toBe(true);
    }
    expect(r.player("h0").bankMs).toBe(BANK - 36_500);
    expect(RECLUSE_FX.bullet).toBeGreaterThan(4000);
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

describe("the God King's help doesn't work against him (his passive), and nothing is spent", () => {
  it("his strike never comes; his move is never played for the crowd; his Last Stand never comes, even forced", async () => {
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
