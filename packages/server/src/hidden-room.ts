import { HIDDEN_ROOM } from "@chessroyale/core";
import { HERE_LIMITS, TownHere, type HereLimits } from "./town-here.ts";

/**
 * The Hidden Boss's room challenge (Eric, Nov 12 and 13; docs/decisions/2026-11-13-hidden-boss-challenge.md), as pure logic: the live
 * hub keeps one, in memory only (a restart forgets it; each device in the room then finds itself out and goes back in).
 *
 * Per town instance (the town's `room`: production has one, "town"; each test its own):
 * - **The room** (the walk-up's top floor) holds at most HIDDEN_ROOM.players people at once: a device asks to `enter` on the stairs
 *   up, and a 5th is refused ("The door is locked."). Bots an admin filled in count. Each device in the room asks again every
 *   HIDDEN_ROOM.pollMs (`look`, with where it stands, whether its page is hidden, and an idle time the app sends as 0); one silent for
 *   HIDDEN_ROOM.silentSec has gone (a disconnect), and one hidden past the town's away limits (TOWN_AFK, as town-here.ts drops a pawn)
 *   too: out of the room and its request. A player idle in the room is dropped by the town's own away rule (the app's watchAway runs
 *   in rooms too): it takes them out of the town, and out of the room with it (`leave`).
 * - **The request**: each Challenge adds its player ("1 of 4", "2 of 4"…); you're in one at a time (a request in another instance, a
 *   solo boss battle: `drop`). Leaving the room, a cancel or a disconnect takes you out. At HIDDEN_ROOM.players it's `starting`: the
 *   hub makes the fight (a party battle's lobby) and `started` gives each person their pass, read on their next look; then they're out
 *   of the room (the next four may come in). Not four by HIDDEN_ROOM.capSec: everyone in it reads "Sorry, not enough players."
 * - **The test bots** (admins only; the API and the hub check): `fill` puts HIDDEN_ROOM.bots bots in the room; they join a request as
 *   players would, one each HIDDEN_ROOM.botJoinMs, and play in the fight as its bot members. They leave with the admin who filled them.
 *
 * Everything ends: a room with nobody in it and nothing to read is forgotten at the next sweep; an outcome waits HIDDEN_ROOM.outcomeSec.
 */

/**
 * What a device in the room says on a look: where it stands (the room's squares), and the town's away numbers (town-here.ts). The app
 * sends `idleMs` 0 (its own away rule drops an idle player: the header); a test may send more.
 */
export interface RoomBeat {
  c: number;
  r: number;
  idleMs: number;
  hidden: boolean;
}

/** The numbers a room goes by (a test's own, shortened, where the test switches are on). */
export interface RoomLimits {
  capMs: number;
  silentMs: number;
  here: HereLimits;
}

export const ROOM_LIMITS: RoomLimits = { capMs: HIDDEN_ROOM.capSec * 1000, silentMs: HIDDEN_ROOM.silentSec * 1000, here: HERE_LIMITS };

/** Said to a 5th at the door. */
export const DOOR_LOCKED = "The door is locked.";
/** The 5-minute cap (Eric, Nov 12: "a small pop-up 'Sorry, not enough players.' with OK"). */
export const NOT_ENOUGH = "Sorry, not enough players.";
/** The fight couldn't be made (the lobby's Durable Object refused five codes). */
export const NO_FIGHT = "Couldn't start the fight. Try again.";
/** "Fill with 3 bots" for anyone but an admin. */
export const ADMINS_ONLY = "Admins only.";
export const ROOM_FULL = "The room is full.";

/** Someone in the room, as everyone else there sees them. */
export interface RoomPerson {
  id: string;
  name: string;
  /** Where they stand (the room's squares); a bot: null (the app stands it at the board's places). */
  c: number | null;
  r: number | null;
  bot?: true;
}

/**
 * How your request ended: into the fight (your pass into its lobby, your seat), or not. `n`: its own number (a device acts on each
 * once: it's told again on every look until it goes, so a lost answer never loses the fight).
 */
export type RoomOutcome = { n: number; kind: "fight"; lobby: string; pass: string; seat: number; names: string[] } | { n: number; kind: "ended"; message: string };

/** What a device in (or at the door of) the room is told. */
export interface RoomView {
  /** You're in the room. */
  in: boolean;
  /** People in the room (bots too), and the most there may be. */
  people: number;
  max: number;
  /** The request: how many are in it, and whether you are. */
  count: number;
  yours: boolean;
  /** Who's in it, in order. */
  names: string[];
  /** Everyone else in the room. */
  others: RoomPerson[];
  /** The admin's test bots are in the room. */
  bots: boolean;
  /** Your request's end (until you challenge again, come in again, or HIDDEN_ROOM.outcomeSec). */
  outcome?: RoomOutcome;
  /** Refused: why ("The door is locked.", "Admins only."…). */
  message?: string;
}

