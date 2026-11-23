/**
 * Birdie's figure as the game draws it (docs/decisions/2026-11-23-birdie-art.md): one figure, his two forms on one foot point.
 * - Young Birdie (birdie.ts, the art's drawing and its 14 animations, as drawn): moved down `YOUNG_DY` pixels in a frame tall enough
 *   for Armored Birdie, so both stand on the same spot.
 * - Armored Birdie (birdie-armored.ts, his idle as drawn), from his fall on: every animation's `p_` twin (the kit's `powered`, as
 *   Moo's Full Moon): his idle for each loop, and for each one-shot a breath of it (only his idle is drawn yet; Eric's to design).
 * - `gone`: his spot empty while his train rides the board (BIRDIE_BEATS.ride: from his `depart`'s end to his `entrance`).
 * The art runs his train in and out of its frame on purpose (its notes: "the train enters and leaves, and the cap flies off"), and the
 * game's frames never draw on their edge (characters.test.ts): a frame that would is drawn as the art draws it, clipped a pixel inside
 * the frame (`clipped`: the frame baked into one part, its outer ring left empty), every other frame untouched.
 */
import { BIRDIE_BEATS } from "@chessroyale/chess";
import { BOSS_BIRDIE } from "./birdie.ts";
import { BOSS_BIRDIE_ARMORED } from "./birdie-armored.ts";
import { frameKeys, lazyAnim, type Anim, type Character, type Frame, type Layer, type Part } from "./sprite.ts";

const YOUNG = BOSS_BIRDIE;
const ARMORED = BOSS_BIRDIE_ARMORED;
/** Where both forms stand in the game's frame (the farther of their feet from the frame's top left). */
const FOOT: readonly [number, number] = [Math.max(YOUNG.foot[0], ARMORED.foot[0]), Math.max(YOUNG.foot[1], ARMORED.foot[1])];
export const YOUNG_DX = FOOT[0] - YOUNG.foot[0];
export const YOUNG_DY = FOOT[1] - YOUNG.foot[1];
const ARMORED_DX = FOOT[0] - ARMORED.foot[0];
const ARMORED_DY = FOOT[1] - ARMORED.foot[1];
const W = Math.max(YOUNG.w + YOUNG_DX, ARMORED.w + ARMORED_DX);
const H = Math.max(YOUNG.h + YOUNG_DY, ARMORED.h + ARMORED_DY);

/** Armored Birdie's parts, by his own names behind this prefix (the two drawings share none). */
const A = "a:";
/** The frames baked for the frame's edge, by their names. */
const baked = new Map<string, Part>();

/** Both forms' parts in one store: young Birdie's by name, Armored Birdie's behind `A`, and the baked edge frames. */
const PARTS = new Proxy({} as Record<string, Part>, {
  get: (_, k) => (typeof k !== "string" ? undefined : (baked.get(k) ?? (k.startsWith(A) ? ARMORED.parts[k.slice(A.length)] : YOUNG.parts[k]))),
  has: (_, k) => typeof k === "string" && (baked.has(k) || (k.startsWith(A) ? k.slice(A.length) in ARMORED.parts : k in YOUNG.parts)),
  // (Listing them makes none: each is made as it's read, as lazyParts' are.)
  ownKeys: () => [...Object.keys(YOUNG.parts), ...Object.keys(ARMORED.parts).map((k) => A + k), ...baked.keys()],
  getOwnPropertyDescriptor: (_, k) => (typeof k === "string" ? { enumerable: true, configurable: true, get: () => PARTS[k] } : undefined),
});

/** A frame of one form, moved into the game's frame (its parts by their names here). */
function moved(f: Frame, dx: number, dy: number, prefix = ""): Frame {
  const layers = f.layers.map((l): Layer => ({ ...l, part: prefix + l.part, x: l.x + dx, y: l.y + dy }));
  return { ...f, layers, ...(f.specks ? { specks: f.specks.map(([x, y, k]) => [x + dx, y + dy, k] as const) } : {}) };
}

/** The figure as the frames are made (`ch.parts` the store above): it's what frameKeys reads to find a frame touching the edge. */
const FIGURE_BASE = { id: "birdie", name: "Birdie", w: W, h: H, foot: FOOT, palette: { ...YOUNG.palette, ...ARMORED.palette }, halo: YOUNG.halo, parts: PARTS };

