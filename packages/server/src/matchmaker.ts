import { DurableObject } from "cloudflare:workers";
import { CAPACITY, DEFAULT_SETTINGS, MATCHMAKING } from "@chessroyale/core";
import type { LobbyRecord } from "./lobby.ts";
import { openLobbyCode } from "./codes.ts";
import type { Env } from "./index.ts";
import { countCall } from "./ops.ts";
import { FILL_IN_ORDER, QueueCore, type MatchRules, type Ticket } from "./queue.ts";

export { queueName } from "./queue.ts";
import { liveHub } from "./live-hub.ts";

/** What POST /api/play answers: a lobby, or "busy, you're in line" with the ticket to ask again with. */
export type PlayAnswer =
  | { code: string; ticket?: string }
  | { busy: true; ticket: string; position: number; waitSeconds: number; retryMs: number; message: string };

export const busyMessage = (seconds: number) => `Servers are busy, you're in line: about ${seconds} s`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** How a queue's lobbies start (the same for every press to one queue), and a switcher's wait so far. */
export interface PlayOptions {
  /** Bots off: people only (a raid may begin after the fill time with enough people; a 50 v 50 waits until full). */
  botsOff?: boolean;
  crowdWaitsForFull?: boolean;
  /** Bots off → Default: waiting since then, so bots fill a minute after that at the latest (never sooner than switchMinWaitMs). */
  since?: number;
}

/**
 * PLAY: one Durable Object per queue (mode and matchmaking type, and region when CAPACITY.queue.byRegion is on).
 * Default: players join the lobby that's filling until it's full or a minute has passed since it opened, then it
 * starts with bots in the empty seats and the next players get a new lobby. Bots off: it waits until full (a raid: see
 * MATCHMAKING). Solo never comes here. Unranked; ranked queues plug their rules into `rules` (queue.ts).
 *
 * Built for surges (DECISIONS.md, "Capacity: built"): PLAY presses are tickets in memory, seated in batches with one
 * seat reservation per lobby per batch, never one cross-object call per player inside a lock. A surge past the
 * admission rate, or past the overload limit, waits in line and is told about how long.
 */
