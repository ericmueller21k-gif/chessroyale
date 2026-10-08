/**
 * Fair play on the server (the `fairplay` delegate): reports, cases, and what a case's status does. See DECISIONS.md,
 * "Fair play".
 *
 * A case is one player's fair-play file. Its status:
 *   - watch: recorded only (their matches' evidence is kept, see FAIRPLAY.evidenceDays);
 *   - review: a person or the automated reviewer decides; meanwhile their online results are held off ranking
 *     (results.held: the rating, its chart, "Top N%", later leaderboards and ranked) and eligibleForRanked says no;
 *   - banned: no online play (solo stays open), with an appeal a person decides; their sign-in identities are kept
 *     (hashed) so a new account made with them is banned too, and a device it played from puts new accounts in review;
 *   - cleared: decided in their favour; held results count again;
 *   - closed: a watch that saw nothing new for FAIRPLAY.evidenceDays.
 * Every change goes in fairplay_log with who made it and why.
 *
 * Evidence: every online match's judged picks are stored for each signed-in player (fairplay_matches.moves) for
 * FAIRPLAY.evidenceDaysUnflagged days, so a report made after a match still finds its games; for FAIRPLAY.evidenceDays
 * when the player was flagged or reported, and never deleted while their case is open (see purgeEvidence).
 */
import { FAIRPLAY, matchSignals, playerLevel, referenceStrength, type FairLevel, type FairMove, type FairSummary, type LevelInput, type LevelVerdict } from "@chessroyale/core";
import { getUser, refreshRating, sha256, type Sql, type User } from "./accounts.ts";

/** A case's status; "closed": a watch with nothing new for FAIRPLAY.evidenceDays (not a decision on the merits). */
export type CaseStatus = "watch" | "review" | "banned" | "cleared" | "closed";
/** Open cases: their evidence is never deleted. */
const OPEN: readonly CaseStatus[] = ["watch", "review"];
export type ReportReason = (typeof FAIRPLAY.reports.reasons)[number];
export const REPORT_THANKS = "Thanks, we'll look into it.";

const DAY = 86_400_000;
const signedIn = (u: Pick<User, "email" | "google_sub">) => !!(u.email || u.google_sub);

export interface Case {
  user_id: string;
  status: CaseStatus;
  reason: string | null;
  opened_at: number;
  updated_at: number;
  decided_at: number | null;
  decided_by: string | null;
}

export const caseOf = (sql: Sql, userId: string) =>
  sql.first<Case>("SELECT user_id, status, reason, opened_at, updated_at, decided_at, decided_by FROM fairplay_cases WHERE user_id = ?", userId);

/**
 * Whether a player's results may count for ranked play and leaderboards: not while they're in review or banned.
 * The hook for the `ranked` delegate.
 */
export async function eligibleForRanked(sql: Sql, userId: string): Promise<boolean> {
  const c = await caseOf(sql, userId);
  return !c || (c.status !== "review" && c.status !== "banned");
}

/** A line in the case's log. */
export async function logCase(sql: Sql, userId: string, action: string, by: string, reason: string | null, now: number): Promise<void> {
  await sql.run("INSERT INTO fairplay_log (user_id, at, action, by, reason) VALUES (?, ?, ?, ?, ?)", userId, now, action, by, reason);
}

/**
 * Sets a case's status (opening it if there's none), logs it, and holds or releases the player's results: entering
 * review or a ban holds their online results from the last FAIRPLAY.holdBackDays (the matches that put them there);
 * clearing releases everything held. `by`: "detection", "reports", "admin:<email>", "reviewer".
 */
