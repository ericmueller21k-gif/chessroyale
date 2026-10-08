/**
 * Fair play on the server (the `fairplay` delegate): reports, cases, and what a case's status does. See DECISIONS.md,
 * "Fair play".
 *
 * A case is one player's fair-play file. Its status:
 *   - watch: recorded only (their matches' evidence is kept, see FAIRPLAY.evidenceDays);
 *   - review: a person or the automated reviewer decides; meanwhile their online results are held off ranking
 *     (results.held: the rating, its chart, "Top N%", later leaderboards and ranked) and eligibleForRanked says no;
 *   - banned: no online play (later: the ban itself);
 *   - cleared: decided in their favour; held results count again;
 *   - closed: a watch that saw nothing new for FAIRPLAY.evidenceDays.
 * Every change goes in fairplay_log with who made it and why.
 *
 * Evidence: every online match's judged picks are stored for each signed-in player (fairplay_matches.moves) for
 * FAIRPLAY.evidenceDaysUnflagged days, so a report made after a match still finds its games; for FAIRPLAY.evidenceDays
 * when the player was flagged or reported, and never deleted while their case is open (see purgeEvidence).
 */
import { FAIRPLAY, matchSignals, playerLevel, referenceStrength, type FairLevel, type FairMove, type FairSummary, type LevelVerdict } from "@chessroyale/core";
import { refreshRating, type Sql, type User } from "./accounts.ts";

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
  } else if (status === "cleared" && held(before?.status)) {
    await sql.run("UPDATE results SET held = 0 WHERE user_id = ? AND held = 1", userId);
    await refreshRating(sql, userId);
  }
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
export async function recordFairPlay(sql: Sql, userId: string, match: { lobby: string | null; mode: string; moves: readonly FairMove[] }, now: number): Promise<FairRecord> {
  const lv = FAIRPLAY.levels;
  const history = await sql.all<{ perf: number | null; score: number; counted: number; played_at: number }>(
    "SELECT perf, score, counted, played_at FROM fairplay_matches WHERE user_id = ? ORDER BY played_at DESC, id DESC LIMIT 20",
    userId,
  );
  const rating = (await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", userId))?.rating ?? null;
  const summary = matchSignals(match.moves, referenceStrength(history.slice(0, 10).map((h) => h.perf), rating));
  // Matches from before a decision on the case (a clearing, say) were weighed then.
  const c = await caseOf(sql, userId);
  const since = c?.decided_at ?? 0;
  const verdict = playerLevel(
    [...history.filter((h) => h.played_at > since).map((h) => ({ score: h.score, perf: h.perf, counted: h.counted, at: h.played_at })), { ...summary, at: now }],
    now,
    lv,
  );
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
  const acted = await actOn(sql, userId, verdict, now);
  await purgeEvidence(sql, now);
  return { summary, verdict, acted };
}

/**
 * What detection does with a level, as far as FAIRPLAY.enforcement allows: "watch" only records (a watch case, its
 * log saying what the level would have done), "review" also opens reviews, "ban" also bans. Returns what it did.
 */
async function actOn(sql: Sql, userId: string, verdict: LevelVerdict, now: number): Promise<FairLevel> {
  if (verdict.level === "none") return "none";
  const mode = FAIRPLAY.enforcement as "watch" | "review" | "ban";
  const why = verdict.reasons.join("; ");
  if (verdict.level === "watch" || mode === "watch") {
    await raiseCase(sql, userId, "watch", "detection", verdict.level === "watch" ? why : `level ${verdict.level}, not acted on (watch only): ${why}`, now);
    return "watch";
  }
  // (Bans come with the ban step; until then a ban level opens a review.)
  await raiseCase(sql, userId, "review", "detection", verdict.level === "ban" ? `level ban (review for now): ${why}` : why, now);
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
  await sql.run(
    `UPDATE fairplay_matches SET moves = NULL, keep_until = NULL
     WHERE keep_until < ? AND user_id NOT IN (SELECT user_id FROM fairplay_cases WHERE status IN ('watch', 'review'))`,
    now,
  );
}
