import { BATTLE_TOWER, TOWER_PARTY, finishFloor, floorSettings, floorsWonBest, leaveFloor, livesLeft, newRun, pausedLine, sideRefusal, startFloor, towerPartySettings, towerPool, type Settings, type TowerRun } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";
import type { PartyFloorEnd } from "./lobby.ts";

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
 *   - A party's climb (kind 'party', Nov 20; docs/decisions/2026-11-20-tower-party.md) is one run with a copy for each member: one
 *     row each, the same seed and deal, `members` the run's key and who climbed it. The party's Durable Object starts each floor on
 *     every member's copy at once (preparePartyFloor, commitPartyFloor) and the floor's match room writes its result to each copy
 *     (partyFloorWrite), never a device. A member may play their copy on alone (the solo routes with `kind: "party"`): from then on
 *     it's the device's word, as a solo floor; the run's own members (two or more, nobody new) may climb it together again later.
 *     Lives (Nov 20): the room writes one result to every copy, so the party's copies spend their lives together; climbing on together
 *     again, the party holds the fewest lives any of its copies holds on that floor (preparePartyFloor).
 *
 * Tables (each an account's: account-data.ts, "tower"):
 *   - `tower_runs`: one row a climb. `floor`: the floor to fight (1-99; for a run that ended, the floor it ended on, 99 for the top);
 *     `met`: core's TowerRun deal (JSON: `floors` dealt so far, each one's bosses in turn order, the last the floor to fight; the
 *     `deck` still to deal; how many `decks` were shuffled from `seed`; since Nov 20, once a floor is lost, `lost`, the floors lost,
 *     and `won`, the highest floor won, for the best: metOf); `fight`: the floor under way, `{ id, startedAt }`, null
 *     between floors; `last`: the last result taken, `{ id, outcome, floor, status, lost? }` (its floor's id, the floor and the run's
 *     status and floors lost after), so a retry whose answer was lost is answered again; `status`: 'open' | 'top' (floor 99 played
 *     through) | 'out' (a loss with no life left) | 'abandoned' (the lower of two open runs a sign-in brought together). One open run an account and kind: the
 *     unique index. A run that ended stays until the account starts its next run of that kind, which deletes an open one it
 *     replaces too (so each account keeps at most a few rows).
 *   - `tower_best`: the best floor won, an account and kind (1-99; 99 is the top, BATTLE_TOWER.floors its cap); it only rises. A floor
 *     lost with a life spent counts for the run's floor, never for a best (Nov 20: core floorsWonBest).
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

/**
 * The floor under way: its id (the device sends it back with the result), when it began, by the server's clock, and (audit 2, finding 3)
 * the id the starting device sent with the start: answered back, so a retry whose first answer was lost knows the floor is its own.
 */
export interface Fight {
  id: string;
  startedAt: number;
  device?: string;
  /** A party's floor: its match room's code (the room writes its result; no device may). */
  lobby?: string;
}

/**
 * A party copy's `members` (Nov 20): the run it's a copy of (`run`, one key on every member's copy), who climbed it (`uids`: the party
 * that began it, fixed from its first floor: nobody new joins a run), and `alone` while its holder plays it on by themselves (from
 * their first floor alone until the run's members climb it together again).
 *
 * `party` (the review of #835, finding 1): the floor this copy last reached with its party, set only by the party's writes (a START's
 * commit: the floor begun; the match room's write: the floor after), never by the alone routes, so floors won alone (the device's word)
 * never carry a re-formed party up. While it's played alone, `partyMet` keeps the run's deal as it stood on that floor (copied as its
 * first floor alone begins, when the copy is still on its party floor), so the party climbs on from there. A copy from before has
 * neither: its floor stands for both (no party copies existed before this PR).
 */
export interface PartyMembers {
  run: string;
  uids: string[];
  alone?: true;
  party?: number;
  partyMet?: string;
}
/** A copy's `members`, or null (a solo run's, or one that doesn't parse). */
export function membersOf(text: string | null): PartyMembers | null {
  const m = parsed(text);
  if (!m || typeof m.run !== "string" || !Array.isArray(m.uids)) return null;
  const party = typeof m.party === "number" && Number.isInteger(m.party) && m.party >= 1 ? { party: m.party } : {};
  return { run: m.run, uids: strings(m.uids), ...(m.alone === true ? { alone: true as const } : {}), ...party, ...(typeof m.partyMet === "string" ? { partyMet: m.partyMet } : {}) };
}
const membersText = (m: PartyMembers) =>
  JSON.stringify({ run: m.run, uids: m.uids, ...(m.alone ? { alone: true } : {}), ...(m.party !== undefined ? { party: m.party } : {}), ...(m.partyMet !== undefined ? { partyMet: m.partyMet } : {}) });
/** The floor a copy's party reached (`party`; a copy from before: its floor), never above the copy's own. */
const partyFloorOf = (row: Pick<RunRow, "floor">, m: PartyMembers) => Math.min(row.floor, m.party ?? row.floor);
/** A device's id for its starts: what the app makes (tower.ts deviceId). */
const DEVICE_ID = /^[0-9a-f]{16,32}$/;

