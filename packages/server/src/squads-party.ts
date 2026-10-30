import { BOSS_DIFFICULTY, BOSS_PARTY, SQUADS, SQUADS_LOBBY, cleanLook, type BossDifficultyId, type ItemLook } from "@chessroyale/core";
import type { LobbyCloseReason } from "@chessroyale/chess";
import { seatName } from "./text-filter.ts";
import { SQUADS_PROTOCOL, type NetParty, type PartyClientMessage, type PartyServerMessage } from "@chessroyale/chess/squads";

/**
 * A Squads party, as pure logic (docs/areas/squads.md, "Parties"): the smallest party that works. Up to
 * SQUADS.partyMax friends gather under a code (the invite link is /squads/party/CODE); the leader queues them; the
 * matchmaker finds a lobby with seats for all of them, held under a pass; everyone connected is told the lobby and
 * the pass, and joins it into one squad. After that lobby, the leader can queue again. One Durable Object per party
 * (squads-do.ts) runs this and asks the matchmaker.
 */

export type PartyOutgoing = PartyServerMessage extends infer M ? (M extends { now: number } ? Omit<M, "now"> : never) : never;

export interface PartyIO {
  now(): number;
  send(memberId: string, msg: PartyOutgoing): void;
  /** Closes a member's sockets (someone kicked). */
  close?(memberId: string): void;
  /** A random pass or token (crypto in the Worker). */
  random?(): string;
}

export interface PartyMember {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  device: "phone" | "computer";
  joinedAt: number;
  goneAt?: number;
  /** A Boss Battle party: their seat (their color), what they wear, READY, and whether they're a bot (admins' tests). */
  seat?: number;
  look?: ItemLook;
  ready?: boolean;
  bot?: true;
  /** Their account (a Boss Battle party: a kick bans the account; the battle admits only it to their seat). */
  userId?: string;
}

/** What START asks the party's Durable Object to make: the battle, a lobby for these members (boss-party). */
export interface BossStart {
  /** Which START this is (a placement is only ever for its own START). */
  id: number;
  /** The people (bots aside): each with their own pass into their own seat, from their own account. */
  members: { id: string; seat: number; pass: string; userId?: string }[];
  bots: number;
  leaderSeat: number;
  boss: string;
  difficulty: BossDifficultyId;
}

/** Said to someone kicked from a Boss Battle party, at the stage or in its battle. */
export const KICKED = "You were removed from the party.";

export interface PartyRecord {
  v: 1;
  code: string;
  createdAt: number;
  members: PartyMember[];
  leaderId: string | null;
  counter: number;
  state: NetParty["state"];
  /** In line: the matchmaker's ticket, the seats asked for and their pass, and when to ask again. */
  queue?: { ticket: string | null; size: number; pass: string; retryAt: number };
  busy?: NetParty["busy"];
  placed?: NonNullable<NetParty["placed"]>;
  /** The last time anyone did anything (a party nobody is in closes SQUADS_LOBBY.partyIdleMinutes after it). */
  activeAt: number;
  /**
   * A Boss Battle party (docs/decisions/2026-10-30-boss-party.md): up to BOSS_PARTY.max, the leader's boss and
   * difficulty, the tokens of anyone kicked (never back in), and START's battle while the Durable Object makes it.
   */
  kind?: "boss";
  boss?: { id: string; difficulty: BossDifficultyId };
  /** Kicked: their tokens and accounts, never back in. */
  kicked?: string[];
  kickedUsers?: string[];
  starting?: BossStart;
  starts?: number;
  /** Each member's own pass into the battle they were placed in (placed.pass is yours alone in your view). */
  passes?: Record<string, string>;
  /** Members kicked after START, for the Durable Object to revoke in the battle (takeRevokes). */
  revokes?: string[];
}

