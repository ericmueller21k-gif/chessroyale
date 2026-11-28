import { TOWN_AFK, cleanLook, type ItemLook, type PawnColor } from "@chessroyale/core";
import { lookKey } from "./you-look.ts";
import { testParams, testSwitchesAllowed } from "../test-switches.ts";
import { account } from "../account.ts";
import { AWAY_LIMITS, AwayClock, GuestTime, readAwaySwitch, readGuestSwitch, type AwayLimits, type AwayState } from "./afk.ts";
import { mayReadTownChat, mayTownChat } from "./chat-net.ts";
import { N } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { TABLES, Walker, seated, spotNear, taken, walkWalker, walkable, type Person, type Sq, type Town } from "./world.ts";

/**
 * Who else is in the town square, and you being away (Eric, Nov 7; afk.ts; the server's side: server/src/town-here.ts). A
 * signed-in device (as the town's chat: `mayTownChat`) sends a beat (POST /api/town/here) every TOWN_AFK.beatSec while its page is
 * visible, at once when your square or your "zzz" changes, one as the page goes to the background, and a leave as you go. The
 * answer is everyone else there: each becomes a pawn in the town's people (`applyHere`) that walks to the square they said, a
 * "zzz" over it while they're away, and leaves (not drawn, not tapped: `home`) once the server drops them. Nothing here runs in the
 * frame loop: a 1 s check, the input listeners and the requests' callbacks.
 */

/** Another player as the server says (server/src/town-here.ts `HereOther`). */
export interface HereOther {
  id: string;
  name: string;
  c: number;
  r: number;
  zzz: boolean;
  /** What they wear (absent: nothing on). */
  look?: ItemLook;
  /** Their default pawn color (absent: white). */
  pawn?: PawnColor;
  /** Seated at a park table (on the stool their square is). */
  sit?: boolean;
}

/** A ranked 1 v 1 at a park table, as the server says (server/src/town-tables.ts `TableMatch`): its code, its table, stool 0's and 1's player. */
export interface TableMatch {
  code: string;
  table: number;
  seats: { uid: string; name: string; look?: ItemLook | null; pawn?: PawnColor }[];
}

const isMatch = (o: unknown): o is TableMatch => {
  const x = o as TableMatch;
  return !!x && typeof x.code === "string" && Number.isInteger(x.table) && Array.isArray(x.seats) && x.seats.length === 2 && x.seats.every((s) => !!s && typeof s.uid === "string" && typeof s.name === "string");
};

const isOther = (o: unknown): o is HereOther => {
  const x = o as HereOther;
  return !!x && typeof x.id === "string" && typeof x.name === "string" && Number.isInteger(x.c) && Number.isInteger(x.r) && typeof x.zzz === "boolean";
};

/**
 * The server's list, into the town: a newcomer stands on their square (or the nearest free one) and fades in; someone already here
 * walks to their new square; someone no longer listed leaves (`home`: not drawn, not tapped, off every square). Each one's "zzz",
 * look and pawn color as said (an empty name: a guest's view, no name tag). Answers those who left, and those whose look or color is
 * new (to dress: Town.tsx `dressPerson`, the bots' way). (Your own pawn is never in the list: the server leaves you out.)
 */
