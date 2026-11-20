import { BOSS_DIFFICULTY, BOSS_PARTY, CROWD_PARTY, CROWD_PARTY_MAX, SQUADS, SQUADS_LOBBY, TOWER_PARTY, TOWN_CHAT, cleanLook, type BossDifficultyId, type ItemLook } from "@chessroyale/core";
import type { LobbyCloseReason } from "@chessroyale/chess";
import { seatName } from "./text-filter.ts";
import { SQUADS_PROTOCOL, type NetParty, type NetTowerPlan, type PartyClientMessage, type PartyServerMessage } from "@chessroyale/chess/squads";

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
  /**
   * Their account (a Boss Battle party: View profile; a kick bans the account; the battle admits only it to their seat. A Squads
   * party: whether it queues in fair play's engine pool, squads-do.ts).
   */
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

/** A Battle Tower party's plan's words while it can't start (docs/decisions/2026-11-20-tower-party.md). */
export const TOWER_PARTY_LINES = {
  needTwo: "A party climbs with two or more. Invite a friend, or open the party to the town.",
  reading: "Reading everyone's climbs…",
  /** Open party again too soon (TOWER_PARTY.openGapMs: the review of #835, finding 2). */
  openWait: (ms: number) => `You can open a party to the town once a minute. Try again in ${Math.max(1, Math.ceil(ms / 1000))} s.`,
} as const;

/**
 * A Battle Tower party's plan as worked out from its people's copies (server tower.ts partyPlan; the Durable Object reads them):
 * for the people it was read for (`key`, their accounts in seat order), what START does, by account; or why it can't yet.
 */
export type TowerPartyPlan = {
  key: string;
  plan: { kind: "continue"; floor: number; back?: { uid: string; floor: number }[] } | { kind: "new"; ends: { uid: string; floor: number }[] } | { kind: "wait"; message: string };
};

/** A 50 v 50 party's refusals (docs/decisions/2026-11-16-crowd-party.md): it's friends only, by invite. */
export const CROWD_PARTY_LINES = {
  invitedOnly: "That invite has lapsed. Ask them to invite you again.",
  searching: "Your friends are already looking for a match. Ask them to cancel and invite you again.",
  full: "This party is full.",
  notMember: "Join the party first, then invite friends.",
  noRoom: "Your party is full.",
  inParty: "They're already in your party.",
} as const;

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
  kind?: "boss" | "crowd" | "tower";
  boss?: { id: string; difficulty: BossDifficultyId };
  /**
   * A Battle Tower party (Nov 20): Boss Battle's party for up to TOWER_PARTY.max (one seat an account, no bots), its plan (what START
   * does, the Durable Object's read of everyone's copies: `plan`), and its line in the town's chat while it stands (`open`: its number
   * there, null while it's being posted).
   */
  tower?: { plan: TowerPartyPlan | null; open?: { line: number | null; at: number; by: string; room: string }; recheckAt?: number; win?: true };
  /**
   * A 50 v 50 party (Nov 16): the account that made it (the first in), and its open invites (each friend's account, name, who
   * invited them and when it lapses): only those accounts get in.
   */
  owner?: string;
  invited?: { uid: string; name: string; from: string; expiresAt: number }[];
  /** A 50 v 50 party's search stopped (its leader's Cancel, or nobody left in it) with a matchmaker's ticket: out of its line (L5). */
  dropTickets?: string[];
  /** A 50 v 50 party's last search stopped because everyone was away (`awayStopMs`): its screen says so until the next Find match (N5). */
  awayStopped?: true;
  /** Kicked: their tokens and accounts, never back in. */
  kicked?: string[];
  kickedUsers?: string[];
  starting?: BossStart;
  starts?: number;
  /** Each member's own pass into the battle they were placed in (placed.pass is yours alone in your view). */
  passes?: Record<string, string>;
  /** The START the current `placed` battle is from (a revoke names it; the battle ignores one for another START). */
  placedStart?: number;
  /** Members kicked after START, for the Durable Object to revoke in the battle (takeRevokes). */
  revokes?: string[];
}

/** A 50 v 50 party: whether `userId` would come in by an invite (not a member yet, nor its maker coming in first). */
export function needsCrowdInvite(r: PartyRecord, userId: string): boolean {
  return r.kind === "crowd" && !r.members.some((m) => m.userId === userId) && !(r.counter === 0 && (!r.owner || r.owner === userId));
}

