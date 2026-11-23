import { useEffect, useState } from "preact/hooks";
import { FRONT_DOOR, type Activity } from "@chessroyale/core";

/**
 * The live line ("214 online · 9 matches running · 31 in queue") and the playing-now list, from GET /api/live.
 * The same request tells the server you're here, so it runs on every screen: every few seconds while a front-door
 * screen shows the numbers (`useLive`), every 30 s otherwise (a match), and not while the tab is hidden.
 */

export interface PlayingNow {
  mode: "crowd" | "boss" | "classic";
  alive: number | null;
  total: number | null;
  bossElo: number | null;
  startedAt: number | null;
}

/** A running match's board (Crowd and raids): the position, the move just played, the crowd's top votes on it. */
export interface LiveMatchBoard {
  fen: string;
  lastMove: string | null;
  /** [SAN, count], most first (a final's one player: [SAN, 1]; none for a boss's move). */
  votes: [string, number][];
  ply: number;
}

export interface LiveCounts {
  online: number;
  matches: number;
  queue: number;
  playing: PlayingNow[];
  /** One running match for the home page's live window (with the most people in it), or null. */
  featured?: (PlayingNow & { board: LiveMatchBoard }) | null;
  waits: { crowd: number | null; boss: number | null };
  /** Seconds a matchmade lobby waits before bots fill it. */
  fillSeconds?: number;
  /** Friends' news for you (when something last arrived): it grows, and friends.ts fetches the friends list. */
  inbox?: number;
}

let current: LiveCounts | null = null;
const listeners = new Set<() => void>();
let watchers = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let inFlight = false;

/**
 * Something that rides on the live line's request: the home page's global chat asks for its new lines this way, so it
 * adds no request of its own (global-chat.ts). `query` is added to the URL; `take` gets the whole answer.
 */
export interface LiveRider {
  query(): string;
  take(body: unknown): void;
}
/** Every rider on now (the global chat and the town square's chat both ride on the town page): their queries go together. */
const riders = new Set<LiveRider>();
/** This app is in a match (App says): the request says so, and friends lists show "In a match". */
let busy = false;
export function setLiveBusy(on: boolean) {
  busy = on;
}
/**
 * What this app is doing (App says): the request says so, and friends' lists show it ("In Chess Town"; core's ACTIVITIES). A change
 * is told at once (one request), not at the next heartbeat, so a friend's list is right within seconds.
 */
let doing: Activity | null = null;
export function setLiveDoing(what: Activity) {
  if (doing === what) return;
  const told = doing !== null;
  doing = what;
  if (!told || !started) return;
  if (inFlight) again = true;
  else void poll();
}
/** Hears every answer (friends.ts reads `inbox`). */
export function onLive(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** A rider joined while a request was out: ask again as soon as it's back. */
let again = false;

/** Rides on the live line's request until the returned function is called (and asks now). */
export function rideLive(r: LiveRider): () => void {
  riders.add(r);
  if (inFlight) again = true;
  else if (started) void poll();
  return () => void riders.delete(r);
}

async function poll() {
  if (inFlight) return;
  inFlight = true;
  try {
    if (typeof document === "undefined" || document.visibilityState !== "hidden") {
      const rs = [...riders];
      const q = new URLSearchParams(rs.map((r) => r.query()).filter(Boolean).join("&"));
      if (busy) q.set("busy", "1");
      if (doing) q.set("doing", doing);
      // (Given up after liveTimeoutMs: a request that never answered stopped every later one, and the chats riding on them.)
      const res = await fetch(`/api/live${q.size ? `?${q}` : ""}`, { credentials: "same-origin", signal: AbortSignal.timeout(FRONT_DOOR.liveTimeoutMs) });
      if (res.ok) {
        const body = (await res.json()) as LiveCounts;
        current = body;
        for (const r of rs) r.take(body);
        listeners.forEach((l) => l());
      }
    }
  } catch {
    // Offline or no server (local dev): try again later.
  } finally {
    inFlight = false;
    if (again) {
      again = false;
      void poll();
    } else schedule();
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void poll(), watchers > 0 ? FRONT_DOOR.livePollMs : FRONT_DOOR.heartbeatMs);
}

/** Starts the heartbeat (once, when the app knows it has accounts). */
export function startLive() {
  if (started) return;
  started = true;
  void poll();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void poll();
  });
}

export const liveNow = () => current;

/**
 * Asks every few seconds (FRONT_DOOR.livePollMs), as a front-door screen does, until the returned function is called:
 * for a screen with a rider but no numbers (the town square's chat). Nothing is asked while the tab is hidden.
 */
export function watchLive(): () => void {
  watchers++;
  if (started) void poll();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    watchers--;
  };
}

/** The live numbers, refreshed every few seconds while the calling screen is open (null until known). */
export function useLive(): LiveCounts | null {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    listeners.add(fn);
    watchers++;
    // Opening a front-door screen: fresh numbers now, then every few seconds.
    if (started) void poll();
    return () => {
      listeners.delete(fn);
      watchers--;
    };
  }, []);
  return current;
}
