/**
 * Chat moderation on the server (docs/areas/chat.md; DECISIONS.md, "Chat moderation for launch"). Chat is preset
 * lines only, so what gets reported is how someone uses them (spam, taunts), their name or their icon.
 *
 *   - A report is about one line in the global chat or a lobby's chat, with the lines around it as the server kept
 *     them (never what the reporter's device says). One per reporter, player and place a day (`CHAT_MOD.dedupeMs`),
 *     `CHAT_MOD.reportsPerDay` a day per reporter.
 *   - Reports from `CHAT_MOD.autoMuteReporters` different players, none reviewed yet, pause the player's chat until a
 *     moderator looks (at most `CHAT_MOD.autoMuteMs`).
 *   - A moderator (the review page, chat-mod-admin.ts) dismisses a player's reports, warns them, bans them from chat
 *     for some days or with no end, lifts a ban, or resets their name and icon. Every decision is a row in
 *     chat_mod_log, which is also how a pause is in force. A pause only stops sending: the player still reads chat
 *     and plays.
 *   - Resolved reports are deleted `CHAT_MOD.keepResolvedDays` after they're resolved, decisions
 *     `CHAT_MOD.keepDecisionsDays` after they ended (pruneChatMod).
 */
import { CHAT_MOD } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import type { Sql, User } from "./accounts.ts";
import type { ContextLine, ReportedLine } from "./chat-mod-schema.ts";

export type { ContextLine, ReportedLine };

const DAY = 86_400_000;

/** Where a line was said: the home page's global chat, or a lobby's chat (its match included). */
export type ChatChannel = "global" | `lobby:${string}`;


/** The lines kept with a report: up to CHAT_MOD.contextBefore before the one at `index`, and contextAfter after it. */
export const contextAround = <T>(lines: readonly T[], index: number): T[] => lines.slice(Math.max(0, index - CHAT_MOD.contextBefore), index + CHAT_MOD.contextAfter + 1);

export const REPORTED = "Reported. Thanks: a moderator will look at it.";
export const ALREADY_REPORTED = "You've already reported this player here.";
export const MESSAGE_GONE = "That message is gone from the chat. Report the player from their profile instead.";
/** What a paused player hears when they try to send (the app words it with the date: chat-mod.ts there). */
export const CHAT_PAUSED = "Your chat is paused: a moderator's decision.";

export type ChatReportOutcome = { ok: true; already?: true; block?: ChatBlock } | { ok: false; status: number; message: string };

/**
 * A report about a line (the caller found it in the server's own copy of the chat). Stored for a moderator, unless
 * this reporter already reported this player here today (`already`); over the day's limit, refused. When it makes
 * enough different players, the player's chat is paused until a moderator looks (`block`: the new pause).
 */
export async function reportChat(sql: Sql, reporter: Pick<User, "id">, channel: ChatChannel, line: ReportedLine, now: number): Promise<ChatReportOutcome> {
  if (line.target === reporter.id) return { ok: false, status: 400, message: "That's your own message." };
  if (!(await sql.first("SELECT id FROM users WHERE id = ?", line.target))) return { ok: false, status: 404, message: MESSAGE_GONE };
  const dup = await sql.first("SELECT id FROM chat_reports WHERE reporter = ? AND target = ? AND channel = ? AND at > ?", reporter.id, line.target, channel, now - CHAT_MOD.dedupeMs);
  if (dup) return { ok: true, already: true };
  const today = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM chat_reports WHERE reporter = ? AND at > ?", reporter.id, now - DAY))?.n ?? 0;
  if (today >= CHAT_MOD.reportsPerDay) return { ok: false, status: 429, message: "That's a lot of reports today. Try again tomorrow." };
  await sql.run(
    "INSERT INTO chat_reports (at, reporter, target, channel, said_at, name, text, context, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')",
    now,
    reporter.id,
    line.target,
    channel,
    line.saidAt,
    line.name.slice(0, 40),
    line.text.slice(0, 200),
    JSON.stringify(line.context.slice(0, CHAT_MOD.contextBefore + CHAT_MOD.contextAfter + 1)),
  );
  const block = await autoMute(sql, line.target, now);
  await pruneChatMod(sql, now);
  return { ok: true, ...(block ? { block } : {}) };
}

