/**
 * Fair play's review: the page for Eric (`/admin/fairplay`, server-rendered, admin emails only) and the API the
 * automated reviewer uses (`/api/admin/fairplay/*`, a bearer token). See docs/fairplay-reviewer.md.
 *
 * Who may look:
 *   - an admin: signed in with an email in ADMIN_EMAILS (a Worker variable or secret, comma-separated; never in the
 *     repo). Anyone else gets "Not found";
 *   - the automated reviewer: `Authorization: Bearer <FAIRPLAY_REVIEW_TOKEN>` (a Worker secret), API only.
 * Every decision goes in the case's log with who made it ("admin:<email>" or "reviewer") and why. The reviewer never
 * decides appeals, nor changes a ban (fairplay.ts, decide).
 */
import { FAIRPLAY, crowdRate, skipReason, type FairMove, type FairSummary } from "@chessroyale/core";
import { toSan } from "@chessroyale/chess";
import { d1Sql, ensureSchema, userFromToken, type Sql, type User } from "./accounts.ts";
import { SESSION_COOKIE, readCookie, type AccountEnv } from "./api.ts";
import { caseOf, decide, decideAppeal, purgeEvidence, type Appeal, type Case, type CaseMailer } from "./fairplay.ts";
import { deepCheckRun, type DeepSearch } from "./fairplay-deep.ts";

