import { TOWN_AFK, cleanLook, type ItemLook, type PawnColor } from "@chessroyale/core";
import { lookKey } from "./you-look.ts";
import { testParams, testSwitchesAllowed } from "../test-switches.ts";
import { account } from "../account.ts";
import { AWAY_LIMITS, AwayClock, GuestTime, readAwaySwitch, readGuestSwitch, type AwayLimits, type AwayState } from "./afk.ts";
import { mayReadTownChat, mayTownChat } from "./chat-net.ts";
import { N } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { Walker, spotNear, taken, walkWalker, walkable, type Person, type Sq, type Town } from "./world.ts";

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
}

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
export function applyHere(t: Town, others: readonly HereOther[], now: number): { gone: Person[]; dressed: Person[] } {
  const dressed: Person[] = [];
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
    } else {
      const g = p.walker.goal();
      if (g.c !== sq.c || g.r !== sq.r) walkWalker(p.walker, taken(t, sq.c, sq.r, p.walker) ? (spotNear(t, p.walker, sq, true) ?? sq) : sq);
    }
    p.name = o.name;
    p.zzz = o.zzz;
    const wear = o.look ? cleanLook(o.look) : null;
    const was = "sprite" in p.look ? null : p.look;
    if (!was || was.side !== side || lookKey(wear) !== lookKey(was.wear)) {
      p.look = { side, tint: null, wear: lookKey(wear) ? wear : null };
      dressed.push(p);
    }
  }
  const gone: Person[] = [];
  for (const p of t.people) {
    if (!p.remote || p.home || listed.has(p.id)) continue;
    p.home = true;
    p.zzz = false;
    const i = t.all.indexOf(p.walker);
    if (i >= 0) t.all.splice(i, 1);
    gone.push(p);
  }
  return { gone, dressed };
}

/** What a beat says about you. */
export interface HereSelf {
  c: number;
  r: number;
  idleMs: number;
  hidden: boolean;
  shop: string | null;
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
 * `setLoading`). `onOthers`: the server's answer was put in the town (who left: a card open on them closes).
 */
export function watchAway(o: {
  town: Town;
  shop: () => string | null;
  busy: () => boolean;
  loading?: () => boolean;
  onState: (s: AwayState) => void;
  onOut: () => void;
  onOthers?: (gone: Person[], dressed: Person[]) => void;
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
  const self = (): HereSelf => {
    const h = o.town.you.walker.here();
    return { c: h.c, r: h.r, idleMs: clock.idleMs(Date.now()), hidden: document.hidden, shop: o.shop() };
  };
  const post = (body: Record<string, unknown>, keepalive: boolean) =>
    fetch("/api/town/here", { method: "POST", credentials: "same-origin", keepalive, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...extras }) });
  const beat = () => {
    if ((!online && !watching) || done) return;
    if (inFlight) return void (again = true);
    inFlight = true;
    const me = self();
    beatAt = Date.now();
    sent = `${me.c},${me.r},${state},${me.shop}`;
    void post(online ? { ...me } : { watch: true }, false)
      .then((res) => (res.ok ? res.json() : null))
      .then((b: { others?: unknown } | null) => {
        if (done || !b || !Array.isArray(b.others)) return;
        const { gone, dressed } = applyHere(o.town, b.others.filter(isOther), performance.now());
        o.onOthers?.(gone, dressed);
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
    const key = `${h.c},${h.r},${state},${o.shop()}`;
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
