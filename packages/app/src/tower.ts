import { BATTLE_TOWER, MUSIC, bossDef, floorBossCount, floorStrength, type Settings } from "@chessroyale/core";
import type { RunnerSnapshot } from "@chessroyale/chess";
import type { MoveRecord } from "./game.ts";
import { accountReady } from "./boss-tokens.ts";

/**
 * The Battle Tower's solo climb on this device (PR 10; docs/areas/battle-tower.md): the server's routes (`/api/tower`, PR 9: the run
 * and the floor under way are the server's), the floor's game kept on the device after every step (so a reload rejoins it where it
 * was), and the rules the screens follow: which floor to play, when leaving is free, what a result sends. No screen of its own (PR 11b,
 * Eric, Nov 19): Chess Town's skyscraper is the tower (its clerk, elevator and floor room: town/Town.tsx, town/TowerDesk.tsx), and the
 * battle a Boss alone battle with the floor's bosses (solo.ts).
 */

// ---------------- The server's answers (server/src/tower.ts) ----------------

/** The floor under way: its id (sent back with the result), when it began, by the server's clock, and the id of the device that started it. */
export interface Fight {
  id: string;
  startedAt: number;
  device?: string;
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
  replace: (floor: number) => `Your run on floor ${floor} ends, and a new one starts on floor 1.`,
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One ask; asked once more after a moment when it fails on the way or on the server (a refusal, a 4xx, isn't asked again). */
async function ask<T>(path: string, body?: object): Promise<Answer<T>> {
  // (Your account first: a guest's is made as the app opens, and the tower opened straight from its address asked before it was.)
  await accountReady();
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
  start: () => ask<FloorStart>("/api/tower/floor/start", { device: deviceId() }),
  finish: (fight: string, outcome: FloorOutcome) => ask<{ outcome: FloorOutcome; floor: number; status: string; run: TowerRun | null; best: number }>("/api/tower/floor/finish", { fight, outcome }),
  stop: (fight: string, moves: number | undefined, free = false) => ask<{ stopped: "between" | "free" | "lost"; floor?: number; status?: string; run: TowerRun | null }>("/api/tower/stop", { fight, ...(moves !== undefined ? { moves } : {}), ...(free ? { free: true } : {}) }),
};

/** A boss as the screens draw it: his own, or a safe stand-in for an id this app doesn't know (a boss renamed or removed since). */
export function towerBoss(id: string): { id: string; name: string; icon: string; known: boolean } {
  const d = bossDef(id);
  return d ? { id: d.id, name: d.name, icon: d.icon, known: true } : { id, name: "A boss", icon: "?", known: false };
}

/** A floor's rating as shown: Maia's or Stockfish's number, or "Full strength" from the floor Stockfish plays its best. */
export function floorRating(floor: number, bosses = floorBossCount(floor)): string {
  const s = floorStrength(floor, bosses);
  return s.full ? "Full strength" : String(s.rating);
}

// ---------------- The floor kept on this device ----------------

/** The floor's game as it stood at its last step (solo.ts `keep`): the match (the runner's snapshot), your moves so far. */
export interface KeptGame {
  snapshot: RunnerSnapshot;
  moves: MoveRecord[];
  /** The bosses' entrance has played. */
  intro: boolean;
  /**
   * The time you've used on this turn of yours (ms), kept as you go away (the page hidden or closed): a rejoin gives it back as used,
   * and no time passes while you're away (the director's call on audit 2's finding 2). Unset: none used, or not your turn.
   */
  turnMs?: number;
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
  /** The floor's XP game on the server (xp.ts noteSoloGame), so a rejoin goes on with it rather than starting another (audit 2, finding 6). */
  xp?: string;
  /** The theme its battle plays (pickFloorTheme), picked as it first plays and kept, so a reload plays the same (Nov 19). */
  music?: string;
}

const KEY = "brc.tower.solo";
/** The themes of the last floors' battles on this device, oldest first (MUSIC.towerRecent of them). */
const MUSIC_KEY = "brc.tower.music";

/**
 * A floor's battle's theme (Eric, Nov 19: "It picks a random track between all the bosses, and then it just sticks with it the whole
 * time ... it doesn't reuse the same one for, 5 or 6 rounds. If the same boss shows up again, it would pick the other one"): one of its
 * bosses' themes (`has`: themes.json lists it), at random among those not in `recent` (oldest first); all of them in it: the least
 * recently played. None with a theme: null (no music).
 */
export function pickFloorTheme(bosses: readonly string[], recent: readonly string[], has: (id: string) => boolean, rand = Math.random): string | null {
  const ok = bosses.filter(has);
  if (!ok.length) return null;
  const fresh = ok.filter((b) => !recent.includes(b));
  if (fresh.length) return fresh[Math.min(fresh.length - 1, Math.floor(rand() * fresh.length))]!;
  return ok.reduce((a, b) => (recent.lastIndexOf(b) < recent.lastIndexOf(a) ? b : a));
}
/** The themes the last floors' battles played here, oldest first. */
export function recentFloorThemes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(MUSIC_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-MUSIC.towerRecent) : [];
  } catch {
    return [];
  }
}
function noteFloorTheme(theme: string): void {
  try {
    localStorage.setItem(MUSIC_KEY, JSON.stringify([...recentFloorThemes().filter((t) => t !== theme), theme].slice(-MUSIC.towerRecent)));
  } catch {
    // (No storage: the next floor may repeat it.)
  }
}
const DEVICE_KEY = "brc.tower.device";
let device: string | null = null;
/**
 * This device's id for its floors' starts (audit 2, finding 3): random, kept on the device, sent with every start; the server keeps it in
 * the fight and answers it back, so a retry whose first answer was lost knows the floor is this device's own (floorPlan). No storage: one
 * for as long as the page is open.
 */
