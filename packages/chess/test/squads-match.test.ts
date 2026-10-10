import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SQUADS, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, gameEnd, legalMoves, type Opening } from "../src/index.ts";
import {
  NO_INPUTS,
  allowsMateInOne,
  allowsMateInOneSlow,
  squadsLegalMoves,
  armageddonChooser,
  armageddonStart,
  choose,
  createSquadsMatch,
  decideByMaterial,
  endByMaterial,
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
  startArmageddon,
  visibleChoices,
  winnerSquad,
  formSquads,
  squadsRng,
  type HalfInputs,
  type Lineup,
  type Side,
  type SquadsEvent,
  type SquadsMatch,
} from "../src/squads/index.ts";

const library = JSON.parse(readFileSync(new URL("../data/openings.json", import.meta.url), "utf8")) as Opening[];
const sides: [Lineup, Lineup] = [
  { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
  { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
];
/** White mates in one: Ra8#. */
const WHITE_MATES = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
/** White stalemates in one: Qf7. */
const WHITE_STALEMATES = "7k/8/6Q1/8/8/8/8/K7 w - - 0 1";
/** Every White move but Nc2 allows mate in one (Re1#). */
const MERCY = "4r1k1/1b3ppp/3q4/2b5/8/N7/3n1PPP/6K1 w - - 0 1";
/** White's only legal move is Kxb2. */
const ONE_MOVE = "k7/8/8/8/8/8/1q6/K7 w - - 0 1";

function match(format: "relay" | "pairs", starts: string[], o: Partial<Parameters<typeof createSquadsMatch>[0]> = {}, s?: SquadsSettings): SquadsMatch {
  return createSquadsMatch(
    {
      key: "r0m0",
      seed: 11,
      round: format === "relay" ? 0 : 1,
      format,
      sides,
      starts: starts.map((fen) => ({ fen, openingId: null })),
      whites: starts.map((_, k) => (k % 2) as Side),
      capMoves: null,
      paceSeconds: 15,
      ...o,
    },
    s,
  );
}
const relay = (starts = Array(4).fill(START_FEN), o = {}, s?: SquadsSettings) => match("relay", starts, o, s);
const pairs = (starts = Array(2).fill(START_FEN), o = {}, s?: SquadsSettings) => match("pairs", starts, o, s);

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
function playHalf(m: SquadsMatch, moves: Record<string, string> = {}) {
  const all: Record<string, string> = {};
  for (const d of halfDuties(m).duties) {
    const fen = m.boards[d.board]!.fen;
    const legal = legalMoves(fen);
    d.players.forEach((p, i) => (all[p] = moves[p] ?? legal[i]!));
  }
  return resolveHalf(m, inputs(m, all));
}
const ofKind = <K extends SquadsEvent["kind"]>(events: SquadsEvent[], kind: K) => events.filter((e): e is Extract<SquadsEvent, { kind: K }> => e.kind === kind);

describe("Squads boards", () => {
  it("ends by the rules of chess the same way gameEnd does, without replaying the game; its fast moves match legalMoves", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = squadsRng(seed, "random-game");
      let b = newSquadsBoard(0, { fen: START_FEN, openingId: null }, 0);
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

  it("counts material (kings don't count) and decides a capped board by it: a lead wins, level is a draw", () => {
    expect(materialCount(START_FEN)).toEqual({ w: 39, b: 39 });
    const up = newSquadsBoard(0, { fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", openingId: null }, 1);
    expect(decideByMaterial(up, "move_cap").result).toEqual({ winner: "w", reason: "move_cap", material: { w: 1, b: 0 } });
    const level = newSquadsBoard(0, { fen: START_FEN, openingId: null }, 0);
    expect(decideByMaterial(level, "safety_cap").result?.winner).toBeNull();
    // A bigger winning margin in settings: one pawn is then a draw.
    expect(decideByMaterial(up, "move_cap", { ...SQUADS, materialLead: 2 }).result?.winner).toBeNull();
  });

  it("refuses an illegal move", () => {
    const b = newSquadsBoard(0, { fen: START_FEN, openingId: null }, 0);
    expect(() => playOnBoard(b, "e2e5")).toThrow();
  });
});

describe("Squads starts and setup", () => {
  it("random openings: each opening on two boards of a match, colours swapped", () => {
    const plan = planLobby(5, { start: "random", paceSeconds: 15, length: "cap" }, library);
    const squads = formSquads([], Array.from({ length: 32 }, (_, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill: 1 })), squadsRng(5, "seats")).squads;
    const m = planMatch(plan, 0, 0, [squads[0]!, squads[1]!], library);
    const ids = m.boards.map((b) => b.start.openingId);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).toBe(ids[3]);
    expect(ids[0]).not.toBe(ids[2]);
    expect(m.boards.map((b) => b.white)).toEqual([0, 1, 0, 1]);
    expect(m.boards.every((b) => b.fen.split(" ")[1] === "w")).toBe(true);
    expect(m.capMoves).toBe(SQUADS.moveCap);
    expect(m.safetyMoves).toBe(SQUADS.safetyCap);
    // Pairs: one opening on both boards, each squad White on one. The final: always to the end.
    const r2 = planMatch(plan, 1, 0, [squads[0]!, squads[1]!], library);
    expect(r2.boards).toHaveLength(2);
    expect(r2.boards[0]!.start).toEqual(r2.boards[1]!.start);
    expect(r2.boards.map((b) => b.white)).toEqual([0, 1]);
    const fin = planMatch(plan, 2, 0, [squads[0]!, squads[1]!], library);
    expect(fin.boards).toHaveLength(1);
    expect(fin.capMoves).toBeNull();
    expect(fin.format).toBe("final");
  });

  it("one opening: every board in every round (and Armageddon) starts from the lobby's opening", () => {
    const plan = planLobby(8, { start: "same", paceSeconds: 10, length: "end" }, library);
    expect(plan.start?.openingId).toBeTruthy();
    const squads = formSquads([], Array.from({ length: 32 }, (_, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill: 1 })), squadsRng(8, "seats")).squads;
    for (const round of [0, 1, 2] as const) {
      const m = planMatch(plan, round, 0, [squads[0]!, squads[1]!], library);
      expect(m.boards.every((b) => b.start.openingId === plan.start!.openingId)).toBe(true);
      expect(m.capMoves).toBeNull();
      expect(m.paceSeconds).toBe(10);
    }
    expect(armageddonStart(plan, { key: "r0m0" }, library)).toEqual(plan.start);
  });

  it("the normal start: the starting position everywhere", () => {
    const plan = planLobby(3, { start: "standard", paceSeconds: 15, length: "cap" }, library);
    expect(plan.start).toBeNull();
    expect(armageddonStart(plan, { key: "r0m0" }, library).fen).toBe(START_FEN);
  });

  it("the same seed plans the same matches", () => {
    const rules = { start: "random", paceSeconds: 15, length: "cap" } as const;
    const squads = formSquads([], Array.from({ length: 32 }, (_, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill: 1 })), squadsRng(1, "seats")).squads;
    const a = planMatch(planLobby(77, rules, library), 2, 0, [squads[0]!, squads[1]!], library);
    const b = planMatch(planLobby(77, rules, library), 2, 0, [squads[0]!, squads[1]!], library);
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

  it("a missed move becomes a random legal move, logged as a miss, the same for the same seed", () => {
    const m = relay();
    const d = halfDuties(m).duties;
    const moves: Record<string, string> = {};
    for (const x of d) moves[x.players[0]!] = "e2e4";
    delete moves[d[2]!.players[0]!];
    const a = resolveHalf(m, inputs(m, moves));
    const b = resolveHalf(m, inputs(m, moves));
    expect(a).toEqual(b);
    const missed = ofKind(a.events, "relay").find((e) => e.board === 2)!;
    expect(missed.missed).toBe(true);
    expect(legalMoves(START_FEN)).toContain(missed.move);
    expect(a.missed).toEqual([d[2]!.players[0]]);
    expect(a.acted).toHaveLength(3);
    // The miss counts the whole clock towards that squad's thinking time.
    expect(a.match.thinkMs[0]).toBe(15_000);
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
    expect(ofKind(first.events, "board_end")).toHaveLength(1);
    expect(first.match.result).toBeNull();
    m = first.match;
    // Black's half: board 1's Black player (squad 1, seat 0) scouts; the other three boards play.
    const black = playHalf(m);
    expect(ofKind(black.events, "scout")).toEqual([{ kind: "scout", turn: 0, half: "b", board: 0, side: 1, players: ["b0"] }]);
    expect(ofKind(black.events, "relay")).toHaveLength(3);
    m = black.match;
    // Turn 2: seat 3 of each squad lands on the finished board and sits out; seat 0 moves on to board 2.
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
    expect(ofKind(out.events, "match_end")).toHaveLength(1);
    expect(winnerSquad(out.match)).toBe(0);
    expect(() => resolveHalf(out.match, NO_INPUTS)).toThrow();
    expect(halfDuties(out.match).duties).toEqual([]);
  });

  it("a 2-2 tie goes to Armageddon: the squad with less thinking time picks colours", () => {
    const m = relay([WHITE_MATES, WHITE_MATES, WHITE_MATES, WHITE_MATES]);
    const d = halfDuties(m).duties;
    const moves = Object.fromEntries(d.map((x) => [x.players[0]!, "a1a8"]));
    const think = { a0: 9000, a2: 9000, b1: 2000, b3: 2000 };
    const out = resolveHalf(m, inputs(m, moves), think);
    expect(out.match.result).toEqual({ winner: null, points: [2, 2], how: "boards" });
    expect(out.match.thinkMs).toEqual([18_000, 4_000]);
    expect(armageddonChooser(out.match)).toBe(1);
    const arm = startArmageddon(out.match, 0, { fen: START_FEN, openingId: null });
    expect(arm).toMatchObject({ armageddon: true, format: "relay", round: 0, paceSeconds: SQUADS.armageddonPaceSeconds, key: "r0m0-armageddon", turn: 0, half: "w" });
    expect(arm.boards).toHaveLength(1);
    expect(arm.boards[0]!.white).toBe(0);
    // One board in Relay: each squad's seats take turns, one move each.
    expect(halfDuties(arm).duties).toEqual([{ board: 0, side: 0, role: "move", players: ["a0"] }]);
    expect(halfDuties({ ...arm, turn: 1, half: "b" }).duties).toEqual([{ board: 0, side: 1, role: "move", players: ["b1"] }]);
    expect(() => startArmageddon(relay(), 0, { fen: START_FEN, openingId: null })).toThrow();
  });

  it("level thinking time: a seeded coin picks who chooses", () => {
    const tied = { ...relay(), thinkMs: [5, 5] as const };
    const seen = new Set<Side>();
    for (let seed = 1; seed < 40; seed++) seen.add(armageddonChooser({ ...tied, seed }));
    expect([...seen].sort()).toEqual([0, 1]);
    expect(armageddonChooser({ ...tied, seed: 3 })).toBe(armageddonChooser({ ...tied, seed: 3 }));
  });

  it("Armageddon: White must win; a draw (stalemate, or level material at the cap) counts for Black", () => {
    const tied = { ...relay(), result: { winner: null, points: [2, 2] as const, how: "boards" as const } };
    const stale = startArmageddon(tied, 0, { fen: WHITE_STALEMATES, openingId: null });
    const drawn = playHalf(stale, { a0: "g6f7" }).match;
    expect(drawn.result).toMatchObject({ winner: 1, how: "armageddon" });
    const mate = startArmageddon(tied, 1, { fen: WHITE_MATES, openingId: null });
    expect(playHalf(mate, { b0: "a1a8" }).match.result).toMatchObject({ winner: 1, how: "armageddon" });
    const capped = startArmageddon({ ...tied, capMoves: 1 }, 0, { fen: START_FEN, openingId: null });
    const end = playHalf(playHalf(capped).match).match;
    expect(end.boards[0]!.result).toMatchObject({ winner: null, reason: "move_cap" });
    expect(end.result).toMatchObject({ winner: 1, how: "armageddon" });
  });

  it("the move cap: boards still going are decided by material once each side has made the cap's moves", () => {
    const up = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    let m = relay([up, START_FEN, up, START_FEN], { capMoves: 2 });
    m = playHalf(playHalf(m).match).match;
    expect(m.boards.every((b) => !b.result)).toBe(true);
    const out = playHalf(playHalf(m).match);
    expect(out.match.boards.map((b) => b.result?.reason)).toEqual(["move_cap", "move_cap", "move_cap", "move_cap"]);
    expect(out.match.boards.map((b) => b.result?.winner)).toEqual(["w", null, "w", null]);
    // Side 0 is White on boards 1 and 3: 2 + 0.5 + 0.5 = 3.
    expect(out.match.result).toEqual({ winner: 0, points: [3, 1], how: "boards" });
  });

  it("the silent safety cap guards a game to the end", () => {
    const s = { ...SQUADS, safetyCap: 1 };
    const m = relay(undefined, { capMoves: null }, s);
    expect(m.safetyMoves).toBe(1);
    const once = resolveHalf(m, NO_INPUTS, {}, s);
    const out = resolveHalf(once.match, NO_INPUTS, {}, s);
    expect(out.match.boards.every((b) => b.result?.reason === "safety_cap")).toBe(true);
    expect(out.match.result).toEqual({ winner: null, points: [2, 2], how: "boards" });
  });

  it("the test-only Next round: material decides every live board, a tie by a seeded coin", () => {
    const m = relay([START_FEN, "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", START_FEN, START_FEN]);
    const { match, events } = endByMaterial(m);
    expect(match.boards.every((b) => b.result?.reason === "admin")).toBe(true);
    // Board 2 (side 1 White) is a pawn up: side 1 wins it, the three level boards are draws.
    expect(match.result).toEqual({ winner: 1, points: [1.5, 2.5], how: "admin" });
    expect(ofKind(events, "board_end")).toHaveLength(4);
    const tie = endByMaterial(relay());
    expect(tie.match.result?.how).toBe("admin");
    expect(tie.match.result?.winner).not.toBeNull();
  });

  it("missed moves reach the players' records through noteActions", () => {
    const squads = formSquads(
      [{ id: "p", members: sides[0].seats.map((id) => ({ id, name: id, isBot: false, skill: null })) }],
      Array.from({ length: 28 }, (_, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill: 1 })),
      squadsRng(1, "x"),
    ).squads;
    const out = resolveHalf(relay(), NO_INPUTS);
    const after = noteActions(squads, out.acted, out.missed);
    const a0 = after.flatMap((s) => s.players).find((p) => p.id === "a0")!;
    expect(out.missed).toContain("a0");
    expect(a0.misses).toBe(1);
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
    // Each squad sees only its own picks.
    expect(visibleChoices(m, inp, 0)).toEqual({ a0: "e2e4", a1: "c2c4" });
    expect(visibleChoices(m, inp, null)).toEqual({});
  });

  it("a coin picks which of the two plays (both happen, the same for the same seed)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 30; seed++) {
      const m = { ...pairs(), seed };
      const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }));
      const e = ofKind(out.events, "pair").find((x) => x.board === 0)!;
      expect(e.picks).toEqual(["e2e4", "d2d4"]);
      expect(e.move).toBe(e.picks![e.coin!]);
      expect(out.match.boards[0]!.moves).toEqual([e.move]);
      seen.add(e.move);
      expect(resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }))).toEqual(out);
    }
    expect([...seen].sort()).toEqual(["d2d4", "e2e4"]);
  });

  it("a missed pick becomes a random legal move (never the partner's), so the coin may play junk", () => {
    for (let seed = 1; seed < 30; seed++) {
      const m = { ...pairs(), seed };
      const out = resolveHalf(m, inputs(m, { a0: "e2e4", b2: "g1f3", b3: "b1c3" }));
      const e = ofKind(out.events, "pair").find((x) => x.board === 0)!;
      expect(e.missed).toEqual([false, true]);
      expect(e.picks![0]).toBe("e2e4");
      expect(e.picks![1]).not.toBe("e2e4");
      expect(legalMoves(START_FEN)).toContain(e.picks![1]);
      expect(out.missed).toEqual(["a1"]);
    }
    // Both missed: two different random moves.
    const both = ofKind(resolveHalf(pairs(), NO_INPUTS).events, "pair");
    for (const e of both) expect(e.picks![0]).not.toBe(e.picks![1]);
  });

  it("a board's coin doesn't depend on what happened on the other board (each draw has its own stream)", () => {
    const m = pairs();
    const a = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" }));
    const b = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "d2d4", b2: "g1f3" }));
    const coin = (o: typeof a) => ofKind(o.events, "pair").find((x) => x.board === 0)!.coin;
    expect(coin(b)).toBe(coin(a));
  });

  it("only one legal move: it plays itself, with no coin and no misses", () => {
    const m = pairs([ONE_MOVE, START_FEN]);
    expect(halfDuties(m).forced).toEqual([0]);
    expect(halfDuties(m).duties.map((d) => d.board)).toEqual([1]);
    expect(choose(m, NO_INPUTS, "a0", "a1b2")).toEqual({ error: "no_duty" });
    const out = resolveHalf(m, inputs(m, { b2: "g1f3", b3: "b1c3" }));
    expect(ofKind(out.events, "forced")).toEqual([{ kind: "forced", turn: 0, half: "w", board: 0, side: 0, move: "a1b2" }]);
    expect(out.missed).toEqual([]);
  });

  it("1-1 is a tie (Armageddon); 1.5 of 2 wins", () => {
    // A coin decides which pick plays: find a seed where both boards' coins play the mate.
    let found: SquadsMatch | null = null;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const m = { ...pairs([WHITE_MATES, WHITE_MATES]), seed };
      const out = resolveHalf(m, inputs(m, { a0: "a1a8", a1: "a1a7", b2: "a1a8", b3: "a1a7" }));
      if (out.match.boards.every((b) => b.result?.reason === "checkmate")) found = out.match;
    }
    expect(found?.result).toEqual({ winner: null, points: [1, 1], how: "boards" });
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
    expect(d.scouts).toEqual([{ board: 0, side: 1, role: "pick", players: ["b0", "b1"] }]);
    expect(d.duties).toEqual([{ board: 1, side: 0, role: "pick", players: ["a2", "a3"] }]);
    expect(matchResultOf(m!.boards, false)).toBeNull();
  });
});
