/**
 * The residents' one engine: Maia-3 in its own process (packages/maia-worker's cli, as the sims and cheater-demo run it). Every
 * resident's move is DRAWN from Maia's policy at the resident's rating (temperature 1, as people at that level vary), never its
 * likeliest move, so residents blunder as people do. 1 v 1 has no judging, so no Stockfish (the design, "Engines").
 * If Maia goes down it's started again (at most once a minute); meanwhile a move is a legal one drawn at random, counted as an error.
 */
import { Chess } from "chess.js";
import { HumanUciEngine, legalMoves } from "@chessroyale/chess";
import { maiaProcess } from "../../packages/sim/src/maia-process.ts";
import { RESIDENTS, type Rng } from "@chessroyale/core";

export interface Choice {
  move: string;
  /** Maia's top two moves were close (the resident thinks longer). */
  close: boolean;
  /** Not Maia's: drawn at random while Maia was down. */
  fallback: boolean;
}

export class MoveSource {
  private maia: HumanUciEngine | null = null;
  private startedAt = 0;
  private starting: Promise<boolean> | null = null;
  /** Called with a line for the log (Maia's start and failures). */
  onNote: (line: string) => void = () => undefined;

  /** Starts Maia; true once it answers. */
  start(): Promise<boolean> {
    if (this.starting) return this.starting;
    this.startedAt = Date.now();
    this.starting = (async () => {
      try {
        this.maia?.close();
      } catch {
        // Gone already.
      }
      const m = new HumanUciEngine(maiaProcess());
      m.onFail = () => this.onNote(`maia failed: ${m.error ?? "no reason"}`);
      const ok = await m.init(120_000).catch(() => false);
      this.maia = m;
      this.onNote(ok ? "maia ready" : `maia didn't load: ${m.error ?? "no reason"}`);
      return ok;
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  ready(): boolean {
    return !!this.maia?.ready();
  }

  /** A move for this position at `rating`, drawn from Maia's policy. */
  async choose(fen: string, rating: number, rng: Rng): Promise<Choice> {
    const legal = legalMoves(fen);
    if (!this.ready() && !this.starting && Date.now() - this.startedAt > 60_000) void this.start();
    if (this.ready()) {
      const a = await this.maia!.candidates(fen, rating, null, { temperature: 1, topP: 0.95, multipv: 5 }).catch(() => null);
      const set = new Set(legal);
      const move = [a?.best, ...(a?.moves ?? []).map((m) => m.move)].find((mv): mv is string => !!mv && set.has(mv));
      if (move) {
        const [p1, p2] = a!.moves;
        const close = !!p1 && !!p2 && Math.abs(p1.p - p2.p) < RESIDENTS.duel.closeGap;
        return { move, close, fallback: false };
      }
    }
    return { move: legal[Math.floor(rng() * legal.length)]!, close: false, fallback: true };
  }

  close(): void {
    this.maia?.close();
    this.maia = null;
  }
}

/** Whether the side to move is in check. */
export function inCheck(fen: string): boolean {
  try {
    return new Chess(fen).inCheck();
  } catch {
    return false;
  }
}