export function deviceId(): string {
  if (device) return device;
  try {
    const had = localStorage.getItem(DEVICE_KEY);
    if (had && /^[0-9a-f]{20}$/.test(had)) return (device = had);
  } catch {
    // (No storage: a new one for this page.)
  }
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  device = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(DEVICE_KEY, device);
  } catch {
    // (No storage.)
  }
  return device;
}

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
  const game = g && typeof g === "object" && g.snapshot && typeof g.snapshot === "object" && (g.snapshot as Partial<RunnerSnapshot>).state && Array.isArray((g.snapshot as Partial<RunnerSnapshot>).boards) && Array.isArray(g.moves) ? { snapshot: g.snapshot, moves: g.moves, intro: !!g.intro, ...(typeof g.turnMs === "number" && Number.isFinite(g.turnMs) && g.turnMs > 0 ? { turnMs: g.turnMs } : {}) } : undefined;
  return { v: 1, fight: k.fight, floor: k.floor!, bosses: k.bosses, settings: k.settings, beaten: k.beaten, ...(game ? { game } : {}), ...(k.done ? { done: k.done } : {}), ...(Number.isInteger(k.moves) ? { moves: k.moves } : {}), ...(typeof k.xp === "string" ? { xp: k.xp } : {}), ...(typeof k.music === "string" ? { music: k.music } : {}) };
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
 * only choice); `elsewhere`, under way with nothing kept here (another device, or storage cleared): ask before the counted stop. Under
 * way, started by this device (`device`: the fight carries its id) with nothing kept for it yet: its start's answer was lost (audit 2,
 * finding 3), so it's this device's own, from its start.
 */
export function floorPlan(start: Pick<FloorStart, "fight" | "under" | "resting">, kept: KeptFloor | null, device?: string): "fresh" | "rejoin" | "resting" | "elsewhere" {
  if (start.resting) return "resting";
  const mine = kept?.fight === start.fight.id && !kept.done;
  if (!start.under) return "fresh";
  if (mine && kept!.game) return "rejoin";
  if (mine) return "fresh";
  return !!device && start.fight.device === device && kept?.fight !== start.fight.id ? "fresh" : "elsewhere";
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
  /** Couldn't be sent (no connection, or refused): the result is still kept here, sent again by the clerk's card. */
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
  // (A 409 carrying the fight: the floor still under way (a win too soon): the result stays kept, sent again later; audit 2, finding 5.)
  if (!a.ok && a.status === 409 && a.body.fight) return { ...base, status: "open", run: a.body.run ?? null, best: a.body.best ?? 0, error: a.body.message ?? TOWER_WORDS.offline };
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
  /** The time you've used on this turn, kept with the game as it stands (KeptGame.turnMs): the snapshot is the turn's start's. */
  keepTurn(ms: number): void {
    const game = this.kept.game;
    if (this.kept.done || !game) return;
    this.keep({ ...game, turnMs: Math.max(0, Math.round(ms)) });
  }
  /**
   * The theme this floor's battle plays (KeptFloor.music): picked once, as it first asks (`has`: null while themes.json isn't read yet:
   * none yet), then the same for the whole match whoever is to move, and after a reload.
   */
  music(has: ((id: string) => boolean) | null): string | null {
    if (this.kept.music) return this.kept.music;
    if (!has || this.kept.done) return null;
    const pick = pickFloorTheme(this.kept.bosses, recentFloorThemes(), has);
    if (!pick) return null;
    this.kept = { ...this.kept, music: pick };
    saveKept(this.kept);
    noteFloorTheme(pick);
    return pick;
  }
  /** The floor's XP game on the server, kept for a rejoin (KeptFloor.xp). */
  noteXp(id: string): void {
    if (this.kept.done || this.kept.xp === id) return;
    this.kept = { ...this.kept, xp: id };
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

/** The run's floor started (or the one under way answered) and what it means here (floorPlan): as the floor room's board comes up. */
export async function askFloor(best: number): Promise<FloorAsk> {
  const a = await towerApi.start();
  if (!a.ok) return a.status === 409 && a.body.confirm ? { kind: "broken" } : { kind: "error", message: a.body.message ?? TOWER_WORDS.offline };
  const start = a.body;
  const kept = loadKept();
  const plan = floorPlan(start, kept, deviceId());
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

/** Into a floor's battle: the only way one starts (the floor room's walk-in done, town/Town.tsx; or one rejoined after a reload, App.tsx). */
export function enterTowerFloor(e: FloorEntry): void {
  floorHandler?.(e);
}
