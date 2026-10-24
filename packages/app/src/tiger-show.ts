/**
 * Babur's, the circus tiger's, balloons and hoops on a screen (docs/decisions/2026-10-24-tiger-wired.md; his rules: bosses/tiger.ts).
 * Pure functions of the view and the clock, and the small store every screen of a battle shares (module state, so a screen drawn
 * later carries on what an earlier one started, and a reload replays nothing):
 * - **What's new** (`noteTiger`): his turn's events (`place`, `balloonLand`, `pop`, `hoopsOut`) first seen on this device after its
 *   first look at the battle play; those already there at that first look (a reload, joining late) are drawn from the view and never
 *   played. A landing or pop is timed from the boss screen's moments (as your turn begins) when they have it, else from first sight.
 * - **The pump** (`pumpShows`): bare; the limp balloon put on at its time; the balloon at the stage the battle's clock gives
 *   (`balloonStage`: the page's visible time solo, the server's online: garden-clock.ts), the pump's `grow` as each stage comes on this
 *   screen, a gentle bob once ready; then the release or the pop. A stage reached while the page was hidden, or long ago, just shows.
 * - **The board** (`balloonFen`): the landed piece isn't on its square until the landing's `poof`.
 * - **The rings** (`ringShows`): each hoop's ring from the view's `hoops` (`left` 2: burning, 1: dying), landing as its hoop arrives in
 *   the cast, going out as `hoopsOut` comes.
 */
import { HOOPS_BEATS, TIGER_ANIM, balloonStage, withoutPiece } from "@chessroyale/chess";
import type { BalloonShape } from "@chessroyale/core";
import { BALLOON_COLOR_NAMES, pumpAnim, type BalloonPiece, type Stage } from "./characters/tiger-bar.ts";

/** The piece a balloon's shape is (a fake queen is a queen). */
export const PIECE_OF: Record<BalloonShape, BalloonPiece> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
/** A balloon's color as the sprites' look (0-5). */
export const colorLook = (c: number): string => BALLOON_COLOR_NAMES[((c % 6) + 6) % 6]!;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

// ---------------- The beats (ms) ----------------

/** The release's lifted looks (the pump's `release<Piece>`: 70 + 80 + 80): the flight takes over from its last. */
export const RELEASE_LIFT_MS = 230;
/** The balloon's flight from the pump to its square. */
export const FLY_MS = 520;
/** Its landing on the square (BALLOON_LAND `land<Piece>`), and the `poof` in it where his piece goes on. */
export const LAND_MS = TIGER_ANIM.balloonLand;
export const POOF_AT = 520;
/** The pump's pop (`pop<stage><Piece>` to its bare look), and the limp balloon's put on the nozzle (`put<Piece>` to stage 1). */
export const POP_MS = TIGER_ANIM.pumpPop;
export const PUT_MS = 160;
/** A stage step of the pump (`grow<n><Piece>`). */
export const GROW_MS = TIGER_ANIM.pumpStage;
/** A stage reached up to this long ago (real ms) still plays its step as it's drawn; older, it just shows. */
export const GROW_FRESH_MS = 2500;

/** When a landing's beats come, from its start `at` (as your turn begins): the flight, the landing, his piece on, his cheer. */
export const landBeats = (at: number) => {
  const flyAt = at + RELEASE_LIFT_MS;
  const landAt = flyAt + FLY_MS;
  return { flyAt, landAt, poofAt: landAt + POOF_AT, reactAt: landAt + LAND_MS };
};
/** When a pop's wince comes. */
export const popReactAt = (at: number) => at + POP_MS;

/** Each hoop's ring lands as its hoop arrives (ms into the cast): its throw, then its flight. */
export const ringLandAt = (i: number): number => HOOPS_BEATS.throwsAt[i]! + HOOPS_BEATS.flyMs;

// ---------------- The store ----------------

