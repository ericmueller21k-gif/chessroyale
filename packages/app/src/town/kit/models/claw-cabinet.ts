/**
 * Boingo's claw machine as a kit model (Nov 6; brief-3d-kit part 2, Eric: "the claw machine looks out of place"): the same cabinet as
 * the first build (a base with the coin slot and the prize door, glass you see into, crates on felt, the chute, the gantry and its
 * claw, the lit sign, the joystick ledge), now in the room's own art: Boingo's palette with three-step ramps, 37 texels a square (the
 * room's), a 1-texel ink outline, the claw's arm and cable as quads. Texels: x across its front, z back, y up.
 *
 * Its moving parts (shops/claw-cabinet.ts moves and hides them from the play's pose): `claw` (the trolley), `bridge`, `head`,
 * `cable1`..`cable4`, `prong-open|half|shut`, `held`, `fall`, `tray`, `pile<i>`, `coin`, `arrow`, `chase0..2` (the sign's lit bulbs).
 */
import { CHUTE, PILE } from "../../../claw/view.ts";
import { FUN_PALETTE } from "../../shops/boingo-palette.ts";
import { gridOf } from "../bake.ts";
import type { Model, Shape, V3 } from "../prims.ts";

/** Its size (texels): 66 across and deep, the base's top (the felt), the glass's top, the sign's top. */
export const CLAW_W = 66;
export const CLAW_Y = { base: 39, gantry: 81, glass: 87, top: 104, head: 73, reach: 12, crate: 11, held: 59 } as const;
/** The glass's inside, where the pile and the claw are: x 3 (left) to 63, z 60 (back) to 3 (front). Fractions of it (claw/view.ts) to texels. */
export const inX = (f: number) => 3 + 60 * f;
export const inZ = (f: number) => 60 - 57 * f;

const box = (at: V3, size: V3, faces: Shape["faces"], o: Partial<Shape> = {}): Shape => ({ prim: "box", at, size, faces, ...o });
const all = (t: string) => ({ front: t });
/** A thin rod (a quad 1.5 texels wide, turned across the claw's middle) from a to b. */
function rod(a: V3, b: V3, part: string): Shape {
  const ang = Math.atan2(a[1] + b[1], a[0] + b[0]);
  const tx = -Math.sin(ang) * 0.75, tz = Math.cos(ang) * 0.75;
  return { prim: "quad", at: a, size: [0, 0, 0], faces: all("chrome"), part, layer: 2, outline: false, pts: [[a[0] - tx, a[1] - tz, a[2]], [a[0] + tx, a[1] + tz, a[2]], [b[0] + tx, b[1] + tz, b[2]], [b[0] - tx, b[1] - tz, b[2]]] };
}
/** The three prongs, spread `open` (1 open, 0 shut), each two rods down from the head's foot. */
function prongs(open: number, part: string): Shape[] {
  const s = 1.85 + 4.4 * open;
  const y = CLAW_Y.head;
  return [0, 1, 2].flatMap((k) => {
    const a = (k / 3) * Math.PI * 2 + 0.5, c = Math.cos(a), z = Math.sin(a);
    return [rod([1.85 * c, 1.85 * z, y], [s * c, s * z, y - 4.4], part), rod([s * c, s * z, y - 4.4], [0.55 * s * c, 0.55 * s * z, y - 8], part)];
  });
}
/** A ramp of three of Boingo's colors (keys of FUN_PALETTE): dark, base, light. */
const ramp = (d: string, b: string, l: string) => [FUN_PALETTE[d]!, FUN_PALETTE[b]!, FUN_PALETTE[l]!] as const;
const crate = (at: V3, part: string, layer = 1, s: number = CLAW_Y.crate, hide?: Shape["hide"]): Shape => box(at, [s, s, s], { front: "crate", top: "crateTop" }, { part, layer, hide });
const [cx, cz] = [Math.round(inX(CHUTE.x)), Math.round(inZ(CHUTE.z))];

