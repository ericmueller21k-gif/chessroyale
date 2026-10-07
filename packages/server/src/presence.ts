import { CAPACITY, FRONT_DOOR } from "@chessroyale/core";
import { sha256, type Sql } from "./accounts.ts";
import { liveHub } from "./live-hub.ts";
import type { Env } from "./index.ts";

/**
 * Who's online, without a D1 write per request: each Worker instance (and each lobby object) collects the accounts
 * it has heard from and passes them to the live hub at most every CAPACITY.presence.flushMs, in one call. The
 * heartbeat's session lookup is cached here too (token → account, 10 minutes), so a heartbeat is usually no D1 call
 * at all. See DECISIONS.md, "Capacity: built".
 */

type Waiter = (p: Promise<unknown>) => void;

const pending = new Map<string, number>();
let flushedAt = 0;
let flushTimer = false;

const TOKEN_CACHE_MS = 10 * 60_000;
const TOKEN_CACHE_MAX = 50_000;
const tokens = new Map<string, { userId: string; until: number }>();

function flush(env: Pick<Env, "LIVE">, now: number): Promise<unknown> {
  flushedAt = now;
  if (!pending.size) return Promise.resolve();
  const ids = [...pending.keys()];
  const at = Math.max(...pending.values());
  pending.clear();
  return liveHub(env).seen(ids, at).catch(() => undefined);
}

/** An account was heard from now. Passed on at once if the last batch went long enough ago, else with the next. */
export function markSeen(env: Pick<Env, "LIVE">, userId: string, now: number, waitUntil: Waiter) {
  pending.set(userId, now);
  const since = now - flushedAt;
  if (since >= CAPACITY.presence.flushMs || pending.size >= 500) {
    waitUntil(flush(env, now));
    return;
  }
  if (flushTimer) return;
  flushTimer = true;
  waitUntil(
    new Promise((r) => setTimeout(r, CAPACITY.presence.flushMs - since)).then(() => {
      flushTimer = false;
      return flush(env, now + (CAPACITY.presence.flushMs - since));
    }),
  );
}

/** The account behind a session token, from this instance's cache or one D1 read. */
export async function cachedUserId(sql: Sql, token: string | null | undefined, now: number): Promise<string | null> {
  if (!token) return null;
  const hit = tokens.get(token);
  if (hit && hit.until > now) return hit.userId;
  const s = await sql.first<{ user_id: string; expires_at: number }>("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", await sha256(token));
  if (!s || s.expires_at < now) {
    tokens.delete(token);
    return null;
  }
  if (tokens.size >= TOKEN_CACHE_MAX) tokens.delete(tokens.keys().next().value!);
  tokens.set(token, { userId: s.user_id, until: Math.min(s.expires_at, now + TOKEN_CACHE_MS) });
  return s.user_id;
}

const fresh = new Map<string, number>();
/**
 * Whether this is the first this instance has heard from the account in the last online window (then the caller
 * tells the hub at once and skips the cached numbers, so "you" count the moment the home screen loads).
 */
export function firstSighting(userId: string, now: number): boolean {
  const at = fresh.get(userId);
  if (at !== undefined && now - at < FRONT_DOOR.onlineWindowMs) return false;
  if (fresh.size >= TOKEN_CACHE_MAX) fresh.delete(fresh.keys().next().value!);
  fresh.delete(userId);
  fresh.set(userId, now);
  return true;
}

/** Signing out: this instance forgets the token at once (others within their 10 minutes; it only marks presence). */
export function forgetToken(token: string) {
  tokens.delete(token);
}
