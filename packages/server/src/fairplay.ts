/**
 * Fair play on the server (the `fairplay` delegate): reports, cases, and what a case's status does. See DECISIONS.md,
 * "Fair play".
 *
 * A case is one player's fair-play file. Its status:
 *   - watch: recorded only (their matches' evidence is kept, see FAIRPLAY.evidenceDays);
 *   - review: a person or the automated reviewer decides; meanwhile their online results are held off ranking
 *     (results.held: the rating, its chart, "Top N%", later leaderboards and ranked) and eligibleForRanked says no;
 *   - banned: no online play (later: the ban itself);
 *   - cleared: decided in their favour; held results count again.
 * Every change goes in fairplay_log with who made it and why.
 */
import { FAIRPLAY } from "@chessroyale/core";
import { refreshRating, type Sql, type User } from "./accounts.ts";

export type CaseStatus = "watch" | "review" | "banned" | "cleared";
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
  if (c?.status === "banned" || c?.status === "review") return false;
  if (c?.status === "watch" && status === "watch") {
    await sql.run("UPDATE fairplay_cases SET updated_at = ? WHERE user_id = ?", now, userId);
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
