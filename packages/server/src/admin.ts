/**
 * Fair play's review: the page for Eric (`/admin/fairplay`, server-rendered, admin emails only) and the API the
 * automated reviewer uses (`/api/admin/fairplay/*`, a bearer token). See docs/fairplay-reviewer.md.
 *
 * Who may look:
 *   - an admin: signed in with an email in ADMIN_EMAILS (a Worker variable or secret, comma-separated; never in the
 *     repo). Anyone else gets "Not found";
 *   - the automated reviewer: `Authorization: Bearer <FAIRPLAY_REVIEW_TOKEN>` (a Worker secret), API only.
 * Every decision goes in the case's log with who made it ("admin:<email>" or "reviewer") and why. The reviewer never
 * bans, decides appeals, nor changes a ban (fairplay.ts, decide).
 */
import { CHAT_MOD, FAIRPLAY, atBanBar, crowdRate, nearBest, skipReason, type FairMove, type FairSummary } from "@chessroyale/core";
import { toSan, type ChatBlock } from "@chessroyale/chess";
import { DELETED_NAME, d1Sql, ensureSchema, userFromToken, type Sql, type User } from "./accounts.ts";
import { SESSION_COOKIE, readCookie, type AccountEnv } from "./api.ts";
import { caseOf, decide, decideAppeal, purgeEvidence, type Appeal, type Case, type CaseMailer } from "./fairplay.ts";
import { deepCheckRun, type DeepSearch } from "./fairplay-deep.ts";
import { checkDuelGames, duelEvidence } from "./fairplay-duel.ts";
import { chatModDetail, decideChat, type ChatLogRow } from "./chat-mod.ts";
import { liveHub } from "./live-hub.ts";

export interface AdminEnv extends AccountEnv {
  /**
   * Admins' sign-in emails, comma-separated: a Worker variable or secret, or a Secrets Store binding (withSecrets in
   * api.ts reads it as a string first).
   */
  ADMIN_EMAILS?: string;
  /** The automated reviewer's bearer token: a Worker secret or a Secrets Store binding, like ADMIN_EMAILS. */
  FAIRPLAY_REVIEW_TOKEN?: string;
  /**
   * "1" (local, e2e and staging; never production): anyone may use the test switches (testSwitchesOn), as an admin
   * may.
   */
  TEST_SWITCHES?: string;
}

/** A setting as a string (anything else, such as a Secrets Store binding nobody read, counts as unset). */
const text = (v: unknown) => (typeof v === "string" ? v : "");

const DAY = 86_400_000;

