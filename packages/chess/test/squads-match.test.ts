import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SQUADS, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, gameEnd, legalMoves, type Opening } from "../src/index.ts";
import {
  NO_INPUTS,
  allowsMateInOne,
  allowsMateInOneSlow,
  armageddonStart,
  canMate,
  choose,
  createSquadsMatch,
  decideByMaterial,
  endByMaterial,
  flagFall,
  formSquads,
  halfDuties,
  halfReady,
  lockIn,
  materialCount,
  matchResultOf,
  newSquadsBoard,
  noteActions,
  planLobby,
  planMatch,
  playOnBoard,
  resolveHalf,
  squadsLegalMoves,
  squadsRng,
  timeLeft,
  winnerSquad,
  type HalfInputs,
  type Lineup,
  type MatchSetup,
  type Side,
  type SquadsEvent,
  type SquadsMatch,
} from "../src/squads/index.ts";

const library = JSON.parse(readFileSync(new URL("../data/openings.json", import.meta.url), "utf8")) as Opening[];
const sides: [Lineup, Lineup] = [
  { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
  { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
];
const BANK = 240_000;
const INC = 2_000;
const CEILING = SQUADS.moveCeilingSeconds * 1000;
const CLOCK = { w: BANK, b: BANK };
/** White mates in one: Ra8#. */
const WHITE_MATES = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
/** White stalemates in one: Qf7. */
const WHITE_STALEMATES = "7k/8/6Q1/8/8/8/8/K7 w - - 0 1";
/** Every White move but Nc2 allows mate in one (Re1#). */
const MERCY = "4r1k1/1b3ppp/3q4/2b5/8/N7/3n1PPP/6K1 w - - 0 1";
/** White's only legal move is Kxb2. */
const ONE_MOVE = "k7/8/8/8/8/8/1q6/K7 w - - 0 1";
/** White a pawn up; Black has a lone king. */
const PAWN_UP = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
const rules = (start: "standard" | "same" | "random") => ({ start, clock: SQUADS.clocks[SQUADS.clockDefault]! });

function match(format: "relay" | "pairs", starts: string[], o: Partial<MatchSetup> = {}, s?: SquadsSettings): SquadsMatch {
  return createSquadsMatch(
    {
      key: "r0m0",
      seed: 11,
      round: format === "relay" ? 0 : 1,
      format,
      sides,
      starts: starts.map((fen) => ({ fen, openingId: null })),
      whites: starts.map((_, k) => (k % 2) as Side),
      clockMs: CLOCK,
      incrementMs: INC,
      ...o,
    },
    s,
  );
}
const relay = (starts = Array(4).fill(START_FEN), o: Partial<MatchSetup> = {}, s?: SquadsSettings) => match("relay", starts, o, s);
const pairs = (starts = Array(2).fill(START_FEN), o: Partial<MatchSetup> = {}, s?: SquadsSettings) => match("pairs", starts, o, s);

/** Inputs from moves by player id, through the real `choose` (so they're checked as a player's would be). */
function inputs(m: SquadsMatch, moves: Record<string, string>): HalfInputs {
  let inp = NO_INPUTS;
  for (const [id, mv] of Object.entries(moves)) {
    const r = choose(m, inp, id, mv);
    if ("error" in r) throw new Error(`${id} ${mv}: ${r.error}`);
    inp = lockIn(r.inputs, id);
  }
  return inp;
}
/** Plays a half with each duty's player choosing the first legal move (or the given move); nobody misses. */
function playHalf(m: SquadsMatch, moves: Record<string, string> = {}, think: Record<string, number> = {}) {
  const all: Record<string, string> = {};
  for (const d of halfDuties(m).duties) {
    const legal = legalMoves(m.boards[d.board]!.fen);
    d.players.forEach((p, i) => (all[p] = moves[p] ?? legal[i]!));
  }
  return resolveHalf(m, inputs(m, all), think);
}
const ofKind = <K extends SquadsEvent["kind"]>(events: SquadsEvent[], kind: K) => events.filter((e): e is Extract<SquadsEvent, { kind: K }> => e.kind === kind);
const bots32 = () => formSquads([], Array.from({ length: 32 }, (_, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill: 1 })), squadsRng(5, "seats")).squads;

describe("Squads boards", () => {
  it("ends by the rules of chess the same way gameEnd does, without replaying the game; its fast moves match legalMoves", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = squadsRng(seed, "random-game");
      let b = newSquadsBoard(0, { fen: START_FEN, openingId: null }, 0, CLOCK);
      while (!b.result && b.moves.length < 300) {
        const legal = squadsLegalMoves(b.fen);
        // The guard on chess.js's internals: the same moves, in the same order, as the public API.
        if (b.moves.length % 3 === 0) expect(legal).toEqual(legalMoves(b.fen));
        const move = legal[Math.floor(rng() * legal.length)]!;
        if (b.moves.length % 7 === 0) expect(allowsMateInOne(b.fen, move)).toBe(allowsMateInOneSlow(b.fen, move));
        b = playOnBoard(b, move);
        expect(b.result?.reason ?? null).toBe(gameEnd(START_FEN, b.moves));
      }
    }
    expect(squadsLegalMoves(MERCY)).toEqual(legalMoves(MERCY));
    // (A position with both answers, so the comparison isn't all "no".)
    expect(squadsLegalMoves(MERCY).map((m) => allowsMateInOne(MERCY, m))).toEqual(squadsLegalMoves(MERCY).map((m) => allowsMateInOneSlow(MERCY, m)));
    expect(squadsLegalMoves(MERCY).filter((m) => !allowsMateInOne(MERCY, m))).toEqual(["a3c2"]);
  });

  it("counts material (kings don't count) for the safety cap and Next round: a lead wins, level is a draw", () => {
    expect(materialCount(START_FEN)).toEqual({ w: 39, b: 39 });
    const up = newSquadsBoard(0, { fen: PAWN_UP, openingId: null }, 1, CLOCK);
    expect(decideByMaterial(up, "safety_cap").result).toEqual({ winner: "w", reason: "safety_cap", material: { w: 1, b: 0 } });
    expect(decideByMaterial(newSquadsBoard(0, { fen: START_FEN, openingId: null }, 0, CLOCK), "admin").result?.winner).toBeNull();
    expect(decideByMaterial(up, "safety_cap", { ...SQUADS, materialLead: 2 }).result?.winner).toBeNull();
  });

  it("mating material: a lone king, or a king with one knight or bishop, can't mate", () => {
    expect(canMate("4k3/8/8/8/8/8/8/4K3 w - - 0 1", "w")).toBe(false);
    expect(canMate("4k3/8/8/8/8/8/8/3NK3 w - - 0 1", "w")).toBe(false);
    expect(canMate("4kb2/8/8/8/8/8/8/4K3 w - - 0 1", "b")).toBe(false);
    expect(canMate(PAWN_UP, "w")).toBe(true);
    expect(canMate("4k3/8/8/8/8/8/8/2NNK3 w - - 0 1", "w")).toBe(true);
    expect(canMate("4kr2/8/8/8/8/8/8/4K3 w - - 0 1", "b")).toBe(true);
  });

  it("a flag fall loses the board, or draws it when the other side can't mate", () => {
    const b = newSquadsBoard(0, { fen: PAWN_UP, openingId: null }, 0, CLOCK);
    expect(flagFall(b, "w").result).toEqual({ winner: null, reason: "flag" });
    expect(flagFall(b, "b").result).toEqual({ winner: "w", reason: "flag" });
    expect(flagFall(b, "b").clock).toEqual({ w: BANK, b: 0 });
  });

  it("refuses an illegal move", () => {
    expect(() => playOnBoard(newSquadsBoard(0, { fen: START_FEN, openingId: null }, 0, CLOCK), "e2e5")).toThrow();
  });
});

