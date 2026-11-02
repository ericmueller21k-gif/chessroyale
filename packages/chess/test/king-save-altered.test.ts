import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, DEFAULT_SETTINGS, mulberry32, type BossPowerState, type BossState } from "@chessroyale/core";
import { FOLIO_FRESH, MatchRunner, applyMove, boardAltered, bossRules, legalMoves, pieceAt, type BossRules, type EngineLike } from "../src/index.ts";
import { KIT_OPENING, kitSettings } from "./boss-kit-lib.ts";

/**
 * The God King's Last Stand sits out while a boss's power has changed the board (Eric, Oct 24: inside Babur's burning
 * hoop his save took back a capture, fearing a recapture the hoop's walls forbid; boardAltered in boss-powers.ts,
 * docs/decisions/2026-10-24-king-save-off-on-altered-boards.md). The move stands, nothing is spent, and once the board
 * is plain again he saves as before.
 */

/** A scripted judge: the crowd's `blunder()` gives away 47 points from 55%, every other move a little under the best. */
function judge(blunder: () => string): EngineLike {
  const exp = (fen: string, move: string) => (move === blunder() ? 0.08 : 0.55 - 0.001 * legalMoves(fen).indexOf(move));
  const ranked = (fen: string, moves: readonly string[]) => moves.map((move) => ({ move, expected: exp(fen, move) })).sort((a, b) => b.expected - a.expected);
  return {
    topMoves: async (fen, n) => ranked(fen, legalMoves(fen)).slice(0, n),
    topMovesAt: async (fen, n, _nodes, only) => ranked(fen, only ?? legalMoves(fen)).slice(0, n),
    scoreMoves: async (fen, moves) => ranked(fen, [...new Set(moves)]),
    playAtElo: async (fen) => ranked(fen, legalMoves(fen))[0]?.move ?? "0000",
  };
}

type Patch = (fen: string) => Partial<BossPowerState>;

