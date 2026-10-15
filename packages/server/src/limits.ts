import { CAPACITY, OPS } from "@chessroyale/core";

/**
 * Rate limits on the API (CAPACITY.rateLimits): requests per window per address, per account (its session) and, for
 * PLAY and new lobbies, and for friends' actions, per account again. Counted in each Worker instance's memory, so they stop a runaway client or
 * script, not a person playing; past a limit the answer is a friendly 429 with when to try again.
 */
export class RateLimiter {
  private windows = new Map<string, { start: number; n: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  /** Counts a request; `retryMs` > 0 when it's over the limit (wait that long). */
  hit(key: string, now: number): { ok: boolean; retryMs: number } {
    let w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      if (this.windows.size > 100_000) this.prune(now);
      w = { start: now, n: 0 };
      this.windows.set(key, w);
    }
    w.n++;
    return w.n > this.limit ? { ok: false, retryMs: w.start + this.windowMs - now } : { ok: true, retryMs: 0 };
  }

  private prune(now: number) {
    for (const [k, w] of this.windows) if (now - w.start >= this.windowMs) this.windows.delete(k);
  }
}

const L = CAPACITY.rateLimits;
const perIp = new RateLimiter(L.perIp.limit, L.perIp.windowMs);
const perUser = new RateLimiter(L.perUser.limit, L.perUser.windowMs);
const play = new RateLimiter(L.play.limit, L.play.windowMs);
const friends = new RateLimiter(L.friends.limit, L.friends.windowMs);

export const TOO_MANY = "Too many requests. Wait a few seconds and try again.";

/** A session cookie as accounts.ts makes them (randomToken: 32 bytes, base64url); anything else isn't one. */
export const isSessionToken = (v: string | null): v is string => v !== null && /^[\w-]{43}$/.test(v);

/**
 * Whether this request may go ahead: null if so, else how long to wait. `ip` is skipped when `ipExempt` (a load test
 * from one machine; the LOAD_TEST variable on staging, never production). The account is a key only for a real session
 * cookie (a made-up one each time would be a fresh key), and the limits are counted in order, stopping at the first
 * that refuses: a refused request uses up nothing further.
 */
export function rateLimited(req: { ip: string | null; session: string | null; play: boolean; friends?: boolean }, now: number, ipExempt = false): number | null {
  const session = isSessionToken(req.session) ? req.session : null;
  const checks: [RateLimiter, string][] = [];
  if (req.ip && !ipExempt) checks.push([perIp, req.ip]);
  if (session) checks.push([perUser, session]);
  if (req.play) checks.push([play, session ?? `ip:${req.ip}`]);
  // (Friends' actions: a burst limit here; the daily and hourly caps are counted in D1, friends.ts.)
  if (req.friends) checks.push([friends, session ?? `ip:${req.ip}`]);
  for (const [l, k] of checks) {
    const r = l.hit(k, now);
    if (!r.ok) return r.retryMs;
  }
  return null;
}

const P = OPS.endpoint;
const problemLimits = {
  errors: [new RateLimiter(P.errors.perIp.limit, P.errors.perIp.windowMs), new RateLimiter(P.errors.perUser.limit, P.errors.perUser.windowMs)],
  report: [new RateLimiter(P.reports.perIp.limit, P.reports.perIp.windowMs), new RateLimiter(P.reports.perUser.limit, P.reports.perUser.windowMs)],
} as const;

/**
 * POST /api/problems (problems.ts): error reports and player reports, each with their own limits per address and per
 * account (OPS.endpoint), on top of the API's. Null if this one may go ahead, else how long to wait. The address is
 * only a key in this instance's memory, never stored. The account is counted only for a real session cookie (a made-up
 * one each time would be a fresh key) and only once the address is let through (a refused request uses up nothing).
 */
export function problemLimited(kind: "errors" | "report", req: { ip: string | null; session: string | null }, now: number): number | null {
  const [perIp, perUser] = problemLimits[kind];
  if (req.ip) {
    const r = perIp.hit(req.ip, now);
    if (!r.ok) return r.retryMs;
  }
  if (isSessionToken(req.session)) {
    const r = perUser.hit(req.session, now);
    if (!r.ok) return r.retryMs;
  }
  return null;
}
