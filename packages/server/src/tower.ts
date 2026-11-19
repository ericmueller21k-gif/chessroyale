import { BATTLE_TOWER, finishFloor, floorSettings, leaveFloor, newRun, pausedLine, sideRefusal, startFloor, towerPool, type Settings, type TowerRun } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";

/**
 * The Battle Tower's saving (docs/decisions/2026-11-18-battle-tower-design.md, section 5; docs/areas/battle-tower.md, "Saving"): a
 * climb is stored on the server, a guest's too (a guest is a server account: its cookie), so it's stopped after any floor and
 * continued later, on any device, and it moves to the account a guest signs in to (towerMoves, in the sign-in's one batch).
 * The rules are core's (tower.ts: newRun, startFloor, finishFloor, leaveFloor): this file only keeps their run, notes when each
 * floor began by the server's own clock, and takes a floor's result once, for the floor it started.
 *
 *   - A solo floor is played on the device, so its result is the device's word, as Boss alone's (`finishSoloBattle`; the design
 *     pays solo no bonus): the server checks it's the floor it started, that a win didn't come sooner than any real one could
 *     (BATTLE_TOWER.soloWinMinSeconds), and never takes a second result for it.
 *   - The seed is the server's, never the device's; the bosses dealt come from the tower's pool with the kill switches applied.
 *   - A party's run (kind 'party', `members`) has its rows here, but nothing writes them yet: its match room will (PR 12).
 *
 * Tables (each an account's: account-data.ts, "tower"):
 *   - `tower_runs`: one row a climb. `floor`: the floor to fight (1-99; for a run that ended, the floor it ended on, 99 for the top);
 *     `met`: core's TowerRun deal (JSON: `floors` dealt so far, each one's bosses in turn order, the last the floor to fight; the
 *     `deck` still to deal; how many `decks` were shuffled from `seed`); `fight`: the floor under way, `{ id, startedAt }`, null
 *     between floors; `last`: the last result taken, `{ id, outcome, floor, status }` (its floor's id, the floor and the run's
 *     status after), so a retry whose answer was lost is answered again; `status`: 'open' | 'top' (floor 99 won) | 'out' (lost,
 *     drawn or left) | 'abandoned' (the lower of two open runs a sign-in brought together). One open run an account and kind: the
 *     unique index. A run that ended stays until the account starts its next run of that kind, which deletes an open one it
 *     replaces too (so each account keeps at most a few rows).
 *   - `tower_best`: the best floor won, an account and kind (1-99; 99 is the top, BATTLE_TOWER.floors its cap); it only rises.
 * (Only types come from accounts.ts: it imports this file's schema while it loads.)
 */
export const TOWER_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tower_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    seed INTEGER NOT NULL,
    floor INTEGER NOT NULL,
    met TEXT NOT NULL,
    members TEXT,
    fight TEXT,
    last TEXT,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  // One open run each, solo and party.
  `CREATE UNIQUE INDEX IF NOT EXISTS tower_runs_open ON tower_runs (user_id, kind) WHERE status = 'open'`,
  `CREATE INDEX IF NOT EXISTS tower_runs_user ON tower_runs (user_id, kind)`,
  `CREATE TABLE IF NOT EXISTS tower_best (
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    floor INTEGER NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (user_id, kind)
  )`,
];

export type TowerKind = "solo" | "party";
export type RunStatus = "open" | "top" | "out" | "abandoned";

/** A tower_runs row as stored. */
interface RunRow {
  id: string;
  user_id: string;
  kind: TowerKind;
  seed: number;
  floor: number;
  met: string;
  members: string | null;
  fight: string | null;
  last: string | null;
  status: RunStatus;
  started_at: number;
  updated_at: number;
}

/** The floor under way: its id (the device sends it back with the result) and when it began, by the server's clock. */
export interface Fight {
  id: string;
  startedAt: number;
}

