import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, isPlayable, mulberry32, type BossState, type Settings } from "@chessroyale/core";
import {
  BOUNCE,
  MatchRunner,
  START_FEN,
  applyMove,
  blockedBy,
  bossAllowed,
  bossIntroTimeline,
  bounceCandidates,
  bounceDue,
  bounceFrom,
  bounceSpots,
  chooseBlock,
  crowdAllowed,
  fenAtPly,
  gameEndWith,
  hangingValue,
  initPowers,
  inCheck,
  kingAttacked,
  legalMoves,
  pawnsLost,
  pickBounce,
  pieceAt,
  powerMomentMs,
  powerTurn,
  prepareTurn,
  rageOf,
  sanLineToUci,
  sideToMove,
  snackSquare,
  triggerUltimate,
  withoutPiece,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * Big Boy, the baby boss: his snack (the crowd's d- or e-pawn eaten before move 1), his toy blocks (an empty square on
 * the crowd's half nothing may move onto or slide through, every 4 turns for 3) and the Big Bounce (the crowd's pieces
 * thrown into a position a little worse for it, at the start of his turn). See DECISIONS.md, "Big Boy".
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
function fakeEngine(score: (fen: string, m: string) => number = (fen, m) => 0.3 + 0.4 * hash(fen + m)): EngineLike {
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
  };
}
const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });

function raid(opts: { side?: "b"; patch?: Partial<Settings>; seed?: number; engine?: EngineLike } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "bigboy", lastStandFrom: 999, ...opts.patch } as Settings;
  return new MatchRunner({
    settings,
    rng: mulberry32(opts.seed ?? 5),
    engines: [opts.engine ?? fakeEngine()],
    library: [opening(LINE)],
    entrants: [{ id: "h0", name: "H", isBot: false }],
    ...(opts.side ? { raidSide: opts.side } : {}),
  });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** One crowd turn: you play `move` (or the first allowed move), then (a bounce first, when it's due) the boss replies. */
async function turn(r: MatchRunner, move?: string) {
  r.deal();
  const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
  await r.score(new Map([["h0", { move: move ?? [...allowed].sort()[0]!, thinkMs: 1000 }]]));
  if (r.isOver() || r.stageComplete()) return;
  if (r.bounceDue()) await r.playBounce();
  await r.playBoss();
}

/** Every square of a position, with what's on it. */
function squares(fen: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const p = pieceAt(fen, `${f}${r}`);
    if (p) out.set(`${f}${r}`, p.color + p.type);
  }
  return out;
}
const dist = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));

/** Positions from real-ish games, with the boss (Black) to move: the crowd (White) has just moved. */
const POSITIONS = [
  applyMove(START_FEN, "e2e4"),
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 3".replace(" b KQkq - 3 3", " b KQkq - 3 3"),
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5",
  "r2q1rk1/pp2bppp/2n1bn2/3p4/3P4/2NBBN2/PP3PPP/R2Q1RK1 b - - 5 11",
  "2r2rk1/1p1q1ppp/p2p1n2/4p3/4P3/1PN1QP2/P1P3PP/2KR3R b - - 2 18",
  "8/5pk1/6p1/3R4/8/6P1/5PK1/3r4 b - - 4 40",
  // A crowd pawn that has just made its double step (the en passant square must go).
  "rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3",
];

describe("Big Boy: who he is", () => {
  it("is on the roster as bigboy (🍭) with toy blocks and the Big Bounce, playable, and weaker underneath than the others", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "bigboy")!;
    expect(def).toMatchObject({ name: "Big Boy", icon: "🍭", kit: "Big Boy", powers: { passive: "blocks", ultimate: "bounce" } });
    expect(isPlayable(def)).toBe(true);
    // (Sawyer has a pawn's head start too: his split pawn.)
    const others = BOSS_ROSTER.filter((b) => isPlayable(b) && b.id !== "bigboy" && b.id !== "sawyer");
    for (const o of others) expect(def.offset).toBeLessThan(o.offset);
  });
});

