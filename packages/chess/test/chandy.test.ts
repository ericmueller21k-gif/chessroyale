import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_POWERS, BOSS_ROSTER, CHANDY_MOVES, adminFirst, isPlayable, menuBosses, mulberry32, type BossPowerState, type ChandyState, type DodgeLine } from "@chessroyale/core";
import {
  CHANDY_FX,
  MatchRunner,
  PASS_WAIT,
  POWER_FX,
  beamAllows,
  botDodgeVote,
  capturedSquare,
  chandyTurnMs,
  chooseBeam,
  chooseRapid,
  chooseScatter,
  chooseShields,
  crowdAllowed,
  dodgeArena,
  dodgeCenter,
  dodgeEndAt,
  dodgeRounds,
  dodgeSeen,
  dodgeTally,
  dodgeTimeline,
  dodgeVolley,
  heldIn,
  kingAttacked,
  legalMoves,
  linesAfter,
  lockEnds,
  lockLeft,
  lockOrder,
  lockRank,
  locksAfter,
  mateOpen,
  matingMoves,
  meterOrder,
  meterPick,
  pieceAt,
  powerTurn,
  queenLockAim,
  queenShot,
  rageOf,
  ragePaused,
  safeSquares,
  stopReason,
  steerPick,
  testCapture,
  strikeRage,
  triggerUltimate,
  unlockPick,
  type MoveScore,
} from "../src/index.ts";
import { KIT_OPENING, KIT_STRESS, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Chandy (Eric's design, Nov 15-16: DESIGN.md on branch stills/boss-chandy; docs/decisions/2026-11-16-chandy-rules.md): his locks
 * (L1-L6), the steering, the rifle's upgrades, his move meter and its five moves (scatter shot, beam, shields, rapid fire, queen
 * lock), and Dodge (one safe square always, the teleports, the vote's tally and its random square).
 */

const S = BOSS_POWERS.chandy;

function battle(seed: number, test = "", side: "w" | "b" = "w"): MatchRunner {
  return new MatchRunner({ settings: kitSettings({ boss: "chandy", test, maxMoves: 60 }), rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: side });
}
const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const cOf = (r: MatchRunner): ChandyState => r.boss!.powers!.chandy!;

/** The board and his state set by hand (`fen`: whoever is to move), as a turn of the crowd's or his. */
function onPosition(r: MatchRunner, fen: string, crowd: "w" | "b", chandy: Partial<ChandyState> = {}, patch: Partial<BossPowerState> = {}) {
  const id = r.state.boards[0]!;
  const board = r.boards.get(id)!;
  r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
  const boss = r.state.boss!;
  r.state = { ...r.state, boss: { ...boss, crowdSide: crowd, powers: { ...boss.powers!, ...patch, chandy: { ...boss.powers!.chandy!, ...chandy } } } };
}

async function crowdMove(r: MatchRunner, pick?: (fen: string, allowed: string[]) => string) {
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = pick ? pick(fen, allowed) : crowdPick(fen, allowed, mulberry32(fen.length * 31 + allowed.length));
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
  return move;
}

/**
 * A whole battle as the boss kit plays it (the stand-in engine, the kit's crowd; the queen lock and Dodge as the game plays them, the
 * crowd voting Dodge's safe square), to `maxMoves` crowd moves: the moves his meter landed, in order (the queen lock as it aims).
 */
async function movesOf(seed: number, side: "w" | "b", test: string, opening: typeof KIT_OPENING, maxMoves: number): Promise<string[]> {
  const engines = [fakeEngine()];
  const r = new MatchRunner({ settings: kitSettings({ boss: "chandy", test, maxMoves }), rng: mulberry32(seed), engines, library: [opening], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: side });
  const rng = mulberry32(seed * 7919);
  const kinds: Record<string, string> = { scatterShot: "scatter", beam: "beam", shields: "shields", rapidFire: "rapidfire", queenAim: "queenlock" };
  const seen = new Set<string>();
  const out: string[] = [];
  const look = () => {
    for (const e of r.boss?.powers?.events ?? []) {
      const key = `${e.kind}@${e.turn}`;
      if (kinds[e.kind] && !seen.has(key)) {
        seen.add(key);
        out.push(kinds[e.kind]!);
      }
    }
  };
  for (let i = 0; i < 400 && !r.isOver() && !r.stageComplete(); i++) {
    look();
    if (r.bossToMove()) {
      if (r.queenLockDue()) await r.playQueenLock(engines).catch(() => r.applyQueenLock(null));
      if (r.bossToMove()) await r.playBoss(engines[0]);
      continue;
    }
    if (r.dodgeDue()) {
      const d = cOf(r).dodge!;
      r.finishDodgeRound({ h0: d.rounds[d.results.length]!.safe });
      continue;
    }
    r.deal();
    const fen = fenOf(r);
    await r.score(new Map([["h0", { move: crowdPick(fen, r.crowdAllowed() ?? legalMoves(fen), rng), thinkMs: 1000 }]]));
  }
  look();
  return out;
}

describe("Chandy's sheet", () => {
  it("is on the roster with Lock-on and Dodge, admins first; his numbers are Eric's", () => {
    const def = BOSS_ROSTER.find((d) => d.id === "chandy")!;
    expect(def).toMatchObject({ name: "Chandy", kit: "Chandy", powers: { passive: "lockon", ultimate: "dodge" } });
    expect(BOSS_ADMIN_FIRST).toContain("chandy");
    expect(adminFirst(def)).toBe(true);
    expect(isPlayable(def)).toBe(false);
    expect(menuBosses({ admin: false, raid: true }).some((d) => d.id === "chandy")).toBe(false);
    expect(menuBosses({ admin: true, raid: false }).some((d) => d.id === "chandy")).toBe(true);
    // (L1: no lock before his first capture; a lock hunts 3 of his turns, lives at most 5; at most 2, the second 2 turns after the
    // first. A new unlock fires at once: Eric, Nov 16.)
    expect([S.huntTurns, S.liveTurns, S.maxLocks, S.secondAfter, S.fireOnUnlock]).toEqual([3, 5, 2, 2, true]);
    // (L3's margins, raised by L5 after the sim (1.5 and 0.5 gave 5 upgrades in 28 battles of 32: reports/chandy-sim.md); the 2 s
    // upgrade window; the meter every 6 of your moves; five upgrades; Dodge once a battle, his rage full 3 of your moves after the
    // fifth (Eric, Nov 16: "He only ults once per game, no matter what").)
    expect([S.takeMargin, S.chaseMargin, S.lockLines]).toEqual([2, 0.75, 5]);
    expect([S.upgradeMs, S.meterEvery, S.upgradesMax, BOSS_POWERS.maxUltimates.chandy, S.dodgeAfterMoves]).toEqual([2000, 6, 5, 1, 1]);
    // (D6a: a 3 s vote and 300 ms of lag grace.)
    expect([S.dodgeVoteMs, S.dodgeGraceMs, S.dodgeRounds]).toEqual([3000, 300, 3]);
    for (const k of Object.keys(CHANDY_FX) as (keyof typeof CHANDY_FX)[]) expect(POWER_FX[k]).toBe(CHANDY_FX[k]);
    expect(CHANDY_FX.upgrade).toBe(2000);
  });
});

describe("the locks (L1-L6)", () => {
  it("ranks a piece by how gettable it is: free, attacked by something cheaper, under-defended; never the king or queen", () => {
    // (Your knight on d5, his knight on f6 attacks it, nothing defends it: free.)
    expect(lockRank("4k3/8/5n2/3N4/8/8/8/4K3 w - - 0 1", "d5", "w")).toBe(3);
    // (Your rook on d5 defended by a pawn, but his knight is worth less: free too.)
    expect(lockRank("4k3/8/5n2/3R4/4P3/8/8/4K3 w - - 0 1", "d5", "w")).toBe(3);
    // (Your knight on d4 defended once, attacked twice by pieces no cheaper: under-defended.)
    expect(lockRank("3rk3/8/1b6/8/3N4/2P5/8/4K3 w - - 0 1", "d4", "w")).toBe(2);
    // (Defended as often as attacked, with room to run: none.)
    expect(lockRank("4k3/8/1b6/8/3N4/2P5/8/4K3 w - - 0 1", "d4", "w")).toBe(0);
    // (Your queen hangs on d5, your knight too: he locks the knight, never the queen or king.)
    const fen = "4k3/8/5n2/3Q4/1N6/8/8/4K3 w - - 0 1";
    const order = lockOrder(fen, "w", 7, 0);
    expect(order).not.toContain("d5");
    expect(order).not.toContain("e1");
  });

  it("locks the most capturable first, the more valuable among equals, else the least defended (Q5)", () => {
    // (Your free knight on d5 before your under-defended knight on d4? The knight on d4 defended once, attacked twice; d5 free.)
    const fen = "3rk3/8/1b3n2/3N4/3N4/2P5/8/4K3 w - - 0 1";
    expect(lockOrder(fen, "w", 3, 0)[0]).toBe("d5");
    // (Nothing gettable: the least defended first: your pawn on c2 (none) before the one on a2 (your rook).)
    const quiet = "4k3/8/8/8/8/8/PPP5/RN2K3 w - - 0 1";
    const order = lockOrder(quiet, "w", 3, 0);
    expect(order.length).toBe(5);
    expect(order.indexOf("c2")).toBeLessThan(order.indexOf("a2"));
  });

  it("no lock before his first two captures (Eric, Nov 16 and 18): his moves lock nothing, never steered; each capture is locked and upgrades", async () => {
    const r = battle(11);
    let caught = 0;
    for (let i = 0; i < 120 && caught < S.teachCaptures; i++) {
      if (!r.bossToMove()) {
        await crowdMove(r);
        continue;
      }
      // (The queen lock his first upgrade may unlock: his whole turn, as the game plays it.)
      if (r.queenLockDue()) await r.playQueenLock().catch(() => r.applyQueenLock(null));
      if (!r.bossToMove()) continue;
      const before = fenOf(r);
      expect(cOf(r).locks).toEqual([]);
      expect(r.bossLocks()).toBeNull();
      expect(r.boss!.powers!.events.some((e) => e.kind === "lockOn")).toBe(false);
      const marks: string[] = [];
      const move = await r.playBoss(undefined, async () => {
        // (The moment, before his move shows: the lock on the piece, still on the board.)
        for (const e of r.boss!.powers!.events) if (e.kind === "lockOn" && e.first) marks.push(e.square!);
        expect(cOf(r).locks.map((l) => l.square)).toEqual(marks);
        expect(fenOf(r)).toBe(before);
      });
      const sq = capturedSquare(before, move);
      const taken = sq ? pieceAt(before, sq) : null;
      if (taken && taken.color === r.boss!.crowdSide) caught++;
      expect(marks).toEqual(taken && taken.color === r.boss!.crowdSide ? [sq] : []);
      // (His first unlock: the queen lock when it could come then, your queen on the board with a save (Eric, Nov 18; the review of
      // #797), or with none it can aim at your best rook with one (Nov 19); else the usual random one. Here your queen is deep in his
      // camp with nothing to put in front of her, so it aims at a rook of yours.)
      if (caught === 1 && marks.length) {
        const aim = queenLockAim(fenOf(r), r.boss!.crowdSide, 0, 0);
        expect([cOf(r).unlocked[0], aim && pieceAt(fenOf(r), aim)?.type]).toEqual(["queenlock", "r"]);
      }
      // (Upgrades 1 and 2 come with the captures; the hunt only once both have taught it.)
      expect([cOf(r).upgrades, cOf(r).marked ?? 0, cOf(r).taught]).toEqual([caught, caught, caught >= S.teachCaptures ? true : undefined]);
    }
    expect(caught).toBe(S.teachCaptures);
  });

  it("the queen lock is his first unlock while it could come then (a queen of yours with a save); else as before (Eric, Nov 18: make that upgrade happen earlier; the review of #797)", async () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(unlockPick([], seed, 0, true)).toBe("queenlock");
      expect(unlockPick(["beam"], seed, 1, true)).toBe("queenlock");
      expect(unlockPick(["queenlock"], seed, 1, true)).not.toBe("queenlock");
    }
    expect(new Set(Array.from({ length: 40 }, (_, seed) => unlockPick([], seed, 0, false))).size).toBe(5);
    // (Your queen taken by his first capture: no queen; your queen on d1 with no pawn, knight or bishop to put in front of her: the
    // queen lock couldn't come. Either way his unlock is the usual random one, never forced.)
    for (const fen of ["4k3/8/5n2/3Q4/8/8/8/R3K3 b - - 0 1", "4k3/8/5n2/3N4/8/8/8/R2QK3 b - - 0 1"]) {
      const picks = new Set<string>();
      for (let seed = 0; seed < 30; seed++) {
        const r = battle(seed);
        await crowdMove(r);
        onPosition(r, fen, "w");
        r.applyBossMove("f6d5");
        expect(queenLockAim(fenOf(r), "w", seed, 0)).toBeNull();
        picks.add(cOf(r).unlocked[0]!);
      }
      expect(picks.size).toBeGreaterThan(2);
    }
    // (Your queen still there, your d2 pawn in front of her: the queen lock.)
    const r = battle(3);
    await crowdMove(r);
    onPosition(r, "4k3/8/5n2/3N4/8/8/3P4/R2QK3 b - - 0 1", "w");
    r.applyBossMove("f6d5");
    expect(cOf(r).unlocked).toEqual(["queenlock"]);
  });

  it("his first capture: the crosshair locks onto the piece right before he takes it (never steered), then upgrade 1; your queen too", async () => {
    for (const [fen, move, square, piece] of [
      // (Black to move, his knight on f6 takes your knight on d5.)
      ["4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "f6d5", "d5", "n"],
      // (His first capture is your queen on d5: it still counts as the teaching lock and the upgrade.)
      ["4k3/8/5n2/3Q4/8/8/8/R3K3 b - - 0 1", "f6d5", "d5", "q"],
    ] as const) {
      const r = battle(3);
      await crowdMove(r);
      onPosition(r, fen, "w");
      // (No lock to steer toward: that move is his engine's own.)
      expect(r.bossLocks()).toBeNull();
      // (A quiet move marks nothing.)
      expect(r.bossMoveMoment("e8d8")).toBe(0);
      expect(r.bossMoveMoment(move)).toBe(CHANDY_FX.lockOn);
      expect(cOf(r).locks).toEqual([{ square, piece, at: 0 }]);
      expect(r.boss!.powers!.events.filter((e) => e.kind === "lockOn")).toEqual([{ kind: "lockOn", turn: r.boss!.powers!.turn, square, first: true }]);
      expect(r.bossLocks()).toBeNull();
      // (Marked once: the server asks again as it plays the held move.)
      expect(r.bossMoveMoment(move)).toBe(0);
      expect(pieceAt(fenOf(r), square)?.type).toBe(piece);
      r.applyBossMove(move);
      const c = cOf(r);
      // (Taught once: his second capture teaches it too, Eric, Nov 18; the hunt from then.)
      expect([c.marked, c.taught, c.upgrades, c.locks.filter((l) => l.square === square)]).toEqual([1, undefined, 1, []]);
      expect(r.boss!.powers!.events.find((e) => e.kind === "upgrade")).toMatchObject({ stage: 1, unlock: c.unlocked[0] });
    }
  });

  it("his first capture counts where nothing marked it (the sims), and a mark on a piece his move didn't take goes", async () => {
    const r = battle(3);
    await crowdMove(r);
    onPosition(r, "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w");
    r.applyBossMove("f6d5");
    expect([cOf(r).marked, cOf(r).upgrades]).toEqual([1, 1]);
    // (Marked on d5, but the move played took the a1 rook: that's his first capture, and the mark goes.)
    const r2 = battle(3);
    await crowdMove(r2);
    onPosition(r2, "r3k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w");
    expect(r2.bossMoveMoment("f6d5")).toBe(CHANDY_FX.lockOn);
    r2.applyBossMove("a8a1");
    // (The mark, from before his move, is gone; no hunt yet: his second capture teaches too.)
    expect([cOf(r2).marked, cOf(r2).upgrades, cOf(r2).locks]).toEqual([1, 1, []]);
  });

  it("the test switch's capture (?power=lockon): a capture that nets him no loss, the most netting first; null: none", () => {
    // (Black to move: his knight takes your free knight on d5 (3) rather than your defended pawn.)
    expect(testCapture("4k3/8/5n2/3N4/4Q3/8/8/4K3 b - - 0 1", "w", 9)).toBe("f6e4");
    expect(testCapture("4k3/8/5n2/3N4/8/8/8/4K3 b - - 0 1", "w", 9)).toBe("f6d5");
    // (Your knight on d5 defended by a pawn on e4 and only his rook can take it: a loss by the exchange check.)
    expect(testCapture("3rk3/8/8/3N4/4P3/8/8/4K3 b - - 0 1", "w", 9)).toBeNull();
  });

  it("a lock's pips count its turns left (3, 2, 1) and it ends: piece gone, past 5, or past 3 and safe", () => {
    const l = { square: "d5", piece: "n", at: 4 };
    expect([4, 5, 6].map((moves) => lockLeft({ moves }, l))).toEqual([3, 2, 1]);
    expect(lockLeft({ moves: 7 }, l)).toBe(2);
    const free = "4k3/8/5n2/3N4/8/8/8/4K3 w - - 0 1";
    const safe = "4k3/8/8/3N4/8/8/8/4K3 w - - 0 1";
    expect(lockEnds(free, "w", { moves: 6 }, l)).toBe(false);
    expect(lockEnds(free, "w", { moves: 7 }, l)).toBe(false);
    expect(lockEnds(free, "w", { moves: 9 }, l)).toBe(true);
    expect(lockEnds(safe, "w", { moves: 6 }, l)).toBe(false);
    expect(lockEnds(safe, "w", { moves: 7 }, l)).toBe(true);
    expect(lockEnds("4k3/8/5n2/8/8/8/8/4K3 w - - 0 1", "w", { moves: 5 }, l)).toBe(true);
  });

  it("follows its piece through a move, castling's rook too; one taken is gone; a pawn that promotes takes its new letter", () => {
    const fen = "r3k3/8/8/8/8/8/8/4K2R w K - 0 1";
    expect(locksAfter(fen, "e1g1", [{ square: "h1", piece: "r", at: 0 }])).toEqual([{ square: "f1", piece: "r", at: 0 }]);
    expect(locksAfter("4k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5f6", [{ square: "d5", piece: "n", at: 0 }])).toEqual([{ square: "f6", piece: "n", at: 0 }]);
    expect(locksAfter("4k3/8/5n2/3N4/8/8/8/4K3 b - - 0 1", "f6d5", [{ square: "d5", piece: "n", at: 0 }])).toEqual([]);
    const queened = locksAfter("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8q", [{ square: "a7", piece: "p", at: 0 }]);
    expect(queened).toEqual([{ square: "a8", piece: "q", at: 0 }]);
    expect(lockEnds("Q3k3/8/8/8/8/8/8/4K3 b - - 0 1", "w", { moves: 1 }, queened[0]!)).toBe(true);
  });

  it("a locked pawn that promotes to a queen is unlocked at once: never the queen, nor steered at (the review's L1)", async () => {
    const r = battle(3);
    // (Your locked pawn on a7, a rook's pawn on b6 locked too; you queen the a-pawn.)
    onPosition(r, "8/P6k/1P6/8/8/8/8/4K3 w - - 0 1", "w", { locks: [{ square: "a7", piece: "p", at: 0 }, { square: "b6", piece: "p", at: 0 }], taught: true });
    await crowdMove(r, () => "a7a8q");
    expect(r.bossToMove()).toBe(true);
    expect(cOf(r).locks).toEqual([{ square: "b6", piece: "p", at: 0 }]);
    expect(r.bossLocks()).toEqual(["b6"]);
    // (Under-promoted: the lock follows it, its new letter.)
    const r2 = battle(3);
    onPosition(r2, "8/P6k/8/8/8/8/8/4K3 w - - 0 1", "w", { locks: [{ square: "a7", piece: "p", at: 0 }], taught: true });
    await crowdMove(r2, () => "a7a8n");
    expect(cOf(r2).locks).toEqual([{ square: "a8", piece: "n", at: 0 }]);
  });
});

describe("the steering (L3)", () => {
  // (Black to move: his knight on f6 can take your knight on d5, or play quietly.)
  const fen = "4k3/8/5n2/3N4/8/8/8/4K3 b - - 0 1";
  const top = (take: number): MoveScore[] => [
    { move: "e8d7", expected: 0.6 },
    { move: "f6d5", expected: take },
    { move: "f6g4", expected: 0.55 },
  ];
  it("takes a locked piece within 2 pawns of his best, never further", () => {
    // (0.35 against 0.6: about 1.1 pawns on the log-odds scale.)
    expect(steerPick(fen, "e8d7", top(0.35), ["d5"])).toBe("f6d5");
    // (0.15: about 2.3 pawns: his own pick.)
    expect(steerPick(fen, "e8d7", top(0.15), ["d5"])).toBe("e8d7");
    // (No lock: his pick.)
    expect(steerPick(fen, "e8d7", top(0.35), [])).toBe("e8d7");
  });
  it("else chases within three quarters of a pawn: a move adding an attacker on a locked piece; his own pick when it does", () => {
    // (Your knight on d4 locked; his king e8, his knight b8: Nc6 attacks d4.)
    const f = "1n2k3/8/8/8/3N4/8/8/4K3 b - - 0 1";
    const lines: MoveScore[] = [
      { move: "e8d7", expected: 0.6 },
      { move: "b8c6", expected: 0.55 },
      { move: "b8a6", expected: 0.59 },
    ];
    expect(steerPick(f, "e8d7", lines, ["d4"])).toBe("b8c6");
    // (Too far: 0.3 against 0.6 is more than three quarters of a pawn.)
    expect(steerPick(f, "e8d7", [lines[0]!, { move: "b8c6", expected: 0.3 }], ["d4"])).toBe("e8d7");
  });
});

describe("the rifle and the move meter", () => {
  it("unlocks a random move per upgrade, all five in the end; the meter uses a new unlock first, else one at random", () => {
    const got: string[] = [];
    for (let n = 0; n < 5; n++) got.push(unlockPick(got as never, 17, n)!);
    expect([...got].sort()).toEqual([...CHANDY_MOVES].sort());
    expect(unlockPick([...CHANDY_MOVES], 17, 5)).toBeNull();
    expect(meterPick({ unlocked: ["beam", "shields"], fresh: "shields", used: 3 }, 1)).toBe("shields");
    const seen = new Set<string>();
    for (let used = 0; used < 40; used++) seen.add(meterPick({ unlocked: ["beam", "shields", "scatter"], fresh: null, used }, 5)!);
    expect(seen.size).toBe(3);
    expect(meterPick({ unlocked: ["queenlock"], fresh: "queenlock", used: 0 }, 5, ["queenlock"])).toBeNull();
  });

  it("never the same move twice in a row while another can come (Eric, Nov 16: beam, then beam again, with two unlocked)", () => {
    for (let seed = 0; seed < 30; seed++)
      for (let used = 0; used < 30; used++) {
        expect(meterPick({ unlocked: ["beam", "shields"], fresh: null, used, last: "beam" }, seed)).toBe("shields");
        expect(meterPick({ unlocked: ["beam", "shields", "scatter"], fresh: null, used, last: "scatter" }, seed)).not.toBe("scatter");
        // (The only move left, or the others can't come now: it may repeat.)
        expect(meterPick({ unlocked: ["beam"], fresh: null, used, last: "beam" }, seed)).toBe("beam");
        expect(meterPick({ unlocked: ["beam", "queenlock"], fresh: null, used, last: "beam" }, seed, ["queenlock"])).toBe("beam");
      }
  });

  it("the least fired first, ties at random; the one he fired last only when nothing else can come (Eric, Nov 18)", () => {
    const all = [...CHANDY_MOVES];
    for (let seed = 0; seed < 30; seed++)
      for (let used = 0; used < 30; used++) {
        // (Scatter fired twice, the others once: never scatter; the queen lock, never fired, first while it can come.)
        const fired = { scatter: 2, beam: 1, shields: 1, rapidfire: 1 };
        expect(meterPick({ unlocked: all, fresh: null, used, last: "beam", fired }, seed)).toBe("queenlock");
        expect(["shields", "rapidfire"]).toContain(meterPick({ unlocked: all, fresh: null, used, last: "beam", fired }, seed, ["queenlock"]));
        // (The least fired is the one he fired last: the next least fired instead.)
        expect(meterPick({ unlocked: ["beam", "shields"], fresh: null, used, last: "beam", fired: { beam: 1, shields: 3 } }, seed)).toBe("shields");
        // (A new unlock still first.)
        expect(meterPick({ unlocked: all, fresh: "scatter", used, last: "beam", fired }, seed)).toBe("scatter");
        // (The whole order: beam and rapid fire (once each) at random, then scatter (twice), the one he fired last at the end.)
        const order = meterOrder({ unlocked: all, fresh: null, used, last: "shields", fired }, seed, ["queenlock"]);
        expect([[...order.slice(0, 2)].sort(), order.slice(2)]).toEqual([["beam", "rapidfire"], ["scatter", "shields"]]);
      }
    const seen = new Set<string>();
    for (let used = 0; used < 40; used++) seen.add(meterPick({ unlocked: all, fresh: null, used, fired: { scatter: 1, beam: 1, shields: 1, rapidfire: 1, queenlock: 1 } }, 3)!);
    expect(seen.size).toBe(5);
  });

  it("a pick that can't land takes the next in the meter's order: not the one he fired last (shields with only his king left)", async () => {
    const r = battle(3);
    await crowdMove(r);
    // (White to move, his king alone: shields can't land. He fired beam last; scatter and rapid fire fired as often as beam: rapid fire
    // fired least, so it comes, never beam again.)
    onPosition(r, "4k3/8/8/8/8/8/PPP5/RN2K3 w - - 0 1", "w", { upgrades: 5, unlocked: [...CHANDY_MOVES], due: "shields", meter: S.meterEvery, last: "beam", fired: { beam: 2, scatter: 2, rapidfire: 1, shields: 1 } });
    // (The crowd's turn begins as after his move: the turn set up again.)
    const id = r.state.boards[0]!;
    const board = r.boards.get(id)!;
    r.boss!.powers!.turn = 0;
    r.boards.set(id, board);
    (r as unknown as { preparePowers(): void }).preparePowers();
    const c = cOf(r);
    expect(r.boss!.powers!.events.some((e) => e.kind === "rapidFire")).toBe(true);
    expect([c.last, c.due ?? null, c.fired?.rapidfire]).toEqual(["rapidfire", null, 2]);
  });

  it("a real seeded battle with all five (?power=dodge): his moves come in turn, never twice in a row (Eric, Nov 18)", async () => {
    // (Eric, Nov 18: "he literally had all 5 but kept spamming the scatter shot". Before: beam, rapid fire, beam, scatter, shields, beam,
    // beam, beam: a pick that couldn't land (rapid fire, no piece of yours with a move but your king) fell through to a random other,
    // the one he fired last; and nothing kept the four even. docs/decisions/2026-11-18-chandy-move-mix.md.)
    const seq = await movesOf(10, "w", "dodge", KIT_STRESS, 50);
    expect(seq.length).toBeGreaterThanOrEqual(7);
    for (let i = 1; i < seq.length; i++) expect(seq[i], `move ${i + 1} of ${seq.join(", ")}`).not.toBe(seq[i - 1]);
    // (The four that can come here stay within one of each other: none comes a third time before each has come twice.)
    const four = ["scatter", "beam", "shields", "rapidfire"];
    for (let i = 1; i <= seq.length; i++) {
      const n = four.map((m) => seq.slice(0, i).filter((x) => x === m).length);
      expect(Math.max(...n) - Math.min(...n), `after ${i} of ${seq.join(", ")}`).toBeLessThanOrEqual(1);
    }
  });

  it("only taking a locked piece upgrades the rifle; the window shows as your turn begins", async () => {
    const r = battle(3);
    await crowdMove(r);
    // (Black to move: he takes your locked knight on d5.)
    onPosition(r, "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w", { locks: [{ square: "d5", piece: "n", at: 0 }], taught: true });
    r.applyBossMove("f6d5");
    const c = cOf(r);
    expect(c.upgrades).toBe(1);
    expect(c.unlocked.length).toBe(1);
    expect(c.fresh).toBe(c.unlocked[0]);
    expect(r.boss!.powers!.events.find((e) => e.kind === "upgrade")).toMatchObject({ stage: 1, unlock: c.unlocked[0] });
    // (A capture of an unlocked piece: nothing.)
    const r2 = battle(3);
    await crowdMove(r2);
    onPosition(r2, "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w", { locks: [{ square: "a1", piece: "r", at: 0 }], taught: true });
    r2.applyBossMove("f6d5");
    expect(cOf(r2).upgrades).toBe(0);
  });

  it("a new unlock fires on his turn after its upgrade window, whatever his meter says; then the meter starts over (fireOnUnlock)", async () => {
    const r = battle(3);
    await crowdMove(r);
    // (Four moves unlocked, the meter empty: taking your locked knight unlocks the fifth, rapid fire.)
    onPosition(r, "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w", { upgrades: 4, unlocked: ["scatter", "beam", "shields", "queenlock"], meter: 0, locks: [{ square: "d5", piece: "n", at: 0 }], taught: true });
    r.applyBossMove("f6d5");
    expect(cOf(r).upgrade).toMatchObject({ stage: 5, unlock: "rapidfire" });
    // (Your move after the window: his meter full, the unlock picked; it lands as your next turn begins, after his move.)
    await crowdMove(r);
    expect([cOf(r).due, cOf(r).meter]).toEqual(["rapidfire", S.meterEvery]);
    await r.playBoss();
    expect(r.boss!.powers!.events.some((e) => e.kind === "rapidFire")).toBe(true);
    expect([cOf(r).due ?? null, cOf(r).meter]).toEqual([null, 0]);
  });

  it("a new queen lock that can't come then waits for the meter; fireOnUnlock off, the meter as before", async () => {
    // (No queen of yours: the queen lock can't come; the meter takes its notch and nothing is due.)
    const r = battle(3);
    await crowdMove(r);
    onPosition(r, "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w", { upgrades: 4, unlocked: ["scatter", "beam", "shields", "rapidfire"], meter: 0, locks: [{ square: "d5", piece: "n", at: 0 }], taught: true });
    r.applyBossMove("f6d5");
    expect(cOf(r).upgrade).toMatchObject({ unlock: "queenlock" });
    await crowdMove(r);
    expect([cOf(r).due ?? null, cOf(r).meter]).toEqual([null, 1]);
    const set = BOSS_POWERS.chandy as { fireOnUnlock: boolean };
    set.fireOnUnlock = false;
    try {
      const r2 = battle(3);
      await crowdMove(r2);
      onPosition(r2, "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w", { upgrades: 4, unlocked: ["scatter", "beam", "shields", "queenlock"], meter: 0, locks: [{ square: "d5", piece: "n", at: 0 }], taught: true });
      r2.applyBossMove("f6d5");
      await crowdMove(r2);
      expect([cOf(r2).due ?? null, cOf(r2).meter]).toEqual([null, 1]);
    } finally {
      set.fireOnUnlock = true;
    }
  });

  it("fills a notch a move of yours from the first upgrade, and full, his move lands as your next turn begins", async () => {
    const r = battle(5);
    await crowdMove(r);
    onPosition(r, fenOf(r), r.boss!.crowdSide, { upgrades: 1, unlocked: ["shields"], fresh: "shields", meter: S.meterEvery - 1 });
    // (The crowd to move again? Play his move, then the crowd's.)
    if (r.bossToMove()) await r.playBoss();
    await crowdMove(r);
    expect(cOf(r).due).toBe("shields");
    await r.playBoss();
    const c = cOf(r);
    expect(c.due ?? null).toBeNull();
    expect(c.meter).toBe(0);
    const ev = r.boss!.powers!.events.find((e) => e.kind === "shields");
    expect(ev?.squares?.length).toBeGreaterThan(0);
    expect(powerTurn(r.boss)).toBe(true);
  });
});

describe("his five moves", () => {
  it("scatter shot: four empty squares round a spot, nobody lands there (a slide passes), never leaving you no move", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4";
    const pick = chooseScatter(fen, "w", 11, 0)!;
    expect(pick.squares.length).toBe(S.scatterSquares);
    expect(pieceAt(fen, pick.spot)).toBeNull();
    for (const sq of pick.squares) {
      expect(pieceAt(fen, sq)).toBeNull();
      expect(Math.max(Math.abs(sq.charCodeAt(0) - pick.spot.charCodeAt(0)), Math.abs(Number(sq[1]) - Number(pick.spot[1])))).toBe(1);
    }
    expect(stopReason({ id: "chandy", powers: { turn: 1, chandy: { scatter: { squares: ["e2"] } } } }, "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "e1e2")).toBe("scatter");
    // (A rook slides through a scatter square.)
    expect(stopReason({ id: "chandy", powers: { turn: 1, chandy: { scatter: { squares: ["c1"] } } } }, "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "a1d1")).toBeNull();
  });

  it("beam: a rank and a file, never your king's, walls for your turn and your pieces in it held; a knight jumps", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4";
    for (let n = 0; n < 20; n++) {
      const b = chooseBeam(fen, "w", 7, n)!;
      expect(b.rank).not.toBe(1);
      expect(b.file).not.toBe("e");
      expect(b.squares.length).toBe(15);
      expect(legalMoves(fen).some((m) => beamAllows(fen, m, b.squares))).toBe(true);
    }
    const squares = ["c3", "c4", "a4", "b4", "d4", "e4", "f4", "g4", "h4", "c1", "c2", "c5", "c6", "c7", "c8"];
    // (Your knight on c3 is in it: held. Your bishop on f1 can't slide through e2? Not covered; d1 queen to d4: a wall.)
    expect(beamAllows(fen, "c3d5", squares)).toBe(false);
    expect(beamAllows(fen, "d1e2", squares)).toBe(true);
    expect(beamAllows(fen, "f1c4", squares)).toBe(false);
    // (Your knight on f3 jumps over the beam's rank to g5? Not in it, and lands outside: allowed.)
    expect(beamAllows(fen, "f3g5", squares)).toBe(true);
  });

  it("shields: two of his pieces you attack, never his king or a piece giving check; you can't take them this turn", () => {
    // (White to move: your bishop on b5 attacks his knight on c6, your knight on f3 his pawn on e5; his queen gives check from a5? no.)
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const sh = chooseShields(fen, "w", 3, 0);
    expect(sh.length).toBe(2);
    expect(sh).toContain("c6");
    expect(sh).toContain("e5");
    expect(stopReason({ id: "chandy", powers: { turn: 2, chandy: { shields: { squares: ["c6"] } } } }, fen, "b5c6")).toBe("shield");
    // (A piece giving check is never shielded.)
    const check = "4k3/8/8/8/8/8/3q4/4K3 w - - 0 1";
    expect(chooseShields(check, "w", 3, 0)).not.toContain("d2");
  });

  it("rapid fire: three of your pieces with a move, never the king, always a move left", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4";
    for (let n = 0; n < 20; n++) {
      const sq = chooseRapid(fen, "w", 9, n);
      expect(sq.length).toBe(S.rapidCount);
      expect(sq).not.toContain("e1");
      expect(legalMoves(fen).some((m) => !heldIn(fen, m, sq))).toBe(true);
    }
    // (Your king and one pawn: only the pawn could be held, and holding it leaves the king's moves.)
    expect(chooseRapid("4k3/8/8/8/8/8/P7/4K3 w - - 0 1", "w", 1, 0)).toEqual(["a2"]);
  });
});

describe("the queen lock", () => {
  it("aims only when a pawn, knight or bishop can stand between her and his edge; never with no queen", () => {
    // (Your queen on d1 behind your d2 pawn: a save is already there.)
    expect(queenLockAim("4k3/8/8/8/8/8/3P4/3QK3 w - - 0 1", "w", 1, 0)).toBe("d1");
    // (Your queen on d4, only a rook beside her: no pawn, knight or bishop can block: no aim.)
    expect(queenLockAim("4k3/8/8/8/3Q4/8/8/R3K3 w - - 0 1", "w", 1, 0)).toBeNull();
    // (Your queen on d4 and a knight on b3 that can step to d2? Behind her; to c5? No: the knight to d5? b3 can't. A bishop on c4 to d5: yes.)
    expect(queenLockAim("4k3/8/8/8/2BQ4/8/8/4K3 w - - 0 1", "w", 1, 0)).toBe("d4");
    expect(queenLockAim("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "w", 1, 0)).toBeNull();
    // (Black's queen lock from White's edge: your queen on d8 behind a pawn on d7.)
    expect(queenLockAim("3qk3/3p4/8/8/8/8/8/4K3 b - - 0 1", "b", 1, 0)).toBe("d8");
  });

  it("with no queen of yours it can aim at, it aims at your best rook (Eric, Nov 19): the most gettable (lockRank), ties by the seed; never a rook with no save", () => {
    // (No queen: the a1 rook behind its pawn; the h1 rook has nothing to put in front of it.)
    expect(queenLockAim("4k3/8/8/8/8/8/P7/R3K2R w - - 0 1", "w", 1, 0)).toBe("a1");
    // (Both rooks behind a pawn; his bishop on f3 hits the undefended h1 rook: h1, whatever the seed.)
    for (let seed = 0; seed < 10; seed++) expect(queenLockAim("4k3/8/8/8/8/5b2/P6P/R3K2R w - - 0 1", "w", seed, 0)).toBe("h1");
    // (Both alike: the seed picks.)
    expect(new Set(Array.from({ length: 20 }, (_, seed) => queenLockAim("4k3/8/8/8/8/8/P6P/R3K2R w - - 0 1", "w", seed, 0)))).toEqual(new Set(["a1", "h1"]));
    // (A queen it can aim at comes first; a queen with no save gives way to the rook.)
    expect(queenLockAim("4k3/8/8/8/8/8/P2P4/R2QK3 w - - 0 1", "w", 1, 0)).toBe("d1");
    expect(queenLockAim("4k3/8/8/8/3Q4/8/P7/R3K3 w - - 0 1", "w", 1, 0)).toBe("a1");
    // (Black's rook lock from White's edge.)
    expect(queenLockAim("r3k3/p7/8/8/8/8/8/4K3 b - - 0 1", "b", 1, 0)).toBe("a8");
  });

  it("aims at the rook, follows it, and the shot lands: your queen gone (Eric, Nov 19)", async () => {
    const r = battle(8);
    await crowdMove(r);
    // (Black to move, his meter full with the queen lock: no queen of yours; your rook on d1 behind your d2 pawn.)
    onPosition(r, "4k3/pppp4/8/8/8/8/3PP3/3R2K1 b - - 0 1", "w", { upgrades: 1, unlocked: ["queenlock"], due: "queenlock", meter: S.meterEvery });
    expect(r.queenLockDue()).toBe(true);
    expect(r.applyQueenLock(null)).toBe("d1");
    expect(r.boss!.powers!.events.find((e) => e.kind === "queenAim")).toMatchObject({ square: "d1", shape: "r" });
    // (Your free move: the rook slides behind the e2 pawn; the aim follows it, and the shot at the start of his turn shatters e2.)
    await crowdMove(r, () => "d1e1");
    expect(cOf(r).shot).toMatchObject({ square: "e2", piece: "p" });
    expect(pieceAt(fenOf(r), "e2")).toBeNull();
    expect(pieceAt(fenOf(r), "e1")).toMatchObject({ type: "r", color: "w" });
  });

  it("fires down her file: the first of your pieces from his edge shatters; your king stops it; nothing in the way, she falls; his own pieces don't stop it", () => {
    // (Black to move; his rook on d8 doesn't stop the shot; your pawn on d2 shatters.)
    expect(queenShot("3rk3/8/8/8/8/8/3P4/3QK3 b - - 0 1", "d1", "w")).toMatchObject({ square: "d2", piece: "p" });
    // (Your king in the way: it stops.)
    expect(queenShot("4k3/8/8/8/8/8/3K4/3Q4 b - - 0 1", "d1", "w").square).toBeNull();
    // (Nothing in the way: she falls.)
    const shot = queenShot("4k3/8/8/8/8/8/8/3QK3 b - - 0 1", "d1", "w");
    expect(shot.square).toBe("d1");
    expect(pieceAt(shot.fen, "d1")).toBeNull();
  });

  it("fizzles rather than leave your king attacked with him to move", () => {
    // (Your pawn on c4 shields your king on b3 from his bishop on e6; the shot down c would hit it.)
    const fen = "4k3/8/4b3/8/2P5/1K6/8/2Q5 b - - 0 1";
    const shot = queenShot(fen, "c1", "w");
    expect(shot.square).toBeNull();
    expect(kingAttacked(shot.fen, "w")).toBe(false);
  });

  it("is his whole turn: the aim, your free move, then the shot at the start of his next turn", async () => {
    const r = battle(8);
    await crowdMove(r);
    // (Black to move, his meter full with the queen lock: your queen on d1 behind your d2 pawn.)
    onPosition(r, "4k3/pppp4/8/8/8/8/3P4/3QK2R b - - 0 1", "w", { upgrades: 1, unlocked: ["queenlock"], due: "queenlock", meter: S.meterEvery });
    expect(r.queenLockDue()).toBe(true);
    expect(r.applyQueenLock(null)).toBe("d1");
    expect(r.bossToMove()).toBe(false);
    expect(cOf(r).aim).toMatchObject({ square: "d1" });
    expect(r.boss!.powers!.events.some((e) => e.kind === "queenAim")).toBe(true);
    // (Your free move: the king steps aside; then the shot at the start of his turn: the d2 pawn shatters.)
    await crowdMove(r, () => "e1f2");
    expect(cOf(r).shot).toMatchObject({ square: "d2", piece: "p" });
    expect(pieceAt(fenOf(r), "d2")).toBeNull();
    expect(chandyTurnMs(r.boss)).toBeGreaterThan(0);
  });
});

describe("the queen lock's pass guard (the review's M1)", () => {
  it("refused (passing would lose real material): the meter picks another unlocked move, which lands as your turn begins; none: it's due again on his next turn", async () => {
    const r = battle(8);
    await crowdMove(r);
    onPosition(r, "4k3/pppp4/8/8/8/8/3P4/3QK2R b - - 0 1", "w", { upgrades: 2, unlocked: ["queenlock", "rapidfire"], fresh: "queenlock", due: "queenlock", meter: S.meterEvery });
    expect(r.queenLockDue()).toBe(true);
    expect(r.applyQueenLock(PASS_WAIT)).toBeNull();
    expect(cOf(r).due).toBe("rapidfire");
    expect(r.queenLockDue()).toBe(false);
    expect(r.bossToMove()).toBe(true);
    await r.playBoss();
    expect(r.boss!.powers!.events.some((e) => e.kind === "rapidFire")).toBe(true);
    expect(cOf(r).due ?? null).toBeNull();
    expect(cOf(r).meter).toBe(0);
    // (The queen lock alone unlocked: it stays due, the meter full, and it's checked again on his next turn: the pass guard's rule for
    // every power that spends his turn, Oct 18. Until Nov 18 the meter emptied, leaving his first unlock dead until upgrade 2.)
    const r2 = battle(8);
    await crowdMove(r2);
    onPosition(r2, "4k3/pppp4/8/8/8/8/3P4/3QK2R b - - 0 1", "w", { upgrades: 1, unlocked: ["queenlock"], fresh: "queenlock", due: "queenlock", meter: S.meterEvery });
    expect(r2.applyQueenLock(PASS_WAIT)).toBeNull();
    expect([cOf(r2).due, cOf(r2).meter, r2.queenLockDue(), r2.bossToMove()]).toEqual(["queenlock", S.meterEvery, false, true]);
    r2.applyBossMove("a7a6");
    await crowdMove(r2, () => "h1g1");
    expect([cOf(r2).due, cOf(r2).meter, r2.queenLockDue()]).toEqual(["queenlock", S.meterEvery, true]);
    expect(r2.applyQueenLock(null)).toBe("d1");
    expect([cOf(r2).due ?? null, cOf(r2).meter]).toEqual([null, 0]);
  });
});

describe("Dodge (D1-D12)", () => {
  const lineOn = (rank: number): DodgeLine => ({ rank, side: "left" });
  it("always exactly one safe square: two ranks and two files of the 3 x 3 that miss any square leave only it (every square, both sides)", () => {
    for (const crowd of ["w", "b"] as const) {
      const center = dodgeCenter(crowd);
      expect(center).toBe(crowd === "w" ? "e4" : "e5");
      for (const safe of dodgeArena(center)) {
        const ranks = dodgeArena(center).map((sq) => Number(sq[1])).filter((x, i, a) => a.indexOf(x) === i && x !== Number(safe[1]));
        const files = dodgeArena(center).map((sq) => sq[0]!).filter((x, i, a) => a.indexOf(x) === i && x !== safe[0]);
        expect(safeSquares(center, [...ranks.map(lineOn), ...files.map((file) => ({ file }))])).toEqual([safe]);
      }
    }
  });

  it("every round, after every teleport, one safe square, moved one step each time; 1, 2, then 3 teleports; never the round before's", () => {
    for (let seed = 0; seed < 300; seed++)
      for (const crowd of ["w", "b"] as const) {
        const center = dodgeCenter(crowd);
        const rounds = dodgeRounds(center, seed, 1 + (seed % 2));
        expect(rounds.map((r) => r.teleports.length)).toEqual([1, 2, 3]);
        let prev: string | null = null;
        for (const round of rounds) {
          expect(round.lines.filter((l) => "rank" in l).length).toBe(2);
          expect(round.lines.filter((l) => "file" in l).length).toBe(2);
          let at = safeSquares(center, round.lines);
          expect(at.length).toBe(1);
          for (let k = 1; k <= round.teleports.length; k++) {
            const now = safeSquares(center, linesAfter(round, k));
            expect(now.length).toBe(1);
            const df = Math.abs(now[0]!.charCodeAt(0) - at[0]!.charCodeAt(0));
            const dr = Math.abs(Number(now[0]![1]) - Number(at[0]![1]));
            expect(df + dr).toBe(1);
            // (A clone keeps to its kind: a rank's to a rank, a file's to a file; on the board's edge squares.)
            const t = round.teleports[k - 1]!;
            expect("rank" in t.to).toBe("rank" in round.lines[t.clone]!);
            at = now;
          }
          expect(at[0]).toBe(round.safe);
          expect(round.safe).not.toBe(prev);
          prev = round.safe;
        }
      }
  });

  it("times the teleports from the settings, the last never less than 1.2 s before the vote closes (round 3's exactly); 3 s each round, 300 ms grace", () => {
    const tl = dodgeTimeline();
    expect(tl.rounds.length).toBe(3);
    tl.rounds.forEach((r, k) => {
      expect(r.voteEnd - r.voteAt).toBe(3000);
      expect(r.closeAt - r.voteEnd).toBe(300);
      expect(r.teleports.length).toBe(k + 1);
      expect(r.voteEnd - r.teleports.at(-1)!).toBeGreaterThanOrEqual(1200);
      for (const t of r.teleports) expect(t).toBeGreaterThan(r.voteAt);
    });
    expect(tl.rounds[2]!.voteEnd - tl.rounds[2]!.teleports.at(-1)!).toBe(1200);
    expect(S.dodgeTeleports).toEqual([[1200], [900, 1600], [800, 1400, 1800]]);
    // (Eric, Nov 16: the warning volley first, after the scope-in and the slide; each round's beams travel, then hold 2 to 3 s
    // before the next opens; two hits lose, the second's kill about 5 s.)
    expect(tl.volley.at).toBe(S.dodgeScopeMs + S.dodgeSlideMs);
    expect(tl.volley.landAt).toBeLessThan(tl.volley.end);
    expect(tl.rounds[0]!.openAt).toBe(tl.volley.end);
    for (const r of tl.rounds) {
      expect(r.hitAt - r.blastAt).toBe(3 * S.dodgeStaggerMs + S.dodgeTravelMs);
      expect(r.end - r.hitAt).toBeGreaterThanOrEqual(2000);
      expect(r.end - r.hitAt).toBeLessThanOrEqual(3000);
    }
    expect([S.dodgeHits, S.dodgeKillMs]).toEqual([2, 5000]);
    // (The whole of it: about 28 s survived, at most about 32 s when the second hit comes in the last round.)
    expect(tl.total).toBe(28050);
    const rounds = dodgeRounds("e4", 1, 1);
    expect(dodgeEndAt({ rounds, results: [] as never[] })).toBe(tl.rounds[0]!.end);
    const hit = { placed: "a1", hit: true, votes: {} };
    const ok = { placed: "a1", hit: false, votes: {} };
    expect(dodgeEndAt({ rounds, results: [hit, ok, hit] })).toBe(tl.rounds[2]!.hitAt + S.dodgeKillMs + S.dodgeShatterMs);
    expect(dodgeEndAt({ rounds, results: [hit, ok, hit] })).toBe(31550);
  });

  it("the warning volley's lines miss your king: the center is the only square of the 3 x 3 they leave", () => {
    for (const center of ["e4", "e5"])
      for (let seed = 0; seed < 20; seed++) {
        const v = dodgeVolley(center, seed, 1);
        expect(v.length).toBe(4);
        expect(safeSquares(center, v)).toEqual([center]);
      }
  });

  it("tallies the vote: the most votes; a tie drawn among the tied; nobody votes, a square from the seed", () => {
    const d = { center: "e4", n: 1, rounds: dodgeRounds("e4", 4, 1) };
    const safe = d.rounds[0]!.safe;
    const other = dodgeArena("e4").find((sq) => sq !== safe)!;
    expect(dodgeTally(d, 0, { a: safe, b: safe, c: other }, 4)).toMatchObject({ placed: safe, hit: false, votes: { [safe]: 2, [other]: 1 } });
    expect(dodgeTally(d, 0, { a: other }, 4)).toMatchObject({ placed: other, hit: true });
    const tie = dodgeTally(d, 0, { a: safe, b: other }, 4);
    expect([safe, other]).toContain(tie.placed);
    // (Junk and squares outside the 3 x 3 don't count.)
    expect(dodgeTally(d, 0, { a: "a1", b: 7 }, 4).random).toBe(true);
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const r = dodgeTally(d, 0, {}, seed);
      expect(r.random).toBe(true);
      expect(dodgeArena("e4")).toContain(r.placed);
      seen.add(r.placed);
    }
    // (Pure chance: every square comes.)
    expect(seen.size).toBe(9);
    // (A bot finds the safe square more often than not.)
    let hits = 0;
    for (let i = 0; i < 400; i++) if (botDodgeVote(d, 0, `b${i}`, 4) === safe) hits++;
    expect(hits / 400).toBeGreaterThan(0.55);
  });

  it("hides what hasn't come yet: the teleports until their time, the safe square until the round closes", () => {
    const rounds = dodgeRounds("e4", 2, 1);
    const d = { at: 3, n: 1, king: "g1", center: "e4", rounds, results: [] };
    const tl = dodgeTimeline();
    const early = dodgeSeen(d, tl.rounds[0]!.voteAt + 10);
    expect(early.rounds[0]!.teleports.length).toBe(0);
    expect(early.rounds.every((r) => r.safe === "")).toBe(true);
    const late = dodgeSeen(d, tl.rounds[0]!.teleports[0]! + 1);
    expect(late.rounds[0]!.teleports.length).toBe(1);
  });

  it("comes as your turn begins once the rifle is whole (the test switch): three dodged rounds and your turn; one hit cracks your king and play goes on; the second and the battle is his", async () => {
    for (const hits of [[], [1], [0, 2]] as number[][]) {
      const r = battle(21, "dodge");
      for (let i = 0; i < 6 && !r.dodgeDue(); i++) {
        if (r.bossToMove()) await r.playBoss();
        else await crowdMove(r);
      }
      expect(r.dodgeDue()).toBe(true);
      const before = fenOf(r);
      const d = cOf(r).dodge!;
      expect(d.king).toBe(r.boss!.crowdSide === "w" ? "e1" : d.king);
      expect(safeSquares(d.center, d.volley!)).toEqual([d.center]);
      for (let k = 0; k < 3 && r.dodgeDue(); k++) {
        const safe = cOf(r).dodge!.rounds[k]!.safe;
        const wrong = dodgeArena(d.center).find((sq) => sq !== safe)!;
        const res = r.finishDodgeRound({ h0: hits.includes(k) ? wrong : safe })!;
        expect(res.hit).toBe(hits.includes(k));
        // (One hit: no win yet.)
        if (hits.includes(k) && hits.indexOf(k) === 0) expect(r.boss!.powers!.events.some((e) => e.kind === "dodgeWin")).toBe(false);
      }
      const won = hits.length >= S.dodgeHits;
      expect(fenOf(r)).toBe(before);
      expect(r.dodgeDue()).toBe(false);
      expect(r.stageComplete()).toBe(won);
      if (won) {
        expect(r.boss!.powers!.events.some((e) => e.kind === "dodgeWin")).toBe(true);
        expect(cOf(r).dodge!.results.length).toBe(3);
        expect(r.finishBossBattle()).toBe("boss");
      } else expect(cOf(r).dodge!.results.length).toBe(3);
    }
  });

  it("before the rifle is whole, his rage meter gathers nothing and stays dimmed: no move, capture or strike fills it", async () => {
    const r = battle(13);
    for (let i = 0; i < 12 && !r.stageComplete(); i++) {
      if (r.bossToMove()) await r.playBoss();
      else await crowdMove(r);
      // (Not the last chance's Dodge, a mate of yours in one: the rifle's alone.)
      if (cOf(r).upgrades >= S.upgradesMax || r.boss!.powers!.ults) break;
      expect(rageOf(r.boss)).toBe(0);
      expect(r.bossView()!.powers!.chandy!.rageLocked).toBe(true);
      // (The God King's strike adds nothing to his meter.)
      expect(rageOf(strikeRage(r.boss!))).toBe(0);
    }
    expect(cOf(r).upgrades).toBeLessThan(5);
    expect(r.boss!.powers!.warnAt).toBeUndefined();
  });

  it("the fifth upgrade makes the rifle whole as your next turn begins; the fourth doesn't", async () => {
    for (const before of [3, 4]) {
      const r = battle(3);
      await crowdMove(r);
      onPosition(r, "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1", "w", { upgrades: before, unlocked: CHANDY_MOVES.slice(0, before), locks: [{ square: "d5", piece: "n", at: 0 }], taught: true });
      const turn = r.boss!.crowdMoves + 1;
      r.applyBossMove("f6d5");
      expect(cOf(r).upgrades).toBe(before + 1);
      expect(cOf(r).whole).toBe(before + 1 === S.upgradesMax ? turn : undefined);
      expect(r.bossView()!.powers!.chandy!.rageLocked).toBe(before + 1 < S.upgradesMax);
    }
  });

  it("from the rifle whole, his meter fills over dodgeAfterMoves of your moves; full, the warning; Dodge as your next turn begins (Eric, Nov 16)", async () => {
    const r = battle(5);
    await crowdMove(r);
    if (r.bossToMove()) await r.playBoss();
    const whole = r.boss!.powers!.turn;
    onPosition(r, fenOf(r), r.boss!.crowdSide, { upgrades: 5, unlocked: [...CHANDY_MOVES], whole, meter: 0 });
    const seen: { turn: number; rage: number | null; warn: boolean; dodge: boolean }[] = [];
    for (let i = 0; i < 2 * S.dodgeAfterMoves + 4 && !r.dodgeDue(); i++) {
      if (r.bossToMove()) {
        await r.playBoss();
        continue;
      }
      const p = r.boss!.powers!;
      // (No mate in one for you on the way: the last chance isn't what brings it here.)
      expect(matingMoves(fenOf(r))).toEqual([]);
      seen.push({ turn: p.turn, rage: rageOf(r.boss), warn: p.events.some((e) => e.kind === "warn"), dodge: p.events.some((e) => e.kind === "dodge") });
      await crowdMove(r);
    }
    expect(r.dodgeDue()).toBe(true);
    const n = S.dodgeAfterMoves;
    expect(seen.map((x) => x.turn)).toEqual(Array.from({ length: n + 1 }, (_, k) => whole + k));
    expect(seen.map((x) => x.rage)).toEqual(Array.from({ length: n + 1 }, (_, k) => Math.min(1, k / n)));
    expect(seen.map((x) => x.warn)).toEqual(Array.from({ length: n + 1 }, (_, k) => k === n));
    expect(seen.some((x) => x.dodge)).toBe(false);
    expect(r.boss!.powers!.turn).toBe(whole + n + 1);
    expect(r.boss!.powers!.events.some((e) => e.kind === "dodge")).toBe(true);
    expect(rageOf(r.boss)).toBe(1);
  });

  it("once a battle: after it, his meter stays empty and dimmed, nothing brings another, the admins' trigger refuses", async () => {
    const r = battle(21, "dodge");
    for (let i = 0; i < 6 && !r.dodgeDue(); i++) {
      if (r.bossToMove()) await r.playBoss();
      else await crowdMove(r);
    }
    expect(r.dodgeDue()).toBe(true);
    for (let k = 0; k < 3 && r.dodgeDue(); k++) r.finishDodgeRound({ h0: cOf(r).dodge!.rounds[k]!.safe });
    const at = r.boss!.powers!.ultAt!;
    // (Its own turn: the meter full; your move.)
    expect(rageOf(r.boss)).toBe(1);
    await crowdMove(r);
    let turns = 0;
    for (let i = 0; i < 40 && !r.stageComplete(); i++) {
      if (r.bossToMove()) {
        await r.playBoss();
        continue;
      }
      expect(r.dodgeDue()).toBe(false);
      const p = r.boss!.powers!;
      expect(p.ults).toBe(1);
      expect(p.ultAt).toBe(at);
      expect(p.events.some((e) => e.kind === "dodge" || e.kind === "warn")).toBe(false);
      expect(rageOf(r.boss)).toBe(0);
      expect(ragePaused(r.boss)).toBe(true);
      expect(triggerUltimate(r.boss).ok).toBe(false);
      turns++;
      await crowdMove(r);
    }
    expect(turns).toBeGreaterThan(5);
  });
});

describe("Dodge's last chance (Eric, Nov 16)", () => {
  // (1.e4 e5 2.Bc4 Nc6 3.Qh5, Black to move: after 3...Nf6 White mates with Qxf7.)
  const BEFORE = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3";

  it("your mate in one, as your turn begins: Dodge now, whatever his rifle (0 upgrades), its warning with it; the mate is still yours after it", async () => {
    const r = battle(4);
    await crowdMove(r);
    onPosition(r, BEFORE, "w");
    expect(cOf(r).upgrades).toBe(0);
    r.applyBossMove("g8f6");
    const p = r.boss!.powers!;
    expect(p.events.filter((e) => e.kind === "warn" || e.kind === "dodge").map((e) => e.kind)).toEqual(["warn", "dodge"]);
    expect(p.ults).toBe(1);
    expect(r.dodgeDue()).toBe(true);
    expect(rageOf(r.boss)).toBe(1);
    expect(r.bossView()!.powers!.chandy!.rageLocked).toBe(false);
    const fen = fenOf(r);
    for (let k = 0; k < 3 && r.dodgeDue(); k++) r.finishDodgeRound({ h0: cOf(r).dodge!.rounds[k]!.safe });
    expect(fenOf(r)).toBe(fen);
    expect(r.stageComplete()).toBe(false);
    // (The board as it was: Qxf7 still mates, and it's allowed.)
    expect(r.crowdAllowed() ?? legalMoves(fen)).toContain("h5f7");
    await crowdMove(r, () => "h5f7");
    expect(r.stageComplete()).toBe(true);
    expect(r.finishBossBattle()).toBe("crowd");
  });

  it("only once: a second mate in one later brings nothing", async () => {
    const r = battle(4);
    await crowdMove(r);
    onPosition(r, BEFORE, "w");
    r.applyBossMove("g8f6");
    for (let k = 0; k < 3 && r.dodgeDue(); k++) r.finishDodgeRound({ h0: cOf(r).dodge!.rounds[k]!.safe });
    // (You don't mate; later he walks into it again.)
    await crowdMove(r, () => "b1c3");
    onPosition(r, BEFORE, "w");
    r.applyBossMove("g8f6");
    const p = r.boss!.powers!;
    expect(matingMoves(fenOf(r))).toContain("h5f7");
    expect(p.events.some((e) => e.kind === "dodge" || e.kind === "warn")).toBe(false);
    expect(p.ults).toBe(1);
    expect(r.dodgeDue()).toBe(false);
  });

  it("counts only the moves you may play that turn: a mate his limits stop isn't one", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    const fresh = { moves: 0, locks: [], upgrades: 0, unlocked: [], meter: 0, used: 0 };
    expect(mateOpen({ chandy: fresh }, { fen, turn: 4 })).toBe(true);
    // (His shield on f7 this turn: Qxf7 can't take it.)
    expect(mateOpen({ chandy: { ...fresh, shields: { squares: ["f7"], turn: 4 } } }, { fen, turn: 4 })).toBe(false);
    // (A shield of another turn's: the mate is open.)
    expect(mateOpen({ chandy: { ...fresh, shields: { squares: ["f7"], turn: 3 } } }, { fen, turn: 4 })).toBe(true);
    // (Your queen held by rapid fire.)
    expect(mateOpen({ chandy: { ...fresh, dizzy: { squares: ["h5"], turn: 4 } } }, { fen, turn: 4 })).toBe(false);
    expect(mateOpen({ chandy: fresh }, { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4", turn: 4 })).toBe(false);
  });
});

describe("the dispatcher's ground rules", () => {
  it("lifts his limits when they'd leave you no legal move", () => {
    const r = battle(2);
    // (Your king on a1 boxed in: every move onto a scatter square.)
    onPosition(r, "4k3/8/8/8/8/8/2r5/K7 w - - 0 1", "w", { scatter: { spot: "c3", squares: ["a2", "b1", "b2"], turn: r.boss!.powers!.turn } });
    const legal = legalMoves(fenOf(r));
    expect(legal.length).toBeGreaterThan(0);
    expect(crowdAllowed(r.boss, fenOf(r))).toBeNull();
  });
});
