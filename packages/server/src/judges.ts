/**
 * Many judges, the lobby's side (pure helpers; the flow is in lobby.ts). See DECISIONS.md, "Many judges".
 */
import type { JudgeConfig } from "@chessroyale/core";
import type { JudgedBoard, JudgeJob, JudgeReport } from "@chessroyale/chess";

/** What the lobby knows about a device that can judge (by player id). */
export interface JudgeDevice {
  /** Its engine's speed (nodes per second), from its speed check on joining. */
  nps: number;
  strikes: number;
  /** Jobs it has been given, and answered. */
  jobs: number;
  answered: number;
}

/** How a board's scores were settled. */
export type JudgeHow = "agreed" | "verdict" | "single" | "fallback" | "none";

/** One board's scoring job in progress (online, many judges). */
export interface JudgeTask {
  boardId: number;
  job: JudgeJob;
  /** The bots' ids, in the job's order. */
  botIds: string[];
  /** Judges answering it now, and everyone ever given it. */
  judges: string[];
  tried: string[];
  /** How many judges it was meant to have (fewer connected: as many as there were). */
  want: number;
  /** When it was sent (and to whom, when). */
  sentAt: number;
  sent: Record<string, number>;
  reports: Record<string, JudgeReport>;
  /** Each report as worked out (null: it didn't hold together). */
  boards: Record<string, JudgedBoard | null>;
  /** After the first answer: how long the second has (then the first is used alone). */
  waitUntil?: number;
  /** Waiting on the engine server: a verdict on a disagreement, or a re-check of close calls (and since when). */
  server?: { kind: "verdict" | "recheck"; id: string; at: number };
  done?: { board: JudgedBoard; how: JudgeHow };
}

/** Counts for the logs and the harness (reports/many-judges.md). */
export interface JudgeStats {
  jobs: number;
  agreed: number;
  disagreed: number;
  single: number;
  fallback: number;
  invalid: number;
  replaced: number;
  /** Engine server searches: verdicts, spot checks, re-checks of close calls; and ones it couldn't answer. */
  serverVerdict: number;
  serverSpot: number;
  serverRecheck: number;
  serverFailed: number;
  strikes: number;
  benched: number;
  /** Referee answers (a third device on a disagreement) and spot checks that found a judge off. */
  refereed: number;
  spotCaught: number;
}

export const emptyStats = (): JudgeStats => ({
  jobs: 0,
  agreed: 0,
  disagreed: 0,
  single: 0,
  fallback: 0,
  invalid: 0,
  replaced: 0,
  serverVerdict: 0,
  serverSpot: 0,
  serverRecheck: 0,
  serverFailed: 0,
  strikes: 0,
  benched: 0,
  refereed: 0,
  spotCaught: 0,
});

/** A device's weight when judges are drawn: faster devices more often, and less once it has jobs this round. */
export function judgeWeight(nps: number, load: number, cfg: Pick<JudgeConfig, "speedWeight">): number {
  return Math.pow(Math.max(1, nps) / 100_000, cfg.speedWeight) / (1 + load);
}

/** Draws `count` different judges at random by weight, leaving out `exclude`. */
export function drawJudges(
  rng: () => number,
  devices: readonly { id: string; nps: number }[],
  count: number,
  cfg: Pick<JudgeConfig, "speedWeight">,
  load: Map<string, number> = new Map(),
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  const pool = devices.filter((d) => !exclude.has(d.id));
  const out: string[] = [];
  while (out.length < count && pool.length) {
    const weights = pool.map((d) => judgeWeight(d.nps, load.get(d.id) ?? 0, cfg));
    const total = weights.reduce((a, b) => a + b, 0);
    let x = rng() * total;
    let i = 0;
    while (i < pool.length - 1 && x >= weights[i]!) x -= weights[i++]!;
    out.push(pool[i]!.id);
    pool.splice(i, 1);
  }
  return out;
}

/**
 * Judges for every board: the costliest jobs first (more picks to score), so they get the pick of the fast devices;
 * each device's weight drops with every job it already has this round, which spreads the work.
 */
export function assignJudges(
  rng: () => number,
  boards: readonly { boardId: number; cost: number }[],
  devices: readonly { id: string; nps: number }[],
  perJob: number,
  cfg: Pick<JudgeConfig, "speedWeight">,
): Map<number, string[]> {
  const load = new Map<string, number>();
  const out = new Map<number, string[]>();
  for (const b of [...boards].sort((x, y) => y.cost - x.cost || x.boardId - y.boardId)) {
    const judges = drawJudges(rng, devices, perJob, cfg, load);
    for (const j of judges) load.set(j, (load.get(j) ?? 0) + 1);
    out.set(b.boardId, judges);
  }
  return out;
}

/**
 * Players whose picks can decide this stage's cut: still in, and within `width` points of the cut line (the
 * stage scores either side of it). Nobody when there's no cut.
 */
export function cutBubble(standings: readonly { id: string; points: number; out: boolean }[], keep: number, width: number): Set<string> {
  const alive = standings.filter((s) => !s.out).sort((a, b) => b.points - a.points);
  if (keep <= 0 || keep >= alive.length) return new Set();
  const line = (alive[keep - 1]!.points + alive[keep]!.points) / 2;
  return new Set(alive.filter((s) => Math.abs(s.points - line) <= width).map((s) => s.id));
}

/** A job's seed for the bots' picks (from the round's key and the board, so the plan and the job agree). */
export function seedFor(key: string, boardId: number): number {
  let h = 2166136261;
  for (const c of `${key}#${boardId}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