describe("Big Boy's snack", () => {
  it("starts from the starting position less the crowd's d- or e-pawn (from the seed), a base at ply 0", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const r = raid({ seed });
      const b = r.boss!;
      expect(b.id).toBe("bigboy");
      expect(b.crowdSide).toBe("w");
      const sq = b.powers!.snack!.square;
      expect(["d2", "e2"]).toContain(sq);
      seen.add(sq);
      expect(fenOf(r)).toBe(withoutPiece(START_FEN, sq));
      const board = r.boards.get(0)!;
      expect(board.history).toEqual([]);
      expect(board.bases).toEqual([{ ply: 0, fen: fenOf(r) }]);
      // Every replay plays from the snack: the pawn never comes back.
      expect(fenAtPly([], 0, board.bases)).toBe(fenOf(r));
      expect(r.bossView()!.powers!.snack).toBe(sq);
      expect(r.bossView()!.openingName).toBeNull();
      // His material is untouched; the crowd's is a pawn down.
      expect(squares(fenOf(r)).size).toBe(31);
    }
    expect([...seen].sort()).toEqual(["d2", "e2"]);
    expect(snackSquare(1, "b")).toMatch(/^[de]7$/);
  });

  it("the moves after it replay from the snack (a game that's only legal without the pawn)", async () => {
    // Find a seed where he eats the e-pawn: then the queen's d1-h5 diagonal... and Ke2 is open.
    let seed = 1;
    while (raid({ seed }).boss!.powers!.snack!.square !== "e2") seed++;
    const r = raid({ seed });
    await turn(r, "e1e2"); // only legal with the e-pawn gone
    const board = r.boards.get(0)!;
    expect(board.history[0]).toBe("e1e2");
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
    expect(gameEndWith(board.history, board.bases)).toBeNull();
  });

  it("sides as usual: with the crowd Black (the test switch), its d7 or e7 pawn, and he opens as White", async () => {
    const r = raid({ side: "b" });
    const b = r.boss!;
    expect(b.crowdSide).toBe("b");
    expect(["d7", "e7"]).toContain(b.powers!.snack!.square);
    expect(fenOf(r)).toBe(withoutPiece(START_FEN, b.powers!.snack!.square));
    expect(sideToMove(fenOf(r))).toBe("w");
    expect(r.bossToMove()).toBe(true);
    await r.playBoss();
    expect(sideToMove(fenOf(r))).toBe("b");
    expect(r.boss!.powers!.turn).toBe(1);
  });

  it("the intro makes room for it before START!", () => {
    expect(bossIntroTimeline(0, false, true).bannerAt - bossIntroTimeline(0).bannerAt).toBeGreaterThanOrEqual(2500);
    expect(bossIntroTimeline(0, false, true).claimAt).toBe(bossIntroTimeline(0).claimAt);
  });
});

