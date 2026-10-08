import { CAPACITY } from "@chessroyale/core";

/**
 * The matchmaker's queue, as pure logic (the Durable Object in matchmaker.ts does the calls). See DECISIONS.md,
 * "Capacity: built".
 *
 * - A PLAY press is a ticket, held in memory. Tickets are placed in lobbies in batches: one seat reservation call per
 *   lobby per batch, not one call per player, and nothing waits on another object while holding the queue.
 * - Admission: at most `admitPerSecond` tickets a second (with a burst), and none while the servers hold more than
 *   `maxPlayers` people. The rest wait in line, in order, and are told about how long.
 * - Matching rules: `MatchRules.group` splits a batch into groups that must not share a lobby (ranked: skill bands).
 *   The default puts everyone together in the order they pressed PLAY.
 */

export interface Ticket {
  id: string;
  /** When PLAY was first pressed (a ticket keeps its place when its player asks again). */
  at: number;
  /** Last time its player asked (tickets nobody asks about expire). */
  seenAt: number;
  /** For matching rules (ranked): anything the rules want, e.g. a skill estimate. Unused by the default rules. */
  info?: Record<string, unknown>;
}

/** A group of tickets to seat together, in lobbies of their own (`key`: the group's lobby line, e.g. a skill band). */
export interface TicketGroup {
  key: string;
  tickets: Ticket[];
}

/**
 * The matching rules hook (the `ranked` delegate's): given the tickets admitted this batch, oldest first, and the
 * time, which go together. Tickets left out stay in line, in order, for the next batch (a window that widens with
 * waiting can hold a ticket back until it finds company).
 */
export interface MatchRules {
  group(tickets: Ticket[], now: number): TicketGroup[];
}

/** Unranked "Play now": everyone together, in the order they pressed PLAY. */
export const FILL_IN_ORDER: MatchRules = { group: (tickets) => (tickets.length ? [{ key: "all", tickets }] : []) };

export interface QueueConfig {
  admitPerSecond: number;
  admitBurst: number;
  ticketTtlMs: number;
  placedKeepMs: number;
  retryMs: number;
  maxPlayers: number;
}

export const queueConfig = (): QueueConfig => ({ ...CAPACITY.queue, maxPlayers: CAPACITY.overload.maxPlayers });

export class QueueCore {
  /** Waiting to be placed, oldest first. */
  private line: Ticket[] = [];
  private byId = new Map<string, Ticket>();
  /** Placed tickets: their lobby, until when it's remembered. */
  private placed = new Map<string, { code: string; until: number }>();
  private tokens: number;
  private refilledAt: number;
  /** Recent admissions per second (for the wait estimate when the player cap, not the rate, holds the line). */
  private admittedLog: { at: number; n: number }[] = [];

  constructor(
    readonly cfg: QueueConfig = queueConfig(),
    now = Date.now(),
    private newId: () => string = () => crypto.randomUUID(),
  ) {
    this.tokens = cfg.admitBurst;
    this.refilledAt = now;
  }

  /** A PLAY press (or a player in line asking again with their ticket: it keeps its place). */
  enqueue(ticketId: string | null | undefined, now: number, info?: Record<string, unknown>): Ticket {
    const known = ticketId ? this.byId.get(ticketId) : undefined;
    if (known) {
      known.seenAt = now;
      return known;
    }
    if (ticketId && this.placed.has(ticketId)) return { id: ticketId, at: now, seenAt: now };
    const t: Ticket = { id: this.newId(), at: now, seenAt: now, ...(info ? { info } : {}) };
    this.line.push(t);
    this.byId.set(t.id, t);
    return t;
  }

  /** The lobby a ticket was placed in (undefined while it waits). */
  placedIn(ticketId: string): string | undefined {
    return this.placed.get(ticketId)?.code;
  }

  get waiting(): number {
    return this.line.length;
  }

  /** 1 for the next ticket to be placed. */
  position(ticketId: string): number {
    const i = this.line.findIndex((t) => t.id === ticketId);
    return i < 0 ? 0 : i + 1;
  }

  private refill(now: number) {
    this.tokens = Math.min(this.cfg.admitBurst, this.tokens + ((now - this.refilledAt) / 1000) * this.cfg.admitPerSecond);
    this.refilledAt = now;
  }

