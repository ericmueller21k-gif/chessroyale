/**
 * Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/boss-pig/boss-pig.ts at 0e4c00c6, Nov 4; the notes are
 * scripts/boss-art/out/intro-pig-nov4.md there): only the imports changed. A file of its own so the town doesn't build these frames: it
 * loads only when you challenge him (shops/intro.ts, through shops/pig-intro-art.ts).
 *
 * Wrangler's battle intro moves (BOSS_PIG_INTRO, id `pig-intro`; Eric's design, Nov 4): he ropes the board on its hay bale
 * in the barn's corner and drags it to the middle, then throws two ropes at once, arms crossed, and yanks a white bucket and
 * a black bucket in from either side for the stools. Drawn by hand (Nov 4, weekly plan usage).
 *
 * His drawing is the game's (packages/app/src/characters/pig.ts, PIG): this file adds nothing to it. Every pose is built
 * with his own rig (`pigLayers`: the same head, hat, body, boots, limbs and ropes), so its parts are his own parts record
 * (PIG.parts, made on first use); his old frames are untouched. Same frame and foot as PIG: 115 x 77, foot [43, 73],
 * drawn as his sprite is (facing front, turned a little to our left), light from the top left. Not mirrored.
 *
 * - `spin` (loops, 8 x 60 ms): the lasso spinning overhead, wider and faster than his idle's, a lean and a glare. Cue
 *   `whirl` f0.
 * - `throw` (once, 4 frames, 480 ms): the loop swung back over his head, then flung out to our upper left (cue `throw` f1,
 *   the loop just leaving his hand); his arm stays out, pointing after it. From f2 the rope is code's: INTRO_PIG_ROPE, drawn
 *   from his hand (PIG_INTRO_HANDS) to wherever the loop has flown.
 * - `yank` (loops, 4 x 120 ms): heels dug in, leaning back to our right, both fists on the rope low on our left, a heave
 *   every other frame (cue `yank` on f0 and f2, a shake, dust off his heels). Code drags the bale while it plays.
 * - `crossThrow` (once, 10 frames, 1.03 s): he shakes his coil out into a second loop (cue `windup` f0), spins both overhead,
 *   crosses his arms and throws both at once, one each way (cue `throw` f7): his right arm (the lasso, on our left)
 *   across to our right, his left (on our right) across to our left; he holds them out, crossed. From f8 both ropes are
 *   code's, off screen each way (PIG_INTRO_HANDS for the first, PIG_INTRO_HANDS2 for the second).
 * - `doubleYank` (once, 6 frames, 860 ms): arms crossed, he braces (f0), then flings them wide apart (cue `yank` f1, a
 *   shake): the ropes cross over in front of him, each hauling its bucket in from its side; a second, smaller heave (cue
 *   `yank` f3); he stands with the slack ropes (f5).
 * - `brag` (once, 12 frames, about 1.5 s): the ropes dropped, his lasso spun back up overhead (cue `whirl` f0), a hat tip
 *   (cue `tip` f2), a snorting laugh (cues `laugh` f5, `snort` f7) and a spur stomp with a glint (cue `stomp` f10). It ends on
 *   his idle's first frame.
 * - `idle`: his idle's first frame.
 */
import { PIG, PIG_PALETTE, pigLayers, type PigPose } from "./pig.ts";
import type { Anim, Character, Frame, Speck } from "./sprite.ts";

type Pt = readonly [number, number];
/** His drawing space sits at (OX, OY) on his frame (pig.ts), the ground at y 70 there. */
const OX = 3;
const OY = 3;
const W = PIG.w;
const H = PIG.h;