interface Member {
  id: string;
  name: string;
  c: number | null;
  r: number | null;
  bot: boolean;
  seenAt: number;
  idleSince: number;
  hiddenSince: number | null;
}

interface Request {
  /** In order: the first challenger first (the leader's seat). */
  ids: string[];
  at: number;
  /** Bots on their way into it: each joins at its time. */
  coming: { id: string; at: number }[];
  /** Full: the fight is being made (nobody joins or leaves it now). */
  starting?: true;
}

interface Inst {
  key: string;
  members: Map<string, Member>;
  request: Request | null;
  /** Who filled the bots (they go with them). */
  botsBy: string | null;
  limits: RoomLimits;
}

/** A full request, for the hub to make its fight. */
export interface RoomStart {
  room: string;
  /** In seat order: the people (their account ids and names) and the bots (`bot`). */
  seats: { id: string; name: string; bot: boolean }[];
  at: number;
}

/** The most instances held (a guard: a test makes one per run). */
const ROOMS_MAX = 2000;
const OUTCOMES_MAX = 20_000;

export class HiddenRooms {
  private rooms = new Map<string, Inst>();
  /** Which instance's room each account is in. */
  private where = new Map<string, string>();
  /**
   * Each account's request's end, told on every answer until HIDDEN_ROOM.outcomeSec (`read`: some answer has carried it). A fight's is
   * kept through a cancel, and through a new visit until read (review m1): a seat in a starting request is kept.
   */
  private outcomes = new Map<string, { o: RoomOutcome; at: number; read?: true }>();
  private serial = 0;

  get size(): number {
    return this.rooms.size;
  }

  private inst(key: string, limits: RoomLimits = ROOM_LIMITS): Inst | null {
    let i = this.rooms.get(key);
    if (!i) {
      if (this.rooms.size >= ROOMS_MAX) return null;
      this.rooms.set(key, (i = { key, members: new Map(), request: null, botsBy: null, limits }));
    }
    return i;
  }

  /** Into the room (the stairs up): refused at HIDDEN_ROOM.players people. In another instance's room: out of that one first. */
  enter(id: string, name: string, room: string, now: number, beat?: RoomBeat, limits?: RoomLimits): RoomView {
    this.sweep(now);
    const was = this.where.get(id);
    if (was === room) {
      this.touch(this.rooms.get(room)!.members.get(id)!, now, beat);
      return this.view(id, room, now);
    }
    // (Your fight was made and nobody has told you yet, say a disconnect's look raced the start: into it, not back into the room.)
    const o = this.outcomes.get(id);
    if (o?.o.kind === "fight" && !o.read) return this.view(id, room, now);
    if (was !== undefined) this.leave(id, now);
    const i = this.inst(room, limits);
    if (!i || i.members.size >= HIDDEN_ROOM.players) return { ...this.view(id, room, now), message: DOOR_LOCKED };
    if (limits) i.limits = limits;
    const m: Member = { id, name, c: null, r: null, bot: false, seenAt: now, idleSince: now, hiddenSince: null };
    this.touch(m, now, beat);
    i.members.set(id, m);
    this.where.set(id, room);
    // (A new visit: an old end is stale now.)
    this.outcomes.delete(id);
    return this.view(id, room, now);
  }

  /** A device in the room asks again: where it stands, its idle time. Not in the room (a disconnect dropped it): `in` false. */
  look(id: string, room: string, now: number, beat?: RoomBeat): RoomView {
    this.sweep(now);
    const m = this.where.get(id) === room ? this.rooms.get(room)?.members.get(id) : undefined;
    if (m) this.touch(m, now, beat);
    return this.view(id, room, now);
  }

  private touch(m: Member, now: number, beat?: RoomBeat) {
    m.seenAt = now;
    if (!beat) return;
    m.c = beat.c;
    m.r = beat.r;
    m.idleSince = now - Math.max(0, beat.idleMs);
    m.hiddenSince = beat.hidden ? (m.hiddenSince ?? now) : null;
  }

