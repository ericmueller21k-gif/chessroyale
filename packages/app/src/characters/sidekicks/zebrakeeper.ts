/**
 * Rolling Dough's Shopkeeper (Nov 11): the counter zebra in a baker's paper cap and a white apron, the crew's rig
 * (town/shops/zebra-rig.ts, the art branch's crew-zebra at Nov 10). His look and his idle are the art's stand-in, word for word
 * (claude/boss-art scripts/boss-art/bakery-view.ts `KEEPER`, in Eric's approved stills of Nov 11: "Looks great"); Eric took the
 * default (the director's note, Nov 11: "the counter zebra in a baker's cap is the shopkeeper"). The sheet's other rows (walk, sit,
 * wave) are the rig's plain moves: the bake needs them (scripts/bake-sidekicks.ts), the shop shows only his idle. He keeps the shop
 * (shops/shops.ts), "Shopkeeper", no name; not a town bot (Don Dough's crew stay in the bakery).
 *
 * Frame 96 x 104, his foot at [36, 100] (the rig's). Room scale 1:1 (37 px a square): drawn at his art's size (`ShopDef.tall`).
 * - `idle` (loops, 2 frames, about 1 s): arms folded behind the counter, a smile, a blink.
 * - `walk` (loops, 6 x 110 ms), `sit` (loops, 2 frames, on a stool 11 px up), `wave` (once, 6 frames): the rig's.
 */
import type { Anim, Character } from "../sprite.ts";
import { lazyAnim } from "../sprite.ts";
import { ARMS, FOOT, frame, H, PARTS, W, ZEBRA_PALETTE, type Look, type Pose } from "../../town/shops/zebra-rig.ts";

const KEEPER: Look = { id: "zck", hat: "paper", top: "apron", seed: 7 };
const FOLD: Pose = { armF: ARMS.fold, armN: ARMS.foldN, mouth: "smile" };

const idle: Anim = lazyAnim(() => ({
  loop: true,
  frames: [frame(KEEPER, 900, { ...FOLD }), frame(KEEPER, 140, { ...FOLD, eyes: "blink" })],
}));
const STRIDE: readonly (readonly [[number, number], [number, number]])[] = [
  [[-5, 0], [5, 0]],
  [[-3, 2], [3, 0]],
  [[0, 3], [0, 0]],
  [[5, 0], [-5, 0]],
  [[3, 0], [-3, 2]],
  [[0, 0], [0, 3]],
];
const walk: Anim = lazyAnim(() => ({
  loop: true,
  frames: STRIDE.map((feet, i) => frame(KEEPER, 110, { armF: ARMS.hang, armN: ARMS.hangN, mouth: "smile", feet, bob: i % 3 === 2 ? 1 : 0, hx: 1 }, i === 0 || i === 3 ? { cue: "step" } : {})),
}));
const sit: Anim = lazyAnim(() => ({
  loop: true,
  frames: [frame(KEEPER, 900, { ...FOLD, sit: 11 }), frame(KEEPER, 140, { ...FOLD, sit: 11, eyes: "blink" })],
}));
const wave: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    frame(KEEPER, 140, { ...FOLD }),
    frame(KEEPER, 140, { armF: ARMS.fold, armN: ARMS.wave, mouth: "grin" }),
    frame(KEEPER, 160, { armF: ARMS.fold, armN: ARMS.calm, mouth: "grin", hy: 1 }),
    frame(KEEPER, 160, { armF: ARMS.fold, armN: ARMS.wave, mouth: "grin" }),
    frame(KEEPER, 160, { armF: ARMS.fold, armN: ARMS.calm, mouth: "smile" }),
    frame(KEEPER, 200, { ...FOLD }),
  ],
}));

export const sidekickZebraKeeper: Character = {
  id: "sidekick-zebra-keeper",
  name: "Rolling Dough's counter zebra",
  w: W,
  h: H,
  foot: FOOT,
  palette: ZEBRA_PALETTE,
  halo: "#3a3440",
  parts: PARTS,
  anims: { idle, walk, sit, wave },
};
