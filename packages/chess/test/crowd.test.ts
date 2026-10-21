import { describe, expect, it } from "vitest";
import { BOSS_TIERS, bossDef, crowdFinalBoss, crowdFinalists, fixedLevel, isPlayable, maiaTopRating, CROWD_KNOCKOUTS, DEFAULT_SETTINGS, RAID_SETTINGS, raidBossElo, bossElo, bossStartPly, bossInfo, botVotes, clockAfterVote, modeSettings, mulberry32, tallyVotes, voteZoneAt, PREGAME_VOTES, type Settings } from "@chessroyale/core";
import { bossIntroTimeline, bossShowMs, legalMoves, MatchRunner, moveNumber, START_FEN, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

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

async function playKnockouts(settings: Settings, seed: number) {
  const runner = new MatchRunner({
    settings,
    rng: mulberry32(seed),
    engines: [fake],
    library,
    entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) })),
  });
  expect(runner.boards.get(0)!.fen).toBe(START_FEN);
  const sizes: number[] = [];
  let plies = 0;
  while (!runner.isFinal()) {
    const groups = runner.deal();
    expect(groups.size).toBe(1);
    const [[boardId, ids]] = [...groups] as [[number, string[]]];
    const side = runner.boards.get(boardId)!.fen.split(" ")[1];
    // Only the team whose side is to move picks.
    expect(ids.every((id) => runner.player(id).colour === side)).toBe(true);
    expect(ids.length).toBe(runner.alive().length / 2);
    await runner.score(new Map());
    plies++;
    if (runner.stageComplete()) {
      runner.endStage();
      sizes.push(runner.alive().length);
      if (!runner.boss) {
        // Teams stay even all the way down.
        const w = runner.alive().filter((p) => p.colour === "w").length;
        expect(w * 2).toBe(runner.alive().length);
      }
    }
  }
  return { runner, sizes, plies };
}