export function newPartyRecord(code: string, now: number, kind?: "boss"): PartyRecord {
  return { v: 1, code, createdAt: now, members: [], leaderId: null, counter: 0, state: "open", activeAt: now, ...(kind ? { kind, boss: { id: "", difficulty: "normal" } } : {}) };
}

/** When a party closes: with nobody connected, SQUADS_LOBBY.partyIdleMinutes after anyone last did anything. */
export function partyClosing(r: PartyRecord, connected: boolean): { at: number; reason: LobbyCloseReason } | null {
  if (connected) return null;
  return { at: r.activeAt + SQUADS_LOBBY.partyIdleMinutes * 60_000, reason: "idle" };
}

/** How long a party's question to the matchmaker may take before it asks again (its answer comes in a few seconds). */
const PARTY_ASK_MS = 15_000;

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

/** What the matchmaker answers a party (as for PLAY): a lobby, or "busy, you're in line" with the ticket to ask again with. */
export type PartyQueueAnswer =
  | { code: string; ticket?: string }
  | { busy: true; ticket: string; position: number; waitSeconds: number; retryMs: number; message: string };

export class PartyCore {
  constructor(
    public record: PartyRecord,
    private readonly io: PartyIO,
  ) {}

  private get r() {
    return this.record;
  }

  private random(): string {
    return this.io.random?.() ?? hex(12);
  }

  private get max(): number {
    return this.r.kind === "boss" ? BOSS_PARTY.max : SQUADS.partyMax;
  }

  /** The party as `forId` sees it (a Boss Battle party's battle pass is each member's own). */
  view(forId?: string): NetParty {
    const boss = this.r.kind === "boss";
    const placed = this.r.placed ? (boss ? { ...this.r.placed, pass: (forId && this.r.passes?.[forId]) || "" } : { ...this.r.placed }) : null;
    return {
      code: this.r.code,
      leaderId: this.leaderNow(),
      members: this.r.members.map((m) => ({
        id: m.id,
        name: m.name,
        connected: m.connected,
        ...(boss ? { seat: m.seat ?? 0, ready: !!m.ready, ...(m.look && Object.keys(m.look).length ? { look: m.look } : {}), ...(m.bot ? { bot: true as const } : {}) } : {}),
      })),
      max: this.max,
      ...(boss && this.r.boss ? { boss: { ...this.r.boss } } : {}),
      state: this.r.state,
      ...(placed ? { placed } : {}),
      ...(this.r.state === "queueing" && this.r.busy ? { busy: { ...this.r.busy } } : {}),
    };
  }

  private broadcast() {
    const shared: PartyOutgoing | null = this.r.kind === "boss" ? null : { t: "party", party: this.view() };
    for (const m of this.r.members) if (m.connected) this.io.send(m.id, shared ?? { t: "party", party: this.view(m.id) });
  }

  /** The leader: the first to join who's still here (connected), else the first who is (never a bot). */
  leaderNow(): string | null {
    const lead = this.r.members.find((m) => m.id === this.r.leaderId);
    if (lead?.connected) return lead.id;
    const next = this.r.members.find((m) => m.connected && !m.bot);
    if (next) this.r.leaderId = next.id;
    return this.r.leaderId;
  }

