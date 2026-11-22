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
  /** A party's floor: its match room (its result is the room's; Nov 20). */
  lobby?: string;
}

/** A run, as the server shows it. */
export interface TowerRun {
  id: string;
  kind: "solo" | "party";
  /** The floor to fight (1-99). */
  floor: number;
  /** Its bosses in turn order (between floors: as its start would deal them now). */
  bosses: string[];
  /** The floors won so far, each one's bosses, floor 1 first (a floor lost with a life spent isn't one: Nov 20). */
  beaten: string[][];
  fight: Fight | null;
  startedAt: number;
  /** The lives left (Nov 20: BATTLE_TOWER.lives a run) and the floors lost so far, in order (the run's recap). */
  lives: number;
  lost: number[];
  /** A party copy's (Nov 20): the others who climbed it, and whether it's played on alone. */
  mates?: { uid: string; name: string }[];
  alone?: boolean;
}

/**
 * What the run's strip shows of a floor (the floor, its bosses, the floors beaten, the lives left going into it: Nov 20): a solo floor's
 * FloorPlay, or a party floor's (Nov 20). No lives known (a floor kept before lives): all of them.
 */
export interface TowerStripInfo {
  readonly floor: number;
  readonly bosses: readonly string[];
  readonly beaten: readonly string[][];
  readonly lives?: number;
}

/** Which of your runs: your solo run, or your party copy played on alone (Nov 20: solo from then on). */
export type RunKind = "solo" | "party";

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

