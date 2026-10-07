import { DurableObject } from "cloudflare:workers";
import { CAPACITY, FRONT_DOOR } from "@chessroyale/core";
import { d1Sql, ensureSchema } from "./accounts.ts";
import { LiveBoard, pruneLive, typicalWait, writeLastSeen, type LiveCounts, type LobbySummary } from "./live.ts";
import { countCall } from "./ops.ts";
import type { Env } from "./index.ts";

/** The one live hub (its name). */
export const LIVE_HUB = "global";
export const liveHub = (env: Pick<Env, "LIVE">) => env.LIVE!.get(env.LIVE!.idFromName(LIVE_HUB));

/**
 * The live line in memory: who's online, which lobbies are running or filling, and so the overload limit's count.
 * Worker instances pass on who they've seen in batches (presence.ts), lobbies report changes (at most every 2 s),
 * and GET /api/live reads it (each Worker instance caches it for 3 s). D1 only gets `users.last_seen` once a minute
 * per account, in batches, and the typical wait is read from D1 once a minute.
 *
 * Lobby reports are also kept in this object's own storage, so a restart keeps the playing-now list; who's online is
 * seeded from D1's last minute. See DECISIONS.md, "Capacity: built".
 */
export class LiveHub extends DurableObject<Env> {
  private board = new LiveBoard();
  private waits: { at: number; value: LiveCounts["waits"] } | null = null;
  private prunedAt = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      for (const [, s] of await ctx.storage.list<LobbySummary & { updatedAt: number }>({ prefix: "lobby:" })) {
        this.board.report(s, s.updatedAt);
      }
      if (env.DB) {
        try {
          const sql = d1Sql(env.DB);
          await ensureSchema(sql, env.DB);
          this.board.restoreSeen(await sql.all<{ id: string; last_seen: number }>("SELECT id, last_seen FROM users WHERE last_seen > ?", now - FRONT_DOOR.onlineWindowMs));
        } catch (e) {
          console.log(`live hub: no D1 at start (${String(e)})`);
        }
      }
    });
  }

  private async keepAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + CAPACITY.presence.lastSeenWriteMs);
  }

  /** Accounts a Worker instance has seen (each request from the app, the 30 s heartbeat). */
  async seen(ids: string[], at: number): Promise<void> {
    countCall("hub.seen");
    this.board.markSeen(ids, Math.min(at, Date.now()));
    await this.keepAlarm();
  }

  /** Someone just arrived (their first request to a Worker instance in a minute): counted at once, and the numbers. */
  async arrive(id: string, at: number): Promise<LiveCounts> {
    countCall("hub.arrive");
    this.board.markSeen([id], Math.min(at, Date.now()));
    await this.keepAlarm();
    return this.counts();
  }

  /** A lobby's report (a change, or its once-a-minute "still running"). */
  async report(s: LobbySummary): Promise<void> {
    countCall("hub.report");
    const now = Date.now();
    if (this.board.report(s, now) === "dropped") await this.ctx.storage.delete(`lobby:${s.code}`);
    else await this.ctx.storage.put(`lobby:${s.code}`, this.board.lobby(s.code));
    await this.keepAlarm();
  }

  /** A lobby closed. */
  async forget(code: string): Promise<void> {
    this.board.forget(code);
    await this.ctx.storage.delete(`lobby:${code}`);
  }

  async counts(): Promise<LiveCounts> {
    const now = Date.now();
    if ((!this.waits || now - this.waits.at > 60_000) && this.env.DB) {
      const sql = d1Sql(this.env.DB);
      try {
        await ensureSchema(sql, this.env.DB);
        this.waits = { at: now, value: { crowd: await typicalWait(sql, "crowd", now), boss: await typicalWait(sql, "boss", now) } };
      } catch {
        this.waits = { at: now, value: this.waits?.value ?? { crowd: null, boss: null } };
      }
    }
    return this.board.counts(now, this.waits?.value ?? { crowd: null, boss: null });
  }

  /** The live line's numbers (each Worker instance asks at most every 3 s). */
  async liveCounts(): Promise<LiveCounts> {
    countCall("hub.counts");
    return this.counts();
  }

  /** People in lobbies now (the overload limit). */
  async players(): Promise<number> {
    return this.board.players(Date.now());
  }

  /** For a profile: online now, and the latest time seen (fresher than D1's, which is written once a minute). */
  async presence(id: string): Promise<{ online: boolean; lastSeen: number | null }> {
    const now = Date.now();
    return { online: this.board.isOnline(id, now), lastSeen: this.board.lastSeen(id) };
  }

  /** Once a minute while anyone's around: `last_seen` to D1 in batches, and old entries forgotten. */
  async alarm() {
    const now = Date.now();
    const due = this.board.lastSeenDue(now, CAPACITY.presence.lastSeenWriteMs);
    if (due.length && this.env.DB) {
      const sql = d1Sql(this.env.DB);
      try {
        await ensureSchema(sql, this.env.DB);
        await writeLastSeen(sql, due);
        if (now - this.prunedAt > 10 * 60_000) {
          this.prunedAt = now;
          await pruneLive(sql, now);
        }
      } catch (e) {
        console.log(`live hub: last_seen not written (${String(e)})`);
      }
    }
    const gone = this.board.prune(now);
    if (gone.length) await this.ctx.storage.delete(gone.map((c) => `lobby:${c}`));
    const { seen, lobbies } = this.board.size;
    if (seen || lobbies) await this.ctx.storage.setAlarm(now + CAPACITY.presence.lastSeenWriteMs);
  }
}
