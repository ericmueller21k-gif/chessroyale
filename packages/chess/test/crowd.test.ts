import { describe, expect, it } from "vitest";
import { BOSS_TIERS, CROWD_CUTS, CROWD_MISSES, pregameVotes, crowdPickOdds, bossDef, isPlayable, DEFAULT_SETTINGS, RAID_SETTINGS, raidBossElo, bossElo, bossStartPly, bossInfo, botVotes, clockAfterVote, modeSettings, mulberry32, tallyVotes, voteZoneAt, PREGAME_VOTES, type Settings } from "@chessroyale/core";
import { legalMoves, MatchRunner, moveNumber, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const fake: EngineLike = {
  async topMoves(fen, n) {
    return legalMoves(fen)
      .map((move) => ({ move, expected: 0.3 + 0.4 * hash(fen + move) }))
      .sort((a, b) => b.expected - a.expected)
      .slice(0, n);
  },
  async scoreMoves(fen, moves) {
    return moves.map((move) => ({ move, expected: 0.3 + 0.4 * hash(fen + move) }));
  },
};
const line = sanLineToUci(["e4", "e5", "Nf3"]);
const library: Opening[] = [
  { id: "start", eco: "", name: "Starting position", family: "Starting position", unusual: false, moves: line.slice(0, 1), namedPlies: 1, expected: { 0: 0.5, 1: 0.5 } },
];

describe("Crowd mode", () => {
  const base: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };

  it("50 v 50's misses (CrowdMisses, Eric, Nov 4): a pick made for you from the engine's top 5 that never counts, the team's lowest score, and the 4th miss in the game removes you; bots never", async () => {
    const runner = new MatchRunner({
      settings: base,
      rng: mulberry32(3),
      engines: [fake],
      library,
      entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: i > 0, skill: 1 + (i % 20) })),
    });
    let misses = 0;
    while (misses < 4) {
      const ids = [...runner.deal().values()][0]!;
      const report = await runner.score(new Map());
      // (Nobody but b0 is ever away: the bots always pick.)
      expect((report.away ?? []).every((id) => id === "b0")).toBe(true);
      if (!ids.includes("b0")) continue;
      misses++;
      const b = report.boards[0]!;
      const me = b.result.players.find((p) => p.playerId === "b0")!;
      const real = b.result.players.filter((p) => p.move !== null);
      // The pick made for you: one of the engine's top 5, with your misses so far; your move stays none.
      expect(me.move).toBeNull();
      expect(b.scored.slice(0, 5).map((m) => m.move)).toContain(me.defaultMove);
      expect(me.missNo).toBe(misses);
      expect(runner.player("b0").misses).toBe(misses);
      // Your score: the lowest of your team's real picks.
      expect(me.roundScore).toBe(Math.min(...real.map((p) => p.roundScore - (p.brilliantBonus ?? 0))));
      // It never counts in the tally: the odds are the real picks' alone (and with them, the played move).
      expect(real).toHaveLength(ids.length - 1);
      // (Since the rework, C2: the pick vote's mode, Strong by default, over the real picks and the judge's losses for them.)
      expect(b.result.drawOdds).toEqual(crowdPickOdds(base.crowdPick!, real.map((p) => p.move!), Object.fromEntries(real.map((p) => [p.move!, p.loss!]))));
      // The 4th removes you (the lobby and SoloMatch take you out); the first three never.
      expect(report.away ?? []).toEqual(misses > CROWD_MISSES.allowed ? ["b0"] : []);
    }
    // Off (a raid, the ?afk=0 switch): no pick made for it, nobody away.
    const off = new MatchRunner({ settings: { ...base, crowdMisses: null }, rng: mulberry32(3), engines: [fake], library, entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: i > 0, skill: 1 + (i % 20) })) });
    for (let i = 0; i < 10; i++) {
      off.deal();
      const report = await off.score(new Map());
      expect(report.away).toBeUndefined();
      expect(report.boards[0]!.result.players.find((p) => p.playerId === "b0")?.defaultMove).toBeUndefined();
    }
    expect(off.player("b0").misses).toBeGreaterThan(CROWD_MISSES.allowed);
  });

  it("50 v 50's misses: nobody on the team picked, the team plays one of the engine's top 5 at random (not always the best)", async () => {
    const settings: Settings = { ...base, lobbySize: 6, groupSize: 6 };
    const playedRanks: number[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const runner = new MatchRunner({ settings, rng: mulberry32(seed), engines: [fake], library, entrants: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })) });
      for (let i = 0; i < 2; i++) {
        runner.deal();
        const b = (await runner.score(new Map())).boards[0]!;
        const top = b.scored.slice(0, 5).map((m) => m.move);
        expect(b.result.players.every((p) => p.move === null && top.includes(p.defaultMove!))).toBe(true);
        expect(top).toContain(b.result.playedMove);
        playedRanks.push(top.indexOf(b.result.playedMove));
      }
    }
    expect(playedRanks.some((r) => r > 0)).toBe(true);
  });

  it("boss raid: every raid from the starting position (Eric, Oct 21), the crowd White; raidOpening keeps the old named opening", () => {
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const lib: Opening[] = [{ ...library[0]!, moves: sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"]), expected: { 10: 0.52 } }];
    const entrants = Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false }));
    for (const bossId of ["grex", "gingerbread", "alfil", "moo"]) {
      const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, lastStandFrom: 999, bossId } as Settings;
      const runner = new MatchRunner({ settings, rng: mulberry32(11), engines: [fake], library: lib, entrants });
      expect(runner.boards.get(0)!.fen, bossId).toBe(START);
      expect(runner.boards.get(0)!.history, bossId).toEqual([]);
      expect(runner.boss!.crowdSide, bossId).toBe("w");
      expect(runner.bossToMove(), bossId).toBe(false);
      const old = new MatchRunner({ settings: { ...settings, raidOpening: true }, rng: mulberry32(11), engines: [fake], library: lib, entrants });
      expect(old.boards.get(0)!.history, bossId).toHaveLength(10);
    }
  });

  it("boss raid: humans only, the boss from the first move (here on the old named opening: raidOpening), strikes down to half, the King's strike staggers the boss", async () => {
    // (The fake engine's numbers are random, so its "blunders" would call for the God King's Last Stand, which has its own tests.)
    // (Jefferson: the boss this seed met before Sawyer joined the draw; a boss who plays from the named opening.)
    const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossMaxMoves: 12, lastStandFrom: 999, bossId: "grex" } as Settings;
    const lib: Opening[] = [{ ...library[0]!, moves: sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"]), expected: { 10: 0.52 } }];
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(11),
      engines: [fake],
      library: lib,
      entrants: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })),
    });
    const boss = runner.boss!;
    // The lobby's strength plus the boss's own offset.
    expect(isPlayable(bossDef(boss.id))).toBe(true);
    expect(boss.elo).toBe(2000 + bossDef(boss.id)!.offset);
    expect(boss.minSurvivors).toBe(3);
    expect(boss.kingCharges).toBe(3);
    expect(runner.boards.get(0)!.history).toHaveLength(10);
    expect(runner.bossToMove()).toBe(false);
    // A strike, mid-move: when more than half the crowd calls, the boss's next move is a staggered one and a charge is spent.
    runner.deal();
    expect(["h0", "h1", "h2"].map((id) => runner.callStrike(id).struck)).toEqual([false, false, false]);
    expect(runner.callStrike("h3")).toEqual({ struck: true, calls: 4 });
    expect(runner.boss!.staggerNext).toBe(true);
    expect(runner.boss!.kingCharges).toBe(2);
    // One strike per move.
    expect(runner.callStrike("h4").struck).toBe(false);
    expect(runner.boss!.kingCharges).toBe(2);
    // The move goes on: everyone still picks, and it's scored as usual.
    const move = legalMoves(runner.boards.get(0)!.fen)[0]!;
    const r = await runner.score(new Map(runner.alive().map((p) => [p.id, { move, thinkMs: 1000 }])));
    expect(r.boards[0]!.result.players.every((p) => !p.abstained && p.move === move)).toBe(true);
    expect(runner.bossMoveKind()).toBe("stagger");
    await runner.playBoss();
    expect(runner.boss!.staggerNext).toBe(false);
    expect(runner.bossView()!.lastMove!.staggered).toBe(true);
    // Calling the King to play the move is your turn: no move, no score, and not a miss.
    runner.deal();
    for (const p of runner.alive()) runner.kingCallers.add(p.id);
    const k = await runner.score(new Map());
    expect(k.boards[0]!.king).toBe(true);
    expect(k.boards[0]!.result.players.every((p) => p.abstained && p.roundScore === 0)).toBe(true);
    expect(runner.alive().every((p) => (p.misses ?? 0) === 0)).toBe(true);
    expect(runner.boss!.kingCharges).toBe(1);
    // From here h5 misses every move, h4 every other and h3 every third; the rest play on. The boss strikes the worst
    // since its last strike; a tie for the worst would wait (docs/decisions/2026-10-15-opening-allowance-and-ties.md).
    const struck: string[] = [];
    while (!runner.stageComplete()) {
      if (runner.bossToMove()) {
        await runner.playBoss();
        continue;
      }
      runner.deal();
      const turn = runner.boss!.crowdMoves;
      const fen = runner.boards.get(0)!.fen;
      const misses = (id: string) => id === "h5" || (id === "h4" && turn % 2 === 0) || (id === "h3" && turn % 3 === 0);
      await runner.score(new Map([...runner.alive()].map((p) => [p.id, { move: misses(p.id) ? null : legalMoves(fen)[0]!, thinkMs: 1000 }])));
      if (runner.bossKillDue()) struck.push(runner.bossKill()!);
    }
    expect([...struck].sort()).toEqual(["h3", "h4", "h5"]);
    expect(runner.alive().length).toBe(3);
    runner.finishBossBattle();
    expect(runner.state.players.map((p) => p.placement).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    // The boss tiers: the weakest stronger than the group's average.
    expect(raidBossElo([1500, 1700])).toBe(1800);
    expect(raidBossElo([1650, 1650])).toBe(1800);
    expect(raidBossElo([null])).toBe(1600);
    expect(raidBossElo([3100])).toBe(3190);
    expect(raidBossElo([3300])).toBe(3190);
  });

  it("the boss battle's start: even (0.50-0.60 for White) nearest move 8, else nearest even still for White, else the start", () => {
    const evals = Array.from({ length: 41 }, () => 0.5);
    // White's expected score at even plies 10..24.
    const set = (xs: Record<number, number>) => evals.map((e, k) => xs[k] ?? (k % 2 === 0 ? 0.3 : 0.7));
    expect(bossStartPly(set({ 10: 0.55, 16: 0.58, 24: 0.52 }), 40)).toBe(16);
    expect(bossStartPly(set({ 12: 0.75, 20: 0.65 }), 40)).toBe(20);
    expect(bossStartPly(set({}), 40)).toBe(0);
    expect(bossStartPly(set({ 10: 0.55 }), 11)).toBe(10);
    expect(bossStartPly(set({ 12: 0.55 }), 11)).toBe(0);
  });

  it("the boss's strength leans toward the best of the crowd, plus the offset, within limits", () => {
    const s = { bossEloOffset: 150, bossEloRange: [1320, 3000] as const };
    // Weights 3, 2, 1: (3*2000 + 2*1600 + 1*1200) / 6 = 1733, + 150.
    expect(bossElo([1600, 2000, 1200], s)).toBe(1883);
    expect(bossElo([null, null], s)).toBe(1650);
    expect(bossElo([400], s)).toBe(1320);
    expect(bossElo([3300], s)).toBe(3000);
    // Ten bosses, one per tier, two to a skull.
    expect(BOSS_TIERS).toHaveLength(10);
    expect(BOSS_TIERS.at(-1)).toBe(3190);
    expect(new Set(BOSS_TIERS.map((t) => bossInfo(t).name)).size).toBe(10);
    expect(BOSS_TIERS.map((t) => bossInfo(t).threat)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(bossInfo(1400).name).toBe("The Pawn Golem");
    expect(bossInfo(3190).name).toBe("The Engine Eternal");
  });

  it("Crowd is always 50 v 50; only a raid has no teams: everyone alive picks every crowd move, nobody on a side", async () => {
    // (Crowd's "everyone moves" went on Oct 15, 2026: whatever an older caller asks for, a Crowd match has teams.)
    expect(base.crowdTeams).toBe(true);
    const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "grex", lastStandFrom: 999 } as Settings;
    const lib: Opening[] = [{ ...library[0]!, moves: sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"]), expected: { 10: 0.52 } }];
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(2),
      engines: [fake],
      library: lib,
      entrants: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })),
    });
    for (let move = 0; move < 3; move++) {
      if (runner.bossToMove()) await runner.playBoss();
      const groups = runner.deal();
      expect([...groups.values()]).toEqual([runner.alive().map((p) => p.id)]);
      await runner.score(new Map(runner.alive().map((p) => [p.id, { move: legalMoves(runner.boards.get(0)!.fen)[0]!, thinkMs: 1000 }])));
      if (runner.bossKillDue()) runner.bossKill();
    }
    expect(runner.leaderboard().every((row) => row.team === null)).toBe(true);
  });

  it("bot picks decided at the start of a round are the ones scored", async () => {
    const settings: Settings = { ...base };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(5),
      engines: [fake],
      library,
      entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) })),
    });
    for (let round = 0; round < 3; round++) {
      runner.deal();
      const planned = new Map(await runner.planBotPicks());
      expect(planned.size).toBe(50);
      const report = await runner.score(new Map());
      for (const p of report.boards[0]!.result.players) expect(p.move).toBe(planned.get(p.playerId));
    }
  });

  it("the clock vote's time control: every bank starts at its bank (only before move 1), every move's cap is its own, bots think within it", async () => {
    // (The 50 v 50 rework, to a test's move limit of 12: before the first cut.)
    const settings: Settings = { ...base, crowdMoveLimit: 12 };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(11),
      engines: [fake],
      library,
      entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) })),
    });
    const speedOpts = PREGAME_VOTES.find((v) => v.id === "speed")!.options;
    const [bullet, rapid] = (["bullet", "rapid"] as const).map((id) => speedOpts.find((o) => o.id === id));
    // Made with the default bank (Rapid's 10:00); Bullet wins the vote before move 1: everyone's bank is 3:00.
    expect(new Set(runner.state.players.map((p) => p.bankMs))).toEqual(new Set([600_000]));
    runner.patchSettings(bullet!.patch);
    expect(new Set(runner.state.players.map((p) => p.bankMs))).toEqual(new Set([180_000]));
    // Patches without a bank (how moves are picked) leave the banks alone.
    runner.patchSettings({ crowdPick: "majority" });
    expect(new Set(runner.state.players.map((p) => p.bankMs))).toEqual(new Set([180_000]));
    let plies = 0;
    while (!runner.isOver()) {
      if (runner.endGameIfOver()) break;
      runner.deal();
      expect(runner.moveClock()).toBe(10);
      const ids = [...runner.groups.values()][0]!;
      for (const id of ids) expect(runner.allowedMsFor(id)).toBe(Math.min(10_000, runner.player(id).bankMs + 2_000));
      // Bots spread out within 85% of the 10 s cap, never on the buzzer.
      expect(Math.max(...Object.values(runner.botThinkTimes()))).toBeLessThanOrEqual(8_500);
      await runner.score(new Map());
      plies++;
      if (plies === 12) {
        // Once moves are played, another time control never resets a bank.
        const before = runner.state.players.map((p) => p.bankMs);
        runner.patchSettings(rapid!.patch);
        expect(runner.state.players.map((p) => p.bankMs)).toEqual(before);
        runner.patchSettings(bullet!.patch);
      }
      if (runner.endGameIfOver()) break;
      if (runner.stageComplete()) runner.endStage();
    }
    expect(plies).toBe(24);
    // Each bot paid what it thought beyond the 2 s increment, never more than 8 s a move, from its 3:00.
    for (const p of runner.state.players.filter((x) => x.movesTimed > 0)) {
      expect(p.bankMs).toBe(Math.max(0, 180_000 + p.movesTimed * 2_000 - p.thinkMsTotal));
    }
  });

  it("a rising move clock (moveClockSteps; no option has one today) follows the move number", async () => {
    const rising = [
      { fromMove: 1, seconds: 10 },
      { fromMove: 6, seconds: 15 },
      { fromMove: 11, seconds: 20 },
      { fromMove: 16, seconds: 25 },
      { fromMove: 21, seconds: 30 },
    ];
    const settings: Settings = { ...base, crowdMoveLimit: 32, moveClockSteps: rising };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(11),
      engines: [fake],
      library,
      entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) })),
    });
    const seen = new Map<number, number>();
    while (!runner.isOver()) {
      if (runner.endGameIfOver()) break;
      runner.deal();
      const move = moveNumber(runner.boards.get(runner.state.boards[0]!)!.fen);
      const clock = runner.moveClock();
      seen.set(move, clock);
      expect(runner.allowedMsFor([...runner.groups.values()][0]![0]!)).toBe(clock * 1000);
      // Bots spread out within 85% of this move's clock (on 10 s: 2 to 8.5 s, never piling up on the buzzer).
      const think = Object.values(runner.botThinkTimes());
      expect(Math.max(...think)).toBeLessThanOrEqual(0.85 * clock * 1000 + 1);
      await runner.score(new Map());
      if (runner.endGameIfOver()) break;
      if (runner.stageComplete()) runner.endStage();
    }
    // The test's move limit ends it after move 32 (64 plies).
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 32].map((m) => seen.get(m))).toEqual([10, 10, 15, 15, 20, 20, 25, 25, 30, 30]);
  });

  it("pre-game votes: three zones on b-c, d-e and f-g, ranks 4-5; most votes wins, ties drawn, none gives the default", () => {
    // Points in squares from White's side (x across, y up): the middle of d4 is (3.5, 3.5).
    expect(voteZoneAt({ x: 1.5, y: 3.5 })).toBe(0);
    expect(voteZoneAt({ x: 4.5, y: 4.5 })).toBe(1);
    expect(voteZoneAt({ x: 6.2, y: 3.1 })).toBe(2);
    expect(voteZoneAt({ x: 0.5, y: 3.5 })).toBeNull(); // the a-file
    expect(voteZoneAt({ x: 3.5, y: 2.5 })).toBeNull(); // rank 3
    expect(voteZoneAt({ x: 7.5, y: 4.5 })).toBeNull(); // the h-file
    const rng = mulberry32(9);
    expect(tallyVotes([0, 1, 1, 2], 3, 0, rng)).toBe(1);
    expect(tallyVotes([], 3, 1, rng)).toBe(1);
    const ties = new Set(Array.from({ length: 40 }, () => tallyVotes([0, 2], 3, 1, rng)));
    expect([...ties].sort()).toEqual([0, 2]);
    const bots = botVotes(mulberry32(3), Array.from({ length: 99 }, (_, i) => `b${i}`), 3, 8000);
    expect(bots).toHaveLength(99);
    expect(bots.every((b) => b.option >= 0 && b.option < 3 && b.atMs > 0 && b.atMs < 8000)).toBe(true);
    expect(new Set(bots.map((b) => b.option)).size).toBe(3);
  });

  it("augment votes: majority moves the clock by a step, within limits; ties keep it", () => {
    expect(clockAfterVote(20, ["more", "more", "less"], base)).toBe(25);
    expect(clockAfterVote(20, ["less", "less", "same"], base)).toBe(15);
    expect(clockAfterVote(20, ["more", "less"], base)).toBe(20);
    expect(clockAfterVote(20, [], base)).toBe(20);
    expect(clockAfterVote(40, ["more"], base)).toBe(40);
    expect(clockAfterVote(10, ["less"], base)).toBe(10);
  });
});