/** A run as the app sees it. */
export interface TowerRunView {
  id: string;
  kind: TowerKind;
  /** The floor to fight (1-99). */
  floor: number;
  /** Its bosses in the order they take turns: the floor under way's, or as its start would deal them now (the kill switches). */
  bosses: string[];
  /** The floors won so far, each one's bosses, floor 1 first. */
  beaten: string[][];
  /** The floor under way, or null between floors. */
  fight: Fight | null;
  startedAt: number;
}

/** GET /api/tower: your open runs and your best floors (0: none won yet). */
export interface TowerState {
  runs: Record<TowerKind, TowerRunView | null>;
  best: Record<TowerKind, number>;
}

/** An answer: its HTTP status and body. */
export interface TowerAnswer {
  status: number;
  body: Record<string, unknown>;
}

export const TOWER_LINES = {
  replace: (floor: number) => `You have a run on floor ${floor}. Starting a new one ends it.`,
  noRun: "No run to continue. Start a new one.",
  resting: "The tower's bosses are resting for a bit. Back soon.",
  notUnderWay: "That floor isn't under way.",
  tooSoon: "That floor only just began.",
  partyLater: "Party runs aren't open yet.",
  bad: "Bad request",
} as const;

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });
const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
/** A floor's id: 18 hex characters (as a solo battle's). */
const FIGHT_ID = /^[0-9a-f]{18}$/;
const RUN_COLUMNS = "id, user_id, kind, seed, floor, met, members, fight, last, status, started_at, updated_at";

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const parsed = (text: string | null): Record<string, unknown> | null => {
  if (!text) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** The run core's rules work on, from its row. */
export function runOf(row: Pick<RunRow, "seed" | "met" | "status">): TowerRun {
  const met = parsed(row.met) ?? {};
  return {
    seed: row.seed >>> 0,
    floors: Array.isArray(met.floors) ? met.floors.map(strings) : [],
    deck: strings(met.deck),
    decks: typeof met.decks === "number" && Number.isInteger(met.decks) ? met.decks : 0,
    status: row.status === "open" ? "open" : row.status === "top" ? "top" : "out",
  };
}

/** A run's deal as stored (`met`). */
const metOf = (run: TowerRun) => JSON.stringify({ floors: run.floors, deck: run.deck, decks: run.decks });

/** A row's floor under way, or null. */
export function fightOf(text: string | null): Fight | null {
  const f = parsed(text);
  return f && typeof f.id === "string" && typeof f.startedAt === "number" ? { id: f.id, startedAt: f.startedAt } : null;
}

/** The app's view of an open run. Between floors, the floor's bosses are the ones its start would deal now (startFloor, `pool`). */
function viewOf(row: RunRow, pool: readonly string[]): TowerRunView {
  const run = runOf(row);
  const fight = fightOf(row.fight);
  const shown = fight ? run : (startFloor(run, pool)?.run ?? run);
  const floor = shown.floors.length;
  return { id: row.id, kind: row.kind, floor, bosses: [...(shown.floors[floor - 1] ?? [])], beaten: shown.floors.slice(0, Math.max(0, floor - 1)).map((f) => [...f]), fight, startedAt: row.started_at };
}

const openRow = (sql: Sql, userId: string, kind: TowerKind) => sql.first<RunRow>(`SELECT ${RUN_COLUMNS} FROM tower_runs WHERE user_id = ? AND kind = ? AND status = 'open'`, userId, kind);

/**
 * The account's solo best, worked out again from its solo runs (each run's floors won: its floor less one, or 99 for the top; never
 * above BATTLE_TOWER.floors, should a run be saved above it), and only ever raised. Run after a floor's result (and its retry) and
 * before a run's rows go, so a best the result's own write didn't reach (the Worker stopped between the two) is set right on the
 * next one. (A party's best is each member's, from their own floors: its match room's, PR 12.)
 */
const soloBest = (userId: string): Stmt =>
  stmt(
    `INSERT INTO tower_best (user_id, kind, floor, at)
     SELECT user_id, kind, won, updated_at FROM (
       SELECT user_id, kind, MIN(CASE WHEN status = 'top' THEN floor ELSE floor - 1 END, ?) AS won, updated_at FROM tower_runs WHERE user_id = ? AND kind = 'solo'
     ) WHERE won > 0
     ON CONFLICT (user_id, kind) DO UPDATE SET floor = excluded.floor, at = excluded.at WHERE excluded.floor > tower_best.floor`,
    BATTLE_TOWER.floors,
    userId,
  );
const runStmt = (sql: Sql, s: Stmt) => sql.run(s.sql, ...s.params);

/** The open solo run's view and the solo best: what an answer that refuses a result carries, for the app to read the run again. */
async function soloNow(sql: Sql, userId: string, pool: readonly string[]): Promise<{ run: TowerRunView | null; best: number }> {
  const state = await towerState(sql, userId, pool);
  return { run: state.runs.solo, best: state.best.solo };
}

/** A run whose deal (`met`) doesn't parse (only this file writes it): no floor to play, so the app offers a new run (`confirm`). */
const BROKEN: TowerAnswer = { status: 409, body: { message: TOWER_LINES.noRun, confirm: true } };

/**
 * Whether the floor under way's bosses no longer pass the tower's pool now (sideRefusal: a kill switch on since it began, a boss gone
 * from the roster, a pair `apart` keeps apart since): our pause, not the player's leave, so leaving it is free (stopTower).
 */
const floorResting = (run: TowerRun, pool: readonly string[]) => sideRefusal(run.floors[run.floors.length - 1] ?? [], pool) !== null;

/** GET /api/tower: your open runs (between floors, the next floor's bosses as dealt now) and your bests. */
export async function towerState(sql: Sql, userId: string, pool: readonly string[]): Promise<TowerState> {
  const [rows, bests] = await Promise.all([
    sql.all<RunRow>(`SELECT ${RUN_COLUMNS} FROM tower_runs WHERE user_id = ? AND status = 'open'`, userId),
    sql.all<{ kind: string; floor: number }>("SELECT kind, floor FROM tower_best WHERE user_id = ?", userId),
  ]);
  const run = (kind: TowerKind) => {
    const row = rows.find((r) => r.kind === kind);
    return row ? viewOf(row, pool) : null;
  };
  const best = (kind: TowerKind) => bests.find((b) => b.kind === kind)?.floor ?? 0;
  return { runs: { solo: run("solo"), party: run("party") }, best: { solo: best("solo"), party: best("party") } };
}

/**
 * POST /api/tower/run: a new solo run from the server's seed, floor 1 dealt from the pool now. An open run is replaced only with
 * `confirm` (it's deleted, in the same batch, once its floors count to the best): without, the answer is 409 with that run, for
 * the app to ask. The account's runs of this kind that ended go as the new one begins (its best stays). The unique index keeps it
 * to one open run even when two starts race: the one that loses is answered as if it had asked without `confirm`.
 */
export async function newTowerRun(sql: Sql, userId: string, now: number, opts: { confirm: boolean; pool: readonly string[]; seed?: number }): Promise<TowerAnswer> {
  const run = newRun(opts.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!, opts.pool);
  if (!run.floors[0]?.length) return { status: 503, body: { message: TOWER_LINES.resting } };
  const id = randomHex(12);
  const statements = [
    soloBest(userId),
    stmt(`DELETE FROM tower_runs WHERE user_id = ? AND kind = 'solo'${opts.confirm ? "" : " AND status <> 'open'"}`, userId),
    stmt(
      `INSERT INTO tower_runs (${RUN_COLUMNS}) VALUES (?, ?, 'solo', ?, 1, ?, NULL, NULL, NULL, 'open', ?, ?)`,
      id,
      userId,
      run.seed,
      metOf(run),
      now,
      now,
    ),
  ];
  const held = async (): Promise<TowerAnswer | null> => {
    const open = await openRow(sql, userId, "solo");
    return open ? { status: 409, body: { message: TOWER_LINES.replace(open.floor), confirm: true, run: viewOf(open, opts.pool) } } : null;
  };
  if (!opts.confirm) {
    const first = await held();
    if (first) return first;
  }
  try {
    await sql.batch(statements);
  } catch (e) {
    // (Another start made an open run since: the unique index refused this one, and the batch wrote nothing.)
    const raced = await held();
    if (raced) return raced;
    throw e;
  }
  const row = await sql.first<RunRow>(`SELECT ${RUN_COLUMNS} FROM tower_runs WHERE id = ?`, id);
  return { status: 200, body: { run: viewOf(row!, opts.pool) } };
}

/**
 * POST /api/tower/floor/start: the open solo run's floor begins. Its bosses from the run's deal (startFloor: dealt again if the pool
 * no longer allows them, and saved so), its start noted by the server's clock (`fight`). A floor already under way is answered as
 * it is (`under`: a retry, or a reload rejoining it), never begun again: the same id, the same start; that, even while solo rests
 * (`paused`, which refuses only a new floor); `resting` when its bosses no longer pass the pool (floorResting: leaving it is free).
 * Answers the floor's settings for the match runner.
 */
export async function startTowerFloor(sql: Sql, userId: string, now: number, opts: { pool: readonly string[]; paused?: boolean }): Promise<TowerAnswer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await openRow(sql, userId, "solo");
    if (!row) return { status: 404, body: { message: TOWER_LINES.noRun } };
    const run = runOf(row);
    if (!run.floors.length) return BROKEN;
    const under = fightOf(row.fight);
    if (under) return { status: 200, body: floorAnswer(row, run, under, opts.pool, true) };
    if (opts.paused) return SOLO_RESTING;
    const started = startFloor(run, opts.pool);
    const floor = run.floors.length;
    if (!started || !started.run.floors[floor - 1]?.length) return { status: 503, body: { message: TOWER_LINES.resting } };
    const fight: Fight = { id: randomHex(9), startedAt: now };
    // (Only over the run as it was read: a result or another start in between, and this one reads it again.)
    const done = await sql.first(
      "UPDATE tower_runs SET met = ?, fight = ?, updated_at = ? WHERE id = ? AND status = 'open' AND fight IS NULL AND met = ? RETURNING id",
      metOf(started.run),
      JSON.stringify(fight),
      now,
      row.id,
      row.met,
    );
    if (done) return { status: 200, body: floorAnswer({ ...row, met: metOf(started.run), fight: JSON.stringify(fight) }, started.run, fight, opts.pool, false) };
  }
  return { status: 409, body: { message: TOWER_LINES.notUnderWay } };
}