export interface AdminEnv extends AccountEnv {
  /**
   * Admins' sign-in emails, comma-separated: a Worker variable or secret, or a Secrets Store binding (withSecrets in
   * api.ts reads it as a string first).
   */
  ADMIN_EMAILS?: string;
  /** The automated reviewer's bearer token: a Worker secret or a Secrets Store binding, like ADMIN_EMAILS. */
  FAIRPLAY_REVIEW_TOKEN?: string;
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
export async function openCases(sql: Sql, now: number, status: "open" | "review" | "watch" | "banned" | "all" = "open", limit = 100): Promise<CaseRow[]> {
  const where =
    status === "open"
      ? "c.status IN ('review', 'watch') OR c.user_id IN (SELECT user_id FROM fairplay_appeals WHERE status = 'open')"
      : status === "all"
        ? "1 = 1"
        : "c.status = ?";
  const rows = await sql.all<Case & { name: string }>(
    `SELECT c.user_id, c.status, c.reason, c.opened_at, c.updated_at, c.decided_at, c.decided_by, u.name FROM fairplay_cases c
     JOIN users u ON u.id = c.user_id WHERE ${where} ORDER BY c.updated_at DESC LIMIT 500`,
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
    away: m.away,
    deepBest: m.deep ? san(m.deep.best) : null,
    deepRank: m.deep?.rank ?? null,
  };
}

export interface CaseDetail {
  player: { id: string; name: string; joinedAt: number; signedIn: boolean; email: string | null; onlineMatches: number };
  case: Case | null;
  reports: { at: number; reason: string; match: string | null; reporter: { id: string; name: string; signedIn: boolean } }[];
  matches: { lobby: string | null; mode: string; playedAt: number; counted: number; perf: number | null; score: number; level: string; summary: FairSummary; moves: EvidenceMove[] | null; keepUntil: number | null }[];
  log: { at: number; action: string; by: string; reason: string | null }[];
  appeals: Appeal[];
  /** Accounts that played online from the same device markers. */
  sameDevice: { id: string; name: string; status: string | null }[];
}

/** Everything about one case: the player, reports, each match's signals and judged picks, the log and appeals. */
export async function caseDetail(sql: Sql, userId: string, opts: { email: boolean; limit?: number } = { email: false }): Promise<CaseDetail | null> {
  const u = await sql.first<{ id: string; name: string; created_at: number; email: string | null; google_sub: string | null }>(
    "SELECT id, name, created_at, email, google_sub FROM users WHERE id = ?",
    userId,
  );
  if (!u) return null;
  const online = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND online = 1", userId))?.n ?? 0;
  const reports = await sql.all<{ at: number; reason: string; match: string | null; id: string; name: string; email: string | null; google_sub: string | null }>(
    `SELECT r.at, r.reason, r.match, u.id, u.name, u.email, u.google_sub FROM reports r JOIN users u ON u.id = r.reporter
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
    `SELECT DISTINCT u.id, u.name, c.status FROM fairplay_devices d JOIN fairplay_devices o ON o.device = d.device AND o.user_id != d.user_id
     JOIN users u ON u.id = o.user_id LEFT JOIN fairplay_cases c ON c.user_id = u.id WHERE d.user_id = ? LIMIT 20`,
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
    reports: reports.map((r) => ({ at: r.at, reason: r.reason, match: r.match, reporter: { id: r.id, name: r.name, signedIn: !!(r.email || r.google_sub) } })),
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
    // GET /api/admin/fairplay/cases?status=open|review|watch|banned|all
    if (url.pathname === "/api/admin/fairplay/cases" && request.method === "GET") {
      const status = url.searchParams.get("status") ?? "open";
      if (!["open", "review", "watch", "banned", "all"].includes(status)) return json({ message: "status must be open, review, watch, banned or all" }, 400);
      return json({ cases: await openCases(sql, now, status as "open"), policy: policy() });
    }
    const m = url.pathname.match(/^\/api\/admin\/fairplay\/cases\/([A-Za-z0-9_-]{1,64})(\/decision)?$/);
    if (m && !m[2] && request.method === "GET") {
      const d = await caseDetail(sql, m[1]!, { email: admin });
      return d ? json(d) : json({ message: "no such player" }, 404);
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
    if (action === "deep") {
      // The deep re-check of this player's matches now, whatever the hour (within the day's budget).
      if (!deepSearch) note = "The engine server isn't available here.";
      else {
        const d = await deepCheckRun(sql, deepSearch, now, { all: true, userId: m[1]!, mail, perRun: 60 });
        note = `Deep re-check: ${d.searches} searches, ${d.matches} matches done.`;
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
    const d = await caseDetail(sql, cm[1]!, { email: true });
    return d ? html(casePage(d, url.searchParams.get("note"))) : notFound();
  }
  if (url.pathname === "/admin/fairplay") {
    const status = url.searchParams.get("status") ?? "open";
    const cases = await openCases(sql, now, ["open", "review", "watch", "banned", "all"].includes(status) ? (status as "open") : "open");
    const appeals = await sql.all<Appeal & { name: string }>(
      "SELECT a.id, a.user_id, a.at, a.text, a.status, a.decided_at, a.decided_by, a.reply, u.name FROM fairplay_appeals a JOIN users u ON u.id = a.user_id WHERE a.status = 'open' ORDER BY a.at",
    );
    const log = await sql.all<{ user_id: string; at: number; action: string; by: string; reason: string | null; name: string | null }>(
      `SELECT l.user_id, l.at, l.action, l.by, l.reason, u.name FROM fairplay_log l LEFT JOIN users u ON u.id = l.user_id
       WHERE l.by != 'detection' AND l.by != 'reports' ORDER BY l.at DESC, l.id DESC LIMIT 40`,
    );
    return html(listPage(cases, appeals, log, status, by));
  }
  return notFound();
}

/** The decision policy the page and the API state (the reviewer follows the same rules: docs/fairplay-reviewer.md). */
export function policy() {
  return { enforcement: FAIRPLAY.enforcement, levels: FAIRPLAY.levels, score: FAIRPLAY.score, signals: FAIRPLAY.signals, reports: FAIRPLAY.reports };
}

// ---------------- HTML ----------------

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const when = (t: number | null | undefined) => (t ? new Date(t).toISOString().slice(0, 16).replace("T", " ") : "");
const html = (body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Fair play · HunChess</title><style>
:root{color-scheme:light dark;--bg:#fafaf7;--fg:#1d1d1b;--muted:#6b6b66;--line:#ddd9cf;--card:#fff;--gold:#b8860b;--bad:#b3261e;--ok:#1e7b34}
@media (prefers-color-scheme:dark){:root{--bg:#141412;--fg:#ecebe6;--muted:#a3a29b;--line:#34332e;--card:#1d1d1a;--gold:#e0b44c;--bad:#f2867d;--ok:#7fd18f}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:4px 0 12px}h2{font-size:17px;margin:22px 0 8px}a{color:var(--gold)}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top;white-space:nowrap}
td.wrap{white-space:normal;min-width:180px}.pill{display:inline-block;border-radius:99px;padding:1px 8px;font-size:12px;border:1px solid var(--line)}
.review,.banned{color:var(--bad)}.cleared{color:var(--ok)}.hard{font-weight:700}.skip{color:var(--muted)}
form.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}input[type=text],textarea{font:inherit;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);flex:1 1 260px}
button{font:inherit;min-height:40px;padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}button.ban{border-color:var(--bad);color:var(--bad)}button.clear{border-color:var(--ok);color:var(--ok)}
nav a{margin-right:12px}
</style></head><body><main>${body}</main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } },
  );

function listPage(cases: CaseRow[], appeals: (Appeal & { name: string })[], log: { user_id: string; at: number; action: string; by: string; reason: string | null; name: string | null }[], status: string, by: string): string {
  const tabs = ["open", "review", "watch", "banned", "all"].map((s) => (s === status ? `<b>${s}</b>` : `<a href="/admin/fairplay?status=${s}">${s}</a>`)).join(" · ");
  return `<h1>Fair play</h1>
<p class="muted">Signed in as ${esc(by.replace("admin:", ""))}. Detection: <b>${esc(FAIRPLAY.enforcement)}</b>${FAIRPLAY.enforcement === "watch" ? " (records only; reviews come from reports)" : ""}.</p>
${appeals.length ? `<h2>Appeals waiting (${appeals.length})</h2><div class="card scroll"><table><tr><th>When</th><th>Player</th><th>Appeal</th></tr>${appeals
    .map((a) => `<tr><td>${when(a.at)}</td><td><a href="/admin/fairplay/case/${esc(a.user_id)}">${esc(a.name)}</a></td><td class="wrap">${esc(a.text)}</td></tr>`)
    .join("")}</table></div>` : ""}
<h2>Cases</h2><nav>${tabs}</nav>
<div class="card scroll"><table><tr><th>Player</th><th>Status</th><th>Why</th><th>Cheating reports (7 d)</th><th>Max score (30 d)</th><th>Latest strength</th><th>Matches</th><th>Updated</th></tr>
${cases.length ? cases
    .map(
      (c) =>
        `<tr><td><a href="/admin/fairplay/case/${esc(c.userId)}">${esc(c.name)}</a>${c.openAppeal ? ' <span class="pill">appeal</span>' : ""}</td><td class="${esc(c.status)}">${esc(c.status)}</td><td class="wrap">${esc(c.reason)}</td><td>${c.cheatingReports} (${c.reports} all)</td><td>${c.maxScore ?? ""}</td><td>${c.latestPerf ?? ""}</td><td>${c.matches}</td><td>${when(c.updatedAt)}</td></tr>`,
    )
    .join("") : `<tr><td colspan="8" class="muted">Nothing here.</td></tr>`}</table></div>
<h2>Recent decisions</h2><div class="card scroll"><table><tr><th>When</th><th>Player</th><th>Action</th><th>By</th><th>Reason</th></tr>
${log.map((l) => `<tr><td>${when(l.at)}</td><td><a href="/admin/fairplay/case/${esc(l.user_id)}">${esc(l.name ?? l.user_id)}</a></td><td>${esc(l.action)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td></tr>`).join("")}</table></div>`;
}

function casePage(d: CaseDetail, note: string | null): string {
  const c = d.case;
  const openAppeal = d.appeals.find((a) => a.status === "open");
  const decision = `<form class="row" method="post">
  <input type="text" name="reason" placeholder="Reason (for the log; required)" required minlength="5">
  <input type="text" name="notice" placeholder="Note to the player (optional; in the email)">
  <button class="ban" name="action" value="ban">Ban</button><button class="clear" name="action" value="clear">Clear</button>
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
              `<tr class="${x.counted ? (x.crowdRate !== null && x.crowdRate < FAIRPLAY.signals.hardShare ? "hard" : "") : "skip"}"><td>${esc(x.moveNo)}</td><td>${esc(x.pick)}</td><td>${esc(x.best)}</td><td>${x.loss}</td><td>${x.crowdRate === null ? `– (${x.crowd})` : `${Math.round(x.crowdRate * 100)}% of ${x.crowd}`}</td><td>${x.near}</td><td>${x.thinkS} s</td><td>${x.away || ""}</td><td>${x.deepRank === null ? "" : x.deepRank === 1 ? "= engine" : `#${x.deepRank} (${esc(x.deepBest)})`}</td><td>${x.counted ? "yes" : esc(x.skip)}</td></tr>`,
          )
          .join("")}</table></div>`
      : `<p class="muted">Moves deleted (kept ${FAIRPLAY.evidenceDays} days for flagged or reported players).</p>`;
    return `<div class="card">${head}${rows}</div>`;
  };
  return `<p><a href="/admin/fairplay">← Fair play</a></p><h1>${esc(d.player.name)}</h1>
${note ? `<div class="card">${esc(note)}</div>` : ""}
<p class="muted">${esc(d.player.id)} · ${d.player.signedIn ? esc(d.player.email ?? "signed in (Google)") : "guest"} · joined ${when(d.player.joinedAt)} · ${d.player.onlineMatches} online matches</p>
<div class="card">Status: <b class="${esc(c?.status ?? "")}">${esc(c?.status ?? "no case")}</b> ${c ? `· ${esc(c.reason)} · updated ${when(c.updated_at)}${c.decided_by ? ` · last decided by ${esc(c.decided_by)}` : ""}` : ""}</div>
${appealForm}
<h2>Decide</h2>${decision}
<form class="row" method="post"><button name="action" value="deep">Check the counted moves with the engine server now</button></form>
<p class="muted">Hard positions (fewer than ${Math.round(FAIRPLAY.signals.hardShare * 100)}% of the crowd found the best move) are in bold; greyed rows don't count (opening, forced, obvious, decided, power-up).</p>
${d.sameDevice.length ? `<h2>Same device</h2><p>${d.sameDevice.map((u) => `<a href="/admin/fairplay/case/${esc(u.id)}">${esc(u.name)}</a> (${esc(u.status ?? "no case")})`).join(", ")}</p>` : ""}
<h2>Reports (${d.reports.length})</h2>${d.reports.length ? `<div class="card scroll"><table><tr><th>When</th><th>Reason</th><th>Match</th><th>By</th></tr>${d.reports
    .map((r) => `<tr><td>${when(r.at)}</td><td>${esc(r.reason)}</td><td>${esc(r.match ?? "profile")}</td><td><a href="/admin/fairplay/case/${esc(r.reporter.id)}">${esc(r.reporter.name)}</a>${r.reporter.signedIn ? "" : " (guest)"}</td></tr>`)
    .join("")}</table></div>` : '<p class="muted">None.</p>'}
<h2>Matches (${d.matches.length})</h2>${d.matches.map(match).join("") || '<p class="muted">No online matches recorded.</p>'}
<h2>Appeals</h2>${d.appeals.map((a) => `<div class="card">${when(a.at)} · <b>${esc(a.status)}</b>${a.decided_by ? ` by ${esc(a.decided_by)}` : ""}<p>${esc(a.text)}</p>${a.reply ? `<p class="muted">Reply: ${esc(a.reply)}</p>` : ""}</div>`).join("") || '<p class="muted">None.</p>'}
<h2>Log</h2><div class="card scroll"><table><tr><th>When</th><th>Action</th><th>By</th><th>Reason</th></tr>${d.log
    .map((l) => `<tr><td>${when(l.at)}</td><td>${esc(l.action)}</td><td>${esc(l.by)}</td><td class="wrap">${esc(l.reason)}</td></tr>`)
    .join("")}</table></div>`;
}
