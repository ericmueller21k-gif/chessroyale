import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { RECLUSE, RECLUSE_JUMP } from "./characters/recluse.ts";
import { RECLUSE_LINES } from "./characters/recluse-lines.ts";
import { animLength, cueAt } from "./characters/power-art.ts";
import {
  legalMoves,
  phase2BossMove,
  phase2Flags,
  phase2Move,
  phase2Next,
  phase2Outcome,
  phase2Resign,
  phase2Timeouts,
  phase2ToMove,
  phase2Ult,
  startPhase2,
  type MoveScore,
  type Phase2Board,
  type Phase2Engine,
  type Phase2State,
} from "@chessroyale/chess";

/**
 * The phase change (Eric, Oct 14), ms from its start (screens/Recluse2.tsx draws it), about 10.5 s after a short fall
 * (`fallMs`: phase 1 beaten, the board holds while he collapses and starts to mumble), all on one square stage:
 * - where he stands, he gets up in a rage (`rage`: the book flies back into his hand);
 * - he leaps from there onto the middle of the board (the board draws his whole figure, on a phone too), landing with a
 *   thud and a burst of dust (the board jolts);
 * - he brandishes the book over his head and throws it down at his feet, where it lands open;
 * - light pours up out of it while he chants over it, arms raised, his hair lifting (phase 2's face from here), his
 *   chant in his bubble;
 * - the boards crack (Sawyer's board-saw gap, down and across the middle) and the quarters part, each growing into a
 *   whole board at its corner, as the light dies;
 * - the book snaps shut and flies up into his hands (his revive's own frames) while every board's pieces fly to their
 *   Chess960 squares; he leaps back to his place, in phase 2's idle from then on;
 * - "PHASE 2", and the clocks start.
 * One book on screen throughout: his own, in his frames.
 */
export const PHASE_CHANGE = (() => {
  const a = RECLUSE.anims;
  const len = (n: string) => animLength(a[n]!);
  const fallMs = 1800;
  const rageMs = len("rage");
  // (The board's figure takes over where he stood as the leap's crouch begins: his place is empty until he's back.)
  const leapAt = rageMs;
  const upAt = leapAt + RECLUSE_JUMP.upAt;
  const landAt = leapAt + RECLUSE_JUMP.landAt;
  const dropAt = leapAt + len("leap");
  const thudAt = dropAt + (cueAt(a.drop!, "thud") ?? 0);
  const chantAt = dropAt + len("drop");
  const lightMs = 500;
  const crackAt = chantAt + 1700;
  const partAt = crackAt + 750;
  const growAt = partAt + 400;
  const growMs = 900;
  const pickupAt = growAt + growMs + 100;
  const catchAt = pickupAt + (cueAt(a.pickup!, "catch") ?? 0);
  const shuffleAt = pickupAt + 150;
  const shuffleMs = 900;
  const backAt = pickupAt + len("pickup");
  const homeAt = backAt + len("leap2");
  const bannerAt = Math.max(homeAt, shuffleAt + shuffleMs) + 100;
  const bannerMs = 1400;
  return { fallMs, rageMs, leapAt, upAt, landAt, dropAt, thudAt, chantAt, lightMs, crackAt, partAt, growAt, growMs, pickupAt, catchAt, shuffleAt, shuffleMs, backAt, homeAt, bannerAt, bannerMs, total: bannerAt + bannerMs };
})();

/** Which stage of his collusion lines phase 2 has reached, by his moves so far on all the boards. */
export function talkStage(moves: number): "early" | "middle" | "late" {
  return moves >= RECLUSE_PHASE2.talkLateFrom ? "late" : moves >= RECLUSE_PHASE2.talkMiddleFrom ? "middle" : "early";
}

/**
 * His collusion lines in phase 2 (RECLUSE_LINES.collusion): after every few of his moves (`talkEvery`, give or take
 * `talkJitter`), a line of the stage the fight has reached, each stage's in turn. The lowest priority of his lines: if
 * anything is being said (a slow-move line, his ultimate's, a board's), this one is skipped, not queued, and the next
 * comes after the next few moves.
 */