function floorAnswer(row: RunRow, run: TowerRun, fight: Fight, pool: readonly string[], under: boolean): Record<string, unknown> {
  const settings: Partial<Settings> = floorSettings(run);
  const marks = under ? { under: true, ...(floorResting(run, pool) ? { resting: true } : {}) } : {};
  return { fight, floor: run.floors.length, bosses: [...(run.floors[run.floors.length - 1] ?? [])], settings, ...marks, run: viewOf(row, pool) };
}

/** A floor's end, as the device reports it. */
export type FloorOutcome = "won" | "lost" | "drawn";
const isOutcome = (v: unknown): v is FloorOutcome => v === "won" || v === "lost" || v === "drawn";

/**
 * POST /api/tower/floor/finish {fight, outcome}: the solo floor under way ends. Only the floor the server started (`fight`, its id),
 * once: the run's floor, deal and status change, its `fight` clears and `last` notes the result, in one statement that applies only
 * while that floor is still under way. So a second result (two tabs) finds none: the same result as the last one taken (a retry
 * whose answer was lost) is answered again, any other refused (409); either way with the run and best as they are now. Won: the
 * next floor dealt (finishFloor, the pool now), or the top on floor 99; refused while sooner than `minWinMs` after the start (the
 * floor stays under way). Lost or drawn: the run is out. The best is worked out again after (soloBest).
 */