  /**
   * Your Challenge: into the room's request (it starts one if there's none, and the admin's bots, if any, join it one by one). Not in
   * the room, or the fight already being made: nothing. Full: the start, for the hub to make the fight (`starting` until `started`).
   */
  challenge(id: string, room: string, now: number): { view: RoomView; start: RoomStart | null } {
    this.sweep(now);
    const i = this.rooms.get(room);
    if (!i || this.where.get(id) !== room || i.request?.starting) return { view: this.view(id, room, now), start: null };
    if (!i.request) {
      i.request = { ids: [], at: now, coming: [] };
      const bots = [...i.members.values()].filter((m) => m.bot);
      bots.forEach((b, k) => i.request!.coming.push({ id: b.id, at: now + (k + 1) * HIDDEN_ROOM.botJoinMs }));
    }
    if (!i.request.ids.includes(id)) i.request.ids.push(id);
    this.outcomes.delete(id);
    return { view: this.view(id, room, now), start: this.full(i, now) };
  }

  /** Bots whose time has come join the request. */
  private joinDue(i: Inst, now: number) {
    const q = i.request;
    if (!q || q.starting) return;
    for (const b of q.coming.filter((x) => x.at <= now)) if (q.ids.length < HIDDEN_ROOM.players && i.members.has(b.id) && !q.ids.includes(b.id)) q.ids.push(b.id);
    q.coming = q.coming.filter((x) => x.at > now && i.members.has(x.id));
  }

  /** At HIDDEN_ROOM.players the request is full: its start (once). */
  private full(i: Inst, now: number): RoomStart | null {
    this.joinDue(i, now);
    const q = i.request;
    if (!q || q.starting) return null;
    if (q.ids.length < HIDDEN_ROOM.players) return null;
    q.starting = true;
    return { room: i.key, seats: q.ids.map((id) => ({ id, name: i.members.get(id)!.name, bot: i.members.get(id)!.bot })), at: now };
  }

  /**
   * Bots due to join a request: any request this makes full (the hub calls it on every look, so a request the bots fill starts
   * without anyone's tap).
   */
  due(now: number): RoomStart[] {
    const out: RoomStart[] = [];
    for (const i of this.rooms.values()) {
      const s = this.full(i, now);
      if (s) out.push(s);
    }
    return out;
  }

  /**
   * The fight for `start` is made (`lobby`, and each person's pass by account), or couldn't be (null; `why`: the words, NO_FIGHT or a
   * rest's line). Everyone in it reads their outcome on their next look, and is out of the room (the next four may come in); the bots
   * go with them.
   */
  started(start: RoomStart, lobby: string | null, passes: Record<string, string>, now: number, why: string = NO_FIGHT) {
    const i = this.rooms.get(start.room);
    const names = start.seats.map((s) => s.name);
    start.seats.forEach((s, seat) => {
      if (s.bot) return;
      this.setOutcome(s.id, lobby && passes[s.id] ? { n: 0, kind: "fight", lobby, pass: passes[s.id]!, seat, names } : { n: 0, kind: "ended", message: why }, now);
    });
    if (!i) return;
    if (!lobby) {
      // (Not made: the request ends; everyone stays in the room, free to try again.)
      i.request = null;
      return;
    }
    for (const s of start.seats) this.out(i, s.id);
    if (i.botsBy && start.seats.some((s) => s.id === i.botsBy)) i.botsBy = null;
    i.request = null;
  }

  private setOutcome(id: string, o: RoomOutcome, now: number) {
    if (this.outcomes.size >= OUTCOMES_MAX) this.outcomes.delete(this.outcomes.keys().next().value!);
    this.outcomes.set(id, { o: { ...o, n: ++this.serial }, at: now });
  }

  /**
   * Your cancel: out of the request (you stay in the room). Only bots left in it: it ends. Too late, the four full (review m1): the
   * fight is being made for everyone, your seat in it too, and its outcome stays for this answer and the next.
   */
  cancel(id: string, now: number) {
    const room = this.where.get(id);
    const i = room === undefined ? null : this.rooms.get(room);
    if (i) this.unrequest(i, id);
    if (this.outcomes.get(id)?.o.kind !== "fight") this.outcomes.delete(id);
    this.sweep(now);
  }

  /** One request at a time (a solo boss battle began, Eric, Nov 12): out of any request (you stay in the room). */
  drop(id: string, now: number) {
    this.cancel(id, now);
  }

  /**
   * Out of the room (the stairs down, back, the town closed): out of its request too; the bots you filled go with you. Not out of a
   * request being made (its four are set): the answer carries your fight once it's made (review m1).
   */
  leave(id: string, now: number) {
    const room = this.where.get(id);
    const i = room === undefined ? undefined : this.rooms.get(room);
    if (i) this.out(i, id);
    this.where.delete(id);
    this.sweep(now);
  }

  private out(i: Inst, id: string) {
    this.unrequest(i, id);
    i.members.delete(id);
    this.where.delete(id);
    if (i.botsBy === id) {
      for (const m of [...i.members.values()]) if (m.bot) this.out(i, m.id);
      i.botsBy = null;
    }
  }

