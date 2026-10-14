import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { RECLUSE, RECLUSE_BOOK } from "./characters/recluse.ts";
import { animLength, cueAt } from "./characters/power-art.ts";
import {
  legalMoves,
  phase2BossMove,
  phase2Flags,
  phase2Move,
  phase2Next,
  phase2Outcome,
  phase2Resign,
  phase2ToMove,
  startPhase2,
  type MoveScore,
  type Phase2Board,
  type Phase2Engine,
  type Phase2State,
} from "@chessroyale/chess";

/**
 * The phase change (ms from its start; components/RecluseChange.tsx draws it), about 7 s, all on one square stage: the
 * red book flies from him to the board's center and slams onto it (dust, a ring, the board jolts); crack lines run down
 * and across the middle (Sawyer's board-saw gap, once each way); the four quarters part and each grows into a whole
 * board (a 2x2 of boards); the book, lying where it fell, flips its pages while every board's pieces fly to their
 * Chess960 squares, then snaps shut and goes back to him: his revive's catch comes as it goes (he started rising before);
 * then "PHASE 2" and the clocks start.
 */
export const PHASE_CHANGE = (() => {
  const revive = RECLUSE.anims.revive!;
  const reviveMs = animLength(revive);
  const catchAt = cueAt(revive, "catch") ?? reviveMs;
  const flyMs = 650;
  const slamAt = flyMs;
  const slamMs = animLength(RECLUSE_BOOK.anims.slam!);
  const crackAt = slamAt + 500;
  const partAt = crackAt + 750;
  const growAt = partAt + 400;
  const growMs = 900;
  const flipAt = growAt + growMs + 100;
  const shuffleAt = flipAt + 200;
  const shuffleMs = 900;
  const closeAt = shuffleAt + shuffleMs + 100;
  const bookGoneAt = closeAt + animLength(RECLUSE_BOOK.anims.close!);
  const reviveAt = bookGoneAt - catchAt;
  const bannerAt = Math.max(reviveAt + reviveMs, bookGoneAt) + 100;
  const bannerMs = 1400;
  return { flyMs, slamAt, slamMs, crackAt, partAt, growAt, growMs, flipAt, shuffleAt, shuffleMs, closeAt, bookGoneAt, reviveAt, bannerAt, bannerMs, total: bannerAt + bannerMs };
})();

/** What the bots' engine must do: play at a strength (UciEngine), or its best (the test switch, ?win=1). */
export interface Phase2BotEngine extends Phase2Engine {
  topMoves(fen: string, n: number): Promise<MoveScore[]>;
}

/**
 * The Hidden Boss's phase 2 on this device (Boss alone; its rules: packages/chess/src/bosses/recluse-phase2.ts): four
 * boards at once, you on board 0, bots on the rest. One engine plays him on every board in turn (`boss`: your board
 * first when it's waiting, then the board that has waited longest); the bots think on their own clocks (`bots`; the same
 * engine when the device has one only). Every clock is checked five times a second; a board ends by mate, a draw, time
 * or resigning; the battle ends when every board is decided (`onDone`).
 */
export class Phase2Game {
  state: Phase2State;
  /** Boards where it's his move, in the order they came. */
  private waiting: number[] = [];
  private thinking = false;
  private stopped = false;
  private tick: ReturnType<typeof setInterval> | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  /** What his engine is on now (the admins' line): the board and how long his last move took. */
  lastMs: number | null = null;

  constructor(
    private readonly opts: {
      players: readonly string[];
      numbers: readonly number[];
      human: string;
      boss: Phase2Engine;
      bots: Phase2BotEngine;
      /** The test switch (?win=1): every board from a mate in one, and the bots play their best. */
      win?: boolean;
      rng?: () => number;
      onChange: () => void;
      /** A board has just been decided (its result is set). */
      onResult: (b: Phase2Board) => void;
      onDone: () => void;
    },
  ) {
    this.state = startPhase2({ players: opts.players, numbers: opts.numbers, now: Date.now(), win: opts.win });
  }

