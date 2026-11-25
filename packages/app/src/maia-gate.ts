import type { HumanUciEngine } from "@chessroyale/chess";

/**
 * A solo boss battle's loading step (DECISIONS.md, "Maia's loading step", Oct 14): before the intro, this device's
 * Stockfish is paused (its workers end, their memory freed: Eric's iPhone failed to load Maia beside them) and Maia
 * loads alone; a load that fails short of memory or with no WebAssembly backend is tried once more; then Stockfish
 * starts again and the battle begins. Never longer than `gateMs`: not ready by then, the battle begins anyway (the
 * boss plays Stockfish until Maia is ready, as before).
 */
export type GateEnd = "ready" | "failed" | "timeout" | "stopped";

export interface MaiaGateDeps {
  /** Starts Maia's worker, its load once `after` settles (startMaia); null if it can't run here. */
  start: (after: Promise<void>) => HumanUciEngine | null;
  /** Pauses this device's Stockfish until `until` settles (pauseEngines); resolves once its workers have ended. */
  pause: (until: Promise<void>) => Promise<void>;
  /** The step's length at most (BOSS_BRAIN.loadGateMs). */
  gateMs: number;
}

/** A load worth one more try: onnxruntime found no backend, or memory ran short (iOS Safari: "RangeError: Out of memory"). */
export const retryable = (error: string | null) => !!error && /memory|backend/i.test(error);

export class MaiaGate {
  /** Maia's engine now (a second try is a new one). */
  engine: HumanUciEngine | null = null;
  /** Why the first try failed, when it was tried again (the admins' line). */
  firstError: string | null = null;
  /** How it ended. */
  readonly done: Promise<GateEnd>;
  private release: () => void = () => undefined;
  private stop_: () => void = () => undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: MaiaGateDeps) {
    // (Never stuck: anything unexpected ends the step as a failure, and the battle begins.)
    this.done = this.run().catch(() => {
      this.release();
      return "failed" as const;
    });
  }

  /** Ends the step now (the player left): Stockfish starts again; closing Maia is the caller's. */
  stop(): void {
    this.stop_();
  }

  private async run(): Promise<GateEnd> {
    const released = new Promise<void>((r) => (this.release = r));
    const stopped = new Promise<"stopped">((r) => (this.stop_ = () => r("stopped")));
    const deadline = new Promise<"timeout">((r) => (this.timer = setTimeout(() => r("timeout"), this.deps.gateMs)));
    const end = (e: GateEnd) => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.release();
      return e;
    };
    // Stockfish's workers end first (work already under way finishes), so Maia loads alone: its worker starts now,
    // its load once they've ended (or the time's up).
    const alone = Promise.race([this.deps.pause(released), stopped, deadline]).then(
      () => undefined,
      () => undefined,
    );
    for (let attempt = 0; ; attempt++) {
      const engine = (this.engine = this.deps.start(alone));
      if (!engine) return end("failed");
      const r = await Promise.race([engine.loaded().then((ok) => (ok ? ("ready" as const) : ("failed" as const))), stopped, deadline]);
      if (r !== "failed" || attempt > 0 || !retryable(engine.error)) return end(r);
      // (Once more, from a fresh worker: the failed one's memory goes with it.)
      this.firstError = engine.error;
      engine.close();
    }
  }
}