describe("Squads starts and setup", () => {
  it("random openings: each opening on two boards of a match, colours swapped; every board on the voted clock", () => {
    const plan = planLobby(5, rules("random"), library);
    const squads = bots32();
    const m = planMatch(plan, 0, 0, [squads[0]!, squads[1]!], library);
    const ids = m.boards.map((b) => b.start.openingId);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).toBe(ids[3]);
    expect(ids[0]).not.toBe(ids[2]);
    expect(m.boards.map((b) => b.white)).toEqual([0, 1, 0, 1]);
    expect(m.boards.every((b) => b.fen.split(" ")[1] === "w")).toBe(true);
    const normal = SQUADS.clocks[SQUADS.clockDefault]!;
    expect(m.boards.every((b) => b.clock.w === normal.bankSeconds * 1000 && b.clock.b === normal.bankSeconds * 1000)).toBe(true);
    expect(m.incrementMs).toBe(normal.incrementSeconds * 1000);
    expect(m.safetyMoves).toBe(SQUADS.safetyCap);
    const r2 = planMatch(plan, 1, 0, [squads[0]!, squads[1]!], library);
    expect(r2.boards).toHaveLength(2);
    expect(r2.boards[0]!.start).toEqual(r2.boards[1]!.start);
    expect(r2.boards.map((b) => b.white)).toEqual([0, 1]);
    const fin = planMatch(plan, 2, 0, [squads[0]!, squads[1]!], library);
    expect(fin.boards).toHaveLength(1);
    expect(fin.format).toBe("final");
  });

  it("one opening: every board in every round (and Armageddon) starts from the lobby's opening", () => {
    const fast = SQUADS.clocks[0]!;
    const plan = planLobby(8, { start: "same", clock: fast }, library);
    expect(plan.start?.openingId).toBeTruthy();
    const squads = bots32();
    for (const round of [0, 1, 2] as const) {
      const m = planMatch(plan, round, 0, [squads[0]!, squads[1]!], library);
      expect(m.boards.every((b) => b.start.openingId === plan.start!.openingId)).toBe(true);
      expect(m.boards[0]!.clock.w).toBe((round === 2 ? fast.finalBankSeconds : fast.bankSeconds) * 1000);
    }
    expect(armageddonStart(plan, { key: "r2m0" }, library)).toEqual(plan.start);
  });

  it("each Clock option sets a quick clock for rounds 1 and 2 and a roomier one for the final", () => {
    const squads = bots32();
    for (const clock of SQUADS.clocks) {
      expect(clock.finalBankSeconds).toBeGreaterThan(clock.bankSeconds);
      expect(clock.finalIncrementSeconds).toBeGreaterThanOrEqual(clock.incrementSeconds);
      const plan = planLobby(4, { start: "standard", clock }, library);
      for (const round of [0, 1] as const) {
        const m = planMatch(plan, round, 0, [squads[0]!, squads[1]!], library);
        expect(m.boards.every((b) => b.clock.w === clock.bankSeconds * 1000 && b.clock.b === clock.bankSeconds * 1000)).toBe(true);
        expect(m.incrementMs).toBe(clock.incrementSeconds * 1000);
      }
      const fin = planMatch(plan, 2, 0, [squads[0]!, squads[1]!], library);
      expect(fin.boards[0]!.clock).toEqual({ w: clock.finalBankSeconds * 1000, b: clock.finalBankSeconds * 1000 });
      expect(fin.incrementMs).toBe(clock.finalIncrementSeconds * 1000);
    }
  });

  it("the normal start: the starting position everywhere", () => {
    const plan = planLobby(3, rules("standard"), library);
    expect(plan.start).toBeNull();
    expect(armageddonStart(plan, { key: "r2m0" }, library).fen).toBe(START_FEN);
  });

  it("the same seed plans the same matches", () => {
    const squads = bots32();
    const a = planMatch(planLobby(77, rules("random"), library), 2, 0, [squads[0]!, squads[1]!], library);
    const b = planMatch(planLobby(77, rules("random"), library), 2, 0, [squads[0]!, squads[1]!], library);
    expect(a).toEqual(b);
  });
});