  /**
   * Takes the tickets that may be placed now, oldest first: within the admission rate, and none while `players`
   * (people in lobbies now) is at the cap. Returns them grouped by the matching rules; tickets the rules leave out go
   * back to the front of the line.
   */
  admit(now: number, players: number, rules: MatchRules = FILL_IN_ORDER): TicketGroup[] {
    this.expire(now);
    this.refill(now);
    const room = Math.max(0, this.cfg.maxPlayers - players);
    const n = Math.min(this.line.length, Math.floor(this.tokens), room);
    if (n <= 0) return [];
    const taken = this.line.splice(0, n);
    const groups = rules.group(taken, now).filter((g) => g.tickets.length);
    const used = new Set(groups.flatMap((g) => g.tickets.map((t) => t.id)));
    const back = taken.filter((t) => !used.has(t.id));
    this.line.unshift(...back);
    this.tokens -= used.size;
    for (const t of taken) if (used.has(t.id)) this.byId.delete(t.id);
    if (used.size) this.admittedLog.push({ at: now, n: used.size });
    return groups;
  }

  /** These tickets have seats in `code`. */
  place(tickets: Ticket[], code: string, now: number) {
    for (const t of tickets) this.placed.set(t.id, { code, until: now + this.cfg.placedKeepMs });
  }

  /** Couldn't seat these (a lobby couldn't be opened): back to the front of the line, in order, with their rate back. */
  putBack(tickets: Ticket[]) {
    this.line.unshift(...tickets);
    for (const t of tickets) this.byId.set(t.id, t);
    this.tokens += tickets.length;
  }

  /** Drops tickets whose players stopped asking, and placements old enough to forget. */
  expire(now: number) {
    if (this.line.some((t) => now - t.seenAt > this.cfg.ticketTtlMs)) {
      this.line = this.line.filter((t) => {
        const keep = now - t.seenAt <= this.cfg.ticketTtlMs;
        if (!keep) this.byId.delete(t.id);
        return keep;
      });
    }
    for (const [id, p] of this.placed) if (p.until < now) this.placed.delete(id);
    this.admittedLog = this.admittedLog.filter((a) => now - a.at < 60_000);
  }

  /**
   * About how long until a ticket in line is placed (seconds, rounded up to 5): its place in line over the rate
   * tickets are let in (the admission rate, or the last minute's actual rate when the player cap holds the line).
   */
  estimateSeconds(ticketId: string, now: number, players: number): number {
    const pos = Math.max(1, this.position(ticketId));
    const capped = players >= this.cfg.maxPlayers;
    const recent = this.admittedLog.filter((a) => now - a.at < 60_000).reduce((s, a) => s + a.n, 0) / 60;
    const rate = capped ? Math.max(recent, 1 / 60) : this.cfg.admitPerSecond;
    return Math.min(600, Math.max(5, Math.ceil(pos / rate / 5) * 5));
  }
}

/**
 * Which matchmaker a PLAY press goes to: one per mode and matchmaking type ("crowd-default", "raid-botsoff"), so
 * Default and Bots off never share a lobby; a test's own pool (?pool=NAME); and, with CAPACITY.queue.byRegion on, one
 * per continent ("crowd-default@EU"), created near its players. Ranked queues would add their own names here.
 */
export function queueName(mode: "crowd" | "raid", type: "default" | "botsoff", pool?: string | null, region?: string | null): string {
  const base = `${mode}-${type}${pool && /^[a-z0-9-]{1,24}$/.test(pool) ? `-${pool}` : ""}`;
  return region ? `${base}@${region}` : base;
}

/** The region a request's queue is in (its continent), or null while queues aren't split by region. */
export function regionOf(cf: { continent?: unknown } | undefined, byRegion: boolean = CAPACITY.queue.byRegion): string | null {
  if (!byRegion) return null;
  const c = typeof cf?.continent === "string" ? cf.continent : "";
  return /^(AF|AN|AS|EU|NA|OC|SA)$/.test(c) ? c : null;
}

/** Where to create a region's matchmaker (Durable Object location hints). */
export const REGION_HINT: Record<string, DurableObjectLocationHint> = { AF: "afr", AN: "oc", AS: "apac", EU: "weur", NA: "enam", OC: "oc", SA: "sam" };
