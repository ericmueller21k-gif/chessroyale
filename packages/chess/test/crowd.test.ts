import { describe, expect, it } from "vitest";
import { CROWD_KNOCKOUTS, DEFAULT_SETTINGS, RAID_SETTINGS, raidBossElo, bossElo, bossStartPly, bossInfo, botVotes, clockAfterVote, modeSettings, mulberry32, tallyVotes, voteMoves, voteOptionOf, type Settings } from "@chessroyale/core";
import { bossIntroTimeline, bossShowMs, legalMoves, MatchRunner, START_FEN, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

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
    if (settings.crowdTeams) {
      // Only the team whose side is to move picks.
      expect(ids.every((id) => runner.player(id).colour === side)).toBe(true);
      expect(ids.length).toBe(runner.alive().length / 2);
    } else {
      expect(ids.length).toBe(runner.alive().length);
    }
    await runner.score(new Map());
    plies++;
    if (runner.stageComplete()) {
      runner.endStage();
      sizes.push(runner.alive().length);
      if (settings.crowdTeams && !runner.boss) {
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
    const settings: Settings = { ...base, crowdTeams: true, finalMaxTurns: 70 };
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

  it("50 v 50 duel: the best of each side play 1v1; the game's winner places first", async () => {
    const settings: Settings = { ...base, crowdTeams: true, finalFormat: "duel", knockoutsPerStage: CROWD_KNOCKOUTS.duel, finalMaxTurns: 40 };
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

  it("50 v 50 boss battle: the top 10 play White from an even position of their own game, the boss replies and strikes every 3 moves", async () => {
    const settings: Settings = { ...base, crowdTeams: true, finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss, bossMaxMoves: 20 };
    const { runner, sizes, plies } = await playKnockouts(settings, 4);
    expect(sizes.at(-1)).toBe(10);
    const boss = runner.boss!;
    expect(boss.crowdSide).toBe("w");
    expect(boss.elo).toBeGreaterThanOrEqual(settings.bossEloRange[0]);
    // A position from the game just played: White to move, between moves 5 and 12 (or the start).
    const board = runner.boards.get(runner.state.boards[0]!)!;
    expect(plies).toBe(40);
    expect(board.history.length % 2).toBe(0);
    expect(board.history.length === 0 || (board.history.length >= 10 && board.history.length <= 24)).toBe(true);
    expect(board.fen.split(" ")[1]).toBe("w");
    expect(runner.alive().every((p) => p.colour === null)).toBe(true);
    // The King: charges from the ten's leftover power-ups; when the crowd calls him he plays the engine's best move.
    const charges = boss.kingCharges!;
    expect(charges).toBeGreaterThanOrEqual(1);
    expect(charges).toBeLessThanOrEqual(3);
    expect(runner.alive().every((p) => p.powerUps === 0)).toBe(true);
    runner.deal();
    for (const p of runner.alive()) runner.kingCallers.add(p.id);
    const kingRound = await runner.score(new Map());
    expect(kingRound.boards[0]!.king).toBe(true);
    expect(kingRound.boards[0]!.result.playedMove).toBe(kingRound.boards[0]!.bestMove);
    expect(runner.boss!.kingCharges).toBe(charges - 1);
    expect(runner.boss!.kingMoves).toEqual([1]);
    const struck: string[] = [];
    while (!runner.stageComplete()) {
      if (runner.bossToMove()) {
        await runner.playBoss();
        expect(runner.bossToMove()).toBe(false);
        continue;
      }
      const groups = runner.deal();
      // Everyone left picks the crowd's move.
      expect([...groups.values()][0]!.length).toBe(runner.alive().length);
      await runner.score(new Map());
      if (runner.bossKillDue()) {
        const alive = runner.alive().length;
        const victim = runner.bossKill()!;
        struck.push(victim);
        expect(runner.player(victim).placement).toBe(alive);
      }
    }
    // 20 crowd moves: a strike after moves 3, 6, ... down to the 3 survivors at least.
    expect(struck.length).toBe(Math.min(6, 10 - settings.bossMinSurvivors));
    const view = runner.bossView()!;
    expect(view.kills.map((k) => k.id)).toEqual(struck);
    const result = runner.finishBossBattle();
    expect(["crowd", "boss", "draw"]).toContain(result);
    expect(runner.isOver()).toBe(true);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it("boss battle timing: the intro replays the game, and the boss taking your queen stays up longer for its banner", async () => {
    // A 10-ply opening: the card, ten moves at 240 ms, a beat, then "START!".
    expect(bossIntroTimeline(10)).toEqual({ step: 240, replayAt: 2600, bannerAt: 5250, total: 6750 });
    // A long game replays faster, a short one no slower than the cap.
    expect(bossIntroTimeline(24).step).toBe(110);
    expect(bossIntroTimeline(0).total).toBe(2600 + 250 + 1500);
    expect(bossShowMs({ captured: "q" })).toBeGreaterThan(bossShowMs({ captured: "b" }));
    expect(bossShowMs(null)).toBe(1800);
    // The boss's move records what it took.
    const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000 } as Settings;
    const lib: Opening[] = [{ ...library[0]!, moves: sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"]), expected: { 10: 0.52 } }];
    const runner = new MatchRunner({ settings, rng: mulberry32(3), engines: [fake], library: lib, entrants: [{ id: "h0", name: "H0", isBot: false }] });
    runner.deal();
    await runner.score(new Map([["h0", { move: "a4c6", thinkMs: 1000 }]]));
    runner.applyBossMove("d7c6");
    expect(runner.bossView()!.lastMove).toMatchObject({ san: "dxc6", captured: "b" });
  });

  it("boss raid: humans only, the boss from the first move on a named opening, strikes down to half, the King's strike staggers the boss", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossMaxMoves: 12 } as Settings;
    const lib: Opening[] = [{ ...library[0]!, moves: sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"]), expected: { 10: 0.52 } }];
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(11),
      engines: [fake],
      library: lib,
      entrants: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })),
    });
    const boss = runner.boss!;
    expect(boss.elo).toBe(2000);
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
    while (!runner.stageComplete()) {
      if (runner.bossToMove()) {
        await runner.playBoss();
        continue;
      }
      runner.deal();
      await runner.score(new Map([...runner.alive()].map((p) => [p.id, { move: null, thinkMs: 1000 }])));
      if (runner.bossKillDue()) runner.bossKill();
    }
    expect(runner.alive().length).toBe(3);
    runner.finishBossBattle();
    expect(runner.state.players.map((p) => p.placement).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    // The boss tiers: the weakest stronger than the group's average.
    expect(raidBossElo([1500, 1700])).toBe(1700);
    expect(raidBossElo([1650, 1650])).toBe(1700);
    expect(raidBossElo([null])).toBe(1700);
    expect(raidBossElo([3100])).toBe(2900);
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

  it("the boss's strength leans towards the best of the crowd, plus the offset, within limits", () => {
    const s = { bossEloOffset: 150, bossEloRange: [1320, 3000] as const };
    // Weights 3, 2, 1: (3*2000 + 2*1600 + 1*1200) / 6 = 1733, + 150.
    expect(bossElo([1600, 2000, 1200], s)).toBe(1883);
    expect(bossElo([null, null], s)).toBe(1650);
    expect(bossElo([400], s)).toBe(1320);
    expect(bossElo([3300], s)).toBe(3000);
    expect(bossInfo(1400).threat).toBe(1);
    expect(bossInfo(2900).threat).toBe(5);
  });

  it("everyone moves: all alive pick every ply, cut by overall standings", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: false }) };
    const { runner, sizes } = await playKnockouts(settings, 2);
    expect(sizes.at(-1)).toBe(4);
    expect(runner.final!.order).toHaveLength(4);
    expect(runner.leaderboard()[0]!.team).toBeNull();
  });

  it("bot picks decided at the start of a round are the ones scored", async () => {
    const settings: Settings = { ...base, crowdTeams: true };
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

  it("pre-game votes: pawn pushes into three zones, most votes wins, ties drawn, none gives the default", () => {
    expect(voteMoves("w", 0)).toEqual(["b2b4", "c2c4"]);
    expect(voteMoves("b", 2)).toEqual(["f7f5", "g7g5"]);
    expect(voteOptionOf("d2d4")).toBe(1);
    expect(voteOptionOf("e7e5")).toBe(1);
    expect(voteOptionOf("g2g4")).toBe(2);
    expect(voteOptionOf("a2a4")).toBeNull();
    expect(voteOptionOf("e2e3")).toBeNull();
    for (const move of [...voteMoves("w", 0), ...voteMoves("w", 1), ...voteMoves("w", 2)]) expect(legalMoves(START_FEN)).toContain(move);
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
