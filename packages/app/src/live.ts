import { useEffect, useState } from "preact/hooks";
import { FRONT_DOOR } from "@chessroyale/core";

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
let rider: LiveRider | null = null;
/** A rider joined while a request was out: ask again as soon as it's back. */
let again = false;

/** Rides on the live line's request until the returned function is called (and asks now). */
export function rideLive(r: LiveRider): () => void {
  rider = r;
  if (inFlight) again = true;
  else if (started) void poll();
  return () => {
    if (rider === r) rider = null;
  };
}

async function poll() {
  if (inFlight) return;
  inFlight = true;
  try {
    if (typeof document === "undefined" || document.visibilityState !== "hidden") {
      const r = rider;
      const res = await fetch(`/api/live${r ? `?${r.query()}` : ""}`, { credentials: "same-origin" });
      if (res.ok) {
        const body = (await res.json()) as LiveCounts;
        current = body;
        r?.take(body);
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