/** Whether a signed-in account is an admin (its email is in ADMIN_EMAILS). */
export function isAdmin(env: AdminEnv, user: Pick<User, "email"> | null): boolean {
  if (!user?.email) return false;
  const list = text(env.ADMIN_EMAILS).split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

/**
 * Whether this person may use the test switches: playtest shortcuts that would make easy wins (a lobby's `?rounds=`,
 * `?weakbots=1`, …: lobby-options.ts; a queue's own `?pool=`; a crate's forced Fischer or Shiny). An admin may, and
 * anyone where TEST_SWITCHES is "1"; for everyone else they're ignored, silently (docs/areas/ops.md, "Test switches").
 */
export function testSwitchesOn(env: AdminEnv, user: Pick<User, "email"> | null): boolean {
  return env.TEST_SWITCHES === "1" || isAdmin(env, user);
}

/** Constant-time comparison of the reviewer's token. */
function tokenOk(env: AdminEnv, request: Request): boolean {
  const want = text(env.FAIRPLAY_REVIEW_TOKEN);
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (want.length < 16 || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// ---------------- The evidence ----------------

export interface CaseRow {
  userId: string;
  name: string;
  status: Case["status"];
  reason: string | null;
  updatedAt: number;
  /** Cheating reports from different accounts in the last 7 days, and reports of any kind. */
  cheatingReports: number;
  reports: number;
  /** The highest match score and latest match strength in the last 30 days, and how many matches. */
  maxScore: number | null;
  latestPerf: number | null;
  matches: number;
  openAppeal: boolean;
  /** Higher first: review before watch, then reports and scores. */
  priority: number;
}

/** Open cases (review, watch, and bans with an open appeal), highest priority first. */
/** The case lists (the page's tabs, the API's `status`). */
const LISTS = ["open", "review", "watch", "pool", "banned", "all"] as const;

export async function openCases(sql: Sql, now: number, status: (typeof LISTS)[number] = "open", limit = 100): Promise<CaseRow[]> {
  const where =
    status === "open"
      ? "c.status IN ('review', 'watch') OR c.user_id IN (SELECT user_id FROM fairplay_appeals WHERE status = 'open')"
      : status === "all"
        ? "1 = 1"
        : "c.status = ?";
  const rows = await sql.all<Case & { name: string }>(
    // (A ban outlives a deleted account: it's listed as a deleted player.)
    `SELECT c.user_id, c.status, c.reason, c.opened_at, c.updated_at, c.decided_at, c.decided_by, COALESCE(u.name, ?) AS name FROM fairplay_cases c
     LEFT JOIN users u ON u.id = c.user_id WHERE ${where} ORDER BY c.updated_at DESC LIMIT 500`,
    DELETED_NAME,
    ...(status === "open" || status === "all" ? [] : [status]),
  );
  const out: CaseRow[] = [];
  for (const c of rows) {
    const rep = await sql.first<{ cheating: number; total: number }>(
      `SELECT COUNT(DISTINCT CASE WHEN reason = 'Cheating' AND at > ? THEN reporter END) AS cheating, COUNT(*) AS total FROM reports WHERE target = ?`,
      now - 7 * DAY,
      c.user_id,
    );
    const m = await sql.first<{ maxScore: number | null; n: number }>(
      "SELECT MAX(score) AS maxScore, COUNT(*) AS n FROM fairplay_matches WHERE user_id = ? AND played_at > ?",
      c.user_id,
      now - FAIRPLAY.levels.windowDays * DAY,
    );
    const latest = await sql.first<{ perf: number | null }>("SELECT perf FROM fairplay_matches WHERE user_id = ? ORDER BY played_at DESC LIMIT 1", c.user_id);
    const appeal = await sql.first<{ id: number }>("SELECT id FROM fairplay_appeals WHERE user_id = ? AND status = 'open'", c.user_id);
    const cheating = rep?.cheating ?? 0;
    const maxScore = m?.maxScore ?? null;
    out.push({
      userId: c.user_id,
      name: c.name,
      status: c.status,
      reason: c.reason,
      updatedAt: c.updated_at,
      cheatingReports: cheating,
      reports: rep?.total ?? 0,
      maxScore,
      latestPerf: latest?.perf ?? null,
      matches: m?.n ?? 0,
      openAppeal: !!appeal,
      priority: (appeal ? 300 : 0) + (c.status === "review" ? 200 : c.status === "watch" ? 100 : 0) + 5 * cheating + (maxScore ?? 0),
    });
  }
  return out.sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt).slice(0, limit);
}

/** One pooled player on the engine pool's list (docs/decisions/2026-11-10-engine-pool.md). */
export interface PoolRow {
  userId: string;
  name: string;
  /** When they went in (the log's latest "pool" line), why (the case's reason) and by what ("detection", "evasion"). */
  since: number;
  why: string | null;
  by: string | null;
  /** Their rating (crowd modes) and 1 v 1 hidden rating, and games played online (crowd modes and 1 v 1), all time. */
  rating: number | null;
  rating1v1: number | null;
  games: number;
  /**
   * The evidence: fair-play matches kept, those at the one-match ban bar, the deep re-check's best on how many checked, best strength;
   * and the best strength of the matches that pooled them (played by `since`).
   */
  evidence: { matches: number; atBar: number; deepMatch: number; deepChecked: number; bestPerf: number | null; pooledPerf: number | null };
  /**
   * How they do in the pool, since they went in (everyone they meet there is pooled, or a bot): crowd-mode games and wins (their team
   * or first place: mostly against bots and bosses, so never a hint), 1 v 1 wins, losses and draws, those against players still pooled
   * (`vsPool`) and their score there (`vsPoolScore`: 1 a win, ½ a draw), and their fair-play matches: how many, how many at the one-match
   * ban bar, their average strength and deep matches.
   */
  inPool: {
    games: number;
    wins: number;
    duelWins: number;
    duelLosses: number;
    duelDraws: number;
    vsPool: number;
    vsPoolScore: number;
    matches: number;
    atBar: number;
    avgPerf: number | null;
    deepMatch: number;
    deepChecked: number;
  };
}

/**
 * Pooled players (deleted accounts' kept cases too, as a deleted player): the latest in first (`limit`), or, with `after`, a page in id
 * order after that id (the download). One query a column over all of them, never one a player (the #618 review, M4: D1 takes at most
 * 1,000 queries a request, and the pool only grows).
 */
export async function poolPlayers(sql: Sql, opts: { limit?: number; after?: string } = {}): Promise<PoolRow[]> {
  const paged = opts.after !== undefined;
  // Who (as every query below reads them), and since when: the log's latest "pool" line.
  const who = `WITH p AS (SELECT c.user_id, c.updated_at, COALESCE((SELECT MAX(l.at) FROM fairplay_log l WHERE l.user_id = c.user_id AND l.action = 'pool'), c.updated_at) AS since
    FROM fairplay_cases c WHERE c.status = 'pool'${paged ? " AND c.user_id > ?" : ""} ORDER BY ${paged ? "c.user_id" : "c.updated_at DESC, c.user_id"} LIMIT ?)`;
  const whoArgs = [...(paged ? [opts.after] : []), opts.limit ?? 200];
  const cases = await sql.all<{ user_id: string; updated_at: number; since: number; reason: string | null; by: string | null; name: string; rating: number | null; r1: number | null; r1games: number | null }>(
    `${who} SELECT p.user_id, p.updated_at, p.since, c.reason, COALESCE(u.name, ?) AS name, u.rating, r.rating AS r1, r.games AS r1games,
       (SELECT l.by FROM fairplay_log l WHERE l.user_id = p.user_id AND l.action = 'pool' ORDER BY l.at DESC, l.id DESC LIMIT 1) AS by
     FROM p JOIN fairplay_cases c ON c.user_id = p.user_id LEFT JOIN users u ON u.id = p.user_id LEFT JOIN ranked_1v1 r ON r.user_id = p.user_id`,
    ...whoArgs,
    DELETED_NAME,
  );
  if (!cases.length) return [];
  const online = await sql.all<{ user_id: string; n: number; games: number; won: number }>(
    `${who} SELECT r.user_id, COUNT(*) AS n, SUM(r.played_at > p.since) AS games, SUM(r.played_at > p.since AND (r.team_won = 1 OR r.placement = 1)) AS won
     FROM results r JOIN p ON p.user_id = r.user_id WHERE r.online = 1 GROUP BY r.user_id`,
    ...whoArgs,
  );
  // 1 v 1 since they went in, each game's score for them (1, ½, 0) and whether the other player is pooled now.
  const duels = await sql.all<{ user_id: string; w: number; l: number; d: number; vs: number; vsScore: number }>(
    `${who}, g AS (
       SELECT p.user_id AS me, x.black_id AS opp, CASE x.result WHEN '1-0' THEN 1 WHEN '1/2-1/2' THEN 0.5 ELSE 0 END AS s
       FROM p JOIN ranked_1v1_games x ON x.white_id = p.user_id WHERE x.ended_at > p.since AND x.result != 'aborted'
       UNION ALL
       SELECT p.user_id, x.white_id, CASE x.result WHEN '0-1' THEN 1 WHEN '1/2-1/2' THEN 0.5 ELSE 0 END
       FROM p JOIN ranked_1v1_games x ON x.black_id = p.user_id WHERE x.ended_at > p.since AND x.result != 'aborted'
     ), v AS (SELECT me, s, EXISTS (SELECT 1 FROM fairplay_cases o WHERE o.user_id = g.opp AND o.status = 'pool') AS vs FROM g)
     SELECT me AS user_id, SUM(s = 1) AS w, SUM(s = 0) AS l, SUM(s = 0.5) AS d, SUM(vs) AS vs, SUM(vs * s) AS vsScore FROM v GROUP BY me`,
    ...whoArgs,
  );
  // Each one's latest 200 fair-play matches, their numbers only (the summary's, read here: no moves, no whole summaries).
  const num = (k: string) => `CASE WHEN json_valid(m.summary) THEN json_extract(m.summary, '$.${k}') END AS ${k}`;
  const matches = await sql.all<{ user_id: string; in_pool: number; perf: number | null; counted: number | null; deepChecked: number | null; deepMatch: number | null; evidence: number | null }>(
    `${who}, k AS (
       SELECT m.user_id, m.played_at > p.since AS in_pool, m.perf, ${["counted", "deepChecked", "deepMatch", "evidence"].map(num).join(", ")},
         ROW_NUMBER() OVER (PARTITION BY m.user_id ORDER BY m.played_at DESC, m.id DESC) AS nth
       FROM fairplay_matches m JOIN p ON p.user_id = m.user_id
     ) SELECT user_id, in_pool, perf, counted, deepChecked, deepMatch, evidence FROM k WHERE nth <= 200`,
    ...whoArgs,
  );
  const by = <T extends { user_id: string }>(rows: T[]) => new Map(rows.map((r) => [r.user_id, r]));
  const onlineOf = by(online);
  const duelsOf = by(duels);
  const rows = cases.map((c): PoolRow => {
    const o = onlineOf.get(c.user_id);
    const d = duelsOf.get(c.user_id);
    return {
      userId: c.user_id,
      name: c.name,
      since: c.since,
      why: c.reason,
      by: c.by,
      rating: c.rating,
      rating1v1: c.r1 === null ? null : Math.round(c.r1),
      games: (o?.n ?? 0) + (c.r1games ?? 0),
      evidence: { matches: 0, atBar: 0, deepMatch: 0, deepChecked: 0, bestPerf: null, pooledPerf: null },
      inPool: {
        games: o?.games ?? 0,
        wins: o?.won ?? 0,
        duelWins: d?.w ?? 0,
        duelLosses: d?.l ?? 0,
        duelDraws: d?.d ?? 0,
        vsPool: d?.vs ?? 0,
        vsPoolScore: d?.vsScore ?? 0,
        matches: 0,
        atBar: 0,
        avgPerf: null,
        deepMatch: 0,
        deepChecked: 0,
      },
    };
  });
  const rowOf = new Map(rows.map((r) => [r.userId, r]));
  const perfs = new Map<string, number[]>();
  for (const m of matches) {
    const r = rowOf.get(m.user_id);
    if (!r) continue;
    const one = { score: 0, perf: m.perf, counted: m.counted ?? 0, deepChecked: m.deepChecked ?? 0, deepMatch: m.deepMatch ?? 0, evidence: m.evidence ?? 0 };
    const bar = atBanBar(one);
    const ev = r.evidence;
    ev.matches++;
    if (bar) ev.atBar++;
    ev.deepMatch += one.deepMatch;
    ev.deepChecked += one.deepChecked;
    if (m.perf !== null) ev.bestPerf = Math.max(ev.bestPerf ?? 0, m.perf);
    if (!m.in_pool) {
      if (m.perf !== null) ev.pooledPerf = Math.max(ev.pooledPerf ?? 0, m.perf);
      continue;
    }
    const i = r.inPool;
    i.matches++;
    if (bar) i.atBar++;
    i.deepMatch += one.deepMatch;
    i.deepChecked += one.deepChecked;
    if (m.perf !== null) perfs.set(m.user_id, [...(perfs.get(m.user_id) ?? []), m.perf]);
  }
  for (const [id, ps] of perfs) rowOf.get(id)!.inPool.avgPerf = Math.round(ps.reduce((a, b) => a + b, 0) / ps.length);
  const updated = new Map(cases.map((c) => [c.user_id, c.updated_at]));
  return rows.sort((a, b) => (paged ? (a.userId < b.userId ? -1 : 1) : updated.get(b.userId)! - updated.get(a.userId)! || (a.userId < b.userId ? -1 : 1)));
}

/** Every pooled player's id, in id order: how many there are, and where each download file starts. */
export async function poolIds(sql: Sql): Promise<string[]> {
  return (await sql.all<{ user_id: string }>("SELECT user_id FROM fairplay_cases WHERE status = 'pool' ORDER BY user_id")).map((r) => r.user_id);
}

/**
 * How a pooled player is doing there, in a few words (the #618 review, M2). In-pool engine play first, whatever the results ("still
 * playing like an engine": a match at the one-match ban bar, or the deep re-check's best on most of their moves); then results against
 * people only ("getting crushed" in 1 v 1 by other pooled players); then a big drop in strength against what pooled them. Crowd and
 * raid results are never a hint: bots and bosses beat cheaters and honest players alike.
 */
export function poolHint(p: PoolRow): string {
  const i = p.inPool;
  const h = FAIRPLAY.pool.hint;
  const lv = FAIRPLAY.levels;
  if (i.atBar) return `still playing like an engine: ${i.atBar} in-pool match${i.atBar === 1 ? "" : "es"} at the ban bar`;
  if (i.deepChecked >= lv.banMatchChecked && i.deepMatch / i.deepChecked >= lv.banDeep) return "still playing like an engine";
  if (i.vsPool >= h.games && i.vsPoolScore / i.vsPool < h.below) return "getting crushed in 1 v 1 by other pooled players: likely a false positive";
  const drop = i.matches >= h.dropMatches && i.avgPerf !== null && p.evidence.pooledPerf !== null ? p.evidence.pooledPerf - i.avgPerf : 0;
  if (drop >= h.drop) return `strength down ${drop} since pooled: maybe a false positive`;
  return i.games + i.duelWins + i.duelLosses + i.duelDraws ? "" : "no games in the pool yet";
}

/**
 * The engine pool's download, one file a page (FAIRPLAY.pool.exportPage players, in id order after `after`; `next`: the next file's
 * `after`, or null): each pooled player's row and their whole file, moves and all. No email anywhere: the file as the reviewer's token
 * reads it (forReviewer: the admins' in the log and decisions, any typed in a reason or an appeal; the #618 review, M1).
 */
export async function poolExport(sql: Sql, now: number, after = ""): Promise<{ exportedAt: string; about: string; after: string; next: string | null; players: (PoolRow & { file: CaseDetail | null })[] }> {
  const size = FAIRPLAY.pool.exportPage;
  const rows = await poolPlayers(sql, { limit: size + 1, after });
  const players = [];
  for (const p of rows.slice(0, size)) {
    const d = await caseDetail(sql, p.userId, { email: false, lines: false, limit: 200 });
    players.push({ ...p, why: noEmails(p.why), by: byForReviewer(p.by), file: d && forReviewer(d) });
  }
  return {
    exportedAt: new Date(now).toISOString(),
    about: `Fair play's engine pool: who is in it, why, the evidence kept and how each does in the pool, ${size} players a file in id order (next: the next file's ?after=). Times are ms since 1970 (UTC).`,
    after,
    next: rows.length > size ? players.at(-1)!.userId : null,
    players,
  };
}

/** One judged pick as evidence: moves in SAN, whether it counted (and why not), the crowd, time and look-aways. */
export interface EvidenceMove {
  ply: number;
  /** Move number and side, as players read it ("23. Nf3", "23... Nf6"). */
  moveNo: string;
  fen: string;
  pick: string;
  best: string;
  loss: number;
  found: boolean;
  counted: boolean;
  skip: string | null;
  crowd: number;
  crowdFound: number;
  crowdRate: number | null;
  near: number;
  gap: number | null;
  thinkS: number;
  /** A premove (its time left out of timing: core's FairMove.premove). */
  premove: boolean;
  away: number;
  /**
   * The deep re-check: its best move (SAN), the pick's rank among the candidates (1: its best), the points it gives away by the
   * search's numbers, and whether it counts as the engine's best (rank 1 or within FAIRPLAY.deep.nearBestLoss: core's nearBest); or null.
   */
  deepBest: string | null;
  deepRank: number | null;
  deepLoss: number | null;
  deepNear: boolean | null;
}

function evidenceMove(m: FairMove): EvidenceMove {
  const san = (u: string) => {
    try {
      return toSan(m.fen, u);
    } catch {
      return u;
    }
  };
  const skip = skipReason(m);
  const n = Math.floor(m.ply / 2) + 1;
  return {
    ply: m.ply,
    moveNo: `${n}${m.ply % 2 ? "..." : "."}`,
    fen: m.fen,
    pick: san(m.move),
    best: san(m.best),
    loss: m.loss,
    found: m.loss <= FAIRPLAY.signals.foundLoss,
    counted: skip === null,
    skip,
    crowd: m.crowd,
    crowdFound: m.crowdFound,
    crowdRate: crowdRate(m) === null ? null : Math.round(crowdRate(m)! * 100) / 100,
    near: m.near,
    gap: m.gap,
    thinkS: Math.round(m.thinkMs / 100) / 10,
    premove: !!m.premove,
    away: m.away,
    deepBest: m.deep ? san(m.deep.best) : null,
    deepRank: m.deep?.rank ?? null,
    deepLoss: m.deep?.loss ?? null,
    deepNear: m.deep ? nearBest(m.deep) : null,
  };
}

export interface CaseDetail {
  /** (joinedAt null: the account was deleted and its fair-play file kept.) */
  player: { id: string; name: string; joinedAt: number | null; signedIn: boolean; email: string | null; onlineMatches: number };
  case: Case | null;
  /** `line`: a report of a line in the town's chat carries what was said and when (town-chat-api.ts). */
  reports: { at: number; reason: string; match: string | null; line?: { text: string; at: number }; reporter: { id: string; name: string; signedIn: boolean } }[];
  matches: { lobby: string | null; mode: string; playedAt: number; counted: number; perf: number | null; score: number; level: string; summary: FairSummary; moves: EvidenceMove[] | null; keepUntil: number | null }[];
  log: { at: number; action: string; by: string; reason: string | null }[];
  appeals: Appeal[];
  /** Accounts that played online from the same device markers. */
  sameDevice: { id: string; name: string; status: string | null }[];
  /** Their kept ranked 1 v 1 games, newest first, each with the engine's check if a person asked for one (fairplay-duel.ts). */
  duels: Awaited<ReturnType<typeof duelEvidence>>;
}

/** Everything about one case: the player, reports, each match's signals and judged picks, the log and appeals. */
/**
 * `email` and `lines`: for an admin only. The automated reviewer (its token) gets neither: no email, and no reported
 * town chat line (the words are for a moderator to read; the reviewer leaves those cases to a person anyway).
 */
export async function caseDetail(sql: Sql, userId: string, opts: { email: boolean; lines?: boolean; limit?: number } = { email: false }): Promise<CaseDetail | null> {
  const found = await sql.first<{ id: string; name: string; created_at: number; email: string | null; google_sub: string | null }>(
    "SELECT id, name, created_at, email, google_sub FROM users WHERE id = ?",
    userId,
  );
  // A deleted account whose fair-play file outlives it (banned or in review; account-data.ts): its case, log and
  // device markers, under its old id.
  const kept = found ? null : await caseOf(sql, userId);
  if (!found && !kept) return null;
  const u = found ?? { id: userId, name: DELETED_NAME, created_at: null, email: null, google_sub: null };
  const online = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND online = 1", userId))?.n ?? 0;
  const reports = await sql.all<{ at: number; reason: string; match: string | null; line: string | null; line_at: number | null; id: string; name: string; email: string | null; google_sub: string | null }>(
    `SELECT r.at, r.reason, r.match, r.line, r.line_at, u.id, u.name, u.email, u.google_sub FROM reports r JOIN users u ON u.id = r.reporter
     WHERE r.target = ? ORDER BY r.at DESC LIMIT 100`,
    userId,
  );
  const matches = await sql.all<{ lobby: string | null; mode: string; played_at: number; counted: number; perf: number | null; score: number; level: string; summary: string; moves: string | null; keep_until: number | null }>(
    "SELECT lobby, mode, played_at, counted, perf, score, level, summary, moves, keep_until FROM fairplay_matches WHERE user_id = ? ORDER BY played_at DESC LIMIT ?",
    userId,
    opts.limit ?? 30,
  );
  const log = await sql.all<{ at: number; action: string; by: string; reason: string | null }>("SELECT at, action, by, reason FROM fairplay_log WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT 200", userId);
  const appeals = await sql.all<Appeal>("SELECT id, user_id, at, text, status, decided_at, decided_by, reply FROM fairplay_appeals WHERE user_id = ? ORDER BY at DESC", userId);
  const sameDevice = await sql.all<{ id: string; name: string; status: string | null }>(
    `SELECT DISTINCT o.user_id AS id, COALESCE(u.name, ?) AS name, c.status FROM fairplay_devices d JOIN fairplay_devices o ON o.device = d.device AND o.user_id != d.user_id
     LEFT JOIN users u ON u.id = o.user_id LEFT JOIN fairplay_cases c ON c.user_id = o.user_id WHERE d.user_id = ? LIMIT 20`,
    DELETED_NAME,
    userId,
  );
  const parse = <T>(s: string | null): T | null => {
    try {
      return s ? (JSON.parse(s) as T) : null;
    } catch {
      return null;
    }
  };
  return {
    player: { id: u.id, name: u.name, joinedAt: u.created_at, signedIn: !!(u.email || u.google_sub), email: opts.email ? u.email : null, onlineMatches: online },
    case: await caseOf(sql, userId),
    reports: reports.map((r) => ({
      at: r.at,
      reason: r.reason,
      match: r.match,
      ...(opts.lines && r.line !== null && r.line_at !== null ? { line: { text: r.line, at: r.line_at } } : {}),
      reporter: { id: r.id, name: r.name, signedIn: !!(r.email || r.google_sub) },
    })),
    matches: matches.map((m) => ({
      lobby: m.lobby,
      mode: m.mode,
      playedAt: m.played_at,
      counted: m.counted,
      perf: m.perf,
      score: m.score,
      level: m.level,
      summary: parse<FairSummary>(m.summary)!,
      moves: parse<FairMove[]>(m.moves)?.map(evidenceMove) ?? null,
      keepUntil: m.keep_until,
    })),
    log,
    appeals,
    sameDevice,
    duels: await duelEvidence(sql, userId),
  };
}

// ---------------- Routes ----------------

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });

/**
 * /admin/fairplay (the page) and /api/admin/fairplay/* (the API); null for other paths. `mail`: sends ban and
 * clearing emails (fairplay-mail.ts), when the Worker has a Resend key.
 */
export async function handleAdmin(
  request: Request,
  env: AdminEnv,
  mail?: CaseMailer,
  waitUntil?: (p: Promise<unknown>) => void,
  deepSearch?: DeepSearch | null,
): Promise<Response | null> {
  const url = new URL(request.url);
  const page = url.pathname === "/admin/fairplay" || url.pathname.startsWith("/admin/fairplay/");
  const api = url.pathname.startsWith("/api/admin/fairplay");
  if (!page && !api) return null;
  if (!env.DB) return notFound();
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const reviewer = api && tokenOk(env, request);
  const user = reviewer ? null : await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  const admin = isAdmin(env, user);
  if (!reviewer && !admin) return notFound();
  const by = reviewer ? "reviewer" : `admin:${user!.email!.toLowerCase()}`;
  // Old evidence goes on the way (at most every 10 minutes).
  waitUntil?.(purgeEvidence(sql, now).catch(() => undefined));

  if (api) {
    // GET /api/admin/fairplay/cases?status=open|review|watch|pool|banned|all
    if (url.pathname === "/api/admin/fairplay/cases" && request.method === "GET") {
      const status = url.searchParams.get("status") ?? "open";
      if (!(LISTS as readonly string[]).includes(status)) return json({ message: `status must be ${LISTS.join(", ")}` }, 400);
      const cases = await openCases(sql, now, status as "open");
      return json({ cases: reviewer ? cases.map((c) => ({ ...c, reason: noEmails(c.reason) })) : cases, policy: policy() });
    }
    const m = url.pathname.match(/^\/api\/admin\/fairplay\/cases\/([A-Za-z0-9_-]{1,64})(\/decision)?$/);
    if (m && !m[2] && request.method === "GET") {
      const d = await caseDetail(sql, m[1]!, { email: admin, lines: admin });
      return d ? json(reviewer ? forReviewer(d) : d) : json({ message: "no such player" }, 404);
    }
    // POST /api/admin/fairplay/cases/ID/decision {decision: ban|clear|watch|review, reason, notice?}
    if (m && m[2] && request.method === "POST") {
      const b = (await request.json().catch(() => ({}))) as { decision?: unknown; reason?: unknown; notice?: unknown };
      const r = await decide(sql, m[1]!, b.decision, by, b.reason, now, { notice: b.notice, mail });
      return r.ok ? json({ ok: true, status: r.status, by }) : json({ message: r.message }, r.status);
    }
    return json({ message: "Not found" }, 404);
  }

  // The page (admins only). Posts come from this page only (the session cookie is SameSite=Lax; the origin is checked too).
  if (request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) return new Response("Bad origin", { status: 403 });
    const form = await request.formData();
    const m = url.pathname.match(/^\/admin\/fairplay\/case\/([A-Za-z0-9_-]{1,64})$/);
    if (!m) return notFound();
    const action = String(form.get("action") ?? "");
    let note: string;
    if (action.startsWith("chat:")) {
      // Chat moderation (chat-mod.ts): chat:warn, chat:ban:<days|forever>, chat:lift, chat:reset.
      const [, chat, days] = action.split(":");
      const r = await decideChat(sql, m[1]!, { action: chat, days, reason: form.get("chat_reason"), note: form.get("chat_note") }, by, now);
      note = r.ok ? "Done." : r.message;
      // A reset name and icon: their lines leave the global chat too, old name and all (only those: live-hub.ts).
      if (r.ok && chat === "reset" && env.LIVE) {
        await liveHub(env as Required<Pick<AdminEnv, "LIVE">>)
          .dropChatLines(m[1]!)
          .catch((e: unknown) => console.error(`name and icon reset, but the global chat kept their lines (${String(e)})`));
      }
    } else if (action === "deep") {
      // The deep re-check of this player's matches now, whatever the hour (within the day's budget).
      if (!deepSearch) note = "The engine server isn't available here.";
      else {
        const d = await deepCheckRun(sql, deepSearch, now, { all: true, userId: m[1]!, mail, perRun: 60 });
        // Then their ranked 1 v 1 games, with what's left of this press's 60 searches (and of the day's budget).
        const g = await checkDuelGames(sql, deepSearch, m[1]!, now, Math.max(0, 60 - d.searches));
        note = `Deep re-check: ${d.searches} searches, ${d.matches} matches done. 1 v 1: ${g.searches} searches, ${g.games} games done.`;
      }
    } else {
      const r =
        action === "appeal"
          ? await decideAppeal(sql, Number(form.get("appeal")), form.get("outcome"), by, form.get("reply"), now, mail)
          : await decide(sql, m[1]!, action, by, form.get("reason"), now, { notice: form.get("notice"), mail });
      note = r.ok ? "Done." : r.message;
    }
    return Response.redirect(`${url.origin}/admin/fairplay/case/${m[1]}?note=${encodeURIComponent(note)}`, 303);
  }
  const cm = url.pathname.match(/^\/admin\/fairplay\/case\/([A-Za-z0-9_-]{1,64})$/);
  if (cm) {
    const d = await caseDetail(sql, cm[1]!, { email: true, lines: true });
    return d ? adminPage("Fair play", casePage(d, url.searchParams.get("note"), await chatModDetail(sql, cm[1]!, now))) : notFound();
  }
  // The engine pool's download, a file a page (?after=<userId>): pooled players, the evidence and how they do in the pool (JSON, no emails).
  if (url.pathname === "/admin/fairplay/pool.json") {
    const after = (url.searchParams.get("after") ?? "").slice(0, 100);
    const file = `engine-pool-${new Date(now).toISOString().slice(0, 10)}${after ? `-after-${after.replace(/[^\w-]/g, "").slice(0, 40)}` : ""}.json`;
    return new Response(JSON.stringify(await poolExport(sql, now, after), null, 1), {
      headers: { "content-type": "application/json", "cache-control": "no-store", "content-disposition": `attachment; filename="${file}"` },
    });
  }
  // Any player's page by their id or their profile's link (to act on a name, an icon or their chat).
  if (url.pathname === "/admin/fairplay/find") {
    const id = (url.searchParams.get("q") ?? "").trim().split(/[/?#]/).filter(Boolean).find((p, i, all) => i === all.length - 1 || all[i - 1] === "profile");
    return /^[A-Za-z0-9_-]{1,64}$/.test(id ?? "") ? Response.redirect(`${url.origin}/admin/fairplay/case/${id}`, 303) : notFound();
  }
  if (url.pathname === "/admin/fairplay") {
    const status = url.searchParams.get("status") ?? "open";
    // (The pool tab: its own list, its queries grouped over every pooled player; no other tab reads the pool. The #618 review, M4.)
    const pool = status === "pool" ? { rows: await poolPlayers(sql), ids: await poolIds(sql) } : null;
    const cases = pool ? [] : await openCases(sql, now, (LISTS as readonly string[]).includes(status) ? (status as "open") : "open");
    const appeals = await sql.all<Appeal & { name: string }>(
      "SELECT a.id, a.user_id, a.at, a.text, a.status, a.decided_at, a.decided_by, a.reply, u.name FROM fairplay_appeals a JOIN users u ON u.id = a.user_id WHERE a.status = 'open' ORDER BY a.at",
    );
    const log = await sql.all<{ user_id: string; at: number; action: string; by: string; reason: string | null; name: string | null }>(
      `SELECT l.user_id, l.at, l.action, l.by, l.reason, u.name FROM fairplay_log l LEFT JOIN users u ON u.id = l.user_id
       WHERE l.by != 'detection' AND l.by != 'reports' ORDER BY l.at DESC, l.id DESC LIMIT 40`,
    );
    return adminPage("Fair play", listPage(cases, appeals, log, status, by, pool));
  }
  return notFound();
}

/** Any email address in a text, hidden ("[email]"): what the automated reviewer reads carries none. */
export const noEmails = <T extends string | null>(s: T): T => (s === null ? s : (s.replace(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+/g, "[email]") as T));
/** Who decided, as the reviewer reads it: an admin is "admin", never their email. */
const byForReviewer = <T extends string | null>(by: T): T => (by !== null && by.startsWith("admin:") ? ("admin" as T) : noEmails(by));

/**
 * A case as the automated reviewer's token reads it (the outside review of Nov 10, finding 6): no email anywhere, the admins' in the
 * log and decisions included ("admin"), nor any typed in a reason, an appeal or a reply. (caseDetail already leaves out the player's
 * email and the reported chat lines for it.)
 */
export function forReviewer(d: CaseDetail): CaseDetail {
  return {
    ...d,
    player: { ...d.player, email: null },
    case: d.case ? { ...d.case, reason: noEmails(d.case.reason), decided_by: byForReviewer(d.case.decided_by) } : null,
    log: d.log.map((l) => ({ ...l, by: byForReviewer(l.by), reason: noEmails(l.reason) })),
    appeals: d.appeals.map((a) => ({ ...a, text: noEmails(a.text), reply: noEmails(a.reply), decided_by: byForReviewer(a.decided_by) })),
  };
}

/** The decision policy the page and the API state (the reviewer follows the same rules: docs/fairplay-reviewer.md). */
export function policy() {
  return { enforcement: FAIRPLAY.enforcement, levels: FAIRPLAY.levels, score: FAIRPLAY.score, signals: FAIRPLAY.signals, reports: FAIRPLAY.reports };
}

// ---------------- HTML ----------------

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const when = (t: number | null | undefined) => (t ? new Date(t).toISOString().slice(0, 16).replace("T", " ") : "");
/** An admin page (fair play's, ops'): server-rendered, light and dark, never framed or indexed. */
export const adminPage = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · HunChess</title><style>
:root{color-scheme:light dark;--bg:#fafaf7;--fg:#1d1d1b;--muted:#6b6b66;--line:#ddd9cf;--card:#fff;--gold:#b8860b;--bad:#b3261e;--ok:#1e7b34}
@media (prefers-color-scheme:dark){:root{--bg:#141412;--fg:#ecebe6;--muted:#a3a29b;--line:#34332e;--card:#1d1d1a;--gold:#e0b44c;--bad:#f2867d;--ok:#7fd18f}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:4px 0 12px}h2{font-size:17px;margin:22px 0 8px}a{color:var(--gold)}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top;white-space:nowrap}
td.wrap{white-space:normal;min-width:180px}.pill{display:inline-block;border-radius:99px;padding:1px 8px;font-size:12px;border:1px solid var(--line)}
.review,.banned,.pool{color:var(--bad)}.cleared{color:var(--ok)}.hard{font-weight:700}.skip{color:var(--muted)}
form.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}input[type=text],textarea{font:inherit;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);flex:1 1 260px}
button{font:inherit;min-height:40px;padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}button.ban{border-color:var(--bad);color:var(--bad)}button.clear{border-color:var(--ok);color:var(--ok)}
nav a{margin-right:12px}pre{white-space:pre-wrap;word-break:break-word;font-size:12px;margin:6px 0 0}details summary{cursor:pointer}
</style></head><body><main>${body}</main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } },
  );

