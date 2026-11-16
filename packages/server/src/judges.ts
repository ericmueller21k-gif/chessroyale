/**
 * Many judges, the lobby's side (pure helpers; the flow is in lobby.ts). See DECISIONS.md, "Many judges".
 */
import type { JudgeConfig } from "@chessroyale/core";
import type { JudgedBoard, JudgeJob, JudgeReport, MoveScore } from "@chessroyale/chess";

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
export type JudgeHow = "agreed" | "verdict" | "majority" | "single" | "fallback" | "none";

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
  /**
   * Waiting on the engine server (a verdict on a disagreement, or a re-check of close calls), or with no server, on a
   * third device's second opinion (two of three decide); since when.
   */
  server?: { kind: "verdict" | "recheck" | "referee"; id: string; at: number };
  done?: { board: JudgedBoard; how: JudgeHow };
  /** A dispute that went to a third device too (its second opinion decides the blame, not distance from the verdict). */
  refereed?: boolean;
  /** Two capable judges re-check the close calls themselves (deep checks on devices). */
  deep?: boolean;
  /** The third device asked, and (settled two of three) the two devices that agreed. */
  refereeBy?: string;
  majorityPair?: string[];
  /** Deep checks: each device's re-check of the close calls, as it comes (by player id). */
  deepReports?: Record<string, MoveScore[]>;
  /** Waiting for these devices' re-checks until then (the quick numbers are settled). */
  awaitDeep?: { from: string[]; until: number };
  /** Two re-checks that disagreed, kept for blame when the engine server's re-check comes. */
  deepBoards?: Record<string, JudgedBoard | null>;
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
  /** Disputes settled by two of three devices (no engine server). */
  majority: number;
  strikes: number;
  benched: number;
  /** Referee answers (a third device on a disagreement) and spot checks that found a judge off. */
  refereed: number;
  spotCaught: number;
  /** Late second answers (after the job was settled on the first): matching it, or not. */
  lateAgreed: number;
  lateDisagreed: number;
  /** Deep checks on devices: jobs that carried one, re-checks that agreed, disagreed, or came too late. */
  deepJobs: number;
  deepAgreed: number;
  deepDisagreed: number;
  deepLate: number;
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
  majority: 0,
  strikes: 0,
  benched: 0,
  refereed: 0,
  spotCaught: 0,
  lateAgreed: 0,
  lateDisagreed: 0,
  deepJobs: 0,
  deepAgreed: 0,
  deepDisagreed: 0,
  deepLate: 0,
});

/** A device's weight when judges are drawn: faster devices more often, and less once it has jobs this round. */
export function judgeWeight(nps: number, load: number, cfg: Pick<JudgeConfig, "speedWeight">): number {
  return Math.pow(Math.max(1, nps) / 100_000, cfg.speedWeight) / (1 + load);
}

/**
 * A device that can judge: its seat, its speed, whose it is (`owner`: the account; none: the seat's own) and its class
 * (`kind`: a computer or a phone; none: one class for all).
 */
export interface JudgeCandidate {
  id: string;
  nps: number;
  owner?: string;
  kind?: "computer" | "phone";
}

const ownerOf = (d: JudgeCandidate) => d.owner ?? d.id;

/** What `drawJudges` reads: the weight, and (each optional, none: no limit) the caps and the class threshold. */
export type DrawConfig = Pick<JudgeConfig, "speedWeight"> & Partial<Pick<JudgeConfig, "maxNps" | "medianCap" | "pairClassMin" | "pairClassShare">>;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Draws `count` different judges at random by weight, leaving out `exclude`. Never two of one owner, nor one whose owner
 * is excluded: two judges that agree are accepted unchecked, so they must be two people (2026-11-10-device-trust.md).
 * A speed counts at most `maxNps` and `medianCap` times the median of `devices` (a claimed speed buys little in a
 * lobby of phones). Each judge after the first, and the first when `kind` is given (a refill beside a remaining judge),
 * comes from that class (computer with computer) only while the class has `pairClassMin` other owners left, and at least
 * `pairClassShare` of the lobby's owners; else from everyone, so a pair finishes together but a class an attacker fills
 * can't pick the second (2026-11-10-judge-pairing.md).
 */
export function drawJudges(
  rng: () => number,
  devices: readonly JudgeCandidate[],
  count: number,
  cfg: DrawConfig,
  load: Map<string, number> = new Map(),
  exclude: ReadonlySet<string> = new Set(),
  kind?: JudgeCandidate["kind"],
): string[] {
  const cap = Math.min(cfg.maxNps ?? Infinity, cfg.medianCap && devices.length ? cfg.medianCap * median(devices.map((d) => d.nps)) : Infinity);
  const owners = new Set(devices.filter((d) => exclude.has(d.id)).map(ownerOf));
  let pool = devices.filter((d) => !exclude.has(d.id) && !owners.has(ownerOf(d)));
  const out: string[] = [];
  const minOwners = Math.max(cfg.pairClassMin ?? 1, Math.ceil((cfg.pairClassShare ?? 0) * new Set(devices.map(ownerOf)).size));
  let paired = kind !== undefined;
  while (out.length < count && pool.length) {
    const same = paired ? pool.filter((d) => d.kind === kind) : pool;
    const from = same.length && new Set(same.map(ownerOf)).size >= minOwners ? same : pool;
    const weights = from.map((d) => judgeWeight(Math.min(d.nps, cap), load.get(d.id) ?? 0, cfg));
    const total = weights.reduce((a, b) => a + b, 0);
    let x = rng() * total;
    let i = 0;
    while (i < from.length - 1 && x >= weights[i]!) x -= weights[i++]!;
    const chosen = from[i]!;
    out.push(chosen.id);
    if (!paired) {
      paired = true;
      kind = chosen.kind;
    }
    pool = pool.filter((d) => ownerOf(d) !== ownerOf(chosen));
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
  devices: readonly JudgeCandidate[],
  perJob: number,
  cfg: DrawConfig,
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