/** Pauses a player's chat when enough different players reported it and no moderator has looked yet; the new pause. */
async function autoMute(sql: Sql, target: string, now: number): Promise<ChatBlock | null> {
  if (await chatBlock(sql, target, now)) return null;
  const n =
    (await sql.first<{ n: number }>("SELECT COUNT(DISTINCT reporter) AS n FROM chat_reports WHERE target = ? AND status = 'open' AND at > ?", target, now - CHAT_MOD.autoMuteWindowMs))?.n ??
    0;
  if (n < CHAT_MOD.autoMuteReporters) return null;
  const until = now + CHAT_MOD.autoMuteMs;
  await sql.run("INSERT INTO chat_mod_log (user_id, at, action, until, by, reason) VALUES (?, ?, 'auto', ?, 'reports', ?)", target, now, until, `${n} players reported their chat`);
  return { until, auto: true };
}

/** A player's chat pause in force now, if any: a moderator's ban (first), or reports waiting for a moderator. */
export async function chatBlock(sql: Sql, userId: string, now: number): Promise<ChatBlock | null> {
  const row = await sql.first<{ action: string; until: number | null }>(
    `SELECT action, until FROM chat_mod_log WHERE user_id = ? AND action IN ('ban', 'auto') AND ended_at IS NULL AND (until IS NULL OR until > ?)
     ORDER BY action = 'ban' DESC, id DESC LIMIT 1`,
    userId,
    now,
  );
  return row ? { until: row.until, ...(row.action === "auto" ? { auto: true as const } : {}) } : null;
}

export type ChatDecision = "dismiss" | "warn" | "ban" | "lift" | "reset";
const DECISIONS: readonly ChatDecision[] = ["dismiss", "warn", "ban", "lift", "reset"];
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

/**
 * A moderator's decision about a player's chat (`by`: "admin:<email>"), with a reason for the log (required, except
 * to dismiss) and optionally a note to the player (shown with a warning or a ban):
 *   - dismiss: their open reports were nothing; a pause from reports ends;
 *   - warn: the reports were right; the player sees a warning; a pause from reports ends;
 *   - ban: no sending for `days` (one of CHAT_MOD.banDays) or with no end ("forever"); replaces any pause;
 *   - lift: ends any pause (reports untouched);
 *   - reset: their name and icon go back to the defaults ("Player", a pawn); a pause from reports ends.
 * Dismiss, warn, ban and reset resolve the player's open reports. Answers with the pause in force afterwards.
 */
export async function decideChat(
  sql: Sql,
  userId: string,
  input: { action?: unknown; days?: unknown; reason?: unknown; note?: unknown },
  by: string,
  now: number,
): Promise<{ ok: true; block: ChatBlock | null } | { ok: false; status: number; message: string }> {
  const action = DECISIONS.find((d) => d === input.action);
  if (!action) return { ok: false, status: 400, message: "action must be dismiss, warn, ban, lift or reset" };
  const reason = text(input.reason, 500);
  if (action !== "dismiss" && reason.length < 5) return { ok: false, status: 400, message: "a written reason is required" };
  if (!(await sql.first("SELECT id FROM users WHERE id = ?", userId))) return { ok: false, status: 404, message: "no such player" };
  let until: number | null = null;
  if (action === "ban") {
    const days = input.days === "forever" ? null : Number(input.days);
    if (days !== null && !CHAT_MOD.banDays.includes(days)) return { ok: false, status: 400, message: `days must be ${CHAT_MOD.banDays.join(", ")} or forever` };
    until = days === null ? null : now + days * DAY;
  }
  const end = (actions: string) =>
    sql.run(`UPDATE chat_mod_log SET ended_at = ? WHERE user_id = ? AND action IN (${actions}) AND ended_at IS NULL AND (until IS NULL OR until > ?)`, now, userId, now);
  const resolve = (status: "dismissed" | "actioned") =>
    sql.run("UPDATE chat_reports SET status = ?, resolved_at = ?, resolved_by = ? WHERE target = ? AND status = 'open'", status, now, by, userId);
  if (action === "lift" || action === "ban") await end("'auto', 'ban'");
  else await end("'auto'");
  if (action !== "lift") await resolve(action === "dismiss" ? "dismissed" : "actioned");
  if (action === "reset") await sql.run("UPDATE users SET name = 'Player', icon = '♟' WHERE id = ?", userId);
  const note = text(input.note, 500) || null;
  await sql.run(
    "INSERT INTO chat_mod_log (user_id, at, action, until, by, reason, note, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    userId,
    now,
    action,
    until,
    by,
    reason || null,
    action === "warn" || action === "ban" ? note : null,
    action === "warn" || action === "ban" ? 0 : 1,
  );
  return { ok: true, block: await chatBlock(sql, userId, now) };
}