type TigerEvent = { kind: string; turn: number; shape?: BalloonShape; color?: number; square?: string; blocks?: string[] };
const OURS = new Set(["place", "balloonLand", "pop", "hoopsOut"]);

export interface PlaceShow {
  key: string;
  /** When this device saw it (Date.now()). */
  at: number;
  shape: BalloonShape;
  color: number;
  /** When the limp balloon goes on the nozzle (set as the screen plays it: after his trip, or at once); undefined: not yet decided. */
  putAt?: number;
}
export interface EndShow {
  key: string;
  kind: "land" | "pop";
  /** When it starts (Date.now()): your turn's start on the boss screen, else first sight. `firm`: from the boss screen's moments. */
  at: number;
  firm: boolean;
  shape: BalloonShape;
  color: number;
  square?: string;
  /** The position with his landed piece in it (the board leaves the piece off until the poof). */
  after?: string;
  /** Where the flight starts (the pump's knot, in board units), measured as it first draws. */
  from?: { x: number; y: number };
}
export interface OutShow {
  key: string;
  at: number;
  blocks: string[];
}
export interface TigerShow {
  key: string;
  /** Events there at this device's first look: drawn from the view, never played. */
  old: Set<string>;
  seen: Set<string>;
  place: PlaceShow | null;
  end: EndShow | null;
  out: OutShow | null;
  /** The pump's stage as this device last drew it, for the balloon put on at clock time `of`, and its step in progress. */
  pump: { of: number; shown: number; grow: { stage: number; since: number } | null } | null;
}

const shows = new Map<string, TigerShow>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
/** Told when a landing is noted or moves (the board draws his piece at its poof). */
export function onTigerChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A new battle (BossCharacter.resetBeats): nothing seen yet. */
export function resetTiger(): void {
  shows.clear();
  changed();
}

type BossLike = { id?: string; startMove: number; board: { fen: string; generation: number }; powers?: { events: readonly TigerEvent[] } | null };
export const battleKey = (boss: Pick<BossLike, "id" | "startMove" | "board">): string => `${boss.id}:${boss.startMove}:${boss.board.generation}`;
const eventKey = (e: Pick<TigerEvent, "kind" | "turn">) => `${e.kind}:${e.turn}`;

/**
 * Notes what's new in the boss's events (`moments`: the boss screen's, when it has them, so a landing starts as your turn does) and
 * returns the battle's record. Called as the bar and the board draw: cheap, and the same however often.
 */
export function noteTiger(boss: BossLike, now: number, moments: readonly { kind: string; key: string; at: number }[] = []): TigerShow | null {
  const p = boss.powers;
  if (boss.id !== "tiger" || !p) return null;
  const key = battleKey(boss);
  const evs = p.events.filter((e) => OURS.has(e.kind));
  let rec = shows.get(key);
  if (!rec) {
    rec = { key, old: new Set(evs.map(eventKey)), seen: new Set(), place: null, end: null, out: null, pump: null };
    shows.set(key, rec);
    if (shows.size > 4) shows.delete(shows.keys().next().value!);
  }
  let moved = false;
  for (const e of evs) {
    const k = eventKey(e);
    if (e.kind === "balloonLand" || e.kind === "pop") {
      const m = moments.find((x) => x.key === `${boss.id}:${e.kind}:${e.turn}`);
      // (First seen without the boss screen's time: from now, corrected once that screen gives it, unless it has begun.)
      if (rec.end?.key === k && !rec.end.firm && m && now < rec.end.at) {
        rec.end = { ...rec.end, at: m.at, firm: true };
        moved = true;
      }
    }
    if (rec.old.has(k) || rec.seen.has(k)) continue;
    rec.seen.add(k);
    if (e.kind === "place") rec.place = { key: k, at: now, shape: e.shape ?? "p", color: e.color ?? 0 };
    else if (e.kind === "balloonLand" || e.kind === "pop") {
      const m = moments.find((x) => x.key === `${boss.id}:${e.kind}:${e.turn}`);
      rec.end = { key: k, kind: e.kind === "pop" ? "pop" : "land", at: m?.at ?? now, firm: !!m, shape: e.shape ?? "p", color: e.color ?? 0, ...(e.square ? { square: e.square, after: boss.board.fen } : {}) };
      moved = true;
    } else if (e.kind === "hoopsOut") rec.out = { key: k, at: now, blocks: [...(e.blocks ?? [])] };
  }
  if (moved) changed();
  return rec;
}