describe("Squads round 1: Relay", () => {
  it("each half, every board's side to move moves: two of each squad move and two wait; everyone moves once a turn", () => {
    const m = relay();
    for (let turn = 0; turn < 6; turn++) {
      const moved: string[] = [];
      for (const half of ["w", "b"] as const) {
        const d = halfDuties({ ...m, turn, half }).duties;
        expect(d.map((x) => x.side)).toEqual(half === "w" ? [0, 1, 0, 1] : [1, 0, 1, 0]);
        expect(d.filter((x) => x.side === 0)).toHaveLength(2);
        moved.push(...d.flatMap((x) => x.players));
      }
      expect(moved.sort()).toEqual([...sides[0].seats, ...sides[1].seats].sort());
    }
  });

  it("everyone shifts one board along each turn, and so alternates colours", () => {
    let m = relay();
    const boardOf = (mm: SquadsMatch, id: string) => {
      for (const half of ["w", "b"] as const) for (const d of halfDuties({ ...mm, half }).duties) if (d.players.includes(id)) return d.board;
      return -1;
    };
    const path: number[] = [];
    for (let turn = 0; turn < 5; turn++) {
      path.push(boardOf(m, "a1"));
      m = playHalf(playHalf(m).match).match;
    }
    expect(path).toEqual([1, 2, 3, 0, 1]);
  });

  it("a squad's four players share their side's clock on each board: each mover's time is charged, plus the increment", () => {
    const first = playHalf(relay(), {}, { a0: 5_000, b1: 3_000, a2: 1_000, b3: 0 });
    expect(first.match.boards.map((b) => b.clock.w)).toEqual([BANK - 5_000 + INC, BANK - 3_000 + INC, BANK - 1_000 + INC, BANK + INC]);
    expect(first.match.boards.every((b) => b.clock.b === BANK)).toBe(true);
    expect(ofKind(first.events, "clock")[0]).toEqual({ kind: "clock", turn: 0, half: "w", board: 0, side: 0, usedMs: 5_000, leftMs: BANK - 3_000 });
    // Next turn a different player of squad 0 (a3) is White on board 0, on the same clock.
    const turn1 = playHalf(first.match).match;
    expect(halfDuties(turn1).duties[0]!.players).toEqual(["a3"]);
    const after = playHalf(turn1, {}, { a3: 10_000 }).match;
    expect(after.boards[0]!.clock.w).toBe(BANK - 5_000 + INC - 10_000 + INC);
  });

  it("the per-move ceiling: a mover who hasn't moved by then misses (a random move), the bank charged meanwhile, no increment", () => {
    const m = relay();
    const d = halfDuties(m).duties;
    expect(d.every((x) => x.deadlineMs === CEILING)).toBe(true);
    const moves: Record<string, string> = {};
    for (const x of d) moves[x.players[0]!] = "e2e4";
    delete moves[d[2]!.players[0]!];
    const a = resolveHalf(m, inputs(m, moves));
    expect(resolveHalf(m, inputs(m, moves))).toEqual(a);
    const missed = ofKind(a.events, "relay").find((e) => e.board === 2)!;
    expect(missed.missed).toBe(true);
    expect(legalMoves(START_FEN)).toContain(missed.move);
    expect(a.missed).toEqual([d[2]!.players[0]]);
    expect(a.acted).toHaveLength(3);
    expect(a.match.boards[2]!.clock.w).toBe(BANK - CEILING);
    // With the increment allowed on a miss.
    expect(resolveHalf(m, inputs(m, moves), {}, { ...SQUADS, incrementOnMiss: true }).match.boards[2]!.clock.w).toBe(BANK - CEILING + INC);
    // The ceiling is a setting.
    expect(halfDuties(m, { ...SQUADS, moveCeilingSeconds: 60 }).duties[0]!.deadlineMs).toBe(60_000);
  });

  it("a flag fall: running out of time loses the board, with no move played", () => {
    const low = relay(undefined, { clockMs: { w: 3_000, b: BANK } });
    const d = halfDuties(low).duties;
    expect(d[0]!.deadlineMs).toBe(3_000);
    // a0 moved, but after 4 s: too late. b1 (board 2) never moved, with 3 s on the clock: it ran out too.
    const out = resolveHalf(low, inputs(low, { a0: "e2e4", a2: "e2e4", b3: "e2e4" }), { a0: 4_000, a2: 1_000, b3: 1_000 });
    expect(out.match.boards[0]!.result).toEqual({ winner: "b", reason: "flag" });
    expect(out.match.boards[0]!.moves).toEqual([]);
    expect(out.match.boards[0]!.clock.w).toBe(0);
    expect(out.match.boards[1]!.result).toEqual({ winner: "b", reason: "flag" });
    expect(out.missed).toEqual(["b1"]);
    expect(out.match.boards[2]!.moves).toEqual(["e2e4"]);
    expect(ofKind(out.events, "board_end").map((e) => e.board)).toEqual([0, 1]);
    // One board each so far (side 0 was White on board 1, side 1 on board 2): the match goes on.
    expect(out.match.result).toBeNull();
  });

  it("a flag against bare material: a draw when the other side can't mate", () => {
    const bare = relay([PAWN_UP, START_FEN, START_FEN, START_FEN], { clockMs: { w: 1_000, b: BANK } });
    const out = resolveHalf(bare, inputs(bare, { a0: "e1d1", b1: "e2e4", a2: "e2e4", b3: "e2e4" }), { a0: 2_000, b1: 500, a2: 500, b3: 500 });
    expect(out.match.boards[0]!.result).toEqual({ winner: null, reason: "flag" });
  });

  it("a move is made once; an illegal move or a player without a duty is refused", () => {
    const m = relay();
    const [first] = halfDuties(m).duties;
    const p = first!.players[0]!;
    const r = choose(m, NO_INPUTS, p, "e2e4");
    expect("inputs" in r).toBe(true);
    if (!("inputs" in r)) return;
    expect(choose(m, r.inputs, p, "d2d4")).toEqual({ error: "already_moved" });
    expect(choose(m, NO_INPUTS, p, "e2e5")).toEqual({ error: "illegal" });
    const waiting = sides[0].seats.find((id) => !halfDuties(m).duties.some((x) => x.players.includes(id)))!;
    expect(choose(m, NO_INPUTS, waiting, "e2e4")).toEqual({ error: "no_duty" });
    expect(halfReady(m, r.inputs)).toBe(false);
  });

  it("a board finishing mid-rotation: whoever's turn it would be there sits out (scouts); the rotation carries on", () => {
    let m = relay([WHITE_MATES, START_FEN, START_FEN, START_FEN]);
    const first = playHalf(m, { a0: "a1a8" });
    expect(first.match.boards[0]!.result).toEqual({ winner: "w", reason: "checkmate" });
    expect(first.match.result).toBeNull();
    m = first.match;
    const black = playHalf(m);
    expect(ofKind(black.events, "scout")).toEqual([{ kind: "scout", turn: 0, half: "b", board: 0, side: 1, players: ["b0"] }]);
    expect(ofKind(black.events, "relay")).toHaveLength(3);
    m = black.match;
    const d = halfDuties(m);
    expect(d.scouts.map((x) => x.players[0])).toEqual(["a3"]);
    expect(d.duties.find((x) => x.board === 1)?.players).toEqual(["b0"]);
    expect(halfDuties({ ...m, half: "b" }).duties.find((x) => x.board === 1)?.players).toEqual(["a0"]);
    expect(m.boards.slice(1).every((b) => b.moves.length === 2)).toBe(true);
  });

  it("clinch: passing half the points (2.5 of 4) ends the match at once, boards still going", () => {
    const m = relay([WHITE_MATES, WHITE_STALEMATES, WHITE_MATES, START_FEN]);
    const out = playHalf(m, { a0: "a1a8", b1: "g6f7", a2: "a1a8" });
    expect(out.match.result).toEqual({ winner: 0, points: [2.5, 0.5], how: "clinch" });
    expect(out.match.boards[3]!.result).toBeNull();
    expect(winnerSquad(out.match)).toBe(0);
    expect(() => resolveHalf(out.match, NO_INPUTS)).toThrow();
    expect(halfDuties(out.match).duties).toEqual([]);
  });

  it("a 2-2 tie goes to the squad with more clock time left across its boards (no Armageddon)", () => {
    const m = relay([WHITE_MATES, WHITE_MATES, WHITE_MATES, WHITE_MATES]);
    const moves = Object.fromEntries(halfDuties(m).duties.map((x) => [x.players[0]!, "a1a8"]));
    const out = resolveHalf(m, inputs(m, moves), { a0: 9_000, a2: 9_000, b1: 2_000, b3: 2_000 });
    const left = [4 * BANK + 2 * INC - 18_000, 4 * BANK + 2 * INC - 4_000];
    expect(timeLeft(out.match.boards)).toEqual(left);
    expect(out.match.result).toEqual({ winner: 1, points: [2, 2], how: "time", timeLeft: left });
    expect(winnerSquad(out.match)).toBe(1);
  });

  it("exactly level on points and time: a seeded coin decides (both ways happen)", () => {
    const seen = new Set<Side>();
    for (let seed = 1; seed < 30; seed++) {
      const m = { ...relay([WHITE_MATES, WHITE_MATES, WHITE_MATES, WHITE_MATES]), seed };
      const moves = Object.fromEntries(halfDuties(m).duties.map((x) => [x.players[0]!, "a1a8"]));
      const think = { a0: 1_000, a2: 1_000, b1: 1_000, b3: 1_000 };
      const out = resolveHalf(m, inputs(m, moves), think);
      expect(out.match.result).toMatchObject({ points: [2, 2], how: "coin" });
      expect(resolveHalf(m, inputs(m, moves), think).match.result).toEqual(out.match.result);
      seen.add(out.match.result!.winner!);
    }
    expect([...seen].sort()).toEqual([0, 1]);
  });

  it("the silent safety cap: material decides a board still going at move 120 (here 1, from settings)", () => {
    const s = { ...SQUADS, safetyCap: 1 };
    const m = relay([PAWN_UP, START_FEN, START_FEN, START_FEN], {}, s);
    expect(m.safetyMoves).toBe(1);
    const once = resolveHalf(m, inputs(m, { a0: "e1d1", b1: "e2e4", a2: "e2e4", b3: "e2e4" }), {}, s);
    const out = resolveHalf(once.match, inputs(once.match, { b0: "e8d8", a1: "e7e5", b2: "e7e5", a3: "e7e5" }), {}, s);
    expect(out.match.boards.map((b) => b.result?.reason)).toEqual(["safety_cap", "safety_cap", "safety_cap", "safety_cap"]);
    expect(out.match.boards[0]!.result?.winner).toBe("w");
    expect(out.match.result).toMatchObject({ winner: 0, points: [2.5, 1.5], how: "boards" });
  });

  it("the test-only Next round: material decides every live board; level goes to time left, then a coin", () => {
    const m = relay([START_FEN, PAWN_UP, START_FEN, START_FEN]);
    const { match, events } = endByMaterial(m);
    expect(match.boards.every((b) => b.result?.reason === "admin")).toBe(true);
    // Board 2 (side 1 White) is a pawn up: side 1 wins it, the three level boards are draws.
    expect(match.result).toEqual({ winner: 1, points: [1.5, 2.5], how: "admin" });
    expect(ofKind(events, "board_end")).toHaveLength(4);
    const played = playHalf(relay(), {}, { a0: 9_000 }).match;
    expect(endByMaterial(played).match.result).toMatchObject({ winner: 1, how: "admin" });
    expect(endByMaterial(relay()).match.result?.winner).not.toBeNull();
  });

  it("missed moves reach the players' records through noteActions", () => {
    const squads = formSquads(
      [{ id: "p", members: sides[0].seats.map((id) => ({ id, name: id, isBot: false, skill: null })) }],
      Array.from({ length: 28 }, (_, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill: 1 })),
      squadsRng(1, "x"),
    ).squads;
    const out = resolveHalf(relay(), NO_INPUTS);
    const after = noteActions(squads, out.acted, out.missed);
    expect(out.missed).toContain("a0");
    expect(after.flatMap((s) => s.players).find((p) => p.id === "a0")!.misses).toBe(1);
  });
});