/** A moderator's warning or chat ban the player hasn't seen yet (a ban only while it's in force). */
export interface ChatNotice {
  id: number;
  kind: "warn" | "ban";
  at: number;
  until: number | null;
  note: string | null;
}

/** What a player's own app shows about their chat (GET /api/me): a pause in force, and a notice not yet seen. */
export async function chatStanding(sql: Sql, userId: string, now: number): Promise<{ block?: ChatBlock; notice?: ChatNotice } | null> {
  const block = await chatBlock(sql, userId, now);
  const row = await sql.first<{ id: number; action: "warn" | "ban"; at: number; until: number | null; note: string | null; ended_at: number | null }>(
    "SELECT id, action, at, until, note, ended_at FROM chat_mod_log WHERE user_id = ? AND seen = 0 AND action IN ('warn', 'ban') ORDER BY id DESC LIMIT 1",
    userId,
  );
  const live = row && (row.action === "warn" || (row.ended_at === null && (row.until === null || row.until > now)));
  const notice = live ? { id: row.id, kind: row.action, at: row.at, until: row.until, note: row.note } : null;
  return block || notice ? { ...(block ? { block } : {}), ...(notice ? { notice } : {}) } : null;
}

/** The player has read their notices (the app's "Got it"). */
export async function chatNoticeSeen(sql: Sql, userId: string): Promise<void> {
  await sql.run("UPDATE chat_mod_log SET seen = 1 WHERE user_id = ? AND seen = 0", userId);
}

let prunedAt = -Infinity;
/**
 * Deletes what's past keeping (at most every 10 minutes per instance, unless `force`): reports resolved more than
 * CHAT_MOD.keepResolvedDays ago, and decisions that ended more than CHAT_MOD.keepDecisionsDays ago (a warning, a lift,
 * a dismissal or a reset from when it was made; a pause from when it ended; a chat ban with no end stays).
 */
export async function pruneChatMod(sql: Sql, now: number, force = false): Promise<void> {
  if (!force && now - prunedAt < 10 * 60_000) return;
  prunedAt = now;
  await sql.run("DELETE FROM chat_reports WHERE status != 'open' AND resolved_at < ?", now - CHAT_MOD.keepResolvedDays * DAY);
  await sql.run(
    "DELETE FROM chat_mod_log WHERE COALESCE(ended_at, CASE WHEN action IN ('ban', 'auto') THEN until ELSE at END) < ?",
    now - CHAT_MOD.keepDecisionsDays * DAY,
  );
}

// ---------------- For the review page ----------------

/** A player with reports waiting: how many, from how many players, the latest, and any pause in force. */
export interface ChatQueueRow {
  userId: string;
  name: string;
  open: number;
  reporters: number;
  latest: number;
  block: ChatBlock | null;
}

/** Players with open reports, the most reporters first. */
export async function chatQueue(sql: Sql, now: number, limit = 100): Promise<ChatQueueRow[]> {
  const rows = await sql.all<{ target: string; name: string; open: number; reporters: number; latest: number }>(
    `SELECT r.target, u.name, COUNT(*) AS open, COUNT(DISTINCT r.reporter) AS reporters, MAX(r.at) AS latest
     FROM chat_reports r JOIN users u ON u.id = r.target WHERE r.status = 'open'
     GROUP BY r.target, u.name ORDER BY reporters DESC, open DESC, latest DESC LIMIT ?`,
    limit,
  );
  const out: ChatQueueRow[] = [];
  for (const r of rows) out.push({ userId: r.target, name: r.name, open: r.open, reporters: r.reporters, latest: r.latest, block: await chatBlock(sql, r.target, now) });
  return out;
}