/** A run as the app sees it. */
export interface TowerRunView {
  id: string;
  kind: TowerKind;
  /** The floor to fight (1-99). */
  floor: number;
  /** Its bosses in the order they take turns: the floor under way's, or as its start would deal them now (the kill switches). */
  bosses: string[];
  /** The floors climbed so far (won, or lost with a life spent: Nov 20), each one's bosses, floor 1 first. */
  beaten: string[][];
  /** The floor under way, or null between floors. */
  fight: Fight | null;
  startedAt: number;
  /** The lives left (Nov 20: BATTLE_TOWER.lives a run), and the floors lost so far, in order (the run's recap). */
  lives: number;
  lost: number[];
  /** A party copy's: the others who climbed it (their names now; an account deleted since is gone from it), and whether it's played on alone. */
  mates?: { uid: string; name: string }[];
  alone?: boolean;
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
  notFree: "That boss is back: leaving now counts as a loss.",
  partyStart: "A party's climb starts from its START at the clerk.",
  partyFloor: "Your party is on this floor. Its result comes from the match.",
  busy: (name: string) => `${name} is on a floor of their climb right now.`,
  gone: (name: string) => `${name}'s account has been deleted. Kick them to climb on.`,
  saving: (name: string) => `${name}'s last floor is still being saved.`,
  changed: "Something changed. Check the plan and ready up again.",
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

/** The run core's rules work on, from its row (a run saved before lives, Nov 20: none lost). */
export function runOf(row: Pick<RunRow, "seed" | "met" | "status">): TowerRun {
  const met = parsed(row.met) ?? {};
  return {
    seed: row.seed >>> 0,
    floors: Array.isArray(met.floors) ? met.floors.map(strings) : [],
    deck: strings(met.deck),
    decks: typeof met.decks === "number" && Number.isInteger(met.decks) ? met.decks : 0,
    status: row.status === "open" ? "open" : row.status === "top" ? "top" : "out",
    lost: floorsOf(met.lost),
  };
}
/** A list of floor numbers as stored (whole, from 1). */
const floorsOf = (v: unknown): number[] => (Array.isArray(v) ? v.filter((f): f is number => typeof f === "number" && Number.isInteger(f) && f >= 1) : []);

/**
 * A run's deal as stored (`met`). Once a floor is lost (Nov 20), its `lost` floors and `won`, the highest floor won (core floorsWonBest),
 * which the best reads (soloBest): a run with none lost is stored as before, its best its floor less one (or 99 at the top).
 */
const metOf = (run: TowerRun) => JSON.stringify({ floors: run.floors, deck: run.deck, decks: run.decks, ...(run.lost.length ? { lost: run.lost, won: floorsWonBest(run) } : {}) });

/** A row's floor under way, or null. */
export function fightOf(text: string | null): Fight | null {
  const f = parsed(text);
  return f && typeof f.id === "string" && typeof f.startedAt === "number"
    ? { id: f.id, startedAt: f.startedAt, ...(typeof f.device === "string" ? { device: f.device } : {}), ...(typeof f.lobby === "string" ? { lobby: f.lobby } : {}) }
    : null;
}

/** The app's view of an open run. Between floors, the floor's bosses are the ones its start would deal now (startFloor, `pool`). */
function viewOf(row: RunRow, pool: readonly string[], names?: ReadonlyMap<string, string>): TowerRunView {
  const run = runOf(row);
  const fight = fightOf(row.fight);
  const shown = fight ? run : (startFloor(run, pool)?.run ?? run);
  const floor = shown.floors.length;
  const m = row.kind === "party" ? membersOf(row.members) : null;
  const party = m ? { mates: m.uids.filter((u) => u !== row.user_id).map((uid) => ({ uid, name: names?.get(uid) ?? "Player" })), alone: !!m.alone } : {};
  return {
    id: row.id,
    kind: row.kind,
    floor,
    bosses: [...(shown.floors[floor - 1] ?? [])],
    beaten: shown.floors.slice(0, Math.max(0, floor - 1)).map((f) => [...f]),
    fight,
    startedAt: row.started_at,
    lives: livesLeft(shown),
    lost: [...shown.lost],
    ...party,
  };
}

const openRow = (sql: Sql, userId: string, kind: TowerKind) => sql.first<RunRow>(`SELECT ${RUN_COLUMNS} FROM tower_runs WHERE user_id = ? AND kind = ? AND status = 'open'`, userId, kind);

/**
 * The account's solo best, worked out again from its solo runs (each run's highest floor won: `met.won` once a floor is lost (Nov 20:
 * a floor lost with a life spent never counts to a best), else its floor less one, or 99 for the top; never above BATTLE_TOWER.floors,
 * should a run be saved above it), and only ever raised. Run after a floor's result (and its retry) and before a run's rows go, so a
 * best the result's own write didn't reach (the Worker stopped between the two) is set right on the next one. (A party's best is each
 * member's, from their own floors: its match room's, PR 12.)
 */
const soloBest = (userId: string): Stmt =>
  stmt(
    `INSERT INTO tower_best (user_id, kind, floor, at)
     SELECT user_id, kind, won, updated_at FROM (
       SELECT user_id, kind, MIN(COALESCE(CASE WHEN json_valid(met) THEN json_extract(met, '$.won') END, CASE WHEN status = 'top' THEN floor ELSE floor - 1 END), ?) AS won, updated_at
       FROM tower_runs WHERE user_id = ? AND kind = 'solo'
     ) WHERE won > 0
     ON CONFLICT (user_id, kind) DO UPDATE SET floor = excluded.floor, at = excluded.at WHERE excluded.floor > tower_best.floor`,
    BATTLE_TOWER.floors,
    userId,
  );
const runStmt = (sql: Sql, s: Stmt) => sql.run(s.sql, ...s.params);

/**
 * The open run's view (solo, or the party copy played alone) and the solo best: what an answer that refuses a result carries, for the
 * app to read the run again. (A party copy played alone is solo from then on: its floors won alone count to the solo best.)
 */
async function soloNow(sql: Sql, userId: string, pool: readonly string[], kind: TowerKind = "solo"): Promise<{ run: TowerRunView | null; best: number }> {
  const state = await towerState(sql, userId, pool);
  return { run: state.runs[kind], best: state.best.solo };
}

/**
 * A floor won alone on a party copy (`floor`, the floor won; 99 the top): the solo best, only ever raised. A party copy's floors climbed
 * together are the party best's (partyFloorWrite), so this is written for each floor won alone, as it's taken (and again for its retry).
 */
const aloneBest = (userId: string, floor: number, now: number): Stmt =>
  stmt(
    `INSERT INTO tower_best (user_id, kind, floor, at) VALUES (?, 'solo', ?, ?)
     ON CONFLICT (user_id, kind) DO UPDATE SET floor = excluded.floor, at = excluded.at WHERE excluded.floor > tower_best.floor`,
    userId,
    Math.min(floor, BATTLE_TOWER.floors),
    now,
  );

/** The names of these accounts now (a party copy's mates), by id. */
async function namesOf(sql: Sql, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const found = await sql.all<{ id: string; name: string }>(`SELECT id, name FROM users WHERE id IN (${unique.map(() => "?").join(", ")})`, ...unique);
  return new Map(found.map((u) => [u.id, u.name]));
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
  const names = await namesOf(sql, rows.flatMap((r) => (r.kind === "party" ? (membersOf(r.members)?.uids ?? []) : [])));
  const run = (kind: TowerKind) => {
    const row = rows.find((r) => r.kind === kind);
    return row ? viewOf(row, pool, names) : null;
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
export async function startTowerFloor(sql: Sql, userId: string, now: number, opts: { pool: readonly string[]; paused?: boolean; device?: unknown; kind?: TowerKind; lobbyGone?: LobbyGone }): Promise<TowerAnswer> {
  const device = typeof opts.device === "string" && DEVICE_ID.test(opts.device) ? opts.device : undefined;
  const kind = opts.kind ?? "solo";
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await openRow(sql, userId, kind);
    if (!row) return { status: 404, body: { message: TOWER_LINES.noRun } };
    const run = runOf(row);
    if (!run.floors.length) return BROKEN;
    const under = fightOf(row.fight);
    // (A party copy's floor under way with its party: the match room's, never this device's; one whose room has gone without a result
    // is let go first, free: settleStale.)
    if (under?.lobby) {
      if (await settleStale(sql, row, under, now, opts.lobbyGone)) continue;
      return { status: 409, body: { message: TOWER_LINES.partyFloor, party: true, run: viewOf(row, opts.pool) } };
    }
    if (under) return { status: 200, body: floorAnswer(row, run, under, opts.pool, true) };
    if (opts.paused) return SOLO_RESTING;
    const started = startFloor(run, opts.pool);
    const floor = run.floors.length;
    if (!started || !started.run.floors[floor - 1]?.length) return { status: 503, body: { message: TOWER_LINES.resting } };
    const fight: Fight = { id: randomHex(9), startedAt: now, ...(device ? { device } : {}) };
    // (A party copy played on alone is marked so (PartyMembers.alone) as its first floor alone begins; its party floor and the deal
    // there are kept as they stand then (`party`, `partyMet`): the party's to climb on from, never moved by a floor alone.)
    const m = kind === "party" ? membersOf(row.members) : null;
    const members = !m || m.alone ? row.members : membersText({ ...m, alone: true, party: partyFloorOf(row, m), partyMet: row.met });
    // (Only over the run as it was read: a result or another start in between, and this one reads it again.)
    const done = await sql.first(
      "UPDATE tower_runs SET met = ?, members = ?, fight = ?, updated_at = ? WHERE id = ? AND status = 'open' AND fight IS NULL AND met = ? AND members IS ? RETURNING id",
      metOf(started.run),
      members,
      JSON.stringify(fight),
      now,
      row.id,
      row.met,
      row.members,
    );
    if (done) return { status: 200, body: floorAnswer({ ...row, met: metOf(started.run), members, fight: JSON.stringify(fight) }, started.run, fight, opts.pool, false) };
  }
  return { status: 409, body: { message: TOWER_LINES.notUnderWay } };
}

/**
 * Whether a party floor's match room has gone (closed, or its code another room's now: it no longer holds that floor, `fight`): its
 * answer, or null when it couldn't be asked.
 */
export type LobbyGone = (fight: Fight) => Promise<boolean | null>;

/**
 * A party copy's floor whose match room has gone without writing its result (the room always writes it, its closing waiting for it:
 * only a failure of ours gets here): let go, free (the same floor and bosses fought again), never a loss the room didn't see. True: it
 * was (or another write changed the copy meanwhile): read it again. Not when the room is still there, or couldn't be asked.
 */
async function settleStale(sql: Sql, row: RunRow, fight: Fight, now: number, gone: LobbyGone | undefined): Promise<boolean> {
  if (!fight.lobby || !gone || (await gone(fight).catch(() => null)) !== true) return false;
  console.log(`tower: ${row.id}: the party floor's room ${fight.lobby} has gone without a result; the floor is let go (free)`);
  await sql.run("UPDATE tower_runs SET fight = NULL, updated_at = ? WHERE id = ? AND fight = ?", now, row.id, row.fight);
  return true;
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
 * floor stays under way). Lost or drawn (Nov 20): a life spent and the climb on, the next floor dealt as after a win; with none left,
 * the run is out. The answer carries the lives left and the floors lost (the result screen's words). The best is worked out again
 * after (soloBest).
 */
export async function finishTowerFloor(sql: Sql, userId: string, now: number, body: { fight?: unknown; outcome?: unknown }, opts: { pool: readonly string[]; minWinMs: number; kind?: TowerKind }): Promise<TowerAnswer> {
  if (typeof body.fight !== "string" || !FIGHT_ID.test(body.fight) || !isOutcome(body.outcome)) return { status: 400, body: { message: TOWER_LINES.bad } };
  const outcome = body.outcome;
  const kind = opts.kind ?? "solo";
  const row = await openRow(sql, userId, kind);
  const fight = row ? fightOf(row.fight) : null;
  if (!row || !fight || fight.id !== body.fight) return resultAgain(sql, userId, body.fight, outcome, opts.pool, kind);
  // (A party's floor: its match room writes the result, never a device.)
  if (fight.lobby) return { status: 409, body: { message: TOWER_LINES.partyFloor, ...(await soloNow(sql, userId, opts.pool, kind)) } };
  const before = runOf(row);
  if (!before.floors.length) return BROKEN;
  if (outcome === "won" && now - fight.startedAt < opts.minWinMs) return { status: 409, body: { message: TOWER_LINES.tooSoon, fight, ...(await soloNow(sql, userId, opts.pool, kind)) } };
  const after = finishFloor(before, outcome, opts.pool);
  const floor = before.floors.length;
  const applied = await sql.first(
    "UPDATE tower_runs SET floor = ?, met = ?, status = ?, fight = NULL, last = ?, updated_at = ? WHERE id = ? AND status = 'open' AND fight = ? RETURNING id",
    after.floors.length,
    metOf(after),
    after.status,
    JSON.stringify({ id: body.fight, outcome, floor, status: after.status, ...(after.lost.length ? { lost: after.lost } : {}) }),
    now,
    row.id,
    row.fight,
  );
  if (!applied) return resultAgain(sql, userId, body.fight, outcome, opts.pool, kind);
  if (kind === "solo") await runStmt(sql, soloBest(userId));
  else if (outcome === "won") await runStmt(sql, aloneBest(userId, floor, now));
  return { status: 200, body: { outcome, floor, status: after.status, ...livesNow(after.status, after.lost), ...(await soloNow(sql, userId, opts.pool, kind)) } };
}

/** The lives left after a result and the run's floors lost (Nov 20), for its answer: none left for a run that's out. */
const livesNow = (status: unknown, lost: readonly number[]) => ({ lives: status === "out" ? 0 : livesLeft({ lost }), lost: [...lost] });

/**
 * A result for a floor not under way. The same one as the last result taken (`last`: the same id and outcome; a retry whose answer
 * was lost, or the same result from two tabs) is answered as it was, changing nothing but the best, worked out again in case its
 * own write was missed; any other is refused (409). Both with the run and best as they are now: a 409 means "read the run again".
 */
async function resultAgain(sql: Sql, userId: string, id: string, outcome: FloorOutcome, pool: readonly string[], kind: TowerKind = "solo"): Promise<TowerAnswer> {
  const lasts = await sql.all<{ last: string }>("SELECT last FROM tower_runs WHERE user_id = ? AND kind = ? AND last IS NOT NULL", userId, kind);
  // (A party's floor's result, which its room wrote, is never a device's to send again: `party` marks it.)
  const taken = lasts.map((r) => parsed(r.last)).find((l) => l?.id === id && l.outcome === outcome && !l.party);
  if (!taken) return { status: 409, body: { message: TOWER_LINES.notUnderWay, ...(await soloNow(sql, userId, pool, kind)) } };
  if (kind === "solo") await runStmt(sql, soloBest(userId));
  else if (outcome === "won" && typeof taken.floor === "number") await runStmt(sql, aloneBest(userId, taken.floor, Date.now()));
  return { status: 200, body: { outcome, floor: taken.floor, status: taken.status, ...livesNow(taken.status, floorsOf(taken.lost)), ...(await soloNow(sql, userId, pool, kind)) } };
}

/**
 * POST /api/tower/stop {fight?, moves?}: Stop here. Between floors there's nothing to do: the run is saved as it is (`stopped`
 * "between"). Mid-floor, only for the floor under way (`fight`, its id: never a floor started since), by core's leaveFloor: before
 * your 2nd move (`moves`, your moves on it, the device's word; none said, a counted leave) it's free, the same floor and bosses
 * later ("free"); after, a loss ("lost"): a life spent and the climb on (Nov 20), or with none left the run out (`status`, `lives`,
 * `lost` say which). Free at any move when the floor's bosses no longer pass the pool
 * (floorResting: our pause, not your leave; its next start deals it again). Once, as a result is: the run changes only while that
 * floor is still under way, so a repeat finds nothing under way and answers "between", changing nothing; a floor started since is
 * refused (409). `free: true` (the app offered a free leave): a leave that would count now (the boss back since the app was told
 * `resting`) is refused (409, the run as it is), never taken as a loss, so the app can ask again on the real terms (the delta review).
 */
export async function stopTower(sql: Sql, userId: string, now: number, body: { fight?: unknown; moves?: unknown; free?: unknown }, opts: { pool: readonly string[]; kind?: TowerKind }): Promise<TowerAnswer> {
  const row = await openRow(sql, userId, opts.kind ?? "solo");
  const fight = row ? fightOf(row.fight) : null;
  // (Nothing under way: a stop between floors, or a repeat of one that already ended its floor: nothing to do, the run as it is.)
  if (!row || !fight) return { status: 200, body: { stopped: "between", run: row ? viewOf(row, opts.pool) : null } };
  // (A party's floor: you leave it in its match, which writes it; never from here.)
  if (body.fight !== fight.id || fight.lobby) return { status: 409, body: { message: fight.lobby ? TOWER_LINES.partyFloor : TOWER_LINES.notUnderWay, fight, run: viewOf(row, opts.pool) } };
  const moves = typeof body.moves === "number" && Number.isInteger(body.moves) && body.moves >= 0 ? body.moves : Number.POSITIVE_INFINITY;
  const before = runOf(row);
  // (A deal that doesn't parse: as start and finish answer it, never a floor 0 written over the run's.)
  if (!before.floors.length) return BROKEN;
  const after = leaveFloor(before, floorResting(before, opts.pool) ? 0 : moves, opts.pool);
  // (A counted leave always puts the floor on `lost`, whether the climb goes on or not; a free one leaves the run as it was.)
  const free = after.lost.length === before.lost.length;
  if (body.free === true && !free) return { status: 409, body: { message: TOWER_LINES.notFree, fight, run: viewOf(row, opts.pool) } };
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
  const open = after.status === "open" ? viewOf({ ...row, floor: after.floors.length, met: metOf(after), fight: null, updated_at: now }, opts.pool) : null;
  return { status: 200, body: { stopped: free ? "free" : "lost", floor: before.floors.length, status: after.status, ...livesNow(after.status, after.lost), run: open } };
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
  /** Whether a party floor's match room has gone (a party copy's floor whose room never wrote its result: settleStale). */
  lobbyGone?: LobbyGone;
}

/** The routes under /api/tower whose body is JSON (POST). */
const POSTS = new Set(["/api/tower/run", "/api/tower/floor/start", "/api/tower/floor/finish", "/api/tower/stop"]);

/**
 * The tower's routes, for the account behind the request (api.ts, after its session: a guest's cookie as anyone's; the API's rate
 * limits and ban gate before it, index.ts). Null: not one of them.
 *   GET /api/tower → TowerState
 *   POST /api/tower/run {kind?: "solo", confirm?: true} → {run} | 409 {message, confirm, run} (a party's climb: its START, never here)
 *   (floor/start, floor/finish and stop take `kind: "party"`: your party copy, played on alone; Nov 20.)
 *   POST /api/tower/floor/start {device?} → {fight (with the starting device's id), floor, bosses, settings, under?, resting?, run} | 404 | 409 {message, confirm} (a run that
 *     can't be played: start a new one) | 503 (the bosses resting)
 *   POST /api/tower/floor/finish {fight, outcome: "won" | "lost" | "drawn"} → {outcome, floor, status, lives, lost, run, best} (the same
 *     answer for the last result taken, sent again) | 409 {message, run, best, fight?} (read the run again) | 409 {message, confirm}
 *   POST /api/tower/stop {fight?, moves?} → {stopped: "between" | "free" | "lost", run, status?, lives?, lost?, …} | 409
 */
export async function towerResponse(request: Request, sql: Sql, userId: string, env: TowerEnv, now: number): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== "/api/tower" && !POSTS.has(path)) return null;
  const pool = towerPool(env.off);
  const answer = (a: TowerAnswer) => json(a.body, a.status);
  if (path === "/api/tower") return request.method === "GET" ? json(await towerState(sql, userId, pool)) : null;
  if (request.method !== "POST") return null;
  const b = ((await request.json().catch(() => null)) ?? {}) as { kind?: unknown; confirm?: unknown; fight?: unknown; outcome?: unknown; moves?: unknown; free?: unknown; device?: unknown };
  if (b.kind !== undefined && b.kind !== "solo" && b.kind !== "party") return json({ message: TOWER_LINES.bad }, 400);
  const kind: TowerKind = b.kind === "party" ? "party" : "solo";
  if (path === "/api/tower/run") return kind === "party" ? json({ message: TOWER_LINES.partyStart }, 400) : answer(env.soloPaused ? SOLO_RESTING : await newTowerRun(sql, userId, now, { confirm: b.confirm === true, pool }));
  if (path === "/api/tower/floor/start") return answer(await startTowerFloor(sql, userId, now, { pool, paused: env.soloPaused, device: b.device, kind, ...(env.lobbyGone ? { lobbyGone: env.lobbyGone } : {}) }));
  if (path === "/api/tower/floor/finish") return answer(await finishTowerFloor(sql, userId, now, b, { pool, minWinMs: env.testSwitches ? 0 : BATTLE_TOWER.soloWinMinSeconds * 1000, kind }));
  return answer(await stopTower(sql, userId, now, b, { pool, kind }));
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * A guest's climbs and bests join the account it signs in to, for the sign-in's one batch (accounts.ts). Bests: the higher of each
 * kind's. Two open runs of one kind: the higher floor stays open (the account's on a tie), the other is abandoned; then every run of
 * the guest's is the account's (one open each: the unique index holds). A party copy's `members` naming the guest (a party played
 * where signing in isn't asked for: local and tests) name the account instead: the same person, so the run's members can still climb
 * it together (Nov 20; deleting an account takes its id out of them: towerDeletes); a copy naming both names the account once. That
 * statement reads every party copy, so it's only in the batch when the guest holds a party copy (`party`: holdsPartyCopy, read before
 * the batch; in production never, as guests can't sit in a tower party: the review of #835, finding 8).
 */
export const towerMoves = (from: string, to: string, now: number, opts: { party?: boolean } = {}): Stmt[] => [
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
  ...(opts.party
    ? [
        stmt(
          `UPDATE tower_runs SET members = json_set(members, '$.uids', json((
             SELECT json_group_array(CASE WHEN value = ? THEN ? ELSE value END) FROM json_each(tower_runs.members, '$.uids')
             WHERE value <> ? OR NOT EXISTS (SELECT 1 FROM json_each(tower_runs.members, '$.uids') WHERE value = ?))))
           WHERE kind = 'party' AND json_valid(members) AND EXISTS (SELECT 1 FROM json_each(tower_runs.members, '$.uids') WHERE value = ?)`,
          from,
          to,
          from,
          to,
          from,
        ),
      ]
    : []),
];

/** Whether this account holds a party copy, open or not (the sign-in merge's towerMoves `party`): one indexed read. */
export const holdsPartyCopy = async (sql: Sql, userId: string): Promise<boolean> => !!(await sql.first("SELECT 1 AS x FROM tower_runs WHERE user_id = ? AND kind = 'party' LIMIT 1", userId));

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
      // (The floors lost, Nov 20: each one cost a life.)
      lost: runOf(r).lost,
      // (A party copy: how many climbed it, never who: the others' accounts are theirs.)
      ...(r.kind === "party" ? { climbers: membersOf(r.members)?.uids.length ?? null, alone: !!membersOf(r.members)?.alone } : {}),
      last_result: lastResult(r.last),
      fight_at: fightOf(r.fight)?.startedAt ?? null,
      started_at: r.started_at,
      updated_at: r.updated_at,
    })),
    best: await sql.all("SELECT kind, floor, at FROM tower_best WHERE user_id = ? ORDER BY kind", userId),
  };
}