export async function setCase(sql: Sql, userId: string, status: CaseStatus, by: string, reason: string, now: number): Promise<void> {
  const before = await caseOf(sql, userId);
  const decided = by !== "detection" && by !== "reports" && status !== "watch";
  if (before) {
    await sql.run(
      `UPDATE fairplay_cases SET status = ?, reason = ?, updated_at = ?${decided ? ", decided_at = ?, decided_by = ?" : ""} WHERE user_id = ?`,
      status,
      reason,
      now,
      ...(decided ? [now, by] : []),
      userId,
    );
  } else {
    await sql.run(
      "INSERT INTO fairplay_cases (user_id, status, reason, opened_at, updated_at, decided_at, decided_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      userId,
      status,
      reason,
      now,
      now,
      decided ? now : null,
      decided ? by : null,
    );
  }
  await logCase(sql, userId, status, by, reason, now);
  // Flagged or reported: their recent matches' evidence is kept the full time.
  if (status === "watch" || status === "review" || status === "banned") {
    await sql.run(
      "UPDATE fairplay_matches SET keep_until = MAX(COALESCE(keep_until, 0), ?) WHERE user_id = ? AND moves IS NOT NULL",
      now + FAIRPLAY.evidenceDays * DAY,
      userId,
    );
  }
  const held = (s: CaseStatus | undefined) => s === "review" || s === "banned";
  if (held(status) && !held(before?.status)) {
    await sql.run("UPDATE results SET held = 1 WHERE user_id = ? AND online = 1 AND played_at >= ?", userId, now - FAIRPLAY.holdBackDays * DAY);
    await refreshRating(sql, userId);
  } else if (!held(status) && held(before?.status)) {
    await sql.run("UPDATE results SET held = 0 WHERE user_id = ? AND held = 1", userId);
    await refreshRating(sql, userId);
  }
  if (status === "banned") {
    // Banned: every online result is held, and no rating (out of ranking, percentiles and later leaderboards); their
    // sign-in identities are kept so a new account made with them is banned too.
    await sql.run("UPDATE results SET held = 1 WHERE user_id = ? AND online = 1", userId);
    await sql.run("UPDATE users SET rating = NULL WHERE id = ?", userId);
    const u = await getUser(sql, userId);
    for (const [kind, hash] of u ? await identityHashes(u) : []) {
      await sql.run("INSERT OR REPLACE INTO fairplay_identities (kind, hash, user_id, at) VALUES (?, ?, ?, ?)", kind, hash, userId, now);
    }
  } else if (before?.status === "banned") {
    await sql.run("DELETE FROM fairplay_identities WHERE user_id = ?", userId);
  }
}

// ---------------- Bans: identities, devices, the check ----------------

export const BANNED_MESSAGE = "Your account can't play online: it was banned for fair play. Solo games against bots are still open.";

/**
 * An email as one person's address: lower case, without a "+tag", and for Gmail without dots (Gmail ignores them),
 * so a.b+2@gmail.com and ab@gmail.com are the same.
 */
export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const base = local.split("+")[0]!;
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  return `${gmail ? base.replace(/\./g, "") : base}@${gmail ? "gmail.com" : domain}`;
}

async function identityHashes(u: Pick<User, "email" | "google_sub">): Promise<[string, string][]> {
  const out: [string, string][] = [];
  if (u.email) out.push(["email", await sha256(`email:${normalizeEmail(u.email)}`)]);
  if (u.google_sub) out.push(["google", await sha256(`google:${u.google_sub}`)]);
  return out;
}

/**
 * Whether an account may play online, checked when it asks to (PLAY, a new lobby, joining one). Banned: no. Also
 * catches evasion: an account signed in with a banned account's identity (the same normalised email or Google
 * account) is banned too; one seen on a device a banned account played from goes to review (families share devices).
 * `device`: the device marker cookie, recorded against the account.
 */
export async function banCheck(sql: Sql, user: User | null, device: string | null, now: number): Promise<{ banned: boolean }> {
  if (!user) return { banned: false };
  const c = await caseOf(sql, user.id);
  if (c?.status === "banned") return { banned: true };
  if (device && /^[A-Za-z0-9_-]{16,64}$/.test(device)) {
    await sql.run(
      `INSERT INTO fairplay_devices (device, user_id, first_seen, last_seen) VALUES (?, ?, ?, ?)
       ON CONFLICT (device, user_id) DO UPDATE SET last_seen = excluded.last_seen WHERE fairplay_devices.last_seen < excluded.last_seen - 3600000`,
      device,
      user.id,
      now,
      now,
    );
  }
  for (const [kind, hash] of await identityHashes(user)) {
    const owner = await sql.first<{ user_id: string }>("SELECT user_id FROM fairplay_identities WHERE kind = ? AND hash = ? AND user_id != ?", kind, hash, user.id);
    if (owner) {
      await setCase(sql, user.id, "banned", "evasion", `signed in with the ${kind === "email" ? "email address" : "Google account"} of banned account ${owner.user_id}`, now);
      return { banned: true };
    }
  }
  if (device && c?.status !== "review" && c?.status !== "cleared") {
    const shared = await sql.first<{ user_id: string }>(
      `SELECT d.user_id FROM fairplay_devices d JOIN fairplay_cases c ON c.user_id = d.user_id
       WHERE d.device = ? AND d.user_id != ? AND c.status = 'banned' LIMIT 1`,
      device,
      user.id,
    );
    if (shared) await raiseCase(sql, user.id, "review", "evasion", `plays from a device banned account ${shared.user_id} played from`, now);
  }
  return { banned: false };
}