/** A battle against `id`, the crowd White to move on `fen` (the game so far when not given), its powers patched. */
function battle(id: string, patch: Patch = () => ({}), fen?: string) {
  let blunder = "";
  const settings = kitSettings({ boss: id, test: "", maxMoves: 50 }, { lastStandFrom: DEFAULT_SETTINGS.lastStandFrom });
  const r = new MatchRunner({ settings, rng: mulberry32(7), engines: [judge(() => blunder)], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });
  const boardId = r.state.boards[0]!;
  if (fen) {
    const board = r.boards.get(boardId)!;
    r.boards.set(boardId, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
  }
  const at = r.boards.get(boardId)!.fen;
  const boss = r.state.boss!;
  r.state = { ...r.state, boss: { ...boss, powers: { ...boss.powers!, ...patch(at) } } };
  return {
    r,
    fen: at,
    /** The crowd plays `move` (else its first allowed move), which the judge calls a blunder: the Last Stand, if he came. */
    async play(move?: string) {
      r.deal();
      blunder = move ?? (r.crowdAllowed() ?? legalMoves(at))[0]!;
      const res = await r.score(new Map([["h0", { move: blunder, thinkMs: 1000 }]]));
      return res.boards[0]!.lastStand;
    },
  };
}

/** The Last Stand on the crowd's next move against `id` with `patch` on the board (the move: the first allowed). */
async function saves(id: string, patch?: Patch, fen?: string): Promise<boolean> {
  const b = battle(id, patch, fen);
  expect(b.r.state.boss!.id).toBe(id);
  return !!(await b.play());
}

// Squares on the game so far (KIT_OPENING: the Ruy Lopez's main line, White to move; the crowd White).
const crowdPiece = (fen: string) => legalMoves(fen).find((m) => pieceAt(fen, m.slice(0, 2))?.type === "n")!.slice(0, 2);
const emptyTarget = (fen: string) => legalMoves(fen).find((m) => !pieceAt(fen, m.slice(2, 4)))!.slice(2, 4);
const hisPawns = (fen: string) => ["a6", "b5", "c7", "d6", "f7", "g7", "h7"].filter((sq) => pieceAt(fen, sq)?.type === "p" && pieceAt(fen, sq)?.color === "b");

describe("the God King's Last Stand on a board a boss has changed: Eric's case", () => {
  // His queen on d4 takes the pawn on e5 that shares her ring (the hoop at d4: d4, e4, d5, e5). In plain chess f6xe5 takes
  // her back, so the judge calls it a blunder; the hoop's wall forbids that reply.
  const RING = "6k1/8/5p2/4p3/3Q4/8/8/6K1 w - - 0 1";

  it("inside a hoop, the queen's capture of the pawn in her ring stands: no save, nothing spent", async () => {
    const b = battle("tiger", () => ({ hoops: { blocks: ["d4"], at: 0, left: 2, gain: null } }), RING);
    expect(boardAltered(b.r.state.boss, RING)).toBe(true);
    expect(await b.play("d4e5")).toBeUndefined();
    const boss = b.r.state.boss!;
    expect(b.r.boards.get(b.r.state.boards[0]!)!.fen).toBe(applyMove(RING, "d4e5"));
    expect(boss.lastStand).toBeUndefined();
    expect(boss.barred).toBeUndefined();
    expect(boss.kingCharges).toBe(3);
    expect(boss.crowdMoves).toBe(1);
  });

  it("the same capture with no hoop, where f6xe5 is a real reply: he saves it, as before", async () => {
    const b = battle("tiger", () => ({ hoops: null }), RING);
    expect(boardAltered(b.r.state.boss, RING)).toBe(false);
    expect(await b.play("d4e5")).toMatchObject({ move: "d4e5", loss: 47 });
    expect(b.r.boards.get(b.r.state.boards[0]!)!.fen).toBe(RING);
    expect(b.r.state.boss!.barred).toBe("d4e5");
  });

  it("the test switch (?laststand=1) still calls him on any board", async () => {
    const b = battle("tiger", () => ({ hoops: { blocks: ["d4"], at: 0, left: 2, gain: null } }), RING);
    b.r.forceLastStand = true;
    expect(await b.play("d4e5")).toMatchObject({ move: "d4e5" });
  });
});

/**
 * Every boss with powers, by its BOSS_ROSTER id: the states of his that change the board (each: the save sits out while
 * it's on, and comes again once it's gone), or why none does. A new boss fails "every boss is audited" until it's here.
 */
const TIMBER_FRESH = { prog: [0, 0, 0, 0, 0], done: [], n: 0, since: 0, wseed: 1, drops: 0, gnaws: 0 };
const AUDIT: Record<string, { on: Record<string, Patch>; off: Patch } | { none: string }> = {
  gingerbread: {
    on: {
      "a frozen piece": (f) => ({ frozen: { square: crowdPiece(f), piece: "n", until: 3 } }),
      "the blizzard": (f) => ({ ultAt: 1, blizzard: { turn: 1, square: crowdPiece(f) } }),
    },
    off: () => ({ frozen: null, blizzard: null }),
  },
  clown: {
    on: {
      "a pie": (f) => ({ pies: [{ square: emptyTarget(f), until: 3 }] }),
      "the funhouse's turned board": () => ({ funhouse: { turn: 1, side: 90 } }),
    },
    off: () => ({ pies: [], funhouse: null }),
  },
  grex: {
    on: {
      "a tile ablaze": (f) => ({ fire: [{ square: emptyTarget(f), lit: 1 }] }),
      "the Roman candle's shadows": (f) => ({ candle: { at: 1, left: 4, next: 1, waves: [{ lands: 3, shots: 2, squares: [emptyTarget(f), "h6"] }] } }),
    },
    off: () => ({ fire: [], candle: null }),
  },
  hollow: { on: { "a square in the dark": (f) => ({ dark: [{ square: crowdPiece(f), at: 1, until: 3 }] }) }, off: () => ({ dark: [] }) },
  bigboy: { on: { "a toy block": (f) => ({ block: { square: emptyTarget(f), at: 1, until: 3 } }) }, off: () => ({ block: null }) },
  pig: {
    on: { "the turn after his lasso drag": () => ({ drag: { turn: 1, from: "c2", to: "c2", piece: "p" } }) },
    off: () => ({ drag: null, showdown: null, pull: null }),
  },
  sawyer: {
    on: {
      "the board saw": () => ({ boardSaw: { at: 1, until: 3 } }),
      "a saw cut": () => ({ cut: { a: "d3", b: "e3", at: 1, until: 3 } }),
      "his first move, a pawn's": () => ({ split: undefined }),
    },
    off: () => ({ boardSaw: null, cut: null, split: { turn: 0, pawn: null, square: null, halves: [], waiting: true } }),
  },
  alfil: {
    on: { "two pawns marked for the fusion": (f) => ({ tusks: { turn: 1, at: 0, pawns: hisPawns(f).slice(0, 2) } }) },
    off: () => ({ tusks: null, airborne: null }),
  },
  hopper: {
    on: { "the carrots, the race on": () => ({ carrots: { at: 0, squares: ["a3", "h3"], pulls: [], crowdMoves: 0, bossMoves: 0 } }) },
    off: () => ({ carrots: null, hop: null }),
  },
  smudgy: {
    on: { "his rook hiding as a pawn": (f) => ({ camo: { side: "a", step: 2, missed: 0, due: null, square: hisPawns(f)[0]!, swap: { at: 0, rook: "a8", pawn: hisPawns(f)[0]! } } }) },
    off: () => ({}),
  },
  moo: {
    on: { "a stunned piece": (f) => ({ moo: { moves: 3, stun: { turn: 1, squares: [crowdPiece(f)] }, full: null } }) },
    off: () => ({ moo: { moves: 3, stun: null, full: null } }),
  },
  gardener: {
    on: { "a plant": (f) => ({ garden: { since: 0, base: 0, plants: [{ square: emptyTarget(f), at: 0, until: 3 }], waterings: 1 } }) },
    off: () => ({}),
  },
  tiger: { on: { "the burning hoops": () => ({ hoops: { blocks: ["d3"], at: 0, left: 2, gain: null } }) }, off: () => ({ hoops: null }) },
  folio: {
    on: {
      "a folded piece": (f) => ({ folio: { ...FOLIO_FRESH, folded: { square: crowdPiece(f), piece: "n", at: 1, until: 3 } } }),
      "the Crease": () => ({ crease: { line: "4|5", at: 1, until: 4, side: "w" } }),
    },
    off: () => ({ crease: null, folio: FOLIO_FRESH }),
  },
  recluse: { none: "his passive blocks the God King's help: the Last Stand never comes against him anyway" },
  // (Timber's drop and his Gnaw change the board at his turn's end: that crowd turn the save sits out, as Babur's landing.)
  timber: {
    on: {
      "a piece of his just dropped": () => ({ workshop: { ...TIMBER_FRESH, drops: 1, last: { at: 0, piece: "n", square: "a5" } } }),
      "a pawn of yours just gnawed": () => ({ workshop: { ...TIMBER_FRESH, gnaws: 1, gnaw: { at: 0, square: "h2", scraps: 8 } } }),
    },
    off: () => ({ workshop: TIMBER_FRESH }),
  },
};

describe("the God King's Last Stand on a board a boss has changed: every boss", () => {
  it("every boss with powers is audited (a new one is added to AUDIT here)", () => {
    expect(Object.keys(AUDIT).sort()).toEqual(BOSS_ROSTER.filter((d) => d.powers).map((d) => d.id).sort());
    expect(bossRules({ id: "recluse" })?.blocksKing).toBe(true);
  });

  for (const [id, a] of Object.entries(AUDIT)) {
    if ("none" in a) continue;
    for (const [what, on] of Object.entries(a.on))
      it(`${id}: ${what}: the save sits out; once it's gone, he saves again`, async () => {
        expect(await saves(id, on), "while it's on").toBe(false);
        expect(await saves(id, a.off), "once it's gone").toBe(true);
      });
  }

  it("what isn't a change to the board leaves him as he was: Alfil's elephants (bishops in every way), Moo's Full Moon, Folio's Draft mark (a warning, limiting nothing)", async () => {
    expect(await saves("alfil", () => ({ elephants: ["c8"] }))).toBe(true);
    expect(await saves("folio", (f) => ({ folio: { ...FOLIO_FRESH, mark: { square: crowdPiece(f), piece: "n", attacker: "a6", by: "p", line: [], at: 1, until: 2 } } }))).toBe(true);
    expect(await saves("moo", () => ({ moo: { moves: 3, stun: null, full: { at: 0, left: 2 } } }))).toBe(true);
  });
});

describe("the gate is one rule for every boss: a new boss's limits count with no edit", () => {
  const POWERS = { seed: 1, turn: 1, material: 39, lost: 0, nextPassive: 2, events: [] };
  const stub = { id: "stub", crowdSide: "w", crowdMoves: 0, powers: POWERS } as unknown as BossState;
  const base: BossRules = { id: "stub", ultimate: () => false, passive() {} };
  const fen = KIT_OPENING.moves.reduce((f, m) => applyMove(f, m), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

  it("a stub boss with nothing on: not altered", () => {
    expect(boardAltered(stub, fen, base)).toBe(false);
    expect(boardAltered(stub, fen, { ...base, crowdFilter: (allowed) => allowed })).toBe(false);
    expect(boardAltered({ ...stub, powers: undefined } as BossState, fen, { ...base, powerTurn: () => true })).toBe(false);
  });

  it("a stub boss whose new filter takes away one of the crowd's moves, or anything stopping his: altered", () => {
    expect(boardAltered(stub, fen, { ...base, crowdFilter: (allowed) => allowed.slice(1) })).toBe(true);
    expect(boardAltered(stub, fen, { ...base, bossStops: () => () => false })).toBe(true);
    expect(boardAltered(stub, fen, { ...base, powerTurn: () => true })).toBe(true);
    expect(boardAltered(stub, fen, { ...base, altersBoard: () => true })).toBe(true);
  });
});