  connect(token: string | undefined, opts: { name?: string; device?: "phone" | "computer"; v?: number; look?: unknown; userId?: string }): { ok: true; memberId: string } | { ok: false; message: string } {
    const now = this.io.now();
    this.r.activeAt = now;
    if (opts.v !== SQUADS_PROTOCOL) return { ok: false, message: "Update the app to play Squads (reload the page)." };
    // (Kicked: neither that seat's token nor that account ever comes back in, with a token or without.)
    if ((token && this.r.kicked?.includes(token)) || (opts.userId && this.r.kickedUsers?.includes(opts.userId))) return { ok: false, message: KICKED };
    const existing = token ? this.r.members.find((m) => m.token === token) : undefined;
    if (existing) {
      existing.connected = true;
      delete existing.goneAt;
      if (this.r.kind === "boss" && opts.look !== undefined) existing.look = cleanLook(opts.look);
      this.io.send(existing.id, { t: "welcome", v: SQUADS_PROTOCOL, memberId: existing.id, token: existing.token, code: this.r.code });
      this.broadcast();
      return { ok: true, memberId: existing.id };
    }
    if (this.r.members.length >= this.max) return { ok: false, message: "This party is full." };
    const id = `m${++this.r.counter}`;
    const name = seatName(opts.name, `Player ${this.r.members.length + 1}`);
    const member: PartyMember = { id, name, token: this.random(), connected: true, device: opts.device === "phone" ? "phone" : "computer", joinedAt: now, ...(this.r.kind === "boss" ? { seat: this.freeSeat(), look: cleanLook(opts.look), ...(opts.userId ? { userId: opts.userId } : {}) } : {}) };
    this.r.members.push(member);
    this.r.leaderId ??= id;
    this.io.send(id, { t: "welcome", v: SQUADS_PROTOCOL, memberId: id, token: member.token, code: this.r.code });
    this.broadcast();
    return { ok: true, memberId: id };
  }

  /** A (re)connected member's welcome and the party, again (sent before their socket could be found). */
  resendTo(id: string) {
    const m = this.r.members.find((x) => x.id === id);
    if (!m) return;
    this.io.send(id, { t: "welcome", v: SQUADS_PROTOCOL, memberId: id, token: m.token, code: this.r.code });
    this.io.send(id, { t: "party", party: this.view(id) });
  }

  disconnect(id: string) {
    const m = this.r.members.find((x) => x.id === id);
    if (!m) return;
    m.connected = false;
    m.goneAt = this.io.now();
    this.r.activeAt = this.io.now();
    this.broadcast();
  }

