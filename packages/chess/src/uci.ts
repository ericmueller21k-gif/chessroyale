/**
 * Stockfish over the standard UCI text protocol. The transport (a Node child
 * process or a browser Web Worker) is pluggable, so the same code and the same
 * fixed budget give the same numbers everywhere.
 */

import { ENGINE_MAX_ELO, ENGINE_MIN_ELO } from "@chessroyale/core";
import { isChess960Fen } from "./chess960.ts";
import { applyMove, gameEnd, kingAttacked } from "./rules.ts";

export interface UciTransport {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
  close(): void;
  /**
   * Ends the engine's process now; a fresh one starts with the next command (a browser's Web Worker: its WebAssembly
   * memory is freed meanwhile). Optional: a transport without it can't be paused (UciEngine.pause only holds its work).
   */
  restart?(): void;
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
  /** Scores for every move analyzed (top N plus any requested), best first. */
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

/**
 * Whether a castling right holds as Stockfish 19 reads it, on that side's back rank (files a to h): K or Q, a rook of
 * that color between that corner and its king; a file's letter (Chess960), that color's rook on that file; either way
 * the king on files b to g. Stockfish 19 drops a right that doesn't hold; the engine server's Stockfish 17.1 looks for
 * its rook past the board's edge (DECISIONS.md, "The engine server's own Stockfish, checked in CI", Oct 15).
 */
function castlingRightHolds(backRank: readonly string[], letter: string): boolean {
  const [king, rook] = letter <= "Z" ? ["K", "R"] : ["k", "r"];
  const up = letter.toUpperCase();
  if (up === "K" || up === "Q") {
    let rookSeen = false;
    for (const f of up === "K" ? [7, 6, 5, 4, 3, 2, 1] : [0, 1, 2, 3, 4, 5, 6]) {
      if (backRank[f] === king) return rookSeen;
      if (backRank[f] === rook) rookSeen = true;
    }
    return false;
  }
  return backRank[up.charCodeAt(0) - 65] === rook && backRank.slice(1, 7).includes(king);
}

/**
 * Why Stockfish would refuse this position, or null: no engine is ever sent one. Stockfish 19 checks a position as it's
 * set up, and a refused one ends its process with an error (in a browser, its worker's exit thrown into the page:
 * "ExitStatus", Oct 15) and leaves its last position in place, so a search would answer for the wrong position. Its
 * rules, as measured against the build the game runs: pieces it reads (KQRBNP, either case) on eight ranks of eight
 * squares; a side to move; one king a side; no pawn on the first or eighth rank; at most 8 pawns a side; no more pieces
 * than promotions could have made (beyond a queen, two rooks, two bishops and two knights, no more than the pawns
 * missing); the side not to move not in check; an en passant square on the sixth rank with White to move, the third
 * with Black (any other square there is ignored); at most four castling rights, in letters it reads (KQkq, or files);
 * move counters up to 32767 (the fifty-move count) and 100000 (the move number). One more, for the engine server's
 * Stockfish 17.1 (which checks nothing): every castling right holds (`castlingRightHolds`), where 19 merely drops one
 * that doesn't. No game reaches any of these.
 */
export function stockfishRefuses(fen: string): string | null {
  const [board = "", side, castling = "-", ep = "-", half, full] = fen.split(" ");
  if (side !== "w" && side !== "b") return "no side to move";
  if (castling !== "-" && !/^[KQkqA-Ha-h]{1,4}$/.test(castling)) return "castling rights it can't read";
  const ranks = board.split("/");
  if (ranks.length !== 8) return "not eight ranks";
  const count: Record<string, number> = {};
  const rows: string[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: string[] = [];
    for (const c of ranks[r]!) {
      if (c >= "1" && c <= "8") {
        row.push(...Array<string>(Number(c)).fill(""));
        continue;
      }
      if (!"KQRBNPkqrbnp".includes(c)) return "a piece it can't read";
      count[c] = (count[c] ?? 0) + 1;
      if ((c === "p" || c === "P") && (r === 0 || r === 7)) return "a pawn on the first or eighth rank";
      row.push(c);
    }
    if (row.length !== 8) return "a rank without eight squares";
    rows.push(row);
  }
  for (const [color, up] of [["Black", false], ["White", true]] as const) {
    const n = (piece: string) => count[up ? piece.toUpperCase() : piece] ?? 0;
    if (n("k") !== 1) return `${color} hasn't one king`;
    const pawns = n("p");
    if (pawns > 8) return `${color} has more than 8 pawns`;
    const promoted = Math.max(0, n("q") - 1) + Math.max(0, n("r") - 2) + Math.max(0, n("b") - 2) + Math.max(0, n("n") - 2);
    if (promoted > 8 - pawns) return `${color} has more pieces than promotions could make`;
  }
  for (const letter of castling === "-" ? "" : castling) {
    if (!castlingRightHolds(rows[letter <= "Z" ? 7 : 0]!, letter)) return `a castling right without its rook and king in place (${letter})`;
  }
  if (ep !== "-" && !(/^[a-h]/.test(ep) && ep[1] === (side === "w" ? "6" : "3"))) return "an en passant square it can't read, or on the wrong rank";
  if (Number(half) < 0 || Number(half) > 32767) return "a fifty-move count out of range";
  if (Number(full) < 0 || Number(full) > 100000) return "a move number out of range";
  // (Without its castling rights: a Chess960 position's are written by file, which chess.js doesn't read.)
  if (kingAttacked(`${board} ${side} - - 0 1`, side === "w" ? "b" : "w")) return "the side not to move is in check";
  return null;
}

/**
 * Each line of a search, from its output: each slot's last exact line, as always, unless that lists a move twice.
 * Stockfish re-sorts its lines as it deepens, and a search cut off mid-line prints that slot as a bound (skipped), so
 * the slot's last exact line can be from an earlier depth, naming a move that has since moved to another slot: one
 * move came out twice and another not at all (about 1 search in 5 of the judge's top 8 at 250k nodes). Then each move
 * is listed once, with the numbers of its own latest exact line, and the moves are the ones in the last line printed
 * for each slot (bound lines included), in the slots' order. A search with no move twice reads exactly as before.
 */
export function searchLines(lines: readonly string[]): InfoLine[] {
  const exactSlots = new Map<number, InfoLine>();
  const lastSlots = new Map<number, string>();
  const exact = new Map<string, InfoLine>();
  const bound = new Map<string, InfoLine>();
  for (const l of lines) {
    const info = parseInfo(l);
    const any = info ?? parseInfo(l.replace(/ (?:lower|upper)bound/, ""));
    if (!any) continue;
    lastSlots.set(any.multipv, any.move);
    if (info) {
      exactSlots.set(info.multipv, info);
      exact.set(info.move, info);
    } else bound.set(any.move, any);
  }
  const bySlot = <T,>(slots: Map<number, T>) => [...slots].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const plain = bySlot(exactSlots);
  if (new Set(plain.map((m) => m.move)).size === plain.length) return plain;
  const listed = new Set(lastSlots.values());
  return [...new Set([...plain.map((m) => m.move), ...bySlot(lastSlots)])].filter((m) => listed.has(m)).map((m) => exact.get(m) ?? bound.get(m)!);
}

/** Whether `p` settles within `ms` (its timer cleared either way). */
function settlesWithin(p: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    const done = () => {
      clearTimeout(t);
      resolve(true);
    };
    p.then(done, done);
  });
}

