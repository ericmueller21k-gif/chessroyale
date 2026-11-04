/**
 * Ginger's elves (Nov 5, drawn by hand on the weekly plan usage), all one elf (elf-rig.ts) in different outfits, 1:1 at the room's
 * scale (37 px a square), 48 x 64, foot [22, 60], facing our right (mirror them to face left). Every elf has `idle` and `walk`
 * (6 x 110 ms, cue `step` f0 and f3, soft); each job adds its own.
 *
 * - The walkers (`npc-ginger-elf-red`, `-green`, `-blue`): each carries a big candy cane striped white and his outfit's color.
 *   `idle` (10 frames, 2 s): leaning on the cane, a look round, a happy bounce, the cane tapped on the floor (cue `tap` f6).
 * - The dispensing pair (a loop along the back wall, SHOP_GINGER_DISPENSE_PATH):
 *   - elf A (`npc-ginger-elf-box`, yellow, a burlap sack on his back, a white candy box): `walk` (the box at his hip),
 *     `tap` (once, 4 frames: reaches up and taps the dispenser's handle, cue `tap` f1), `boxOut` (once, 2 frames: holds the box out
 *     under the chute), `fill` (once, 8 frames, 1.2 s: the candy stream pours in and the box fills, cue `pour` f0), `full` (once, 5
 *     frames: the full box lifted and tipped over his shoulder into the sack, cue `tip` f2), `idle`.
 *   - elf B (`npc-ginger-elf-pad`, purple, a notepad and a pencil): `walk` (writing as he goes), `write` (loops, 8 frames: looks up
 *     at the dispenser, scribbles, a tick, cue `scribble` f2), `idle`.
 * - The board carriers (`npc-ginger-elf-board-a`, orange, the front; `-board-b`, teal, the back; the intro): `carry` (loops, 6 x
 *   80 ms, running with the board held between them at their hands' height, cue `step` f0 and f3), `toss` (once, 5 frames: a dip,
 *   a heave and a hop, the board let go at f3, cue `heave` f2), `cheer` (loops, 4 frames: an arm up, a hop), `idle`, `walk`.
 *   ELF_BOARD_HANDS: where their hands (the board) are per frame, px over the foot, for the code to hang the board there.
 */