export async function finishTowerFloor(sql: Sql, userId: string, now: number, body: { fight?: unknown; outcome?: unknown }, opts: { pool: readonly string[]; minWinMs: number }): Promise<TowerAnswer> {
  if (typeof body.fight !== "string" || !FIGHT_ID.test(body.fight) || !isOutcome(body.outcome)) return { status: 400, body: { message: TOWER_LINES.bad } };
  const outcome = body.outcome;
  const row = await openRow(sql, userId, "solo");
  const fight = row ? fightOf(row.fight) : null;
  if (!row || !fight || fight.id !== body.fight) return resultAgain(sql, userId, body.fight, outcome, opts.pool);
  const before = runOf(row);
  if (!before.floors.length) return BROKEN;
  if (outcome === "won" && now - fight.startedAt < opts.minWinMs) return { status: 409, body: { message: TOWER_LINES.tooSoon, fight, ...(await soloNow(sql, userId, opts.pool)) } };
  const after = finishFloor(before, outcome, opts.pool);
  const floor = before.floors.length;
  const applied = await sql.first(
    "UPDATE tower_runs SET floor = ?, met = ?, status = ?, fight = NULL, last = ?, updated_at = ? WHERE id = ? AND status = 'open' AND fight = ? RETURNING id",
    after.floors.length,
    metOf(after),
    after.status,
    JSON.stringify({ id: body.fight, outcome, floor, status: after.status }),
    now,
    row.id,
    row.fight,
  );
  if (!applied) return resultAgain(sql, userId, body.fight, outcome, opts.pool);
  await runStmt(sql, soloBest(userId));
  return { status: 200, body: { outcome, floor, status: after.status, ...(await soloNow(sql, userId, opts.pool)) } };
}