/**
 * Deleting the account: its climbs and bests go, and its id goes from the others' party copies (`members`: a run it climbed with them
 * no longer names it; Nov 20).
 */
export const towerDeletes = (userId: string): Stmt[] => [
  ...["tower_runs", "tower_best"].map((t) => stmt(`DELETE FROM ${t} WHERE user_id = ?`, userId)),
  stmt(
    `UPDATE tower_runs SET members = json_set(members, '$.uids', json((SELECT json_group_array(value) FROM json_each(tower_runs.members, '$.uids') WHERE value <> ?)))
     WHERE kind = 'party' AND instr(members, ?) > 0 AND json_valid(members)`,
    userId,
    JSON.stringify(userId),
  ),
];

// ---------------- A party's climb (Nov 20; docs/decisions/2026-11-20-tower-party.md) ----------------

/**
 * What a party's START does, from its people's copies now: their run on together from the party's floor (`back`: each copy above it,
 * played on alone, and its floor now: it goes back), or a new one (`ends`: the open copies it replaces).
 */
export type PartyPlan = { kind: "continue"; run: string; floor: number; back: { uid: string; floor: number }[] } | { kind: "new"; ends: { uid: string; floor: number }[] };

/**
 * What a party's START does (Eric, Nov 20: "how can they all team up again later from the same starting spot?"): when its people (two
 * or more) each hold an open copy of one run, and every one of them climbed it (each copy's `members`: nobody new joins a run already
 * climbed), they go on with it together, from the lowest floor any of them reached with the party (each copy's `party`: the director's
 * call, nobody is carried up a floor they didn't win with the party; floors won alone never count: the review of #835, finding 1), the
 * copies above it going back to it (`back`, each asked first). Anything else is a new run from floor 1, for everyone: `ends` names each open party copy it would
 * replace (each asked first: Eric, "starting a new party run with another party asks first").
 */
