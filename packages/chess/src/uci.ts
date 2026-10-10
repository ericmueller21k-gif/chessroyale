/**
 * Stockfish over the standard UCI text protocol. The transport (a Node child
 * process or a browser Web Worker) is pluggable, so the same code and the same
 * fixed budget give the same numbers everywhere.
 */

import { applyMove, gameEnd } from "./rules.ts";

export interface UciTransport {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
  close(): void;
}

export interface EngineOptions {
  /** Fixed search budget per position. */
  nodes: number;
  hashMb: number;
}

export interface MoveScore {
  move: string;
  /** Mover's expected score after this move, 0 to 1. */
  expected: number;
  /**
   * The opponent's best reply, from the same search (the line's second move; the God King's Last Stand names what
   * a blunder loses with it). Missing when the line is cut short or the game ends.
   */
  reply?: string;
  /** A forced mate in the line, in moves: positive if the mover mates, negative if the mover gets mated. */
  mate?: number;
}

export interface Analysis {
  /** Engine's best move and the mover's expected score after it. */
  best: MoveScore;
  /** Scores for every move analysed (top N plus any requested), best first. */
  moves: MoveScore[];
}

/** Expected score from Stockfish's win/draw/loss output (per mille): win + half the draws. */
export function expectedFromWdl(win: number, draw: number, loss: number): number {
  const total = win + draw + loss || 1000;
  return (win + draw / 2) / total;
}

interface InfoLine {
  multipv: number;
  move: string;
  expected: number;
  reply?: string;
  mate?: number;
}

export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith("info ") || !line.includes(" wdl ") || !line.includes(" pv ")) return null;
  if (line.includes(" lowerbound") || line.includes(" upperbound")) return null;
  const wdl = line.match(/ wdl (\d+) (\d+) (\d+)/);
  const pv = line.match(/ pv (\S+)(?: (\S+))?/);
  const mpv = line.match(/ multipv (\d+)/);
  const mate = line.match(/ score mate (-?\d+)/);
  if (!wdl || !pv) return null;
  return {
    multipv: mpv ? Number(mpv[1]) : 1,
    move: pv[1]!,
    expected: expectedFromWdl(Number(wdl[1]), Number(wdl[2]), Number(wdl[3])),
    ...(pv[2] ? { reply: pv[2] } : {}),
    ...(mate ? { mate: Number(mate[1]) } : {}),
  };
}

/** The speed check's position: a quiet Italian middlegame. */
const SPEED_FEN = "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 6";

export class UciEngine {
  private listeners: ((line: string) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly transport: UciTransport,
    readonly options: EngineOptions,
  ) {
    transport.onLine((line) => {
      for (const l of [...this.listeners]) l(line);
    });
  }

  private until(predicate: (line: string) => boolean): Promise<string[]> {
    return new Promise((resolve) => {
      const lines: string[] = [];
      const listener = (line: string) => {
        lines.push(line);
        if (predicate(line)) {
          this.listeners.splice(this.listeners.indexOf(listener), 1);
          resolve(lines);
        }
      };
      this.listeners.push(listener);
    });
  }

  /** Runs jobs one at a time; UCI engines handle one search at once. */
  private serial<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async init(): Promise<void> {
    return this.serial(async () => {
      const ok = this.until((l) => l === "uciok");
      this.transport.send("uci");
      await ok;
      this.transport.send("setoption name UCI_ShowWDL value true");
      this.transport.send(`setoption name Hash value ${this.options.hashMb}`);
      this.transport.send("setoption name Threads value 1");
      await this.ready();
    });
  }

  private async ready(): Promise<void> {
    const r = this.until((l) => l === "readyok");
    this.transport.send("isready");
    await r;
  }

  /** One fixed-budget search with a cleared hash. Returns the last score per line. */
  private async search(fen: string, multipv: number, searchMoves?: readonly string[], nodes = this.options.nodes): Promise<MoveScore[]> {
    this.transport.send("ucinewgame");
    this.transport.send(`setoption name MultiPV value ${multipv}`);
    await this.ready();
    this.transport.send(`position fen ${fen}`);
    const done = this.until((l) => l.startsWith("bestmove"));
    this.transport.send(
      `go nodes ${nodes}` + (searchMoves?.length ? ` searchmoves ${searchMoves.join(" ")}` : ""),
    );
    const lines = await done;
    const last = new Map<number, InfoLine>();
    for (const l of lines) {
      const info = parseInfo(l);
      if (info) last.set(info.multipv, info);
    }
    return [...last.values()].sort((a, b) => a.multipv - b.multipv).map(({ multipv: _, ...score }) => score);
  }

