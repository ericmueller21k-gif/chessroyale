import { FRONT_DOOR } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import type { LiveMatchBoard } from "./lobby.ts";

export type { LiveMatchBoard };

/**
 * The live line ("214 online · 9 matches running · 31 in queue") and the "playing now" list, from D1:
 *   - online: accounts seen in the last minute (`users.last_seen`, touched by any request from the app, and by its
 *     heartbeat during a match);
 *   - matches and the list: each lobby reports itself to `live_lobbies` when something changes (a join, the start, a
 *     cut, the end) and at least once a minute while it runs, so a lobby that stops reporting drops out;
 *   - the queue: people waiting in "Play now" lobbies;
 *   - the typical wait: how long people waited in the queue, recorded when each matchmade lobby starts.
 * No extra Durable Object and nothing kept in memory, so nothing runs (or bills) between requests.
 */

export const LIVE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS live_lobbies (
    code TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    kind TEXT NOT NULL,
    phase TEXT NOT NULL,
    humans INTEGER NOT NULL,
    alive INTEGER,
    total INTEGER,
    boss_elo INTEGER,
    started_at INTEGER,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS live_lobbies_updated ON live_lobbies (updated_at)`,
  `CREATE TABLE IF NOT EXISTS queue_waits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    at INTEGER NOT NULL,
    players INTEGER NOT NULL,
    wait_ms INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS queue_waits_mode ON queue_waits (mode, at)`,
  `CREATE INDEX IF NOT EXISTS users_seen ON users (last_seen)`,
];

export type LiveMode = "crowd" | "boss" | "classic";


/** What a lobby says about itself. `over` (results) and a private lobby still waiting are taken off the list. */
export interface LobbySummary {
  code: string;
  mode: LiveMode;
  /** "queue": matchmade (Play now); "private": made with a code. */
  kind: "queue" | "private";
  phase: "waiting" | "playing" | "over";
  /** People connected right now. */
  humans: number;
  /** Players still in (bots included), and how many started. */
  alive: number | null;
  total: number | null;
  /** A boss raid's boss (its strength). */
  bossElo: number | null;
  startedAt: number | null;
  /** Crowd and raids, while playing: the board (the live hub keeps it for the home page's live window). */
  board?: LiveMatchBoard | null;
}

export async function reportLobby(sql: Sql, s: LobbySummary, now: number): Promise<void> {
  if (s.phase === "over" || (s.phase === "waiting" && s.kind === "private")) {
    await sql.run("DELETE FROM live_lobbies WHERE code = ?", s.code);
    return;
  }
  await sql.run(
    `INSERT INTO live_lobbies (code, mode, kind, phase, humans, alive, total, boss_elo, started_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (code) DO UPDATE SET mode = excluded.mode, kind = excluded.kind, phase = excluded.phase, humans = excluded.humans,
       alive = excluded.alive, total = excluded.total, boss_elo = excluded.boss_elo, started_at = excluded.started_at, updated_at = excluded.updated_at`,
    s.code,
    s.mode,
    s.kind,
    s.phase,
    s.humans,
    s.alive,
    s.total,
    s.bossElo,
    s.startedAt,
    now,
  );
}

/** A lobby closed (deleted itself): it's off the live line and the "playing now" list. */
export async function forgetLobby(sql: Sql, code: string): Promise<void> {
  await sql.run("DELETE FROM live_lobbies WHERE code = ?", code);
}

/** A matchmade lobby started: how long its people had waited, on average. */
export async function recordWait(sql: Sql, mode: LiveMode, players: number, waitMs: number, now: number): Promise<void> {
  if (players < 1 || !Number.isFinite(waitMs)) return;
  await sql.run("INSERT INTO queue_waits (mode, at, players, wait_ms) VALUES (?, ?, ?, ?)", mode, now, players, Math.max(0, Math.round(waitMs)));
}

/** A running match, for the "playing now" list (no names: only what anyone could see from outside). */
export interface PlayingNow {
  mode: LiveMode;
  alive: number | null;
  total: number | null;
  bossElo: number | null;
  startedAt: number | null;
}

export interface LiveCounts {
  online: number;
  matches: number;
  queue: number;
  playing: PlayingNow[];
  /**
   * One running match to watch on the home page (the live hub only): a matchmade one (never a private lobby), the one
   * with the most people in it, then the newest, with its board. Null when none is running (the window plays a bot
   * match then).
   */
  featured?: (PlayingNow & { board: LiveMatchBoard }) | null;
  /** The typical wait in the queue (seconds, rounded to 5), by mode; null until there's history. */
  waits: { crowd: number | null; boss: number | null };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export async function typicalWait(sql: Sql, mode: LiveMode, now: number): Promise<number | null> {
  const rows = await sql.all<{ wait_ms: number }>(
    "SELECT wait_ms FROM queue_waits WHERE mode = ? AND at > ? ORDER BY at DESC LIMIT ?",
    mode,
    now - 7 * 86_400_000,
    FRONT_DOOR.waitSamples,
  );
  if (!rows.length) return null;
  return Math.max(5, Math.round(median(rows.map((r) => r.wait_ms)) / 5000) * 5);
}

export async function liveCounts(sql: Sql, now: number): Promise<LiveCounts> {
  const online = await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE last_seen > ?", now - FRONT_DOOR.onlineWindowMs);
  const fresh = now - FRONT_DOOR.matchStaleMs;
  const playing = await sql.all<{ mode: LiveMode; alive: number | null; total: number | null; boss_elo: number | null; started_at: number | null }>(
    "SELECT mode, alive, total, boss_elo, started_at FROM live_lobbies WHERE phase = 'playing' AND humans > 0 AND updated_at > ? ORDER BY started_at DESC",
    fresh,
  );
  const queue = await sql.first<{ n: number | null }>(
    "SELECT SUM(humans) AS n FROM live_lobbies WHERE phase = 'waiting' AND kind = 'queue' AND updated_at > ?",
    fresh,
  );
  return {
    online: online?.n ?? 0,
    matches: playing.length,
    queue: queue?.n ?? 0,
    playing: playing.slice(0, 8).map((r) => ({ mode: r.mode, alive: r.alive, total: r.total, bossElo: r.boss_elo, startedAt: r.started_at })),
    // (Boards are the live hub's: D1 isn't written for every move.)
    featured: null,
    waits: { crowd: await typicalWait(sql, "crowd", now), boss: await typicalWait(sql, "boss", now) },
  };
}

/** Old rows (lobbies that never said goodbye, waits older than a week). */
export async function pruneLive(sql: Sql, now: number): Promise<void> {
  await sql.run("DELETE FROM live_lobbies WHERE updated_at < ?", now - 60 * 60_000);
  await sql.run("DELETE FROM queue_waits WHERE at < ?", now - 8 * 86_400_000);
}

/**
 * The live line kept in memory (the LiveHub Durable Object holds one; see live-hub.ts), so presence and lobby reports
 * aren't D1 writes. Same numbers as liveCounts() above:
 *   - online: accounts seen within FRONT_DOOR.onlineWindowMs (each Worker instance passes on who it has seen);
 *   - matches, the queue and the playing-now list: what lobbies last reported, dropped after FRONT_DOOR.matchStaleMs.
 * `users.last_seen` (profiles) is still written to D1, at most once per CAPACITY.presence.lastSeenWriteMs per account,
 * in batches (lastSeenDue).
 */
export class LiveBoard {
  private seen = new Map<string, number>();
  private written = new Map<string, number>();
  private lobbies = new Map<string, LobbySummary & { updatedAt: number }>();

  markSeen(ids: readonly string[], at: number) {
    for (const id of ids) if ((this.seen.get(id) ?? 0) < at) this.seen.set(id, at);
  }

  /** Seeds who was online from D1 (after the hub restarts): they were seen then, and that's already written. */
  restoreSeen(rows: readonly { id: string; last_seen: number }[]) {
    for (const r of rows) {
      this.markSeen([r.id], r.last_seen);
      this.written.set(r.id, r.last_seen);
    }
  }

  /** A lobby's report; false if it changed nothing that's kept (results and private lobbies still waiting are dropped). */
  report(s: LobbySummary, now: number): "kept" | "dropped" {
    if (s.phase === "over" || (s.phase === "waiting" && s.kind === "private")) {
      this.lobbies.delete(s.code);
      return "dropped";
    }
    this.lobbies.set(s.code, { ...s, updatedAt: now });
    return "kept";
  }

  forget(code: string) {
    this.lobbies.delete(code);
  }

  lobby(code: string) {
    return this.lobbies.get(code);
  }

  isOnline(id: string, now: number): boolean {
    return now - (this.seen.get(id) ?? -Infinity) < FRONT_DOOR.onlineWindowMs;
  }

  lastSeen(id: string): number | null {
    return this.seen.get(id) ?? null;
  }

  /** People in lobbies right now (queues and running matches): what the overload limit counts. */
  players(now: number): number {
    let n = 0;
    for (const l of this.lobbies.values()) if (now - l.updatedAt < FRONT_DOOR.matchStaleMs && l.phase !== "over") n += l.humans;
    return n;
  }

  counts(now: number, waits: LiveCounts["waits"]): LiveCounts {
    let online = 0;
    for (const at of this.seen.values()) if (now - at < FRONT_DOOR.onlineWindowMs) online++;
    const fresh = now - FRONT_DOOR.matchStaleMs;
    const playing = [...this.lobbies.values()]
      .filter((l) => l.phase === "playing" && l.humans > 0 && l.updatedAt > fresh)
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    let queue = 0;
    for (const l of this.lobbies.values()) if (l.phase === "waiting" && l.kind === "queue" && l.updatedAt > fresh) queue += l.humans;
    // (Matchmade only: a private lobby's game is its friends', not the front page's.)
    const watch = playing.filter((l) => l.board && l.kind === "queue").sort((a, b) => b.humans - a.humans || (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
    return {
      online,
      matches: playing.length,
      queue,
      playing: playing.slice(0, 8).map((l) => ({ mode: l.mode, alive: l.alive, total: l.total, bossElo: l.bossElo, startedAt: l.startedAt })),
      featured: watch ? { mode: watch.mode, alive: watch.alive, total: watch.total, bossElo: watch.bossElo, startedAt: watch.startedAt, board: watch.board! } : null,
      waits,
    };
  }

  /** Accounts whose `last_seen` should be written now (seen since it was last written, at most once per `everyMs`). */
  lastSeenDue(now: number, everyMs: number): { id: string; at: number }[] {
    const due: { id: string; at: number }[] = [];
    for (const [id, at] of this.seen) {
      const w = this.written.get(id);
      if (w === undefined || (at > w && now - w >= everyMs)) {
        due.push({ id, at });
        this.written.set(id, at);
      }
    }
    return due;
  }

  /** Forgets presence long gone (already written) and lobbies silent for an hour. */
  prune(now: number): string[] {
    const gone: string[] = [];
    for (const [id, at] of this.seen) {
      if (now - at > 10 * 60_000 && (this.written.get(id) ?? 0) >= at) {
        this.seen.delete(id);
        this.written.delete(id);
      }
    }
    for (const [code, l] of this.lobbies) {
      if (now - l.updatedAt > 60 * 60_000) {
        this.lobbies.delete(code);
        gone.push(code);
      }
    }
    return gone;
  }

  get size() {
    return { seen: this.seen.size, lobbies: this.lobbies.size };
  }
}

/** Writes many accounts' `last_seen` in one statement per 500 (never moving it backwards). */
export async function writeLastSeen(sql: Sql, due: readonly { id: string; at: number }[]): Promise<void> {
  for (let i = 0; i < due.length; i += 500) {
    const chunk = Object.fromEntries(due.slice(i, i + 500).map((d) => [d.id, d.at]));
    await sql.run(
      "UPDATE users SET last_seen = MAX(COALESCE(last_seen, 0), j.value) FROM json_each(?) AS j WHERE users.id = j.key",
      JSON.stringify(chunk),
    );
  }
}