  /** Play begins: every player's clock is running (they're White); the bots start thinking. */
  start() {
    this.state = startPhase2({ players: this.opts.players, numbers: this.opts.numbers, now: Date.now(), win: this.opts.win });
    for (const b of this.state.boards) if (b.player !== this.opts.human) this.botTurn(b.id);
    this.tick = setInterval(() => this.update(phase2Flags(this.state, Date.now())), 200);
    this.opts.onChange();
  }

  stop() {
    this.stopped = true;
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  get outcome() {
    return phase2Outcome(this.state);
  }

  board(id: number): Phase2Board | null {
    return this.state.boards.find((b) => b.id === id) ?? null;
  }

  /** Your move on your board (ignored unless it's yours to make and legal). */
  move(boardId: number, move: string) {
    const b = this.board(boardId);
    if (!b || b.player !== this.opts.human || phase2ToMove(b) !== "crowd") return;
    this.update(phase2Move(this.state, boardId, move, Date.now()));
  }

  /** You resign your board: it's lost; the others play on. */
  resign(boardId: number) {
    this.update(phase2Resign(this.state, boardId, Date.now()));
  }

  private update(next: Phase2State) {
    if (this.stopped || next === this.state) return;
    const before = this.state;
    this.state = next;
    for (const b of next.boards) {
      const was = before.boards.find((x) => x.id === b.id)!;
      if (was === b) continue;
      if (b.result && !was.result) this.opts.onResult(b);
      const who = phase2ToMove(b);
      if (who === "boss" && !this.waiting.includes(b.id)) this.waiting.push(b.id);
      if (who === "crowd" && b.player !== this.opts.human && b.board.history.length !== was.board.history.length) this.botTurn(b.id);
    }
    this.pump();
    this.opts.onChange();
    if (phase2Outcome(next).decided) {
      this.stop();
      this.opts.onDone();
    }
  }

  /** His next move, one board at a time on his one engine. No answer from it: the first legal move (never a stall). */
  private pump() {
    if (this.thinking || this.stopped) return;
    const id = phase2Next(this.state, this.waiting, this.opts.human);
    this.waiting = this.waiting.filter((x) => {
      const b = this.board(x);
      return x !== id && !!b && phase2ToMove(b) === "boss";
    });
    if (id === null) return;
    const fen = this.board(id)!.board.fen;
    this.thinking = true;
    const t0 = performance.now();
    void phase2BossMove(this.opts.boss, fen)
      .catch(() => legalMoves(fen)[0]!)
      .then((move) => {
        this.thinking = false;
        this.lastMs = performance.now() - t0;
        if (this.stopped) return;
        if (this.board(id)?.board.fen === fen) this.update(phase2Move(this.state, id, move, Date.now()));
        this.pump();
      });
  }

  /** A bot's move: it thinks a bullet player's while (its clock running), then plays. Late, its board is lost on time. */
  private botTurn(id: number) {
    const fen = this.board(id)!.board.fen;
    const [lo, hi] = RECLUSE_PHASE2.botMoveMs;
    const think = lo + (this.opts.rng ?? Math.random)() * (hi - lo);
    const engine = this.opts.bots;
    const search = this.opts.win
      ? engine.topMoves(fen, 1).then((t) => t[0]?.move ?? legalMoves(fen)[0]!)
      : engine.playAtElo(fen, RECLUSE_PHASE2.botElo, RECLUSE_PHASE2.botNodes, think);
    const wait = new Promise<void>((r) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        r();
      }, this.opts.win ? 300 : think);
      this.timers.add(t);
    });
    void Promise.all([search.catch(() => legalMoves(fen)[0]!), wait]).then(([move]) => {
      if (this.stopped || this.board(id)?.board.fen !== fen) return;
      this.update(phase2Move(this.state, id, move, Date.now()));
    });
  }
}
