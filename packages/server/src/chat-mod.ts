/**
 * Chat moderation on the server (docs/areas/chat.md, "Moderation"; docs/decisions/2026-10-16-chat-moderation.md).
 * Chat is preset lines only, so what can offend is a player's name and drawn icon: players report it from the profile
 * (fair play's "Offensive name or icon"), and a moderator acts from fair play's review page (admin.ts, a player's page):
 * a warning, a chat ban for some days or with no end, lifting it, or resetting the name and icon. Every decision is a
 * row in chat_mod_log, which is also how a ban is in force. A chat ban only stops sending: the player still reads chat
 * and plays. A decision is deleted CHAT_MOD.keepDecisionsDays after it ended (pruneChatMod, on the Worker's schedule).
 */
import { CHAT_MOD } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import type { Sql, Stmt } from "./accounts.ts";

const DAY = 86_400_000;

/** What a banned player hears when they try to send (the app words it with the date: chat-mod.ts there). */
export const CHAT_OFF = "Your chat is off: a moderator's decision.";

/** A player's chat ban in force now, if any. */
export async function chatBlock(sql: Sql, userId: string, now: number): Promise<ChatBlock | null> {
  const row = await sql.first<{ until: number | null }>(
    "SELECT until FROM chat_mod_log WHERE user_id = ? AND action = 'ban' AND ended_at IS NULL AND (until IS NULL OR until > ?) ORDER BY id DESC LIMIT 1",
    userId,
    now,
  );
  return row ? { until: row.until } : null;
}

export type ChatDecision = "warn" | "ban" | "lift" | "reset";
const DECISIONS: readonly ChatDecision[] = ["warn", "ban", "lift", "reset"];
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

/**
 * A moderator's decision about a player's chat (`by`: "admin:<email>"), with a written reason for the log and
 * optionally a note to the player (shown with a warning or a ban):
 *   - warn: the player sees a warning;
 *   - ban: no sending for `days` (one of CHAT_MOD.banDays) or with no end ("forever"); replaces a ban in force;
 *   - lift: ends a ban in force;
 *   - reset: their name and icon go back to the defaults ("Player", a pawn).
 * Answers with the ban in force afterwards.
 */
export async function decideChat(
  sql: Sql,
  userId: string,
  input: { action?: unknown; days?: unknown; reason?: unknown; note?: unknown },
  by: string,
  now: number,
): Promise<{ ok: true; block: ChatBlock | null } | { ok: false; status: number; message: string }> {
  const action = DECISIONS.find((d) => d === input.action);
  if (!action) return { ok: false, status: 400, message: "action must be warn, ban, lift or reset" };
  const reason = text(input.reason, 500);
  if (reason.length < 5) return { ok: false, status: 400, message: "a written reason is required" };
  if (!(await sql.first("SELECT id FROM users WHERE id = ?", userId))) return { ok: false, status: 404, message: "no such player" };
  let until: number | null = null;
  if (action === "ban") {
    const days = input.days === "forever" ? null : Number(input.days);
    if (days !== null && !CHAT_MOD.banDays.includes(days)) return { ok: false, status: 400, message: `days must be ${CHAT_MOD.banDays.join(", ")} or forever` };
    until = days === null ? null : now + days * DAY;
  }
  if (action === "ban" || action === "lift") {
    await sql.run("UPDATE chat_mod_log SET ended_at = ? WHERE user_id = ? AND action = 'ban' AND ended_at IS NULL AND (until IS NULL OR until > ?)", now, userId, now);
  }
  if (action === "reset") await sql.run("UPDATE users SET name = 'Player', icon = '♟' WHERE id = ?", userId);
  const told = action === "warn" || action === "ban";
  await sql.run(
    "INSERT INTO chat_mod_log (user_id, at, action, until, by, reason, note, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    userId,
    now,
    action,
    until,
    by,
    reason,
    told ? text(input.note, 500) || null : null,
    told ? 0 : 1,
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

/** What a player's own app shows about their chat (their profile): a ban in force, and a notice not yet seen. */
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

/**
 * A guest signing in to an account (accounts.ts, signInWithIdentity's one batch): the decisions about the guest's chat
 * become the account's, so nothing stays under the guest's id and a chat ban can't be shed by signing in, as fair
 * play's file (docs/decisions/2026-10-16-integrity-followups.md). They keep their actions (a ban in force stays in
 * force); a line "merged" says where they came from.
 */
export function chatModMoves(from: string, to: string, now: number): Stmt[] {
  const s = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });
  return [
    s(
      `INSERT INTO chat_mod_log (user_id, at, action, by, reason) SELECT ?1, ?3, 'merged', 'sign-in', 'a guest account signed in to this account; its chat decisions moved here'
       WHERE EXISTS (SELECT 1 FROM chat_mod_log WHERE user_id = ?2)`,
      to,
      from,
      now,
    ),
    s("UPDATE chat_mod_log SET user_id = ?1 WHERE user_id = ?2", to, from),
  ];
}

/**
 * Deletes decisions that ended more than CHAT_MOD.keepDecisionsDays ago (a warning, a lift, a reset or a merge from when
 * it was made; a ban from when it ended; a ban with no end stays). On the Worker's 15-minute schedule.
 */
export async function pruneChatMod(sql: Sql, now: number): Promise<void> {
  await sql.run("DELETE FROM chat_mod_log WHERE COALESCE(ended_at, CASE WHEN action = 'ban' THEN until ELSE at END) < ?", now - CHAT_MOD.keepDecisionsDays * DAY);
}

export interface ChatLogRow {
  id: number;
  at: number;
  action: string;
  until: number | null;
  by: string;
  reason: string | null;
  note: string | null;
  ended_at: number | null;
}

/** A player's chat for fair play's review page: the ban in force and every decision so far, newest first. */
export async function chatModDetail(sql: Sql, userId: string, now: number): Promise<{ block: ChatBlock | null; log: ChatLogRow[] }> {
  return {
    block: await chatBlock(sql, userId, now),
    log: await sql.all<ChatLogRow>("SELECT id, at, action, until, by, reason, note, ended_at FROM chat_mod_log WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT 50", userId),
  };
}
