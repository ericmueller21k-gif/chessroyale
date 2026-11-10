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
import { CHAT_MOD, FAIRPLAY, atBanBar, crowdRate, skipReason, type FairMove, type FairSummary } from "@chessroyale/core";
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
  /** The evidence: fair-play matches kept, those at the one-match ban bar, the deep re-check's best on how many checked, best strength. */
  evidence: { matches: number; atBar: number; deepMatch: number; deepChecked: number; bestPerf: number | null };
  /**
   * How they do in the pool, since they went in (everyone they meet there is pooled, or a bot): crowd-mode games and wins (their team
   * or first place), 1 v 1 wins, losses and draws (`vsPool`: against players still pooled), and their fair-play matches' strength and
   * deep matches. Getting crushed there: likely a false positive.
   */
  inPool: { games: number; wins: number; duelWins: number; duelLosses: number; duelDraws: number; vsPool: number; matches: number; avgPerf: number | null; deepMatch: number; deepChecked: number };
}

/** Every pooled player (deleted accounts' kept cases too, as a deleted player), the latest in first. */
export async function poolPlayers(sql: Sql, limit = 200): Promise<PoolRow[]> {
  const cases = await sql.all<{ user_id: string; reason: string | null; updated_at: number; name: string; rating: number | null }>(
    `SELECT c.user_id, c.reason, c.updated_at, COALESCE(u.name, ?) AS name, u.rating FROM fairplay_cases c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.status = 'pool' ORDER BY c.updated_at DESC LIMIT ?`,
    DELETED_NAME,
    limit,
  );
  const out: PoolRow[] = [];
  for (const c of cases) {
    const id = c.user_id;
    const entry = await sql.first<{ at: number; by: string }>("SELECT at, by FROM fairplay_log WHERE user_id = ? AND action = 'pool' ORDER BY at DESC, id DESC LIMIT 1", id);
    const since = entry?.at ?? c.updated_at;
    const r1 = await sql.first<{ rating: number; games: number }>("SELECT rating, games FROM ranked_1v1 WHERE user_id = ?", id).catch(() => null);
    const online = await sql.first<{ n: number; won: number }>(
      "SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN played_at > ? AND (team_won = 1 OR placement = 1) THEN 1 ELSE 0 END), 0) AS won FROM results WHERE user_id = ? AND online = 1",
      since,
      id,
    );
    const inGames = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND online = 1 AND played_at > ?", id, since))?.n ?? 0;
    const duels = await sql
      .all<{ white_id: string; black_id: string; result: string; pooled: number }>(
        `SELECT g.white_id, g.black_id, g.result, EXISTS (SELECT 1 FROM fairplay_cases o WHERE o.status = 'pool' AND o.user_id = CASE WHEN g.white_id = ?1 THEN g.black_id ELSE g.white_id END) AS pooled
         FROM ranked_1v1_games g WHERE (g.white_id = ?1 OR g.black_id = ?1) AND g.ended_at > ?2 AND g.result != 'aborted'`,
        id,
        since,
      )
      .catch(() => []);
    const score = (g: { white_id: string; result: string }) => (g.result === "1/2-1/2" ? 0.5 : (g.result === "1-0") === (g.white_id === id) ? 1 : 0);
    const matches = await sql.all<{ played_at: number; perf: number | null; summary: string }>("SELECT played_at, perf, summary FROM fairplay_matches WHERE user_id = ? ORDER BY played_at DESC LIMIT 200", id);
    const ev = { matches: matches.length, atBar: 0, deepMatch: 0, deepChecked: 0, bestPerf: null as number | null };
    const pool = { matches: 0, perfs: [] as number[], deepMatch: 0, deepChecked: 0 };
    for (const m of matches) {
      let s: Partial<FairSummary> = {};
      try {
        s = JSON.parse(m.summary) as Partial<FairSummary>;
      } catch {
        // An unreadable summary: no deep numbers.
      }
      const one = { score: 0, perf: m.perf, counted: s.counted ?? 0, deepChecked: s.deepChecked ?? 0, deepMatch: s.deepMatch ?? 0, evidence: s.evidence ?? 0 };
      if (atBanBar(one)) ev.atBar++;
      ev.deepMatch += one.deepMatch;
      ev.deepChecked += one.deepChecked;
      if (m.perf !== null) ev.bestPerf = Math.max(ev.bestPerf ?? 0, m.perf);
      if (m.played_at > since) {
        pool.matches++;
        if (m.perf !== null) pool.perfs.push(m.perf);
        pool.deepMatch += one.deepMatch;
        pool.deepChecked += one.deepChecked;
      }
    }
    out.push({
      userId: id,
      name: c.name,
      since,
      why: c.reason,
      by: entry?.by ?? null,
      rating: c.rating,
      rating1v1: r1 ? Math.round(r1.rating) : null,
      games: (online?.n ?? 0) + (r1?.games ?? 0),
      evidence: ev,
      inPool: {
        games: inGames,
        wins: online?.won ?? 0,
        duelWins: duels.filter((g) => score(g) === 1).length,
        duelLosses: duels.filter((g) => score(g) === 0).length,
        duelDraws: duels.filter((g) => score(g) === 0.5).length,
        vsPool: duels.filter((g) => g.pooled).length,
        matches: pool.matches,
        avgPerf: pool.perfs.length ? Math.round(pool.perfs.reduce((a, b) => a + b, 0) / pool.perfs.length) : null,
        deepMatch: pool.deepMatch,
        deepChecked: pool.deepChecked,
      },
    });
  }
  return out;
}