/**
 * A frame that would draw on the frame's edge, drawn as one part a pixel inside it: its pixels as it draws them (its parts, outlines,
 * halo, specks and shake: frameKeys), the outer ring left empty. Its palette flashes and cue stay. Any other frame as it is.
 */
function clipped(f: Frame, name: string): Frame {
  const keys = frameKeys({ ...FIGURE_BASE, anims: {} } as Character, f);
  const edge = keys[0]!.some(Boolean) || keys[H - 1]!.some(Boolean) || keys.some((r) => r[0] || r[W - 1]);
  if (!edge) return f;
  const grid = keys.map((row, y) => row.map((c, x) => (!c || x === 0 || y === 0 || x === W - 1 || y === H - 1 ? "." : c)).join(""));
  baked.set(name, { grid, outline: false });
  return { ms: f.ms, layers: [{ part: name, x: 0, y: 0 }], ...(f.cue ? { cue: f.cue } : {}), ...(f.pal ? { pal: f.pal } : {}) };
}

/** One of young Birdie's animations in the game's frame. */
const young = (name: string): Anim =>
  lazyAnim(() => {
    const a = YOUNG.anims[name]!;
    return { loop: a.loop, frames: a.frames.map((f, i) => clipped(moved(f, YOUNG_DX, YOUNG_DY), `edge:${name}:${i}`)) };
  });

/** Armored Birdie's idle in the game's frame. */
const armoredIdle = (): Anim => {
  const a = ARMORED.anims.idle!;
  return { loop: true, frames: a.frames.map((f) => moved(f, ARMORED_DX, ARMORED_DY, A)) };
};
/** A one-shot of his: a breath of his idle (its first breath and back), `cue` on its first frame. */
const armoredBeat = (cue: string): Anim =>
  lazyAnim(() => {
    const idle = armoredIdle().frames;
    const rest = idle[0]!;
    const breath = idle.find((f) => f !== rest && f.layers.some((l, i) => l.y !== rest.layers[i]?.y)) ?? rest;
    return { loop: false, frames: [{ ...breath, ms: 320, cue }, { ...rest, ms: 320 }] };
  });
const armoredLoop = (): Anim => lazyAnim(armoredIdle);

/** His spot empty from the end of his `fall` (where he stands) to the cutscene's hit, when he's back as Armored Birdie. */
const away: Anim = lazyAnim(() => ({ loop: false, frames: [{ ms: Math.max(1, BIRDIE_BEATS.fall.hitAt - YOUNG.anims.fall!.frames.reduce((s, f) => s + f.ms, 0)), layers: [], cue: "away" }] }));

/** His animations as young Birdie draws them (every one of the art's). */
const YOUNG_ANIMS = ["idle", "entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "signal", "depart", "fall"] as const;

/** His spot empty while his train rides (his `depart` is over, and his `entrance` brings him back). */
const gone: Anim = lazyAnim(() => ({ loop: false, frames: [{ ms: BIRDIE_BEATS.ride.backAt - BIRDIE_BEATS.ride.departMs, layers: [], cue: "gone" }] }));

export const BIRDIE_FIGURE: Character = {
  ...FIGURE_BASE,
  anims: {
    ...Object.fromEntries(YOUNG_ANIMS.map((n) => [n, young(n)])),
    gone,
    away,
    // Armored Birdie (his fall on): his idle, and a breath of it for each one-shot, each with its cue.
    p_idle: armoredLoop(),
    p_thinking: armoredLoop(),
    p_smug: armoredLoop(),
    p_rattled: armoredLoop(),
    p_victory: armoredLoop(),
    p_defeat: armoredLoop(),
    p_entrance: armoredBeat("armor"),
    p_move: armoredBeat("armor"),
    p_capture: armoredBeat("armor"),
    p_hurt: armoredBeat("armor"),
    p_check: armoredBeat("armor"),
  },
};

/** Armored Birdie alone (his own frame, his own names): the fall's cutscene and the stills draw him. */
export const BIRDIE_ARMORED = ARMORED;