export function partyPlan(uids: readonly string[], copies: ReadonlyMap<string, Pick<RunRow, "floor" | "members">>): PartyPlan {
  const held = uids.map((u) => ({ uid: u, row: copies.get(u), m: membersOf(copies.get(u)?.members ?? null) }));
  const ends = held.flatMap((h) => (h.row ? [{ uid: h.uid, floor: h.row.floor }] : []));
  if (uids.length < 2 || held.some((h) => !h.m)) return { kind: "new", ends };
  const run = held[0]!.m!.run;
  const same = held.every((h) => h.m!.run === run && uids.every((u) => h.m!.uids.includes(u)));
  if (!same) return { kind: "new", ends };
  const floor = Math.min(...held.map((h) => partyFloorOf(h.row!, h.m!)));
  return { kind: "continue", run, floor, back: held.flatMap((h) => (h.row!.floor > floor ? [{ uid: h.uid, floor: h.row!.floor }] : [])) };
}

/** A party floor ready to begin: the plan, its run as the floor starts (its deal; the floor to fight its last), and what the commit checks. */
export interface PartyFloorPrep {
  plan: PartyPlan;
  uids: string[];
  run: TowerRun;
  members: PartyMembers;
  /** The copies as read (by account): the commit writes over them only while they're still so. */
  copies: Map<string, RunRow>;
  /** The floor's match room's settings (towerPartySettings), its number and its bosses in turn order. */
  settings: Partial<Settings>;
  floor: number;
  bosses: string[];
}