import type { Anim, Character, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { ELF_TALL, elfPalette, FOOT, frame, GROUND, H, OUTFITS, PARTS, RUN, W, WALK, WALK_ARMS, type Look, type Outfit, type Pose } from "./elf-rig.ts";

const ELF = (id: string, name: string, outfit: Outfit, anims: Record<string, Anim>): Character => ({
  id,
  name,
  w: W,
  h: H,
  foot: FOOT,
  palette: elfPalette(outfit),
  halo: "#2a2030",
  parts: PARTS,
  anims,
});
const BREATH = [0, 0, 1, 1, 0, 0] as const;
const walkOf = (look: Look, base: Pose, ms = 110, arms = true): Anim => ({
  loop: true,
  frames: WALK.map((w, i) => frame(look, ms, { ...base, feet: w.feet, bob: w.bob, ...(arms && !base.hold ? { far: WALK_ARMS[i]![0], near: WALK_ARMS[i]![1] } : {}), flop: w.bob ? 1 : 0 }, i === 0 || i === 3 ? { cue: "step" } : {})),
});

// ---- The walkers: a big candy cane each.

const caneIdle = (look: Look): Anim => ({
  loop: true,
  frames: [
    frame(look, 220, { hold: "cane" }),
    frame(look, 200, { hold: "cane", bob: 1 }),
    frame(look, 220, { hold: "cane", hx: 1, eyes: "open" }),
    frame(look, 160, { hold: "cane", hx: 1, eyes: "blink" }),
    frame(look, 220, { hold: "cane", hx: -1, mouth: "grin" }),
    frame(look, 140, { hold: "cane", bob: -1, mouth: "grin", flop: -1 }),
    frame(look, 120, { hold: "caneUp", bob: 0, mouth: "open" }, { cue: "tap" }),
    frame(look, 160, { hold: "cane", bob: 1, flop: 1 }),
    frame(look, 220, { hold: "cane", eyes: "happy" }),
    frame(look, 200, { hold: "cane" }),
  ],
});
const caneWalk = (look: Look): Anim => ({
  loop: true,
  frames: WALK.map((w, i) => frame(look, 110, { hold: "cane", feet: w.feet, bob: w.bob, sway: [-3, -1, 1, 3, 1, -1][i], far: WALK_ARMS[i]![0], flop: w.bob }, i === 0 || i === 3 ? { cue: "step" } : {})),
});
const walker = (color: keyof typeof OUTFITS) => {
  const look: Look = { id: color, hat: "elf" };
  return ELF(`npc-ginger-elf-${color}`, `Ginger's elf (${color}, with a candy cane)`, OUTFITS[color], { idle: caneIdle(look), walk: caneWalk(look) });
};
export const NPC_GINGER_ELF_RED = walker("red");
export const NPC_GINGER_ELF_GREEN = walker("green");
export const NPC_GINGER_ELF_BLUE = walker("blue");

// ---- The dispensing pair.

const A: Look = { id: "box", hat: "elf", sack: true };
/** The candy stream falling into the box held out (box at hand +2 down): a column of candies a px wide, its phase moving down. */
const STREAM_X = FOOT[0] + 7; // the box's middle: ELF_BOX_DX (7) ahead of his foot
const stream = (phase: number, len = 5): Speck[] =>
  Array.from({ length: len }, (_, j): Speck => [STREAM_X + ((j + phase) % 3 === 0 ? 1 : 0), GROUND - 13 - len + j, "12345678"[(j * 3 + phase * 5) % 8]!]);
/** The box held out: the near hand at the box's side, under the chute (the box's top 12 px over his feet). */
const OUT: Pose = { hold: "boxOut", near: [5, 3], far: [6, 4] };
export const NPC_GINGER_ELF_BOX = ELF("npc-ginger-elf-box", "Ginger's elf (the box, with a sack)", OUTFITS.yellow, {
  idle: {
    loop: true,
    frames: BREATH.map((b, i) => frame(A, 200, { hold: "box", bob: b, eyes: i === 4 ? "blink" : "open" })),
  },
  walk: walkOf(A, { hold: "box" }),
  tap: {
    loop: false,
    frames: [
      frame(A, 120, { hold: "box", far: [5, -4], eyes: "up" }),
      frame(A, 110, { hold: "box", far: [7, -6], eyes: "up", mouth: "o" }, { cue: "tap" }),
      frame(A, 120, { hold: "box", far: [6, -3], eyes: "up" }),
      frame(A, 110, { hold: "box", far: [3, 3] }),
    ],
  },
  boxOut: { loop: false, frames: [frame(A, 120, { ...OUT, near: [4, 5], far: [4, 6], fill: 0 }), frame(A, 130, { ...OUT, fill: 0, eyes: "up" })] },
  fill: {
    loop: false,
    frames: [0, 1, 1, 2, 2, 3, 3, 4].map((fl, i) => frame(A, 150, { ...OUT, fill: fl, bob: i % 4 === 3 ? 1 : 0, eyes: i < 6 ? "up" : "happy", mouth: i < 6 ? "o" : "grin" }, { specks: i < 7 ? stream(i, i === 0 ? 3 : 5) : [], ...(i === 0 ? { cue: "pour" } : {}) })),
  },
  full: {
    loop: false,
    frames: [
      frame(A, 120, { ...OUT, fill: 4, eyes: "happy", mouth: "grin", bob: 1 }),
      frame(A, 130, { hold: "boxTip", fill: 4, hx: -1, mouth: "grin", bob: -1 }),
      frame(A, 140, { hold: "boxTip", fill: 1, hx: -1, eyes: "happy", mouth: "open" }, { cue: "tip", specks: [[15, 34, "1"], [17, 33, "2"], [14, 32, "4"], [16, 31, "5"]] }),
      frame(A, 120, { hold: "boxTip", fill: 0, mouth: "grin" }),
      frame(A, 120, { hold: "box", fill: 0, bob: 1 }),
    ],
  },
});
/** Elf A's box: where it is (its middle at its top, px over his foot and ahead of it) while held out; ELF_BOX_DX in the room is 7. */
export const ELF_BOX_AT = { dx: 7, h: 12 } as const;

const B: Look = { id: "pad", hat: "elf" };
const PAD: Pose = { hold: "pad" };
export const NPC_GINGER_ELF_PAD = ELF("npc-ginger-elf-pad", "Ginger's elf (the notepad)", OUTFITS.purple, {
  idle: { loop: true, frames: BREATH.map((b, i) => frame(B, 200, { ...PAD, bob: b, eyes: i === 3 ? "blink" : "open", pencil: 0 })) },
  walk: { loop: true, frames: WALK.map((w, i) => frame(B, 110, { ...PAD, feet: w.feet, bob: w.bob, pencil: i % 4, flop: w.bob }, i === 0 || i === 3 ? { cue: "step" } : {})) },
  write: {
    loop: true,
    frames: [
      frame(B, 200, { ...PAD, eyes: "up", hy: -1 }),
      frame(B, 180, { ...PAD, eyes: "up", hy: -1, mouth: "o" }),
      frame(B, 110, { ...PAD, pencil: 1, hy: 1 }, { cue: "scribble" }),
      frame(B, 110, { ...PAD, pencil: 2, hy: 1 }),
      frame(B, 110, { ...PAD, pencil: 3, hy: 1 }),
      frame(B, 110, { ...PAD, pencil: 0, hy: 1 }),
      frame(B, 160, { ...PAD, pencil: 3, hy: 1, mouth: "grin" }, { specks: [[30, 44, "3"], [31, 45, "3"], [32, 43, "3"]] }),
      frame(B, 220, { ...PAD, eyes: "happy", mouth: "grin" }),
    ],
  },
});

// ---- The board carriers (the intro): the board held between them at their hands' height, the front one holding its back end
//      behind him, the back one its front end ahead of him.

const boardAnims = (look: Look, hold: "boardBack" | "boardFront"): Record<string, Anim> => ({
  idle: { loop: true, frames: BREATH.map((b, i) => frame(look, 200, { bob: b, eyes: i === 4 ? "blink" : "open", mouth: "smile" })) },
  walk: walkOf(look, {}),
  carry: { loop: true, frames: RUN.map((r, i) => frame(look, 80, { hold, feet: r.feet, bob: r.bob, flop: i % 2 ? 1 : -1, mouth: "open" }, i === 0 || i === 3 ? { cue: "step" } : {})) },
  toss: {
    loop: false,
    frames: [
      frame(look, 120, { hold, bob: 2, feet: [[-2, 0], [2, 0]], mouth: "o", eyes: "up" }),
      frame(look, 110, { hold, bob: 3, feet: [[-2, 0], [2, 0]], mouth: "o", eyes: "up", hy: 1 }),
      frame(look, 100, { hold, bob: -2, feet: [[-1, 2], [1, 2]], mouth: "grin", eyes: "up", ...(hold === "boardBack" ? { near: [-5, -6], far: [-6, -5] } : { near: [7, -6], far: [6, -5] }) }, { cue: "heave" }),
      frame(look, 120, { bob: -3, feet: [[-1, 3], [1, 3]], far: [-3, -14], near: [9, -3], mouth: "open", eyes: "up" }),
      frame(look, 140, { bob: 0, far: [-3, -12], near: [8, -2], mouth: "grin", eyes: "happy" }),
    ],
  },
  cheer: {
    loop: true,
    frames: [
      frame(look, 140, { far: [-3, -14], near: [9, -4], mouth: "grin", eyes: "happy" }),
      frame(look, 120, { bob: -2, feet: [[-1, 2], [1, 2]], far: [-2, -16], near: [10, -6], mouth: "open", eyes: "happy", flop: 1 }),
      frame(look, 140, { far: [-3, -14], near: [9, -4], mouth: "grin", eyes: "happy" }),
      frame(look, 160, { bob: 1, far: [-4, -12], near: [8, -2], mouth: "grin", eyes: "open", flop: -1 }),
    ],
  },
});
export const NPC_GINGER_ELF_BOARD_A = ELF("npc-ginger-elf-board-a", "Ginger's elf (the board's front)", OUTFITS.orange, boardAnims({ id: "board-a", hat: "elf" }, "boardBack"));
export const NPC_GINGER_ELF_BOARD_B = ELF("npc-ginger-elf-board-b", "Ginger's elf (the board's back)", OUTFITS.teal, boardAnims({ id: "board-b", hat: "elf" }, "boardFront"));
/**
 * The board's height while carried (px over a carrier's foot: the top of their hands), per frame of `carry` and of `toss` (null:
 * let go, the code flies it to the table). The front elf (A) holds it 7 px behind his foot, the back one (B) 8 px ahead of his.
 */
export const ELF_BOARD_HANDS = {
  carry: RUN.map((r) => 18 - r.bob),
  toss: [16, 15, 23, null, null] as const,
  dx: { a: -7, b: 8 },
} as const;
export { ELF_TALL };
