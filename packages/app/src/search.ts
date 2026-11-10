import { isMuted, play } from "./sound.ts";
import { haptic } from "./haptics.ts";

/**
 * Searching while you browse (Eric, Nov 10; docs/decisions/2026-11-10-search-on-home.md): one app-wide search for every
 * queue (1 v 1's queue, 50 v 50's lobby, Squads' lobby). The connection that holds your place is the app's (App.tsx), not a
 * screen's, so you can step out of the lobby or the search stage and look around. Home shows it in its own mode rows
 * (Home.tsx, `SearchRow`), every other page the slim bar (components/SearchBar.tsx). App sets what's searching
 * (`setAwaySearch`) after every render; the bar reads it from here.
 */

export type SearchMode = "crowd" | "1v1" | "squads";

/** A question asked in place, in the action row (no pop-up): its words, and Yes's line and color. */
export interface SearchAsk {
  question: string;
  note: string;
  yes: string;
  red: boolean;
}

/**
 * One of the three actions under the search (home's second row): a label, its line and what it does. Data, so a mode can
 * change one later (auto chess's own search: "Play vs bot").
 */
export interface SearchSlot {
  label: string;
  line: string;
  /** Red (Cancel). */
  red?: boolean;
  /** Asked first, in the same three slots ("Stop search?" / Yes / No). */
  ask?: SearchAsk;
  /** What it does; null greys it ("Soon"). */
  run: (() => void) | null;
}

/** A search going on while you browse. */
export interface AwaySearch {
  mode: SearchMode;
  /** "50 v 50", "1 v 1", "Squads". */
  name: string;
  /** When the search began (ms, this device's clock). */
  since: number;
  /** The queue type and the lobby's count ("Solo queue · 37 of 100 in the lobby"), now. */
  detail(now: number): string;
  /** 1 v 1 at "Few players online": the bar turns gold (its choices are on the stage). */
  few(now: number): boolean;
  /** Back to the lobby or the search stage. */
  back(): void;
  /** Out of the queue at once (the bar's Cancel, the rows' Yes). */
  cancel(): void;
  /** Cancel, Lobby, Start with bots: left to right. */
  slots: readonly [SearchSlot, SearchSlot, SearchSlot];
}

/** The usual three actions: Cancel (asks), Lobby, Start with bots (asks; greyed "Soon" where a mode has no bot game). */
export function searchSlots(s: { cancel: () => void; back: () => void; bots: (() => void) | null; backLine?: string }): AwaySearch["slots"] {
  return [
    { label: "Cancel", line: "stop searching", red: true, ask: { question: "Stop search?", note: "are you sure", yes: "stop", red: true }, run: s.cancel },
    { label: "Lobby", line: s.backLine ?? "see who's in", run: s.back },
    s.bots
      ? { label: "Start with bots", line: "play now", ask: { question: "Play bots?", note: "ends your search", yes: "play now", red: false }, run: s.bots }
      : { label: "Start with bots", line: "Soon", run: null },
  ];
}

let away: AwaySearch | null = null;
/** Home's rows show the search (so the bar doesn't). */
let onHome = false;
/** The confirm's "Leave queue": the search's name and what to do then (null: no confirm open). */
let leaving: { name: string; go: () => void } | null = null;
const seen = new Set<() => void>();
const emit = () => {
  for (const f of seen) f();
};
const keyOf = (a: AwaySearch | null) => (a ? `${a.mode}:${a.since}` : "");

/** What's searching while you browse (null: none, or you're in its lobby, on its stage or in a game). */
export function setAwaySearch(a: AwaySearch | null) {
  const changed = keyOf(a) !== keyOf(away);
  away = a;
  if (changed) emit();
}
export const awaySearch = () => away;

/** Home's rows show the search (true while they're on screen): the bar stands aside. */
export function setSearchOnHome(v: boolean) {
  if (v === onHome) return;
  onHome = v;
  emit();
}
export const searchOnHome = () => onHome;

/** Asks "Leave the 50 v 50 queue?"; `go` runs if they say so (it leaves the queue, then starts what they picked). */
export function confirmLeaveSearch(name: string, go: () => void) {
  leaving = { name, go };
  emit();
}
export const leaveAsked = () => leaving;
export function answerLeave(leave: boolean) {
  const l = leaving;
  leaving = null;
  emit();
  if (leave) l?.go();
}

/** Redraws on any change here (the bar). */
export function watchSearch(f: () => void): () => void {
  seen.add(f);
  return () => void seen.delete(f);
}

/** A match found while you browse: a sound and a short buzz (the buzz off with Sound off, as it always was for 1 v 1). */
export function searchFoundAlert() {
  play("bannerStart");
  if (!isMuted()) haptic("duelFound");
}

const KEEP_KEY = "hunchess.keepQueue";
/** A lobby's "Keep me in the queue" (checked unless this device unchecked it). */
export function keepInQueue(): boolean {
  try {
    return localStorage.getItem(KEEP_KEY) !== "0";
  } catch {
    return true;
  }
}
export function rememberKeepInQueue(v: boolean) {
  try {
    localStorage.setItem(KEEP_KEY, v ? "1" : "0");
  } catch {
    // Not important.
  }
}

const AWAY_KEY = "hunchess.awaySearch";
/** The lobby you browse away from (this tab), so a reload on any page carries on with it, as 1 v 1's search does. */
export interface AwayLobby {
  kind: "crowd" | "squads";
  code: string;
  since: number;
}
export function savedAwayLobby(): AwayLobby | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(AWAY_KEY) ?? "null") as AwayLobby | null;
    return v && (v.kind === "crowd" || v.kind === "squads") && /^[A-Z2-9]{5}$/.test(v.code) && Number.isFinite(v.since) ? v : null;
  } catch {
    return null;
  }
}
export function saveAwayLobby(v: AwayLobby | null) {
  try {
    if (v) sessionStorage.setItem(AWAY_KEY, JSON.stringify(v));
    else sessionStorage.removeItem(AWAY_KEY);
  } catch {
    // Not important.
  }
}