/**
 * A result for a floor not under way. The same one as the last result taken (`last`: the same id and outcome; a retry whose answer
 * was lost, or the same result from two tabs) is answered as it was, changing nothing but the best, worked out again in case its
 * own write was missed; any other is refused (409). Both with the run and best as they are now: a 409 means "read the run again".
 */
async function resultAgain(sql: Sql, userId: string, id: string, outcome: FloorOutcome, pool: readonly string[]): Promise<TowerAnswer> {
  const lasts = await sql.all<{ last: string }>("SELECT last FROM tower_runs WHERE user_id = ? AND kind = 'solo' AND last IS NOT NULL", userId);
  const taken = lasts.map((r) => parsed(r.last)).find((l) => l?.id === id && l.outcome === outcome);
  if (!taken) return { status: 409, body: { message: TOWER_LINES.notUnderWay, ...(await soloNow(sql, userId, pool)) } };
  await runStmt(sql, soloBest(userId));
  return { status: 200, body: { outcome, floor: taken.floor, status: taken.status, ...(await soloNow(sql, userId, pool)) } };
}

/**
 * POST /api/tower/stop {fight?, moves?}: Stop here. Between floors there's nothing to do: the run is saved as it is (`stopped`
 * "between"). Mid-floor, only for the floor under way (`fight`, its id: never a floor started since), by core's leaveFloor: before
 * your 2nd move (`moves`, your moves on it, the device's word; none said, a counted leave) it's free, the same floor and bosses
 * later ("free"); after, a loss and the run is out ("lost"). Free at any move when the floor's bosses no longer pass the pool
 * (floorResting: our pause, not your leave; its next start deals it again). Once, as a result is: the run changes only while that
 * floor is still under way, so a repeat finds nothing under way and answers "between", changing nothing; a floor started since is
 * refused (409).
 */