/** Dust kicked up at a spot on the ground (drawing space), `t` frames on (his own dust colors, U and V). */
function dust([x, y]: Pt, t: number, n = 6): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const d = 1.5 + t * (1.1 + (i >> 1) * 0.45);
    const X = Math.round(OX + x + side * d);
    const Y = Math.round(OY + y - (i % 3) * 0.7 - t * 0.5 + t * t * 0.18);
    if (t > 2 && i % 2) continue;
    out.push([X, Y, i % 3 ? "U" : "V"]);
  }
  return out;
}
/** A glint off a spur: a little four-point star. */
const glint = ([x, y]: Pt, big: boolean): Speck[] => {
  const X = OX + x;
  const Y = OY + y;
  return big ? [[X, Y - 2, "L"], [X, Y + 2, "L"], [X - 2, Y, "L"], [X + 2, Y, "L"], [X, Y - 1, "y"], [X, Y + 1, "y"], [X - 1, Y, "y"], [X + 1, Y, "y"]] : [[X, Y - 1, "L"], [X - 1, Y, "L"], [X + 1, Y, "L"], [X, Y + 1, "L"]];
};
/** Snort puffs from his nostrils, `t` frames on. */
function puffs(t: number, dy = 0): Speck[] {
  if (t < 0 || t > 3) return [];
  return [-1, 1].flatMap((side): Speck[] => {
    const X = Math.round(OX + (side < 0 ? 29 : 38) + side * t * 1.7);
    const Y = Math.round(OY + 37 + dy + t * 0.8);
    return t < 2 ? [[X, Y, "S"], [X + side, Y, "S"], [X, Y + 1, "s"]] : [[X, Y, "s"]];
  });
}
const inFrame = (sp: Speck[]) => sp.filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);

/** A frame of a pose. */
const fr = (ms: number, p: PigPose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: pigLayers(p), ...extra, ...(extra.specks ? { specks: inFrame([...extra.specks]) } : {}) });
/** Where a fist grips its rope, on his frame (as pigLayers works it out: the fist moved by the lean and the bob, 2 px up). */
const grip = (p: PigPose, fist: Pt): Pt => [OX + fist[0] + (p.lean ?? 0), OY + fist[1] + (p.bob ?? 0) - 2];

const HANDS: Record<string, (Pt | null)[]> = {};
const HANDS2: Record<string, (Pt | null)[]> = {};
/** Builds an animation, noting each frame's grips: `h1` the lasso arm's (his right, on our left), `h2` the other's. */
function anim(name: string, loop: boolean, frames: { ms: number; p: PigPose; extra?: Partial<Frame>; h1?: boolean; h2?: boolean }[]): Anim {
  HANDS[name] = frames.map((f) => (f.h1 && f.p.fistL ? grip(f.p, f.p.fistL) : null));
  HANDS2[name] = frames.map((f) => (f.h2 && f.p.fistR ? grip(f.p, f.p.fistR) : null));
  return { loop, frames: frames.map((f) => fr(f.ms, f.p, f.extra)) };
}

// ---- spin: the lasso up and whirling, wider and faster than his idle's (a turn every 8 frames).

const spin = anim(
  "spin",
  true,
  Array.from({ length: 8 }, (_, i) => ({ ms: 60, p: { mood: i % 4 === 3 ? "grit" : "fierce", spin: i, grow: 2, lean: -1, bob: i % 4 === 3 ? 1 : 0 } as PigPose, extra: i === 0 ? { cue: "whirl" } : {} })),
);

// ---- throw: swung back over his head, flung out to our upper left; his arm out after it.

const OUT_ARM = { fistL: [6, 30] as Pt, elbowL: [14, 37] as Pt };
const throwA = anim("throw", false, [
  { ms: 90, p: { mood: "fierce", lean: 2, fistL: [26, 25], elbowL: [22, 35], loop: { c: [46, 9], rx: 13, ry: 4, tilt: 8 }, bow: [38, 14] } },
  { ms: 70, p: { mood: "wild", lean: -2, fistL: [10, 28], elbowL: [16, 37], loop: { c: [12, 6], rx: 9, ry: 3, tilt: -12 }, front: true, bow: [9, 18] }, extra: { cue: "throw" } },
  { ms: 120, p: { mood: "wild", lean: -2, ...OUT_ARM, loop: null }, h1: true },
  { ms: 200, p: { mood: "smug", lean: -1, ...OUT_ARM, loop: null }, h1: true },
]);

// ---- yank: heels dug in, leaning back to our right, both fists on the rope on our left; a heave every other frame.