/**
 * Why a party floor can't begin now: `busy`, the account whose copy has a floor under way (`party`: a party floor its room hasn't
 * written yet; else one they play alone); `gone`, a member whose account has been deleted (no copy for it: the review of #835, finding
 * 5); `resting`, the tower's bosses resting; else a run that can't be played.
 */
export type PartyRefusal = { busy: string; party: boolean } | { gone: string } | { resting: true } | { broken: true };

/** The open party copies of these accounts, by account. */
async function partyCopies(sql: Sql, uids: readonly string[]): Promise<Map<string, RunRow>> {
  if (!uids.length) return new Map();
  const found = await sql.all<RunRow>(`SELECT ${RUN_COLUMNS} FROM tower_runs WHERE kind = 'party' AND status = 'open' AND user_id IN (${uids.map(() => "?").join(", ")})`, ...uids);
  return new Map(found.map((r) => [r.user_id, r]));
}

/**
 * A party's START, its first half (the party's Durable Object, squads-do.ts): reads its people's copies (`uids`: each a member's account,
 * in seat order), lets go any whose party floor's room has gone without a result (settleStale), and works out the plan (partyPlan) and
 * the floor: the lowest copy's run on, or a new run from the server's seed. Refused while a copy's floor is under way.
 */
export async function preparePartyFloor(sql: Sql, uids: readonly string[], now: number, opts: { pool: readonly string[]; lobbyGone?: LobbyGone; seed?: number }): Promise<{ ok: true; prep: PartyFloorPrep } | ({ ok: false } & PartyRefusal)> {
  // (A seat whose account has been deleted since (its socket still open): no copy is made for it, nor its id written into the others'.)
  const known = uids.length ? await sql.all<{ id: string }>(`SELECT id FROM users WHERE id IN (${uids.map(() => "?").join(", ")})`, ...uids) : [];
  const gone = uids.find((u) => !known.some((k) => k.id === u));
  if (gone) return { ok: false, gone };
  let copies = await partyCopies(sql, uids);
  // (In seat order: the first member whose floor is under way is the one named.)
  for (const uid of uids) {
    const row = copies.get(uid);
    const f = row ? fightOf(row.fight) : null;
    if (!row || !f) continue;
    if (await settleStale(sql, row, f, now, opts.lobbyGone)) {
      copies = await partyCopies(sql, uids);
      if (!fightOf(copies.get(uid)?.fight ?? null)) continue;
    }
    return { ok: false, busy: uid, party: !!f.lobby };
  }
  const plan = partyPlan(uids, copies);
  let run: TowerRun;
  let members: PartyMembers;
  if (plan.kind === "continue") {
    // (The run's deal on the party's floor: from a copy on that floor, or from one played alone past it, its deal there as kept.)
    const base = uids
      .map((u) => copies.get(u)!)
      .map((r) => {
        const m = membersOf(r.members)!;
        return r.floor === plan.floor ? { r, met: r.met } : m.party === plan.floor && m.partyMet ? { r, met: m.partyMet } : null;
      })
      .find((x) => x !== null);
    const dealt = base ? runOf({ ...base.r, met: base.met }) : null;
    if (!base || !dealt || dealt.floors.length !== plan.floor) return { ok: false, broken: true };
    // (One life count for the party (Nov 20): the fewest any of its copies holds on that floor, each copy's floors lost below it (a member
    // who left a floor of it after the party's 2nd move spent one their party didn't), so nobody is given back a life they spent, as
    // nobody is carried up a floor. Floors lost alone above it go with the floors won there.)
    const lost = uids.map((u) => runOf(copies.get(u)!).lost.filter((f) => f < plan.floor)).reduce((most, l) => (l.length > most.length ? l : most), dealt.lost);
    const before: TowerRun = { ...dealt, lost };
    const started = startFloor(before, opts.pool);
    if (!started || !started.run.floors[before.floors.length - 1]?.length) return { ok: false, resting: true };
    run = started.run;
    members = { run: plan.run, uids: membersOf(base.r.members)!.uids };
  } else {
    const fresh = newRun(opts.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!, opts.pool);
    if (!fresh.floors[0]?.length) return { ok: false, resting: true };
    run = startFloor(fresh, opts.pool)?.run ?? fresh;
    members = { run: randomHex(9), uids: [...uids] };
  }
  const floor = run.floors.length;
  // (The floor the party begins: its own, on every copy.)
  members.party = floor;
  return { ok: true, prep: { plan, uids: [...uids], run, members, copies, settings: towerPartySettings(floorSettings(run)), floor, bosses: [...(run.floors[floor - 1] ?? [])] } };
}