// ---------------- Appeals ----------------

export interface Appeal {
  id: number;
  user_id: string;
  at: number;
  text: string;
  status: "open" | "upheld" | "overturned";
  decided_at: number | null;
  decided_by: string | null;
  reply: string | null;
}

export const latestAppeal = (sql: Sql, userId: string) =>
  sql.first<Appeal>("SELECT id, user_id, at, text, status, decided_at, decided_by, reply FROM fairplay_appeals WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT 1", userId);

/** A banned player's appeal (one open at a time, up to 2,000 characters), for a person to decide. */
export async function appeal(sql: Sql, userId: string, text: unknown, now: number): Promise<{ ok: true } | { ok: false; message: string }> {
  if ((await caseOf(sql, userId))?.status !== "banned") return { ok: false, message: "Your account isn't banned." };
  const t = typeof text === "string" ? text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, 2000) : "";
  if (t.length < 10) return { ok: false, message: "Tell us a little more (at least a sentence)." };
  if ((await latestAppeal(sql, userId))?.status === "open") return { ok: false, message: "Your appeal is already with us. A person will read it." };
  await sql.run("INSERT INTO fairplay_appeals (user_id, at, text, status) VALUES (?, ?, ?, 'open')", userId, now, t);
  await logCase(sql, userId, "appeal", "player", null, now);
  return { ok: true };
}

/** What a player sees about their own fair-play standing: banned or not, and their latest appeal. */
export async function fairStatus(sql: Sql, userId: string): Promise<{ banned: boolean; appeal: { status: Appeal["status"]; at: number; reply: string | null } | null }> {
  const c = await caseOf(sql, userId);
  const a = await latestAppeal(sql, userId);
  return { banned: c?.status === "banned", appeal: a ? { status: a.status, at: a.at, reply: a.reply } : null };
}

// ---------------- Decisions (an admin, the automated reviewer) ----------------

export type Decision = "ban" | "clear" | "watch" | "review";
const DECIDES: Record<Decision, CaseStatus> = { ban: "banned", clear: "cleared", watch: "watch", review: "review" };

/** Sends a player an email about their case (a ban, a clearing after a review, an appeal turned down); set up by the Worker. */
export type CaseMailer = (user: User, kind: "banned" | "cleared" | "upheld", notice: string | null) => Promise<void>;

/**
 * A decision on a case by `by` ("admin:<email>" or "reviewer"), with a written reason for the log, and optionally a
 * note for the player (`notice`, in the email). A ban, or clearing someone who was in review or banned, emails them.
 * The automated reviewer never decides appeals: it can't change a banned case or one with an open appeal.
 */