const YANK_HEAVE: PigPose = { mood: "grit", lean: 3, bob: 2, fistL: [13, 47], elbowL: [21, 49], fistR: [22, 49], elbowR: [36, 51], loop: null, coil: null, feet: { l: [-3, 0], r: [1, 0] } };
const YANK_GRIP: PigPose = { mood: "fierce", lean: 1, bob: 1, fistL: [11, 45], elbowL: [19, 47], fistR: [20, 47], elbowR: [34, 49], loop: null, coil: null, feet: { l: [-3, 0], r: [1, 0] } };
const yank = anim("yank", true, [
  { ms: 120, p: YANK_HEAVE, extra: { cue: "yank", shake: [1, 0], specks: [...dust([6, 70], 0), ...dust([60, 70], 0)] }, h1: true },
  { ms: 120, p: YANK_HEAVE, extra: { specks: [...dust([6, 70], 1), ...dust([60, 70], 1)] }, h1: true },
  { ms: 120, p: YANK_GRIP, extra: { cue: "yank", shake: [1, 0], specks: dust([6, 70], 2) }, h1: true },
  { ms: 120, p: { ...YANK_GRIP, mood: "grit" }, h1: true },
]);

// ---- crossThrow: the coil shaken out into a second loop, both spun up, arms crossed, both thrown at once, one each way.

/** Arms crossed in front of his chest: his lasso arm's fist (on our left) across to our right, the other's across to our left. */
const CROSSED = { fistL: [46, 45] as Pt, elbowL: [35, 50] as Pt, fistR: [32, 46] as Pt, elbowR: [44, 51] as Pt };
const crossThrow = anim("crossThrow", false, [
  { ms: 100, p: { mood: "wild", spin: 0, coil: 2 }, extra: { cue: "windup" } },
  { ms: 90, p: { mood: "wild", spin: 1, fistR: [63, 34], elbowR: [59, 41], loop2: { c: [70, 22], rx: 8, ry: 5, tilt: 25 } } },
  { ms: 70, p: { mood: "wild", spin: 2, loop2: "spin", grow: 1 } },
  { ms: 70, p: { mood: "wild", spin: 3, loop2: "spin", grow: 1.5 } },
  { ms: 70, p: { mood: "grit", spin: 4, loop2: "spin", grow: 2 } },
  { ms: 70, p: { mood: "wild", spin: 5, loop2: "spin", grow: 2 } },
  // Wound up: arms flung wide, each loop swung out behind its own side, ready to cross.
  { ms: 110, p: { mood: "fierce", bob: 1, fistL: [14, 38], elbowL: [20, 44], fistR: [64, 38], elbowR: [58, 44], loop: { c: [10, 16], rx: 8, ry: 4, tilt: -20 }, loop2: { c: [70, 16], rx: 8, ry: 4, tilt: 20 }, bow: [10, 28], bow2: [68, 28] } },
  // Thrown: arms crossed, the loops flying out each way (they leave his frame on the next).
  { ms: 70, p: { mood: "wild", lean: 0, ...CROSSED, front: true, loop: { c: [92, 22], rx: 9, ry: 3.5, tilt: 8 }, loop2: { c: [9, 22], rx: 7, ry: 3, tilt: -8 }, bow: [68, 26], bow2: [20, 28] }, extra: { cue: "throw" } },
  { ms: 160, p: { mood: "wild", ...CROSSED, front: true, loop: null, loop2: null, coil: null }, h1: true, h2: true },
  { ms: 220, p: { mood: "fierce", ...CROSSED, front: true, loop: null, loop2: null, coil: null }, h1: true, h2: true },
]);

// ---- doubleYank: braced, arms crossed; then flung wide apart (the ropes cross in front of him), a second heave, slack.

const WIDE = { fistL: [12, 46] as Pt, elbowL: [19, 46] as Pt, fistR: [66, 46] as Pt, elbowR: [60, 47] as Pt };
const doubleYank = anim("doubleYank", false, [
  { ms: 140, p: { mood: "grit", bob: 1, ...CROSSED, front: true, loop: null, loop2: null, coil: null, feet: { l: [-2, 0], r: [2, 0] } }, h1: true, h2: true },
  { ms: 130, p: { mood: "grit", bob: 2, lean: 1, ...WIDE, loop: null, loop2: null, coil: null, feet: { l: [-3, 0], r: [3, 0] } }, extra: { cue: "yank", shake: [0, 1], specks: [...dust([6, 70], 0), ...dust([62, 70], 0)] }, h1: true, h2: true },
  { ms: 120, p: { mood: "wild", bob: 2, lean: 1, ...WIDE, loop: null, loop2: null, coil: null, feet: { l: [-3, 0], r: [3, 0] } }, extra: { specks: [...dust([6, 70], 1), ...dust([62, 70], 1)] }, h1: true, h2: true },
  { ms: 120, p: { mood: "grit", bob: 1, ...WIDE, fistL: [14, 44], fistR: [64, 44], loop: null, loop2: null, coil: null, feet: { l: [-3, 0], r: [3, 0] } }, extra: { cue: "yank", shake: [0, 1], specks: dust([34, 70], 0) }, h1: true, h2: true },
  { ms: 150, p: { mood: "smug", bob: 1, ...WIDE, loop: null, loop2: null, coil: null, feet: { l: [-3, 0], r: [3, 0] } }, h1: true, h2: true },
  { ms: 200, p: { mood: "smug", fistL: [16, 50], elbowL: [21, 49], fistR: [61, 50], elbowR: [57, 48], loop: null, loop2: null, coil: null }, h1: true, h2: true },
]);

