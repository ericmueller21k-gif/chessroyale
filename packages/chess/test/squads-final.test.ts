import { describe, expect, it } from "vitest";
import { SQUADS, mulberry32, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, legalMoves, type EngineLike } from "../src/index.ts";
import {
  NO_INPUTS,
  armageddonChooser,
  botArmageddonColour,
  botPairPick,
  botRelayMove,
  botVotePick,
  candidatesFrom,
  choose,
  createSquadsMatch,
  dutyOf,
  halfDuties,
  halfReady,
  lockIn,
  resolveHalf,
  squadBotCandidates,
  squadBotSkill,
  squadBotThinkMs,
  startArmageddon,
  visibleChoices,
  type HalfInputs,
  type Lineup,
  type Side,
  type SquadsEvent,
  type SquadsMatch,
} from "../src/squads/index.ts";

const sides: [Lineup, Lineup] = [
  { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
  { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
];
const CASTLING = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
const PROMOTION = "8/4P3/8/8/8/8/k7/4K3 w - - 0 1";
const ONE_MOVE = "k7/8/8/8/8/8/1q6/K7 w - - 0 1";
const WHITE_STALEMATES = "7k/8/6Q1/8/8/8/8/K7 w - - 0 1";

const BANK = 240_000;
const DELAY = 4_000;
const CEILING = 20_000;
function final(fen = START_FEN, seed = 1, white: Side = 0, s?: SquadsSettings, banksMs: [number, number] = [BANK, BANK]): SquadsMatch {
  return createSquadsMatch(
    { key: "r2m0", seed, round: 2, format: "final", sides, starts: [{ fen, openingId: null }], whites: [white], banksMs, delayMs: DELAY, incrementMs: 0, capMs: CEILING },
    s,
  );
}
function inputs(m: SquadsMatch, moves: Record<string, string>, s?: SquadsSettings): HalfInputs {
  let inp = NO_INPUTS;
  for (const [id, mv] of Object.entries(moves)) {
    const r = choose(m, inp, id, mv, s);
    if ("error" in r) throw new Error(`${id} ${mv}: ${r.error}`);
    inp = lockIn(r.inputs, id);
  }
  return inp;
}
const vote = (events: SquadsEvent[]) => events.find((e): e is Extract<SquadsEvent, { kind: "vote" }> => e.kind === "vote")!;

/** Resolves an Armageddon half over seeds until `want` holds. */
function findArm(arm: SquadsMatch, moves: Record<string, string>, want: (o: ReturnType<typeof resolveHalf>) => boolean) {
  for (let seed = 1; seed < 200; seed++) {
    const m = { ...arm, seed };
    const out = resolveHalf(m, inputs(m, moves));
    if (want(out)) return out;
  }
  throw new Error("No seed gives that outcome");
}

describe("Squads final: the majority vote", () => {
  it("on a squad's move its whole squad picks, from move 1; the other squad has nothing to choose", () => {
    const m = final();
    expect(halfDuties(m).duties).toEqual([{ board: 0, side: 0, role: "pick", players: ["a0", "a1", "a2", "a3"], deadlineMs: CEILING }]);
    expect(halfDuties({ ...m, half: "b" }).duties).toEqual([{ board: 0, side: 1, role: "pick", players: ["b0", "b1", "b2", "b3"], deadlineMs: CEILING }]);
    // The squad given Black by the coin picks on Black's moves.
    expect(halfDuties(final(START_FEN, 1, 1)).duties[0]).toMatchObject({ side: 1, role: "pick" });
    expect(dutyOf(m, "a2")).toEqual({ duty: halfDuties(m).duties[0], partner: null, team: ["a0", "a1", "a3"] });
    expect(choose(m, NO_INPUTS, "b0", "e2e4")).toEqual({ error: "no_duty" });
    // No same-move tokens in the final.
    expect(m.tokens).toBeNull();
  });

  it("teammates' picks show live to their own squad only (not the other squad, not spectators); copying is allowed", () => {
    const m = final();
    const inp = inputs(m, { a0: "e2e4", a1: "e2e4", a2: "d2d4" });
    expect(visibleChoices(m, inp, 0)).toEqual({ a0: "e2e4", a1: "e2e4", a2: "d2d4" });
    expect(visibleChoices(m, inp, 1)).toEqual({});
    expect(visibleChoices(m, inp, null)).toEqual({});
    expect(halfReady(m, inp)).toBe(false);
    expect(halfReady(m, inputs(m, { a0: "e2e4", a1: "e2e4", a2: "d2d4", a3: "e2e4" }))).toBe(true);
  });

  it("the most picked move plays; every pick counts once", () => {
    const m = final();
    const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", a2: "e2e4", a3: "g1f3" }));
    const e = vote(out.events);
    expect(e).toMatchObject({ players: ["a0", "a1", "a2", "a3"], picks: ["e2e4", "d2d4", "e2e4", "g1f3"], tied: ["e2e4"], coin: null, random: false, move: "e2e4" });
    expect(e.tally).toEqual([
      { move: "e2e4", votes: 2 },
      { move: "d2d4", votes: 1 },
      { move: "g1f3", votes: 1 },
    ]);
    expect(out.match.boards[0]!.moves).toEqual(["e2e4"]);
    expect([...out.acted].sort()).toEqual(["a0", "a1", "a2", "a3"]);
    const all = resolveHalf(m, inputs(m, { a0: "c2c4", a1: "c2c4", a2: "c2c4", a3: "g1f3" }));
    expect(vote(all.events).move).toBe("c2c4");
  });

  it("a 2-2 tie: a seeded coin between the tied moves (both happen; the same seed, the same move)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const m = final(START_FEN, seed);
      const moves = { a0: "e2e4", a1: "d2d4", a2: "d2d4", a3: "e2e4" };
      const out = resolveHalf(m, inputs(m, moves));
      const e = vote(out.events);
      expect(e.tied).toEqual(["e2e4", "d2d4"]);
      expect(e.move).toBe(e.tied[e.coin!]);
      expect(resolveHalf(m, inputs(m, moves))).toEqual(out);
      seen.add(e.move);
    }
    expect([...seen].sort()).toEqual(["d2d4", "e2e4"]);
  });

  it("a tie is broken only among the moves tied for the most (four different picks: any of the four; 2-1-1: never a 1)", () => {
    const four = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const m = final(START_FEN, seed);
      const e = vote(resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", a2: "c2c4", a3: "g1f3" })).events);
      expect(e.tied).toHaveLength(4);
      four.add(e.move);
      const clear = vote(resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", a2: "d2d4", a3: "g1f3" })).events);
      expect(clear).toMatchObject({ move: "d2d4", tied: ["d2d4"], coin: null });
    }
    expect([...four].sort()).toEqual(["c2c4", "d2d4", "e2e4", "g1f3"]);
  });

  it("players who didn't pick don't count (their misses are logged); one pick alone plays", () => {
    const m = final();
    const out = resolveHalf(m, inputs(m, { a1: "b1c3" }));
    const e = vote(out.events);
    expect(e).toMatchObject({ picks: [null, "b1c3", null, null], tally: [{ move: "b1c3", votes: 1 }], move: "b1c3", random: false });
    expect([...out.missed].sort()).toEqual(["a0", "a2", "a3"]);
    expect(out.acted).toEqual(["a1"]);
    // A pick after the deadline doesn't count either.
    const late = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", a2: "d2d4" }), { a0: 1_000, a1: CEILING + 1, a2: CEILING + 1 });
    expect(vote(late.events)).toMatchObject({ picks: ["e2e4", null, null, null], move: "e2e4" });
  });

  it("nobody picked: a random legal move plays (the same for the same seed), everyone missed", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 30; seed++) {
      const out = resolveHalf(final(START_FEN, seed), NO_INPUTS);
      const e = vote(out.events);
      expect(e).toMatchObject({ random: true, tally: [], tied: [], coin: null });
      expect(legalMoves(START_FEN)).toContain(e.move);
      expect([...out.missed].sort()).toEqual(["a0", "a1", "a2", "a3"]);
      expect(resolveHalf(final(START_FEN, seed), NO_INPUTS)).toEqual(out);
      seen.add(e.move);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it("castling and promotion as picks", () => {
    const m = final(CASTLING);
    expect(resolveHalf(m, inputs(m, { a0: "e1c1", a1: "e1c1", a2: "e1g1" })).match.boards[0]!.fen.split(" ")[0]).toBe("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/2KR3R");
    const p = final(PROMOTION);
    // Each promotion piece is its own move.
    const out = resolveHalf(p, inputs(p, { a0: "e7e8n", a1: "e7e8q", a2: "e7e8n" }));
    expect(out.match.boards[0]!.fen.split(" ")[0]).toBe("4N3/8/8/8/8/8/k7/4K3");
  });

  it("only one legal move: it plays itself (no picks, no misses)", () => {
    const m = final(ONE_MOVE);
    expect(halfDuties(m)).toEqual({ duties: [], scouts: [], forced: [0] });
    const out = resolveHalf(m, NO_INPUTS);
    expect(out.events[0]).toEqual({ kind: "forced", turn: 0, half: "w", board: 0, side: 0, move: "a1b2" });
    expect(out.missed).toEqual([]);
  });

  it("the voting squad's bank drains once while it votes (its slowest picker); the other squad's not at all", () => {
    const m = final();
    const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", a2: "e2e4", a3: "e2e4" }), { a0: 2_000, a1: DELAY + 6_000, a2: 1_000, a3: DELAY + 2_000 });
    expect(out.match.banks).toEqual([BANK - 6_000, BANK]);
    // Someone never picks: the move is thought about to the ceiling.
    const slow = resolveHalf(m, inputs(m, { a0: "e2e4" }), { a0: 2_000 });
    expect(slow.match.banks).toEqual([BANK - (CEILING - DELAY), BANK]);
  });

  it("sudden death in the final: picks within the free seconds or they don't count; nobody loses on time", () => {
    const low = final(START_FEN, 1, 0, undefined, [0, BANK]);
    expect(halfDuties(low).duties.map((d) => [d.role, d.deadlineMs])).toEqual([["pick", DELAY]]);
    const out = resolveHalf(low, inputs(low, { a0: "e2e4", a1: "d2d4", a2: "d2d4" }), { a0: 1_000, a1: DELAY + 1, a2: DELAY + 1 });
    expect(vote(out.events)).toMatchObject({ picks: ["e2e4", null, null, null], move: "e2e4" });
    expect([...out.timeouts].sort()).toEqual(["a1", "a2", "a3"]);
    expect(out.match.result).toBeNull();
  });

  it("the final is played to the end; a drawn final goes to Armageddon, a majority vote too, White with more time", () => {
    const m = final(WHITE_STALEMATES);
    expect(m.safetyMoves).toBe(SQUADS.safetyCap);
    const out = resolveHalf(m, inputs(m, { a0: "g6f7", a1: "g6f7", a2: "g6g5" }));
    expect(out.match.result).toEqual({ winner: null, points: [0.5, 0.5], how: "boards" });
    const spent: SquadsMatch = { ...out.match, blockBanks: [2, 4] };
    const arm = startArmageddon(spent, 1, { fen: START_FEN, openingId: null });
    expect(arm).toMatchObject({ format: "final", armageddon: true, key: "r2m0-armageddon", incrementMs: SQUADS.armageddon.incrementSeconds * 1000 });
    // Its own fixed clocks: White (side 1 here) more, Black less; the lobby's free seconds.
    expect(arm.banks).toEqual([SQUADS.armageddon.blackSeconds * 1000, SQUADS.armageddon.whiteSeconds * 1000]);
    expect(arm.delayMs).toBe(DELAY);
    expect(arm.boards[0]!.white).toBe(1);
    // The same match: each squad keeps the block bank the final left it; no tokens.
    expect(arm.blockBanks).toEqual([2, 4]);
    expect(arm.tokens).toBeNull();
    expect(halfDuties(arm).duties.map((d) => [d.side, d.role, d.players.length])).toEqual([[1, "pick", 4]]);
    // Only a drawn final goes to Armageddon.
    expect(() => startArmageddon(final(), 0, { fen: START_FEN, openingId: null })).toThrow();
  });

  it("the squad with more team bank left after the final picks Armageddon's colours (a coin if level)", () => {
    const drawn = (banks: [number, number], seed = 1): SquadsMatch => {
      const m = final(START_FEN, seed, 0, undefined, banks);
      return { ...m, boards: [{ ...m.boards[0]!, result: { winner: null, reason: "repetition" } }], result: { winner: null, points: [0.5, 0.5], how: "boards" } };
    };
    expect(armageddonChooser(drawn([50_000, 20_000]))).toBe(0);
    expect(armageddonChooser(drawn([10_000, 20_000]))).toBe(1);
    const seen = new Set<Side>();
    for (let seed = 1; seed < 30; seed++) seen.add(armageddonChooser(drawn([5_000, 5_000], seed)));
    expect([...seen].sort()).toEqual([0, 1]);
  });

  it("Armageddon: a draw counts for Black; on its own clocks a side can run out, but that's sudden death, not a loss", () => {
    const base = (() => {
      const m = final();
      return { ...m, result: { winner: null, points: [0.5, 0.5] as const, how: "boards" as const } };
    })();
    const stale = startArmageddon(base, 0, { fen: WHITE_STALEMATES, openingId: null });
    const drawn = findArm(stale, { a0: "g6f7", a1: "g6f7" }, (o) => o.match.boards[0]!.moves[0] === "g6f7");
    expect(drawn.match.result).toMatchObject({ winner: 1, how: "armageddon" });
    // White (side 0) with 5 s runs out: random moves, and sudden death after; the game goes on.
    const short: SquadsSettings = { ...SQUADS, armageddon: { ...SQUADS.armageddon, whiteSeconds: 5, incrementSeconds: 0 } };
    const arm = startArmageddon(base, 0, { fen: START_FEN, openingId: null }, short);
    const out = resolveHalf(arm, NO_INPUTS, {}, short);
    expect(out.match.banks[0]).toBe(0);
    expect(out.match.boards[0]!.moves).toHaveLength(1);
    expect(out.match.result).toBeNull();
  });

  it("a whole final replays exactly from the same seed and choices", () => {
    const play = () => {
      let m = final(START_FEN, 99);
      const rng = mulberry32(5);
      const log: SquadsEvent[] = [];
      for (let i = 0; i < 40 && !m.result; i++) {
        let inp = NO_INPUTS;
        for (const d of halfDuties(m).duties) {
          for (const p of d.players) {
            if (rng() < 0.15) continue; // a miss now and then
            const legal = legalMoves(m.boards[0]!.fen).slice(0, 3);
            const r = choose(m, inp, p, legal[Math.floor(rng() * legal.length)]!);
            if ("inputs" in r) inp = r.inputs;
          }
        }
        const out = resolveHalf(m, inp);
        log.push(...out.events);
        m = out.match;
      }
      return { m, log };
    };
    const a = play();
    expect(play()).toEqual(a);
    const votes = a.log.filter((e): e is Extract<SquadsEvent, { kind: "vote" }> => e.kind === "vote");
    expect(votes.length).toBeGreaterThan(10);
    expect(votes.some((e) => e.coin !== null)).toBe(true);
  });
});

describe("Squad bots", () => {
  const top = [
    { move: "e2e4", expected: 0.55 },
    { move: "d2d4", expected: 0.54 },
    { move: "g1f3", expected: 0.52 },
    { move: "a2a3", expected: 0.4 },
  ];
  const cands = candidatesFrom(top);
  const legal = legalMoves(START_FEN);

  it("candidates are each move's loss in points against the best", () => {
    expect(cands.map((c) => [c.move, Math.round(c.loss)])).toEqual([
      ["e2e4", 0],
      ["d2d4", 1],
      ["g1f3", 3],
      ["a2a3", 15],
    ]);
  });

  it("use the bot engine's top moves", async () => {
    const asked: [string, number][] = [];
    const engine: EngineLike = {
      async topMoves(fen, n) {
        asked.push([fen, n]);
        return top;
      },
      async scoreMoves() {
        return [];
      },
    };
    expect(await squadBotCandidates(engine, START_FEN)).toEqual(cands);
    expect(asked).toEqual([[START_FEN, SQUADS.bots.candidates]]);
  });

  it("a strong bot plays the best move; a pair bot never picks its partner's move (unless told it's an only move)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      expect(legal).toContain(botRelayMove(rng, cands, 4, legal));
      expect(botPairPick(rng, cands, 4, legal, "e2e4")).not.toBe("e2e4");
      expect(botPairPick(rng, cands, 4, legal, "e2e4", true)).toBe("e2e4");
    }
    const strong = Array.from({ length: 50 }, () => botRelayMove(rng, cands, 0.01, legal));
    expect(strong.filter((m) => m === "e2e4").length).toBeGreaterThan(40);
  });

  it("final: a bot votes at its skill, and sometimes copies a pick a person on its squad has made", () => {
    const rng = mulberry32(2);
    const never: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, copyHumanChance: 0 } };
    const always: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, copyHumanChance: 1 } };
    const own = Array.from({ length: 50 }, () => botVotePick(rng, cands, 0.01, legal, ["a2a3"], never));
    expect(own.filter((m) => m === "e2e4").length).toBeGreaterThan(40);
    for (let i = 0; i < 50; i++) expect(["a2a3", "h2h3"]).toContain(botVotePick(rng, cands, 0.01, legal, ["a2a3", "h2h3"], always));
    // Nobody to copy: its own pick.
    expect(botVotePick(rng, cands, 0.01, legal, [], always)).toBe("e2e4");
    const some = Array.from({ length: 400 }, () => botVotePick(rng, cands, 0.01, legal, ["a2a3"]));
    const share = some.filter((m) => m === "a2a3").length / 400;
    expect(share).toBeGreaterThan(SQUADS.bots.copyHumanChance - 0.1);
    expect(share).toBeLessThan(SQUADS.bots.copyHumanChance + 0.1);
  });

  it("think by their squad's clock, never past the deadline (in sudden death, within the free seconds); and take Black in Armageddon", () => {
    const rng = mulberry32(3);
    const [lo, hi] = SQUADS.bots.thinkRange;
    for (let i = 0; i < 100; i++) {
      const ms = squadBotThinkMs(rng, { bankMs: 240_000, incrementMs: 0, delayMs: 4_000, deadlineMs: 20_000 });
      const target = 240_000 / SQUADS.bots.movesToGo + SQUADS.bots.incrementShare * 4_000;
      expect(ms).toBeGreaterThanOrEqual(Math.max(SQUADS.bots.minThinkSeconds * 1000, lo * target) - 1);
      expect(ms).toBeLessThanOrEqual(hi * target + 1);
      expect(squadBotThinkMs(rng, { bankMs: 0, incrementMs: 0, delayMs: 4_000, deadlineMs: 4_000 })).toBeLessThan(4_000);
    }
    expect(botArmageddonColour()).toBe("b");
  });

  it("winning, a bot plays with purpose: the engine's order breaks ties, a seen mate is played, its temperature drops", () => {
    const won = [
      { move: "a1a8", expected: 0.99 },
      { move: "a1a7", expected: 0.99 },
      { move: "a1a6", expected: 0.99 },
    ];
    expect(candidatesFrom(won).map((c) => c.loss)).toEqual([0, SQUADS.bots.wonRankLoss, 2 * SQUADS.bots.wonRankLoss]);
    expect(squadBotSkill(won, 16)).toBe(SQUADS.bots.wonSkill);
    expect(squadBotSkill(top, 16)).toBe(16);
    const mating = [
      { move: "d1h5", expected: 1, mate: 3 },
      { move: "a1a8", expected: 1, mate: 1 },
      { move: "h2h3", expected: 1 },
    ];
    const c = candidatesFrom(mating);
    expect(c.find((x) => x.move === "a1a8")!.loss).toBe(SQUADS.bots.wonRankLoss);
    expect(c.find((x) => x.move === "d1h5")!.loss).toBe(2 * SQUADS.bots.mateStepLoss);
    expect(c.find((x) => x.move === "h2h3")!.loss).toBe(SQUADS.bots.mateMissLoss);
    // Not winning: plain losses, as for any bot.
    expect(cands.map((x) => Math.round(x.loss))).toEqual([0, 1, 3, 15]);
  });
});
