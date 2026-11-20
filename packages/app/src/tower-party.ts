import { PartyClient, createParty, currentParty, forgetParty, partyStatus } from "./squads.ts";
import { showBanNotice } from "./components/FairPlay.tsx";

/**
 * The Battle Tower's party on this device (Nov 20; docs/decisions/2026-11-20-tower-party.md): the clerk's Invite friends and Open party
 * make one (POST /api/tower/party), a friend's invite or the town's Join comes into one by its code, and its START begins a floor on
 * every member's copy of the climb (the server's: tower.ts). One at a time. Placed (the floor's match room made): the town walks
 * everyone in (town/Town.tsx, `onPartyFloor`), and the party's socket closes until the floor's over (`rejoin`, back in the tower).
 */

/** The floor its START began: its match room, your pass and seat into it. */
export interface PartyFloor {
  code: string;
  lobby: string;
  pass: string;
  seat: number;
}

let client: PartyClient | null = null;
let unsub: (() => void) | null = null;
const listeners = new Set<() => void>();
let floorHandler: ((f: PartyFloor) => void) | null = null;
/** A floor placed before anything was listening (the town still loading): handed over once something is. */
let floorWaiting: PartyFloor | null = null;

/** An Open party asked for before the party's welcome came (its room; null: the town's own): sent once it's in. */
let openWanted: string | null | undefined;
const emit = () => {
  const p = towerParty();
  if (openWanted !== undefined && p?.memberId && p.party) {
    p.open(openWanted ?? undefined);
    openWanted = undefined;
  }
  listeners.forEach((l) => l());
};

/** The leader's Open party (its line in the town's chat `room`), sent as soon as this device is in the party. */
export function openTowerParty(room?: string) {
  const p = towerParty();
  if (!p) return;
  if (p.memberId && p.party) p.open(room);
  else openWanted = room ?? null;
}

/** The party this page is in now (null: none, or it's closed). */
export function towerParty(): PartyClient | null {
  return client && !client.done ? client : null;
}

/** Any change: a party joined or left, or its state. */
export function onTowerParty(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Where a floor its START began goes (the town registers it). */
export function onPartyFloor(fn: (f: PartyFloor) => void): () => void {
  floorHandler = fn;
  if (floorWaiting) {
    const f = floorWaiting;
    floorWaiting = null;
    fn(f);
  }
  return () => {
    if (floorHandler === fn) floorHandler = null;
  };
}

function use(p: PartyClient | null) {
  unsub?.();
  openWanted = undefined;
  if (client && client !== p && !client.done) client.close();
  client = p;
  unsub = p ? p.subscribe(emit) : null;
  emit();
}

/** Into the party `code` (a friend's invite, the town's Join, back after a floor). False: it has closed. */
export async function joinTowerParty(code: string): Promise<boolean> {
  const up = code.toUpperCase();
  if (towerParty()?.code === up) return true;
  const open = await partyStatus(up, "tower");
  if (open === false) {
    forgetParty(up, "tower");
    return false;
  }
  const p: PartyClient = new PartyClient(
    up,
    (lobby, pass, seat) => {
      // (A floor begun before you were in the party: no pass of yours, not your floor.)
      if (!pass) return;
      const f = { code: up, lobby, pass, seat };
      // (The party as its START placed it: its others walk in with you, and stand there after (its socket closes until the floor's over).)
      floorMates = matesOf(p);
      if (floorHandler) floorHandler(f);
      else floorWaiting = f;
      emit();
    },
    "tower",
  );
  use(p);
  p.connect();
  return true;
}

/**
 * The town line's Join (the review of #835, finding 11): into the party `code`, answered once the party has said: null once it welcomed
 * you, else its words (it turned you away, it has closed, or it didn't answer within `waitMs`).
 */
export async function joinTowerPartyAnswer(code: string, waitMs = 20_000): Promise<string | null> {
  if (!(await joinTowerParty(code))) return "That party has closed.";
  const c = client;
  if (!c || c.code !== code.toUpperCase()) return "Couldn't join that party. Try again.";
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let off: (() => void) | null = null;
    const end = (words: string | null) => {
      if (timer) clearTimeout(timer);
      off?.();
      timer = null;
      off = null;
      resolve(words);
    };
    const check = () => {
      if (c.memberId) return end(null);
      if (c.error) return end(c.error);
      if (c.done) end("Couldn't join that party. Try again.");
    };
    off = c.subscribe(check);
    timer = setTimeout(() => {
      // (No answer: out again, so the line's Join and the clerk agree.)
      if (!c.memberId && client === c) leaveTowerParty();
      end("Couldn't reach that party. Try again.");
    }, waitMs);
    check();
  });
}