describe("Squads round 2: Pairs", () => {
  it("partners change every turn, each player picks once a turn, and their board alternates as the schedule says", () => {
    const m = pairs();
    const at = (turn: number, half: "w" | "b") => halfDuties({ ...m, turn, half }).duties.map((d) => [d.board, d.side, ...d.players]);
    expect(at(0, "w")).toEqual([
      [0, 0, "a0", "a1"],
      [1, 1, "b2", "b3"],
    ]);
    expect(at(0, "b")).toEqual([
      [0, 1, "b0", "b1"],
      [1, 0, "a2", "a3"],
    ]);
    expect(at(1, "w")).toEqual([
      [0, 0, "a1", "a3"],
      [1, 1, "b0", "b2"],
    ]);
    for (let turn = 0; turn < 6; turn++) {
      const all = [...at(turn, "w"), ...at(turn, "b")].flatMap((d) => d.slice(2));
      expect(all.sort()).toEqual([...sides[0].seats, ...sides[1].seats].sort());
    }
  });

  it("the pair rule: both pick, you can't pick your partner's move, a change unlocks, everyone locked resolves", () => {
    const m = pairs();
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
    inp = lockIn(lockIn(inp, "a0"), "a1");
    expect(step("a1", "c2c4")).toBe("ok");
    expect(inp.locked.a1).toBe(false);
    inp = lockIn(inp, "a1");
    expect(halfReady(m, inp)).toBe(false);
    expect(step("b2", "g1f3")).toBe("ok");
    expect(step("b3", "g1f3")).toBe("taken_by_partner");
    expect(step("b3", "b1c3")).toBe("ok");
    inp = lockIn(lockIn(inp, "b2"), "b3");
    expect(halfReady(m, inp)).toBe(true);
  });

  it("the clock runs while the pickers think, as one side's clock: the slower picker's time", () => {
    const m = pairs();
    const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }), { a0: 3_000, a1: 7_000, b2: 2_000, b3: 1_000 });
    expect(out.match.boards.map((b) => b.clock.w)).toEqual([BANK - 7_000 + INC, BANK - 2_000 + INC]);
  });

  it("a coin picks which of the two plays (both happen, the same for the same seed)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 30; seed++) {
      const m = { ...pairs(), seed };
      const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }));
      const e = ofKind(out.events, "pair").find((x) => x.board === 0)!;
      expect(e.picks).toEqual(["e2e4", "d2d4"]);
      expect(e.move).toBe(e.picks[e.coin]);
      expect(out.match.boards[0]!.moves).toEqual([e.move]);
      seen.add(e.move);
      expect(resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }))).toEqual(out);
    }
    expect([...seen].sort()).toEqual(["d2d4", "e2e4"]);
  });

  it("a missed pick becomes a random legal move (never the partner's), the whole ceiling charged, no increment", () => {
    for (let seed = 1; seed < 30; seed++) {
      const m = { ...pairs(), seed };
      const out = resolveHalf(m, inputs(m, { a0: "e2e4", b2: "g1f3", b3: "b1c3" }), { a0: 2_000 });
      const e = ofKind(out.events, "pair").find((x) => x.board === 0)!;
      expect(e.missed).toEqual([false, true]);
      expect(e.picks[0]).toBe("e2e4");
      expect(e.picks[1]).not.toBe("e2e4");
      expect(legalMoves(START_FEN)).toContain(e.picks[1]);
      expect(out.missed).toEqual(["a1"]);
      expect(out.match.boards[0]!.clock.w).toBe(BANK - CEILING);
    }
    const both = ofKind(resolveHalf(pairs(), NO_INPUTS).events, "pair");
    for (const e of both) expect(e.picks[0]).not.toBe(e.picks[1]);
  });

  it("a board's coin doesn't depend on what happened on the other board (each draw has its own stream)", () => {
    const m = pairs();
    const a = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }));
    const b = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3" }));
    const coin = (o: typeof a) => ofKind(o.events, "pair").find((x) => x.board === 0)!.coin;
    expect(coin(b)).toBe(coin(a));
  });

  it("only one legal move: it plays itself, with no coin, no misses and no time used (the increment still comes)", () => {
    const m = pairs([ONE_MOVE, START_FEN]);
    expect(halfDuties(m).forced).toEqual([0]);
    expect(halfDuties(m).duties.map((d) => d.board)).toEqual([1]);
    expect(choose(m, NO_INPUTS, "a0", "a1b2")).toEqual({ error: "no_duty" });
    const out = resolveHalf(m, inputs(m, { b2: "g1f3", b3: "b1c3" }));
    expect(ofKind(out.events, "forced")).toEqual([{ kind: "forced", turn: 0, half: "w", board: 0, side: 0, move: "a1b2" }]);
    expect(out.missed).toEqual([]);
    expect(out.match.boards[0]!.clock.w).toBe(BANK + INC);
  });

  it("1-1 goes to the squad with more time left; 1.5 of 2 wins outright", () => {
    let tie: SquadsMatch | null = null;
    for (let seed = 1; seed < 60 && !tie; seed++) {
      const m = { ...pairs([WHITE_MATES, WHITE_MATES]), seed };
      const out = resolveHalf(m, inputs(m, { a0: "a1a8", a1: "a1a7", b2: "a1a8", b3: "a1a7" }), { a0: 1_000, a1: 1_000, b2: 6_000, b3: 1_000 });
      if (out.match.boards.every((b) => b.result?.reason === "checkmate")) tie = out.match;
    }
    expect(tie?.result).toMatchObject({ winner: 0, points: [1, 1], how: "time" });
    let win: SquadsMatch | null = null;
    for (let seed = 1; seed < 60 && !win; seed++) {
      const m = { ...pairs([WHITE_MATES, WHITE_STALEMATES]), seed };
      const out = resolveHalf(m, inputs(m, { a0: "a1a8", a1: "a1a7", b2: "g6f7", b3: "g6g5" }));
      if (out.match.result) win = out.match;
    }
    expect(win?.result).toEqual({ winner: 0, points: [1.5, 0.5], how: "boards" });
  });

  it("a board ends while the other plays on: its pair scouts", () => {
    let m: SquadsMatch | null = null;
    for (let seed = 1; seed < 60 && !m; seed++) {
      const x = { ...pairs([WHITE_MATES, START_FEN]), seed };
      const out = resolveHalf(x, inputs(x, { a0: "a1a8", a1: "a1a7", b2: "g1f3", b3: "b1c3" }));
      if (out.match.boards[0]!.result) m = out.match;
    }
    expect(m).not.toBeNull();
    const d = halfDuties(m!);
    expect(d.scouts.map((x) => [x.board, x.side, ...x.players])).toEqual([[0, 1, "b0", "b1"]]);
    expect(d.duties.map((x) => [x.board, x.side, ...x.players])).toEqual([[1, 0, "a2", "a3"]]);
    expect(matchResultOf(m!)).toBeNull();
  });
});
