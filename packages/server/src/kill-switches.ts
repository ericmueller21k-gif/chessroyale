import { allPausable, bossesOff, pausedLine, pauseVariable, type Pausable } from "@chessroyale/core";

/**
 * The kill switches and the maintenance banner, read from the Worker's runtime variables (docs/areas/ops.md, "Kill
 * switches"; the parts and their lines: pauses.ts in core). Everything reads them through here.
 *   - `PAUSE_<NAME>` = "1" (or true, yes, on) rests that part: PAUSE_CLASSIC, PAUSE_CROWD, PAUSE_RAID, PAUSE_SQUADS,
 *     PAUSE_SOLO, PAUSE_SHOP, PAUSE_FRIENDS, PAUSE_BOSS_<ID> (e.g. PAUSE_BOSS_PIG). Unset, "0" or anything else: on.
 *   - `MAINTENANCE_BANNER`: a short message at the top of every screen while it's set (at most 200 characters).
 * Read at most once a minute per Worker instance (CACHE_MS). Changing a variable in the dashboard deploys a new version
 * of the Worker, whose instances start with nothing cached, so in practice a change applies within seconds of that
 * deploy; the cache matters only if the switches ever move to storage (KV, D1).
 */
export interface KillSwitchEnv {
  MAINTENANCE_BANNER?: string;
  [key: `PAUSE_${string}`]: string | undefined;
}

export interface SwitchStatus {
  /** The parts resting now (pauses.ts: "squads", "boss:pig", …). */
  paused: Pausable[];
  /** The maintenance banner's message, or null. */
  banner: string | null;
}

export const CACHE_MS = 60_000;
const BANNER_MAX = 200;
let cache: { at: number; status: SwitchStatus } | null = null;

const on = (v: unknown) => typeof v === "string" && /^(1|true|yes|on)$/i.test(v.trim());

function read(env: object): SwitchStatus {
  const vars = env as Record<string, unknown>;
  const banner = typeof vars.MAINTENANCE_BANNER === "string" ? vars.MAINTENANCE_BANNER.trim().slice(0, BANNER_MAX) : "";
  return { paused: allPausable().filter((k) => on(vars[pauseVariable(k)])), banner: banner || null };
}

/** The switches as this Worker instance last read them (again once CACHE_MS has passed). */
export function switchStatus(env: object, now = Date.now()): SwitchStatus {
  if (!cache || now - cache.at >= CACHE_MS) cache = { at: now, status: read(env) };
  return cache.status;
}

/** Whether this part is resting. */
export const isPaused = (env: object, what: Pausable, now?: number): boolean => switchStatus(env, now).paused.includes(what);

/** The bosses resting, by id (a new lobby's `bossesOff`). */
export const pausedBosses = (env: object, now?: number): string[] => bossesOff(switchStatus(env, now).paused);

/** The server's answer to something new while its part is resting: 503, the friendly line, and which part. */
export const pausedResponse = (what: Pausable): Response =>
  new Response(JSON.stringify({ message: pausedLine(what), paused: what }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** Forgets what was read (tests). */
export function clearSwitchCache(): void {
  cache = null;
}