/**
 * A party's START, its second half: the floor begins on every member's copy at once (`fight`: its id and match room), in one batch, all
 * or nothing. A new run: each member's party copies go (an open one only if they agreed to end it, `ended`: the plan's `ends`) and a
 * copy each comes in (the unique index refuses a copy beside an open one nobody agreed to end). Their run on: every copy set to the
 * floor's run (the lowest copy's), but only while every copy is still as read (the first statement checks them all; the others follow
 * it). False: something changed since the plan (read it again).
 */
export async function commitPartyFloor(sql: Sql, prep: PartyFloorPrep, fight: Fight, now: number, ended: ReadonlySet<string>): Promise<boolean> {
  const fightText = JSON.stringify(fight);
  const met = metOf(prep.run);
  const members = membersText(prep.members);
  const floor = prep.run.floors.length;
  if (prep.plan.kind === "new") {
    const statements = [
      ...prep.uids.map((u) => stmt("DELETE FROM tower_runs WHERE user_id = ? AND kind = 'party' AND (status <> 'open' OR (? = 1 AND fight IS NULL))", u, ended.has(u) ? 1 : 0)),
      // (Each copy only for an account still there: one deleted since the plan was read makes its user_id NULL, which the table
      // refuses, so the whole batch is refused and nobody's copy changes: the review of #835, finding 5.)
      ...prep.uids.map((u) =>
        stmt(`INSERT INTO tower_runs (${RUN_COLUMNS}) VALUES (?, (SELECT id FROM users WHERE id = ?), 'party', ?, ?, ?, ?, ?, NULL, 'open', ?, ?)`, randomHex(12), u, prep.run.seed, floor, met, members, fightText, now, now),
      ),
    ];
    try {
      await sql.batch(statements);
      return true;
    } catch (e) {
      console.log(`tower: a party's new run refused (${String(e)})`);
      return false;
    }
  }
  const rows = prep.uids.map((u) => prep.copies.get(u)).filter((r): r is RunRow => !!r);
  if (rows.length !== prep.uids.length) return false;
  const [first, ...rest] = rows;
  const asRead = rows.map(() => "(id = ? AND met = ? AND floor = ? AND members IS ?)").join(" OR ");
  const set = "floor = ?, met = ?, members = ?, fight = ?, updated_at = ?";
  await sql.batch([
    stmt(
      `UPDATE tower_runs SET ${set} WHERE id = ? AND (SELECT COUNT(*) FROM tower_runs WHERE kind = 'party' AND status = 'open' AND fight IS NULL AND (${asRead})) = ?`,
      floor,
      met,
      members,
      fightText,
      now,
      first!.id,
      ...rows.flatMap((r) => [r.id, r.met, r.floor, r.members]),
      rows.length,
    ),
    ...rest.map((r) => stmt(`UPDATE tower_runs SET ${set} WHERE id = ? AND EXISTS (SELECT 1 FROM tower_runs WHERE id = ? AND fight = ?)`, floor, met, members, fightText, now, r.id, first!.id, fightText)),
  ]);
  return (await sql.first<{ fight: string | null }>("SELECT fight FROM tower_runs WHERE id = ?", first!.id))?.fight === fightText;
}

