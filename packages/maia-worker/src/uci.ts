// Maia box (AGPL-3.0, see LICENSE): the text protocol. A small UCI engine, like the official Maia-3 one
// (maia3/uci.py) but for a Web Worker: one command per message in, one line per message out.
//
//   uci                                   → id …, option …, uciok
//   isready                               → loads the model the first time, then readyok
//                                           (a failed load says "info string error …" before readyok)
//   ucinewgame                            → back to the starting position
//   setoption name UCI_Elo value N        → the rating Maia plays as (and, unless OppoElo is set, its opponent's)
//   setoption name OppoElo value N        → the opponent's rating
//   setoption name Temperature value T    → how bestmove is drawn: 0 is the most likely move (the default)
//   setoption name TopP value P           → keeps only the likeliest moves whose total stays within P (1: all)
//   setoption name MultiPV value K        → how many candidates go is to list (default 5)
//   setoption name Seed value S           → a fixed seed for the draws (0: a random one)
//   position startpos|fen <fen> [moves …] → the position
//   go [searchmoves m1 m2 …]              → for the top K moves (among searchmoves, if given):
//                                             info depth 1 multipv k time <ms> p <probability> pv <move>
//                                           then bestmove <move> (drawn as set above), or bestmove (none)
//   quit                                  → frees the model and ends the worker
//
// The probability (p) sits before pv because UCI ends an info line with its pv; other UCI tools ignore it.
import { Chess } from "chess.js";
import { blackToMove } from "./encode.ts";
import type { Predictor } from "./model.ts";
import { policy, sample, seeded } from "./policy.ts";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface UciHost {
  send(line: string): void;
  /** Loads the model (once: the engine keeps the promise). */
  load(): Promise<Predictor>;
  /** Frees it (quit). */
  release?(): Promise<void> | void;
  close?(): void;
  now?(): number;
}

export class MaiaUci {
  private fen = START_FEN;
  private elo = 1500;
  private oppoElo: number | null = null;
  private temperature = 0;
  private topP = 1;
  private multipv = 5;
  private rand: () => number = Math.random;
  private model: Promise<Predictor> | null = null;
  private loadError: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly host: UciHost,
    private readonly name = "Maia-3",
  ) {}

  /** One command; commands are handled strictly in order (a go finishes before the next command). */
  handle(line: string): Promise<void> {
    const next = this.queue.then(() => this.run(line.trim()));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private now(): number {
    return this.host.now?.() ?? (typeof performance !== "undefined" ? performance.now() : Date.now());
  }

  private ensureModel(): Promise<Predictor> {
    this.model ??= this.host.load();
    return this.model;
  }

  private async run(line: string): Promise<void> {
    if (!line) return;
    const [cmd = "", ...rest] = line.split(/\s+/);
    switch (cmd) {
      case "uci":
        this.host.send(`id name ${this.name}`);
        this.host.send("id author CSSLab, University of Toronto (Maia-3); this UCI wrapper: the HunChess Maia box");
        this.host.send("option name UCI_Elo type spin default 1500 min 0 max 5000");
        this.host.send("option name OppoElo type spin default 1500 min 0 max 5000");
        this.host.send("option name Temperature type string default 0");
        this.host.send("option name TopP type string default 1");
        this.host.send("option name MultiPV type spin default 5 min 1 max 20");
        this.host.send("option name Seed type spin default 0 min 0 max 2147483647");
        this.host.send("uciok");
        return;
      case "isready":
        try {
          await this.ensureModel();
        } catch (e) {
          this.loadError = e instanceof Error ? e.message : String(e);
          this.host.send(`info string error load failed: ${this.loadError}`);
        }
        this.host.send("readyok");
        return;
      case "ucinewgame":
        this.fen = START_FEN;
        return;
      case "setoption":
        return this.setOption(line);
      case "position":
        return this.position(rest);
      case "go":
        return this.go(rest);
      case "stop":
        return;
      case "quit":
        if (this.model) await Promise.resolve(this.host.release?.()).catch(() => undefined);
        this.model = null;
        this.host.close?.();
        return;
      default:
        this.host.send(`info string unknown command: ${cmd}`);
    }
  }

  private setOption(line: string) {
    const m = line.match(/^setoption\s+name\s+(.+?)(?:\s+value\s+(.*))?$/i);
    if (!m) return;
    const name = m[1]!.trim().toLowerCase();
    const value = (m[2] ?? "").trim();
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    if (name === "uci_elo" || name === "elo") this.elo = Math.max(0, Math.min(5000, n));
    else if (name === "oppoelo") this.oppoElo = Math.max(0, Math.min(5000, n));
    else if (name === "temperature") this.temperature = Math.max(0, n);
    else if (name === "topp") this.topP = Math.max(0, Math.min(1, n));
    else if (name === "multipv") this.multipv = Math.max(1, Math.min(20, Math.round(n)));
    else if (name === "seed") this.rand = n > 0 ? seeded(n) : Math.random;
  }

  private position(args: string[]) {
    let fen: string;
    let i: number;
    if (args[0] === "startpos") {
      fen = START_FEN;
      i = 1;
    } else if (args[0] === "fen") {
      fen = args.slice(1, 7).join(" ");
      i = 7;
    } else return;
    let chess: Chess;
    try {
      chess = new Chess(fen);
      if (args[i] === "moves") for (const mv of args.slice(i + 1)) chess.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), ...(mv[4] ? { promotion: mv[4] } : {}) });
    } catch {
      this.host.send(`info string error bad position: ${args.join(" ")}`);
      return;
    }
    this.fen = chess.fen();
  }

  private async go(args: string[]) {
    const legal = new Chess(this.fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
    const k = args.indexOf("searchmoves");
    const only = k >= 0 ? new Set(args.slice(k + 1)) : null;
    const moves = only ? legal.filter((m) => only.has(m)) : legal;
    if (!moves.length) return this.host.send("bestmove (none)");
    let predict: Predictor;
    try {
      predict = await this.ensureModel();
    } catch (e) {
      this.host.send(`info string error not loaded: ${e instanceof Error ? e.message : String(e)}`);
      return this.host.send("bestmove (none)");
    }
    const t0 = this.now();
    let out;
    try {
      out = await predict(this.fen, this.elo, this.oppoElo ?? this.elo);
    } catch (e) {
      this.host.send(`info string error ${e instanceof Error ? e.message : String(e)}`);
      return this.host.send("bestmove (none)");
    }
    const ms = Math.round(this.now() - t0);
    const ranked = policy(out.logits, moves, blackToMove(this.fen));
    ranked.slice(0, this.multipv).forEach((m, i) => this.host.send(`info depth 1 multipv ${i + 1} time ${ms} p ${m.p.toFixed(4)} pv ${m.move}`));
    const best = sample(ranked, this.temperature, this.topP, this.rand);
    this.host.send(`bestmove ${best ?? "(none)"}`);
  }
}
