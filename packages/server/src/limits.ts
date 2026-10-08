import { CAPACITY } from "@chessroyale/core";

/**
 * Rate limits on the API (CAPACITY.rateLimits): requests per window per address, per account (its session) and, for
 * PLAY and new lobbies, per account again. Counted in each Worker instance's memory, so they stop a runaway client or
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

export const TOO_MANY = "Too many requests. Wait a few seconds and try again.";

/**
 * Whether this request may go ahead: null if so, else how long to wait. `ip` is skipped when `ipExempt` (a load test
 * from one machine; the LOAD_TEST variable on staging, never production).
 */
export function rateLimited(req: { ip: string | null; session: string | null; play: boolean }, now: number, ipExempt = false): number | null {
  const checks: [RateLimiter, string][] = [];
  if (req.ip && !ipExempt) checks.push([perIp, req.ip]);
  if (req.session) checks.push([perUser, req.session]);
  if (req.play) checks.push([play, req.session ?? `ip:${req.ip}`]);
  let wait = 0;
  for (const [l, k] of checks) {
    const r = l.hit(k, now);
    if (!r.ok) wait = Math.max(wait, r.retryMs);
  }
  return wait > 0 ? wait : null;
}