/** A run's lives in words, from the setting (the review of #839, finding 5: never a number written into the words): "two lives", "one life", "no lives"; 11 and up in digits. */
export function livesWords(n: number): string {
  const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return `${words[n] ?? String(n)} ${n === 1 ? "life" : "lives"}`;
}
/** "first", "second", "third", …; 11 and up in digits ("11th", "22nd"). */
export function ordinal(n: number): string {
  const words = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  if (words[n - 1]) return words[n - 1]!;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the screens say when the server can't be reached. */
export const TOWER_WORDS = {
  offline: "Couldn't reach the tower. Check your connection and try again.",
  /** (A counted leave: a life spent, or with none left (`lives`, the run's going in) the run's end: Nov 20.) */
  elsewhere: (lives: number) => `This floor is under way on another device. Leaving it here counts as a loss${lives > 0 ? ": it costs a life." : " and ends your run."}`,
  resting: "This floor's bosses are resting for a bit. Leaving it now is free: the same floor waits for you.",
  broken: "This run can't be played. Start a new one.",
  replace: (floor: number) => `Your run on floor ${floor} ends, and a new one starts on floor 1.`,
  /** The clerk's line with no climb under way (Nov 20: lives; Nov 20, Eric: no floor count shown): "How high can you climb? Two lives: the third loss ends it." */
  climb: `How high can you climb? ${capital(livesWords(BATTLE_TOWER.lives))}: the ${ordinal(BATTLE_TOWER.lives + 1)} loss ends it.`,
  /** The clerk's card's lives line with no solo climb: "Two lives a climb". */
  livesAClimb: `${capital(livesWords(BATTLE_TOWER.lives))} a climb`,
} as const;

/** The lives a run has as the screens show them: none known (a floor or answer from before lives), all of them; never fewer than 0 or more than all. */
export const livesOf = (n: number | undefined): number => (n === undefined || !Number.isFinite(n) ? BATTLE_TOWER.lives : Math.max(0, Math.min(BATTLE_TOWER.lives, Math.floor(n))));

/** "1 life left", "2 lives left", "no lives left". */
export const livesLeftWords = (n: number): string => (n <= 0 ? "no lives left" : `${n} ${n === 1 ? "life" : "lives"} left`);

/** The run's recap of its floors lost (Eric, Nov 20: "in your recap, it would show like that you lost ... floor 8"): "Lost floor 8", "Lost floors 8 and 11", "Lost floors 3, 8 and 11"; none, "". */
export function lostWords(lost: readonly number[]): string {
  // (A floor lost again, "Lost floor 2 twice": a party gone back to a floor one of its members lost with it in the room keeps that life
  // spent, and can lose the floor again (the review of #839, finding 1).)
  const floors = [...new Set(lost)].map((f) => {
    const n = lost.filter((x) => x === f).length;
    return n === 1 ? `${f}` : `${f} ${n === 2 ? "twice" : `${n} times`}`;
  });
  if (!floors.length) return "";
  if (floors.length === 1) return `Lost floor ${floors[0]}`;
  return `Lost floors ${floors.slice(0, -1).join(", ")} and ${floors[floors.length - 1]}`;
}

/** A floor not won, in words: "You lost floor 8." (`who`: "Your party lost floor 8."), "Floor 8 was a draw.", "You left floor 8.". */
export const notWon = (outcome: FloorOutcome | "left", floor: number, who = "You"): string =>
  outcome === "drawn" ? `Floor ${floor} was a draw.` : outcome === "left" ? `You left floor ${floor}.` : `${who} lost floor ${floor}.`;

/**
 * The result line after a floor not won that the climb goes on from (Eric, Nov 20: "it just takes you on to the next match, and it just
 * counts"): "You lost floor 8. It still counts: 1 life left." (notWon's words first).
 */
export const spentLine = (outcome: FloorOutcome | "left", floor: number, lives: number, who = "You"): string => `${notWon(outcome, floor, who)} It still counts: ${livesLeftWords(lives)}.`;

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

/** The body's `kind` for a party copy played alone (none for the solo run, as before). */
const kindOf = (kind: RunKind = "solo") => (kind === "party" ? { kind } : {});

export const towerApi = {
  state: () => ask<TowerState>("/api/tower"),
  newRun: (confirm: boolean) => ask<{ run: TowerRun }>("/api/tower/run", confirm ? { confirm: true } : {}),
  start: (kind?: RunKind) => ask<FloorStart>("/api/tower/floor/start", { device: deviceId(), ...kindOf(kind) }),
  finish: (fight: string, outcome: FloorOutcome, kind?: RunKind) =>
    ask<{ outcome: FloorOutcome; floor: number; status: string; lives?: number; lost?: number[]; run: TowerRun | null; best: number }>("/api/tower/floor/finish", { fight, outcome, ...kindOf(kind) }),
  stop: (fight: string, moves: number | undefined, free = false, kind?: RunKind) =>
    ask<{ stopped: "between" | "free" | "lost"; floor?: number; status?: string; lives?: number; lost?: number[]; run: TowerRun | null }>("/api/tower/stop", { fight, ...(moves !== undefined ? { moves } : {}), ...(free ? { free: true } : {}), ...kindOf(kind) }),
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
  /**
   * This turn's power-up used (its hints seen), kept as it's used: a rejoin's turn starts with it spent and its hints fetched again (they're
   * paid for), never with it back (the delta review of #885, D4). Unset: none used this turn, or not your turn.
   */
  powerUp?: true;
  /**
   * Your move as it was accepted, kept before it's scored (the judge's await), so a reload while it's scored can't take it back: a rejoin
   * plays it as that turn's move (the review of #885, I2). Its time (`thinkMs`), a power-up used on it, Hollow's dark ending the turn,
   * the God King called to play it (`king`: the delta review, D5); in a Solo raid the bots' picks planned by then, shown from your pick
   * on, and those made with a power-up (`picks`, `botPowerUps`: runner.plannedPicks; D1).
   */
  pending?: { move: string | null; thinkMs: number; powerUp?: true; darkOut?: true; king?: true; picks?: [string, string][]; botPowerUps?: string[] };
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
  /** Your party copy played on alone (Nov 20): its start, result and leave say so. Unset: your solo run. */
  kind?: "party";
  /** The run's lives going into this floor (Nov 20; the strip's hearts). Unset (kept before lives): all of them. */
  lives?: number;
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

/** A kept game (a floor's, a solo battle's: solo-kept.ts) read back, or null when it isn't one. */
export function readKeptGame(v: unknown): KeptGame | null {
  const g = v as Partial<KeptGame> | null | undefined;
  if (!g || typeof g !== "object" || !g.snapshot || typeof g.snapshot !== "object" || !(g.snapshot as Partial<RunnerSnapshot>).state || !Array.isArray((g.snapshot as Partial<RunnerSnapshot>).boards) || !Array.isArray(g.moves)) return null;
  const p = g.pending;
  const picks = Array.isArray(p?.picks) ? p.picks.filter((x): x is [string, string] => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string").map(([id, move]): [string, string] => [id, move]) : [];
  const botPowerUps = Array.isArray(p?.botPowerUps) ? p.botPowerUps.filter((id): id is string => typeof id === "string") : [];
  const pending = p && typeof p === "object" && (p.move === null || typeof p.move === "string") && typeof p.thinkMs === "number" && Number.isFinite(p.thinkMs) ? { move: p.move, thinkMs: Math.max(0, p.thinkMs), ...(p.powerUp ? { powerUp: true as const } : {}), ...(p.darkOut ? { darkOut: true as const } : {}), ...(p.king === true && p.move === null ? { king: true as const } : {}), ...(picks.length ? { picks } : {}), ...(botPowerUps.length ? { botPowerUps } : {}) } : null;
  return { snapshot: g.snapshot, moves: g.moves, intro: !!g.intro, ...(typeof g.turnMs === "number" && Number.isFinite(g.turnMs) && g.turnMs > 0 ? { turnMs: g.turnMs } : {}), ...(g.powerUp === true ? { powerUp: true as const } : {}), ...(pending ? { pending } : {}) };
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
  const game = readKeptGame(k.game);
  return {
    v: 1,
    fight: k.fight,
    floor: k.floor!,
    bosses: k.bosses,
    settings: k.settings,
    beaten: k.beaten,
    ...(game ? { game } : {}),
    ...(k.done ? { done: k.done } : {}),
    ...(Number.isInteger(k.moves) ? { moves: k.moves } : {}),
    ...(typeof k.xp === "string" ? { xp: k.xp } : {}),
    ...(typeof k.music === "string" ? { music: k.music } : {}),
    ...(k.kind === "party" ? { kind: "party" as const } : {}),
    ...(Number.isInteger(k.lives) ? { lives: livesOf(k.lives) } : {}),
  };
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

/**
 * The floor's end, as the result screen shows it: the server's word on the run (`status` "open": climbing on, after a win or a life spent;
 * "top": floor 99 played through; "out"), the lives left after it and the run's floors lost (Nov 20).
 */
export interface TowerEnd {
  outcome: FloorOutcome | "left";
  floor: number;
  status: "open" | "top" | "out";
  run: TowerRun | null;
  best: number;
  lives: number;
  lost: number[];
  /** A leave before your 2nd move: free, the same floor waiting (back to the lobby, no result). */
  free?: boolean;
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
  // (The lives and floors lost: the server's answer's, else the run's as it is now; a run that's over has none left.)
  const lives = (status: TowerEnd["status"], run: TowerRun | null, said?: { lives?: number; lost?: number[] }) => ({
    lives: status === "out" ? 0 : livesOf(said?.lives ?? run?.lives),
    lost: Array.isArray(said?.lost) ? said.lost : (run?.lost ?? []),
  });
  if (done === "left") {
    const a = await towerApi.stop(k.fight, k.moves, false, k.kind);
    if (!a.ok && a.status !== 409) return { ...base, status: "open", run: null, best: 0, ...lives("open", null), error: a.body.message ?? TOWER_WORDS.offline };
    clearKept();
    const s = await towerApi.state();
    const best = s.ok ? s.body.best.solo : 0;
    const run = s.ok ? s.body.runs[k.kind ?? "solo"] : null;
    // (The stop's own word on the run, else (refused: the floor ended elsewhere) the run now: open, or over.)
    const said = a.ok ? a.body.status : undefined;
    const status = said === "open" || said === "top" || said === "out" ? said : run ? "open" : "out";
    // (Free: the stop's own word; or "between", a stop sent again after its first answer was lost (ask's retry, or the clerk's re-send
    // after a reload), with the run still on this floor: a counted leave always moves the floor on or ends the run (the review of #839,
    // finding 3).)
    const free = a.ok && (a.body.stopped === "free" || (a.body.stopped === "between" && run?.floor === k.floor));
    return { ...base, status, run, best, ...lives(status, run, a.ok ? a.body : undefined), ...(free ? { free } : {}) };
  }
  const a = await towerApi.finish(k.fight, done, k.kind);
  // (A 409 carrying the fight: the floor still under way (a win too soon): the result stays kept, sent again later; audit 2, finding 5.)
  if (!a.ok && a.status === 409 && a.body.fight) return { ...base, status: "open", run: a.body.run ?? null, best: a.body.best ?? 0, ...lives("open", a.body.run ?? null), error: a.body.message ?? TOWER_WORDS.offline };
  if (a.ok) {
    clearKept();
    const status = a.body.status === "top" ? "top" : a.body.status === "open" ? "open" : "out";
    return { ...base, status, run: a.body.run, best: a.body.best, ...lives(status, a.body.run, a.body) };
  }
  if (a.status === 409 && !a.body.confirm && "run" in a.body) {
    clearKept();
    const run = a.body.run ?? null;
    // (The floor counted lost on another device while this one played it out (that device's counted leave): the server's loss stands,
    // never this device's win (the review of #839, finding 2).)
    const outcome = done === "won" && run?.lost?.includes(k.floor) ? "lost" : done;
    return { ...base, outcome, status: run ? "open" : "out", run, best: a.body.best ?? 0, ...lives(run ? "open" : "out", run) };
  }
  if (a.status === 409 && a.body.confirm) clearKept();
  return { ...base, status: "out", run: null, best: 0, ...lives("out", null), error: a.body.message ?? TOWER_WORDS.offline };
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
  /** The run's lives going into this floor (Nov 20). */
  get lives(): number {
    return livesOf(this.kept.lives);
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
export async function askFloor(best: number, kind: RunKind = "solo"): Promise<FloorAsk> {
  const a = await towerApi.start(kind);
  if (!a.ok) return a.status === 409 && a.body.confirm ? { kind: "broken" } : { kind: "error", message: a.body.message ?? TOWER_WORDS.offline };
  const start = a.body;
  const kept = loadKept();
  const plan = floorPlan(start, kept, deviceId());
  if (plan === "resting" || plan === "elsewhere") return { kind: plan, start };
  if (plan === "rejoin") return { kind: "entry", entry: { start, kept: kept!, game: kept!.game!, best } };
  return {
    kind: "entry",
    entry: { start, kept: { v: 1, fight: start.fight.id, floor: start.floor, bosses: start.bosses, settings: start.settings, beaten: start.run.beaten, lives: livesOf(start.run.lives), ...(kind === "party" ? { kind } : {}) }, game: null, best },
  };
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

// ---------------- A party's floor on this device (Nov 20) ----------------

/** A party floor's match room on this device: its code, and the run's strip (so a reload in its match is still the tower's). */
export interface KeptPartyFloor extends TowerStripInfo {
  lobby: string;
}
const PARTY_KEY = "brc.tower.partyFloor";

/** The party floor being played here, as its match starts. */
export function keepPartyFloor(f: KeptPartyFloor): void {
  try {
    localStorage.setItem(PARTY_KEY, JSON.stringify(f));
  } catch {
    // (No storage: a reload in its match plays on without the strip, and goes home after it.)
  }
}

/** The party floor kept here for this match room's code, or null. */
export function partyFloorOf(code: string): KeptPartyFloor | null {
  try {
    const v = JSON.parse(localStorage.getItem(PARTY_KEY) ?? "null") as Partial<KeptPartyFloor> | null;
    if (!v || typeof v.lobby !== "string" || v.lobby.toUpperCase() !== code.toUpperCase() || !Number.isInteger(v.floor) || !Array.isArray(v.bosses) || !Array.isArray(v.beaten)) return null;
    return { lobby: v.lobby, floor: v.floor!, bosses: v.bosses.filter((b): b is string => typeof b === "string"), beaten: v.beaten.filter(Array.isArray) as string[][], ...(Number.isInteger(v.lives) ? { lives: livesOf(v.lives) } : {}) };
  } catch {
    return null;
  }
}

/** The party floor's match is over here. */
export function forgetPartyFloor(): void {
  try {
    localStorage.removeItem(PARTY_KEY);
  } catch {
    // No storage.
  }
}