/** A party open to newcomers, as the clerk's list shows it (Eric, Nov 20): its code, its leader's name, how many are in it, of how many. */
export interface OpenParty {
  code: string;
  leader: string;
  members: number;
  max: number;
}

/**
 * The Battle Tower parties a newcomer can join now (GET /api/tower/parties: those open to the town, each able to take someone new),
 * newest first, in the town chat's `room` (a test's own); `message`, why you can't join any (a guest where signing in is set up: the delta
 * review of #835, finding 1), else null; null: the server couldn't be asked.
 */
export async function openTowerParties(room?: string): Promise<{ parties: OpenParty[]; message: string | null } | null> {
  try {
    const res = await fetch(`/api/tower/parties${room ? `?townroom=${encodeURIComponent(room)}` : ""}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { parties?: unknown; message?: unknown };
    if (!Array.isArray(body.parties)) return null;
    return {
      parties: body.parties.filter(
        (p): p is OpenParty => !!p && typeof p.code === "string" && /^[A-Z2-9]{5}$/.test(p.code) && typeof p.leader === "string" && typeof p.members === "number" && typeof p.max === "number",
      ),
      message: typeof body.message === "string" ? body.message : null,
    };
  } catch {
    return null;
  }
}

/** A new party (the clerk's Invite friends or Open party), you its leader. Its error's words, or null once you're in. */
export async function makeTowerParty(): Promise<string | null> {
  if (towerParty()) return null;
  const r = await createParty("tower");
  if ("banned" in r) {
    showBanNotice();
    return "";
  }
  if ("error" in r) return r.error;
  return (await joinTowerParty(r.code)) ? null : "Couldn't make a party. Try again.";
}

/** Back into the party after its floor (its socket closed while the floor was played). */
export function rejoinTowerParty(): Promise<boolean> {
  const code = currentParty("tower");
  return code ? joinTowerParty(code) : Promise.resolve(false);
}

/** Leave the party for good (this device forgets it). */
export function leaveTowerParty() {
  client?.leave();
  use(null);
}

// (The plan's words: a pure module of their own, which the e2e measures in the clerk's card.)
export { planWaiting, planWords, type PlanAsk } from "./tower-plan.ts";

/** A party floor to go into: its room, your pass and seat, the floor, its bosses, the floors beaten and the lives going in (the run's strip). */
export interface PartyFloorEntry extends PartyFloor {
  floor: number;
  bosses: string[];
  beaten: string[][];
  lives?: number;
}

let enterHandler: ((e: PartyFloorEntry) => void) | null = null;
/** The app's way into a party floor's match (App.tsx registers it). */
export function onEnterPartyFloor(fn: (e: PartyFloorEntry) => void): () => void {
  enterHandler = fn;
  return () => {
    if (enterHandler === fn) enterHandler = null;
  };
}
/** Into a party floor's match: the floor room's walk-in done (town/Town.tsx), or straight in from outside the tower. */
export function enterPartyFloor(e: PartyFloorEntry): void {
  enterHandler?.(e);
}

/** The others in a party (bots aside), in seat order: their seats (their colors in the floor room). */
const matesOf = (p: PartyClient | null): { seat: number }[] =>
  (p?.party?.members ?? [])
    .filter((m) => m.id !== p?.memberId && !m.bot)
    .map((m) => ({ seat: m.seat ?? 0 }))
    .sort((a, b) => a.seat - b.seat);
/** The others as the party's last floor began (its socket closed while it's played, and is opened again after). */
let floorMates: { seat: number }[] = [];

/** The others in your party, in seat order: as the party is now, or as its floor began while you're away from it (on the floor). */
export function partyMates(): { seat: number }[] {
  const live = towerParty();
  return live?.party ? matesOf(live) : floorMates;
}