/**
 * The engine pool's list (its tab): who, since when and why, their numbers, the evidence and how they do in the pool, each with Release;
 * the latest `rows` of all `ids`, and the download a file per FAIRPLAY.pool.exportPage players.
 */
function poolSection({ rows: pool, ids }: { rows: PoolRow[]; ids: string[] }): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
  const row = (p: PoolRow) => {
    const i = p.inPool;
    const hint = poolHint(p);
    return `<tr><td><a href="/admin/fairplay/case/${esc(p.userId)}">${esc(p.name)}</a></td><td>${when(p.since)}${p.by && p.by !== "detection" ? ` <span class="pill">${esc(p.by)}</span>` : ""}</td><td class="wrap">${esc(p.why)}</td>
<td>${p.rating ?? "–"} · 1 v 1 ${p.rating1v1 ?? "–"}</td><td>${p.games}</td>
<td>${p.evidence.atBar} of ${p.evidence.matches} at the bar · ${pct(p.evidence.deepMatch, p.evidence.deepChecked)} of ${p.evidence.deepChecked} near the engine's best · best ${p.evidence.bestPerf ?? "–"} · pooled at ${p.evidence.pooledPerf ?? "–"}</td>
<td class="wrap">${i.matches} matches, ${i.atBar} at the bar, strength ${i.avgPerf ?? "–"}, ${pct(i.deepMatch, i.deepChecked)} near the engine's best · 1 v 1 ${i.duelWins}-${i.duelLosses}-${i.duelDraws} (${i.vsPool} vs pooled, scoring ${pct(i.vsPoolScore, i.vsPool)}) · crowd and raid ${i.wins} of ${i.games} won${hint ? `<br><b>${esc(hint)}</b>` : ""}</td>
<td><form method="post" action="/admin/fairplay/case/${esc(p.userId)}"><button class="clear" name="action" value="release">Release</button></form></td></tr>`;
  };
  const size = FAIRPLAY.pool.exportPage;
  const files = ids.length ? Array.from({ length: Math.ceil(ids.length / size) }, (_, f) => `<a href="/admin/fairplay/pool.json${f ? `?after=${encodeURIComponent(ids[f * size - 1]!)}` : ""}">${f * size + 1}–${Math.min(ids.length, (f + 1) * size)}</a>`).join(" · ") : "";
  return `<h2>Engine pool (${ids.length})</h2>
<p class="muted">Detection's ban level on two matches or more (one opens a review), or a new account with ${FAIRPLAY.pool.newHits} of its first ${FAIRPLAY.pool.newGames} matches at the one-match ban bar. They meet only each other or bots, in every queue, and see nothing different. Release puts them back in the usual queues (logged). Crowd and raid results are mostly against bots and bosses, so they never make a hint.${files ? ` Download (JSON, ${size} players a file): ${files}` : ""}${ids.length > pool.length ? ` The latest ${pool.length} are listed here.` : ""}</p>
<div class="card scroll"><table><tr><th>Player</th><th>In since</th><th>Why</th><th>Rating</th><th>Games</th><th>Evidence</th><th>In the pool (W-L-D)</th><th></th></tr>
${pool.length ? pool.map(row).join("") : `<tr><td colspan="8" class="muted">Nobody is in the pool.</td></tr>`}</table></div>`;
}