/** A party floor's end for one member's copy, as its match room counted it (lobby.ts's type). */
export type { PartyFloorEnd };

/** A best floor, only ever raised (`floor`: floors won; 99 the top). */
const bestStmt = (userId: string, kind: TowerKind, floor: number, now: number): Stmt =>
  stmt(
    `INSERT INTO tower_best (user_id, kind, floor, at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, kind) DO UPDATE SET floor = excluded.floor, at = excluded.at WHERE excluded.floor > tower_best.floor`,
    userId,
    kind,
    Math.min(floor, BATTLE_TOWER.floors),
    now,
  );

/**
 * A party floor's result, written to one member's copy by its match room (lobby-do.ts; never a device): only while that copy's floor
 * under way is this one (`fight`, its id), so writing it again (the room's retry) changes nothing. The party's win, loss or draw
 * (finishFloor: a win deals the next floor, the party best rising; a loss or draw spends a life and deals it too, or with none left
 * ends the run: Nov 20), or their leave mid-floor (leaveFloor: free before the party's 2nd move, else a loss: Boss Battle's party
 * rule, and solo's). A win on a crate floor (TOWER_PARTY.crateFloors) pays its crate first
 * (`crate`: once an account, the ledger's key), so a retry after a failure pays it at most once and never loses it.
 */