export function newPartyRecord(code: string, now: number, kind?: "boss" | "crowd" | "tower", owner?: string): PartyRecord {
  return {
    v: 1,
    code,
    createdAt: now,
    members: [],
    leaderId: null,
    counter: 0,
    state: "open",
    activeAt: now,
    ...(kind === "boss" ? { kind, boss: { id: "", difficulty: "normal" as const } } : kind === "crowd" ? { kind, invited: [], ...(owner ? { owner } : {}) } : kind === "tower" ? { kind, tower: { plan: null } } : {}),
  };
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
    return this.r.kind === "boss" ? BOSS_PARTY.max : this.r.kind === "crowd" ? CROWD_PARTY_MAX : this.r.kind === "tower" ? TOWER_PARTY.max : SQUADS.partyMax;
  }

  /** A Boss Battle or Battle Tower party: seats, READY, START, Kick and Promote (bossMessage). */
  private get seated(): boolean {
    return this.r.kind === "boss" || this.r.kind === "tower";
  }

  /** A 50 v 50 party's open invites (lapsed ones dropped). */
  private openInvites(): NonNullable<PartyRecord["invited"]> {
    const now = this.io.now();
    const open = (this.r.invited ?? []).filter((i) => i.expiresAt > now);
    if (this.r.invited && open.length !== this.r.invited.length) this.r.invited = open;
    return open;
  }

  /** The party as `forId` sees it (a Boss Battle party's battle pass is each member's own). */
  view(forId?: string): NetParty {
    const boss = this.seated;
    const crowd = this.r.kind === "crowd";
    const tower = this.r.kind === "tower";
    const placed = this.r.placed ? (boss ? { ...this.r.placed, pass: (forId && this.r.passes?.[forId]) || "" } : { ...this.r.placed }) : null;
    const look = (m: PartyMember) => (m.look && Object.keys(m.look).length ? { look: m.look } : {});
    return {
      code: this.r.code,
      leaderId: this.leaderNow(),
      members: this.r.members.map((m) => ({
        id: m.id,
        name: m.name,
        connected: m.connected,
        ...(boss ? { seat: m.seat ?? 0, ready: !!m.ready, ...look(m), ...(m.bot ? { bot: true as const } : {}), ...(m.userId ? { uid: m.userId } : {}) } : {}),
        ...(crowd ? { ...look(m), ...(m.userId ? { uid: m.userId } : {}) } : {}),
      })),
      max: this.max,
      ...(boss && this.r.boss ? { boss: { ...this.r.boss } } : {}),
      ...(crowd ? { kind: "crowd" as const, invited: this.openInvites().map(({ uid, name, expiresAt }) => ({ uid, name, expiresAt })) } : {}),
      ...(tower ? { kind: "tower" as const, tower: { plan: this.towerPlanView(), open: !!this.r.tower?.open, ...(this.towerFloorOn ? { floor: true as const } : {}) } } : {}),
      state: this.r.state,
      ...(placed ? { placed } : {}),
      ...(this.r.state === "queueing" && this.r.busy ? { busy: { ...this.r.busy } } : {}),
      ...(crowd && this.r.awayStopped && this.r.state === "open" ? { stopped: "away" as const } : {}),
    };
  }

  private broadcast() {
    const shared: PartyOutgoing | null = this.seated ? null : { t: "party", party: this.view() };
    for (const m of this.r.members) if (m.connected) this.io.send(m.id, shared ?? { t: "party", party: this.view(m.id) });
  }

  /**
   * The leader: the first to join who's still here (connected), else the first who is (never a bot). A 50 v 50 party's leader who
   * dropped (a reload) keeps the lead CROWD_PARTY.leadHoldMs first (the fix round of #747, M2).
   */
  leaderNow(): string | null {
    const lead = this.r.members.find((m) => m.id === this.r.leaderId);
    if (lead?.connected) return lead.id;
    if (lead && this.leadHeldUntil() !== null) return lead.id;
    const next = this.r.members.find((m) => m.connected && !m.bot);
    if (next) this.r.leaderId = next.id;
    return this.r.leaderId;
  }

  /** A 50 v 50 party's leader away (dropped, not left): until when they keep the lead; null when they don't (or aren't away). */
  private leadHeldUntil(): number | null {
    if (this.r.kind !== "crowd") return null;
    const lead = this.r.members.find((m) => m.id === this.r.leaderId);
    if (!lead || lead.connected || lead.goneAt === undefined) return null;
    const until = lead.goneAt + CROWD_PARTY.leadHoldMs;
    return until > this.io.now() ? until : null;
  }

  /**
   * A 50 v 50 party's search with nobody in it connected for CROWD_PARTY.awayStopMs (everyone gone or left): it stops, its ticket
   * out of the matchmaker's line, so it never holds seats for nobody (L5).
   */
  private stopIfDeserted(): boolean {
    if (this.r.kind !== "crowd" || this.r.state !== "queueing") return false;
    const now = this.io.now();
    if (!this.r.members.every((m) => !m.connected && now - (m.goneAt ?? 0) >= CROWD_PARTY.awayStopMs)) return false;
    this.stopSearch();
    this.r.awayStopped = true;
    return true;
  }

  /** Back to idle: no search, no placing (a 50 v 50 party's ticket still in line: dropped, `takeDropTickets`). */
  private stopSearch() {
    const ticket = this.r.kind === "crowd" && this.r.state === "queueing" ? this.r.queue?.ticket : null;
    if (ticket) this.r.dropTickets = [...(this.r.dropTickets ?? []), ticket];
    delete this.r.queue;
    delete this.r.busy;
    delete this.r.placed;
    this.r.state = "open";
  }

  /** A 50 v 50 party's tickets to take out of the matchmaker's line (the Durable Object cancels them in both queues). */
  takeDropTickets(): string[] {
    const t = this.r.dropTickets ?? [];
    delete this.r.dropTickets;
    return t;
  }

  /** The alarm: a 50 v 50 party's lead passed on once its away leader's hold ends; a deserted search stopped. */
  tick() {
    if (this.r.kind !== "crowd") return;
    const was = this.r.leaderId;
    const stopped = this.stopIfDeserted();
    if (this.leaderNow() !== was || stopped) this.broadcast();
  }

  connect(token: string | undefined, opts: { name?: string; device?: "phone" | "computer"; v?: number; look?: unknown; userId?: string }): { ok: true; memberId: string } | { ok: false; message: string } {
    const now = this.io.now();
    this.r.activeAt = now;
    if (opts.v !== SQUADS_PROTOCOL) return { ok: false, message: "Update the app to play Squads (reload the page)." };
    // (Kicked: neither that seat's token nor that account ever comes back in, with a token or without.)
    if ((token && this.r.kicked?.includes(token)) || (opts.userId && this.r.kickedUsers?.includes(opts.userId))) return { ok: false, message: KICKED };
    const crowd = this.r.kind === "crowd";
    // (A 50 v 50 or Battle Tower party: one seat per account, as a lobby's; another tab or device of a member takes over their seat. A
    // tower party's seat is its account's run copy.)
    const byAccount = crowd || this.r.kind === "tower";
    const existing = byAccount && opts.userId ? this.r.members.find((m) => m.userId === opts.userId) : token ? this.r.members.find((m) => m.token === token) : undefined;
    if (existing) {
      existing.connected = true;
      delete existing.goneAt;
      if ((this.seated || crowd) && opts.look !== undefined) existing.look = cleanLook(opts.look);
      this.io.send(existing.id, { t: "welcome", v: SQUADS_PROTOCOL, memberId: existing.id, token: existing.token, code: this.r.code });
      this.broadcast();
      return { ok: true, memberId: existing.id };
    }
    if (this.r.members.length >= this.max) return { ok: false, message: "This party is full." };
    // (A Battle Tower party's seat holds its account's copy of the climb: an account, always.)
    if (this.r.kind === "tower" && !opts.userId) return { ok: false, message: "Sign in to climb with a party." };
    // A 50 v 50 party: friends only (Eric, Nov 16): its maker first, then only an account a member invited (no codes, no links).
    if (crowd) {
      if (this.r.state === "queueing") return { ok: false, message: CROWD_PARTY_LINES.searching };
      const first = this.r.counter === 0 && (!this.r.owner || this.r.owner === opts.userId);
      if (!opts.userId || (!first && !this.openInvites().some((i) => i.uid === opts.userId))) return { ok: false, message: CROWD_PARTY_LINES.invitedOnly };
      this.r.invited = this.openInvites().filter((i) => i.uid !== opts.userId);
    }
    const id = `m${++this.r.counter}`;
    const name = seatName(opts.name, `Player ${this.r.members.length + 1}`);
    const member: PartyMember = {
      id,
      name,
      token: this.random(),
      connected: true,
      device: opts.device === "phone" ? "phone" : "computer",
      joinedAt: now,
      ...(this.seated ? { seat: this.freeSeat(), look: cleanLook(opts.look) } : crowd ? { look: cleanLook(opts.look) } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
    };
    this.r.members.push(member);
    this.r.leaderId ??= id;
    this.io.send(id, { t: "welcome", v: SQUADS_PROTOCOL, memberId: id, token: member.token, code: this.r.code });
    this.broadcast();
    return { ok: true, memberId: id };
  }

  /**
   * A 50 v 50 party: `from` (a member's account) invites the friend `to` (the friends API sends the invite itself, after this
   * says yes, then calls invited()). Not while it's looking for a match; only while there's a seat for them (members and open
   * invites count); asking again for someone invited already is fine.
   */
  mayInvite(from: string, to: string): { ok: true } | { ok: false; message: string } {
    if (this.r.kind !== "crowd") return { ok: false, message: CROWD_PARTY_LINES.notMember };
    if (!this.r.members.some((m) => m.userId === from)) return { ok: false, message: CROWD_PARTY_LINES.notMember };
    if (this.r.members.some((m) => m.userId === to)) return { ok: false, message: CROWD_PARTY_LINES.inParty };
    if (this.r.state === "queueing") return { ok: false, message: "Cancel the search first, then invite them." };
    const open = this.openInvites();
    if (!open.some((i) => i.uid === to) && this.r.members.length + open.length >= this.max) return { ok: false, message: CROWD_PARTY_LINES.noRoom };
    return { ok: true };
  }

  /** The invite went out: their seat shows "…" until they come, decline or it lapses (`expiresAt`, as the invite's). */
  invited(from: string, to: string, name: string, expiresAt: number) {
    if (this.r.kind !== "crowd" || !this.mayInvite(from, to).ok) return;
    this.r.activeAt = this.io.now();
    this.r.invited = [...this.openInvites().filter((i) => i.uid !== to), { uid: to, name: seatName(name, "Friend"), from, expiresAt }];
    this.broadcast();
  }

  /** Declined (or dismissed): their seat is a "+" again. A member already: nothing. */
  uninvited(to: string) {
    if (this.r.kind !== "crowd" || !this.r.invited?.some((i) => i.uid === to)) return;
    this.r.invited = this.r.invited.filter((i) => i.uid !== to);
    this.broadcast();
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
    if (this.seated) return this.bossMessage(id, msg, !!opts.test);
    switch (msg.t) {
      case "queue":
        return this.startQueue(id);
      case "cancel":
        if (id !== this.leaderNow()) return;
        this.stopSearch();
        return this.broadcast();
      case "leave": {
        this.r.members = this.r.members.filter((m) => m.id !== id);
        if (this.r.leaderId === id) this.r.leaderId = this.r.members[0]?.id ?? null;
        // (A 50 v 50 party's last one here leaving: its search stops.)
        this.stopIfDeserted();
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
        if (this.r.kind !== "boss" || id !== leader || typeof msg.boss !== "string" || msg.boss.length > 40 || !BOSS_DIFFICULTY.some((d) => d.id === msg.difficulty)) return;
        const was = this.r.boss;
        if (was?.id === msg.boss && was.difficulty === msg.difficulty) return;
        this.r.boss = { id: msg.boss, difficulty: msg.difficulty };
        // (Any change of boss or difficulty: everyone un-readied; bots stay ready.)
        for (const m of this.r.members) if (!m.bot) m.ready = false;
        return this.broadcast();
      }
      case "kick": {
        const m = member(msg.id);
        // (A Battle Tower party's floor under way: no Kick until it ends (the director's call on the review of #835, finding 6): a kick
        // there is a leave, a loss after the party's 2nd move, so a leader could end a member's climb. The match's AFK kick still applies.)
        if (id !== leader || !m || m.id === id || this.towerFloorOn) return;
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
        // (A Battle Tower party's seats are accounts' copies of the climb: no bots.)
        if (!test || id !== leader || this.r.kind === "tower") return;
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
        return this.startBattle(id, msg.confirm === true);
      case "open":
        return this.openParty(id, typeof msg.room === "string" ? msg.room : "town");
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
  private remove(m: PartyMember, kicked: boolean, revoke = true) {
    if (kicked) {
      this.r.kicked = [...(this.r.kicked ?? []), m.token];
      if (m.userId) this.r.kickedUsers = [...(this.r.kickedUsers ?? []), m.userId];
      if (m.connected && !m.bot) {
        this.io.send(m.id, { t: "error", message: KICKED, ended: true });
        this.io.close?.(m.id);
      }
      // (A battle being made just now: placedIn revokes them in it once it's there.)
      if (revoke && this.r.passes?.[m.id]) this.r.revokes = [...(this.r.revokes ?? []), m.id];
    }
    if (this.r.passes) delete this.r.passes[m.id];
    this.r.members = this.r.members.filter((x) => x !== m);
    if (this.r.leaderId === m.id) this.r.leaderId = this.r.members.find((x) => !x.bot)?.id ?? null;
    this.broadcast();
  }

  /**
   * Their battle kicked them (its AFK kick): out of the party too, by their member id (never a seat someone else took
   * since). They're already out of that battle: nothing to revoke there (and nobody else's pending revoke is touched).
   */
  kickMember(id: string) {
    const m = this.r.members.find((x) => x.id === id);
    if (m) this.remove(m, true, false);
  }

  /** The battle from START `id` is over: its passes go (a later kick has nothing to revoke there). */
  battleOver(id: number) {
    if (this.r.placedStart !== id) return;
    delete this.r.passes;
    delete this.r.revokes;
    // (A Battle Tower party's floor is over: everyone's copies have moved on; the plan is read again.)
    this.towerReread();
  }

  /** Members kicked after START, for the Durable Object to revoke in the battle (once each), with that battle's START. */
  takeRevokes(): { lobby: string | null; start: number; members: string[] } | null {
    const r = this.r.revokes;
    if (!r?.length) return null;
    delete this.r.revokes;
    return { lobby: this.r.placed?.lobby ?? null, start: this.r.placedStart ?? 0, members: r };
  }

  /** The members who must be ready for START: everyone connected but the leader (bots always are). */
  private notReady(): PartyMember[] {
    const leader = this.leaderNow();
    return this.r.members.filter((m) => m.id !== leader && m.connected && !m.ready);
  }

  /**
   * The leader's START: every member ready (the battle is made by the Durable Object: takeStart). A Battle Tower party: two or more
   * people, its plan read for them as they are now, and, when that plan ends the leader's own party climb, the leader's `confirm`
   * (the app asks first; each other member's READY is their yes).
   */
  private startBattle(id: string, confirm = false) {
    if (id !== this.leaderNow() || this.r.starting || this.notReady().length) return;
    if (this.r.kind === "tower") {
      const plan = this.r.tower?.plan;
      if (!plan || plan.key !== this.towerKey() || plan.plan.kind === "wait") return;
      const lead = this.r.members.find((m) => m.id === id);
      // (A plan that ends the leader's own climb, or takes it back floors (the review of #835, finding 10), needs their yes.)
      const mine = plan.plan.kind === "new" ? plan.plan.ends : (plan.plan.back ?? []);
      if (mine.some((e) => e.uid === lead?.userId) && !confirm) return;
    }
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

  /** A Battle Tower party's people for its plan and START: everyone connected, in seat order, by account. */
  towerPeople(): string[] {
    return this.r.members
      .filter((m) => m.connected && !m.bot && m.userId)
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
      .map((m) => m.userId!);
  }

  /** The key a plan is read for: the people, in seat order. */
  towerKey(): string {
    return this.towerPeople().join(",");
  }

  /** Whether the Durable Object should read the plan again: the people changed since it was read (or it never was). */
  towerPlanStale(): boolean {
    return this.r.kind === "tower" && this.r.tower?.plan?.key !== this.towerKey();
  }

  /**
   * The plan read for `key` (the Durable Object's read of everyone's copies): kept if those are still the people, and when it differs
   * from the one before, everyone is un-readied (as a Boss Battle party's change of boss does): a READY is a yes to the plan it saw.
   */
  setTowerPlan(p: TowerPartyPlan) {
    if (this.r.kind !== "tower" || p.key !== this.towerKey()) return;
    const was = this.r.tower?.plan;
    this.r.tower = { ...(this.r.tower ?? {}), plan: p };
    if (!was || JSON.stringify(was.plan) !== JSON.stringify(p.plan)) for (const m of this.r.members) m.ready = false;
    this.broadcast();
  }

  /** The plan as everyone sees it (members by their ids here); two or more people first. */
  private towerPlanView(): NetTowerPlan {
    const people = this.towerPeople();
    if (people.length < 2) return { kind: "wait", message: TOWER_PARTY_LINES.needTwo };
    const p = this.r.tower?.plan;
    if (!p || p.key !== people.join(",")) return { kind: "wait", message: TOWER_PARTY_LINES.reading };
    if (p.plan.kind === "wait") return p.plan;
    const idOf = (uid: string) => this.r.members.find((m) => m.userId === uid)?.id ?? "";
    const byId = (xs: { uid: string; floor: number }[]) => xs.map((e) => ({ id: idOf(e.uid), floor: e.floor })).filter((e) => e.id);
    return p.plan.kind === "new" ? { kind: "new", ends: byId(p.plan.ends) } : { kind: "continue", floor: p.plan.floor, back: byId(p.plan.back ?? []) };
  }

  /**
   * A Battle Tower party's floor is under way: its START taken (its room being made) or placed, until the room says it's over
   * (battleOver). Kick is greyed then (the director's call on the review of #835, finding 6), and an Open party line lapses.
   */
  private get towerFloorOn(): boolean {
    return this.r.kind === "tower" && (!!this.r.starting || !!this.r.passes);
  }

  /**
   * The leader's Open party: its line goes up in the town's chat (the Durable Object posts it: takeOpen). Once while it stands; not
   * while the party is full or its battle is being made.
   */
  private openParty(id: string, room: string) {
    if (this.r.kind !== "tower" || id !== this.leaderNow() || this.r.tower?.open || this.towerFloorOn || this.r.members.length >= this.max) return;
    this.r.tower = { ...(this.r.tower ?? { plan: null }), open: { line: null, at: this.io.now(), by: id, room } };
    this.broadcast();
  }

  /** The open line to post (asked for, not posted yet): its leader's account and name, the seats still free and the town's chat room. */
  takeOpen(): { uid: string; name: string; free: number; room: string } | null {
    const o = this.r.tower?.open;
    if (!o || o.line !== null) return null;
    const lead = this.r.members.find((m) => m.id === this.leaderNow());
    return lead?.userId ? { uid: lead.userId, name: lead.name, free: Math.max(0, this.max - this.r.members.length), room: o.room } : null;
  }

  /** The open line went up (its number in the town's chat, from now), or couldn't (null: it's dropped, the button live again). */
  openPosted(line: number | null) {
    const o = this.r.tower?.open;
    if (!o) return;
    if (line === null) delete this.r.tower!.open;
    else {
      o.line = line;
      o.at = this.io.now();
    }
    this.broadcast();
  }

  /** The town's chat refused the leader's line (a chat ban, the chat paused, too soon after the last): dropped, and they're told why. */
  openRefused(message: string) {
    const o = this.r.tower?.open;
    if (!o) return;
    delete this.r.tower!.open;
    if (this.r.members.some((m) => m.id === o.by && m.connected)) this.io.send(o.by, { t: "error", message });
    this.broadcast();
  }

  /** When the open line lapses with the town's lines (TOWN_CHAT.lineMs after it went up), or null. */
  private get openLapsesAt(): number | null {
    const o = this.r.tower?.open;
    return o && o.line !== null ? o.at + TOWN_CHAT.lineMs : null;
  }

  /**
   * The open line lapses when the party fills, its battle starts, or its leader leaves (Eric: "lapses when the party fills or its
   * leader starts or leaves"; a leader who leaves passes the party on, and the line with their name goes), and with the town's own
   * lines, TOWN_CHAT.lineMs after it went up (the review of #835, finding 3: the town has dropped it by then, so Open party is live
   * again): its number to take out of the town's chat, once.
   */
  takeLapsedOpen(): { line: number; room: string } | null {
    const o = this.r.tower?.open;
    if (!o || o.line === null) return null;
    const lapsed = this.r.members.length >= this.max || this.towerFloorOn || this.leaderNow() !== o.by || this.io.now() >= (this.openLapsesAt ?? Infinity);
    if (!lapsed) return null;
    delete this.r.tower!.open;
    this.broadcast();
    return { line: o.line, room: o.room };
  }

  /** When the Durable Object reads the plan again (a member's last floor still being written: tower.ts), else null. */
  towerRecheck(at: number | null) {
    if (this.r.kind !== "tower" || !this.r.tower) return;
    if (at === null) delete this.r.tower.recheckAt;
    else this.r.tower.recheckAt = at;
  }

  /** The plan is read again at the next chance (a floor just ended: everyone's copies changed). */
  towerReread() {
    if (this.r.kind === "tower" && this.r.tower) this.r.tower.plan = null;
  }

  /** START's battle to make (the Durable Object makes the lobby, one at a time, then calls placedIn with its START's id). */
  takeStart(): BossStart | null {
    return this.r.starting ?? null;
  }

  /**
   * START `id`'s battle is made (`lobby`), or couldn't be (null): everyone's told where to go (each their own pass), and
   * un-readied for the next. An answer for any other START (a late one) changes nothing.
   */
  placedIn(lobby: string | null, id?: number, message = "Couldn't start the battle. Try again.") {
    const s = this.r.starting;
    if (!s || (id !== undefined && id !== s.id)) return;
    delete this.r.starting;
    if (!lobby) {
      for (const m of this.r.members) if (m.connected && !m.bot) this.io.send(m.id, { t: "error", message });
      return this.broadcast();
    }
    this.r.state = "placed";
    this.r.placed = { lobby, pass: "", at: this.io.now() };
    this.r.placedStart = s.id;
    this.r.passes = Object.fromEntries(s.members.filter((m) => this.r.members.some((x) => x.id === m.id)).map((m) => [m.id, m.pass]));
    // (Kicked or gone while it was being made: their passes revoked in it.)
    const dropped = s.members.filter((m) => !this.r.members.some((x) => x.id === m.id)).map((m) => m.id);
    if (dropped.length) this.r.revokes = [...(this.r.revokes ?? []), ...dropped];
    for (const m of this.r.members) if (!m.bot) m.ready = false;
    this.broadcast();
  }

  /**
   * The leader queues everyone connected: seats for them all under a new pass (again after a lobby: a new one). A 50 v 50 party's
   * invites still out are dropped (they'd find the party gone; the Durable Object deletes them). A 50 v 50 party holds a seat for
   * every member, away or not (N1: an away member back later walks in with the pass and plays on the party's team; a hold nobody
   * uses lapses with the reservation, CAPACITY.queue.reservationMs).
   */
  private startQueue(id: string) {
    if (id !== this.leaderNow() || this.r.state === "queueing") return;
    const size = this.r.kind === "crowd" ? this.r.members.length : this.r.members.filter((m) => m.connected).length;
    if (size < 1) return;
    if (this.r.kind === "crowd") this.r.invited = [];
    delete this.r.awayStopped;
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
    // (A 50 v 50 party with nobody connected a while: no more asking.)
    if (this.stopIfDeserted()) {
      this.broadcast();
      return null;
    }
    q.retryAt = this.io.now() + PARTY_ASK_MS;
    return { ticket: q.ticket, size: q.size, pass: q.pass };
  }

  /** When to ask again (the Durable Object's alarm), or when a 50 v 50 party's away leader's hold on the lead ends. */
  get nextAlarm(): number | null {
    const times = [this.r.state === "queueing" && this.r.queue ? this.r.queue.retryAt : null, this.leadHeldUntil(), this.r.tower?.recheckAt ?? null, this.openLapsesAt].filter((t): t is number => t !== null);
    return times.length ? Math.min(...times) : null;
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