function listPage(
  cases: CaseRow[],
  appeals: (Appeal & { name: string })[],
  log: { user_id: string; at: number; action: string; by: string; reason: string | null; name: string | null }[],
  status: string,
  by: string,
  pool: { rows: PoolRow[]; ids: string[] } | null = null,
): string {
  const tabs = LISTS.map((s) => (s === status ? `<b>${s}</b>` : `<a href="/admin/fairplay?status=${s}">${s}</a>`)).join(" · ");
  return `<h1>Fair play</h1>
<p class="muted">Signed in as ${esc(by.replace("admin:", ""))}. Detection: <b>${esc(FAIRPLAY.enforcement)}</b>${FAIRPLAY.enforcement === "watch" ? " (records only; reviews come from reports)" : FAIRPLAY.enforcement === "pool" ? " (reviews; a ban level goes to the engine pool, never a ban)" : ""}.</p>
${appeals.length ? `<h2>Appeals waiting (${appeals.length})</h2><div class="card scroll"><table><tr><th>When</th><th>Player</th><th>Appeal</th></tr>${appeals
    .map((a) => `<tr><td>${when(a.at)}</td><td><a href="/admin/fairplay/case/${esc(a.user_id)}">${esc(a.name)}</a></td><td class="wrap">${esc(a.text)}</td></tr>`)
    .join("")}</table></div>` : ""}
<form class="row" method="get" action="/admin/fairplay/find"><input type="text" name="q" placeholder="A player's id or profile link" aria-label="A player's id or profile link"><button>Open</button></form>
<h2>Cases</h2><nav>${tabs}</nav>
${pool ? poolSection(pool) : `<div class="card scroll"><table><tr><th>Player</th><th>Status</th><th>Why</th><th>Cheating reports (7 d)</th><th>Max score (30 d)</th><th>Latest strength</th><th>Matches</th><th>Updated</th></tr>
${cases.length ? cases
    .map(
      (c) =>
        `<tr><td><a href="/admin/fairplay/case/${esc(c.userId)}">${esc(c.name)}</a>${c.openAppeal ? ' <span class="pill">appeal</span>' : ""}</td><td class="${esc(c.status)}">${esc(c.status)}</td><td class="wrap">${esc(c.reason)}</td><td>${c.cheatingReports} (${c.reports} all)</td><td>${c.maxScore ?? ""}</td><td>${c.latestPerf ?? ""}</td><td>${c.matches}</td><td>${when(c.updatedAt)}</td></tr>`,
    )
    .join("") : `<tr><td colspan="8" class="muted">Nothing here.</td></tr>`}</table></div>`}
<h2>Recent decisions</h2><div class="card scroll"><table><tr><th>When</th><th>Player</th><th>Action</th><th>By</th><th>Reason</th></tr>
${log.map((l) => `<tr><td>${when(l.at)}</td><td><a href="/admin/fairplay/case/${esc(l.user_id)}">${esc(l.name ?? DELETED_NAME)}</a></td><td>${esc(l.action)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td></tr>`).join("")}</table></div>`;
}

const CHAT_ACTIONS: Record<string, string> = { warn: "warning", ban: "chat ban", lift: "chat ban lifted", reset: "name and icon reset", merged: "a guest's decisions merged in" };
const chatState = (b: ChatBlock | null) => (b ? `<b class="banned">chat ban</b> ${b.until ? `until ${when(b.until)}` : "with no end"}` : '<span class="cleared">open</span>');

/** A player's chat (chat moderation, chat-mod.ts): any ban in force, the decisions, and the form to decide. */
function chatSection(id: string, chat: { block: ChatBlock | null; log: ChatLogRow[] }): string {
  const bans = [...CHAT_MOD.banDays.map((n) => [String(n), `Chat ban ${n} ${n === 1 ? "day" : "days"}`]), ["forever", "Chat ban, no end"]]
    .map(([v, label]) => `<button class="ban" name="action" value="chat:ban:${v}">${label}</button>`)
    .join("");
  const decision = (l: ChatLogRow) =>
    `${esc(CHAT_ACTIONS[l.action] ?? l.action)}${l.action === "ban" ? (l.until ? ` until ${when(l.until)}` : " (no end)") : ""}${l.action === "ban" && l.ended_at ? ` <span class="muted">(ended ${when(l.ended_at)})</span>` : ""}`;
  return `<h2>Chat</h2>
<div class="card">Chat: ${chatState(chat.block)} · <a href="/profile/${esc(id)}">Their profile (name and icon)</a></div>
<form class="row" method="post">
<input type="text" name="chat_reason" placeholder="Reason (for the log)" maxlength="500">
<input type="text" name="chat_note" placeholder="Note to the player (optional)" maxlength="500">
<button name="action" value="chat:warn">Warn</button>${bans}<button name="action" value="chat:lift">Lift the chat ban</button><button name="action" value="chat:reset">Reset name and icon</button></form>
<p class="muted">Every chat decision needs a reason. A chat ban only stops sending: they still read chat and play. A warning or a chat ban shows the player your note once, on their home screen.</p>
<p class="muted">A reset or a chat ban doesn't close the report's watch case: click Clear (under Decide) for that.</p>
${chat.log.length ? `<div class="card scroll"><table><tr><th>When</th><th>Decision</th><th>By</th><th>Reason</th><th>Note to the player</th></tr>${chat.log
    .map((l) => `<tr><td>${when(l.at)}</td><td>${decision(l)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td><td class="wrap">${esc(l.note)}</td></tr>`)
    .join("")}</table></div>` : ""}`;
}

/** One ranked 1 v 1 game on the case page: who, how it ended, and the engine's check of the player's moves (if made). */
function duelCard(g: CaseDetail["duels"][number]): string {
  const s = g.summary;
  const head = `<b>1 v 1</b> ${esc(g.id.slice(0, 5))}${g.reported ? ' <span class="pill review">reported</span>' : ""} · ${when(g.endedAt)} · ${g.color === "w" ? "White" : "Black"} against <a href="/admin/fairplay/case/${esc(g.opponent.id)}">${esc(g.opponent.name)}</a> · ${esc(g.control)} · ${esc(g.result)} (${esc(g.reason)}) · ${g.moves} plies`;
  const sum = g.check
    ? `<br>Engine check${g.check.done ? "" : " (part done)"}: the engine's best on <b>${s.best}</b> of ${s.checked} moves checked · average loss <b>${s.avgLoss ?? "–"}</b> · plays like <b>${s.strength ?? "–"}</b>`
    : '<br><span class="muted">Not checked yet.</span>';
  const rows = g.check?.moves.length
    ? `<details><summary>Moves</summary><div class="scroll"><table><tr><th>Ply</th><th>Pick</th><th>Engine's best</th><th>Rank</th><th>Loss</th><th>Think</th></tr>${g.check.moves
        .map((m) => `<tr class="${m.rank === 1 ? "hard" : ""}"><td>${m.ply + 1}</td><td>${esc(m.move)}</td><td>${esc(m.best)}</td><td>${m.rank}</td><td>${m.loss}</td><td>${(m.thinkMs / 1000).toFixed(1)} s</td></tr>`)
        .join("")}</table></div></details>`
    : "";
  return `<div class="card">${head}${sum}${rows}</div>`;
}

function casePage(d: CaseDetail, note: string | null, chat: { block: ChatBlock | null; log: ChatLogRow[] }): string {
  const c = d.case;
  const openAppeal = d.appeals.find((a) => a.status === "open");
  const decision = `<form class="row" method="post">
  <input type="text" name="reason" placeholder="Reason (for the log; required)" required minlength="5">
  <input type="text" name="notice" placeholder="Note to the player (optional; in the email)">
  <button class="ban" name="action" value="ban">Ban (can't sign in)</button><button class="clear" name="action" value="clear">Clear</button>
  <button name="action" value="watch">Watch</button><button name="action" value="review">Review</button></form>`;
  const appealForm = openAppeal
    ? `<div class="card"><b>Open appeal</b> (${when(openAppeal.at)})<p>${esc(openAppeal.text)}</p><form class="row" method="post"><input type="hidden" name="action" value="appeal"><input type="hidden" name="appeal" value="${openAppeal.id}">
  <input type="text" name="reply" placeholder="Reply to the player (required)" required minlength="5"><button class="clear" name="outcome" value="overturned">Overturn (clear)</button><button class="ban" name="outcome" value="upheld">Uphold the ban</button></form></div>`
    : "";
  const match = (m: CaseDetail["matches"][number]) => {
    const s = m.summary;
    const head = `<b>${esc(m.mode)}</b> ${esc(m.lobby ?? "")} · ${when(m.playedAt)} · strength <b>${m.perf ?? "–"}</b> on ${m.counted} counted moves · score <b>${m.score}</b> (strength ${s.parts.perf}, jump ${s.parts.jump}, evidence ${s.parts.evidence ?? 0}, streak ${s.parts.streak}, time ${s.parts.time}, look-aways ${s.parts.away}) · level ${esc(m.level)}
  <br><span class="muted">avg loss ${s.avgLoss ?? "–"}, found ${s.found}/${s.counted}, run ${s.topStreak}; hard ${s.hardFinds}/${s.hard} (run ${s.hardStreak}); evidence ${s.evidence ?? "–"}; ${s.deepChecked ? `${Math.round((100 * (s.deepMatch ?? 0)) / s.deepChecked)}% near the engine's best (${s.deepMatch ?? 0}/${s.deepChecked}${s.deepExact === undefined ? "" : `, its very best ${s.deepExact}`})` : "not deep-checked"}; fast hard ${s.fastHard}; time vs difficulty ${s.timeCorr ?? "–"}; look-aways ${s.awayFound}/${s.awayMoves} found</span>`;
    const rows = m.moves
      ? `<div class="scroll"><table><tr><th>Move</th><th>Pick</th><th>Best</th><th>Loss</th><th>Crowd found</th><th>Near best</th><th>Think</th><th>Away</th><th>Deep</th><th>Counts</th></tr>${m.moves
          .map(
            (x) =>
              `<tr class="${x.counted ? (x.crowdRate !== null && x.crowdRate < FAIRPLAY.signals.hardShare ? "hard" : "") : "skip"}"><td>${esc(x.moveNo)}</td><td>${esc(x.pick)}</td><td>${esc(x.best)}</td><td>${x.loss}</td><td>${x.crowdRate === null ? `– (${x.crowd})` : `${Math.round(x.crowdRate * 100)}% of ${x.crowd}`}</td><td>${x.near}</td><td>${x.thinkS} s${x.premove ? " (premove)" : ""}</td><td>${x.away || ""}</td><td>${x.deepRank === null ? "" : x.deepRank === 1 ? "= engine" : `${x.deepNear ? "≈ engine: " : ""}#${x.deepRank} (${esc(x.deepBest)}), ${x.deepLoss} off`}</td><td>${x.counted ? "yes" : esc(x.skip)}</td></tr>`,
          )
          .join("")}</table></div>`
      : `<p class="muted">Moves deleted (kept ${FAIRPLAY.evidenceDays} days for flagged or reported players).</p>`;
    return `<div class="card">${head}${rows}</div>`;
  };
  return `<p><a href="/admin/fairplay">← Fair play</a></p><h1>${esc(d.player.name)}</h1>
${note ? `<div class="card">${esc(note)}</div>` : ""}
<p class="muted">${esc(d.player.id)} · ${d.player.joinedAt === null ? "the account was deleted; its fair-play file is kept" : `${d.player.signedIn ? esc(d.player.email ?? "signed in (Google)") : "guest"} · joined ${when(d.player.joinedAt)}`} · ${d.player.onlineMatches} online matches</p>
<div class="card">Status: <b class="${esc(c?.status ?? "")}">${esc(c?.status ?? "no case")}</b> ${c ? `· ${esc(c.reason)} · updated ${when(c.updated_at)}${c.decided_by ? ` · last decided by ${esc(c.decided_by)}` : ""}` : ""}</div>
${appealForm}
${c?.status === "pool" ? `<div class="card"><b>In the engine pool</b>: they meet only other pooled players or bots, in every queue, and see nothing different. <form class="row" method="post"><input type="text" name="reason" placeholder="Reason (optional)"><button class="clear" name="action" value="release">Release</button></form></div>` : ""}
<h2>Decide</h2>${decision}
<form class="row" method="post"><button name="action" value="deep">Check the counted moves with the engine server now</button></form>
<p class="muted">The button checks their 1 v 1 games too (below), reported ones first, within the day's budget: each move against every legal move, in groups of 8 (about 5 searches a move, so a press covers about 12 moves).</p>
<p class="muted">Hard positions (fewer than ${Math.round(FAIRPLAY.signals.hardShare * 100)}% of the crowd found the best move) are in bold; grayed rows don't count (opening, forced, obvious, decided, power-up).</p>
${chatSection(d.player.id, chat)}
${d.sameDevice.length ? `<h2>Same device</h2><p>${d.sameDevice.map((u) => `<a href="/admin/fairplay/case/${esc(u.id)}">${esc(u.name)}</a> (${esc(u.status ?? "no case")})`).join(", ")}</p>` : ""}
<h2>Reports (${d.reports.length})</h2>${d.reports.length ? `<div class="card scroll"><table><tr><th>When</th><th>Reason</th><th>Match</th><th>By</th></tr>${d.reports
    .map((r) => `<tr><td>${when(r.at)}</td><td>${esc(r.reason)}${r.line ? `<div class="wrap">“${esc(r.line.text)}” <span class="muted">(said ${when(r.line.at)} in the town square)</span></div>` : ""}</td><td>${esc(r.match ?? (r.line ? "town chat" : "profile"))}</td><td><a href="/admin/fairplay/case/${esc(r.reporter.id)}">${esc(r.reporter.name)}</a>${r.reporter.signedIn ? "" : " (guest)"}</td></tr>`)
    .join("")}</table></div>` : '<p class="muted">None.</p>'}
<h2>Matches (${d.matches.length})</h2>${d.matches.map(match).join("") || '<p class="muted">No online matches recorded.</p>'}
<h2>1 v 1 games (${d.duels.length})</h2>${d.duels.map(duelCard).join("") || '<p class="muted">None kept.</p>'}
<h2>Appeals</h2>${d.appeals.map((a) => `<div class="card">${when(a.at)} · <b>${esc(a.status)}</b>${a.decided_by ? ` by ${esc(a.decided_by)}` : ""}<p>${esc(a.text)}</p>${a.reply ? `<p class="muted">Reply: ${esc(a.reply)}</p>` : ""}</div>`).join("") || '<p class="muted">None.</p>'}
<h2>Log</h2><div class="card scroll"><table><tr><th>When</th><th>Action</th><th>By</th><th>Reason</th></tr>${d.log
    .map((l) => `<tr><td>${when(l.at)}</td><td>${esc(l.action)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td></tr>`)
    .join("")}</table></div>`;
}
