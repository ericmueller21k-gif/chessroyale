/**
 * A ban means you can't sign in (Eric, Nov 13: "When I think of the word banned, I think of you can't sign in anymore. Just like every
 * other game works"; "No URLs work"). docs/decisions/2026-11-13-ban-blocks-sign-in.md.
 *
 * - **The gate** (banGate, run by the Worker before every `/api/*` route, the lobbies' WebSockets included: index.ts): a request whose
 *   session belongs to a banned account (a person's ban, or an evasion ban) gets the ban answer and nothing else. Each Worker instance
 *   keeps a "not banned" answer per session for FAIRPLAY.banCheckMs (ban-cache.ts), so the live line's and the town's polls stay
 *   without a database read most of the time.
 * - **The ban answer** (banAnswer): 403 `{banned: true, message: BANNED_LINE}` with the `x-hc-banned` header (the app drops to its ban
 *   screen on any answer that carries it: app/ban.ts), the banned account's session ended (its row deleted, its cookie cleared), and the
 *   browser marked (`hc_banned`, the banned account's id, HttpOnly). Signing in to a banned account gives it too (api.ts), with no
 *   session made.
 * - **The mark** keeps the banned person out once signed out: while its account is banned, a request from that browser with no live
 *   session gets the ban answer, on every route but the sign-in's own (SIGN_IN). A shared device (a family's tablet, a library's
 *   computer: the review of #687, M1) stays open to anyone else: signing in to an account that isn't banned works there, and a live
 *   session of an account that isn't banned passes the mark (the banned account's own never does: the gate ends it). Lifting the ban
 *   takes the mark away on the browser's next request; clearing the browser's data clears it too.
 * - The engine pool is never a ban (fair play's quiet pool): it passes the gate as any account. The admin pages (`/admin/*`) aren't
 *   behind the gate: only admins see them, and an admin's browser that met a ban (a shared one) can still lift it.
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
/**
 * The sign-in's own routes (its options, the age question, an emailed code, Google's trip there and back): a browser marked banned
 * may still sign in to another account (a shared device). They run without a session too (api.ts). A banned account's own session
 * gets the ban answer on these as on every route, and signing in to a banned account is refused by the route itself (signInBan).
 */
export const SIGN_IN_ROUTES: ReadonlySet<string> = new Set([
  "/api/auth/config",
  "/api/auth/age",
  "/api/auth/email/start",
  "/api/auth/email/verify",
  "/api/auth/google/start",
  "/api/auth/google/callback",
]);

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

/**
 * The headers of every ban answer: the browser marked with the banned account, the app's header, and the session cookie cleared when
 * a session is ended (`ended`: never another account's, which stays signed in on a shared device).
 */
function banHeaders(userId: string, ended: boolean): Headers {
  const headers = new Headers({ "cache-control": "no-store", [BAN_HEADER]: "1" });
  if (ended) headers.append("set-cookie", setCookie(SESSION, "", 0));
  headers.append("set-cookie", setCookie(BAN_COOKIE, userId, MARK_DAYS * 86_400));
  return headers;
}

/** Ends this browser's session (its row, and this instance's cached answers for it). */
async function endSession(sql: Sql, token: string): Promise<void> {
  forgetToken(token);
  forgetBanCheck(`s:${token}`);
  await sql.run("DELETE FROM sessions WHERE token_hash = ?", await sha256(token)).catch(() => undefined);
}

/**
 * The ban answer (every route's, and a refused sign-in's): 403 with Eric's line, the browser marked with `userId` (the banned account
 * the request reached), and `end` ended: the banned account's own session (or a guest's that tried to sign in to it), never another
 * account's (null: none to end).
 */
export async function banAnswer(sql: Sql, end: string | null, userId: string): Promise<Response> {
  if (end) await endSession(sql, end);
  const headers = banHeaders(userId, !!end);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify({ banned: true, message: BANNED_LINE }), { status: 403, headers });
}

/** A refused Google sign-in (a trip back from Google, so a redirect, not JSON): the same cookies, to `location`. */
export async function banRedirect(sql: Sql, end: string | null, userId: string, location: string): Promise<Response> {
  if (end) await endSession(sql, end);
  const headers = banHeaders(userId, !!end);
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
 * "not banned" answer is in time). A banned answer isn't kept: the gate ends that session. A session that's gone (ended by the gate
 * on another instance, signed out) or expired: this instance's presence cache forgets its token too (presence.ts keeps one 10 minutes,
 * and the routes that read it would otherwise still serve the banned account: the review of #687, M2).
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
  if (!live) forgetToken(token);
  const answer = { userId: live ? s.user_id : null, banned: live && s.status === "banned" };
  if (!answer.banned) keepBanCheck(key, { ...answer, until: now + FAIRPLAY.banCheckMs });
  return answer;
}

/**
 * The gate, before every `/api/*` route (index.ts). In order:
 * - a session of a banned account: the ban answer (that session ended, the browser marked), on every route;
 * - a browser marked banned while that account still is: the ban answer for a request with no live session, except on the sign-in
 *   routes (SIGN_IN_ROUTES); a live session of an account that isn't banned passes (a shared device), and the mark stays;
 * - a mark that no longer holds (the ban lifted, or naming no banned account): `unmark`, the browser a guest again, free to sign in;
 * - anything else: null (no session and no mark: nothing read).
 * A database that doesn't answer lets the request through (its route fails or works as before).
 */
export async function banGate(sql: Sql, db: object, request: Request, now: number): Promise<{ refused: Response } | { unmark: true } | null> {
  const token = cookieOf(request, SESSION);
  const marked = cookieOf(request, BAN_COOKIE);
  if (!token && marked === null) return null;
  try {
    await ensureSchema(sql, db);
    let live = false;
    if (token) {
      const s = await sessionBanned(sql, token, now);
      if (s.banned) return { refused: await banAnswer(sql, token, s.userId!) };
      live = s.userId !== null;
    }
    if (marked === null) return null;
    if (!ID.test(marked) || !(await accountBanned(sql, marked, now))) return { unmark: true };
    if (live || SIGN_IN_ROUTES.has(new URL(request.url).pathname)) return null;
    // (No live session: a token left over is cleared with the answer; its row is already gone.)
    return { refused: await banAnswer(sql, token, marked) };
  } catch (e) {
    console.log(`ban gate: ${String(e)}`);
    return null;
  }
}
