import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOSS_BRAIN, RECLUSE_PHASE2 } from "@chessroyale/core";
import {
  PHASE2_WIN_FEN,
  UciEngine,
  bankLeft,
  boardEnd,
  chess960Fen,
  fenAtPly,
  isChess960Fen,
  legalMoves,
  phase2BossMove,
  phase2Brain,
  phase2Flags,
  phase2Move,
  phase2Next,
  phase2Numbers,
  phase2Outcome,
  phase2Resign,
  phase2Timeouts,
  phase2Ult,
  moveLeft,
  phase2ToMove,
  recentMoves,
  startPhase2,
  type Phase2State,
  type UciTransport,
} from "../src/index.ts";
import { createNodeEngine } from "../src/node.ts";

const PLAYERS = ["you", "bot1", "bot2", "bot3"];
const T0 = 1_000_000;
const start = (numbers = phase2Numbers(42), win = false): Phase2State => startPhase2({ players: PLAYERS, numbers, now: T0, win });
/** A board's state with a few edits (results, as if played). */
const withBoards = (st: Phase2State, edit: (id: number) => Partial<Phase2State["boards"][number]>): Phase2State => ({ ...st, boards: st.boards.map((b) => ({ ...b, ...edit(b.id) })) });

describe("the Hidden Boss's phase 2: four boards, each its own Chess960 start", () => {
  it("draws four different start positions from the battle's seed: the same seed, the same four", () => {
    for (const seed of [0, 1, 42, 2 ** 31, 4_000_000_000]) {
      const n = phase2Numbers(seed);
      expect(n).toHaveLength(RECLUSE_PHASE2.boards);
      expect(new Set(n).size).toBe(n.length);
      for (const x of n) expect(Number.isInteger(x) && x >= 0 && x <= 959).toBe(true);
      expect(phase2Numbers(seed)).toEqual(n);
    }
    // (Different battles, different sets: over many seeds nearly every set differs.)
    const sets = new Set(Array.from({ length: 200 }, (_, s) => phase2Numbers(s * 7919).join(",")));
    expect(sets.size).toBeGreaterThan(195);
    // All 960 can be drawn without a repeat (no retry loop: drawn without replacement).
    expect(new Set(phase2Numbers(9, 960)).size).toBe(960);
  });

  it("each board starts from a base at ply 0 holding its Chess960 FEN, the players White to move, a full bank each", () => {
    const numbers = phase2Numbers(7);
    const st = start(numbers);
    expect(st.boards.map((b) => b.player)).toEqual(PLAYERS);
    for (const b of st.boards) {
      const fen = chess960Fen(numbers[b.id]!);
      expect(b.number).toBe(numbers[b.id]);
      expect(b.board.fen).toBe(fen);
      expect(isChess960Fen(fen)).toBe(true);
      expect(b.board.bases).toEqual([{ ply: 0, fen }]);
      expect(b.board.history).toEqual([]);
      expect(phase2ToMove(b)).toBe("crowd");
      expect(b.bankMs).toBe(RECLUSE_PHASE2.bankSeconds * 1000);
      expect(b.turnAt).toBe(T0);
    }
    expect(new Set(st.boards.map((b) => b.board.fen)).size).toBe(4);
  });

  it("replays from the ply-0 base: fenAtPly, recentMoves and the board's end all start from its own position", () => {
    let st = start([0, 1, 2, 3]);
    const b0 = st.boards[0]!;
    const plies: string[] = [];
    let fen = b0.board.fen;
    for (let i = 0; i < 6; i++) {
      const m = legalMoves(fen).sort()[0]!;
      st = phase2Move(st, 0, m, T0 + 1000 * (i + 1));
      plies.push(m);
      fen = st.boards[0]!.board.fen;
    }
    const b = st.boards[0]!.board;
    expect(b.history).toEqual(plies);
    expect(fenAtPly(b.history, 0, b.bases)).toBe(chess960Fen(0));
    expect(fenAtPly(b.history, b.history.length, b.bases)).toBe(b.fen);
    const recent = recentMoves(b, 4);
    expect(fenAtPly([...b.history.slice(0, 2)], 2, b.bases)).toBe(recent.from);
    expect(boardEnd(b)).toBeNull();
  });

  it("castles as Chess960 on a board (the king onto its own rook)", () => {
    // King on g1, its rook on h1, f1 clear: castling short puts the king on g1 and the rook on f1.
    const ready = "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNN1KR w Hhf - 0 1";
    const b0 = start().boards[0]!;
    const st: Phase2State = { slow: 0, ultAt: null, boards: [{ ...b0, board: { ...b0.board, fen: ready, bases: [{ ply: 0, fen: ready }] } }] };
    expect(legalMoves(ready)).toContain("g1h1");
    const after = phase2Move(st, 0, "g1h1", T0 + 500);
    expect(after.boards[0]!.board.fen.split(" ")[0]).toBe("bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRK1");
    expect(phase2ToMove(after.boards[0]!)).toBe("boss");
  });

  it("the clocks: the player's runs on their move only; his move starts it again; an illegal move changes nothing", () => {
    let st = start([518, 1, 2, 3]);
    expect(phase2Move(st, 0, "e2e5", T0 + 10)).toBe(st);
    expect(phase2Move(st, 0, "e7e5", T0 + 10)).toBe(st);
    st = phase2Move(st, 0, "e2e4", T0 + 3000);
    let b = st.boards[0]!;
    expect(b.bankMs).toBe(RECLUSE_PHASE2.bankSeconds * 1000 - 3000);
    expect(b.turnAt).toBeNull();
    expect(phase2ToMove(b)).toBe("boss");
    // His move takes nothing off anyone's clock (he has none); the player's starts as it lands.
    expect(bankLeft(b, T0 + 60_000)).toBe(b.bankMs);
    st = phase2Move(st, 0, "e7e5", T0 + 9000);
    b = st.boards[0]!;
    expect(b.turnAt).toBe(T0 + 9000);
    expect(bankLeft(b, T0 + 10_000)).toBe(RECLUSE_PHASE2.bankSeconds * 1000 - 4000);
    // The other boards' clocks ran all along: theirs is their own move.
    expect(bankLeft(st.boards[1]!, T0 + 10_000)).toBe(RECLUSE_PHASE2.bankSeconds * 1000 - 10_000);
  });

  it("out of time loses that board: a late move isn't played, and the flag check catches a bank run out", () => {
    const bank = RECLUSE_PHASE2.bankSeconds * 1000;
    let st = start([518, 1, 2, 3]);
    const late = phase2Move(st, 0, "e2e4", T0 + bank + 1);
    expect(late.boards[0]!.result).toEqual({ winner: "boss", how: "time" });
    expect(late.boards[0]!.board.history).toEqual([]);
    expect(phase2Flags(st, T0 + bank - 1)).toBe(st);
    // Board 0 moves in time; the others run out together.
    st = phase2Move(st, 0, "e2e4", T0 + 1000);
    const flagged = phase2Flags(st, T0 + bank);
    expect(flagged.boards.map((b) => b.result?.how ?? null)).toEqual([null, "time", "time", "time"]);
    expect(phase2Outcome(flagged)).toMatchObject({ won: 0, lost: 3, decided: false, beaten: false });
  });

  it("resigning loses that board only; the others play on", () => {
    const st = start();
    const r = phase2Resign(st, 0, T0 + 5000);
    expect(r.boards[0]!.result).toEqual({ winner: "boss", how: "resign" });
    expect(r.boards[0]!.bankMs).toBe(RECLUSE_PHASE2.bankSeconds * 1000 - 5000);
    expect(r.boards.slice(1).every((b) => b.result === null && b.turnAt === T0)).toBe(true);
    expect(phase2Resign(r, 0, T0 + 6000)).toBe(r);
    expect(phase2Move(r, 0, legalMoves(r.boards[0]!.board.fen)[0]!, T0 + 7000)).toBe(r);
  });

  it("all four must win: three wins and a draw, or three and a loss, is a defeat; the battle ends when every board is decided", () => {
    const won = { winner: "crowd" as const, how: "mate" as const };
    const st = start();
    expect(phase2Outcome(withBoards(st, (id) => (id < 3 ? { result: won } : {})))).toMatchObject({ won: 3, decided: false, beaten: false });
    expect(phase2Outcome(withBoards(st, (id) => ({ result: id < 3 ? won : { winner: "draw", how: "stalemate" } })))).toMatchObject({ won: 3, drawn: 1, decided: true, beaten: false });
    expect(phase2Outcome(withBoards(st, (id) => ({ result: id < 3 ? won : { winner: "boss", how: "time" } })))).toMatchObject({ won: 3, lost: 1, decided: true, beaten: false });
    expect(phase2Outcome(withBoards(st, () => ({ result: won })))).toEqual({ won: 4, lost: 0, drawn: 0, of: 4, decided: true, beaten: true });
  });

  it("the test switch (?win=1): every board from a mate in one; Qxf7 wins each by mate, and four wins beat him", () => {
    let st = start(phase2Numbers(3), true);
    expect(isChess960Fen(PHASE2_WIN_FEN)).toBe(true);
    for (const b of st.boards) {
      expect(b.number).toBe(-1);
      expect(b.board.bases).toEqual([{ ply: 0, fen: PHASE2_WIN_FEN }]);
    }
    for (let id = 0; id < 4; id++) st = phase2Move(st, id, "h5f7", T0 + 1000);
    expect(st.boards.every((b) => b.result?.winner === "crowd" && b.result.how === "mate")).toBe(true);
    expect(phase2Outcome(st).beaten).toBe(true);
  });

  it("a mate by him wins him the board", () => {
    // Fool's mate from the normal setup, written as Chess960: 1.f3 e5 2.g4 Qh4#.
    let st: Phase2State = start([518, 1, 2, 3]);
    st = phase2Move(st, 0, "f2f3", T0 + 1);
    st = phase2Move(st, 0, "e7e5", T0 + 2);
    st = phase2Move(st, 0, "g2g4", T0 + 3);
    st = phase2Move(st, 0, "d8h4", T0 + 4);
    expect(st.boards[0]!.result).toEqual({ winner: "boss", how: "mate" });
    expect(st.boards[0]!.turnAt).toBeNull();
  });

  it("his next board: yours first when it's waiting, then the one that has waited longest", () => {
    let st = start([518, 1, 2, 3]);
    for (const id of [2, 0, 1]) st = phase2Move(st, id, legalMoves(st.boards[id]!.board.fen).sort()[0]!, T0 + 100);
    expect(phase2Next(st, [2, 0, 1], "you")).toBe(0);
    expect(phase2Next(st, [2, 1], "you")).toBe(2);
    expect(phase2Next(st, [3], "you")).toBeNull();
  });
});