export async function decide(
  sql: Sql,
  userId: string,
  decision: unknown,
  by: string,
  reason: unknown,
  now: number,
  opts: { notice?: unknown; mail?: CaseMailer } = {},
): Promise<{ ok: true; status: CaseStatus } | { ok: false; status: number; message: string }> {
  const status = DECIDES[decision as Decision];
  if (!status) return { ok: false, status: 400, message: "decision must be ban, clear, watch or review" };
  const why = typeof reason === "string" ? reason.trim().slice(0, 2000) : "";
  if (why.length < 5) return { ok: false, status: 400, message: "a written reason is required" };
  const user = await getUser(sql, userId);
  if (!user) return { ok: false, status: 404, message: "no such player" };
  const before = await caseOf(sql, userId);
  if (by === "reviewer") {
    if (before?.status === "banned") return { ok: false, status: 409, message: "banned cases and their appeals are for a person" };
    if ((await latestAppeal(sql, userId))?.status === "open") return { ok: false, status: 409, message: "this player has an open appeal: a person decides" };
  }
  await setCase(sql, userId, status, by, why, now);
  const notice = typeof opts.notice === "string" && opts.notice.trim() ? opts.notice.trim().slice(0, 1000) : null;
  if (opts.mail && (status === "banned" || (status === "cleared" && (before?.status === "review" || before?.status === "banned")))) {
    await opts.mail(user, status === "banned" ? "banned" : "cleared", notice).catch((e: unknown) => console.log(`fair play email to ${userId}: ${String(e)}`));
  }
  return { ok: true, status };
}

/** An admin's decision on an appeal: upheld (the ban stands) or overturned (cleared), with a reply the player sees. */
export async function decideAppeal(
  sql: Sql,
  id: number,
  outcome: unknown,
  by: string,
  reply: unknown,
  now: number,
  mail?: CaseMailer,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const a = await sql.first<Appeal>("SELECT id, user_id, at, text, status, decided_at, decided_by, reply FROM fairplay_appeals WHERE id = ?", id);
  if (!a || a.status !== "open") return { ok: false, message: "no open appeal with that id" };
  if (outcome !== "upheld" && outcome !== "overturned") return { ok: false, message: "outcome must be upheld or overturned" };
  const text = typeof reply === "string" ? reply.trim().slice(0, 2000) : "";
  if (text.length < 5) return { ok: false, message: "a reply to the player is required" };
  await sql.run("UPDATE fairplay_appeals SET status = ?, decided_at = ?, decided_by = ?, reply = ? WHERE id = ?", outcome, now, by, text, id);
  await logCase(sql, a.user_id, `appeal ${outcome}`, by, text, now);
  const u = await getUser(sql, a.user_id);
  if (outcome === "overturned") await setCase(sql, a.user_id, "cleared", by, `appeal overturned: ${text}`, now);
  if (u && mail) await mail(u, outcome === "overturned" ? "cleared" : "upheld", text).catch(() => undefined);
  return { ok: true };
}

/**
 * Raises a case to at least `status` (watch < review): never lowers it and never touches a ban. A cleared case can
 * be raised again; callers count only evidence from after the clearing (see reviewIfReported).
 */
export async function raiseCase(sql: Sql, userId: string, status: "watch" | "review", by: string, reason: string, now: number): Promise<boolean> {
  const c = await caseOf(sql, userId);
  if (c?.status === "banned") return false;
  if (c && (c.status === status || (c.status === "review" && status === "watch"))) {
    // Already there: the new evidence goes in the log, and the case stays open.
    await sql.run("UPDATE fairplay_cases SET updated_at = ? WHERE user_id = ?", now, userId);
    await logCase(sql, userId, "note", by, reason, now);
    return false;
  }
  await setCase(sql, userId, status, by, reason, now);
  return true;
}

export type ReportOutcome = { ok: true; already?: boolean } | { ok: false; message: string };

/**
 * A report about a player (a profile's Report button, or a name tapped in a match), for fair play to weigh and a
 * person to read. One per reporter, player and match (`match`: the lobby code when made in a match); outside a match
 * one per player a day; FAIRPLAY.reports.perDay a day per reporter.
 *
 * Reports never ban anyone. Every report opens a watch case (the player's matches are then kept as evidence), and
 * cheating reports from enough different signed-in accounts within a week put the player in review (fewer for a new
 * account). A guest's report is stored and read, but doesn't count towards a review.
 */