describe("Big Boy's toy blocks", () => {
  it("land on an empty square of the crowd's half that one of its pieces could move to, from the seed", () => {
    for (const fen of [START_FEN, "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", "2r2rk1/1p1q1ppp/p2p1n2/4p3/4P3/1PN1QP2/P1P3PP/2KR3R w - - 2 18"]) {
      const dests = new Set(legalMoves(fen).map((m) => m.slice(2, 4)));
      const picks = new Set<string>();
      for (let seed = 0; seed < 60; seed++) {
        const sq = chooseBlock(fen, "w", seed, 2)!;
        expect(pieceAt(fen, sq)).toBeNull();
        expect(Number(sq[1])).toBeLessThanOrEqual(4);
        expect(dests.has(sq)).toBe(true);
        picks.add(sq);
        expect(chooseBlock(fen, "w", seed, 2)).toBe(sq);
      }
      expect(picks.size).toBeGreaterThan(2);
    }
    // For a Black crowd, its own half.
    const black = applyMove(START_FEN, "e2e4");
    for (let seed = 0; seed < 20; seed++) expect(Number(chooseBlock(black, "b", seed, 2)![1])).toBeGreaterThanOrEqual(5);
  });

  it("stop moves onto them and through them (slides, a pawn's double step, castling), but not a knight's jump", () => {
    expect(blockedBy("e2e4", "e4")).toBe(true);
    expect(blockedBy("e2e4", "e3")).toBe(true); // a double step slides over e3
    expect(blockedBy("f1c4", "e2")).toBe(true);
    expect(blockedBy("f1c4", "d3")).toBe(true);
    expect(blockedBy("f1c4", "d4")).toBe(false);
    expect(blockedBy("g1f3", "g2")).toBe(false); // a knight jumps
    expect(blockedBy("g1f3", "f3")).toBe(true);
    expect(blockedBy("a1a4", "a3")).toBe(true);
    const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(blockedBy("e1g1", "f1", castle)).toBe(true);
    expect(blockedBy("e1c1", "b1", castle)).toBe(true); // the rook slides over b1
    expect(blockedBy("e1g1", "b1", castle)).toBe(false);
  });

  it("every 4 crowd turns from the 2nd, for 3 turns, blocking both sides; a toy-block turn is a power turn", async () => {
    const r = raid({ patch: { bossMaxMoves: 30 } });
    const seen: { turn: number; square: string | null }[] = [];
    for (let i = 0; i < 12 && !r.isOver(); i++) {
      const b = r.boss!;
      const block = b.powers!.block ?? null;
      seen.push({ turn: b.powers!.turn, square: block?.square ?? null });
      if (block) {
        const fen = fenOf(r);
        const allowed = r.crowdAllowed();
        // Nothing of the crowd's onto it or through it.
        for (const m of allowed ?? legalMoves(fen)) expect(blockedBy(m, block.square, fen)).toBe(false);
        expect(powerTurn(b)).toBe(true);
        expect(r.bossView()!.powers!.block).toEqual({ square: block.square, at: block.at, until: block.until });
      }
      await turn(r);
      // The boss's own move didn't touch it either (while it's still there).
      const last = r.boards.get(0)!.lastMove!;
      if (block && block.until >= r.boss!.crowdMoves) expect(blockedBy(last, block.square)).toBe(false);
    }
    const on = seen.filter((s) => s.square).map((s) => s.turn);
    expect(on.slice(0, 9)).toEqual([2, 3, 4, 6, 7, 8, 10, 11, 12]);
    expect(seen.find((s) => s.turn === 2)!.square).toBe(seen.find((s) => s.turn === 4)!.square);
    expect(seen.find((s) => s.turn === 5)!.square).toBeNull();
  });

  it("never leaves a side without a move, and never blocks the only way out of check", () => {
    const boss = (fen: string, square: string): BossState => {
      const powers = initPowers(1, fen, "w");
      return { id: "bigboy", crowdSide: "w", crowdMoves: 3, powers: { ...powers, turn: 4, block: { square, at: 4, until: 6 } } } as unknown as BossState;
    };
    // K on h1 checked by the rook on a1 along the first rank, boxed in by its pawns: the only way out is Ng1.
    const check = "6k1/8/8/8/8/7N/6PP/r6K w - - 0 1";
    expect(inCheck(check)).toBe(true);
    const legal = legalMoves(check);
    expect(legal).toEqual(["h3g1"]);
    // Block every escape's squares in turn: the block lifts whenever it would leave none.
    for (const m of legal) {
      const only = legal.filter((x) => !blockedBy(x, m.slice(2, 4), check));
      const allowed = crowdAllowed(boss(check, m.slice(2, 4)), check);
      if (!only.length) expect(allowed).toBeNull(); // lifted: every legal move allowed
      else expect(allowed ?? legal).toEqual(expect.arrayContaining(only));
    }
    // A king boxed in with one move: blocking it lifts.
    const boxed = "k7/8/1K6/8/8/8/8/1Q6 b - - 0 1";
    const bm = legalMoves(boxed);
    expect(bm).toHaveLength(1);
    const blackCrowd = { id: "bigboy", crowdSide: "b", crowdMoves: 3, powers: { ...initPowers(1, boxed, "b"), turn: 4, block: { square: bm[0]!.slice(2, 4), at: 4, until: 6 } } } as unknown as BossState;
    expect(crowdAllowed(blackCrowd, boxed)).toBeNull();
    // The boss is stopped too, and lifted the same way.
    const open = "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1";
    const allowed = bossAllowed(boss(open, "a4"), open)!;
    expect(allowed).not.toContain("a1a4");
    expect(allowed).not.toContain("a1a8"); // through a4
    expect(allowed).toContain("a1a3");
  });
});

