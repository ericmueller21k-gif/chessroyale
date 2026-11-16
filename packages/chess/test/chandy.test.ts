import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_POWERS, BOSS_ROSTER, CHANDY_MOVES, adminFirst, isPlayable, menuBosses, mulberry32, type BossPowerState, type ChandyState, type DodgeLine } from "@chessroyale/core";
import {
  CHANDY_FX,
  MatchRunner,
  PASS_WAIT,
  POWER_FX,
  beamAllows,
  botDodgeVote,
  chandyTurnMs,
  chooseBeam,
  chooseRapid,
  chooseScatter,
  chooseShields,
  crowdAllowed,
  dodgeArena,
  dodgeCenter,
  dodgeRounds,
  dodgeSeen,
  dodgeTally,
  dodgeTimeline,
  firstLockPick,
  heldIn,
  kingAttacked,
  legalMoves,
  linesAfter,
  lockEnds,
  lockLeft,
  lockOrder,
  lockRank,
  locksAfter,
  meterPick,
  pieceAt,
  powerTurn,
  queenLockAim,
  queenShot,
  safeSquares,
  stopReason,
  steerPick,
  unlockPick,
  type MoveScore,
} from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

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

describe("Chandy's sheet", () => {
  it("is on the roster with Lock-on and Dodge, admins first; his numbers are Eric's", () => {
    const def = BOSS_ROSTER.find((d) => d.id === "chandy")!;
    expect(def).toMatchObject({ name: "Chandy", kit: "Chandy", powers: { passive: "lockon", ultimate: "dodge" } });
    expect(BOSS_ADMIN_FIRST).toContain("chandy");
    expect(adminFirst(def)).toBe(true);
    expect(isPlayable(def)).toBe(false);
    expect(menuBosses({ admin: false, raid: true }).some((d) => d.id === "chandy")).toBe(false);
    expect(menuBosses({ admin: true, raid: false }).some((d) => d.id === "chandy")).toBe(true);
    // (L1: first lock from his 3rd move; a lock hunts 3 of his turns, lives at most 5; at most 2, the second 2 turns after the first.)
    expect([S.firstLockMove, S.huntTurns, S.liveTurns, S.maxLocks, S.secondAfter]).toEqual([3, 3, 5, 2, 2]);
    // (L3's margins, raised by L5 after the sim (1.5 and 0.5 gave 5 upgrades in 28 battles of 32: reports/chandy-sim.md); the 2 s
    // upgrade window; the meter every 6 of your moves; five upgrades; Dodge at most twice.)
    expect([S.takeMargin, S.chaseMargin, S.lockLines]).toEqual([2, 0.75, 5]);
    expect([S.upgradeMs, S.meterEvery, S.upgradesMax, BOSS_POWERS.maxUltimates.chandy]).toEqual([2000, 6, 5, 2]);
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

  it("his first lock, as his turn begins: a piece he can take without losing material, never the queen", () => {
    // (Black to move, his knight on f6 takes your free knight on d5; your queen on e4 hangs to it too: never her.)
    const fen = "4k3/4p3/5n2/3N4/4Q3/8/8/4K3 b - - 0 1";
    expect(firstLockPick(fen, "w", 9)).toBe("d5");
    // (Your knight on d5 defended by a pawn on e4 and only his rook can take it: a loss by the exchange check, no lock.)
    expect(firstLockPick("3rk3/8/8/3N4/4P3/8/8/4K3 b - - 0 1", "w", 9)).toBeNull();
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
  it("refused (passing would lose real material): the meter picks another unlocked move, which lands as your turn begins; none: it empties", async () => {
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
    // (The queen lock alone unlocked: the meter empties, the queen lock can come on a later fill.)
    const r2 = battle(8);
    await crowdMove(r2);
    onPosition(r2, "4k3/pppp4/8/8/8/8/3P4/3QK2R b - - 0 1", "w", { upgrades: 1, unlocked: ["queenlock"], fresh: "queenlock", due: "queenlock", meter: S.meterEvery });
    expect(r2.applyQueenLock(PASS_WAIT)).toBeNull();
    expect(cOf(r2).due ?? null).toBeNull();
    expect(cOf(r2).meter).toBe(0);
    expect(r2.queenLockDue()).toBe(false);
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

  it("comes as your turn begins once the rifle is whole (the test switch): three dodged rounds and your turn; a hit and the battle is his", async () => {
    for (const hit of [false, true]) {
      const r = battle(21, "dodge");
      for (let i = 0; i < 6 && !r.dodgeDue(); i++) {
        if (r.bossToMove()) await r.playBoss();
        else await crowdMove(r);
      }
      expect(r.dodgeDue()).toBe(true);
      const before = fenOf(r);
      const d = cOf(r).dodge!;
      expect(d.king).toBe(r.boss!.crowdSide === "w" ? "e1" : d.king);
      for (let k = 0; k < 3 && r.dodgeDue(); k++) {
        const safe = cOf(r).dodge!.rounds[k]!.safe;
        const wrong = dodgeArena(d.center).find((sq) => sq !== safe)!;
        const res = r.finishDodgeRound({ h0: hit && k === 1 ? wrong : safe })!;
        expect(res.hit).toBe(hit && k === 1);
      }
      expect(fenOf(r)).toBe(before);
      expect(r.dodgeDue()).toBe(false);
      expect(r.stageComplete()).toBe(hit);
      if (hit) {
        expect(r.boss!.powers!.events.some((e) => e.kind === "dodgeWin")).toBe(true);
        expect(r.finishBossBattle()).toBe("boss");
      } else expect(cOf(r).dodge!.results.length).toBe(3);
    }
  });

  it("before the rifle is whole, his rage meter gathers nothing", async () => {
    const r = battle(13);
    for (let i = 0; i < 12; i++) {
      if (r.bossToMove()) await r.playBoss();
      else await crowdMove(r);
    }
    expect(cOf(r).upgrades).toBeLessThan(5);
    expect(r.boss!.powers!.warnAt).toBeUndefined();
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