  private unrequest(i: Inst, id: string) {
    const q = i.request;
    // (A fight being made keeps its four: it's theirs now.)
    if (!q || q.starting) return;
    q.ids = q.ids.filter((x) => x !== id);
    q.coming = q.coming.filter((x) => x.id !== id);
    const people = q.ids.some((x) => !i.members.get(x)?.bot);
    if (!people) i.request = null;
  }

  /** "Fill with 3 bots" (`admin`: the server's word): HIDDEN_ROOM.bots bots stand in the room; refused for anyone else. */
  fill(id: string, room: string, admin: boolean, now: number): RoomView {
    this.sweep(now);
    const i = this.rooms.get(room);
    if (!admin) return { ...this.view(id, room, now), message: ADMINS_ONLY };
    if (!i || this.where.get(id) !== room) return this.view(id, room, now);
    if ([...i.members.values()].some((m) => m.bot)) return this.view(id, room, now);
    if (i.members.size + HIDDEN_ROOM.bots > HIDDEN_ROOM.players) return { ...this.view(id, room, now), message: ROOM_FULL };
    for (let k = 1; k <= HIDDEN_ROOM.bots; k++) {
      const bid = `bot:${room}:${k}`;
      i.members.set(bid, { id: bid, name: `Bot ${k}`, c: null, r: null, bot: true, seenAt: now, idleSince: now, hiddenSince: null });
    }
    i.botsBy = id;
    // (A request already on: they join it as players would.)
    if (i.request && !i.request.starting) [...i.members.values()].filter((m) => m.bot).forEach((b, k) => i.request!.coming.push({ id: b.id, at: now + (k + 1) * HIDDEN_ROOM.botJoinMs }));
    return this.view(id, room, now);
  }

  /** Whoever has gone (silent, or past the town's away limits), every request past its cap, every outcome nobody read. */
  sweep(now: number) {
    for (const i of [...this.rooms.values()]) {
      const L = i.limits;
      for (const m of [...i.members.values()]) {
        if (m.bot) continue;
        const silent = now - m.seenAt >= L.silentMs;
        const away = TownHere.past({ idleSince: m.idleSince, hiddenSince: m.hiddenSince, beatAt: m.seenAt, limits: L.here }, now);
        if (silent || away) this.out(i, m.id);
      }
      this.joinDue(i, now);
      const q = i.request;
      if (q && !q.starting && q.ids.length < HIDDEN_ROOM.players && now - q.at >= L.capMs) {
        for (const id of q.ids) if (!i.members.get(id)?.bot) this.setOutcome(id, { n: 0, kind: "ended", message: NOT_ENOUGH }, now);
        i.request = null;
      }
      const people = [...i.members.values()].some((m) => !m.bot);
      // (Bots alone, their admin gone: they go too.)
      if (!people) for (const m of [...i.members.values()]) this.out(i, m.id);
      if (!i.members.size && !i.request) this.rooms.delete(i.key);
    }
    for (const [id, x] of this.outcomes) if (now - x.at >= HIDDEN_ROOM.outcomeSec * 1000) this.outcomes.delete(id);
  }

  /** Whether this account is in `room`'s room now. */
  has(id: string, room: string): boolean {
    return this.where.get(id) === room;
  }

  /** What `id` is told about `room` (its outcome too, if any): only ever `id`'s own answer (it marks the outcome told). */
  view(id: string, room: string, now: number): RoomView {
    void now;
    const i = this.rooms.get(room);
    const inRoom = this.where.get(id) === room;
    const q = i?.request ?? null;
    const outcome = this.outcomes.get(id);
    // (Told: a new visit may forget it now.)
    if (outcome) outcome.read = true;
    const members = i ? [...i.members.values()] : [];
    return {
      in: inRoom,
      people: members.length,
      max: HIDDEN_ROOM.players,
      count: q?.ids.length ?? 0,
      yours: !!q && q.ids.includes(id),
      names: q ? q.ids.map((x) => i!.members.get(x)?.name ?? "") : [],
      others: members.filter((m) => m.id !== id).map((m) => ({ id: m.id, name: m.name, c: m.c, r: m.r, ...(m.bot ? { bot: true as const } : {}) })),
      bots: members.some((m) => m.bot),
      ...(outcome ? { outcome: outcome.o } : {}),
    };
  }
}

/** "Ann, Bo, Cy and Di are fighting the Hidden Boss." (the server's line in the town's chat; `boss` as a sentence says it). */
export function fightingText(names: readonly string[], boss: string): string {
  const list = names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? "is" : "are"} fighting ${boss}.`;
}
