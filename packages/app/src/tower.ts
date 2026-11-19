import { BATTLE_TOWER, type Settings } from "@chessroyale/core";
import type { RunnerSnapshot } from "@chessroyale/chess";
import type { MoveRecord } from "./game.ts";

/**
 * The Battle Tower's solo climb on this device (PR 10; docs/areas/battle-tower.md): the server's routes (`/api/tower`, PR 9: the run
 * and the floor under way are the server's), the floor's game kept on the device after every step (so a reload rejoins it where it
 * was), and the rules the screens follow: which floor to play, when leaving is free, what a result sends. The screens: the tower's
 * own (screens/Tower.tsx, route /tower) and the battle (a Boss alone battle with the floor's bosses: solo.ts).
 */

// ---------------- The server's answers (server/src/tower.ts) ----------------

/** The floor under way: its id (sent back with the result) and when it began, by the server's clock. */
export interface Fight {
  id: string;
  startedAt: number;
}

/** A run, as the server shows it. */
export interface TowerRun {
  id: string;
  kind: "solo" | "party";
  /** The floor to fight (1-99). */
  floor: number;
  /** Its bosses in turn order (between floors: as its start would deal them now). */
  bosses: string[];
  /** The floors won so far, each one's bosses, floor 1 first. */
  beaten: string[][];
  fight: Fight | null;
  startedAt: number;
}

/** GET /api/tower: your open runs and best floors (0: none won yet). */
export interface TowerState {
  runs: { solo: TowerRun | null; party: TowerRun | null };
  best: { solo: number; party: number };
}

/** POST /api/tower/floor/start: the floor begun, or (`under`) the one already under way; `resting`: its bosses rest now (leaving is free). */
export interface FloorStart {
  fight: Fight;
  floor: number;
  bosses: string[];
  settings: Partial<Settings>;
  under?: boolean;
  resting?: boolean;
  run: TowerRun;
}

export type FloorOutcome = "won" | "lost" | "drawn";

/** An answer: the body, or the refusal's status and body (a 409 carries `run` and `best` to read again, or `confirm`). */
export type Answer<T> = { ok: true; body: T } | { ok: false; status: number; body: { message?: string; confirm?: boolean; run?: TowerRun | null; best?: number; fight?: Fight } };

