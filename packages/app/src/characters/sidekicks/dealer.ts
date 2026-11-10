/**
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/sidekick-grex-dealer/sidekick-grex-dealer.ts at 0e4f6482, Nov 4, 2026; Eric approved the build Nov 4).
 * Changed: the import paths. The file is `dealer.ts` (the baked sheet's key, scripts/bake-sidekicks.ts); he keeps Jefferson's shop
 * (shops/shops.ts) and is not a town bot (Sparky stays Jefferson's kid in the town). Drawn at his art's size (DEALER_TALL), not the kids'. The notes: scripts/boss-art/out/shop-grex-nov4.md and intro-grex-nov4.md on that branch.
 */
/**
 * The shady dealer (id "sidekick-grex-dealer"), who keeps Jefferson's shop: "literally just a guy in the corner" (Eric, Nov 4).
 * A crew giraffe (out/npc-grex/giraffe-rig.ts) in a long tan trench coat, its collar popped up round his neck, belted, dark
 * sunglasses and a toothpick in the corner of his mouth, his hooves in his coat pockets. Giraffe-sized: drawn 1:1 at the room's
 * scale (37 px a square), about 79 px from hooves to ossicones, taller than the other shops' kids (draw him at his art's size,
 * not `sidekickSquares`). Three-quarters, facing our right (in his corner he faces west: mirror him). Drawn by hand (Nov 4).
 *
 * Frame 64 x 104, his foot (the ground between his hooves) at [30, 100].
 * - `idle` (loops, 12 frames, about 2.2 s): hooves in his pockets, a breath, a slow look one way and the other over his shades,
 *   and the toothpick flicked up and back (cue `flick` f6).
 * - `walk` (loops, 6 x 110 ms): an easy slouching walk, hooves still in his pockets (cue `step` f0, f3).
 * - `sit` (loops, 10 x 220 ms): sat on a stool (the park's seat, 11 px up), hooves in his pockets, the toothpick flick.
 * - `wave` (once, 8 frames, about 1.3 s): the shady dealer's hello: a look left and right, then he holds one side of his coat
 *   open, the rockets pinned inside on show, a smirk, the toothpick up (cue `psst` f1, `flick` f3), and shuts it again.
 */
import type { Anim, Character } from "../sprite.ts";
import { ARMS, CREW_PALETTE, FOOT, frame, H, PARTS, W, WALK, type Look, type Pose } from "../../town/shops/giraffe-rig.ts";
import { lazyAnim } from "../sprite.ts";

const DEALER: Look = { id: "dealer", hat: "none", top: "trench", shades: true, toothpick: true, seed: 7 };
const POCKETS: Pose = { armF: ARMS.pocket, armN: ARMS.pocket, mouth: "smirk" };

const idle: Anim = lazyAnim(() => ({
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    frame(DEALER, i === 6 || i === 7 ? 120 : 190, {
      ...POCKETS,
      bob: i % 6 === 2 || i % 6 === 3 ? 1 : 0,
      hx: i >= 2 && i <= 3 ? -2 : i >= 9 && i <= 10 ? 2 : 0,
      hy: i >= 2 && i <= 3 ? -1 : 0,
      pick: i === 6 ? 1 : i === 7 ? 0.5 : 0,
    }, i === 6 ? { cue: "flick" } : {}),
  ),
}));
const walk: Anim = lazyAnim(() => ({
  loop: true,
  frames: WALK.map((w, i) => frame(DEALER, 110, { ...POCKETS, feet: w.feet, bob: w.bob, hx: 1 }, i === 0 || i === 3 ? { cue: "step" } : {})),
}));
const sit: Anim = lazyAnim(() => ({
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) =>
    frame(DEALER, 220, { ...POCKETS, sit: 11, feet: [[0, 0], [3, 0]], bob: i % 5 === 2 ? 1 : 0, pick: i === 6 ? 1 : 0, hx: i >= 3 && i <= 4 ? -1 : 0 }, i === 6 ? { cue: "flick" } : {}),
  ),
}));
const wave: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    frame(DEALER, 160, { ...POCKETS, hx: -2 }),
    frame(DEALER, 140, { ...POCKETS, hx: 2, armN: ARMS.coat, open: 1 }, { cue: "psst" }),
    frame(DEALER, 180, { ...POCKETS, armN: ARMS.coatWide, open: 2, mouth: "smirk" }),
    frame(DEALER, 200, { ...POCKETS, armN: ARMS.coatWide, open: 2, pick: 1, hy: 1 }, { cue: "flick" }),
    frame(DEALER, 220, { ...POCKETS, armN: ARMS.coatWide, open: 2, pick: 0.5, mouth: "grin" }),
    frame(DEALER, 130, { ...POCKETS, armN: ARMS.coat, open: 1 }),
    frame(DEALER, 130, { ...POCKETS }),
    frame(DEALER, 160, { ...POCKETS, hy: 1 }),
  ],
}));

export const sidekickGrexDealer: Character = {
  id: "sidekick-grex-dealer",
  name: "Jefferson's dealer",
  w: W,
  h: H,
  foot: FOOT,
  palette: CREW_PALETTE,
  halo: "#3a2a1c",
  parts: PARTS,
  anims: { idle, walk, sit, wave },
};
/** His height from his idle's top to his foot (px, 1:1 at the room's 37 a square): for drawing him at his art's size. */
export const DEALER_TALL = 79;