export async function partyFloorWrite(sql: Sql, now: number, fightId: string, end: PartyFloorEnd, opts: { pool: readonly string[]; crate?: (uid: string, floor: number) => Promise<unknown> }): Promise<void> {
  const row = await openRow(sql, end.uid, "party");
  const fight = row ? fightOf(row.fight) : null;
  if (!row || !fight || fight.id !== fightId) return;
  const before = runOf(row);
  const floor = before.floors.length;
  if (!floor) {
    await sql.run("UPDATE tower_runs SET fight = NULL, updated_at = ? WHERE id = ? AND fight = ?", now, row.id, row.fight);
    return;
  }
  const after = end.outcome === "left" ? leaveFloor(before, end.moves, opts.pool) : finishFloor(before, end.outcome, opts.pool);
  const won = end.outcome === "won";
  if (won && TOWER_PARTY.crateFloors.includes(floor) && opts.crate) await opts.crate(end.uid, floor);
  const m = membersOf(row.members);
  await sql.batch([
    stmt(
      "UPDATE tower_runs SET floor = ?, met = ?, members = ?, status = ?, fight = NULL, last = ?, updated_at = ? WHERE id = ? AND fight = ?",
      after.floors.length,
      metOf(after),
      // (The party's floor now: the floor after, the party's own (PartyMembers.party); played alone no more.)
      m ? membersText({ run: m.run, uids: m.uids, party: after.floors.length }) : row.members,
      after.status,
      JSON.stringify({ id: fightId, outcome: end.outcome, floor, status: after.status, ...(after.lost.length ? { lost: after.lost } : {}), party: true }),
      now,
      row.id,
      row.fight,
    ),
    ...(won ? [bestStmt(end.uid, "party", floor, now)] : []),
  ]);
}

/** A party floor's crate's ledger key (TOWER_PARTY.crateFloors): once an account and floor, ever (the design's section 5). */
export const towerCrateKey = (floor: number) => (account: string) => `tower:${floor}:${account}`;