  /**
   * Expected score after each of the given moves: one search restricted to them.
   * Stockfish occasionally leaves a requested move out of that output; any such
   * move is scored from the position after it instead (see scoreAfter).
   */
  scoreMoves(fen: string, moves: readonly string[]): Promise<MoveScore[]> {
    // Sorted so the same set of moves always gives the same search, whoever asks.
    const unique = [...new Set(moves)].sort();
    return this.serial(async () => {
      if (!unique.length) return [];
      const found = await this.search(fen, unique.length, unique);
      const have = new Set(found.map((m) => m.move));
      for (const m of unique) if (!have.has(m)) found.push({ move: m, ...(await this.scoreAfter(fen, m)) });
      return found;
    });
  }

  /**
   * A deeper look at a few moves: one search restricted to them at `nodes` (every move gets far more of the
   * budget than in the top-8 search). Used to re-check close calls before they cost anyone.
   */
  scoreMovesAt(fen: string, moves: readonly string[], nodes: number): Promise<MoveScore[]> {
    const unique = [...new Set(moves)].sort();
    return this.serial(async () => (unique.length ? this.search(fen, unique.length, unique, nodes) : []));
  }

  /**
   * Mover's expected score after `move`, from a search of the resulting position (or the game result if it ends).
   * That search's best move is the opponent's best reply, kept with its mate score (seen from the mover's side).
   */
  private async scoreAfter(fen: string, move: string): Promise<Omit<MoveScore, "move">> {
    const next = applyMove(fen, move);
    const end = gameEnd(next, []);
    if (end === "checkmate") return { expected: 1 };
    if (end) return { expected: 0.5 };
    const [best] = await this.search(next, 1);
    if (!best) return { expected: 0.5 };
    return { expected: 1 - best.expected, reply: best.move, ...(best.mate !== undefined ? { mate: -best.mate } : {}) };
  }

  /** Top N moves with the mover's expected score after each (for bots). */
  topMoves(fen: string, n: number): Promise<MoveScore[]> {
    return this.serial(() => this.search(fen, n));
  }

  /** The same at another budget (Big Boy's Big Bounce scores a few positions quickly). */
  topMovesAt(fen: string, n: number, nodes: number): Promise<MoveScore[]> {
    return this.serial(() => this.search(fen, n, undefined, nodes));
  }

  /**
   * The engine's best move plus the expected score after each listed move.
   * One search covers the top `topN` moves; any listed move outside them gets
   * a second search restricted to those moves.
   */
  analyse(fen: string, moves: readonly string[] = [], topN = 1): Promise<Analysis> {
    return this.serial(async () => {
      const top = await this.search(fen, Math.max(1, topN));
      if (!top.length) throw new Error(`No legal moves in ${fen}`);
      const have = new Set(top.map((m) => m.move));
      const missing = [...new Set(moves)].filter((m) => !have.has(m)).sort();
      const extra = missing.length ? await this.search(fen, missing.length, missing) : [];
      const gotExtra = new Set(extra.map((m) => m.move));
      for (const m of missing) if (!gotExtra.has(m)) extra.push({ move: m, ...(await this.scoreAfter(fen, m)) });
      const all = [...top, ...extra.filter((m) => !have.has(m.move))];
      return { best: top[0]!, moves: all.sort((a, b) => b.expected - a.expected) };
    });
  }

  /**
   * A move played the way Stockfish plays at a given strength (UCI_Elo, 1320 to
   * 3190, CCRL-anchored): the boss in a boss battle. Strength limits are switched
   * off again afterwards, so scoring searches are unaffected.
   */
  playAtElo(fen: string, elo: number, nodes = this.options.nodes): Promise<string> {
    return this.serial(async () => {
      this.transport.send("ucinewgame");
      this.transport.send("setoption name MultiPV value 1");
      this.transport.send("setoption name UCI_LimitStrength value true");
      this.transport.send(`setoption name UCI_Elo value ${Math.round(Math.max(1320, Math.min(3190, elo)))}`);
      await this.ready();
      this.transport.send(`position fen ${fen}`);
      const done = this.until((l) => l.startsWith("bestmove"));
      this.transport.send(`go nodes ${nodes}`);
      const lines = await done;
      this.transport.send("setoption name UCI_LimitStrength value false");
      await this.ready();
      const move = lines[lines.length - 1]!.split(/\s+/)[1];
      if (!move || move === "(none)") throw new Error(`No move in ${fen}`);
      return move;
    });
  }

  /**
   * This engine's speed in nodes per second: one fixed-budget search of a middlegame position, timed (a device's
   * speed check when it joins a lobby, so the lobby gives faster devices more of the judging).
   */
  speed(nodes: number): Promise<number> {
    return this.serial(async () => {
      this.transport.send("ucinewgame");
      this.transport.send("setoption name MultiPV value 1");
      await this.ready();
      this.transport.send(`position fen ${SPEED_FEN}`);
      const done = this.until((l) => l.startsWith("bestmove"));
      const t = performance.now();
      this.transport.send(`go nodes ${nodes}`);
      await done;
      return Math.round(nodes / Math.max(0.001, (performance.now() - t) / 1000));
    });
  }

  close(): void {
    try {
      this.transport.send("quit");
    } catch {
      // Already closed.
    }
    this.transport.close();
  }
}
