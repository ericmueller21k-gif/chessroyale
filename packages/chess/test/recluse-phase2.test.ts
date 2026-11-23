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
  phase2Clock,
  phase2Move,
  phase2Next,
  phase2NextDue,
  phase2Numbers,
  phase2Outcome,
  phase2Resign,
  phase2Seat,
  phase2Slash,
  phase2Standings,
  phase2WinAll,
  phase2ToMove,
  slashDue,
  slowJudgeMs,
  recentMoves,
  startPhase2,
  type NetStanding,
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
    const st: Phase2State = { boards: [{ ...b0, board: { ...b0.board, fen: ready, bases: [{ ply: 0, fen: ready }] } }] };
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

  it("out of time loses that board: a late move isn't played, and the clock's check catches a bank run out", () => {
    const bank = RECLUSE_PHASE2.bankSeconds * 1000;
    let st = start([518, 1, 2, 3]);
    const late = phase2Move(st, 0, "e2e4", T0 + bank + 1);
    expect(late.boards[0]!.result).toEqual({ winner: "boss", how: "time" });
    expect(late.boards[0]!.board.history).toEqual([]);
    expect(phase2Clock(st, T0 + bank - 1).boards.every((b) => b.result === null)).toBe(true);
    // Board 0 moves in time; the others run out together.
    st = phase2Move(st, 0, "e2e4", T0 + 1000);
    const flagged = phase2Clock(st, T0 + bank);
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

describe("each player's own hearts (Eric, Nov 16): a slow move cuts one; out of hearts, that board is lost", () => {
  const JUDGE = slowJudgeMs();
  /** Eight quiet moves a side from the normal setup (number 518), so nothing ends the board early. */
  const OURS = ["e2e4", "g1f3", "f1c4", "d2d3", "b1c3", "h2h3", "a2a3", "b2b4"];
  const HIS = ["e7e5", "b8c6", "f8c5", "d7d6", "g8f6", "h7h6", "a7a6", "c5b6"];
  /** A board's move by its player `ms` into their turn, then his answer at once (on board 518, the scripted ones). */
  const round = (st: Phase2State, id: number, ms: number): Phase2State => {
    const b = st.boards[id]!;
    const t = b.turnAt! + ms;
    const k = b.board.history.length / 2;
    const ours = b.number === 518 ? OURS[k]! : [...legalMoves(b.board.fen)].sort()[0]!;
    const next = phase2Move(st, id, ours, t);
    if (next.boards[id]!.result) return next;
    return phase2Move(next, id, b.number === 518 ? HIS[k]! : [...legalMoves(next.boards[id]!.board.fen)].sort()[0]!, t);
  };

  it("every player's clock is 10 minutes with no increment, and 8 hearts each; a move is slow past 5 s, judged at 6.5 s (the hidden allowance for lag)", () => {
    expect(RECLUSE_PHASE2.bankSeconds).toBe(600);
    expect(RECLUSE_PHASE2.hearts).toBe(8);
    expect(RECLUSE_PHASE2.slowMoveSeconds).toBe(5);
    expect(JUDGE).toBe(6500);
    const st = start([518, 1, 2, 3]);
    for (const b of st.boards) expect(b).toMatchObject({ bankMs: 600_000, hearts: 8, slashed: false, slashAt: null });
    // (A move in time adds nothing to the bank.)
    expect(round(st, 0, 1000).boards[0]!.bankMs).toBe(599_000);
  });

  it("a move by 6.5 s keeps its hearts; one at 6.5 s (5 s told plus the allowance) or later has one of that player's cut, and only theirs", () => {
    const st = start([518, 1, 2, 3]);
    expect(round(st, 0, JUDGE - 1).boards[0]!.hearts).toBe(8);
    const slow = round(st, 2, JUDGE);
    expect(slow.boards.map((b) => b.hearts)).toEqual([8, 8, 7, 8]);
    expect(slow.boards[2]!.slashAt).toBe(T0 + JUDGE);
    // (The move itself is played: a slow move isn't a lost one.)
    expect(slow.boards[2]!.board.history).toHaveLength(2);
  });

  it("the cut comes as the move turns slow (the clock's check, at that moment, however late it's noticed), once a move; then they may take as long as they need: nothing is played for them", () => {
    const st = start([518, 1, 2, 3]);
    expect(phase2Clock(st, T0 + JUDGE - 1)).toBe(st);
    const cut = phase2Clock(st, T0 + 20_000);
    for (const b of cut.boards) expect(b).toMatchObject({ hearts: 7, slashed: true, slashAt: T0 + JUDGE, turnAt: T0, result: null });
    for (const b of cut.boards) expect(b.board.history).toEqual([]);
    // (No second cut on the same move, however long it takes.)
    expect(phase2Clock(cut, T0 + 90_000)).toBe(cut);
    // Their move a minute and a half in: played, their clock charged, still 7 hearts.
    const moved = phase2Move(cut, 0, "e2e4", T0 + 90_000);
    expect(moved.boards[0]).toMatchObject({ hearts: 7, bankMs: 600_000 - 90_000, turnAt: null, result: null });
    // His answer starts a new move to judge.
    const next = phase2Move(moved, 0, "e7e5", T0 + 91_000);
    expect(next.boards[0]).toMatchObject({ slashed: false, turnAt: T0 + 91_000 });
    expect(slashDue(next.boards[0]!)).toBe(T0 + 91_000 + JUDGE);
    expect(phase2Clock(next, T0 + 91_000 + JUDGE).boards[0]!.hearts).toBe(6);
  });

  it("a move that arrives late has its heart cut first, at the moment it turned slow, then is played", () => {
    const st = start([518, 1, 2, 3]);
    const late = phase2Move(st, 1, [...legalMoves(st.boards[1]!.board.fen)].sort()[0]!, T0 + 12_000);
    expect(late.boards[1]).toMatchObject({ hearts: 7, slashAt: T0 + JUDGE, turnAt: null, result: null });
    expect(late.boards[1]!.board.history).toHaveLength(1);
  });

  it("the 8th slow move loses that board (\"slow\"): its move isn't played, its clock stops; the other boards play on", () => {
    let st = start([518, 1, 2, 3]);
    for (let i = 0; i < 7; i++) st = round(st, 0, JUDGE + 100);
    expect(st.boards[0]!.hearts).toBe(1);
    expect(st.boards[0]!.result).toBeNull();
    const ply = st.boards[0]!.board.history.length;
    const at = st.boards[0]!.turnAt!;
    const lost = round(st, 0, JUDGE + 100);
    expect(lost.boards[0]).toMatchObject({ hearts: 0, slashAt: at + JUDGE, turnAt: null, result: { winner: "boss", how: "slow" } });
    expect(lost.boards[0]!.board.history).toHaveLength(ply);
    expect(lost.boards[0]!.bankMs).toBe(st.boards[0]!.bankMs - JUDGE);
    expect(lost.boards.slice(1).every((b) => b.result === null && b.hearts === 8)).toBe(true);
    expect(phase2Outcome(lost)).toMatchObject({ lost: 1, decided: false });
    // (By the clock alone, the same: the last heart cut as the move turns slow.)
    expect(phase2Clock(st, at + JUDGE).boards[0]!.result).toEqual({ winner: "boss", how: "slow" });
    expect(phase2Seat(lost.boards[0]!.result)).toBe("lost");
  });

  it("a bank that runs out before the move turns slow loses on time, no heart cut", () => {
    const st = withBoards(start([518, 1, 2, 3]), (id) => (id === 0 ? { bankMs: 3000 } : {}));
    const out = phase2Clock(st, T0 + 7000);
    expect(out.boards[0]).toMatchObject({ hearts: 8, result: { winner: "boss", how: "time" } });
    expect(phase2NextDue(st)).toBe(T0 + 3000);
  });

  it("the next moment the clocks need looking at: the first move turning slow or bank running out; none while nobody's clock runs", () => {
    const st = start([518, 1, 2, 3]);
    expect(phase2NextDue(st)).toBe(T0 + JUDGE);
    const cut = phase2Clock(st, T0 + JUDGE);
    expect(phase2NextDue(cut)).toBe(T0 + 600_000);
    expect(phase2NextDue(phase2WinAll(st, T0 + 1))).toBeNull();
  });

  it("only the boards `judged` says (people's) are in the automatic cut: a bot's move arriving late keeps its heart, its bank charged as it ran; phase2Slash cuts a bot's slow think (the review of #744, M1)", () => {
    const st = start([518, 1, 2, 3]);
    const people = (player: string) => player === PLAYERS[0];
    const clocked = phase2Clock(st, T0 + 20_000, people);
    expect(clocked.boards.map((b) => b.hearts)).toEqual([7, 8, 8, 8]);
    expect(phase2NextDue(clocked, people)).toBe(T0 + 600_000);
    expect(phase2NextDue(st, people)).toBe(T0 + JUDGE);
    expect(phase2NextDue(withBoards(st, (id) => (id === 0 ? { turnAt: null } : {})), people)).toBe(T0 + 600_000);
    const late = phase2Move(st, 1, [...legalMoves(st.boards[1]!.board.fen)].sort()[0]!, T0 + 12_000, people);
    expect(late.boards[1]).toMatchObject({ hearts: 8, slashed: false, slashAt: null, bankMs: 600_000 - 12_000, result: null });
    expect(late.boards[1]!.board.history).toHaveLength(1);
    expect(phase2Slash(st, 2, T0 + 7000).boards[2]).toMatchObject({ hearts: 7, slashAt: T0 + 7000, result: null });
  });

  it("testing (the admins' trigger): a heart cut now on that board, on its player's move only", () => {
    const st = start([518, 1, 2, 3]);
    const cut = phase2Slash(st, 0, T0 + 1000);
    expect(cut.boards.map((b) => b.hearts)).toEqual([7, 8, 8, 8]);
    expect(cut.boards[0]!.slashAt).toBe(T0 + 1000);
    // (Its move is slashed: the same move isn't cut again when it turns slow.)
    expect(phase2Clock(cut, T0 + 20_000).boards[0]!.hearts).toBe(7);
    const his = phase2Move(st, 0, "e2e4", T0 + 1000);
    expect(phase2Slash(his, 0, T0 + 1500)).toBe(his);
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

describe("testing (admins, Nov 13): \"Win this form\" in phase 2 wins every board still on", () => {
  it("each undecided board won for the players, its clock stopped where it stands; decided boards kept; nothing left: the same state", () => {
    const st = withBoards(start(), (id) => (id === 2 ? { result: { winner: "boss", how: "time" }, turnAt: null, bankMs: 0 } : {}));
    const won = phase2WinAll(st, T0 + 5000);
    expect(won.boards.map((b) => b.result?.winner)).toEqual(["crowd", "crowd", "boss", "crowd"]);
    for (const b of won.boards) expect(b.turnAt).toBeNull();
    expect(won.boards[0]!.bankMs).toBe(bankLeft(st.boards[0]!, T0 + 5000));
    expect(phase2Outcome(won)).toMatchObject({ decided: true, won: 3 });
    expect(phase2Outcome(phase2WinAll(start(), T0))).toMatchObject({ decided: true, beaten: true });
    expect(phase2WinAll(won, T0)).toBe(won);
  });
});

describe("the scoreboard from his fall until the results (Eric's playtest, Nov 14: every row read \"out\", a phone's Players tab empty)", () => {
  // (Phase 1's end placed everyone (core finishBoss): the four who fought him 1 to 4, out, beside those knocked out before.)
  const row = (id: string, placement: number, points: number): NetStanding => ({ id, name: id, points, stageScore: points, avg: 0, bankMs: 60_000, avgThinkMs: 0, rating: null, powerUps: 0, powerUpsUsed: 0, practice: false, isBot: id.startsWith("bot"), out: true, placement });
  const placed = [row("bot2", 1, 3.5), row("you", 2, 2.25), row("bot1", 3, 1), row("bot3", 4, -0.5), row("cut1", 5, 0), row("cut2", 6, -1)];

  it("those on his boards are in, playing, with phase 1's points, first in the order they stood; everyone else as they were; the placements untouched", () => {
    const shown = phase2Standings(placed, start().boards);
    expect(shown.map((s) => [s.id, s.out, s.board])).toEqual([
      ["bot2", false, "playing"],
      ["you", false, "playing"],
      ["bot1", false, "playing"],
      ["bot3", false, "playing"],
      ["cut1", true, undefined],
      ["cut2", true, undefined],
    ]);
    // (Points, placements and every other number as phase 1 left them: what's stored and rewarded comes from those.)
    expect(shown.map(({ out: _o, board: _b, ...r }) => r)).toEqual(placed.map(({ out: _o, ...r }) => r));
    expect(placed.every((r) => r.out)).toBe(true);
    // (Before the boards are set up, his fall's word on who takes them: all playing.)
    expect(phase2Standings(placed, PLAYERS.map((player) => ({ player }))).filter((s) => !s.out)).toHaveLength(4);
  });

  it("each board's state as it ends: won, lost, drawn; someone who left (their board a bot's under a new id) shows out; a fresh bot has no row", () => {
    const edits: Partial<Phase2State["boards"][number]>[] = [{ result: { winner: "crowd", how: "mate" } }, { result: { winner: "boss", how: "time" } }, { result: { winner: "draw", how: "stalemate" } }, { player: "rb9" }];
    const st = withBoards(start(), (id) => edits[id]!);
    const shown = phase2Standings(placed, st.boards);
    // (Boards 0 to 3: you won, bot1 lost, bot2 drew, bot3 left (a bot plays it). The rows keep phase 1's order.)
    expect(shown.map((s) => [s.id, s.out, s.board ?? null])).toEqual([
      ["bot2", false, "drawn"],
      ["you", false, "won"],
      ["bot1", false, "lost"],
      ["bot3", true, null],
      ["cut1", true, null],
      ["cut2", true, null],
    ]);
    expect(shown.find((s) => s.id === "bot3")!.placement).toBe(4);
    expect(shown.some((s) => s.id === "rb9")).toBe(false);
    expect([null, { winner: "crowd", how: "resign" }, { winner: "boss", how: "resign" }, { winner: "draw", how: "draw" }].map((r) => phase2Seat(r as never))).toEqual(["playing", "won", "lost", "drawn"]);
  });
});