export async function reportPlayer(sql: Sql, reporter: User, target: unknown, reason: unknown, match: unknown, now: number): Promise<ReportOutcome> {
  if (typeof target !== "string" || target === reporter.id || !(await sql.first("SELECT id FROM users WHERE id = ?", target))) return { ok: false, message: "No such player." };
  const why = FAIRPLAY.reports.reasons.find((r) => r === reason);
  if (!why) return { ok: false, message: "Pick a reason." };
  const code = typeof match === "string" && /^[A-Z2-9]{5}$/.test(match) ? match : null;
  const dup = code
    ? await sql.first("SELECT id FROM reports WHERE reporter = ? AND target = ? AND match = ?", reporter.id, target, code)
    : await sql.first("SELECT id FROM reports WHERE reporter = ? AND target = ? AND match IS NULL AND at > ?", reporter.id, target, now - DAY);
  if (dup) return { ok: true, already: true };
  const n = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE reporter = ? AND at > ?", reporter.id, now - DAY))?.n ?? 0;
  if (n >= FAIRPLAY.reports.perDay) return { ok: false, message: "That's a lot of reports today. Try again tomorrow." };
  await sql.run("INSERT INTO reports (reporter, target, reason, at, match) VALUES (?, ?, ?, ?, ?)", reporter.id, target, why, now, code);
  await raiseCase(sql, target, "watch", "reports", `reported: ${why}`, now);
  if (why === "Cheating") await reviewIfReported(sql, target, now);
  return { ok: true };
}

/** Puts a player in review when enough different signed-in accounts reported them for cheating this week. */
async function reviewIfReported(sql: Sql, target: string, now: number): Promise<void> {
  const r = FAIRPLAY.reports;
  // (Reports from before a decision on the case, a clearing say, were weighed then.)
  const c = await caseOf(sql, target);
  const since = Math.max(now - r.reviewDays * DAY, c?.decided_at ?? 0);
  const reporters = (
    await sql.all<{ email: string | null; google_sub: string | null }>(
      `SELECT DISTINCT u.id, u.email, u.google_sub FROM reports p JOIN users u ON u.id = p.reporter
       WHERE p.target = ? AND p.reason = 'Cheating' AND p.at > ?`,
      target,
      since,
    )
  ).filter(signedIn).length;
  const matches = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND online = 1", target))?.n ?? 0;
  const needed = matches < r.newAccountMatches ? r.newAccountReporters : r.reviewReporters;
  if (reporters >= needed) await raiseCase(sql, target, "review", "reports", `${reporters} players reported cheating within ${r.reviewDays} days`, now);
}

// ---------------- Signals and detection ----------------

/** What one match's fair-play record came to. */
export interface FairRecord {
  summary: FairSummary;
  verdict: LevelVerdict;
  /** What was done about it (the enforcement setting may hold detection to recording only). */
  acted: FairLevel;
}

/**
 * A finished online match's fair play for one signed-in player, from the lobby's record of their judged picks: the
 * match's signals and score (core/fairplay.ts), measured against their own history; their level over recent matches;
 * and what FAIRPLAY.enforcement lets detection do about it. Stored as their history, with the picks as evidence.
 */
