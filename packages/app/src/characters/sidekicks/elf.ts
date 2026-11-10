// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/sidekick-ginger-elf/sidekick-ginger-elf.ts at 6ef02ce9, Nov 5, 2026; Eric approved the design Nov 5): only the
// import paths changed. Notes: scripts/boss-art/out/shop-ginger-nov5.md and intro-ginger-nov5.md on that branch.
/**
 * The shopkeeper elf (id "sidekick-ginger-elf"), who keeps Ginger's candy shop behind the little half-round stand at the back of
 * his igloo (Eric, Nov 5; redrawn smaller and gnome-ish the same day): a happy little gnome-ish elf in a Santa hat (red, a white
 * fur band and pom), a little white beard, a big round nose, a green round tunic with a gold-buckled belt, stubby legs and big boots.
 * The crew's elf (out/npc-ginger-elf/elf-rig.ts), 1:1 at the room's scale (37 px a square): about 25 px from his boots to his hat
 * (`tall: 25`: draw him at his art's size; the kids' 0.87 squares would make him bigger than the other elves). Three-quarters,
 * facing our right. Drawn by hand (Nov 5).
 *
 * Frame 36 x 44, his foot at [17, 41].
 * - `idle` (loops, 12 frames, about 2.3 s): a breath, a blink, a happy little bounce on his toes, a look to the dispensers and back,
 *   the hat's pom bobbing (cue `jingle` f6: the bells on his shoes, soft).
 * - `walk` (loops, 6 x 110 ms): a bouncy walk, arms swinging (cue `step` f0, f3).
 * - `sit` (loops, 10 x 220 ms): sat on a stool (the park's seat, 11 px up), swinging his feet, a blink.
 * - `wave` (once, 8 frames, about 1.2 s): a big hello over his head, a hop, a grin (cue `jingle` f2).
 */
import type { Anim, Character } from "../sprite.ts";
import { elfPalette, FOOT, frame, H, OUTFITS, PARTS, W, WALK, WALK_ARMS, type Look } from "../../town/shops/elf-rig.ts";
import { lazyAnim } from "../sprite.ts";

const KEEPER: Look = { id: "keeper", hat: "santa", beard: true };

const idle: Anim = lazyAnim(() => ({
  loop: true,
  frames: [
    frame(KEEPER, 220, { mouth: "smile" }),
    frame(KEEPER, 200, { bob: 1, mouth: "smile" }),
    frame(KEEPER, 220, { mouth: "smile", hx: 1 }),
    frame(KEEPER, 140, { eyes: "blink", hx: 1 }),
    frame(KEEPER, 200, { mouth: "grin", hx: -1, eyes: "up" }),
    frame(KEEPER, 200, { mouth: "grin", hx: -1, eyes: "up" }),
    frame(KEEPER, 120, { bob: -1, mouth: "grin", feet: [[0, 1], [0, 1]], flop: 1 }, { cue: "jingle" }),
    frame(KEEPER, 120, { bob: 1, mouth: "grin", flop: -1 }),
    frame(KEEPER, 120, { bob: -1, mouth: "open", feet: [[0, 1], [0, 1]], flop: 1 }),
    frame(KEEPER, 160, { bob: 0, mouth: "grin", eyes: "happy" }),
    frame(KEEPER, 220, { mouth: "smile" }),
    frame(KEEPER, 220, { bob: 1, mouth: "smile" }),
  ],
}));
const walk: Anim = lazyAnim(() => ({
  loop: true,
  frames: WALK.map((w, i) => frame(KEEPER, 110, { feet: w.feet, bob: w.bob, far: WALK_ARMS[i]![0], near: WALK_ARMS[i]![1], mouth: "grin", flop: w.bob }, i === 0 || i === 3 ? { cue: "step" } : {})),
}));
const sit: Anim = lazyAnim(() => ({
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) => frame(KEEPER, 220, { sit: 11, bob: i % 5 === 2 ? 1 : 0, eyes: i === 6 ? "blink" : "open", mouth: i >= 3 && i <= 5 ? "grin" : "smile", near: [2, 4], far: [1, 4] })),
}));
const wave: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    frame(KEEPER, 120, { mouth: "grin", near: [2, -3] }),
    frame(KEEPER, 120, { mouth: "open", near: [4, -7], eyes: "happy" }),
    frame(KEEPER, 140, { mouth: "open", near: [6, -9], bob: -2, feet: [[0, 2], [0, 2]], eyes: "happy", flop: 1 }, { cue: "jingle" }),
    frame(KEEPER, 140, { mouth: "grin", near: [2, -10], bob: 0, eyes: "happy", flop: -1 }),
    frame(KEEPER, 140, { mouth: "open", near: [6, -9], eyes: "happy", flop: 1 }),
    frame(KEEPER, 140, { mouth: "grin", near: [2, -10], eyes: "happy" }),
    frame(KEEPER, 130, { mouth: "grin", near: [2, -3] }),
    frame(KEEPER, 160, { mouth: "smile" }),
  ],
}));

export const sidekickGingerElf: Character = {
  id: "sidekick-ginger-elf",
  name: "Ginger's shopkeeper elf",
  w: W,
  h: H,
  foot: FOOT,
  palette: elfPalette(OUTFITS.green),
  halo: "#2a2030",
  parts: PARTS,
  anims: { idle, walk, sit, wave },
};
/** His height from his idle's top to his foot (px, 1:1 at the room's 37 a square). */
export const KEEPER_TALL = 25;