/** The record of the battle on screen now, if any (the board's). */
const current = (): TigerShow[] => [...shows.values()];

/**
 * The position the board draws: `fen` with a landing balloon's piece left off its square until the landing's `poof` (only the
 * position right after it: once anything moves, the board is the game's). Unchanged otherwise.
 */
export function balloonFen(fen: string, now: number): string {
  for (const rec of current()) {
    const e = rec.end;
    if (e?.kind === "land" && e.after === fen && e.square && now < landBeats(e.at).poofAt) return withoutPiece(fen, e.square);
  }
  return fen;
}
/** When the board must draw again for a poof still to come (Date.now() time), or null. */
export function nextPoof(now: number): number | null {
  const t = current()
    .map((r) => (r.end?.kind === "land" && r.end.after ? landBeats(r.end.at).poofAt : 0))
    .filter((x) => x > now);
  return t.length ? Math.min(...t) : null;
}

// ---------------- The pump ----------------

export interface PumpBalloon {
  shape: BalloonShape;
  color: number;
  at: number;
  readyAt: number;
}
export interface PumpShow {
  /** The pump's animation, since when (Date.now()), what follows it, its look (the balloon's color). */
  anim: string;
  since: number;
  then?: string;
  look?: string;
  /** Its sounds are quiet (the put: his own `touch` cue is its squeak). */
  quiet?: boolean;
  /** When to draw it again (Date.now() time): a step, a put, a release to come. Null: nothing changes on its own. */
  wake: number | null;
}

/**
 * What the pump shows at `now` (Date.now()) and clock time `clock` (the battle's: garden-clock.ts), for the balloon on the nozzle
 * (`balloon`, the view's) and the battle's record. `toReal` turns a span of clock time into real ms (a test link's faster clock);
 * `visible`: the page is in view (a step reached while hidden just shows). Steps the record's `pump` as it goes.
 */