export class Matchmaker extends DurableObject<Env> {
  protected q = new QueueCore();
  /** How long a PLAY request waits for a seat before "busy" (CAPACITY.queue.holdMs; tests shorten it). */
  protected holdMs: number = CAPACITY.queue.holdMs;
  /** Players whose request is waiting for a seat. */
  private waiters = new Map<string, (code: string) => void>();
  /** The lobby filling up, per group of the rules ("all" for unranked). */
  private current = new Map<string, string>();
  private forming: Promise<void> | null = null;
  private again: ReturnType<typeof setTimeout> | null = null;
  private lobbyOptions: { overrides: LobbyRecord["overrides"]; fillMs: number; botsOff: boolean; crowdWaitsForFull: boolean } = {
    overrides: {},
    fillMs: 60_000,
    botsOff: false,
    crowdWaitsForFull: false,
  };
  private players: { at: number; n: number } = { at: 0, n: 0 };
  /** The matching rules (ranked replaces these). */
  protected rules: MatchRules = FILL_IN_ORDER;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Record<string, string> | string>("current");
      // (Before batches, one code was stored as a plain string.)
      if (typeof stored === "string") this.current.set("all", stored);
      else if (stored) for (const [k, v] of Object.entries(stored)) this.current.set(k, v);
    });
  }

  /** PLAY (or a player in line asking again with their ticket). `info`: for matching rules (ranked). */
  async next(overrides: LobbyRecord["overrides"], fillMs: number, opts: PlayOptions = {}, ticketId?: string | null, info?: Record<string, unknown>): Promise<PlayAnswer> {
    countCall("mm.next");
    this.lobbyOptions = { overrides, fillMs, botsOff: !!opts.botsOff, crowdWaitsForFull: !!opts.crowdWaitsForFull };
    const now = Date.now();
    const t = this.q.enqueue(ticketId, now, opts.since !== undefined ? { ...info, since: opts.since } : info);
    const done = this.q.placedIn(t.id);
    if (done) return { code: done, ticket: t.id };
    const seated = new Promise<string>((resolve) => this.waiters.set(t.id, resolve));
    this.kick();
    const code = await Promise.race([seated, sleep(this.holdMs).then(() => null)]);
    this.waiters.delete(t.id);
    if (code) return { code, ticket: t.id };
    // Placed just now, after the wait ran out?
    const late = this.q.placedIn(t.id);
    if (late) return { code: late, ticket: t.id };
    countCall("mm.busy");
    const waitSeconds = this.q.estimateSeconds(t.id, Date.now(), this.players.n);
    return { busy: true, ticket: t.id, position: this.q.position(t.id), waitSeconds, retryMs: CAPACITY.queue.retryMs, message: busyMessage(waitSeconds) };
  }

  /** Starts a batch now, unless one is running (it picks up whoever arrived meanwhile when it's done). */
  private kick() {
    if (this.forming) return;
    let held = false;
    this.forming = this.form()
      .then((h) => void (held = h))
      .catch((e) => console.log(`matchmaker: ${String(e)}`))
      .finally(() => {
        this.forming = null;
        if (!this.q.waiting) return;
        // Arrived as the batch finished: at once. Held back by the rate or the player cap: again shortly.
        if (!held) return this.kick();
        if (!this.again) {
          this.again = setTimeout(() => {
            this.again = null;
            this.kick();
          }, CAPACITY.queue.formEveryMs);
        }
      });
  }

  /** People in lobbies now (for the overload limit), from the live hub, at most every 2 s. */
  private async playersNow(now: number): Promise<number> {
    if (this.env.LIVE && now - this.players.at > 2_000) {
      this.players = { at: now, n: await liveHub(this.env).players().catch(() => this.players.n) };
    }
    return this.players.n;
  }

  /** Seats everyone admissible, in batches, until the line is empty (false) or held back (true). */
  private async form(): Promise<boolean> {
    for (;;) {
      const now = Date.now();
      const groups = this.q.admit(now, await this.playersNow(now), this.rules);
      if (!groups.length) return this.q.waiting > 0;
      countCall("mm.batch");
      for (const g of groups) if (!(await this.seat(g.key, g.tickets))) return true;
    }
  }

  /** Seats a group: the seats left in its filling lobby first, then new lobbies. */
  private async seat(key: string, tickets: Ticket[]): Promise<boolean> {
    let rest = tickets;
    const code = this.current.get(key);
    if (code) {
      countCall("mm.reserve");
      const got = await this.lobby(code)
        .reserve(rest.length, CAPACITY.queue.reservationMs)
        .catch(() => 0);
      if (got > 0) {
        const placed = rest.slice(0, got);
        // Someone switching from Bots off: bots fill a minute after they first joined, at the latest.
        const since = earliestSince(placed);
        if (since !== undefined) await this.lobby(code).hurry(since + this.lobbyOptions.fillMs).catch(() => undefined);
        this.placeAll(placed, code);
        rest = rest.slice(got);
      }
    }
    while (rest.length) {
      const { overrides, fillMs, botsOff, crowdWaitsForFull } = this.lobbyOptions;
      let granted: number | boolean = false;
      countCall("mm.create");
      const want = rest.length;
      // When bots fill (Default), or when a raid may begin with fewer (Bots off); a Bots off 50 v 50 waits until full.
      // A switcher among those it will seat brings the fill time forward (their wait counts).
      const now = Date.now();
      const since = earliestSince(rest.slice(0, Number(overrides?.lobbySize ?? DEFAULT_SETTINGS.lobbySize)));
      const fillAt = botsOff
        ? crowdWaitsForFull
          ? null
          : now + fillMs
        : since !== undefined
          ? Math.min(now + fillMs, Math.max(now + MATCHMAKING.switchMinWaitMs, since + fillMs))
          : now + fillMs;
      // A fresh code: one whose lobby is still open (a match, or its results) is never handed out.
      const fresh = await openLobbyCode(async (c) => {
        granted = await this.lobby(c).create(c, overrides, { fillAt, botsOff, reserve: want, reserveMs: CAPACITY.queue.reservationMs });
        return granted !== false;
      });
      if (!fresh || !granted) {
        // Couldn't open one: they wait in line for the next batch.
        countCall("mm.createFailed");
        this.q.putBack(rest);
        return false;
      }
      this.current.set(key, fresh);
      await this.ctx.storage.put("current", Object.fromEntries(this.current));
      const n = granted === true ? want : granted;
      this.placeAll(rest.slice(0, n), fresh);
      rest = rest.slice(n);
    }
    return true;
  }

  private placeAll(tickets: Ticket[], code: string) {
    this.q.place(tickets, code, Date.now());
    for (const t of tickets) this.waiters.get(t.id)?.(code);
  }

  private lobby(code: string) {
    return this.env.LOBBIES.get(this.env.LOBBIES.idFromName(code));
  }
}

/** The earliest Bots-off wait among these tickets (players switching to Default), if any. */
function earliestSince(tickets: Ticket[]): number | undefined {
  const xs = tickets.map((t) => t.info?.since).filter((x): x is number => typeof x === "number");
  return xs.length ? Math.min(...xs) : undefined;
}