describe("Big Boy's Big Bounce: the new position", () => {
  it("only the crowd's pieces move, never a king, no captures; each to an empty square within 2, pawns sideways only", () => {
    let total = 0;
    for (const fen of POSITIONS) {
      const crowd = sideToMove(fen) === "w" ? "b" : "w";
      for (let seed = 0; seed < 12; seed++) {
        const block = seed % 3 === 0 ? (chooseBlock(applyMove(fen, legalMoves(fen)[0]!), crowd, seed, 2) ?? null) : null;
        const cands = bounceCandidates(fen, crowd, seed, 7, block);
        for (const c of cands) {
          total++;
          // A legal position, him to move, the crowd's king not in check, his neither, and he has a move.
          expect(() => new Chess(c.fen)).not.toThrow();
          expect(sideToMove(c.fen)).toBe(sideToMove(fen));
          expect(kingAttacked(c.fen, crowd)).toBe(false);
          expect(inCheck(c.fen)).toBe(false);
          expect(legalMoves(c.fen).length).toBeGreaterThan(0);
          // 2 to 6 pieces, each from its square to an empty one within 2, never onto the block.
          expect(c.moves.length).toBeGreaterThanOrEqual(BOSS_POWERS.bouncePieces[0]);
          expect(c.moves.length).toBeLessThanOrEqual(BOSS_POWERS.bouncePieces[1]);
          const before = squares(fen);
          const after = squares(c.fen);
          expect(after.size).toBe(before.size); // no captures
          for (const m of c.moves) {
            expect(dist(m.from, m.to)).toBeLessThanOrEqual(BOSS_POWERS.bounceReach);
            expect(m.piece).not.toBe("k");
            expect(before.get(m.from)).toBe(crowd + m.piece);
            expect(before.has(m.to) && !c.moves.some((x) => x.from === m.to)).toBe(false);
            expect(after.get(m.to)).toBe(crowd + m.piece);
            expect(m.to).not.toBe(block);
            if (m.piece === "p") {
              expect(m.to[1]).toBe(m.from[1]);
              expect(["1", "8"]).not.toContain(m.to[1]);
            }
          }
          // Nothing else changed: his pieces, the kings, every crowd piece that didn't move.
          const moved = new Set(c.moves.flatMap((m) => [m.from, m.to]));
          for (const [sq, pc] of before) if (!moved.has(sq)) expect(after.get(sq)).toBe(pc);
          for (const [sq, pc] of after) if (!moved.has(sq)) expect(before.get(sq)).toBe(pc);
          // En passant cleared; castling rights only lost, and only for a moved rook.
          const [, , castle, ep] = c.fen.split(" ");
          expect(ep).toBe("-");
          const was = fen.split(" ")[2]!;
          for (const ch of castle!.replace("-", "")) expect(was).toContain(ch);
          const corner: Record<string, string> = { a1: "Q", h1: "K", a8: "q", h8: "k" };
          for (const ch of was.replace("-", "")) {
            const sq = Object.entries(corner).find(([, v]) => v === ch)![0];
            if (castle!.includes(ch)) expect(c.moves.some((m) => m.from === sq)).toBe(false);
            else if ((ch === ch.toUpperCase()) === (crowd === "w")) expect(c.moves.some((m) => m.from === sq && m.piece === "r")).toBe(true);
          }
          // Nothing of the crowd's left hanging that wasn't.
          expect(hangingValue(c.fen, crowd)).toBeLessThanOrEqual(hangingValue(fen, crowd));
        }
        // The same list everywhere, from the seed.
        expect(bounceCandidates(fen, crowd, seed, 7, block)).toEqual(cands);
      }
    }
    expect(total).toBeGreaterThan(400);
  });

  it("castling rights go with a rook thrown off its corner", () => {
    const fen = "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R b KQkq - 0 8";
    let checked = 0;
    for (let seed = 0; seed < 30; seed++)
      for (const c of bounceCandidates(fen, "w", seed, 3)) {
        const rights = c.fen.split(" ")[2]!;
        expect(rights.includes("Q")).toBe(!c.moves.some((m) => m.from === "a1"));
        expect(rights.includes("K")).toBe(!c.moves.some((m) => m.from === "h1"));
        expect(rights).toContain("k");
        expect(rights).toContain("q");
        if (c.moves.some((m) => m.from === "a1" || m.from === "h1")) checked++;
      }
    expect(checked).toBeGreaterThan(0);
  });

  it("measures the loss in pawns (log-odds of the expected score), so a pawn is a pawn however lopsided the game", () => {
    expect(pawnsLost(0.5, 0.5)).toBe(0);
    // About the snack's own pawn: the starting position against one without a centre pawn.
    expect(pawnsLost(0.536, 0.305)).toBeCloseTo(1, 1);
    // The same pawn from a crowd already well behind is a few points of expected score, still a pawn.
    const behind = 1 / (1 + Math.exp(2.5));
    const pawnDown = 1 / (1 + Math.exp(2.5 + BOSS_POWERS.bouncePawnLogit));
    expect(pawnsLost(behind, pawnDown)).toBeCloseTo(1, 5);
    expect((behind - pawnDown) * 100).toBeLessThan(5);
  });

  it("picks the loss nearest the target inside the band; else the nearest below it, never a gain for the crowd; never past the cap", () => {
    // The crowd's expected score `n` pawns worse than 0.5.
    const worse = (n: number) => 1 / (1 + Math.exp(n * BOSS_POWERS.bouncePawnLogit));
    const at = (n: number, fen: string, mate = false) => ({ fen, crowd: worse(n), ...(mate ? { mate } : {}) });
    // In the band (0.5 to 1.5 pawns): nearest 1.
    expect(pickBounce(0.5, [at(0.6, "a"), at(0.9, "b"), at(1.4, "c"), at(2, "d")])).toEqual({ fen: "b", loss: 0.9 });
    // None in the band: the nearest below it (the biggest loss short of half a pawn), never one that helps the crowd.
    expect(pickBounce(0.5, [at(-0.2, "gain"), at(0.1, "one"), at(0.3, "three"), at(2.5, "big")])).toEqual({ fen: "three", loss: 0.3 });
    expect(pickBounce(0.5, [at(-0.3, "gain"), at(2, "big")])).toBeNull();
    // Over the cap (a pawn and a half): nothing moves.
    expect(pickBounce(0.5, [at(1.6, "x"), at(3, "y")])).toBeNull();
    // A forced mate in the line, either way: never.
    expect(pickBounce(0.5, [at(1, "mate", true), at(0.3, "three")])).toEqual({ fen: "three", loss: 0.3 });
  });

  it("glances at every candidate, then looks properly at the few nearest the target, and picks from those", async () => {
    const fen = POSITIONS[3]!;
    const cands = bounceCandidates(fen, "w", 11, 9).map((c) => c.fen);
    expect(cands.length).toBe(BOSS_POWERS.bounceCandidates);
    // His expected score after his best move: 0.5 in the real position; a candidate's makes the crowd i/5 pawns worse.
    const crowd = (f: string) => (f === fen ? 0.5 : 1 / (1 + Math.exp(((cands.indexOf(f) + 1) / 5) * BOSS_POWERS.bouncePawnLogit)));
    const asked: [string, number][] = [];
    const engine = (): EngineLike => ({
      ...fakeEngine(),
      topMoves: async () => {
        throw new Error("the bounce asks for its own budget");
      },
      topMovesAt: async (f, n, nodes) => {
        asked.push([f, nodes]);
        return [{ move: legalMoves(f)[0]!, expected: 1 - crowd(f) }].slice(0, n);
      },
    });
    const pick = await bounceFrom([engine(), engine()], fen, cands);
    // Losses 0.2, 0.4 ... 3.2 pawns: the 5th (1 pawn) is the target.
    expect(pick).toEqual({ fen: cands[4], loss: 1 });
    const glance = asked.filter(([, n]) => n === BOSS_POWERS.bounceScreenNodes).map(([f]) => f);
    const look = asked.filter(([, n]) => n === BOSS_POWERS.bounceNodes).map(([f]) => f);
    expect(glance.sort()).toEqual([fen, ...cands].sort());
    expect(look.sort()).toEqual([fen, cands[3], cands[4], cands[5]].sort());
    expect(await bounceFrom([], fen, cands)).toBeNull();
    expect(await bounceFrom([engine()], fen, [])).toBeNull();
  });

  it("lands three bounces on 2x2 blocks over the pieces it moves (never the centre's), the same everywhere", () => {
    for (const fen of POSITIONS)
      for (let seed = 0; seed < 10; seed++) {
        const crowd = sideToMove(fen) === "w" ? "b" : "w";
        for (const c of bounceCandidates(fen, crowd, seed, 4)) {
          const spots = bounceSpots(c.moves, crowd, seed, 4);
          expect(spots).toHaveLength(3);
          expect(new Set(spots).size).toBe(3);
          for (const sp of spots) {
            expect(sp).toMatch(/^[a-g][1-7]$/);
            expect(sp).not.toBe("d4");
          }
          // The first moved piece is under one of them.
          const m = c.moves[0]!;
          expect(spots.some((sp) => m.from.charCodeAt(0) - sp.charCodeAt(0) >= 0 && m.from.charCodeAt(0) - sp.charCodeAt(0) <= 1 && Number(m.from[1]) - Number(sp[1]) >= 0 && Number(m.from[1]) - Number(sp[1]) <= 1)).toBe(true);
          expect(bounceSpots(c.moves, crowd, seed, 4)).toEqual(spots);
        }
      }
  });
});

