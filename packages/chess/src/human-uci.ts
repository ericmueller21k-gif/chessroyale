/**
 * A human-like engine (the Maia box: its own worker, its own license) spoken to only in UCI-style text, through the
 * same transport as Stockfish (uci.ts). Its replies: `info … multipv k … p <probability> … pv <move>` lines for its
 * likeliest moves, then `bestmove <move>` (its own draw). Nothing of it is imported here: only text goes back and forth.
 */
import type { HumanAnswer, HumanCandidate, HumanEngineLike } from "./boss-brain.ts";
import type { UciTransport } from "./uci.ts";

/** One candidate line: its rank, move and probability (null for any other line). */
export function parseHumanInfo(line: string): { rank: number; move: string; p: number } | null {
  if (!line.startsWith("info ")) return null;
  const rank = line.match(/ multipv (\d+)/);
  const p = line.match(/ p (\d*\.?\d+(?:e-?\d+)?)/);
  const pv = line.match(/ pv (\S+)/);
  if (!rank || !p || !pv) return null;
  return { rank: Number(rank[1]), move: pv[1]!, p: Number(p[1]) };
}

export class HumanUciEngine implements HumanEngineLike {
  private listeners: ((line: string) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private state: "new" | "loading" | "ready" | "failed" | "closed" = "new";
  /** Why it failed, if it did. */
  error: string | null = null;
  /** Waiting for the load to end (loaded()). */
  private waiting: ((ok: boolean) => void)[] = [];

  constructor(
    private readonly transport: UciTransport,
    private readonly now: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
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

  private serial<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Answering moves now (loaded, not failed, not closed). Never waits. */
  ready(): boolean {
    return this.state === "ready";
  }

  failed(): boolean {
    return this.state === "failed";
  }

  get status() {
    return this.state;
  }

  private setState(s: "loading" | "ready" | "failed" | "closed"): void {
    this.state = s;
    if (s === "loading") return;
    for (const w of this.waiting.splice(0)) w(s === "ready");
  }

  /** Once the load has ended: true ready, false failed or closed (never before it ends; at once if it has). */
  loaded(): Promise<boolean> {
    if (this.state === "new" || this.state === "loading") return new Promise((resolve) => this.waiting.push(resolve));
    return Promise.resolve(this.state === "ready");
  }

  /** The handshake and the model's load (the first isready): ready, or failed with its reason (or after `timeoutMs`). */
  init(timeoutMs = 60_000): Promise<boolean> {
    if (this.state !== "new") return Promise.resolve(this.state === "ready");
    this.setState("loading");
    const work = this.serial(async () => {
      const ok = this.until((l) => l === "uciok");
      this.transport.send("uci");
      await ok;
      const ready = this.until((l) => l === "readyok");
      this.transport.send("isready");
      const lines = await ready;
      const err = lines.find((l) => l.startsWith("info string error"));
      if (err) throw new Error(err.replace("info string error ", ""));
      return true;
    });
    return new Promise<boolean>((resolve) => {
      const t = setTimeout(() => {
        if (this.state === "loading") {
          this.error = "load timed out";
          this.setState("failed");
        }
        resolve(false);
      }, timeoutMs);
      work.then(
        () => {
          clearTimeout(t);
          if (this.state === "loading") this.setState("ready");
          resolve(this.state === "ready");
        },
        (e: unknown) => {
          clearTimeout(t);
          if (this.state !== "closed") {
            this.error = e instanceof Error ? e.message : String(e);
            this.setState("failed");
          }
          resolve(false);
        },
      );
    });
  }

  /** Maia's likeliest moves at a rating (among `allowed`, if given) and its own draw; null if it isn't ready. */
  candidates(fen: string, rating: number, allowed: readonly string[] | null, opts: { temperature: number; topP: number; multipv: number }): Promise<HumanAnswer | null> {
    if (!this.ready()) return Promise.resolve(null);
    return this.serial(async () => {
      if (!this.ready()) return null;
      const t0 = this.now();
      this.transport.send(`setoption name UCI_Elo value ${Math.round(rating)}`);
      this.transport.send(`setoption name Temperature value ${opts.temperature}`);
      this.transport.send(`setoption name TopP value ${opts.topP}`);
      this.transport.send(`setoption name MultiPV value ${opts.multipv}`);
      this.transport.send(`position fen ${fen}`);
      const done = this.until((l) => l.startsWith("bestmove"));
      this.transport.send("go" + (allowed ? ` searchmoves ${allowed.join(" ")}` : ""));
      const lines = await done;
      const moves: HumanCandidate[] = [];
      for (const l of lines) {
        const c = parseHumanInfo(l);
        if (c) moves[c.rank - 1] = { move: c.move, p: c.p };
      }
      const best = lines[lines.length - 1]!.split(/\s+/)[1] ?? null;
      return { best: best && best !== "(none)" && best !== "0000" ? best : null, moves: moves.filter(Boolean), ms: this.now() - t0 };
    });
  }

  /** The worker broke (an error event): no more moves from it. */
  fail(reason: string): void {
    if (this.state === "closed") return;
    this.error = reason;
    this.setState("failed");
  }

  /** Frees the model and ends the worker (after the battle). */
  close(): void {
    this.setState("closed");
    try {
      this.transport.send("quit");
    } catch {
      // Already gone.
    }
    this.transport.close();
  }
}