export async function stopTower(sql: Sql, userId: string, now: number, body: { fight?: unknown; moves?: unknown }, opts: { pool: readonly string[] }): Promise<TowerAnswer> {
  const row = await openRow(sql, userId, "solo");
  const fight = row ? fightOf(row.fight) : null;
  // (Nothing under way: a stop between floors, or a repeat of one that already ended its floor: nothing to do, the run as it is.)
  if (!row || !fight) return { status: 200, body: { stopped: "between", run: row ? viewOf(row, opts.pool) : null } };
  if (body.fight !== fight.id) return { status: 409, body: { message: TOWER_LINES.notUnderWay, fight, run: viewOf(row, opts.pool) } };
  const moves = typeof body.moves === "number" && Number.isInteger(body.moves) && body.moves >= 0 ? body.moves : Number.POSITIVE_INFINITY;
  const before = runOf(row);
  const after = leaveFloor(before, floorResting(before, opts.pool) ? 0 : moves);
  const applied = await sql.first(
    "UPDATE tower_runs SET floor = ?, met = ?, status = ?, fight = NULL, updated_at = ? WHERE id = ? AND status = 'open' AND fight = ? RETURNING id",
    after.floors.length,
    metOf(after),
    after.status,
    now,
    row.id,
    row.fight,
  );
  if (!applied) return { status: 409, body: { message: TOWER_LINES.notUnderWay } };
  const free = after.status === "open";
  const open = free ? viewOf({ ...row, fight: null, updated_at: now }, opts.pool) : null;
  return { status: 200, body: { stopped: free ? "free" : "lost", floor: before.floors.length, status: after.status, run: open } };
}

/** Solo resting (PAUSE_SOLO): kill-switches.ts's pausedResponse, as an answer. */
const SOLO_RESTING: TowerAnswer = { status: 503, body: { message: pausedLine("solo"), paused: "solo" } };

/** What the routes need from the Worker: the kill switches, and whether test switches are on here. */
export interface TowerEnv {
  /** The bosses resting (kill switches): never dealt. */
  off: readonly string[];
  /** Solo resting (PAUSE_SOLO): no new run or floor; a floor under way still answers, finishes and stops (a match running finishes). */
  soloPaused: boolean;
  /** TEST_SWITCHES is "1" here (local, e2e, staging): a win isn't held to BATTLE_TOWER.soloWinMinSeconds. */
  testSwitches: boolean;
}

/** The routes under /api/tower whose body is JSON (POST). */
const POSTS = new Set(["/api/tower/run", "/api/tower/floor/start", "/api/tower/floor/finish", "/api/tower/stop"]);

/**
 * The tower's routes, for the account behind the request (api.ts, after its session: a guest's cookie as anyone's; the API's rate
 * limits and ban gate before it, index.ts). Null: not one of them.
 *   GET /api/tower → TowerState
 *   POST /api/tower/run {kind?: "solo", confirm?: true} → {run} | 409 {message, confirm, run}
 *   POST /api/tower/floor/start → {fight, floor, bosses, settings, under?, resting?, run} | 404 | 409 {message, confirm} (a run that
 *     can't be played: start a new one) | 503 (the bosses resting)
 *   POST /api/tower/floor/finish {fight, outcome: "won" | "lost" | "drawn"} → {outcome, floor, status, run, best} (the same answer for
 *     the last result taken, sent again) | 409 {message, run, best, fight?} (read the run again) | 409 {message, confirm}
 *   POST /api/tower/stop {fight?, moves?} → {stopped: "between" | "free" | "lost", run, …} | 409
 */
