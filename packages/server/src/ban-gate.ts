/**
 * A ban means you can't sign in (Eric, Nov 13: "When I think of the word banned, I think of you can't sign in anymore. Just like every
 * other game works"; "No URLs work"). docs/decisions/2026-11-13-ban-blocks-sign-in.md.
 *
 * - **The gate** (banGate, run by the Worker before any route: index.ts): a request whose session belongs to a banned account (a
 *   person's ban, or an evasion ban from banCheck), or from a browser marked banned, gets the ban answer and nothing else, on every
 *   `/api/*` route and the admin pages, the lobbies' WebSockets included. Each Worker instance keeps a "not banned" answer per session
 *   for FAIRPLAY.banCheckMs (ban-cache.ts), so the live line's and the town's polls stay without a database read most of the time.
 * - **The ban answer** (banAnswer): 403 `{banned: true, message: BANNED_LINE}` with the `x-hc-banned` header (the app drops to its ban
 *   screen on any answer that carries it: app/ban.ts), the session ended (its row deleted, its cookie cleared), and the browser marked
 *   (`hc_banned`, the banned account's id, HttpOnly): from then on every request from it gets the ban answer, whatever cookie it
 *   brings, until the ban is lifted (the gate then takes the mark away and the browser is a guest, free to sign in again) or the
 *   browser's data is cleared. Signing in to a banned account gives it too (api.ts), with no session made.
 * - The engine pool is never a ban (fair play's quiet pool): it passes the gate as any account.
 */
import { BANNED_LINE, FAIRPLAY } from "@chessroyale/core";
import { ensureSchema, sha256, type Sql } from "./accounts.ts";
import { cachedBanCheck, forgetBanCheck, keepBanCheck } from "./ban-cache.ts";
import { forgetToken } from "./presence.ts";

/** The browser's mark (the banned account's id), set with every ban answer. */
export const BAN_COOKIE = "hc_banned";
/** On every ban answer: the app drops to its ban screen on any answer with it (app/ban.ts). */
export const BAN_HEADER = "x-hc-banned";
/** api.ts's SESSION_COOKIE (named here too, so this module needs nothing from api.ts, which imports it). */
const SESSION = "hc_session";
/** How long a browser keeps its mark (a cookie's longest: 400 days). Lifting the ban takes it away sooner. */
const MARK_DAYS = 400;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const setCookie = (name: string, value: string, maxAge: number) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
/** The Set-Cookie that takes a browser's mark away (a lifted ban, or a mark that names no banned account). */
export const UNMARK = setCookie(BAN_COOKIE, "", 0);

function cookieOf(request: Request, name: string): string | null {
  const m = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
}

/** The headers of every ban answer: the session cookie cleared, the browser marked with the banned account, the app's header. */
function banHeaders(userId: string): Headers {
  const headers = new Headers({ "cache-control": "no-store", [BAN_HEADER]: "1" });
  headers.append("set-cookie", setCookie(SESSION, "", 0));
  headers.append("set-cookie", setCookie(BAN_COOKIE, userId, MARK_DAYS * 86_400));
  return headers;
}

/** Ends this browser's session (its row, and this instance's cached answers for it). */
async function endSession(sql: Sql, token: string | null): Promise<void> {
  if (!token) return;
  forgetToken(token);
  forgetBanCheck(`s:${token}`);
  await sql.run("DELETE FROM sessions WHERE token_hash = ?", await sha256(token)).catch(() => undefined);
}

/**
 * The ban answer (every route's, and a refused sign-in's): 403 with Eric's line, the session ended, the browser marked with `userId`
 * (the banned account the request reached).
 */
export async function banAnswer(sql: Sql, token: string | null, userId: string): Promise<Response> {
  await endSession(sql, token);
  const headers = banHeaders(userId);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify({ banned: true, message: BANNED_LINE }), { status: 403, headers });
}

/** A refused Google sign-in (a trip back from Google, so a redirect, not JSON): the same cookies, to `location`. */
export async function banRedirect(sql: Sql, token: string | null, userId: string, location: string): Promise<Response> {
  await endSession(sql, token);
  const headers = banHeaders(userId);
  headers.set("location", location);
  return new Response(null, { status: 302, headers });
}

/** Whether this account is banned now (a case "banned"), kept FAIRPLAY.banCheckMs: a marked browser's check. */
async function accountBanned(sql: Sql, userId: string, now: number): Promise<boolean> {
  const key = `m:${userId}`;
  const hit = cachedBanCheck(key, now);
  if (hit) return hit.banned;
  const banned = (await sql.first<{ status: string }>("SELECT status FROM fairplay_cases WHERE user_id = ?", userId))?.status === "banned";
  keepBanCheck(key, { userId, banned, until: now + FAIRPLAY.banCheckMs });
  return banned;
}

/**
 * The session's account and whether it's banned: the session and its case in one read (no read at all while this instance's
 * "not banned" answer is in time). A banned answer isn't kept: the gate ends that session.
 */
async function sessionBanned(sql: Sql, token: string, now: number): Promise<{ userId: string | null; banned: boolean }> {
  const key = `s:${token}`;
  const hit = cachedBanCheck(key, now);
  if (hit) return hit;
  const s = await sql.first<{ user_id: string; expires_at: number; status: string | null }>(
    "SELECT s.user_id, s.expires_at, c.status FROM sessions s LEFT JOIN fairplay_cases c ON c.user_id = s.user_id WHERE s.token_hash = ?",
    await sha256(token),
  );
  const live = !!s && s.expires_at >= now;
  const answer = { userId: live ? s.user_id : null, banned: live && s.status === "banned" };
  if (!answer.banned) keepBanCheck(key, { ...answer, until: now + FAIRPLAY.banCheckMs });
  return answer;
}

/**
 * The gate, before any route: the ban answer for a banned session or a browser marked banned while that account still is; else
 * whether to take the browser's mark away (its account's ban lifted, or a mark naming no banned account); null for anything else (no
 * session and no mark: nothing read). A database that doesn't answer lets the request through (its route fails or works as before).
 */
export async function banGate(sql: Sql, db: object, request: Request, now: number): Promise<{ refused: Response } | { unmark: true } | null> {
  const token = cookieOf(request, SESSION);
  const marked = cookieOf(request, BAN_COOKIE);
  if (!token && marked === null) return null;
  try {
    await ensureSchema(sql, db);
    let unmark = false;
    if (marked !== null) {
      if (ID.test(marked) && (await accountBanned(sql, marked, now))) return { refused: await banAnswer(sql, token, marked) };
      unmark = true;
    }
    if (token) {
      const s = await sessionBanned(sql, token, now);
      if (s.banned) return { refused: await banAnswer(sql, token, s.userId!) };
    }
    return unmark ? { unmark: true } : null;
  } catch (e) {
    console.log(`ban gate: ${String(e)}`);
    return null;
  }
}
