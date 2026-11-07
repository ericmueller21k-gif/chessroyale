/**
 * The sprite kit (Nov 6, docs/decisions/2026-11-06-sprite-kit.md): one shared, data-driven way to make a boss's or a
 * character's pixel figure, so a new figure is data, not drawing code of its own. Bosses stay 2D pixel sprites (Eric, Nov 6).
 *
 * - **The shared rules** (`KIT`): the outline key and its 1-px ring (sprite.ts draws it round every outlined part), palette
 *   ramps of at least 3 steps (dark to light), nearest filtering from 1.5x up (`crisp`), and each figure class's size (`TEXEL`).
 * - **A sprite is data** (`Sprite`): its character (palette, parts as pixel grids, frames as layers of parts: sprite.ts), the
 *   way the art faces as drawn, its anchors (feet, head, hands), its ramps and its frame templates (idle, walk, talk, attack,
 *   hurt: which of its animations plays each).
 * - **Facing is data.** A sprite says which way its art faces; a caller says which way the figure must face (toward the board,
 *   toward the opponent, the way it walks), and the kit mirrors it or not (`facingAs`, `mirrorFor`). No caller guesses.
 * - **One renderer** (`spriteCanvas`): data to cached canvases, for the town, the rooms, the intros and the boards.
 *
 * Smudgy is the pilot (smudgy.ts `SMUDGY_SPRITE`); the other figures move onto it when they're next touched. `sprites.ts` lists
 * the sprites on the kit, and the facing data of figures not on it yet.
 */
import { TOWN_FEEL } from "../town/feel.ts";
import { SIDE_FEEL } from "./side-size.ts";
import { renderFrame, type Character } from "./sprite.ts";

export type Facing = "left" | "right";
export type Pt = readonly [x: number, y: number];

/** The frame templates a sprite fills in: which of its animations plays each. `idle` is required. */
export const TEMPLATES = ["idle", "walk", "talk", "attack", "hurt"] as const;
export type Template = (typeof TEMPLATES)[number];

export const KIT = {
  /** The palette key of the 1-px ink outline every outlined part gets (sprite.ts). */
  outline: "k",
  /** A hue's ramp has at least this many steps, dark to light (3 for a new sprite; the pilot keeps his own 4 and 5). */
  rampSteps: 3,
  /** Drawn at this many screen px an art px or more, a sprite is scaled with nearest filtering (crisp); smaller, smoothed. */
  nearestFrom: 1.5,
} as const;

/**
 * Each figure class's size: a town walker and a room's intro figure in squares tall (the town's bosses, TOWN_FEEL.bossSquares,
 * times its own `bossScale`); a board figure in screen px an art px (a phone's boss bar its kit's `barScale`, a computer's side
 * figure from `min` to `max` by the room beside the board: side-size.ts).
 */
export const TEXEL = {
  town: { squares: TOWN_FEEL.bossSquares },
  intro: { squares: TOWN_FEEL.bossSquares },
  board: { bar: 1, min: SIDE_FEEL.min, max: SIDE_FEEL.max },
} as const;

/** Whether a sprite drawn `drawn` px tall from `art` px stays crisp (nearest filtering): KIT.nearestFrom or more. */
export const crisp = (drawn: number, art: number): boolean => drawn >= art * KIT.nearestFrom;

export interface Anchors {
  /** The ground point between its feet (the character's `foot`). */
  feet: Pt;
  /** The middle of its head. */
  head: Pt;
  /** Its hands, by name (Smudgy: `brush`, `palette`). */
  hands: Readonly<Record<string, Pt>>;
}

export interface Sprite {
  /** Its palette, parts (pixel grids) and frames (sprite.ts). */
  ch: Character;
  /** The way its art faces as drawn. */
  facing: Facing;
  /** In its frame's pixels, as drawn (at rest: idle's first frame). */
  anchors: Anchors;
  /** Each hue's ramp: its palette keys, dark to light. */
  ramps: Readonly<Record<string, string>>;
  /** Its frame templates: the animation each plays. */
  frames: Readonly<{ idle: string } & Partial<Record<Template, string>>>;
  /** Palette keys of parts drawn without an outline (a ground shadow, a glow, specks): the only ones allowed at its silhouette's edge besides the ink. */
  unlined?: string;
}

/** The facing a figure at `from` needs to look toward `to` (page or world x). */
export const toward = (from: number, to: number): Facing => (to < from ? "left" : "right");

/** Whether a sprite's art must be mirrored to face `want`. */
export const mirrorFor = (artFacing: Facing, want: Facing): boolean => artFacing !== want;

/** A point mirrored across a frame `w` px wide (pixel corners: x and w - x). */
const flipPt = ([x, y]: Pt, w: number): Pt => [w - x, y];

const faced = new WeakMap<Sprite, Sprite>();
/**
 * The sprite facing `want`: itself, or mirrored pixel for pixel (its character's `mirror`, its feet and anchors mirrored across
 * its frame). Made once per sprite.
 */
export function facingAs(s: Sprite, want: Facing): Sprite {
  if (!mirrorFor(s.facing, want)) return s;
  let m = faced.get(s);
  if (!m) {
    const w = s.ch.w;
    const ch: Character = { ...s.ch, mirror: !s.ch.mirror, foot: flipPt(s.ch.foot, w) };
    const hands = Object.fromEntries(Object.entries(s.anchors.hands).map(([k, p]) => [k, flipPt(p, w)]));
    m = { ...s, ch, facing: want, anchors: { feet: flipPt(s.anchors.feet, w), head: flipPt(s.anchors.head, w), hands } };
    faced.set(s, m);
  }
  return m;
}

/**
 * The board figure (a phone's boss bar, a computer's side figure, the result screen): the boss stands left of the board on
 * both, the God King and your pawn on its right, so it faces our right, toward the board and its opponent.
 */
export const BOARD_FACING: Facing = "right";

/** A frame drawn once to a canvas, by character (its look and mirror included), animation and frame. */
const canvases = new WeakMap<Character, Map<string, HTMLCanvasElement>>();
/** One frame of a character as a canvas, made the first time it's asked for. */
export function spriteCanvas(ch: Character, anim: string, i: number, look?: string): HTMLCanvasElement {
  let byFrame = canvases.get(ch);
  if (!byFrame) canvases.set(ch, (byFrame = new Map()));
  const key = `${anim}:${i}:${look ?? ""}`;
  let c = byFrame.get(key);
  if (!c) {
    const r = renderFrame(ch, ch.anims[anim]!.frames[i]!, look ? { look } : {});
    c = document.createElement("canvas");
    c.width = r.w;
    c.height = r.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
    byFrame.set(key, c);
  }
  return c;
}