// The 50 v 50 rework in the runner (C2, Nov 16; docs/decisions/2026-11-16-crowd-rework-runner.md; core's rules:
// packages/core/test/crowd-rework.test.ts): one game played to its end, equal cuts down to a 1 v 1, no endings.
describe("the 50 v 50 rework (C2): one game to its end, cuts to a 1 v 1, no endings", () => {
  const rework: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };
  const crowdOf = (n: number, people = 0) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: i >= people, skill: 1 + (i % 20) }));
  const side = (runner: MatchRunner, c: "w" | "b") => runner.alive().filter((p) => p.colour === c).length;
  /** An engine that rates one move in each of these positions far above the rest (by the position's moves so far). */
  const scripted = (line: readonly string[]): EngineLike => {
    const want = (fen: string, move: string) => {
      const ply = 2 * (moveNumber(fen) - 1) + (fen.split(" ")[1] === "b" ? 1 : 0);
      return line[ply] === move;
    };
    const score = (fen: string, move: string) => (want(fen, move) ? 0.95 : 0.2 + 0.1 * hash(fen + move));
    return {
      async topMoves(fen, n) {
        return legalMoves(fen)
          .map((move) => ({ move, expected: score(fen, move) }))
          .sort((a, b) => b.expected - a.expected)
          .slice(0, n);
      },
      async scoreMoves(fen, moves) {
        return moves.map((move) => ({ move, expected: score(fen, move) }));
      },
    };
  };
  /** Plays the match out as the lobby and solo do: a game over first (it cuts nobody), then the stage's cut. */
  async function playOut(runner: MatchRunner, each?: (report: Awaited<ReturnType<MatchRunner["score"]>>) => void) {
    const cuts: { move: number; w: number; b: number }[] = [];
    while (!runner.isOver()) {
      expect(runner.isFinal()).toBe(false);
      expect(runner.boss).toBeNull();
      expect(runner.final).toBeNull();
      if (runner.endGameIfOver()) break;
      runner.deal();
      const report = await runner.score(new Map());
      each?.(report);
      if (runner.endGameIfOver()) break;
      if (runner.stageComplete()) {
        runner.endStage();
        cuts.push({ move: moveNumber(runner.boards.get(runner.state.boards[0]!)!.fen), w: side(runner, "w"), b: side(runner, "b") });
      }
    }
    return cuts;
  }

  it("is every 50 v 50's: Strong, the cuts after moves 14 to 42, the carry, the move limit; the votes are how moves are picked, how it starts, how fast", () => {
    expect(rework).toMatchObject({ crowdPick: "strong", crowdCuts: CROWD_CUTS, crowdCarry: 0.5, crowdMoveLimit: 60, crowdLimitWin: 0.75 });
    expect(pregameVotes(rework).map((v) => v.id)).toEqual(["pick", "start", "speed"]);
  });

  it("plays to move 60 with no final: equal cuts to 34, 23, 15, 10, 6, 4, 2 and 1 a side; the 1 v 1's pick is played; the judge's verdict; everyone placed once; the podium", async () => {
    const runner = new MatchRunner({ settings: rework, rng: mulberry32(2), engines: [fake], library, entrants: crowdOf(100) });
    let oneVOne = 0;
    const cuts = await playOut(runner, (report) => {
      const r = report.boards[0]!.result;
      if (runner.state.stage < CROWD_CUTS.length) return;
      // The 1 v 1: an ordinary stage, one player a side, whose pick is played.
      expect(r.players).toHaveLength(1);
      expect(r.playedMove).toBe(r.players[0]!.move);
      oneVOne++;
    });
    const board = runner.boards.get(runner.state.boards[0]!)!;
    // Cut after Black's move `after` (the next move's number is after + 1); each side kept to its keep, but for the bubble
    // grace's few (cutCarry), which the cuts after take; the last cut is exact.
    expect(cuts.map((c) => c.move)).toEqual(CROWD_CUTS.map((c) => c.after + 1));
    cuts.forEach((c, i) => {
      for (const n of [c.w, c.b]) expect(n - CROWD_CUTS[i]!.keep).toBeGreaterThanOrEqual(0);
      for (const n of [c.w, c.b]) expect(n - CROWD_CUTS[i]!.keep).toBeLessThanOrEqual(3);
    });
    expect(cuts.at(-1)).toMatchObject({ w: 1, b: 1 });
    // This seed's game reaches the move limit: the 1 v 1 plays moves 43 to 60, and Black's 60th ends it.
    expect(moveNumber(board.fen)).toBe(61);
    expect(oneVOne).toBe(2 * (60 - 42));
    expect(runner.isOver()).toBe(true);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    // The judge's verdict: a side at 75% or more by the board's (agreed) numbers, else a draw.
    const toMove = board.fen.split(" ")[1] as "w" | "b";
    const winner = board.expected >= 0.75 ? toMove : 1 - board.expected >= 0.75 ? (toMove === "w" ? "b" : "w") : null;
    expect(runner.gameWinner()).toBe(winner);
    const first = runner.state.players.find((p) => p.placement === 1)!;
    const second = runner.state.players.find((p) => p.placement === 2)!;
    // The two of the 1 v 1 take 1st and 2nd: the winner first (drawn: the better score).
    expect(new Set([first.colour, second.colour])).toEqual(new Set(["w", "b"]));
    if (winner) expect(first.colour).toBe(winner);
    const res = runner.crowdResults()!;
    expect(res.podium.winner).toBe(winner ? first.id : undefined);
    expect(res.podium.best).toBeTruthy();
    // Each player's "out at move" (a cut's; null: still in at the end) and points a move.
    for (const p of runner.state.players) {
      const row = res.players[p.id]!;
      expect(row.outAtMove).toBe(p.placement! <= 2 ? null : CROWD_CUTS[p.outInStage!]!.after);
      expect(row.perMove).toBeGreaterThanOrEqual(0);
    }
  }, 60_000);

  it("a game over by the rules ends the match at once, and on a cut's move cuts nobody: Black mates on move 2 (a test's 4-ply stage), Black's 50 place first", async () => {
    const settings: Settings = { ...rework, stageRounds: [], firstStageRounds: 4, roundsPerStage: 4 };
    // 1.f3 e5 2.g4 Qh4#: the engine rates each of these far above the rest, so Strong plays them.
    const runner = new MatchRunner({ settings, rng: mulberry32(1), engines: [scripted(["f2f3", "e7e5", "g2g4", "d8h4"])], library, entrants: crowdOf(100) });
    const cuts = await playOut(runner);
    const board = runner.boards.get(runner.state.boards[0]!)!;
    expect(board.history).toEqual(["f2f3", "e7e5", "g2g4", "d8h4"]);
    // The stage's 4th ply was its cut's: nobody cut, the stage never ended.
    expect(cuts).toEqual([]);
    expect(runner.state.stage).toBe(0);
    expect(runner.isOver()).toBe(true);
    expect(runner.gameWinner()).toBe("b");
    const place = (c: "w" | "b") => runner.state.players.filter((p) => p.colour === c).map((p) => p.placement!).sort((a, b) => a - b);
    expect(place("b")).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(place("w")).toEqual(Array.from({ length: 50 }, (_, i) => i + 51));
    expect(runner.crowdResults()!.podium.winner).toBe(runner.state.players.find((p) => p.placement === 1)!.id);
    // (Nothing more is dealt: the board isn't replaced, as a game over before the endings once was.)
    expect(runner.crowdGameEnd()).toBeNull();
  });

  it("who left: a person who resigns is out at the move they left, a seat a bot took plays on; neither is ever the best player", async () => {
    // A short game for the test: a cut every 2 plies (8 cuts, the 1 v 1 from move 9), the limit at move 10.
    const settings: Settings = { ...rework, stageRounds: [], firstStageRounds: 2, roundsPerStage: 2, crowdMoveLimit: 10 };
    // b0 a person, who picks the judge's best every turn (so they survive the cuts), the rest bots.
    const runner = new MatchRunner({ settings, rng: mulberry32(7), engines: [fake], library, entrants: crowdOf(100, 1) });
    // Through the 3rd cut (move 6), as the lobby plays it; then b0 resigns (nobody takes the seat) and b1's seat goes to a bot.
    while (runner.state.stage < 3) {
      const groups = runner.deal();
      const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
      const best = (await fake.topMoves(fen, 1))[0]!.move;
      const ids = [...groups.values()].flat();
      await runner.score(new Map(ids.includes("b0") ? [["b0", { move: best, thinkMs: 1000 }]] : []));
      if (runner.stageComplete()) runner.endStage();
    }
    // (b1, a bot, may have been cut by now: only those still in leave.)
    const leaving = ["b0", "b1"].filter((id) => runner.player(id).alive);
    const at = moveNumber(runner.boards.get(runner.state.boards[0]!)!.fen);
    if (leaving.includes("b0")) runner.retire("b0");
    if (leaving.includes("b1")) runner.handOver("b1", { id: "rb1", name: "Relief Rita", skill: 4 });
    const left = [...(leaving.includes("b0") ? ["b0"] : []), ...(leaving.includes("b1") ? ["rb1"] : [])];
    expect(left.length).toBeGreaterThan(0);
    for (const id of left) expect(runner.player(id).leftAt).toBe(at);
    // Their play made perfect, so either would be the best player if leaving didn't bar them.
    runner.state = {
      ...runner.state,
      players: runner.state.players.map((p) => (left.includes(p.id) ? { ...p, lossesByStage: p.lossesByStage.map((l) => l.map(() => 0)), countedLossSum: 0, rawLossSum: 0, misses: 0 } : p)),
    };
    await playOut(runner);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    const res = runner.crowdResults()!;
    expect(left).not.toContain(res.podium.best);
    expect(res.podium.best).toBeTruthy();
    if (left.includes("b0")) expect(res.players["b0"]!.outAtMove).toBe(at);
  });
});
