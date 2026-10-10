import { describe, expect, it } from "vitest";
import { SQUADS, mulberry32, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, legalMoves, type EngineLike } from "../src/index.ts";
import {
  NO_INPUTS,
  armageddonChooser,
  botArmageddonColour,
  botFinalBlock,
  botFinalPick,
  botPairPick,
  botRelayMove,
  candidatesFrom,
  choose,
  createSquadsMatch,
  halfDuties,
  halfReady,
  lockIn,
  resolveHalf,
  squadBotCandidates,
  squadBotSkill,
  squadBotThinkMs,
  startArmageddon,
  timeLeft,
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
const MERCY = "4r1k1/1b3ppp/3q4/2b5/8/N7/3n1PPP/6K1 w - - 0 1";
const CASTLING = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
const PROMOTION = "8/4P3/8/8/8/8/k7/4K3 w - - 0 1";
const THREE_MOVES = "k7/8/8/8/8/8/6p1/K7 w - - 0 1";
const ONE_MOVE = "k7/8/8/8/8/8/1q6/K7 w - - 0 1";
const WHITE_STALEMATES = "7k/8/6Q1/8/8/8/8/K7 w - - 0 1";

const BANK = 240_000;
const INC = 2_000;
function final(fen = START_FEN, seed = 1, white: Side = 0, s?: SquadsSettings, clockMs = { w: BANK, b: BANK }): SquadsMatch {
  return createSquadsMatch(
    { key: "r2m0", seed, round: 2, format: "final", sides, starts: [{ fen, openingId: null }], whites: [white], clockMs, incrementMs: INC },
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
const pickblock = (events: SquadsEvent[]) => events.find((e): e is Extract<SquadsEvent, { kind: "pickblock" }> => e.kind === "pickblock")!;
/** Resolves the same choices over seeds until `want` holds for the move's event (tests look for the outcome they need). */
function findSeed(fen: string, moves: Record<string, string>, want: (e: ReturnType<typeof pickblock>) => boolean, s?: SquadsSettings) {
  for (let seed = 1; seed < 200; seed++) {
    const m = final(fen, seed, 0, s);
    const out = resolveHalf(m, inputs(m, moves, s), {}, s);
    const e = pickblock(out.events);
    if (want(e)) return { out, e };
  }
  throw new Error("No seed gives that outcome");
}

/** Resolves an Armageddon half over seeds until `want` holds. */
function findArm(arm: SquadsMatch, moves: Record<string, string>, want: (o: ReturnType<typeof resolveHalf>) => boolean) {
  for (let seed = 1; seed < 200; seed++) {
    const m = { ...arm, seed };
    const out = resolveHalf(m, inputs(m, moves));
    if (want(out)) return out;
  }
  throw new Error("No seed gives that outcome");
}

describe("Squads final: Pick and Block roles", () => {
  it("on a squad's move two of its players pick and two of the other squad block, from move 1", () => {
    const m = final();
    const ceiling = SQUADS.moveCeilingSeconds * 1000;
    expect(halfDuties(m).duties).toEqual([
      { board: 0, side: 0, role: "pick", players: ["a0", "a1"], deadlineMs: ceiling },
      { board: 0, side: 1, role: "block", players: ["b2", "b3"], deadlineMs: ceiling },
    ]);
    expect(halfDuties({ ...m, half: "b" }).duties).toEqual([
      { board: 0, side: 1, role: "pick", players: ["b0", "b1"], deadlineMs: ceiling },
      { board: 0, side: 0, role: "block", players: ["a2", "a3"], deadlineMs: ceiling },
    ]);
    // The squad given Black by the coin picks on Black's moves.
    expect(halfDuties(final(START_FEN, 1, 1)).duties[0]).toMatchObject({ side: 1, role: "pick" });
  });

  it("roles rotate every full turn: one role each per turn, picking and blocking three times each in six, partners cycling", () => {
    const m = final();
    const count: Record<string, { pick: number; block: number }> = {};
    for (let turn = 0; turn < 6; turn++) {
      const roles: string[] = [];
      for (const half of ["w", "b"] as const) {
        for (const d of halfDuties({ ...m, turn, half }).duties) {
          for (const p of d.players) {
            roles.push(p);
            count[p] ??= { pick: 0, block: 0 };
            count[p]![d.role as "pick" | "block"]++;
          }
        }
      }
      expect(roles.sort()).toEqual([...sides[0].seats, ...sides[1].seats].sort());
    }
    for (const p of [...sides[0].seats, ...sides[1].seats]) expect(count[p]).toEqual({ pick: 3, block: 3 });
    const pickPartnersOfA0 = [0, 2, 4].map((turn) => halfDuties({ ...m, turn }).duties[0]!.players.find((x) => x !== "a0"));
    expect(pickPartnersOfA0).toEqual(["a1", "a3", "a2"]);
  });

  it("two different picks, two different blocks; every block is a legal move of the side to move", () => {
    const m = final();
    let inp = NO_INPUTS;
    const step = (id: string, mv: string) => {
      const r = choose(m, inp, id, mv);
      if ("error" in r) return r.error;
      inp = r.inputs;
      return "ok";
    };
    expect(step("a0", "e2e4")).toBe("ok");
    expect(step("a1", "e2e4")).toBe("taken_by_partner");
    expect(step("a1", "d2d4")).toBe("ok");
    expect(step("b2", "e7e5")).toBe("illegal");
    expect(step("b2", "e2e4")).toBe("ok");
    expect(step("b3", "e2e4")).toBe("taken_by_partner");
    expect(step("b3", "d2d4")).toBe("ok");
    expect(step("b0", "e2e4")).toBe("no_duty");
    expect(halfReady(m, inp)).toBe(false);
    for (const id of ["a0", "a1", "b2", "b3"]) inp = lockIn(inp, id);
    expect(halfReady(m, inp)).toBe(true);
  });

  it("visibility (a setting): blocks live to everyone, picks only to the picking squad; and the other way round", () => {
    const m = final();
    const inp = inputs(m, { a0: "e2e4", a1: "d2d4", b2: "e2e4", b3: "g1f3" });
    const blocks = { b2: "e2e4", b3: "g1f3" };
    const picks = { a0: "e2e4", a1: "d2d4" };
    expect(visibleChoices(m, inp, 0)).toEqual({ ...picks, ...blocks });
    expect(visibleChoices(m, inp, 1)).toEqual(blocks);
    expect(visibleChoices(m, inp, null)).toEqual(blocks);
    const flipped: SquadsSettings = { ...SQUADS, final: { ...SQUADS.final, blocksSeenBy: "own", picksSeenBy: "everyone" } };
    expect(visibleChoices(m, inp, 0, flipped)).toEqual(picks);
    expect(visibleChoices(m, inp, 1, flipped)).toEqual({ ...picks, ...blocks });
    expect(visibleChoices(m, inp, null, flipped)).toEqual(picks);
  });
});

describe("Squads final: resolving a move", () => {
  const moves = { a0: "e2e4", a1: "d2d4", b2: "e2e4", b3: "g1f3" };

  it("the active block hits a pick: the other pick plays", () => {
    const { out, e } = findSeed(START_FEN, moves, (x) => x.active === 0);
    expect(e).toMatchObject({ picks: ["e2e4", "d2d4"], blocks: ["e2e4", "g1f3"], hit: 0, coin: null, move: "d2d4", cancelled: false });
    expect(out.match.boards[0]!.moves).toEqual(["d2d4"]);
    expect(out.match.half).toBe("b");
  });

  it("the active block hits neither: a coin between the picks (both happen)", () => {
    const played = new Set<string>();
    for (const want of [0, 1] as const) {
      const { e } = findSeed(START_FEN, moves, (x) => x.active === 1 && x.coin === want);
      expect(e.hit).toBeNull();
      expect(e.move).toBe(e.picks![want]);
      played.add(e.move);
    }
    expect([...played].sort()).toEqual(["d2d4", "e2e4"]);
  });

  it("a forfeited block: if the coin lands on the empty slot nothing is blocked; the miss is logged", () => {
    const { out, e } = findSeed(START_FEN, { a0: "e2e4", a1: "d2d4", b2: "e2e4" }, (x) => x.active === 1);
    expect(e.blocks).toEqual(["e2e4", null]);
    expect(e.blockMissed).toEqual([false, true]);
    expect(e.hit).toBeNull();
    expect(out.missed).toEqual(["b3"]);
    // Landing on the block that's there still blocks.
    expect(findSeed(START_FEN, { a0: "e2e4", a1: "d2d4", b2: "e2e4" }, (x) => x.active === 0).e).toMatchObject({ hit: 0, move: "d2d4" });
  });

  it("a missed pick becomes a random legal move in that slot, never the partner's, and it can be blocked", () => {
    for (let seed = 1; seed < 20; seed++) {
      const m = final(START_FEN, seed);
      const out = resolveHalf(m, inputs(m, { a0: "e2e4", b2: "e2e4", b3: "d2d4" }));
      const e = pickblock(out.events);
      expect(e.pickMissed).toEqual([false, true]);
      expect(e.picks![1]).not.toBe("e2e4");
      expect(legalMoves(START_FEN)).toContain(e.picks![1]);
      expect(out.missed).toEqual(["a1"]);
    }
    // Nobody acts at all: two different random picks, both blocks forfeited, a move is still played.
    const out = resolveHalf(final(), NO_INPUTS);
    const e = pickblock(out.events);
    expect(e.picks![0]).not.toBe(e.picks![1]);
    expect(e.blocks).toEqual([null, null]);
    expect(out.missed.sort()).toEqual(["a0", "a1", "b2", "b3"]);
    expect(out.match.boards[0]!.moves).toHaveLength(1);
  });

  it("mercy: no blocks when the side to move has 3 or fewer legal moves", () => {
    const m = final(THREE_MOVES);
    expect(legalMoves(THREE_MOVES)).toHaveLength(3);
    const d = halfDuties(m);
    expect(d.mercy).toBe("few_moves");
    expect(d.duties.map((x) => x.role)).toEqual(["pick"]);
    expect(choose(m, NO_INPUTS, "b2", "a1b1")).toEqual({ error: "no_duty" });
    const out = resolveHalf(m, inputs(m, { a0: "a1b1", a1: "a1a2" }));
    const e = pickblock(out.events);
    expect(e).toMatchObject({ mercy: "few_moves", blockers: [], blocks: [null, null], blockMissed: [false, false], active: null, hit: null });
    expect(out.missed).toEqual([]);
    // With 4 legal moves blocks are back.
    expect(halfDuties(final(THREE_MOVES, 1, 0, { ...SQUADS, final: { ...SQUADS.final, noBlocksAtMoves: 2 } }), { ...SQUADS, final: { ...SQUADS.final, noBlocksAtMoves: 2 } }).mercy).toBeNull();
  });

  it("mercy: a block is cancelled if every other legal move allows mate in one", () => {
    const mv = { a0: "a3c2", a1: "g2g3", b2: "a3c2", b3: "h2h3" };
    const { e } = findSeed(MERCY, mv, (x) => x.active === 0);
    expect(e).toMatchObject({ blocks: ["a3c2", "h2h3"], cancelled: true, hit: null });
    expect(["a3c2", "g2g3"]).toContain(e.move);
    // A block on a move that isn't the only escape stands.
    expect(findSeed(MERCY, { ...mv, a0: "h2h3", b3: "g1h1" }, (x) => x.active === 1).e).toMatchObject({ cancelled: false, hit: null });
    // The setting off: the block holds and the other pick (into mate) plays.
    const off: SquadsSettings = { ...SQUADS, final: { ...SQUADS.final, cancelBlockBeforeMate: false } };
    expect(findSeed(MERCY, mv, (x) => x.active === 0, off).e).toMatchObject({ cancelled: false, hit: 0, move: "g2g3" });
  });

  it("castling as a pick and as a block", () => {
    const { out, e } = findSeed(CASTLING, { a0: "e1g1", a1: "e1c1", b2: "e1g1", b3: "a2a3" }, (x) => x.active === 0);
    expect(e).toMatchObject({ hit: 0, move: "e1c1" });
    expect(out.match.boards[0]!.fen.split(" ")[0]).toBe("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/2KR3R");
    const other = findSeed(CASTLING, { a0: "e1g1", a1: "e1c1", b2: "e1c1", b3: "a2a3" }, (x) => x.active === 0);
    expect(other.e).toMatchObject({ hit: 1, move: "e1g1" });
    expect(other.out.match.boards[0]!.fen.split(" ")[0]).toBe("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R4RK1");
  });

  it("promotion as a pick and as a block: each promotion piece is its own move", () => {
    const m = final(PROMOTION);
    expect(choose(m, inputs(m, { a0: "e7e8q" }), "a1", "e7e8q")).toEqual({ error: "taken_by_partner" });
    const { out, e } = findSeed(PROMOTION, { a0: "e7e8q", a1: "e7e8n", b2: "e7e8q", b3: "e7e8r" }, (x) => x.active === 0);
    expect(e).toMatchObject({ hit: 0, move: "e7e8n" });
    expect(out.match.boards[0]!.fen.split(" ")[0]).toBe("4N3/8/8/8/8/8/k7/4K3");
    // Blocking the rook promotion leaves both picks open: a coin.
    expect(findSeed(PROMOTION, { a0: "e7e8q", a1: "e7e8n", b2: "e7e8q", b3: "e7e8r" }, (x) => x.active === 1).e).toMatchObject({ hit: null });
  });

  it("only one legal move: it plays itself (no picks, no blocks, no misses)", () => {
    const m = final(ONE_MOVE);
    expect(halfDuties(m)).toEqual({ duties: [], scouts: [], mercy: null, forced: [0] });
    const out = resolveHalf(m, NO_INPUTS);
    expect(out.events[0]).toEqual({ kind: "forced", turn: 0, half: "w", board: 0, side: 0, move: "a1b2" });
    expect(out.missed).toEqual([]);
  });

  it("the clock runs while the pickers think (the slower picker), as one side's clock; blockers don't run a clock", () => {
    const m = final();
    const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }), { a0: 2_000, a1: 6_000, b2: 30_000, b3: 39_000 });
    expect(out.match.boards[0]!.clock).toEqual({ w: BANK - 6_000 + INC, b: BANK });
    expect(halfDuties(m).duties.map((d) => d.deadlineMs)).toEqual([SQUADS.moveCeilingSeconds * 1000, SQUADS.moveCeilingSeconds * 1000]);
  });

  it("a flag in the final ends it; a missed pick near the end of the bank is a flag fall, not a random move", () => {
    const low = final(START_FEN, 1, 0, undefined, { w: 5_000, b: BANK });
    expect(halfDuties(low).duties[0]!.deadlineMs).toBe(5_000);
    expect(halfDuties(low).duties[1]!.deadlineMs).toBe(SQUADS.moveCeilingSeconds * 1000);
    const out = resolveHalf(low, inputs(low, { a0: "e2e4", b2: "d2d4", b3: "g1f3" }), { a0: 1_000 });
    expect(out.match.boards[0]!.result).toEqual({ winner: "b", reason: "flag" });
    expect(out.match.boards[0]!.moves).toEqual([]);
    expect(out.match.result).toEqual({ winner: 1, points: [0, 1], how: "boards" });
    expect(out.missed).toEqual(["a1"]);
  });

  it("the final is played to the end; a drawn final goes to Armageddon in Pick and Block, White with more time", () => {
    const m = final(WHITE_STALEMATES);
    expect(m.safetyMoves).toBe(SQUADS.safetyCap);
    const { out } = findSeed(WHITE_STALEMATES, { a0: "g6f7", a1: "g6g5", b2: "g6g5", b3: "a1a2" }, (x) => x.move === "g6f7");
    expect(out.match.result).toEqual({ winner: null, points: [0.5, 0.5], how: "boards" });
    const arm = startArmageddon(out.match, 1, { fen: START_FEN, openingId: null });
    expect(arm).toMatchObject({ format: "final", armageddon: true, key: "r2m0-armageddon", incrementMs: SQUADS.armageddon.incrementSeconds * 1000 });
    expect(arm.boards[0]!.clock).toEqual({ w: SQUADS.armageddon.whiteSeconds * 1000, b: SQUADS.armageddon.blackSeconds * 1000 });
    expect(arm.boards[0]!.white).toBe(1);
    expect(halfDuties(arm).duties.map((d) => [d.side, d.role])).toEqual([
      [1, "pick"],
      [0, "block"],
    ]);
    // Only a drawn final goes to Armageddon.
    expect(() => startArmageddon(final(), 0, { fen: START_FEN, openingId: null })).toThrow();
  });

  it("the squad with more clock time left in the final picks Armageddon's colours (a coin if level)", () => {
    const drawn = (left: { w: number; b: number }, seed = 1): SquadsMatch => {
      const m = final(START_FEN, seed, 0);
      return { ...m, boards: [{ ...m.boards[0]!, clock: left, result: { winner: null, reason: "repetition" } }], result: { winner: null, points: [0.5, 0.5], how: "boards" } };
    };
    // Side 0 played White.
    expect(armageddonChooser(drawn({ w: 50_000, b: 20_000 }))).toBe(0);
    expect(armageddonChooser(drawn({ w: 10_000, b: 20_000 }))).toBe(1);
    const seen = new Set<Side>();
    for (let seed = 1; seed < 30; seed++) seen.add(armageddonChooser(drawn({ w: 5_000, b: 5_000 }, seed)));
    expect([...seen].sort()).toEqual([0, 1]);
  });

  it("Armageddon: a draw counts for Black; a flag loses for either side, but White flagging against a bare king is a draw, so Black's", () => {
    const base = (() => {
      const m = final();
      return { ...m, result: { winner: null, points: [0.5, 0.5] as const, how: "boards" as const } };
    })();
    const stale = startArmageddon(base, 0, { fen: WHITE_STALEMATES, openingId: null });
    const drawn = findArm(stale, { a0: "g6f7", a1: "g6g5", b2: "g6g5", b3: "a1a2" }, (o) => o.match.boards[0]!.moves[0] === "g6f7");
    expect(drawn.match.result).toMatchObject({ winner: 1, how: "armageddon" });
    // White (side 0) runs out: Black wins. (A short bank, so White's runs out before the per-move ceiling.)
    const short: SquadsSettings = { ...SQUADS, armageddon: { ...SQUADS.armageddon, whiteSeconds: 5 } };
    const arm = startArmageddon(base, 0, { fen: START_FEN, openingId: null }, short);
    const flagged = resolveHalf(arm, NO_INPUTS, {}, short);
    expect(flagged.match.boards[0]!.result).toEqual({ winner: "b", reason: "flag" });
    expect(flagged.match.result).toMatchObject({ winner: 1, how: "armageddon" });
    // White flags with Black down to a bare king: a draw, which is Black's.
    const bare = startArmageddon(base, 0, { fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", openingId: null }, short);
    const out = resolveHalf(bare, NO_INPUTS, {}, short);
    expect(out.match.boards[0]!.result).toEqual({ winner: null, reason: "flag" });
    expect(out.match.result).toMatchObject({ winner: 1, how: "armageddon" });
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
            const legal = legalMoves(m.boards[0]!.fen);
            for (let tries = 0; tries < 5; tries++) {
              const r = choose(m, inp, p, legal[Math.floor(rng() * legal.length)]!);
              if ("inputs" in r) {
                inp = r.inputs;
                break;
              }
            }
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
    expect(a.log.filter((e) => e.kind === "pickblock").length).toBeGreaterThan(10);
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

  it("a strong bot plays the best move; a pair bot never picks its partner's move", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      expect(legal).toContain(botRelayMove(rng, cands, 4, legal));
      expect(botPairPick(rng, cands, 4, legal, "e2e4")).not.toBe("e2e4");
    }
    const strong = Array.from({ length: 50 }, () => botRelayMove(rng, cands, 0.01, legal));
    expect(strong.filter((m) => m === "e2e4").length).toBeGreaterThan(40);
  });

  it("final: blockers never repeat their partner's block and aim at the best moves; pickers sometimes steer clear of visible blocks", () => {
    const rng = mulberry32(2);
    const blocks = Array.from({ length: 200 }, () => botFinalBlock(rng, cands, 0.01, legal, "e2e4"));
    expect(blocks).not.toContain("e2e4");
    expect(blocks.filter((m) => m === "d2d4").length).toBeGreaterThan(180);
    const always: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, avoidBlockChance: 1 } };
    const never: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, avoidBlockChance: 0 } };
    for (let i = 0; i < 200; i++) {
      const p = botFinalPick(rng, cands, 4, legal, "g1f3", ["e2e4", "d2d4"], always);
      expect(["e2e4", "d2d4", "g1f3"]).not.toContain(p);
    }
    const ignoring = Array.from({ length: 50 }, () => botFinalPick(rng, cands, 0.01, legal, null, ["e2e4"], never));
    expect(ignoring.filter((m) => m === "e2e4").length).toBeGreaterThan(40);
    const sometimes = Array.from({ length: 400 }, () => botFinalPick(rng, cands, 0.01, legal, null, ["e2e4"]));
    const share = sometimes.filter((m) => m === "e2e4").length / 400;
    expect(share).toBeGreaterThan(1 - SQUADS.bots.avoidBlockChance - 0.1);
    expect(share).toBeLessThan(1 - SQUADS.bots.avoidBlockChance + 0.1);
  });

  it("think by their clock: the bank over moves to go plus the increment, never past the deadline; and take Black in Armageddon", () => {
    const rng = mulberry32(3);
    const [lo, hi] = SQUADS.bots.thinkRange;
    for (let i = 0; i < 100; i++) {
      const ms = squadBotThinkMs(rng, { bankMs: 240_000, incrementMs: 2_000, deadlineMs: 40_000 });
      const target = 240_000 / SQUADS.bots.movesToGo + SQUADS.bots.incrementShare * 2_000;
      expect(ms).toBeGreaterThanOrEqual(Math.max(SQUADS.bots.minThinkSeconds * 1000, lo * target) - 1);
      expect(ms).toBeLessThanOrEqual(hi * target + 1);
      expect(squadBotThinkMs(rng, { bankMs: 3_000, incrementMs: 0, deadlineMs: 3_000 })).toBeLessThan(3_000);
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