describe("Big Boy's Big Bounce in a battle", () => {
  it("the meter full: RAGE! as a turn begins; after the crowd's move, the bounce at the start of his turn, then his move", async () => {
    const r = raid({ patch: { bossPowerTest: "bounce" } });
    await turn(r); // crowd turn 1
    const b = r.boss!;
    expect(b.powers!.turn).toBe(2);
    expect(b.powers!.warnAt).toBe(2);
    expect(b.powers!.events.map((e) => e.kind)).toContain("warn");
    expect(r.bossView()!.powers!.warned).toBe(true);
    // The crowd's 2nd move: then it's due, before his move.
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    expect(r.bounceDue()).toBe(true);
    expect(bounceDue(r.boss)).toBe(true);
    const before = fenOf(r);
    const ply = r.boards.get(0)!.history.length;
    const res = await r.playBounce();
    expect(res.at).toBe(2);
    expect(res.before).toBe(before);
    expect(res.spots).toHaveLength(3);
    const after = fenOf(r);
    if (res.moves.length) {
      expect(after).not.toBe(before);
      expect(bounceCandidates(before, "w", r.boss!.powers!.seed, 2, null).map((c) => c.fen)).toContain(after);
      // A base where the position changed: replays keep the bounced pieces where they landed.
      expect(r.boards.get(0)!.bases).toContainEqual({ ply, fen: after });
    }
    expect(r.bounceDue()).toBe(false);
    expect(r.boss!.powers!.ultAt).toBe(2);
    expect(r.boss!.powers!.events.at(-1)).toEqual({ kind: "bounce", turn: 2 });
    expect(r.bossView()!.powers!.bounce).toEqual(res);
    // The meter is spent.
    expect(rageOf(r.boss)).toBeNull();
    expect(powerMomentMs([{ kind: "bounce" }])).toBe(BOUNCE.total);
    // He plays his move from the new position; the game replays through it.
    await r.playBoss();
    const board = r.boards.get(0)!;
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
    expect(board.history.length).toBe(ply + 1);
    // Once a match.
    for (let i = 0; i < 6 && !r.isOver(); i++) {
      await turn(r);
      expect(r.boss!.powers!.bounce!.at).toBe(2);
    }
  });

  it("the admins' trigger: at the start of his next turn, without the warning", async () => {
    const r = raid();
    await turn(r);
    expect(triggerUltimate(r.boss).ok).toBe(true);
    expect(r.triggerUltimate()).toBe(true);
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    expect(r.boss!.powers!.warnAt).toBeUndefined();
    expect(r.bounceDue()).toBe(true);
    await r.playBounce();
    expect(r.boss!.powers!.ultNext).toBeUndefined();
    expect(r.triggerUltimate()).toBe(false);
  });

  it("the trigger pressed while he thinks: through his move and the next crowd turn, then the bounce", () => {
    const fen = applyMove(START_FEN, "e2e4");
    const base = { id: "bigboy", crowdSide: "w", crowdMoves: 3, powers: { ...initPowers(1, fen, "w"), turn: 3, ultNext: true } } as unknown as BossState;
    // His move lands: the crowd's 4th turn begins and the trigger waits.
    const next = prepareTurn({ ...base, crowdMoves: 3 }, applyMove(fen, "e7e5"));
    expect(next.powers!.ultNext).toBe(true);
    expect(next.powers!.warnAt).toBeUndefined();
    expect(bounceDue({ ...next, crowdMoves: 4 })).toBe(true);
  });

  it("no pick (no engine answer, or none within the cap): the bounces still play, nothing moves", async () => {
    const r = raid({ patch: { bossPowerTest: "bounce" } });
    await turn(r);
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    const before = fenOf(r);
    const bases = r.boards.get(0)!.bases;
    const res = r.applyBounce(null);
    expect(res.moves).toEqual([]);
    expect(res.loss).toBeNull();
    expect(res.spots).toHaveLength(3);
    expect(fenOf(r)).toBe(before);
    expect(r.boards.get(0)!.bases).toEqual(bases);
    expect(r.boss!.powers!.events.at(-1)!.kind).toBe("bounce");
    // Anything that isn't a candidate is the same as none.
    const s = raid({ patch: { bossPowerTest: "bounce" } });
    await turn(s);
    s.deal();
    await s.score(new Map([["h0", { move: [...(s.crowdAllowed() ?? legalMoves(fenOf(s)))].sort()[0]!, thinkMs: 1000 }]]));
    const was = fenOf(s);
    expect(s.applyBounce("8/8/8/8/8/8/8/K6k b - - 0 1").moves).toEqual([]);
    expect(fenOf(s)).toBe(was);
  });

  it("over many positions, the pick is inside the band whenever a candidate is, nearest the target; never past the cap", async () => {
    // An engine whose verdict follows material and how far the crowd's pieces were thrown from the centre.
    const material = (f: string, side: "w" | "b") => [...squares(f).values()].filter((p) => p[0] === side).reduce((t, p) => t + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as Record<string, number>)[p[1]!]!, 0);
    const centre = (f: string, side: "w" | "b") => [...squares(f)].filter(([, p]) => p[0] === side && p[1] !== "k").reduce((t, [sq]) => t - Math.abs(sq.charCodeAt(0) - 100.5) - Math.abs(Number(sq[1]) - 4.5), 0);
    const his = (f: string) => {
      const me = sideToMove(f);
      const them = me === "w" ? "b" : "w";
      const x = BOSS_POWERS.bouncePawnLogit * (material(f, me) - material(f, them)) + 0.15 * (centre(f, me) - centre(f, them));
      return 1 / (1 + Math.exp(-x));
    };
    const engine: EngineLike = { ...fakeEngine(), topMoves: async (f) => [{ move: legalMoves(f)[0]!, expected: his(f) }] };
    const [lo, hi] = BOSS_POWERS.bounceLoss;
    let picks = 0;
    let inBand = 0;
    for (const fen of POSITIONS.slice(1)) {
      const crowd = sideToMove(fen) === "w" ? "b" : "w";
      for (let seed = 0; seed < 8; seed++) {
        const cands = bounceCandidates(fen, crowd, seed, 5).map((c) => c.fen);
        const losses = cands.map((c) => pawnsLost(1 - his(fen), 1 - his(c)));
        const pick = await bounceFrom([engine], fen, cands);
        const band = losses.filter((l) => l >= lo && l <= hi);
        if (band.length) {
          inBand++;
          // (The pick is among the few looked at properly: nearest the target by the glance, here the same engine.)
          const nearest = Math.min(...band.map((l) => Math.abs(l - BOSS_POWERS.bounceTarget)));
          expect(Math.abs(pick!.loss - BOSS_POWERS.bounceTarget)).toBeCloseTo(nearest, 1);
        }
        if (!pick) continue;
        picks++;
        expect(pick.loss).toBeGreaterThanOrEqual(0);
        expect(pick.loss).toBeLessThanOrEqual(hi);
      }
    }
    expect(picks).toBeGreaterThan(20);
    expect(inBand).toBeGreaterThan(5);
  });
});