export class Talk {
  private next: number;
  private said = { early: 0, middle: 0, late: 0 };
  constructor(private readonly rng: () => number) {
    this.next = this.after(0);
  }
  private after(n: number) {
    const { talkEvery, talkJitter } = RECLUSE_PHASE2;
    return n + talkEvery - talkJitter + Math.floor(this.rng() * (2 * talkJitter + 1));
  }
  /** After his `moves`-th move: the line he says now, or null (not due yet, or something else is being said: `busy`). */
  lineAfter(moves: number, busy: boolean): string | null {
    if (moves < this.next) return null;
    this.next = this.after(moves);
    if (busy) return null;
    const stage = talkStage(moves);
    const lines = RECLUSE_LINES.collusion[stage];
    return lines[this.said[stage]++ % lines.length]!;
  }
}

/** His ultimate where he stands (playInPlace): the spellbook opened, held, slammed shut. */
export const PHASE2_ULT_ANIMS = ["spellbook2", "spellLoop2", "spellClose2"] as const;
/** "5 SECONDS!" shows this long as his ultimate comes (ms): a second longer than usual (Eric, Oct 14; FightBanner `long`). */
export const PHASE2_ULT_BANNER_MS = 2800;

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
  /** His moves so far, on all the boards. */
  bossMoves = 0;

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
      /**
       * A slow move (anyone's) before his ultimate: on which board, and whether it was the one that brought his ultimate;
       * then his ultimate as it comes.
       */
      onSlow?: (boardId: number, ult: boolean) => void;
      onUlt?: () => void;
      /** His move played on a board: how many he has made so far on all of them. */
      onBossMove?: (moves: number) => void;
      onDone: () => void;
    },
  ) {
    this.state = startPhase2({ players: opts.players, numbers: opts.numbers, now: Date.now(), win: opts.win });
  }

  /** Play begins: every player's clock is running (they're White); the bots start thinking. */
  start() {
    this.state = startPhase2({ players: this.opts.players, numbers: this.opts.numbers, now: Date.now(), win: this.opts.win });
    for (const b of this.state.boards) if (b.player !== this.opts.human) this.botTurn(b.id);
    // (Before his ultimate a bank that runs out loses the board; after it, a move out of time is played at random.)
    this.tick = setInterval(() => {
      const now = Date.now();
      this.update(phase2Timeouts(phase2Flags(this.state, now), now, this.opts.rng ?? Math.random));
    }, 200);
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

  /** Testing (admins): his ultimate now. */
  ult() {
    this.update(phase2Ult(this.state, Date.now()));
  }

  /** You resign your board: it's lost; the others play on. */
  resign(boardId: number) {
    this.update(phase2Resign(this.state, boardId, Date.now()));
  }

  private update(next: Phase2State) {
    if (this.stopped || next === this.state) return;
    const before = this.state;
    this.state = next;
    const ult = next.ultAt !== null && before.ultAt === null;
    if (next.slow > before.slow) {
      // (One move at a time changes the state: the board whose history grew.)
      const slowOn = next.boards.find((b, i) => b.board.history.length > before.boards[i]!.board.history.length);
      if (slowOn) this.opts.onSlow?.(slowOn.id, ult);
    }
    if (ult) this.opts.onUlt?.();
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
        if (this.board(id)?.board.fen === fen) {
          const before = this.state;
          this.update(phase2Move(this.state, id, move, Date.now()));
          if (this.state !== before && !this.stopped) this.opts.onBossMove?.(++this.bossMoves);
        }
        this.pump();
      });
  }

  /** A bot's move: it thinks a bullet player's while (its clock running), then plays. Late, its board is lost on time. */
  private botTurn(id: number) {
    const fen = this.board(id)!.board.fen;
    const rng = this.opts.rng ?? Math.random;
    // (Now and then a slow one before his ultimate, so his count comes from the bots too.)
    const slow = this.state.ultAt === null && !this.opts.win && rng() < RECLUSE_PHASE2.botSlowChance;
    const [lo, hi] = slow ? RECLUSE_PHASE2.botSlowMs : RECLUSE_PHASE2.botMoveMs;
    const think = lo + rng() * (hi - lo);
    const engine = this.opts.bots;
    const search = this.opts.win
      ? engine.topMoves(fen, 1).then((t) => t[0]?.move ?? legalMoves(fen)[0]!)
      : // (A slow one only waits longer: its search keeps the usual budget, so a shared engine isn't held up.)
        engine.playAtElo(fen, RECLUSE_PHASE2.botElo, RECLUSE_PHASE2.botNodes, Math.min(think, RECLUSE_PHASE2.botMoveMs[1]));
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