export function applyHere(t: Town, others: readonly HereOther[], now: number): { gone: Person[]; dressed: Person[]; came: Person[] } {
  const dressed: Person[] = [];
  // (Nov 27) Those who came in this answer (new, or back after leaving) or changed their name: their name tags are made between frames.
  const came: Person[] = [];
  const listed = new Set<string>();
  for (const o of others) {
    if (o.c < 0 || o.r < 0 || o.c >= N || o.r >= N || !walkable(o.c, o.r)) continue;
    const id = `player:${o.id}`;
    listed.add(id);
    const side = o.pawn === "black" ? "dark" : "light";
    const sq: Sq = { c: o.c, r: o.r };
    let p = t.people.find((x) => x.id === id && x.remote);
    if (!p || p.home) {
      const w = new Walker(sq, TOWN_FEEL.botStepMs, true);
      if (taken(t, sq.c, sq.r, w)) {
        const s = spotNear(t, w, sq, true);
        if (s) ((w.c = s.c), (w.r = s.r));
      }
      if (!p) {
        p = { id, name: o.name, look: { side, tint: null, wear: null }, you: false, walker: w, sit: false, bot: null, waved: -Infinity, home: false, came: now, leaves: Infinity, going: false, trip: null, due: false, uid: o.id, remote: true };
        t.people.push(p);
      } else {
        p.walker = w;
        p.home = false;
        p.came = now;
      }
      t.all.push(w);
      came.push(p);
    } else {
      const g = p.walker.goal();
      if (g.c !== sq.c || g.r !== sq.r) walkWalker(p.walker, taken(t, sq.c, sq.r, p.walker) ? (spotNear(t, p.walker, sq, true) ?? sq) : sq);
    }
    if (p.name !== o.name && !came.includes(p)) came.push(p);
    p.name = o.name;
    p.zzz = o.zzz;
    // (Seated at a table, Nov 27: once they stop on its stool, as a bot sits.)
    p.sit = o.sit === true;
    const wear = o.look ? cleanLook(o.look) : null;
    const was = "sprite" in p.look ? null : p.look;
    if (!was || was.side !== side || lookKey(wear) !== lookKey(was.wear)) {
      p.look = { side, tint: null, wear: lookKey(wear) ? wear : null };
      dressed.push(p);
    }
  }
  const gone: Person[] = [];
  for (const p of t.people) {
    if (!p.remote || p.match || p.home || listed.has(p.id)) continue;
    p.home = true;
    p.zzz = false;
    const i = t.all.indexOf(p.walker);
    if (i >= 0) t.all.splice(i, 1);
    gone.push(p);
  }
  return { gone, dressed, came };
}

/**
 * The ranked games at the park's tables, from the server's list (Eric, Nov 27: "whoever your opponent is, he doesn't have to be in the
 * town ... just show their pawn ... sitting on the bench next to them ... with their name above their head"): each player a pawn seated
 * on their stool (`match`: the game's code), in their look and pawn color, for as long as the list has it; a match no longer listed
 * leaves (`home`). Whoever else stands on, or is walking to, one of its stools steps off beside it (a bot, someone in from the server,
 * you: `you` says so). Answers as `applyHere` does.
 */
export function applyTables(t: Town, list: readonly TableMatch[], now: number): { gone: Person[]; dressed: Person[]; came: Person[]; you: boolean } {
  const dressed: Person[] = [];
  const came: Person[] = [];
  let you = false;
  const listed = new Set<string>();
  for (const m of list) {
    const tb = TABLES[m.table];
    if (!tb) continue;
    for (const k of [0, 1] as const) {
      const s = m.seats[k]!;
      const id = `match:${m.code}:${k}`;
      listed.add(id);
      const sq = tb.stools[k]!;
      let p = t.people.find((x) => x.id === id);
      if (!p || p.home) {
        // (Its stool cleared first: anyone else on it, or on their way to stop there, steps off beside it.)
        for (const o of t.people) {
          if (o.home || o.match || o === p) continue;
          const g = o.walker.goal();
          if (g.c !== sq.c || g.r !== sq.r) continue;
          const to = spotNear(t, o.walker, sq, true);
          if (to) walkWalker(o.walker, to);
          if (o.you) ((o.sit = false), (you = true));
        }
        const w = new Walker(sq, TOWN_FEEL.botStepMs, true);
        if (!p) {
          p = { id, name: s.name, look: { side: "light", tint: null, wear: null }, you: false, walker: w, sit: true, bot: null, waved: -Infinity, home: false, came: now, leaves: Infinity, going: false, trip: null, due: false, uid: s.uid, remote: true, match: m.code };
          t.people.push(p);
        } else {
          p.walker = w;
          p.home = false;
          p.came = now;
        }
        t.all.push(w);
        came.push(p);
      }
      if (p.name !== s.name && !came.includes(p)) came.push(p);
      p.name = s.name;
      const side = s.pawn === "black" ? "dark" : "light";
      const wear = s.look ? cleanLook(s.look) : null;
      const was = "sprite" in p.look ? null : p.look;
      if (!was || was.side !== side || lookKey(wear) !== lookKey(was.wear) || came.includes(p)) {
        p.look = { side, tint: null, wear: lookKey(wear) ? wear : null };
        dressed.push(p);
      }
    }
  }
  const gone: Person[] = [];
  for (const p of t.people) {
    if (!p.match || p.home || listed.has(p.id)) continue;
    p.home = true;
    const i = t.all.indexOf(p.walker);
    if (i >= 0) t.all.splice(i, 1);
    gone.push(p);
  }
  return { gone, dressed, came, you };
}