/** What the screens say when the server can't be reached. */
export const TOWER_WORDS = {
  offline: "Couldn't reach the tower. Check your connection and try again.",
  elsewhere: "This floor is under way on another device. Leaving it here counts as a loss and ends your run.",
  resting: "This floor's bosses are resting for a bit. Leaving it now is free: the same floor waits for you.",
  broken: "This run can't be played. Start a new one.",
  replace: (floor: number) => `Your run on floor ${floor} ends. Start a new run from floor 1?`,
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One ask; asked once more after a moment when it fails on the way or on the server (a refusal, a 4xx, isn't asked again). */
async function ask<T>(path: string, body?: object): Promise<Answer<T>> {
  const init: RequestInit = body ? { method: "POST", body: JSON.stringify(body), credentials: "same-origin", headers: { "content-type": "application/json" } } : { credentials: "same-origin" };
  for (let tries = 0; ; tries++) {
    let status = 0;
    let read: unknown = null;
    try {
      const res = await fetch(path, init);
      status = res.status;
      read = await res.json().catch(() => null);
    } catch {
      // (No answer: as a server error.)
    }
    const plain = read && typeof read === "object" ? (read as Record<string, unknown>) : null;
    if (status >= 200 && status < 300 && plain) return { ok: true, body: plain as T };
    if ((status === 0 || (status >= 500 && status !== 503)) && tries === 0) {
      await sleep(900);
      continue;
    }
    return { ok: false, status, body: { message: status === 0 ? TOWER_WORDS.offline : undefined, ...(plain ?? {}) } };
  }
}

export const towerApi = {
  state: () => ask<TowerState>("/api/tower"),
  newRun: (confirm: boolean) => ask<{ run: TowerRun }>("/api/tower/run", confirm ? { confirm: true } : {}),
  start: () => ask<FloorStart>("/api/tower/floor/start", {}),
  finish: (fight: string, outcome: FloorOutcome) => ask<{ outcome: FloorOutcome; floor: number; status: string; run: TowerRun | null; best: number }>("/api/tower/floor/finish", { fight, outcome }),
  stop: (fight: string, moves: number | undefined, free = false) => ask<{ stopped: "between" | "free" | "lost"; floor?: number; status?: string; run: TowerRun | null }>("/api/tower/stop", { fight, ...(moves !== undefined ? { moves } : {}), ...(free ? { free: true } : {}) }),
};

// ---------------- The floor kept on this device ----------------

/** The floor's game as it stood at its last step (solo.ts `keep`): the match (the runner's snapshot), your moves so far. */
export interface KeptGame {
  snapshot: RunnerSnapshot;
  moves: MoveRecord[];
  /** The bosses' entrance has played. */
  intro: boolean;
}

/**
 * This device's floor: the fight the server started for it, its bosses and settings, the game as it stood, and once it's over, the
 * result to send (`done`; `left`: you left, after `moves` of your moves). Kept until the server has taken the result.
 */
export interface KeptFloor {
  v: 1;
  fight: string;
  floor: number;
  bosses: string[];
  settings: Partial<Settings>;
  beaten: string[][];
  game?: KeptGame;
  done?: FloorOutcome | "left";
  moves?: number;
}

const KEY = "brc.tower.solo";

/** A kept floor read back, or null when there's none or it isn't one (another version, a damaged entry). */
export function readKept(text: string | null): KeptFloor | null {
  if (!text) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  const k = v as Partial<KeptFloor> | null;
  if (!k || typeof k !== "object" || k.v !== 1 || typeof k.fight !== "string" || !Number.isInteger(k.floor) || !Array.isArray(k.bosses) || !k.bosses.every((b) => typeof b === "string")) return null;
  if (!k.settings || typeof k.settings !== "object" || !Array.isArray(k.beaten)) return null;
  if (k.done !== undefined && !["won", "lost", "drawn", "left"].includes(k.done)) return null;
  const g = k.game;
  const game = g && typeof g === "object" && g.snapshot && typeof g.snapshot === "object" && (g.snapshot as Partial<RunnerSnapshot>).state && Array.isArray((g.snapshot as Partial<RunnerSnapshot>).boards) && Array.isArray(g.moves) ? { snapshot: g.snapshot, moves: g.moves, intro: !!g.intro } : undefined;
  return { v: 1, fight: k.fight, floor: k.floor!, bosses: k.bosses, settings: k.settings, beaten: k.beaten, ...(game ? { game } : {}), ...(k.done ? { done: k.done } : {}), ...(Number.isInteger(k.moves) ? { moves: k.moves } : {}) };
}

export function loadKept(): KeptFloor | null {
  try {
    return readKept(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveKept(k: KeptFloor): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(k));
  } catch {
    // (No storage, or full: a reload then can't rejoin, and the floor counts as left: the area page's "nothing to restore".)
  }
}

export function clearKept(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // No storage.
  }
}

// ---------------- The rules the screens follow ----------------

/**
 * What a floor's start answer means for this device: `fresh`, a floor to play from its start (begun now, or begun here with no move
 * kept yet); `rejoin`, the floor under way kept here, played on from where it was; `resting`, its bosses rest (leaving is free, the
 * only choice); `elsewhere`, under way with nothing kept here (another device, or storage cleared): ask before the counted stop.
 */
export function floorPlan(start: Pick<FloorStart, "fight" | "under" | "resting">, kept: KeptFloor | null): "fresh" | "rejoin" | "resting" | "elsewhere" {
  if (start.resting) return "resting";
  const mine = kept?.fight === start.fight.id && !kept.done;
  if (!start.under) return "fresh";
  if (mine && kept!.game) return "rejoin";
  return mine ? "fresh" : "elsewhere";
}

/** Leaving the floor under way after `crowdMoves` of your moves is free (core's leaveFloor): before your 2nd move. */
export const leaveIsFree = (crowdMoves: number): boolean => crowdMoves < BATTLE_TOWER.leaveFreeBefore;

/** A battle's result as the tower takes it. */
export const floorOutcome = (r: "crowd" | "boss" | "draw"): FloorOutcome => (r === "crowd" ? "won" : r === "boss" ? "lost" : "drawn");

/** The floor's end, as the result screen shows it: the server's word on the run (`status` "open": climbing on; "top": floor 99 won; "out"). */
export interface TowerEnd {
  outcome: FloorOutcome | "left";
  floor: number;
  status: "open" | "top" | "out";
  run: TowerRun | null;
  best: number;
  /** Couldn't be sent (no connection, or refused): the result is still kept here, sent again from the tower's screen. */
  error?: string;
}

/**
 * Sends a kept floor's result (a finish, or a leave's stop with your moves: the server's leaveFloor decides) and forgets the floor
 * once the server has taken it. A 409 means "read the run again" (the result already taken, or the floor ended elsewhere): its
 * `run` and `best` are the truth, and the floor is forgotten too.
 */
export async function settleKept(k: KeptFloor): Promise<TowerEnd> {
  const done = k.done ?? "left";
  const base = { outcome: done, floor: k.floor };
  if (done === "left") {
    const a = await towerApi.stop(k.fight, k.moves);
    if (!a.ok && a.status !== 409) return { ...base, status: "open", run: null, best: 0, error: a.body.message ?? TOWER_WORDS.offline };
    clearKept();
    const s = await towerApi.state();
    const best = s.ok ? s.body.best.solo : 0;
    const run = s.ok ? s.body.runs.solo : null;
    return { ...base, status: a.ok && a.body.stopped === "free" ? "open" : run && run.floor === k.floor ? "open" : "out", run, best };
  }
  const a = await towerApi.finish(k.fight, done);
  if (a.ok) {
    clearKept();
    return { ...base, status: a.body.status === "top" ? "top" : a.body.status === "open" ? "open" : "out", run: a.body.run, best: a.body.best };
  }
  if (a.status === 409 && !a.body.confirm && "run" in a.body) {
    clearKept();
    const run = a.body.run ?? null;
    return { ...base, status: run ? "open" : "out", run, best: a.body.best ?? 0 };
  }
  if (a.status === 409 && a.body.confirm) clearKept();
  return { ...base, status: "out", run: null, best: 0, error: a.body.message ?? TOWER_WORDS.offline };
}

/** Results being sent, by the floor's fight id: the result screen and the tower's screen never send one twice at once. */
const settling = new Map<string, Promise<TowerEnd>>();
/** Sends a kept floor's result once at a time (settleKept); a failed send may be asked for again. */
export function settle(k: KeptFloor): Promise<TowerEnd> {
  let p = settling.get(k.fight);
  if (!p) {
    p = settleKept(k).then((end) => {
      if (end.error) settling.delete(k.fight);
      return end;
    });
    settling.set(k.fight, p);
  }
  return p;
}

/**
 * A floor being played on this device (the battle's `tower`): what the screens show of the run (the floor, its bosses, the bosses
 * beaten, your best), and the floor kept on the device as the battle goes (`keep` after every step, `done` at its end).
 */
export class FloorPlay {
  constructor(
    public kept: KeptFloor,
    /** Your best floor (solo) as the run's screen last read it. */
    readonly best: number,
  ) {}
  get floor(): number {
    return this.kept.floor;
  }
  get bosses(): readonly string[] {
    return this.kept.bosses;
  }
  get beaten(): readonly string[][] {
    return this.kept.beaten;
  }
  /** The floor kept as it begins (or is rejoined): a reload before its first step still knows this device holds it. */
  begin(): void {
    saveKept(this.kept);
  }
  /** The game as it stands, kept (nothing once it's over). */
  keep(game: KeptGame): void {
    if (this.kept.done) return;
    this.kept = { ...this.kept, game };
    saveKept(this.kept);
  }
  /** The floor's over (a result, or you left after `moves` of your moves): the result to send, kept until the server takes it. */
  done(outcome: FloorOutcome | "left", moves: number): void {
    if (this.kept.done) return;
    const { game: _game, ...rest } = this.kept;
    this.kept = { ...rest, done: outcome, moves };
    saveKept(this.kept);
  }
  /** The result sent (once): the run as the server has it now. */
  settle(): Promise<TowerEnd> {
    return settle(this.kept);
  }
}

// ---------------- Into a floor ----------------

/** A floor to go into: the server's start, the floor kept on this device (new, or the one rejoined), the game to rejoin (null: from its start). */
export interface FloorEntry {
  start: FloorStart;
  kept: KeptFloor;
  game: KeptGame | null;
  best: number;
}

/** What asking for the floor gave: a floor to go into, a question first (`resting`, `elsewhere`, `broken`: start a new run), or why not. */
export type FloorAsk = { kind: "entry"; entry: FloorEntry } | { kind: "resting" | "elsewhere"; start: FloorStart } | { kind: "broken" } | { kind: "error"; message: string };

/** The run's floor started (or the one under way answered) and what it means here (floorPlan): the tower's screen's CONTINUE, a win's Continue. */
export async function askFloor(best: number): Promise<FloorAsk> {
  const a = await towerApi.start();
  if (!a.ok) return a.status === 409 && a.body.confirm ? { kind: "broken" } : { kind: "error", message: a.body.message ?? TOWER_WORDS.offline };
  const start = a.body;
  const kept = loadKept();
  const plan = floorPlan(start, kept);
  if (plan === "resting" || plan === "elsewhere") return { kind: plan, start };
  if (plan === "rejoin") return { kind: "entry", entry: { start, kept: kept!, game: kept!.game!, best } };
  return { kind: "entry", entry: { start, kept: { v: 1, fight: start.fight.id, floor: start.floor, bosses: start.bosses, settings: start.settings, beaten: start.run.beaten }, game: null, best } };
}

let floorHandler: ((e: FloorEntry) => void) | null = null;
/** The app's way into a floor's battle (App.tsx registers it). */
export function onEnterFloor(fn: (e: FloorEntry) => void): () => void {
  floorHandler = fn;
  return () => {
    if (floorHandler === fn) floorHandler = null;
  };
}

/**
 * Into a floor: the only way the tower's screen starts one (a new floor, the next after a win, or one rejoined). For now straight to
 * the battle; PR 11b puts the floor room's walk-in in front of it.
 */
export function enterTowerFloor(e: FloorEntry): void {
  floorHandler?.(e);
}