export const CLAW_CABINET: Model = {
  // Boingo's own colors (shops/boingo-palette.ts FUN_PALETTE), each key a ramp of three of them: [dark, base, light].
  palette: {
    k: ramp("k", "k", "k"),
    h: ramp("H", "h", "f"), // the pink body
    p: ramp("Z", "P", "p"), // purple
    y: ramp("Y", "y", "A"), // gold
    a: ramp("A", "a", "a"), // a lit bulb
    s: ramp("J", "j", "L"), // chrome
    t: ramp("t", "S", "s"), // steel
    v: ramp("z", "v", "V"), // the dark panels, the slot, the prize door
    c: ramp("d", "c", "C"), // the felt
    r: ramp("R", "r", "e"), // a crate, the joystick's ball
    q: ramp("q", "R", "r"), // a crate's lid
    l: ramp("+", "+", "+"), // glass: Boingo's faint see-through wash
    L: ramp("-", "-", "-"), // its glare, a little stronger
  },
  textures: {
    baseFront: gridOf(66, 39, "h", [[0, 0, 66, 2, "y"], [0, 35, 66, 4, "y"], [2, 15, 18, 2, "y"], [2, 17, 18, 15, "v"], [32, 10, 6, 9, "y"], [34, 12, 2, 5, "k"]]),
    baseSide: gridOf(66, 39, "h", [[0, 0, 66, 2, "y"], [0, 35, 66, 4, "y"]]),
    felt: ["cccccc", "ccCccc", "cccccc", "cccccc", "cccccC", "cccccc"].map((r) => r.replace(/C/g, "p")),
    back: ["ppvvvvvv", "vppvvvvv", "vvppvvvv", "vvvppvvv", "vvvvppvv", "vvvvvppv", "vvvvvvpp", "pvvvvvvp"],
    glass: gridOf(66, 48, "l", Array.from({ length: 10 }, (_, i) => [44 + i, 4 + 4 * i, 1, 4, "L"] as const)),
    glassPlain: ["l"],
    sign: gridOf(68, 17, "h", [[0, 0, 68, 2, "y"], [0, 15, 68, 2, "y"], ...Array.from({ length: 9 }, (_, i) => [4 + 7 * i, 7, 3, 3, "y"] as const)]),
    pink: ["h"],
    purple: ["p"],
    gold: ["y"],
    chrome: ["s"],
    steel: ["t"],
    dark: ["v"],
    red: ["r"],
    lit: ["a"],
    chuteTop: gridOf(19, 19, "v", [[1, 1, 17, 1, "y"], [1, 17, 17, 1, "y"], [1, 1, 1, 17, "y"], [17, 1, 1, 17, "y"]]),
    crate: gridOf(11, 11, "r", [[0, 0, 11, 2, "q"], [2, 2, 1, 9, "y"], [5, 2, 1, 9, "y"], [8, 2, 1, 9, "y"]]),
    crateTop: gridOf(11, 11, "q", [[4, 4, 3, 3, "y"]]),
  },
  shapes: [
    // The base (its top the felt the pile sits on), the back panel inside, the glass (its back left out), the posts and rims.
    box([0, 0, 0], [66, 66, 39], { front: "baseFront", side: "baseSide", top: "felt" }),
    box([0, 63, 39], [66, 3, 48], { front: "back", side: "gold", top: "gold" }),
    box([0, 0, 39], [66, 63, 48], { front: "glass", side: "glassPlain", top: "glassPlain" }, { glass: true, layer: 3, hide: ["back"] }),
    ...[[0, 0, 3], [64, 0, 3], [0, 61, 0], [64, 61, 0]].map(([x, z, l]) => box([x!, z!, 39], [2, 2, 48], all("gold"), { layer: l })),
    box([0, 0, 85], [2, 63, 2], all("gold"), { layer: 3 }),
    box([64, 0, 85], [2, 63, 2], all("gold"), { layer: 3 }),
    box([0, 61, 85], [66, 2, 2], all("gold")),
    // The sign standing on the glass's front edge, its bulbs (one in three lit, chasing).
    box([-1, -1, 87], [68, 4, 17], { front: "sign", side: "pink", top: "purple" }, { layer: 4 }),
    ...Array.from({ length: 9 }, (_, i): Shape => ({ prim: "quad", at: [3 + 7 * i, -1.3, 94], size: [3, 0, 3], faces: all("lit"), part: `chase${i % 3}`, layer: 5 })),
    // The ledge: a sloped desk with the joystick and the big button.
    { prim: "wedge", at: [4, -6, 33], size: [58, 6, 6], lo: 0.5, faces: { front: "gold", side: "purple", top: "dark" }, layer: 4 },
    box([24, -4, 37], [2, 2, 7], all("steel"), { layer: 5 }),
    { prim: "dome", at: [22, -6, 43], size: [6, 6, 4], n: 6, m: 2, faces: all("red"), layer: 5 },
    { prim: "cyl", at: [42, -5, 38], size: [7, 4, 2], n: 6, faces: all("gold"), layer: 5 },
    // Inside: the chute (a clear box, its gold-rimmed opening), the pile.
    box([cx - 9, cz - 9, 39], [19, 19, 15], { front: "glassPlain", top: "chuteTop" }, { glass: true, layer: 1, far: 0.5 }),
    ...PILE.map(([x, z, l], i) => crate([Math.round(inX(x) - 5.5), Math.round(inZ(z) - 5.5), 39 + 11 * l], `pile${i}`)),
    // The gantry: its rails, the bridge (at the claw's x), the trolley, the cable in steps, the head, its prongs open, half, shut.
    box([2, 4, 80], [62, 2, 2], all("chrome"), { layer: 2 }),
    box([2, 58, 80], [62, 2, 2], all("chrome"), { layer: 2 }),
    box([-1, 4, 81], [2, 56, 1], all("chrome"), { part: "bridge", layer: 2 }),
    box([-3, -3, 79], [6, 6, 3], { front: "chrome", top: "gold" }, { part: "claw", layer: 2 }),
    ...[0, 1, 2, 3, 4].map((k): Shape => ({ prim: "quad", at: [-0.5, 0, k ? 77 - 3 * k : 77], size: [1, 0, k ? 3 : 2], faces: all("steel"), part: `cable${k}`, layer: 2 })),
    box([-2, -2, 73], [4, 4, 4], all("gold"), { part: "head", layer: 2 }),
    ...prongs(1, "prong-open"),
    ...prongs(0.45, "prong-half"),
    ...prongs(0, "prong-shut"),
    // A crate in the claw, one falling, one won in the prize door's tray; the coin going in; the arrow over the slot.
    crate([-5.5, -5.5, CLAW_Y.held], "held", 2),
    crate([-5.5, -5.5, 0], "fall"),
    crate([cx - 4, 2, 8], "tray", 0.5, 9, ["top", "left", "right", "back"]),
    { prim: "quad", at: [33.5, -1, 0], size: [3, 0, 4], faces: all("lit"), part: "coin", layer: 6, outline: false },
    { prim: "quad", at: [31, -1.5, 30], size: [0, 0, 0], pts: [[31, -1.5, 37], [39, -1.5, 37], [35, -1.5, 30], [35, -1.5, 30]], faces: all("lit"), part: "arrow", layer: 6 },
  ],
  anchors: { slot: [35, 0, 24.5], chute: [cx, cz, 39] },
};