  /** The lowest seat nobody has (a Boss Battle party: seat 0 stands in front on the leader's stage, the others behind). */
  private freeSeat(): number {
    const taken = new Set(this.r.members.map((m) => m.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    return seat;
  }

  message(id: string, msg: PartyClientMessage, opts: { test?: boolean } = {}) {
    if (!this.r.members.some((m) => m.id === id)) return;
    this.r.activeAt = this.io.now();
    if (this.r.kind === "boss") return this.bossMessage(id, msg, !!opts.test);
    switch (msg.t) {
      case "queue":
        return this.startQueue(id);
      case "cancel":
        if (id !== this.leaderNow()) return;
        delete this.r.queue;
        delete this.r.busy;
        delete this.r.placed;
        this.r.state = "open";
        return this.broadcast();
      case "leave": {
        this.r.members = this.r.members.filter((m) => m.id !== id);
        if (this.r.leaderId === id) this.r.leaderId = this.r.members[0]?.id ?? null;
        return this.broadcast();
      }
      case "hello":
        return;
    }
  }

  /**
   * A Boss Battle party's messages (Eric, Oct 29): READY; the leader's Kick, Promote, boss and difficulty (everyone
   * un-readied), and START once every member is ready; admins' bot members; leaving. No queue: START makes the battle.
   */
  private bossMessage(id: string, msg: PartyClientMessage, test: boolean) {
    const leader = this.leaderNow();
    const member = (x: unknown) => (typeof x === "string" ? this.r.members.find((m) => m.id === x) : undefined);
    switch (msg.t) {
      case "ready": {
        const m = member(id)!;
        if (id === leader) return;
        m.ready = msg.on === true;
        return this.broadcast();
      }
      case "look":
        member(id)!.look = cleanLook(msg.look);
        return this.broadcast();
      case "choose": {
        if (id !== leader || typeof msg.boss !== "string" || msg.boss.length > 40 || !BOSS_DIFFICULTY.some((d) => d.id === msg.difficulty)) return;
        const was = this.r.boss;
        if (was?.id === msg.boss && was.difficulty === msg.difficulty) return;
        this.r.boss = { id: msg.boss, difficulty: msg.difficulty };
        // (Any change of boss or difficulty: everyone un-readied; bots stay ready.)
        for (const m of this.r.members) if (!m.bot) m.ready = false;
        return this.broadcast();
      }
      case "kick": {
        const m = member(msg.id);
        if (id !== leader || !m || m.id === id) return;
        return this.remove(m, true);
      }
      case "promote": {
        const m = member(msg.id);
        if (id !== leader || !m || m.bot || !m.connected) return;
        this.r.leaderId = m.id;
        // (The new leader starts: they no longer ready up; the old one now does.)
        m.ready = false;
        return this.broadcast();
      }
      case "bot": {
        if (!test || id !== leader) return;
        if (msg.add) {
          if (this.r.members.length >= this.max) return;
          const n = this.r.members.filter((m) => m.bot).length + 1;
          this.r.members.push({ id: `m${++this.r.counter}`, name: `Bot ${n}`, token: this.random(), connected: true, device: "computer", joinedAt: this.io.now(), seat: this.freeSeat(), ready: true, bot: true });
        } else {
          const last = [...this.r.members].reverse().find((m) => m.bot);
          if (last) this.r.members = this.r.members.filter((m) => m !== last);
        }
        return this.broadcast();
      }
      case "start":
        return this.startBattle(id);
      case "leave": {
        const m = member(id)!;
        return this.remove(m, false);
      }
      case "cancel":
      case "queue":
      case "hello":
        return;
    }
  }

  /**
   * Someone out of a Boss Battle party: kicked (their token and account never come back in; told so, their socket
   * closed; after START, their pass into the battle revoked: takeRevokes) or leaving.
   */
  private remove(m: PartyMember, kicked: boolean) {
    if (kicked) {
      this.r.kicked = [...(this.r.kicked ?? []), m.token];
      if (m.userId) this.r.kickedUsers = [...(this.r.kickedUsers ?? []), m.userId];
      if (m.connected && !m.bot) {
        this.io.send(m.id, { t: "error", message: KICKED, ended: true });
        this.io.close?.(m.id);
      }
      // (A battle being made just now: placedIn revokes them in it once it's there.)
      if (this.r.passes?.[m.id]) this.r.revokes = [...(this.r.revokes ?? []), m.id];
    }
    if (this.r.passes) delete this.r.passes[m.id];
    this.r.members = this.r.members.filter((x) => x !== m);
    if (this.r.leaderId === m.id) this.r.leaderId = this.r.members.find((x) => !x.bot)?.id ?? null;
    this.broadcast();
  }

  /** Their battle kicked them (its AFK kick): out of the party too, by their member id (never a seat someone else took since). */
  kickMember(id: string) {
    const m = this.r.members.find((x) => x.id === id);
    if (m) this.remove(m, true);
  }

  /** Members kicked after START, for the Durable Object to revoke in the battle (once each). */
  takeRevokes(): { lobby: string | null; members: string[] } | null {
    const r = this.r.revokes;
    if (!r?.length) return null;
    delete this.r.revokes;
    return { lobby: this.r.placed?.lobby ?? null, members: r };
  }

  /** The members who must be ready for START: everyone connected but the leader (bots always are). */
  private notReady(): PartyMember[] {
    const leader = this.leaderNow();
    return this.r.members.filter((m) => m.id !== leader && m.connected && !m.ready);
  }

  /** The leader's START: every member ready (the battle is made by the Durable Object: takeStart). */
  private startBattle(id: string) {
    if (id !== this.leaderNow() || this.r.starting || this.notReady().length) return;
    const people = this.r.members.filter((m) => m.connected && !m.bot);
    const lead = this.r.members.find((m) => m.id === id)!;
    this.r.starts = (this.r.starts ?? 0) + 1;
    this.r.starting = {
      id: this.r.starts,
      members: people.map((m) => ({ id: m.id, seat: m.seat ?? 0, pass: this.random(), ...(m.userId ? { userId: m.userId } : {}) })),
      bots: this.r.members.filter((m) => m.bot).length,
      leaderSeat: lead.seat ?? 0,
      boss: this.r.boss?.id ?? "",
      difficulty: this.r.boss?.difficulty ?? "normal",
    };
  }

  /** START's battle to make (the Durable Object makes the lobby, one at a time, then calls placedIn with its START's id). */
  takeStart(): BossStart | null {
    return this.r.starting ?? null;
  }

  /**
   * START `id`'s battle is made (`lobby`), or couldn't be (null): everyone's told where to go (each their own pass), and
   * un-readied for the next. An answer for any other START (a late one) changes nothing.
   */
  placedIn(lobby: string | null, id?: number) {
    const s = this.r.starting;
    if (!s || (id !== undefined && id !== s.id)) return;
    delete this.r.starting;
    if (!lobby) {
      for (const m of this.r.members) if (m.connected && !m.bot) this.io.send(m.id, { t: "error", message: "Couldn't start the battle. Try again." });
      return this.broadcast();
    }
    this.r.state = "placed";
    this.r.placed = { lobby, pass: "", at: this.io.now() };
    this.r.passes = Object.fromEntries(s.members.filter((m) => this.r.members.some((x) => x.id === m.id)).map((m) => [m.id, m.pass]));
    // (Kicked or gone while it was being made: their passes revoked in it.)
    const dropped = s.members.filter((m) => !this.r.members.some((x) => x.id === m.id)).map((m) => m.id);
    if (dropped.length) this.r.revokes = [...(this.r.revokes ?? []), ...dropped];
    for (const m of this.r.members) if (!m.bot) m.ready = false;
    this.broadcast();
  }

  /** The leader queues everyone connected: seats for them all under a new pass (again after a lobby: a new one). */
  private startQueue(id: string) {
    if (id !== this.leaderNow() || this.r.state === "queueing") return;
    const size = this.r.members.filter((m) => m.connected).length;
    if (size < 1) return;
    this.r.state = "queueing";
    delete this.r.placed;
    delete this.r.busy;
    this.r.queue = { ticket: null, size, pass: this.random(), retryAt: this.io.now() };
    this.broadcast();
  }

  /**
   * In line and due to ask the matchmaker (now or at its retry time): what to ask for. Taking it puts the next try a
   * while off (the answer sets it properly), so a lost answer is asked again, never in a tight loop.
   */
  takeQueue(): { ticket: string | null; size: number; pass: string } | null {
    const q = this.r.queue;
    if (this.r.state !== "queueing" || !q || q.retryAt > this.io.now()) return null;
    q.retryAt = this.io.now() + PARTY_ASK_MS;
    return { ticket: q.ticket, size: q.size, pass: q.pass };
  }

  /** When to ask again (the Durable Object's alarm). */
  get nextAlarm(): number | null {
    return this.r.state === "queueing" && this.r.queue ? this.r.queue.retryAt : null;
  }

  /** The matchmaker's answer for the pass asked with: placed (everyone is told the lobby), or busy (ask again). */
  answered(pass: string, a: PartyQueueAnswer | null) {
    const q = this.r.queue;
    if (this.r.state !== "queueing" || !q || q.pass !== pass) return;
    if (a && "code" in a) {
      this.r.state = "placed";
      this.r.placed = { lobby: a.code, pass: q.pass, at: this.io.now() };
      delete this.r.queue;
      delete this.r.busy;
    } else {
      if (a) {
        q.ticket = a.ticket;
        this.r.busy = { position: a.position, waitSeconds: a.waitSeconds, message: a.message };
      }
      q.retryAt = this.io.now() + (a?.retryMs ?? SQUADS_LOBBY.partyRetryMs);
    }
    this.broadcast();
  }
}