/** The speed check's position: a quiet Italian middlegame. */
const SPEED_FEN = "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 6";

export class UciEngine {
  private listeners: ((line: string) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  /** Whether UCI_Chess960 is on in the engine now (off from the start, as Stockfish starts). */
  private chess960 = false;

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
    return this.serial(() => this.handshake());
  }

  /** The engine's start: UCI, its options, ready. */
  private async handshake(): Promise<void> {
    const ok = this.until((l) => l === "uciok");
    this.transport.send("uci");
    await ok;
    this.transport.send("setoption name UCI_ShowWDL value true");
    this.transport.send(`setoption name Hash value ${this.options.hashMb}`);
    this.transport.send("setoption name Threads value 1");
    await this.ready();
  }

  /**
   * Ends the engine's process until `until` settles, then starts a fresh one, set up as before (a browser: its worker
   * ends and its WebAssembly memory is freed, so another engine can load alone: Maia on a phone). Work already asked
   * for finishes first; work asked for meanwhile waits for the fresh engine, so nothing searches in between. Resolves
   * once the old process has ended. If the fresh one hasn't answered within `reviveMs` (say, short of memory beside
   * what loaded meanwhile), `revive` is called (to free some) and it's started once more. A transport that can't
   * restart: the work only waits.
   */
  pause(until: Promise<unknown>, revive?: () => void, reviveMs = 15_000): Promise<void> {
    return new Promise<void>((ended) => {
      void this.serial(async () => {
        const restart = this.transport.restart?.bind(this.transport);
        restart?.();
        // (A fresh Stockfish starts with UCI_Chess960 off.)
        this.chess960 = false;
        ended();
        await until.then(
          () => undefined,
          () => undefined,
        );
        if (!restart) return;
        if (await settlesWithin(this.handshake(), reviveMs)) return;
        // (The stuck start's own steps may still go on once the new process answers: the same options again, and
        // one more readyok, which only lets someone's wait for one end early. Harmless.)
        revive?.();
        restart();
        await this.handshake();
      });
    });
  }