/** The table and stool you sit at now ([table, stool]), for your beat; null: not sitting. */
export function seatNow(t: Town): [number, 0 | 1] | null {
  const tb = seated(t.you);
  if (!tb) return null;
  const h = t.you.walker.here();
  const k = tb.stools.findIndex((s) => s.c === h.c && s.r === h.r);
  return k === 0 || k === 1 ? [tb.i, k] : null;
}

/** What a beat says about you. */
export interface HereSelf {
  c: number;
  r: number;
  idleMs: number;
  hidden: boolean;
  shop: string | null;
  /** Back from a Battle Tower floor (server town-here.ts `HereBeat.floor`). */
  floor?: true;
  /** Sitting at a park table: [table, stool] (server town-here.ts `HereBeat.seat`). */
  seat?: [number, 0 | 1];
}

/**
 * The town's test switches (`?townafk=`, `?townroom=`, `?townguest=`) from the address now, or as the town first opened in this page
 * load: home's Chess Town button opens it again at /town without them, and a test's numbers must hold for the whole page load.
 * Honored only with the test switches on.
 */
const ASKED = (() => {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
})();
const asked = (k: string): string | null => (testSwitchesAllowed() ? (testParams().get(k) ?? ASKED.get(k)) : null);

/** The test switches' room (`?townroom=`: a test's own town, so other tests' players never walk in it) and shortened numbers. */
function testExtras(limits: AwayLimits | null): Record<string, unknown> {
  const room = asked("townroom");
  const out: Record<string, unknown> = room ? { room } : {};
  if (limits && limits !== AWAY_LIMITS) out.limits = { zzz: limits.zzzMs / 1000, boot: limits.bootMs / 1000, hidden: limits.hiddenBootMs / 1000 };
  return out;
}

/** The away rule's numbers on this page: settings.ts's, or the test switch's (`?townafk=`; null: off). */
export function awayLimits(): AwayLimits | null {
  const v = readAwaySwitch(asked("townafk"));
  return v === undefined ? AWAY_LIMITS : v;
}

/**
 * The town's away rule and its beats, until the returned function is called. `onState`: here or the "zzz" (yours to draw); `onOut`:
 * you were away too long (once; the town leaves for home). `busy`: a challenge or the claw machine has you. `shop`: the room you're
 * in (null: the town square). `loading`: the town's loading screen is up (holds the idle clock, not the background's: afk.ts
 * `setLoading`). `onOthers`: the server's answer was put in the town (who left: a card open on them closes). `floor`: the town opened
 * back from a Battle Tower floor's match: its beats say so (`floor: true`) until one is answered, so the server counts it the same visit
 * and the chat says nothing (Eric, Nov 22; server town-here.ts `beat`).
 */