describe("his phase 2 ultimate: slow moves, then a few seconds a move, a random move when they run out", () => {
  const SLOW = RECLUSE_PHASE2.slowMoveSeconds * 1000;
  /** Board 0 moves, then he answers at once: one move each, the player's taking `ms`. */
  const round = (st: Phase2State, id: number, ms: number, at: number): { st: Phase2State; at: number } => {
    const b = st.boards[id]!;
    const t = (b.turnAt ?? at) + ms;
    let next = phase2Move(st, id, [...legalMoves(b.board.fen)].sort()[0]!, t);
    next = phase2Move(next, id, [...legalMoves(next.boards[id]!.board.fen)].sort()[0]!, t);
    return { st: next, at: t };
  };

  it("counts a move longer than slowMoveSeconds (anyone's, any board) as slow; a quick one doesn't count", () => {
    let st = start([518, 1, 2, 3]);
    let r = round(st, 0, SLOW, T0);
    expect(r.st.slow).toBe(0);
    r = round(r.st, 0, SLOW + 1, r.at);
    expect(r.st.slow).toBe(1);
    st = phase2Move(r.st, 2, [...legalMoves(r.st.boards[2]!.board.fen)].sort()[0]!, T0 + 60_000);
    expect(st.slow).toBe(2);
  });

  it("fires on the slow move after slowMovesForUlt: from then on, no slow moves count and no flag falls", () => {
    let st = start([518, 1, 2, 3]);
    let at = T0;
    for (let i = 0; i < RECLUSE_PHASE2.slowMovesForUlt; i++) ({ st, at } = round(st, 0, SLOW + 100, at));
    expect(st.slow).toBe(RECLUSE_PHASE2.slowMovesForUlt);
    expect(st.ultAt).toBeNull();
    ({ st, at } = round(st, 0, SLOW + 100, at));
    expect(st.ultAt).not.toBeNull();
    const ultAt = st.ultAt!;
    // Every player whose move it is starts their few seconds as it comes.
    for (const b of st.boards.slice(1)) expect(b.turnAt).toBe(ultAt);
    ({ st } = round(st, 0, SLOW + 100, at));
    expect(st.slow).toBe(RECLUSE_PHASE2.slowMovesForUlt + 1);
    expect(phase2Flags(st, ultAt + 10 * 60_000)).toBe(st);
  });

  it("then each move has ultMoveSeconds, no bank; out of them, a random legal move is played for that player (never a loss)", () => {
    const st = phase2Ult(start([518, 1, 2, 3]), T0 + 1000);
    expect(phase2Ult(st, T0 + 2000)).toBe(st);
    const b = st.boards[0]!;
    expect(moveLeft(st, b, T0 + 3000)).toBe(RECLUSE_PHASE2.ultMoveSeconds * 1000 - 2000);
    expect(phase2Timeouts(st, T0 + 1000 + RECLUSE_PHASE2.ultMoveSeconds * 1000 - 1, () => 0)).toBe(st);
    const out = phase2Timeouts(st, T0 + 1000 + RECLUSE_PHASE2.ultMoveSeconds * 1000, () => 0.5);
    for (const x of out.boards) {
      expect(x.result).toBeNull();
      expect(x.board.history).toHaveLength(1);
      expect(legalMoves(x.board.fen === b.board.fen ? b.board.fen : st.boards[x.id]!.board.fen)).toContain(x.board.history[0]);
      expect(phase2ToMove(x)).toBe("boss");
    }
    // (The rng picks it: the same rng, the same move.)
    const legal = legalMoves(b.board.fen);
    expect(out.boards[0]!.board.history[0]).toBe(legal[Math.floor(0.5 * legal.length)]);
    // A move made in time is played as usual; the bank isn't touched.
    const mine = phase2Move(st, 0, "e2e4", T0 + 3000);
    expect(mine.boards[0]!.bankMs).toBe(b.bankMs);
  });
});

