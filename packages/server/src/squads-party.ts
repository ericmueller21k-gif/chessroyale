import { SQUADS, SQUADS_LOBBY } from "@chessroyale/core";
import type { LobbyCloseReason } from "@chessroyale/chess";
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
}

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
}

export function newPartyRecord(code: string, now: number): PartyRecord {
  return { v: 1, code, createdAt: now, members: [], leaderId: null, counter: 0, state: "open", activeAt: now };
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

  view(): NetParty {
    return {
      code: this.r.code,
      leaderId: this.leaderNow(),
      members: this.r.members.map((m) => ({ id: m.id, name: m.name, connected: m.connected })),
      max: SQUADS.partyMax,
      state: this.r.state,
      ...(this.r.placed ? { placed: { ...this.r.placed } } : {}),
      ...(this.r.state === "queueing" && this.r.busy ? { busy: { ...this.r.busy } } : {}),
    };
  }

  private broadcast() {
    const msg: PartyOutgoing = { t: "party", party: this.view() };
    for (const m of this.r.members) if (m.connected) this.io.send(m.id, msg);
  }

  /** The leader: the first to join who's still here (connected), else the first who is. */
  leaderNow(): string | null {
    const lead = this.r.members.find((m) => m.id === this.r.leaderId);
    if (lead?.connected) return lead.id;
    const next = this.r.members.find((m) => m.connected);
    if (next) this.r.leaderId = next.id;
    return this.r.leaderId;
  }

  connect(token: string | undefined, opts: { name?: string; device?: "phone" | "computer"; v?: number }): { ok: true; memberId: string } | { ok: false; message: string } {
    const now = this.io.now();
    this.r.activeAt = now;
    if (opts.v !== SQUADS_PROTOCOL) return { ok: false, message: "Update the app to play Squads (reload the page)." };
    const existing = token ? this.r.members.find((m) => m.token === token) : undefined;
    if (existing) {
      existing.connected = true;
      delete existing.goneAt;
      this.io.send(existing.id, { t: "welcome", v: SQUADS_PROTOCOL, memberId: existing.id, token: existing.token, code: this.r.code });
      this.broadcast();
      return { ok: true, memberId: existing.id };
    }
    if (this.r.members.length >= SQUADS.partyMax) return { ok: false, message: "This party is full." };
    const id = `m${++this.r.counter}`;
    const name = (opts.name ?? "").replace(/\s+/g, " ").trim().slice(0, 16) || `Player ${this.r.members.length + 1}`;
    const member: PartyMember = { id, name, token: this.random(), connected: true, device: opts.device === "phone" ? "phone" : "computer", joinedAt: now };
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
    this.io.send(id, { t: "party", party: this.view() });
  }

  disconnect(id: string) {
    const m = this.r.members.find((x) => x.id === id);
    if (!m) return;
    m.connected = false;
    m.goneAt = this.io.now();
    this.r.activeAt = this.io.now();
    this.broadcast();
  }

  message(id: string, msg: PartyClientMessage) {
    if (!this.r.members.some((m) => m.id === id)) return;
    this.r.activeAt = this.io.now();
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