export function watchAway(o: {
  town: Town;
  shop: () => string | null;
  busy: () => boolean;
  loading?: () => boolean;
  onState: (s: AwayState) => void;
  onOut: () => void;
  onOthers?: (gone: Person[], dressed: Person[], came: Person[]) => void;
  /** The ranked games at the tables put in the town (`applyTables`): `you`, you were stood up off one's stool. */
  onTables?: (gone: Person[], dressed: Person[], came: Person[], you: boolean) => void;
  floor?: boolean;
}): () => void {
  const limits = awayLimits();
  const clock = new AwayClock(Date.now(), limits);
  const extras = testExtras(limits);
  const online = mayTownChat();
  // (A guest, Eric on #542: sees everyone, dressed, with no names; sends no beat of their own, so nobody sees them.)
  const watching = !online && mayReadTownChat();
  let state: AwayState = "here";
  let done = false;
  let inFlight = false;
  let again = false;
  let beatAt = 0;
  let sent = "";
  let floor = !!o.floor;
  const self = (): HereSelf => {
    const h = o.town.you.walker.here();
    const seat = o.shop() ? null : seatNow(o.town);
    return { c: h.c, r: h.r, idleMs: clock.idleMs(Date.now()), hidden: document.hidden, shop: o.shop(), ...(floor ? { floor: true } : {}), ...(seat ? { seat } : {}) };
  };
  const post = (body: Record<string, unknown>, keepalive: boolean) =>
    fetch("/api/town/here", { method: "POST", credentials: "same-origin", keepalive, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...extras }) });
  const beat = () => {
    if ((!online && !watching) || done) return;
    if (inFlight) return void (again = true);
    inFlight = true;
    const me = self();
    beatAt = Date.now();
    sent = `${me.c},${me.r},${state},${me.shop},${me.seat ?? ""}`;
    void post(online ? { ...me } : { watch: true }, false)
      .then((res) => {
        if (res.ok) floor = false;
        return res.ok ? res.json() : null;
      })
      .then((b: { others?: unknown; tables?: unknown } | null) => {
        if (done || !b || !Array.isArray(b.others)) return;
        // (The tables' games first: whoever the list says is in a match isn't in `others`, and their stools are held before anyone's
        // placed.)
        const m = applyTables(o.town, Array.isArray(b.tables) ? b.tables.filter(isMatch) : [], performance.now());
        o.onTables?.(m.gone, m.dressed, m.came, m.you);
        const { gone, dressed, came } = applyHere(o.town, b.others.filter(isOther), performance.now());
        o.onOthers?.(gone, dressed, came);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
        if (again) {
          again = false;
          beat();
        }
      });
  };
  const out = () => {
    if (done) return;
    leave();
    o.onOut();
  };
  const leave = () => {
    if (done) return;
    done = true;
    if (online) void post({ leave: true }, true).catch(() => undefined);
  };
  /** Every second (and on any change): the clock, your "zzz", and a beat when it's due or something changed. */
  const check = () => {
    if (done) return;
    const now = Date.now();
    clock.setBusy(o.busy(), now);
    clock.setLoading(o.loading?.() ?? false, now);
    if (o.town.you.walker.moving()) clock.act(now);
    const s = clock.state(now);
    if (s === "out") return out();
    if (s !== state) {
      state = s;
      o.onState(s);
    }
    if (document.hidden) return;
    const h = o.town.you.walker.here();
    const key = `${h.c},${h.r},${state},${o.shop()},${(!o.shop() && seatNow(o.town)) || ""}`;
    if ((online && key !== sent) || now - beatAt >= TOWN_AFK.beatSec * 1000) beat();
  };
  const onInput = () => {
    clock.act(Date.now());
    if (state === "zzz") check();
  };
  const onVisibility = () => {
    const now = Date.now();
    if (document.hidden) {
      clock.hidden(true, now);
      // (One beat as the page goes: the server counts you away from now, whether or not this phone runs another timer.)
      if (online && !done) void post({ ...self(), hidden: true }, true).catch(() => undefined);
      return;
    }
    // Back: too long away is out (before the clock forgets when you left).
    if (clock.state(now) === "out") return out();
    clock.hidden(false, now);
    check();
    beat();
  };
  const timer = setInterval(check, 1000);
  const opts = { capture: true, passive: true } as const;
  const inputs = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
  for (const e of inputs) addEventListener(e, onInput, opts);
  document.addEventListener("visibilitychange", onVisibility);
  // (The page closing: gone for everyone at once. Kept in the back-forward cache and shown again, the next beat brings you back.)
  const onPageHide = () => void (online && !done && post({ leave: true }, true).catch(() => undefined));
  addEventListener("pagehide", onPageHide);
  if (document.hidden) clock.hidden(true, Date.now());
  beat();
  return () => {
    clearInterval(timer);
    for (const e of inputs) removeEventListener(e, onInput, opts);
    document.removeEventListener("visibilitychange", onVisibility);
    removeEventListener("pagehide", onPageHide);
    leave();
  };
}

/** A guest's town time used so far in this page load (afk.ts GuestTime): a reload starts it again. */
let guestUsed = 0;

/**
 * How long a guest may walk round the town (ms), or null: signed in, or nowhere to make an account (no accounts, or no way to sign
 * in: local and e2e, where `?townguest=` turns it on for a test). TOWN_AFK.guestTownSec.
 */
export function guestLimitMs(): number | null {
  const a = account();
  if (!a.config?.accounts || !a.profile || a.profile.user.signedIn) return null;
  const sw = readGuestSwitch(asked("townguest"));
  if (sw !== undefined) return sw;
  return a.config.onlineNeedsSignIn ? TOWN_AFK.guestTownSec * 1000 : null;
}

/** A guest's clock in the town until the returned function is called; `onOut` once their time is up (at once if it already was). */
export function watchGuest(limitMs: number, onOut: () => void): () => void {
  const t = new GuestTime(guestUsed);
  let done = false;
  const check = () => {
    if (done || t.usedMs(Date.now()) < limitMs) return;
    done = true;
    onOut();
  };
  const onVisibility = () => {
    t.visible(!document.hidden, Date.now());
    check();
  };
  t.visible(!document.hidden, Date.now());
  const timer = setInterval(check, 250);
  document.addEventListener("visibilitychange", onVisibility);
  check();
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    t.visible(false, Date.now());
    guestUsed = t.usedMs(Date.now());
  };
}