describe("his phase 2 brain: Stockfish only, at a fixed strength", () => {
  it("is Stockfish at RECLUSE_PHASE2's strength, whatever phase 1's fixed brain (Maia) says", () => {
    expect(BOSS_BRAIN.fixed.recluse).toBe("maia-raw");
    expect(phase2Brain()).toEqual({ brain: "stockfish", elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs });
    expect(RECLUSE_PHASE2.elo).toBe(2750);
  });

  it("asks the engine for a move at that strength, within its node and time budget (UCI_Chess960 on)", async () => {
    const listeners: ((line: string) => void)[] = [];
    const sent: string[] = [];
    const say = (l: string) => queueMicrotask(() => listeners.forEach((f) => f(l)));
    const t: UciTransport = {
      send(c) {
        sent.push(c);
        if (c === "isready") say("readyok");
        if (c.startsWith("go")) say("bestmove g1h1");
      },
      onLine: (l) => listeners.push(l),
      close: () => undefined,
    };
    const engine = new UciEngine(t, { nodes: 1000, hashMb: 16 });
    const fen = chess960Fen(0);
    expect(await phase2BossMove(engine, fen)).toBe("g1h1");
    expect(sent).toContain(`setoption name UCI_Elo value ${RECLUSE_PHASE2.elo}`);
    expect(sent).toContain("setoption name UCI_Chess960 value true");
    expect(sent).toContain(`go nodes ${RECLUSE_PHASE2.nodes} movetime ${RECLUSE_PHASE2.moveMs}`);
  });

  describe("with real Stockfish", () => {
    let engine: UciEngine;
    beforeAll(async () => {
      engine = await createNodeEngine({ nodes: 20_000, hashMb: 16 });
    }, 30_000);
    afterAll(() => engine.close());

    it("plays a legal move on every phase 2 board, within his time a move", async () => {
      let st = start(phase2Numbers(11));
      for (const b of st.boards) st = phase2Move(st, b.id, legalMoves(b.board.fen).sort()[0]!, T0 + 10);
      for (const b of st.boards) {
        const t0 = performance.now();
        const m = await phase2BossMove(engine, b.board.fen, { ...RECLUSE_PHASE2, nodes: 50_000 });
        expect(performance.now() - t0).toBeLessThan(RECLUSE_PHASE2.moveMs + 1500);
        expect(legalMoves(b.board.fen)).toContain(m);
        const next = phase2Move(st, b.id, m, T0 + 20);
        expect(next.boards[b.id]!.board.history).toHaveLength(2);
        st = next;
      }
    }, 60_000);
  });
});