export function pumpShows(rec: TigerShow | null, balloon: PumpBalloon | null, clock: number, now: number, visible: boolean, toReal: (ms: number) => number = (ms) => ms): PumpShow {
  const end = rec?.end;
  // A landing or pop: the ready balloon until it starts, then the release (the flight takes over) or the pop; bare after.
  if (end && !balloon && now < end.at + (end.kind === "land" ? TIGER_ANIM.pumpRelease : POP_MS)) {
    const piece = PIECE_OF[end.shape];
    const look = colorLook(end.color);
    if (now < end.at) return { anim: pumpAnim("ready", piece), since: 0, look, wake: end.at };
    return { anim: end.kind === "land" ? pumpAnim("release", piece) : pumpAnim("pop", piece, 4), since: end.at, then: "bare", look, wake: null };
  }
  if (!balloon) return { anim: "bare", since: 0, wake: null };
  const piece = PIECE_OF[balloon.shape];
  const look = colorLook(balloon.color);
  // (His put of this balloon, when this device saw it placed.)
  const put = rec?.place && rec.place.shape === balloon.shape && rec.place.color === balloon.color && now - rec.place.at < 60_000 ? rec.place : null;
  if (put && put.putAt === undefined) return { anim: "bare", since: 0, wake: null };
  if (put && now < put.putAt!) return { anim: "bare", since: 0, wake: put.putAt! };
  const { stage, ready } = balloonStage(balloon, clock);
  const stageMs = (balloon.readyAt - balloon.at) / 4;
  const nextAt = ready ? null : stage < 4 ? balloon.at + stage * stageMs : balloon.readyAt;
  const wakeOf = (t: number | null) => (t === null ? null : now + toReal(t - clock) + 30);
  let pump = rec?.pump;
  if (rec && (!pump || pump.of !== balloon.at)) {
    // (Put on in front of us: stage 1 first, so any stage it's already at steps up after the put. Else what it is now just shows.)
    pump = rec.pump = { of: balloon.at, shown: put ? 1 : stage, grow: null };
  }
  const putEnd = put ? put.putAt! + PUT_MS : 0;
  if (put && now < putEnd) return { anim: pumpAnim("put", piece), since: put.putAt!, then: "stage1", look, quiet: true, wake: putEnd };
  if (pump && stage > pump.shown) {
    // A step reached in front of us (the page in view, its time a moment ago, or just after the put) plays from now; one reached
    // while hidden, or long ago, just shows.
    const cameAt = Math.max(putEnd, now - toReal(clock - (balloon.at + (stage - 1) * stageMs)));
    pump.grow = visible && now - cameAt < GROW_FRESH_MS ? { stage, since: now } : null;
    pump.shown = stage;
  }
  const hold = stage === 4 && ready ? pumpAnim("ready", piece) : pumpAnim("stage", piece, stage as Stage);
  const grow = pump?.grow;
  if (grow && grow.stage === stage && stage > 1 && now < grow.since + GROW_MS) return { anim: pumpAnim("grow", piece, stage as Stage), since: grow.since, then: hold, look, wake: wakeOf(nextAt) };
  return { anim: hold, since: 0, look, wake: wakeOf(nextAt) };
}

/** The pump's animation name for a stage, for tests and the e2e: `stage1`, `stage3Knight`, `readyQueen`… */
export const pumpStageAnim = (shape: BalloonShape, stage: number, ready = false): string => (ready ? pumpAnim("ready", PIECE_OF[shape]) : pumpAnim("stage", PIECE_OF[shape], stage as Stage));
export const flyAnim = (shape: BalloonShape) => `fly${cap(PIECE_OF[shape])}`;
export const landAnim = (shape: BalloonShape) => `land${cap(PIECE_OF[shape])}`;

// ---------------- The rings ----------------

export type RingState = "land" | "burn" | "dying" | "out";
/** A burning ring's state by the crowd moves the hoops still stand for (the view's `left`): 2 (or more) burning, 1 dying. */
export const ringState = (left: number): "burn" | "dying" => (left >= 2 ? "burn" : "dying");

export interface RingShow {
  corner: string;
  anim: RingState;
  since: number;
  then?: string;
}

/**
 * Each ring at `now`: during the cast (`cast`: the hoops moment's start, on the boss screen) a ring lands as its hoop arrives and
 * then burns; after it, from the view's `hoops` (burning, then dying); going out (`out`, 400 ms) once `hoopsOut` has come. A reload
 * draws the view's state, never the cast again.
 */
export function ringShows(hoops: { blocks: readonly string[]; left: number } | null | undefined, rec: TigerShow | null, now: number, cast: number | null): RingShow[] {
  const out: RingShow[] = [];
  if (hoops) {
    hoops.blocks.forEach((corner, i) => {
      const landAt = cast === null ? null : cast + ringLandAt(i);
      if (landAt !== null && now < landAt) return;
      if (landAt !== null && now < landAt + TIGER_ANIM.ringLand) out.push({ corner, anim: "land", since: landAt, then: ringState(hoops.left) });
      else out.push({ corner, anim: ringState(hoops.left), since: 0 });
    });
  }
  const o = rec?.out;
  if (o && now < o.at + TIGER_ANIM.ringOut) for (const corner of o.blocks) if (!hoops?.blocks.includes(corner)) out.push({ corner, anim: "out", since: o.at });
  return out;
}