  private async ready(): Promise<void> {
    const r = this.until((l) => l === "readyok");
    this.transport.send("isready");
    await r;
  }

  /**
   * Sets up a position. A Chess960 one (its castling rooks named by file: chess960.ts) needs UCI_Chess960 on first,
   * which also makes the engine write castling as the king taking its own rook (e1h1), the way our Chess960 rules
   * write it; the option goes off again for the next normal position. A normal position after a normal one sends
   * nothing new, so normal searches are unchanged.
   */
  private setPosition(fen: string): void {
    const chess960 = isChess960Fen(fen);
    if (chess960 !== this.chess960) {
      this.transport.send(`setoption name UCI_Chess960 value ${chess960}`);
      this.chess960 = chess960;
    }
    this.transport.send(`position fen ${fen}`);
  }

  /** One fixed-budget search with a cleared hash. Returns each line's latest score (searchLines). */
  private async search(fen: string, multipv: number, searchMoves?: readonly string[], nodes = this.options.nodes): Promise<MoveScore[]> {
    // (A position Stockfish refuses is never sent: no lines, as for a position with no moves.)
    if (stockfishRefuses(fen)) return [];
    this.transport.send("ucinewgame");
    this.transport.send(`setoption name MultiPV value ${multipv}`);
    await this.ready();
    this.setPosition(fen);
    const done = this.until((l) => l.startsWith("bestmove"));
    this.transport.send(
      `go nodes ${nodes}` + (searchMoves?.length ? ` searchmoves ${searchMoves.join(" ")}` : ""),
    );
    return searchLines(await done).map(({ multipv: _, ...score }) => score);
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
      // (A position Stockfish refuses: no scores, rather than made-up ones for the positions after its moves.)
      if (!unique.length || stockfishRefuses(fen)) return [];
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

  /**
   * The same at another budget (Big Boy's Big Bounce scores a few positions quickly); `moves`: only those searched
   * (searchmoves: the hippo gardener's plants leave some out, the search's shape otherwise the same).
   */
  topMovesAt(fen: string, n: number, nodes: number, moves?: readonly string[]): Promise<MoveScore[]> {
    return this.serial(() => this.search(fen, n, moves, nodes));
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
   * off again afterwards, so scoring searches are unaffected. `moveMs`: also never longer than this (the Hidden Boss's
   * phase 2, four boards on a phone); the search stops at whichever limit comes first.
   */
  playAtElo(fen: string, elo: number, nodes = this.options.nodes, moveMs?: number): Promise<string> {
    return this.serial(async () => {
      const refused = stockfishRefuses(fen);
      if (refused) throw new Error(`No move in ${fen}: Stockfish refuses it (${refused})`);
      this.transport.send("ucinewgame");
      this.transport.send("setoption name MultiPV value 1");
      this.transport.send("setoption name UCI_LimitStrength value true");
      this.transport.send(`setoption name UCI_Elo value ${Math.round(Math.max(ENGINE_MIN_ELO, Math.min(ENGINE_MAX_ELO, elo)))}`);
      await this.ready();
      this.setPosition(fen);
      const done = this.until((l) => l.startsWith("bestmove"));
      this.transport.send(`go nodes ${nodes}` + (moveMs ? ` movetime ${Math.max(1, Math.round(moveMs))}` : ""));
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
      this.setPosition(SPEED_FEN);
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