export async function towerResponse(request: Request, sql: Sql, userId: string, env: TowerEnv, now: number): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== "/api/tower" && !POSTS.has(path)) return null;
  const pool = towerPool(env.off);
  const answer = (a: TowerAnswer) => json(a.body, a.status);
  if (path === "/api/tower") return request.method === "GET" ? json(await towerState(sql, userId, pool)) : null;
  if (request.method !== "POST") return null;
  const b = ((await request.json().catch(() => null)) ?? {}) as { kind?: unknown; confirm?: unknown; fight?: unknown; outcome?: unknown; moves?: unknown };
  if (b.kind !== undefined && b.kind !== "solo") return json({ message: b.kind === "party" ? TOWER_LINES.partyLater : TOWER_LINES.bad }, 400);
  if (path === "/api/tower/run") return answer(env.soloPaused ? SOLO_RESTING : await newTowerRun(sql, userId, now, { confirm: b.confirm === true, pool }));
  if (path === "/api/tower/floor/start") return answer(await startTowerFloor(sql, userId, now, { pool, paused: env.soloPaused }));
  if (path === "/api/tower/floor/finish") return answer(await finishTowerFloor(sql, userId, now, b, { pool, minWinMs: env.testSwitches ? 0 : BATTLE_TOWER.soloWinMinSeconds * 1000 }));
  return answer(await stopTower(sql, userId, now, b, { pool }));
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * A guest's climbs and bests join the account it signs in to, for the sign-in's one batch (accounts.ts). Bests: the higher of each
 * kind's. Two open runs of one kind: the higher floor stays open (the account's on a tie), the other is abandoned; then every run of
 * the guest's is the account's (one open each: the unique index holds). (A party run's `members` naming the guest: PR 12's.)
 */
export const towerMoves = (from: string, to: string, now: number): Stmt[] => [
  stmt(
    `INSERT INTO tower_best (user_id, kind, floor, at) SELECT ?, kind, floor, at FROM tower_best WHERE user_id = ?
     ON CONFLICT (user_id, kind) DO UPDATE SET floor = excluded.floor, at = excluded.at WHERE excluded.floor > tower_best.floor`,
    to,
    from,
  ),
  stmt("DELETE FROM tower_best WHERE user_id = ?", from),
  stmt(
    `UPDATE tower_runs SET status = 'abandoned', fight = NULL, updated_at = ? WHERE user_id = ? AND status = 'open'
     AND EXISTS (SELECT 1 FROM tower_runs o WHERE o.user_id = ? AND o.kind = tower_runs.kind AND o.status = 'open' AND o.floor >= tower_runs.floor)`,
    now,
    from,
    to,
  ),
  stmt(
    `UPDATE tower_runs SET status = 'abandoned', fight = NULL, updated_at = ? WHERE user_id = ? AND status = 'open'
     AND EXISTS (SELECT 1 FROM tower_runs g WHERE g.user_id = ? AND g.kind = tower_runs.kind AND g.status = 'open')`,
    now,
    to,
    from,
  ),
  stmt("UPDATE tower_runs SET user_id = ? WHERE user_id = ?", to, from),
];

/** The last result taken, for the download: its outcome and floor (not the floor's id, the game's own). */
function lastResult(text: string | null) {
  const l = parsed(text);
  return l ? { outcome: l.outcome, floor: l.floor } : null;
}

/** The account's part of "Download my data": its climbs (each one's floors met, never the seed or the deck still to deal) and bests. */
export async function towerDownload(sql: Sql, userId: string): Promise<{ runs: unknown[]; best: unknown[] }> {
  const rows = await sql.all<RunRow>(`SELECT ${RUN_COLUMNS} FROM tower_runs WHERE user_id = ? ORDER BY started_at, id`, userId);
  return {
    runs: rows.map((r) => ({
      kind: r.kind,
      floor: r.floor,
      status: r.status,
      floors: runOf(r).floors,
      last_result: lastResult(r.last),
      fight_at: fightOf(r.fight)?.startedAt ?? null,
      started_at: r.started_at,
      updated_at: r.updated_at,
    })),
    best: await sql.all("SELECT kind, floor, at FROM tower_best WHERE user_id = ? ORDER BY kind", userId),
  };
}

/** Deleting the account: its climbs and bests go. */
export const towerDeletes = (userId: string): Stmt[] => ["tower_runs", "tower_best"].map((t) => stmt(`DELETE FROM ${t} WHERE user_id = ?`, userId));