// ---- brag: the lasso spun back up, a hat tip, a snorting laugh, a spur stomp with a glint; ends on his idle's first frame.

const SPUR_L: Pt = [26, 67];
const brag = anim("brag", false, [
  { ms: 85, p: { mood: "smug", spin: 4 }, extra: { cue: "whirl" } },
  { ms: 85, p: { mood: "smug", spin: 5 } },
  { ms: 140, p: { mood: "blink", spin: 6, headDy: 1, bob: 1, hat: { tilt: 8, dy: 2 } }, extra: { cue: "tip" } },
  { ms: 160, p: { mood: "smug", spin: 7, headDy: 1, bob: 1, hat: { tilt: 8, dy: 2 } } },
  { ms: 85, p: { mood: "smug", spin: 0, hat: { tilt: 4, dy: 1 } } },
  { ms: 85, p: { mood: "laugh", spin: 1, headDy: -1, hat: { tilt: -6, dy: -2 }, coil: 1 }, extra: { cue: "laugh" } },
  { ms: 85, p: { mood: "laugh", spin: 2, bob: 1, hat: { tilt: -2, dy: -1 }, coil: -1 } },
  { ms: 85, p: { mood: "snort", spin: 3, headDy: -1, hat: { tilt: -6, dy: -2 }, coil: 1 }, extra: { cue: "snort", specks: puffs(0, -1) } },
  { ms: 85, p: { mood: "laugh", spin: 4, bob: 1, hat: { tilt: -2, dy: -1 }, coil: -1 }, extra: { specks: puffs(1, 1) } },
  { ms: 90, p: { mood: "fierce", spin: 5, feet: { l: [-1, -4] }, bob: -1 } },
  { ms: 110, p: { mood: "sneer", spin: 6, bob: 1 }, extra: { cue: "stomp", shake: [0, 1], specks: [...dust([4, 70], 0), ...dust([29, 70], 0), ...glint(SPUR_L, true)] } },
  { ms: 160, p: { mood: "sneer", spin: 7 }, extra: { specks: [...dust([4, 70], 1), ...glint(SPUR_L, false)] } },
]);
/** (His idle's first frame: brag's last frame leads into it.) */
const idle: Anim = { loop: true, frames: [PIG.anims.idle!.frames[0]!] };

export const BOSS_PIG_INTRO: Character = {
  ...PIG,
  id: "pig-intro",
  name: "Wrangler (his intro)",
  anims: { idle, spin, throw: throwA, yank, crossThrow, doubleYank, brag },
};

/**
 * Where the rope leaves his hand on each frame, in his frame's pixels (as `foot` is), for code to draw INTRO_PIG_ROPE from:
 * his lasso arm's grip (his right hand, on our left) when its rope is out of his sprite (thrown, hauling); null when the
 * rope is drawn in his frame (spinning, swinging) or he has none. PIG_INTRO_HANDS2: his other hand's, for the second rope
 * (crossThrow and doubleYank).
 */
export const PIG_INTRO_HANDS: Readonly<Record<string, readonly (Pt | null)[]>> = HANDS;
export const PIG_INTRO_HANDS2: Readonly<Record<string, readonly (Pt | null)[]>> = HANDS2;
/** The frame each rope leaves his sprite and becomes code's (the release): `throw` f2, `crossThrow` f8. */
export const PIG_INTRO_RELEASE = { throw: 2, crossThrow: 8 } as const;
export { PIG_PALETTE };