describe("Crowd mode", () => {
  const base: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };

  it("50 v 50 team final: down to 8, then 4v4 alternating, 3v3, 2v2 to the end", async () => {
    const settings: Settings = { ...base, finalMaxTurns: 70 };
    const { runner, sizes, plies } = await playKnockouts(settings, 1);
    expect(sizes).toEqual([84, 70, 58, 48, 40, 32, 26, 20, 16, 12, 8]);
    expect(plies).toBe(20 + 2 * 10);
    // The final: each team's four, the side to move first, alternating teams.
    let f = runner.final!;
    expect(f.format).toBe("team");
    const side = runner.boards.get(runner.state.boards[0]!)!.fen.split(" ")[1];
    expect(f.teams[0].every((id) => runner.player(id).colour === side)).toBe(true);
    expect(f.teams[1].every((id) => runner.player(id).colour !== side)).toBe(true);
    expect(f.order).toEqual([f.teams[0][0], f.teams[1][0], f.teams[0][1], f.teams[1][1], f.teams[0][2], f.teams[1][2], f.teams[0][3], f.teams[1][3]]);
    const sizesSeen: number[] = [];
    let turns = 0;
    while (!runner.stageComplete()) {
      const groups = runner.deal();
      const [[boardId, [mover]]] = [...groups] as [[number, string[]]];
      // The mover always plays the side to move.
      expect(runner.player(mover!).colour).toBe(runner.boards.get(boardId)!.fen.split(" ")[1]);
      await runner.score(new Map());
      turns++;
      const out = runner.afterFinalTurn();
      if (out.length) {
        expect(out).toHaveLength(2);
        sizesSeen.push(runner.alive().length);
        // One from each side, placed just below those still in.
        expect(new Set(out.map((id) => runner.player(id).colour)).size).toBe(2);
        expect(out.map((id) => runner.player(id).placement).sort()).toEqual([runner.alive().length + 1, runner.alive().length + 2]);
      }
    }
    f = runner.final!;
    expect(sizesSeen).toEqual([6, 4].slice(0, sizesSeen.length));
    if (turns >= 24 + 18) expect(sizesSeen).toEqual([6, 4]);
    runner.finishFinal();
    expect(runner.isOver()).toBe(true);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(runner.leaderboard()[0]!.team).toMatch(/^[wb]$/);
  });

  it("leaving (LEAVING): a seat handed to a bot keeps its team, score and turns in the final under a new id; one that goes out takes the last place still open, and every place is still given once", async () => {
    const settings: Settings = { ...base, finalMaxTurns: 30 };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(3),
      engines: [fake],
      library,
      entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: i > 1, skill: 1 + (i % 20) })),
    });
    // Two moves in, b0 (a person) leaves: a bot takes the seat.
    for (let i = 0; i < 2; i++) {
      runner.deal();
      await runner.score(new Map());
    }
    const seat = runner.player("b0");
    runner.deal();
    runner.handOver("b0", { id: "rb1", name: "Relief Rita", skill: 4 });
    expect(runner.state.players.some((p) => p.id === "b0")).toBe(false);
    expect(runner.player("rb1")).toMatchObject({ isBot: true, skill: 4, name: "Relief Rita", colour: seat.colour, stageScore: seat.stageScore, alive: true });
    // (In this move's group, under its new id, if its team is moving.)
    const group = [...runner.groups.values()][0]!;
    expect(group.includes("b0")).toBe(false);
    if (seat.colour === runner.boards.get(runner.state.boards[0]!)!.fen.split(" ")[1]) expect(group).toContain("rb1");
    await runner.score(new Map());
    // b1 (a person) leaves with nobody to take the seat: out now, last of the 100 still in.
    expect(runner.retire("b1")).toBe(100);
    expect(runner.player("b1")).toMatchObject({ alive: false, placement: 100 });
    expect(runner.alive()).toHaveLength(99);
    // The match plays on to the end: every place from 1 to 100 given exactly once.
    while (!runner.isFinal()) {
      runner.deal();
      await runner.score(new Map());
      if (runner.stageComplete()) runner.endStage();
    }
    while (!runner.stageComplete()) {
      runner.deal();
      await runner.score(new Map());
      runner.afterFinalTurn();
    }
    runner.finishFinal();
    expect(runner.isOver()).toBe(true);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    // Before move 1, a seat nobody takes is simply gone.
    const early = new MatchRunner({ settings, rng: mulberry32(4), engines: [fake], library, entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: i > 0 })) });
    early.withdraw("b0");
    expect(early.state.players).toHaveLength(99);
  });

  it("50 v 50 duel: the best of each side play 1v1; the game's winner places first", async () => {
    const settings: Settings = { ...base, finalFormat: "duel", knockoutsPerStage: CROWD_KNOCKOUTS.duel, finalMaxTurns: 40 };
    const { runner, sizes } = await playKnockouts(settings, 3);
    expect(sizes.at(-1)).toBe(2);
    const f = runner.final!;
    expect(f.format).toBe("duel");
    expect(f.teams.map((t) => t.length)).toEqual([1, 1]);
    while (!runner.stageComplete()) {
      runner.deal();
      await runner.score(new Map());
      expect(runner.afterFinalTurn()).toEqual([]);
    }
    const winner = runner.gameWinner();
    runner.finishFinal();
    const first = runner.state.players.find((p) => p.placement === 1)!;
    if (winner) expect(first.colour).toBe(winner);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it("50 v 50 boss final: always the Hidden Boss (whatever boss was picked), the top 4 against him, from the starting position, at his fixed strength and brain", async () => {
    // (A boss picked or met last makes no difference: Eric, Oct 14, "that mode is always just versus [him]".)
    const settings: Settings = { ...base, finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss, bossMaxMoves: 20, bossId: "bigboy", bossAvoid: "recluse" };
    const { runner, sizes, plies } = await playKnockouts(settings, 4);
    expect(crowdFinalists("boss")).toBe(4);
    expect(sizes.at(-1)).toBe(4);
    // The duel's cuts, stopping at four: two from each team at the last two.
    expect(sizes).toEqual([84, 70, 58, 48, 40, 32, 26, 20, 16, 12, 8, 6, 4]);
    expect(plies).toBe(20 + 2 * 12);
    const boss = runner.boss!;
    expect(boss.id).toBe(crowdFinalBoss()!.id);
    expect(boss.id).toBe("recluse");
    expect(runner.bossView()!.name).toBe(bossDef("recluse")!.name);
    expect(boss.crowdSide).toBe("w");
    // From the starting position (he has no book openings), White to move, the four as one crowd.
    const board = runner.boards.get(runner.state.boards[0]!)!;
    expect(board.history).toEqual([]);
    expect(board.fen).toBe(START_FEN);
    expect(runner.alive()).toHaveLength(4);
    expect(runner.alive().every((p) => p.colour === null)).toBe(true);
    // His strength and brain are fixed: Maia at its top, raw, whatever the crowd (a crowd of four too).
    expect(boss.elo).toBe(fixedLevel());
    expect(runner.bossBrainPlan("", true)).toEqual({ brain: "maia-raw", rating: maiaTopRating(), stockfishShare: 0 });
    expect(runner.bossBrainPlan("", false)).toMatchObject({ brain: "stockfish" });
    // His ultimate is the bullet clock, his passive the God King blocked.
    expect(runner.bossView()!.powers).toMatchObject({ passive: "nohelp", ultimate: "bullet" });
  });

  it("50 v 50 boss final: the four play the battle out against him; the God King's help never comes, nobody is struck, and everyone is placed", async () => {
    const settings: Settings = { ...base, finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss, bossMaxMoves: 9 };
    const { runner } = await playKnockouts(settings, 4);
    const boss = runner.boss!;
    expect(boss.id).toBe("recluse");
    // His charges still come from the finalists' leftover power-ups (they only spend against him).
    expect(boss.kingCharges).toBeGreaterThanOrEqual(1);
    expect(runner.alive().every((p) => p.powerUps === 0)).toBe(true);
    const struck: string[] = [];
    let crowdMoves = 0;
    while (!runner.stageComplete()) {
      if (runner.bossToMove()) {
        await runner.playBoss();
        continue;
      }
      const groups = runner.deal();
      expect([...groups.values()][0]!.length).toBe(runner.alive().length);
      // Everyone calls the God King, and calls for his strike: neither comes.
      for (const p of runner.alive()) runner.kingCallers.add(p.id);
      expect(runner.callStrike(runner.alive()[0]!.id).struck).toBe(false);
      const round = await runner.score(new Map());
      expect(round.boards[0]!.king).toBeFalsy();
      crowdMoves++;
      if (runner.bossKillDue()) struck.push(runner.bossKill()!);
    }
    expect(crowdMoves).toBeGreaterThan(0);
    expect(runner.boss!.kingMoves).toEqual([]);
    expect(runner.boss!.kingStrikes ?? []).toEqual([]);
    expect(runner.boss!.lastStand ?? null).toBeNull();
    // He never strikes: all four play to the end.
    expect(struck).toEqual([]);
    expect(runner.bossView()!.strikeIn).toBeNull();
    const result = runner.finishBossBattle();
    expect(["crowd", "boss", "draw"]).toContain(result);
    expect(runner.isOver()).toBe(true);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
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
    const settings: Settings = { ...base, finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss, bossMaxMoves: 4 };
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
    // Patches without a bank (how it ends) leave the banks alone.
    runner.patchSettings({ finalFormat: "boss" });
    expect(new Set(runner.state.players.map((p) => p.bankMs))).toEqual(new Set([180_000]));
    let rounds = 0;
    while (!runner.isFinal()) {
      runner.deal();
      expect(runner.moveClock()).toBe(10);
      const ids = [...runner.groups.values()][0]!;
      for (const id of ids) expect(runner.allowedMsFor(id)).toBe(Math.min(10_000, runner.player(id).bankMs + 2_000));
      // Bots spread out within 85% of the 10 s cap, never on the buzzer.
      expect(Math.max(...Object.values(runner.botThinkTimes()))).toBeLessThanOrEqual(8_500);
      await runner.score(new Map());
      if (runner.stageComplete()) runner.endStage();
      rounds++;
    }
    // (The knockouts: the first stage's rounds, then the rest a stage each.)
    expect(rounds).toBe(settings.firstStageRounds + (CROWD_KNOCKOUTS.boss.length - 1) * settings.roundsPerStage);
    // Each bot paid what it thought beyond the 2 s increment, never more than 8 s a move, from its 3:00.
    for (const p of runner.state.players.filter((x) => x.movesTimed > 0)) {
      expect(p.bankMs).toBe(Math.max(0, 180_000 + p.movesTimed * 2_000 - p.thinkMsTotal));
    }
    // The boss battle keeps the cap. And once moves are played, another time control never resets a bank.
    runner.deal();
    expect(runner.moveClock()).toBe(10);
    const before = runner.state.players.map((p) => p.bankMs);
    runner.patchSettings(rapid!.patch);
    expect(runner.state.players.map((p) => p.bankMs)).toEqual(before);
  });

  it("a rising move clock (moveClockSteps; no option has one today) follows the move number, and the boss battle counts on", async () => {
    const rising = [
      { fromMove: 1, seconds: 10 },
      { fromMove: 6, seconds: 15 },
      { fromMove: 11, seconds: 20 },
      { fromMove: 16, seconds: 25 },
      { fromMove: 21, seconds: 30 },
    ];
    const settings: Settings = { ...base, finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss, bossMaxMoves: 4, moveClockSteps: rising };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(11),
      engines: [fake],
      library,
      entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) })),
    });
    const seen = new Map<number, number>();
    while (!runner.isFinal()) {
      runner.deal();
      const move = moveNumber(runner.boards.get(runner.state.boards[0]!)!.fen);
      const clock = runner.moveClock();
      seen.set(move, clock);
      expect(runner.allowedMsFor([...runner.groups.values()][0]![0]!)).toBe(clock * 1000);
      // Bots spread out within 85% of this move's clock (on 10 s: 2 to 8.5 s, never piling up on the buzzer).
      const think = Object.values(runner.botThinkTimes());
      expect(Math.max(...think)).toBeLessThanOrEqual(0.85 * clock * 1000 + 1);
      await runner.score(new Map());
      if (runner.stageComplete()) runner.endStage();
    }
    // The knockouts end after move 22 (44 plies).
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 22].map((m) => seen.get(m))).toEqual([10, 10, 15, 15, 20, 20, 25, 25, 30, 30]);
    // The boss battle starts again from the starting position (the Hidden Boss's), but its clock counts on from where the
    // game was: 30 s.
    expect(runner.boss!.clockFromMove).toBe(23);
    runner.deal();
    expect(runner.clockMove()).toBe(23);
    expect(runner.moveClock()).toBe(30);
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