export interface ChatLogRow {
  id: number;
  user_id: string;
  at: number;
  action: string;
  until: number | null;
  by: string;
  reason: string | null;
  note: string | null;
  ended_at: number | null;
  name?: string | null;
}

/** Pauses in force now, newest first (to lift one). */
export const chatPaused = (sql: Sql, now: number) =>
  sql.all<ChatLogRow>(
    `SELECT l.id, l.user_id, l.at, l.action, l.until, l.by, l.reason, l.note, l.ended_at, u.name FROM chat_mod_log l LEFT JOIN users u ON u.id = l.user_id
     WHERE l.action IN ('ban', 'auto') AND l.ended_at IS NULL AND (l.until IS NULL OR l.until > ?) ORDER BY l.at DESC LIMIT 100`,
    now,
  );

/** The latest moderators' decisions (not the automatic pauses). */
export const chatDecisions = (sql: Sql, limit = 30) =>
  sql.all<ChatLogRow>(
    `SELECT l.id, l.user_id, l.at, l.action, l.until, l.by, l.reason, l.note, l.ended_at, u.name FROM chat_mod_log l LEFT JOIN users u ON u.id = l.user_id
     WHERE l.by != 'reports' ORDER BY l.at DESC, l.id DESC LIMIT ?`,
    limit,
  );

export interface ChatReportView {
  id: number;
  at: number;
  channel: string;
  saidAt: number;
  name: string;
  text: string;
  context: ContextLine[];
  reporter: { id: string; name: string | null };
  status: string;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

export interface ChatPlayerDetail {
  player: { id: string; name: string; icon: string; joinedAt: number; signedIn: boolean };
  block: ChatBlock | null;
  open: ChatReportView[];
  resolved: ChatReportView[];
  log: ChatLogRow[];
}

/** One player for the review page: who, any pause, their open and recently resolved reports, and the decisions so far. */
export async function chatPlayer(sql: Sql, userId: string, now: number): Promise<ChatPlayerDetail | null> {
  const u = await sql.first<{ id: string; name: string; icon: string; created_at: number; email: string | null; google_sub: string | null }>(
    "SELECT id, name, icon, created_at, email, google_sub FROM users WHERE id = ?",
    userId,
  );
  if (!u) return null;
  const reports = async (open: boolean) =>
    (
      await sql.all<{ id: number; at: number; channel: string; said_at: number; name: string; text: string; context: string; reporter: string; reporter_name: string | null; status: string; resolved_at: number | null; resolved_by: string | null }>(
        `SELECT r.id, r.at, r.channel, r.said_at, r.name, r.text, r.context, r.reporter, u.name AS reporter_name, r.status, r.resolved_at, r.resolved_by
         FROM chat_reports r LEFT JOIN users u ON u.id = r.reporter WHERE r.target = ? AND ${open ? "r.status = 'open'" : "r.status != 'open'"}
         ORDER BY r.at DESC LIMIT ${open ? 100 : 20}`,
        userId,
      )
    ).map((r) => {
      let context: ContextLine[] = [];
      try {
        context = JSON.parse(r.context) as ContextLine[];
      } catch {
        // (Unreadable: shown without its context.)
      }
      return { id: r.id, at: r.at, channel: r.channel, saidAt: r.said_at, name: r.name, text: r.text, context, reporter: { id: r.reporter, name: r.reporter_name }, status: r.status, resolvedAt: r.resolved_at, resolvedBy: r.resolved_by };
    });
  return {
    player: { id: u.id, name: u.name, icon: u.icon, joinedAt: u.created_at, signedIn: !!(u.email || u.google_sub) },
    block: await chatBlock(sql, userId, now),
    open: await reports(true),
    resolved: await reports(false),
    log: await sql.all<ChatLogRow>("SELECT id, user_id, at, action, until, by, reason, note, ended_at FROM chat_mod_log WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT 50", userId),
  };
}