/** How a pooled player is doing there, in a few words: crushed (likely a false positive) or still playing like an engine. */
export function poolHint(p: PoolRow): string {
  const n = p.inPool.games + p.inPool.duelWins + p.inPool.duelLosses + p.inPool.duelDraws;
  const won = p.inPool.wins + p.inPool.duelWins + p.inPool.duelDraws / 2;
  if (n >= 5 && won / n < 0.3) return "getting crushed: likely a false positive";
  if (p.inPool.deepChecked >= 8 && p.inPool.deepMatch / p.inPool.deepChecked >= FAIRPLAY.levels.banDeep) return "still playing like an engine";
  return n ? "" : "no games in the pool yet";
}

/** The engine pool's export (the list's download): each pooled player's row and their whole file, moves and all; no email. */
export async function poolExport(sql: Sql, now: number): Promise<{ exportedAt: string; about: string; players: (PoolRow & { file: CaseDetail | null })[] }> {
  const players = [];
  for (const p of await poolPlayers(sql, 500)) players.push({ ...p, file: await caseDetail(sql, p.userId, { email: false, lines: false, limit: 200 }) });
  return { exportedAt: new Date(now).toISOString(), about: "Fair play's engine pool: who is in it, why, the evidence kept and how each does in the pool. Times are ms since 1970 (UTC).", players };
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
  /** The deep re-check: its best move (SAN) and the pick's rank among the candidates (1: its best), or null. */
  deepBest: string | null;
  deepRank: number | null;
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
  // The engine pool's download: every pooled player, the evidence and how they do in the pool (JSON, no emails).
  if (url.pathname === "/admin/fairplay/pool.json") {
    return new Response(JSON.stringify(await poolExport(sql, now), null, 1), {
      headers: { "content-type": "application/json", "cache-control": "no-store", "content-disposition": `attachment; filename="engine-pool-${new Date(now).toISOString().slice(0, 10)}.json"` },
    });
  }
  // Any player's page by their id or their profile's link (to act on a name, an icon or their chat).
  if (url.pathname === "/admin/fairplay/find") {
    const id = (url.searchParams.get("q") ?? "").trim().split(/[/?#]/).filter(Boolean).find((p, i, all) => i === all.length - 1 || all[i - 1] === "profile");
    return /^[A-Za-z0-9_-]{1,64}$/.test(id ?? "") ? Response.redirect(`${url.origin}/admin/fairplay/case/${id}`, 303) : notFound();
  }
  if (url.pathname === "/admin/fairplay") {
    const status = url.searchParams.get("status") ?? "open";
    const cases = await openCases(sql, now, (LISTS as readonly string[]).includes(status) ? (status as "open") : "open");
    const appeals = await sql.all<Appeal & { name: string }>(
      "SELECT a.id, a.user_id, a.at, a.text, a.status, a.decided_at, a.decided_by, a.reply, u.name FROM fairplay_appeals a JOIN users u ON u.id = a.user_id WHERE a.status = 'open' ORDER BY a.at",
    );
    const log = await sql.all<{ user_id: string; at: number; action: string; by: string; reason: string | null; name: string | null }>(
      `SELECT l.user_id, l.at, l.action, l.by, l.reason, u.name FROM fairplay_log l LEFT JOIN users u ON u.id = l.user_id
       WHERE l.by != 'detection' AND l.by != 'reports' ORDER BY l.at DESC, l.id DESC LIMIT 40`,
    );
    return adminPage("Fair play", listPage(cases, appeals, log, status, by, await poolPlayers(sql)));
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

/** The engine pool's list: who, since when and why, their numbers, the evidence and how they do in the pool, each with Release. */
function poolSection(pool: PoolRow[]): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
  const row = (p: PoolRow) => {
    const i = p.inPool;
    const hint = poolHint(p);
    return `<tr><td><a href="/admin/fairplay/case/${esc(p.userId)}">${esc(p.name)}</a></td><td>${when(p.since)}${p.by && p.by !== "detection" ? ` <span class="pill">${esc(p.by)}</span>` : ""}</td><td class="wrap">${esc(p.why)}</td>
<td>${p.rating ?? "–"} · 1 v 1 ${p.rating1v1 ?? "–"}</td><td>${p.games}</td>
<td>${p.evidence.atBar} of ${p.evidence.matches} at the bar · deep ${pct(p.evidence.deepMatch, p.evidence.deepChecked)} of ${p.evidence.deepChecked} · best ${p.evidence.bestPerf ?? "–"}</td>
<td class="wrap">${i.wins}/${i.games} won · 1 v 1 ${i.duelWins}-${i.duelLosses}-${i.duelDraws} (${i.vsPool} vs pooled) · strength ${i.avgPerf ?? "–"}, deep ${pct(i.deepMatch, i.deepChecked)}${hint ? `<br><b>${esc(hint)}</b>` : ""}</td>
<td><form method="post" action="/admin/fairplay/case/${esc(p.userId)}"><button class="clear" name="action" value="release">Release</button></form></td></tr>`;
  };
  return `<h2>Engine pool (${pool.length})</h2>
<p class="muted">Detection's ban level, or a new account with ${FAIRPLAY.pool.newHits} of its first ${FAIRPLAY.pool.newGames} matches at the one-match ban bar. They meet only each other or bots, in every queue, and see nothing different. Release puts them back in the usual queues (logged). <a href="/admin/fairplay/pool.json">Download (JSON)</a></p>
<div class="card scroll"><table><tr><th>Player</th><th>In since</th><th>Why</th><th>Rating</th><th>Games</th><th>Evidence</th><th>In the pool (W-L-D)</th><th></th></tr>
${pool.length ? pool.map(row).join("") : `<tr><td colspan="8" class="muted">Nobody is in the pool.</td></tr>`}</table></div>`;
}

function listPage(
  cases: CaseRow[],
  appeals: (Appeal & { name: string })[],
  log: { user_id: string; at: number; action: string; by: string; reason: string | null; name: string | null }[],
  status: string,
  by: string,
  pool: PoolRow[] = [],
): string {
  const tabs = LISTS.map((s) => (s === status ? `<b>${s}</b>` : `<a href="/admin/fairplay?status=${s}">${s}</a>`)).join(" · ");
  return `<h1>Fair play</h1>
<p class="muted">Signed in as ${esc(by.replace("admin:", ""))}. Detection: <b>${esc(FAIRPLAY.enforcement)}</b>${FAIRPLAY.enforcement === "watch" ? " (records only; reviews come from reports)" : FAIRPLAY.enforcement === "pool" ? " (reviews; a ban level goes to the engine pool, never a ban)" : ""}.</p>
${appeals.length ? `<h2>Appeals waiting (${appeals.length})</h2><div class="card scroll"><table><tr><th>When</th><th>Player</th><th>Appeal</th></tr>${appeals
    .map((a) => `<tr><td>${when(a.at)}</td><td><a href="/admin/fairplay/case/${esc(a.user_id)}">${esc(a.name)}</a></td><td class="wrap">${esc(a.text)}</td></tr>`)
    .join("")}</table></div>` : ""}
<form class="row" method="get" action="/admin/fairplay/find"><input type="text" name="q" placeholder="A player's id or profile link" aria-label="A player's id or profile link"><button>Open</button></form>
${poolSection(pool)}
<h2>Cases</h2><nav>${tabs}</nav>
<div class="card scroll"><table><tr><th>Player</th><th>Status</th><th>Why</th><th>Cheating reports (7 d)</th><th>Max score (30 d)</th><th>Latest strength</th><th>Matches</th><th>Updated</th></tr>
${cases.length ? cases
    .map(
      (c) =>
        `<tr><td><a href="/admin/fairplay/case/${esc(c.userId)}">${esc(c.name)}</a>${c.openAppeal ? ' <span class="pill">appeal</span>' : ""}</td><td class="${esc(c.status)}">${esc(c.status)}</td><td class="wrap">${esc(c.reason)}</td><td>${c.cheatingReports} (${c.reports} all)</td><td>${c.maxScore ?? ""}</td><td>${c.latestPerf ?? ""}</td><td>${c.matches}</td><td>${when(c.updatedAt)}</td></tr>`,
    )
    .join("") : `<tr><td colspan="8" class="muted">Nothing here.</td></tr>`}</table></div>
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
  <button class="ban" name="action" value="ban">Ban from online play</button><button class="clear" name="action" value="clear">Clear</button>
  <button name="action" value="watch">Watch</button><button name="action" value="review">Review</button></form>`;
  const appealForm = openAppeal
    ? `<div class="card"><b>Open appeal</b> (${when(openAppeal.at)})<p>${esc(openAppeal.text)}</p><form class="row" method="post"><input type="hidden" name="action" value="appeal"><input type="hidden" name="appeal" value="${openAppeal.id}">
  <input type="text" name="reply" placeholder="Reply to the player (required)" required minlength="5"><button class="clear" name="outcome" value="overturned">Overturn (clear)</button><button class="ban" name="outcome" value="upheld">Uphold the ban</button></form></div>`
    : "";
  const match = (m: CaseDetail["matches"][number]) => {
    const s = m.summary;
    const head = `<b>${esc(m.mode)}</b> ${esc(m.lobby ?? "")} · ${when(m.playedAt)} · strength <b>${m.perf ?? "–"}</b> on ${m.counted} counted moves · score <b>${m.score}</b> (strength ${s.parts.perf}, jump ${s.parts.jump}, evidence ${s.parts.evidence ?? 0}, streak ${s.parts.streak}, time ${s.parts.time}, look-aways ${s.parts.away}) · level ${esc(m.level)}
  <br><span class="muted">avg loss ${s.avgLoss ?? "–"}, found ${s.found}/${s.counted}, run ${s.topStreak}; hard ${s.hardFinds}/${s.hard} (run ${s.hardStreak}); evidence ${s.evidence ?? "–"}; deep matches ${s.deepMatch ?? 0}/${s.deepChecked ?? 0}; fast hard ${s.fastHard}; time vs difficulty ${s.timeCorr ?? "–"}; look-aways ${s.awayFound}/${s.awayMoves} found</span>`;
    const rows = m.moves
      ? `<div class="scroll"><table><tr><th>Move</th><th>Pick</th><th>Best</th><th>Loss</th><th>Crowd found</th><th>Near best</th><th>Think</th><th>Away</th><th>Deep</th><th>Counts</th></tr>${m.moves
          .map(
            (x) =>
              `<tr class="${x.counted ? (x.crowdRate !== null && x.crowdRate < FAIRPLAY.signals.hardShare ? "hard" : "") : "skip"}"><td>${esc(x.moveNo)}</td><td>${esc(x.pick)}</td><td>${esc(x.best)}</td><td>${x.loss}</td><td>${x.crowdRate === null ? `– (${x.crowd})` : `${Math.round(x.crowdRate * 100)}% of ${x.crowd}`}</td><td>${x.near}</td><td>${x.thinkS} s${x.premove ? " (premove)" : ""}</td><td>${x.away || ""}</td><td>${x.deepRank === null ? "" : x.deepRank === 1 ? "= engine" : `#${x.deepRank} (${esc(x.deepBest)})`}</td><td>${x.counted ? "yes" : esc(x.skip)}</td></tr>`,
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