export async function recordFairPlay(
  sql: Sql,
  userId: string,
  match: { lobby: string | null; mode: string; moves: readonly FairMove[] },
  now: number,
  mail?: CaseMailer,
): Promise<FairRecord> {
  const lv = FAIRPLAY.levels;
  const history = await sql.all<HistoryRow>(
    "SELECT id, perf, score, counted, played_at, summary FROM fairplay_matches WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 20",
    userId,
  );
  const rating = (await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", userId))?.rating ?? null;
  const summary = matchSignals(match.moves, referenceStrength(history.slice(0, 10).map((h) => h.perf), rating));
  const c = await caseOf(sql, userId);
  const verdict = playerLevel([...levelInputs(history, c), { ...summary, at: now }], now, lv);
  const flagged = summary.score >= lv.watch || verdict.level !== "none" || (!!c && OPEN.includes(c.status));
  await sql.run(
    `INSERT INTO fairplay_matches (user_id, lobby, mode, played_at, counted, perf, score, level, summary, moves, keep_until)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    match.lobby,
    match.mode,
    now,
    summary.counted,
    summary.perf,
    summary.score,
    verdict.level,
    JSON.stringify(summary),
    JSON.stringify(match.moves),
    now + (flagged ? FAIRPLAY.evidenceDays : FAIRPLAY.evidenceDaysUnflagged) * DAY,
  );
  const acted = await actOn(sql, userId, verdict, now, mail);
  await purgeEvidence(sql, now);
  return { summary, verdict, acted };
}

interface HistoryRow {
  id: number;
  perf: number | null;
  score: number;
  counted: number;
  played_at: number;
  summary: string;
}

/** A player's stored matches as playerLevel reads them. Matches from before a decision on the case (a clearing, say) were weighed then. */
function levelInputs(history: readonly HistoryRow[], c: Case | null): LevelInput[] {
  const since = c?.decided_at ?? 0;
  return history
    .filter((h) => h.played_at > since)
    .map((h) => {
      let deep: Partial<FairSummary> = {};
      try {
        deep = JSON.parse(h.summary) as Partial<FairSummary>;
      } catch {
        // An unreadable summary: unchecked.
      }
      return { score: h.score, perf: h.perf, counted: h.counted, deepChecked: deep.deepChecked ?? 0, deepMatch: deep.deepMatch ?? 0, evidence: deep.evidence ?? 0, at: h.played_at };
    });
}

/**
 * A player's level again after their stored matches changed (the deep re-check added to one), and what detection
 * does about it. The deep re-check's entry point (fairplay-deep.ts).
 */
export async function relevel(sql: Sql, userId: string, now: number, mail?: CaseMailer): Promise<{ verdict: LevelVerdict; acted: FairLevel }> {
  const history = await sql.all<HistoryRow>(
    "SELECT id, perf, score, counted, played_at, summary FROM fairplay_matches WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 20",
    userId,
  );
  const verdict = playerLevel(levelInputs(history, await caseOf(sql, userId)), now, FAIRPLAY.levels);
  return { verdict, acted: await actOn(sql, userId, verdict, now, mail) };
}

/**
 * What detection does with a level, as far as FAIRPLAY.enforcement allows: "watch" only records (a watch case, its
 * log saying what the level would have done), "review" also opens reviews, "ban" also bans. Returns what it did.
 */
async function actOn(sql: Sql, userId: string, verdict: LevelVerdict, now: number, mail?: CaseMailer): Promise<FairLevel> {
  if (verdict.level === "none") return "none";
  const mode = FAIRPLAY.enforcement as "watch" | "review" | "ban";
  const why = verdict.reasons.join("; ");
  if (verdict.level === "watch" || mode === "watch") {
    await raiseCase(sql, userId, "watch", "detection", verdict.level === "watch" ? why : `level ${verdict.level}, not acted on (watch only): ${why}`, now);
    return "watch";
  }
  if (verdict.level === "ban" && mode === "ban") {
    const c = await caseOf(sql, userId);
    if (c?.status !== "banned") {
      await setCase(sql, userId, "banned", "detection", why, now);
      const u = await getUser(sql, userId);
      if (u && mail) await mail(u, "banned", null).catch(() => undefined);
    }
    return "ban";
  }
  await raiseCase(sql, userId, "review", "detection", verdict.level === "ban" ? `level ban, reviewed instead (enforcement: review): ${why}` : why, now);
  return "review";
}

let purgedAt = 0;
/**
 * Deletes old evidence (at most every 10 minutes per instance): picks past their keep date, unless the player's case
 * is open. A watch case that has seen nothing new for FAIRPLAY.evidenceDays closes first.
 */
export async function purgeEvidence(sql: Sql, now: number, force = false): Promise<void> {
  if (!force && now - purgedAt < 10 * 60_000) return;
  purgedAt = now;
  const stale = await sql.all<{ user_id: string }>("SELECT user_id FROM fairplay_cases WHERE status = 'watch' AND updated_at < ? LIMIT 100", now - FAIRPLAY.evidenceDays * DAY);
  for (const { user_id } of stale) await setCase(sql, user_id, "closed", "auto", `nothing new in ${FAIRPLAY.evidenceDays} days`, now);
  // (Open: watch or review, or a ban with an appeal still waiting.)
  await sql.run(
    `UPDATE fairplay_matches SET moves = NULL, keep_until = NULL
     WHERE keep_until < ? AND user_id NOT IN (SELECT user_id FROM fairplay_cases WHERE status IN ('watch', 'review'))
       AND user_id NOT IN (SELECT user_id FROM fairplay_appeals WHERE status = 'open')`,
    now,
  );
}
