/**
 * Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/boss-beaver/boss-beaver.ts, Nov 1, 2026; Eric approved the art: "Yes,
 * both"); only the import paths and its id ("timber", as the other bosses' ids) changed. His attack on a king (BOSS_BEAVER_ATTACK, at the end) was added
 * there on Nov 2 (scripts/boss-art/out/timber-king-attack-nov2.md) and copied here as drawn, its lines only. The run's report: scripts/boss-art/out/timber-nov1.md on that branch.
 *
 * Timber, the beaver builder (boss-beaver): Eric's design. A stout brown beaver standing upright, facing a little to our
 * left (toward the board): big buck teeth, whiskers, small round ears, a dark nose; an orange hard hat and an orange
 * safety vest; a yellow tool belt and harness with a red-handled hammer, a tape measure, a wrench and pouches; two crossed
 * wooden planks strapped on his back (their ends over his shoulders); a flat crosshatched paddle tail behind him.
 * Light from the top left.
 *
 * His still and idle are Eric's approved look (kept pixel for pixel: the idle's frames are the rig at rest).
 *
 * Rigging: every part is painted in drawing space (the frame's own pixels, the ground at y GROUND) and placed where it
 * was painted, plus an offset, so a pose is numbers (`Pose`):
 * - `breath` lifts his chest, arms, head and hat; `sink` crouches or sits him (his upper body down, thighs half, feet
 *   stay; `spread` puts his feet apart); `lean` moves his upper body sideways; `dx`, `air` move all of him (the shadow stays);
 * - the head moves as one (`head`, `headDy`), with its eyes (`mood`), brows (`brows`), mouth (`mouth`, `jaw`: how far
 *   his jaw drops under the buck teeth, `tongue`: a lick);
 * - the hat rides the head (`hat`: an offset, `hatTilt`: degrees), or comes off it (`hatOff`: where it is, and its tilt);
 * - each arm is a stroke from its shoulder by an elbow (bent by itself) to a paw (`armL`, the near arm on the board's
 *   side, and `armR`); `front` brings the near arm in front of his face (a paw on his chin, a raised hammer);
 * - the hammer leaves his belt for a paw (`hammer`: its angle in the near paw, `hammerR`: in the far one);
 * - the back plank (`plankOut`: slid up out of its strap; `noPlank`: off his back) and a plank in his paws (`held`);
 * - a scrap of wood (`scrap`), the tools spilling off his belt (`spill`), the tail (`tail`: its angle) and its dust.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";
import { KING_ATTACK } from "@chessroyale/chess";

const PALETTE: Record<string, string> = {
  k: "#1e130d", // outline
  a: "#3e2415", // fur, dark to light
  b: "#5d361d",
  c: "#7d4a27",
  d: "#9c6334",
  e: "#b97f4a",
  m: "#9a6e4f", // muzzle and belly: shade, mid, light
  n: "#b88b66",
  N: "#d4ad86",
  x: "#140c08", // eyes, nose, mouth
  v: "#ffffff", // eye glint
  X: "#6a5a54", // nose glint
  w: "#fff6dc", // teeth
  W: "#d6c49a",
  o: "#b4520c", // orange (hat, vest): shadow, mid, light, highlight
  O: "#ea7816",
  L: "#ff9d3a",
  l: "#ffc77e",
  E: "#a3360c", // safety vest: shadow, mid, light
  F: "#e0561a",
  G: "#ff7a3c",
  I: "#f6eed6", // reflective stripe: light, shade
  K: "#bfb49c",
  s: "#e2e7ec", // reflective stripe / steel light
  S: "#9aa4af", // steel mid
  T: "#5c6570", // steel dark
  Y: "#f2c230", // yellow belt and harness: mid, shadow, light, deep
  y: "#c48f18",
  Z: "#ffe47c",
  P: "#7e5b0e",
  R: "#d8302c", // hammer handle
  r: "#8c1916",
  B: "#2a2a30", // tape measure's dark ring
  H: "#f6d38e", // wood: light, mid, shade, grain
  h: "#e0aa5c",
  j: "#b47b36",
  J: "#7e5222",
  g: "#3e2c22", // the planks' strap
  t: "#2c2522", // tail: hatch, dark, mid, light
  u: "#4e423c",
  U: "#6b5c53",
  V: "#887667",
  i: "#eadcc4", // whiskers
  D: "#9a8a72", // dust
  C: "#e8d2a4", // sawdust, light
  q: "#e2707e", // tongue: mid, shade
  Q: "#a84452",
  "~": "#9fd8ff", // sweat
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;
interface Painted {
  part: Part;
  at: Pt;
}

const W = 88;
const H = 88;
const GROUND = 82;
/** Headroom: the drawing sits this far down the frame. */
const OY = 2;

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const and = (...fs: Inside[]): Inside => (x, y) => fs.every((f) => f(x, y));
const not = (f: Inside): Inside => (x, y) => !f(x, y);

/** A canvas whose top-left is drawing-space (x0, y0): fill shapes and stamp rows in drawing space. */
function pic(x0: number, y0: number, w: number, h: number) {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        if (k === ".") return;
        const X = sx + i - x0;
        const Y = sy + j - y0;
        if (cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  const at = (x: number, y: number) => cv[y - y0]?.[x - x0] ?? ".";
  const done = (outline = true): Painted => ({ part: { grid: toGrid(cv), ...(outline ? {} : { outline: false }) }, at: [x0, y0] });
  return { cv, F, S, at, done };
}

// ---- The head: eyes, brows and mouth by mood.

type Mood = "smile" | "blink" | "proud" | "squint" | "shut" | "wide" | "wink";
type Brow = "cheer" | "angry" | "worry" | "up";
type Mouth = "smile" | "grin" | "frown" | "open";

const EYES: Record<Mood, { far: readonly string[]; near: readonly string[] }> = {
  smile: { far: ["vx", "xx", "xx"], near: [".xx.", "xvxx", "xvxx", "xxxx", ".xx."] },
  blink: { far: ["..", "..", "xx"], near: ["....", "....", "....", "xxxx", "...."] },
  /** Eyes shut in a happy arch: pleased with his work. */
  proud: { far: ["..", "xx", "x."], near: ["....", ".xx.", "x..x", "....", "...."] },
  /** Narrowed, the lids half down: sizing up, or gleeful and hungry. */
  squint: { far: ["..", "xx", "xx"], near: ["....", "....", "xxxx", "xvxx", ".xx."] },
  /** Squeezed shut (a hit). */
  shut: { far: ["x.", ".x", "x."], near: ["...x", ".xx.", "x...", ".xx.", "...x"] },
  /** Wide, the whites showing (worried). */
  wide: { far: ["xw", "xw", "ww"], near: [".ww.", "xxww", "xxww", "wwww", ".ww."] },
  /** One eye shut (smug, or sighting along a line). */
  wink: { far: ["..", "..", "xx"], near: [".xx.", "xvxx", "xvxx", "xxxx", ".xx."] },
};
const BROWS: Record<Brow, { far: readonly string[]; fx: number; fy: number; near: readonly string[]; nx: number; ny: number }> = {
  cheer: { far: [".bb", "b.."], fx: 27, fy: 19, near: [".aaa.", "a...a"], nx: 35, ny: 18 },
  angry: { far: ["b..", ".bb"], fx: 27, fy: 19, near: ["...aa", ".aa..", "a...."], nx: 35, ny: 18 },
  worry: { far: ["..b", "bb."], fx: 27, fy: 18, near: ["aa...", "..aa.", "....a"], nx: 35, ny: 17 },
  up: { far: [".bb", "b.."], fx: 27, fy: 17, near: [".aaa.", "a...a"], nx: 35, ny: 16 },
};

function head(mood: Mood, brow: Brow = "cheer", mouth: Mouth = "smile", jaw = 0, tongue = false): Painted {
  const p = pic(10, 10, 48, 37);
  const light = roundLight(33, 20, 16, 14, 0.08);
  const fur: Key = (x, y) => ramp("abcde", light(x, y));
  // Small round ears at the sides, under the hat's brim.
  p.F(inEllipse(25, 21, 3.4, 3.4), () => "c");
  p.F(inEllipse(25.3, 21.3, 1.7, 1.7), () => "a");
  p.F(inEllipse(53, 21, 3.6, 3.6), () => "c");
  p.F(inEllipse(52.7, 21.3, 1.8, 1.8), () => "a");
  // A round skull and chubby cheeks.
  p.F(inEllipse(38.5, 27, 14.5, 12.5), fur);
  p.F(inEllipse(31, 32, 10, 7.5), fur);
  p.F(inEllipse(45, 32.5, 8.5, 6.5), fur);
  // The muzzle: pale, pointing to our left.
  const ml = roundLight(23, 28, 8, 6, 0.12);
  p.F(inEllipse(25.5, 31, 7.6, 5.6), (x, y) => ramp("mnN", ml(x, y)));
  // The open jaw: a chin dropped under the teeth.
  if (mouth === "open" && jaw > 0) p.F(inEllipse(22.5, 37 + jaw, 6.2, 2.7), (x, y) => ramp("mnN", ml(x, y) - 0.15));
  // Whisker pores on the muzzle, and a couple of whiskers over the near cheek.
  p.S(["m.m", ".m."], 28, 30);
  p.S(["...aa", "aa..."], 33, 31);
  p.S(["aaa"], 34, 33);
  // Brows.
  const br = BROWS[brow];
  p.S(br.far, br.fx, br.fy);
  p.S(br.near, br.nx, br.ny);
  // Eyes.
  const e = EYES[mood];
  p.S(e.far, 28, 22);
  p.S(e.near, 36, 21);
  // The nose: dark and round at the snout's tip, a glint.
  p.S([".xxxx.", "xXXxxx", "xxxxxx", ".xxxx."], 17, 25);
  p.S(["x", "x"], 21, 29);
  // The mouth (corners up) and the big buck teeth.
  if (mouth === "frown") p.S([".........", ".xxxxxxx.", "xwwwxwwwx", ".wwwxwww.", ".wwwxwwW.", ".WWWxWWW."], 18, 31);
  else p.S(["x.......x", ".xxxxxxx.", ".wwwxwww.", ".wwwxwww.", ".wwwxwwW.", ".WWWxWWW."], 18, 31);
  if (mouth === "grin") p.S(["x.........x"], 17, 30);
  if (mouth === "open" && jaw > 0) {
    // The dark of his mouth under the teeth, his tongue at its bottom.
    for (let j = 0; j < jaw; j++) p.S([j === jaw - 1 && jaw > 1 ? "xxqqqqqxx" : "xxxxxxxxx"], 18, 37 + j);
    // His lower incisors, standing up from the chin once it's well open.
    if (jaw >= 3) p.S([".ww.ww.", ".WW.WW."], 19, 35 + jaw);
  }
  if (tongue) p.S([".qq", "qqQ", ".Q."], 15, 32);
  return p.done();
}

/** The hard hat: an orange dome with a ridge, a brim lower at the front (our left); `tilt` degrees clockwise. */
function hat(tilt = 0): Painted {
  const p = tilt ? pic(9, -6, 58, 34) : pic(17, 2, 42, 20);
  const a = (tilt * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  // Where a pixel of the tilted hat comes from on the upright one (about the middle of its brim).
  const src = (x: number, y: number): Pt => {
    if (!tilt) return [x, y];
    const dx = x + 0.5 - 38;
    const dy = y + 0.5 - 16;
    return [38 + dx * c + dy * s - 0.5, 16 - dx * s + dy * c - 0.5];
  };
  const R = (f: Inside): Inside => (x, y) => {
    const [u, v] = src(x, y);
    return f(u, v);
  };
  const domeU = and(inEllipse(39, 17.5, 14.5, 13.5), (_x, y) => y < 16);
  const dome = R(domeU);
  const light = roundLight(33, 7, 14, 10, 0.12);
  p.F(dome, (x, y) => {
    const [u, v] = src(x, y);
    return ramp("oOLl", light(u, v));
  });
  // The ridge down the middle: lit on its left, shadowed on its right.
  const col = (x: number, y: number) => Math.round(src(x, y)[0]);
  const row = (x: number, y: number) => src(x, y)[1];
  p.F(and(dome, (x, y) => col(x, y) === 38), (x, y) => (row(x, y) < 7.5 ? "l" : "L"));
  p.F(and(dome, (x, y) => col(x, y) === 39), () => "o");
  p.F(and(dome, (x, y) => col(x, y) === 31 && row(x, y) > 6), () => "L");
  p.F(and(dome, (x, y) => col(x, y) === 47 && row(x, y) > 5), () => "o");
  const brim = R(inPoly([[18.5, 20], [20.5, 15.5], [55, 14.5], [57, 16], [55, 17.6], [24, 20.4]]));
  p.F(brim, (x, y) => (!brim(x, y - 1) ? (src(x, y)[0] < 44 ? "l" : "L") : !brim(x, y + 1) ? "o" : "O"));
  return p.done();
}

// ---- The body: fur, the orange vest, the yellow harness straps.

function body(): Painted {
  const p = pic(20, 32, 42, 46);
  const torso = inEllipse(40, 55.5, 17.5, 21);
  const light = roundLight(35, 45, 18, 22, 0.05);
  p.F(torso, (x, y) => ramp("abcd", light(x, y)));
  p.F(and(torso, inEllipse(37.5, 57, 9.5, 15)), (x, y) => ramp("mnN", light(x, y) + 0.1));
  // The vest, open down the front.
  const opening = inPoly([[32, 33], [43, 33], [42.5, 47], [42, 62], [34, 62], [33, 47]]);
  // Light belly fur all down the opening.
  p.F(and(torso, opening), (x, y) => ramp("mnN", light(x, y) + 0.15));
  const vest = and(torso, (_x, y) => y < 63, not(opening));
  // A red-orange safety vest (a shade apart from the hat), a dark trim along its open front.
  p.F(vest, (x, y) => (opening(x - 1, y) || opening(x + 1, y) ? "E" : ramp("EFFG", light(x, y) + 0.08)));
  // Two reflective stripes.
  for (const sy of [49, 53]) {
    p.F(and(vest, (_x, y) => y === sy), () => "I");
    p.F(and(vest, (_x, y) => y === sy + 1), () => "K");
  }
  // The harness straps over the shoulders, down to the belt, each with a buckle.
  const strapL = inPoly([[28, 35], [31.5, 34.6], [32, 63], [29, 63]]);
  const strapR = inPoly([[45, 34.6], [48.5, 35], [48, 63], [45, 63]]);
  for (const st of [strapL, strapR]) {
    p.F(and(torso, st), (x, y) => (!st(x - 1, y) ? "Z" : !st(x + 1, y) ? "y" : "Y"));
  }
  p.S(["PPPP", "P..P", "PPPP"], 28, 45);
  p.S(["PPPP", "P..P", "PPPP"], 45, 45);
  return p.done();
}

function thigh(cx: number): Painted {
  const p = pic(cx - 9, 62, 18, 14);
  const light = roundLight(cx - 2, 67, 8, 7, 0);
  p.F(inEllipse(cx, 70, 7.6, 6.2), (x, y) => ramp("abcd", light(x, y)));
  return p.done();
}

function foot(cx: number): Painted {
  const p = pic(cx - 10, 74, 20, 8);
  const light = roundLight(cx - 2, 77, 9, 3.5, 0);
  p.F(inEllipse(cx, 78.6, 8.6, 3.1), (x, y) => ramp("abc", light(x, y)));
  // Webbed toes to the front (our left).
  p.S(["a..a..a", "a..a..a"], cx - 7, 79);
  return p.done();
}

function shadow(): Painted {
  const p = pic(10, GROUND - 2, 68, 4);
  p.F(inEllipse(44, GROUND, 33, 1.8), () => "z");
  return p.done(false);
}

// ---- The planks on his back: wood from a top end to a bottom end, a strap across each.

function plank(top: Pt, bot: Pt, hw: number, strapAt: number): Painted {
  const x0 = Math.floor(Math.min(top[0], bot[0]) - hw - 1);
  const y0 = Math.floor(Math.min(top[1], bot[1]) - hw - 1);
  const p = pic(x0, y0, Math.ceil(Math.abs(top[0] - bot[0]) + 2 * hw + 3), Math.ceil(Math.abs(top[1] - bot[1]) + 2 * hw + 3));
  const len = Math.hypot(bot[0] - top[0], bot[1] - top[1]);
  const ux = (bot[0] - top[0]) / len;
  const uy = (bot[1] - top[1]) / len;
  // The across direction, and how much it faces the light (top left).
  const nx = -uy;
  const ny = ux;
  const lit = -0.6 * nx - 0.8 * ny; // >0: positive across faces the light
  p.F(
    (x, y) => {
      const rx = x + 0.5 - top[0];
      const ry = y + 0.5 - top[1];
      const al = rx * ux + ry * uy;
      const ac = rx * nx + ry * ny;
      return al >= 0 && al <= len && Math.abs(ac) <= hw;
    },
    (x, y) => {
      const rx = x + 0.5 - top[0];
      const ry = y + 0.5 - top[1];
      const al = rx * ux + ry * uy;
      const ac = rx * nx + ry * ny;
      if (al < 1.6) return Math.abs(ac) < 1.2 ? "j" : "H";
      if (al >= strapAt && al < strapAt + 2.4) return Math.abs(ac) > hw - 1.2 ? "g" : al < strapAt + 1 ? "J" : "g";
      const l = 0.5 + 0.5 * (ac / hw) * Math.sign(lit);
      // Grain: two broken lines along the plank.
      if (Math.abs(ac + 1) < 0.5 && Math.floor((al + 2) / 7) % 3 !== 0) return "j";
      if (Math.abs(ac - 1.6) < 0.5 && Math.floor(al / 5) % 2 === 0) return "J";
      return l > 0.78 ? "H" : l > 0.22 ? "h" : "j";
    },
  );
  return p.done();
}

// ---- The tail: a flat paddle on the ground behind him, crosshatched, turned about its root.

const TAIL_ROOT: Pt = [55, 71];
function tail(deg: number): Painted {
  const a = (deg * Math.PI) / 180;
  const p = pic(TAIL_ROOT[0] - 2, TAIL_ROOT[1] - 18, 34, 28);
  const local = (x: number, y: number): Pt => {
    const dx = x + 0.5 - TAIL_ROOT[0];
    const dy = y + 0.5 - TAIL_ROOT[1];
    return [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const inside: Inside = (x, y) => {
    const [u, v] = local(x, y);
    return ((u - 14) / 14) ** 2 + (v / 6.6) ** 2 <= 1;
  };
  p.F(inside, (x, y) => {
    const [u, v] = local(x, y);
    const r = ((u - 14) / 14) ** 2 + (v / 6.6) ** 2;
    if (r > 0.72) return v < -2 ? "U" : "u";
    const hatch = Math.abs(((u + v * 1.2) % 5 + 5) % 5 - 2.5) < 0.5 || Math.abs(((u - v * 1.2) % 5 + 5) % 5 - 2.5) < 0.5;
    if (hatch) return "t";
    const l = 0.55 - 0.3 * ((u - 14) / 14) - 0.6 * (v / 6.6);
    return ramp("uUV", l);
  });
  return p.done();
}

// ---- The tool belt and what hangs on it.

function belt(): Painted {
  const p = pic(20, 58, 41, 10);
  const band = inPoly([[21.5, 60], [30, 61.6], [40, 62], [50, 61.6], [58.5, 60], [58.8, 64.4], [50, 66], [40, 66.4], [30, 66], [21.2, 64.4]]);
  p.F(band, (x, y) => (!band(x, y - 1) ? "Z" : !band(x, y + 1) ? "y" : x > 54 ? "y" : "Y"));
  p.S(["TTTTTT", "TSxxST", "TSxxST", "TTTTTT"], 35, 62);
  return p.done();
}

/** The hammer, hung through a loop at his hip: a steel head, a red handle. */
function hammer(): Painted {
  const p = pic(15, 54, 14, 23);
  p.S(
    [
      "sss........",
      "sSSssssssss",
      "SSSSSSSSSSS",
      "TTT..Rr...T",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....rr....",
    ],
    16,
    55,
  );
  return p.done();
}

/**
 * The hammer in a paw: the grip at `g`, the handle pointing `deg` degrees (0 to our right, -90 up, 180 toward the board)
 * to the steel head; the striking face on the head's left as it points up (toward the board), the claw behind.
 */
function hammerHeld(g: Pt, deg: number): Painted {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = uy;
  const ny = -ux;
  const p = pic(Math.floor(g[0]) - 17, Math.floor(g[1]) - 17, 35, 35);
  const loc = (x: number, y: number): Pt => {
    const rx = x + 0.5 - g[0];
    const ry = y + 0.5 - g[1];
    return [rx * ux + ry * uy, rx * nx + ry * ny];
  };
  const handleAt = (al: number, ac: number) => al >= -5 && al <= 10 && Math.abs(ac) <= 1.1;
  const headAt = (al: number, ac: number) =>
    ac >= -5.2 && ac <= 5.4 && (ac > 2.6 ? al >= 8.3 && al <= 13.4 : ac < -2.4 ? al >= 9.6 && al <= 12.2 : al >= 8.9 && al <= 12.8);
  const hd: Inside = (x, y) => {
    const [al, ac] = loc(x, y);
    return headAt(al, ac);
  };
  const hl: Inside = (x, y) => {
    const [al, ac] = loc(x, y);
    return handleAt(al, ac) && !headAt(al, ac);
  };
  // Lit on the edges facing the top left, dark on the others.
  p.F(hl, (x, y) => (!hl(x - 1, y) || !hl(x, y - 1) ? "R" : "r"));
  p.F(hd, (x, y) => (!hd(x - 1, y) || !hd(x, y - 1) ? "s" : !hd(x + 1, y) || !hd(x, y + 1) ? "T" : "S"));
  return p.done();
}

function tape(): Painted {
  const p = pic(40, 60, 9, 9);
  p.S([".ZYYy.", "ZYBBYy", "YBssBy", "YBSsBy", "yYBByy", ".yyyy."], 41, 61);
  return p.done();
}

function pouches(): Painted {
  const p = pic(48, 62, 14, 12);
  p.S(["ZZZZZZ", "YYYYYy", "yyPyyy", "YYYYYy", "YYYYYy", "YYYYYy", "YYYYyy", "yyyyyy"], 49, 64);
  return p.done();
}
function pouch2(): Painted {
  const p = pic(54, 61, 8, 10);
  p.S(["ZZZZ", "YYYy", "yPyy", "YYYy", "YYyy", "yyyy"], 56, 63);
  return p.done();
}
function wrench(): Painted {
  const p = pic(49, 52, 8, 14);
  p.S(["s..s", "sssS", ".sS.", ".sS.", ".sS.", ".sS.", ".sS.", ".ST.", ".ST.", ".ST."], 51, 54);
  return p.done();
}

/** A scrap of wood, a short offcut, centered near (cx, cy). */
function scrap(cx: number, cy: number): Painted {
  const p = pic(cx - 4, cy - 2, 9, 4);
  p.S(["HHHHHhhj", "hhhhhjjJ", "jJjjjJjJ"], cx - 4, cy - 1);
  return p.done();
}

// ---- Arms: a thick round stroke from the shoulder by the elbow to the paw.

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function arm(pts: readonly Pt[], r: number, r1: number, sleeve: number): Painted {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const pad = Math.ceil(Math.max(r, r1)) + 1;
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  const p = pic(x0, y0, Math.ceil(Math.max(...xs)) + pad - x0 + 1, Math.ceil(Math.max(...ys)) + pad - y0 + 1);
  p.F(
    () => true,
    (x, y) => {
      const q: Pt = [x + 0.5, y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, rr: r, s: 0 };
      pts.slice(1).forEach((b, i) => {
        const n = nearest(q, pts[i]!, b);
        const s = (i + n.t) / (pts.length - 1);
        const rr = r + (r1 - r) * s;
        if (n.d - rr < best.d - best.rr) best = { d: n.d, nx: n.nx, ny: n.ny, rr, s };
      });
      if (best.d > best.rr) return ".";
      const l = 0.6 - 0.42 * (best.nx / best.rr) - 0.5 * (best.ny / best.rr);
      // The vest's armhole: orange at the shoulder.
      return best.s < sleeve ? ramp("oOL", l) : ramp("abcd", l);
    },
  );
  return p.done();
}
function paw(cx: number, cy: number): Painted {
  const p = pic(cx - 4, cy - 4, 9, 9);
  const light = roundLight(cx - 1, cy - 1, 3.4, 3, 0.05);
  p.F(inEllipse(cx + 0.5, cy + 0.5, 3.4, 3.1), (x, y) => ramp("abc", light(x, y)));
  p.S(["a.a"], cx - 1, cy + 1);
  return p.done();
}

/** An elbow for an arm of bones `l1`, `l2` from shoulder `s` to paw `t`, bent down (or straight, out of reach). */
function elbowOf(s: Pt, t: Pt, l1 = 10, l2 = 10): Pt {
  const dist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const [ux, uy] = [(t[0] - s[0]) / dist, (t[1] - s[1]) / dist];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const [mx, my] = [s[0] + ux * a, s[1] + uy * a];
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  return c1[1] >= c2[1] ? c1 : c2;
}

// ---- Parts and poses.

const PARTS: Record<string, Part> = {};
const AT: Record<string, Pt> = {};
function use(name: string, make: () => Painted): string {
  if (!PARTS[name]) {
    const r = make();
    PARTS[name] = r.part;
    AT[name] = r.at;
  }
  return name;
}

const SHOULDER_L: Pt = [25.5, 40];
const SHOULDER_R: Pt = [54.5, 40];
const HAND_L: Pt = [30, 46];
const HAND_R: Pt = [46.5, 46];
const ELBOW_L: Pt = [21.5, 49];
const ELBOW_R: Pt = [59, 49.5];
/** The back plank's line (its top end over his right shoulder), and the way it slides out (up along it). */
const PLANK_R_TOP: Pt = [72, 6];
const PLANK_R_BOT: Pt = [30, 50];
const PLANK_UP: Pt = (() => {
  const dx = PLANK_R_TOP[0] - PLANK_R_BOT[0];
  const dy = PLANK_R_TOP[1] - PLANK_R_BOT[1];
  const l = Math.hypot(dx, dy);
  return [dx / l, dy / l];
})();

interface Arm {
  /** The paw, in rest pixels (it rides his breath, crouch and lean). */
  h: Pt;
  /** The elbow (bent by itself when left out). */
  e?: Pt;
}

interface Pose {
  mood?: Mood;
  brows?: Brow;
  mouth?: Mouth;
  /** His jaw dropped this many pixels under the teeth (with `mouth: "open"`). */
  jaw?: number;
  tongue?: boolean;
  /** His chest up a pixel (breathing in): body, arms, planks, head and hat. */
  breath?: number;
  /** The head a little further (a proud chin up). */
  headDy?: number;
  /** The head moved (a nod, a lean in). */
  head?: Pt;
  /** The tail's angle in degrees (negative: its end up). */
  tail?: number;
  /** Dust off the tail's slap, frames since it. */
  dust?: number;
  /** All of him moved sideways, and up off the ground (the shadow stays). */
  dx?: number;
  air?: number;
  /** A crouch or a sit: his upper body down this far, the thighs half as far, the feet stay; `spread` their feet apart. */
  sink?: number;
  spread?: number;
  /** His upper body (and head) sideways. */
  lean?: number;
  /** The hat on his head: moved and tilted (degrees clockwise). */
  hat?: Pt;
  hatTilt?: number;
  /** The hat off his head: moved this far from where it sits, and tilted. */
  hatOff?: { at: Pt; tilt: number; behind?: boolean };
  armL?: Arm;
  armR?: Arm;
  /** The near arm (and what it holds) in front of his face. */
  front?: boolean;
  /** The far arm in front of his head and hat (a paw on the brim). */
  frontR?: boolean;
  /** The hammer in the near paw (`hammer`) or the far one (`hammerR`): the handle's angle (see hammerHeld). */
  hammer?: number;
  hammerR?: number;
  /** The back plank slid up out of its strap this far; off his back altogether. */
  plankOut?: number;
  noPlank?: boolean;
  /** A plank in his paws, end to end (rest pixels). */
  held?: { top: Pt; bot: Pt };
  /** A scrap of wood at this point (drawing pixels). */
  scrap?: Pt;
  /** Tools spilling off his belt: 1 popping off, 2 on the ground. */
  spill?: number;
}

const k2 = (q: Pt) => `${Math.round(q[0] * 2) / 2},${Math.round(q[1] * 2) / 2}`;
const rnd = (q: Pt): Pt => [Math.round(q[0]), Math.round(q[1])];

function layers(p: Pose): Layer[] {
  const ox = p.dx ?? 0;
  const oy = -(p.air ?? 0);
  const s = p.sink ?? 0;
  const ux = p.lean ?? 0;
  const b = -(p.breath ?? 0) + s;
  const hx = ux + (p.head?.[0] ?? 0);
  const hy = b + (p.headDy ?? 0) + (p.head?.[1] ?? 0);
  const sp = p.spread ?? 0;
  const L = (name: string, dx = 0, dy = 0): Layer => ({ part: name, x: AT[name]![0] + dx + ox, y: AT[name]![1] + dy + OY + oy });
  const tailDeg = Math.round(p.tail ?? -8);
  const out: Layer[] = [];
  const shadowName = use("shadow", shadow);
  out.push({ part: shadowName, x: AT[shadowName]![0] + ox, y: AT[shadowName]![1] + OY });
  out.push(L(use(`tail:${tailDeg}`, () => tail(tailDeg))));
  out.push(L(use("plankL", () => plank([13, 7], [63, 62], 4.2, 9)), ux, b));
  if (!p.noPlank) {
    const po = p.plankOut ?? 0;
    out.push(L(use("plankR", () => plank(PLANK_R_TOP, PLANK_R_BOT, 4.2, 11)), ux + Math.round(PLANK_UP[0] * po), b + Math.round(PLANK_UP[1] * po)));
  }
  out.push(L(use("body", body), ux, b));
  const ts = Math.round(s * 0.6);
  out.push(L(use("thighR", () => thigh(50)), Math.round(sp / 2), ts));
  out.push(L(use("thighL", () => thigh(31)), -Math.round(sp / 2), ts));
  out.push(L(use("footR", () => foot(51)), sp));
  out.push(L(use("footL", () => foot(26)), -sp));
  const bx = Math.round(ux / 2);
  if (p.hammer === undefined && p.hammerR === undefined) out.push(L(use("hammer", hammer), bx, s));
  out.push(L(use("belt", belt), bx, s));
  const spill = p.spill ?? 0;
  if (spill === 0) {
    out.push(L(use("tape", tape), bx, s));
    out.push(L(use("wrench", wrench), bx, s));
  }
  out.push(L(use("pouches", pouches), bx, s));
  out.push(L(use("pouch2", pouch2), bx, s));
  if (spill === 1) {
    out.push(L(use("tape", tape), bx - 3, s - 4));
    out.push(L(use("wrench", wrench), bx + 5, s - 7));
  }
  if (spill >= 2) {
    // On the ground: the tape rolled out in front, the wrench lying by his tail.
    out.push({ part: use("tape", tape), x: 4 + ox, y: GROUND - 6 + OY });
    out.push({ part: use("wrench", wrench), x: 64 + ox, y: GROUND - 4 + OY, rot: 1 });
  }

  // Arms, paws, what they hold, the head and the hat.
  const armPart = (sh: Pt, a: Arm | undefined, e0: Pt, h0: Pt, name: string): { arm: string; paw: string; hand: Pt } => {
    if (!a) return { arm: use(`arm${name}`, () => arm([sh, e0, h0], 3.2, 2.5, 0)), paw: use(`paw${name}`, () => paw(h0[0], h0[1])), hand: h0 };
    const h = rnd(a.h);
    const e = a.e ?? elbowOf(sh, h);
    const pts: Pt[] = [sh, e, h];
    return { arm: use(`arm:${pts.map(k2).join(";")}`, () => arm(pts, 3.2, 2.5, 0)), paw: use(`paw:${k2(h)}`, () => paw(h[0], h[1])), hand: h };
  };
  const AL = armPart(SHOULDER_L, p.armL, ELBOW_L, HAND_L, "L");
  const AR = armPart(SHOULDER_R, p.armR, ELBOW_R, HAND_R, "R");
  const U = (name: string) => L(name, ux, b);
  const hammerL = p.hammer !== undefined ? [U(use(`hammer:${k2(AL.hand)}:${Math.round(p.hammer)}`, () => hammerHeld(AL.hand, Math.round(p.hammer!))))] : [];
  const hammerR = p.hammerR !== undefined ? [U(use(`hammer:${k2(AR.hand)}:${Math.round(p.hammerR)}`, () => hammerHeld(AR.hand, Math.round(p.hammerR!))))] : [];
  const held = p.held ? [U(use(`held:${k2(p.held.top)}:${k2(p.held.bot)}`, () => plank(p.held!.top, p.held!.bot, 4.2, 99)))] : [];
  const hk = `head:${p.mood ?? "smile"}:${p.brows ?? "cheer"}:${p.mouth ?? "smile"}:${p.jaw ?? 0}:${p.tongue ? 1 : 0}`;
  const headL = L(use(hk, () => head(p.mood ?? "smile", p.brows ?? "cheer", p.mouth ?? "smile", p.jaw ?? 0, p.tongue ?? false)), hx, hy);
  const tilt = Math.round(p.hatTilt ?? 0);
  const hatL = p.hatOff ? [] : [L(use(`hat:${tilt}`, () => hat(tilt)), hx + (p.hat?.[0] ?? 0), hy + (p.hat?.[1] ?? 0))];
  if (p.frontR) {
    out.push(U(AL.arm), ...hammerL, U(AL.paw), headL, ...hatL, U(AR.arm), ...hammerR, U(AR.paw));
  } else if (p.front) {
    out.push(U(AR.arm), ...hammerR, U(AR.paw), headL, ...hatL, U(AL.arm), ...held, ...hammerL, U(AL.paw));
  } else {
    out.push(U(AL.arm), U(AR.arm), ...held, ...hammerL, ...hammerR, U(AL.paw), U(AR.paw), headL, ...hatL);
  }
  if (p.hatOff) {
    const t = Math.round(p.hatOff.tilt);
    const hl = L(use(`hat:${t}`, () => hat(t)), p.hatOff.at[0], p.hatOff.at[1]);
    // On the ground behind his legs (just after the tail), or in the air in front of all.
    if (p.hatOff.behind) out.splice(2, 0, hl);
    else out.push(hl);
  }
  if (p.scrap) {
    const c = rnd(p.scrap);
    out.push(L(use(`scrap:${k2(c)}`, () => scrap(c[0], c[1]))));
  }
  return out;
}

/** Whiskers off his snout (loose pixels, no outline), riding the head. */
function whiskers(dy: number, dx = 0): Speck[] {
  const w: Pt[] = [[15, 29], [14, 29], [13, 28], [12, 28], [15, 31], [14, 31], [13, 31], [12, 32]];
  return w.map(([x, y]): Speck => [x + dx, y + dy, "i"]);
}
/** Dust puffing up off the ground where the tail slapped, `t` frames on. */
function dust(t: number): Speck[] {
  const out: Speck[] = [];
  const pts: Pt[] = [[74, GROUND - 2], [80, GROUND - 2], [70, GROUND - 1], [83, GROUND - 1], [77, GROUND - 3]];
  pts.forEach(([x, y], i) => {
    const dx = (i % 2 ? 1 : -1) * t;
    out.push([x + dx, y - t - (i % 3 === 0 ? 1 : 0), "D"]);
  });
  return out.filter(([x, y]) => x >= 1 && x < W - 1 && y >= 1 && y < H - 1);
}

const f = (ms: number, p: Pose, extra: Partial<Frame> = {}): Frame => {
  const hy = -(p.breath ?? 0) + (p.headDy ?? 0) + (p.sink ?? 0) + (p.head?.[1] ?? 0) - (p.air ?? 0);
  const hx = (p.lean ?? 0) + (p.head?.[0] ?? 0) + (p.dx ?? 0);
  const specks: Speck[] = [...whiskers(hy + OY, hx), ...(p.dust !== undefined ? dust(p.dust).map(([x, y, k]): Speck => [x + (p.dx ?? 0), y + OY, k]) : []), ...(extra.specks ?? [])];
  const fr: Frame = { ms, layers: layers(p), specks };
  return { ...fr, ...(extra.cue ? { cue: extra.cue } : {}), ...(extra.shake ? { shake: extra.shake } : {}), ...(extra.pal ? { pal: extra.pal } : {}) };
};

/**
 * Idle (about 4 s): he breathes slowly (his chest, arms, head and hat rise a pixel and settle), blinks, then gives
 * his tail a pat on the ground (up, and down with a puff of dust), and shuts his eyes a moment, pleased with himself.
 */
const BREATH = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const TAIL = [-8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -12, -18, -22, -22, 0, -4, -7, -8, -8, -8, -8, -8, -8, -8];
const idle: Anim = {
  loop: true,
  frames: BREATH.map((br, i) => {
    const mood: Mood = i === 5 ? "blink" : i >= 15 && i <= 19 ? "proud" : "smile";
    return f(i === 5 ? 130 : i === 14 ? 120 : 170, {
      mood,
      breath: br,
      headDy: i >= 16 && i <= 18 ? -1 : 0,
      tail: TAIL[i],
      dust: i >= 14 && i <= 16 ? i - 14 : undefined,
    });
  }),
};

// ---- Things on his frames: chips, sawdust, sweat, the ground's dust. Drawing pixels (the frame adds OY).

const px = (x: number, y: number, k: string): Speck => [Math.round(x), Math.round(y) + OY, k];
const WOOD = "HhjJ";
/** Wood chips flung from (x, y), `t` frames on: a fan of them heading `dir` (-1 our left, 1 right), falling. */
function chips(x: number, y: number, t: number, seed = 0, n = 7, dir = -1): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const r = ((i * 37 + seed * 23) % 13) / 13;
    const vx = dir * (0.6 + r * 2.4) + (i % 3 === 0 ? -dir * 1.2 : 0);
    const vy = -(1.6 + ((i * 7 + seed) % 5) * 0.55);
    const cx = x + vx * (t + 1);
    const cy = y + vy * (t + 1) + 0.55 * (t + 1) * (t + 1);
    const k = WOOD[(i + seed) % 4]!;
    out.push(px(cx, cy, k));
    if (i % 2 === 0) out.push(px(cx + 1, cy, WOOD[(i + seed + 1) % 4]!));
  }
  return out;
}
/** Wood chips raining down like confetti, frame `t`. */
function confetti(t: number, n = 10): Speck[] {
  return Array.from({ length: n }, (_, i): Speck[] => {
    const x = 4 + ((i * 17 + t * (i % 2 ? 2 : -2) + 400) % 80);
    const y = -2 + ((i * 13 + t * 4) % 46);
    return [px(x, y, WOOD[i % 4]!), ...(i % 3 === 0 ? [px(x + 1, y, WOOD[(i + 1) % 4]!)] : [])];
  }).flat();
}
/** Splinters (short sticks of wood) and chips spat from (x, y), `t` frames on, mostly to our left and down. */
function splinters(x: number, y: number, t: number, seed = 0): Speck[] {
  const out: Speck[] = [...chips(x, y, t, seed, 9, -1)];
  for (let i = 0; i < 4; i++) {
    const vx = -(1.4 + ((i * 5 + seed * 3) % 4) * 0.7);
    const vy = -1.2 + ((i * 3 + seed) % 4) * 0.8;
    const cx = x + vx * (t + 1.2);
    const cy = y + vy * (t + 1.2) + 0.5 * (t + 1) * (t + 1);
    const steep = (i + seed) % 2 === 0;
    out.push(px(cx, cy, "H"), px(cx + (steep ? 1 : 1), cy + (steep ? 1 : 0), "h"), px(cx + 2, cy + (steep ? 2 : 0), "j"));
  }
  return out;
}
/** A puff of sawdust at (x, y), `t` frames on. */
function puff(x: number, y: number, t: number): Speck[] {
  const ring: Record<number, readonly (readonly [number, number, string])[]> = {
    0: [[0, 0, "C"], [1, 0, "C"], [-1, 0, "D"], [0, -1, "C"], [1, -1, "D"], [-1, -1, "C"], [2, 0, "D"]],
    1: [[-2, 0, "C"], [3, 0, "C"], [0, -2, "C"], [-1, -2, "D"], [2, -2, "C"], [-2, -1, "D"], [3, -1, "D"], [1, -3, "C"]],
    2: [[-3, -1, "D"], [4, -1, "D"], [-1, -4, "D"], [3, -3, "D"], [1, -4, "C"]],
  };
  return (ring[Math.min(2, t)] ?? []).map(([dx, dy, k]) => px(x + dx, y + dy, k));
}
/** Dust kicked up either side of his feet, `t` frames after he lands. */
function feetDust(t: number): Speck[] {
  const out: Speck[] = [];
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 15 : 63;
    for (let i = 0; i < 3; i++) {
      const x = x0 + side * (i * 3 + t * 2);
      const y = GROUND - 1 - Math.round(t * 0.7 + (i % 2));
      out.push(px(x, y, t < 2 ? "C" : "D"), px(x + side, y - 1, "D"));
    }
  }
  return out;
}
/** Sweat flying off his head, frame `i`. */
function sweat(i: number): Speck[] {
  const t = i % 3;
  return [px(15 - t, 16 + t * 2, "~"), px(15 - t, 17 + t * 2, "~"), px(56 + t, 18 + t * 2, "~"), px(57 + t, 19 + t * 2, "~"), ...(i % 2 ? [px(44, 15, "~")] : [])];
}
/** Little stars round his head, dazed, frame `i`. */
function stars(i: number): Speck[] {
  const pts: Pt[] = [[22, 8], [40, 4], [56, 8]];
  return pts.flatMap(([x, y], j) => {
    const dx = Math.round(3 * Math.cos(i * 1.3 + j * 2.1));
    const dy = Math.round(1.5 * Math.sin(i * 1.3 + j * 2.1));
    return [px(x + dx, y + dy, "Z"), px(x + dx - 1, y + dy, "Y"), px(x + dx + 1, y + dy, "Y"), px(x + dx, y + dy - 1, "Y"), px(x + dx, y + dy + 1, "Y")];
  });
}
/** His shadow alone on the ground (before he drops in), `r` its half-width. */
function shadowOnly(r: number): Speck[] {
  const out: Speck[] = [];
  for (let x = Math.round(44 - r); x <= Math.round(44 + r); x++) out.push(px(x, GROUND, "z"), ...(Math.abs(x - 44) < r - 3 ? [px(x, GROUND - 1, "z"), px(x, GROUND + 1, "z")] : []));
  return out;
}

/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(PALETTE)
    .filter(([k]) => !["k", "z", "~"].includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);

// ---- Hammer poses in the near paw.

/** His near paw on the hammer at his hip (it still hangs there). */
const AT_HIP: Pose = { armL: { h: [21, 60] } };
/** The hammer just off his belt, upright in his paw at his hip. */
const DRAWN: Pose = { armL: { h: [21, 60] }, hammer: -90 };
/** Pointing it at the board. */
const POINT: Pose = { armL: { h: [14, 42] }, hammer: -150 };
/** Raised high. */
const HIGH: Pose = { armL: { h: [11, 23] }, hammer: -96 };
/** His far paw up on the hat's brim (at height `y`), in front of it. */
const BRIM = (y: number): Pose => ({ armR: { h: [57, y], e: [65, 30] }, frontR: true });

// ---- His animations.

/** Entrance: his shadow spreads, he drops in and lands with a stomp, sets his hard hat with a pat, twirls the hammer and taps it. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: shadowOnly(8), cue: "drop" },
    { ms: 90, layers: [], specks: shadowOnly(18) },
    f(70, { air: 34, mood: "wide", brows: "up", mouth: "open", jaw: 2, hat: [0, -4], hatTilt: -6, armL: { h: [18, 34] }, armR: { h: [62, 34] }, tail: -20 }),
    f(70, { air: 12, mood: "wide", brows: "up", mouth: "open", jaw: 1, hat: [0, -3], hatTilt: -4, armL: { h: [19, 38] }, armR: { h: [61, 38] }, tail: -14 }),
    f(130, { sink: 4, spread: 1, mood: "shut", tail: 0 }, { cue: "stomp", shake: [0, 2], specks: feetDust(0) }),
    f(100, { sink: 2, mood: "blink", hat: [-1, 1], hatTilt: -8, tail: -4 }, { specks: feetDust(1) }),
    f(110, { sink: 0, hat: [-1, 0], hatTilt: -8, ...BRIM(17) }, { specks: feetDust(2) }),
    f(110, { hat: [0, -1], hatTilt: 0, ...BRIM(15), mood: "proud" }),
    f(120, { sink: 1, hat: [0, 0], ...BRIM(16), mood: "proud", mouth: "grin" }, { cue: "pat" }),
    f(90, { ...AT_HIP }),
    f(70, { armL: { h: [16, 46] }, hammer: -150, front: true }, { cue: "whoosh" }),
    f(60, { armL: { h: [16, 45] }, hammer: -60, front: true }),
    f(60, { armL: { h: [16, 45] }, hammer: 30, front: true }),
    f(60, { armL: { h: [16, 45] }, hammer: 120, front: true }),
    f(70, { armL: { h: [16, 44] }, hammer: -80, front: true, mood: "squint", mouth: "grin" }),
    f(120, { armL: { h: [16, 52] }, hammer: 170, mood: "proud", mouth: "grin" }, { cue: "tap", specks: puff(6, 58, 0) }),
    f(110, { armL: { h: [16, 50] }, hammer: 175, mood: "proud", mouth: "grin" }, { specks: puff(6, 58, 1) }),
    f(90, { ...DRAWN }),
    f(240, {}),
  ],
};

/** Thinking (loop): sizing up the board like a job: a paw on his chin, eyes narrowed, one shut to sight along it; the tail taps. */
const CHIN: Pose = { armL: { h: [23, 40] }, front: true };
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) =>
    f(i === 7 ? 120 : 190, {
      ...CHIN,
      mood: i >= 8 && i <= 10 ? "wink" : i === 4 ? "blink" : "squint",
      brows: i >= 8 && i <= 10 ? "angry" : "cheer",
      head: [i >= 8 && i <= 10 ? -1 : 0, 0],
      breath: [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0][i],
      armL: { h: [23, 40 - (i % 6 === 2 ? 1 : 0)] },
      tail: [-8, -8, -8, -8, -8, -14, -20, 0, -8, -8, -14, -4][i],
      dust: i === 7 ? 0 : i === 8 ? 1 : undefined,
    }, { cue: i === 7 ? "tap" : undefined }),
  ),
};

/** His move: a quick point of the hammer at the board, a tap in the air, and back on the belt. */
const move: Anim = {
  loop: false,
  frames: [
    f(80, { ...AT_HIP, lean: -1 }),
    f(90, { ...POINT, lean: -1, head: [-1, 0], mood: "squint" }),
    f(110, { armL: { h: [16, 43] }, hammer: -165, lean: -2, head: [-1, 1], mood: "smile", mouth: "grin" }, { cue: "tap", specks: puff(4, 37, 0) }),
    f(130, { armL: { h: [16, 42] }, hammer: -160, lean: -1, head: [-1, 0], mouth: "grin" }, { specks: puff(4, 37, 1) }),
    f(90, { ...DRAWN }),
    f(150, {}),
  ],
};

/** A capture: a big satisfied swing of the hammer, a whack, wood chips flying, and a proud rest with it on his shoulder. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { ...AT_HIP, sink: 1 }),
    f(120, { armL: { h: [16, 24] }, hammer: -112, lean: 1, mood: "squint", brows: "angry", tail: -14 }),
    f(50, { armL: { h: [13, 32] }, hammer: -165, lean: -1, mood: "squint", brows: "angry" }),
    f(100, { armL: { h: [14, 42] }, hammer: 140, lean: -2, head: [-1, 1], mood: "shut", mouth: "grin", tail: 0, sink: 1 }, { cue: "whack", shake: [-1, 1], specks: [...chips(6, 52, 0, 1), ...puff(5, 54, 0)] }),
    f(90, { armL: { h: [14, 41] }, hammer: 145, lean: -2, head: [-1, 1], mood: "proud", mouth: "grin", dust: 0 }, { specks: [...chips(6, 52, 1, 1), ...puff(5, 54, 1)] }),
    f(90, { armL: { h: [16, 39] }, hammer: 165, lean: -1, mood: "proud", mouth: "grin", dust: 1 }, { specks: chips(6, 52, 2, 1) }),
    f(160, { armL: { h: [12, 35] }, hammer: -100, mood: "proud", mouth: "grin", headDy: -1 }, { specks: chips(6, 52, 3, 1) }),
    f(220, { armL: { h: [12, 34] }, hammer: -100, mood: "proud", mouth: "grin", headDy: -1, breath: 1 }),
    f(100, { ...DRAWN }),
    f(150, {}),
  ],
};

/** Hurt: a flash and a shake, his hat knocked askew; a gruff glare, and he straightens it with a paw. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(80, { dx: 1, sink: 1, mood: "shut", brows: "worry", mouth: "frown", hat: [3, -4], hatTilt: 18, tail: -16 }, { cue: "oof", pal: FLASH, shake: [2, 0], specks: sweat(0) }),
    f(80, { dx: 1, sink: 1, mood: "shut", brows: "worry", mouth: "frown", hat: [3, -2], hatTilt: 16, tail: -10 }, { shake: [-1, 0], specks: sweat(1) }),
    f(130, { mood: "wide", brows: "worry", mouth: "frown", hat: [2, 0], hatTilt: 14 }),
    f(110, { mood: "smile", brows: "angry", mouth: "frown", hat: [2, 0], hatTilt: 14 }),
    f(120, { mood: "smile", brows: "angry", mouth: "frown", hat: [2, 0], hatTilt: 14, ...BRIM(20) }),
    f(110, { mood: "squint", brows: "angry", mouth: "frown", hat: [1, -1], hatTilt: 6, ...BRIM(16) }),
    f(130, { mood: "smile", brows: "angry", hat: [0, 0], ...BRIM(16) }, { cue: "pat" }),
    f(160, {}),
  ],
};

/** Check: a firm point of the hammer at the board, brows down, leaning in; a jab for emphasis. */
const check: Anim = {
  loop: false,
  frames: [
    f(80, { ...AT_HIP }),
    f(90, { armL: { h: [13, 30] }, hammer: -120, brows: "angry", mood: "squint" }),
    f(150, { armL: { h: [18, 40] }, hammer: -175, lean: -2, head: [-1, 0], brows: "angry", mouth: "frown" }, { cue: "point", shake: [-1, 0] }),
    f(260, { armL: { h: [18, 40] }, hammer: -175, lean: -2, head: [-1, 0], brows: "angry", mouth: "frown", tail: -14 }),
    f(90, { armL: { h: [17, 41] }, hammer: -178, lean: -3, head: [-2, 0], brows: "angry", mouth: "frown", tail: 0 }, { cue: "tap", specks: puff(4, 36, 0) }),
    f(200, { armL: { h: [18, 40] }, hammer: -175, lean: -2, head: [-1, 0], brows: "angry", mouth: "grin", dust: 0 }, { specks: puff(4, 36, 1) }),
    f(100, { ...DRAWN, dust: 1 }),
    f(160, {}),
  ],
};

/** Smug (loop): the hammer on his shoulder, chin up, a toothy grin, a wink; the tail pats slowly. */
const SHOULDERED: Pose = { armR: { h: [51, 43] }, hammerR: -42 };
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) =>
    f(i === 6 ? 120 : 180, {
      ...SHOULDERED,
      mood: i === 4 ? "wink" : i === 5 ? "wink" : "proud",
      mouth: "grin",
      headDy: -1,
      breath: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0][i],
      tail: [-8, -8, -12, -16, -20, -20, 0, -4, -8, -8][i],
      dust: i === 6 ? 0 : i === 7 ? 1 : undefined,
    }),
  ),
};

/** Rattled (loop): worried, eyes wide, sweat flying, the tail twitching, his hat slipping down over his brow. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(90, {
      dx: i % 2 ? 1 : 0,
      mood: i === 5 ? "blink" : "wide",
      brows: "worry",
      mouth: "frown",
      hat: [i % 4 < 2 ? 0 : -1, [1, 2, 2, 3, 3, 2, 2, 1][i]!],
      hatTilt: [-4, -6, -8, -6, -4, -2, 0, -2][i]!,
      tail: [-8, -16, -6, -18, -8, -14, -4, -12][i],
      armL: { h: [28, 44 + (i % 2)] },
      armR: { h: [44, 44 + ((i + 1) % 2)] },
    }, { specks: sweat(i) }),
  ),
};

/** Defeat: a flash, his hat flies off, he sits down hard, his tools spill, the hat lands upside down; dazed, held. */
const SAT: Pose = { sink: 5, spread: 3, armL: { h: [27, 57] }, armR: { h: [51, 57] }, tail: 0, spill: 2 };
const defeat: Anim = {
  loop: false,
  frames: [
    f(90, { dx: 1, mood: "shut", brows: "worry", mouth: "frown", hat: [2, -8], hatTilt: -16, tail: -18 }, { cue: "oof", pal: FLASH, shake: [2, 0] }),
    f(90, { sink: 2, mood: "wide", brows: "worry", mouth: "open", jaw: 2, hatOff: { at: [-10, -14], tilt: -50 }, spill: 1, tail: -12 }, { specks: sweat(0) }),
    f(130, { ...SAT, mood: "shut", brows: "worry", mouth: "frown", hatOff: { at: [-18, 26], tilt: -120 } }, { cue: "thump", shake: [0, 2], specks: feetDust(0) }),
    f(120, { ...SAT, mood: "shut", brows: "worry", mouth: "frown", head: [0, 1], hatOff: { at: [27, 50], tilt: 28, behind: true } }, { cue: "clatter", specks: feetDust(1) }),
    f(150, { ...SAT, mood: "blink", brows: "worry", mouth: "frown", head: [0, 2], hatOff: { at: [27, 52], tilt: 18, behind: true } }, { specks: [...feetDust(2), ...stars(0)] }),
    f(150, { ...SAT, mood: "shut", brows: "worry", mouth: "frown", head: [0, 2], hatOff: { at: [27, 52], tilt: 24, behind: true } }, { specks: stars(1) }),
    f(900, { ...SAT, mood: "shut", brows: "worry", mouth: "frown", head: [0, 2], hatOff: { at: [27, 52], tilt: 21, behind: true } }, { specks: stars(2) }),
  ],
};

/** Victory (loop): he cheers, hammer high, the other fist up, hopping, his tail slapping the ground, chips falling like confetti. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) => {
    const up = i % 2 === 0;
    return f(110, {
      armL: { h: [11, up ? 22 : 25] },
      hammer: up ? -98 : -92,
      armR: { h: [62, up ? 24 : 27] },
      air: up ? 3 : 0,
      sink: up ? 0 : 1,
      mood: "proud",
      mouth: "open",
      jaw: up ? 3 : 2,
      tail: up ? -22 : 0,
      dust: up ? undefined : (i % 4 === 1 ? 0 : 1),
    }, { cue: i === 1 || i === 5 ? "slap" : i === 0 ? "cheer" : undefined, specks: confetti(i) });
  }),
};

// ---- His own moments.

/**
 * Scrap (the Workshop, a scrap added): a scrap of wood drops to him from the upper left, he catches it and sets it up there,
 * takes his hammer off the belt and taps it into place twice (a puff of sawdust each, cue `tap`), and puts the hammer back.
 */
const SCRAP_AT: Pt = [8, 29];
const TAP_UP: Pose = { armL: { h: [15, 23] }, hammer: -105 };
const TAP_DOWN: Pose = { armL: { h: [19, 21] }, hammer: 178 };
const TAPPED: Pt = [8, 27];
const scrapAnim: Anim = {
  loop: false,
  frames: [
    f(90, { head: [-1, -1], brows: "up", armL: { h: [13, 28] }, scrap: [6, 4] }),
    f(100, { head: [-1, -1], brows: "up", mouth: "grin", armL: { h: [12, 25] }, scrap: [12, 21] }),
    f(110, { head: [-1, -1], mood: "squint", armL: { h: [10, 32] }, scrap: SCRAP_AT }),
    f(80, { ...AT_HIP, head: [-1, -1], mood: "squint", scrap: SCRAP_AT }),
    f(100, { ...TAP_UP, head: [-1, -1], mood: "squint", brows: "angry", scrap: SCRAP_AT }),
    f(110, { ...TAP_DOWN, head: [-1, -1], mood: "shut", brows: "angry", scrap: SCRAP_AT }, { cue: "tap", shake: [-1, 0], specks: puff(TAPPED[0], TAPPED[1], 0) }),
    f(90, { ...TAP_UP, head: [-1, -1], mood: "squint", brows: "angry", scrap: SCRAP_AT }, { specks: puff(TAPPED[0], TAPPED[1], 1) }),
    f(110, { ...TAP_DOWN, head: [-1, -1], mood: "shut", brows: "angry", scrap: SCRAP_AT }, { cue: "tap", shake: [-1, 0], specks: [...puff(TAPPED[0], TAPPED[1], 0), ...puff(TAPPED[0], TAPPED[1], 2)] }),
    f(150, { armL: { h: [15, 28] }, hammer: -80, head: [-1, -1], mood: "proud", mouth: "grin", scrap: SCRAP_AT }, { specks: puff(TAPPED[0], TAPPED[1], 1) }),
    f(100, { ...DRAWN, mood: "proud", mouth: "grin" }, { specks: puff(TAPPED[0], TAPPED[1], 2) }),
    f(150, {}),
  ],
};

/**
 * Build (the Workshop, a piece dropped): he reaches back and slides a plank up out of its strap, shows it off overhead, and
 * swings it down toward the board as if setting the piece there (cue `set` where it lands), then slides it back in.
 */
const build: Anim = {
  loop: false,
  frames: [
    f(110, { head: [1, 0], armR: { h: [63, 20] }, mood: "smile" }),
    f(110, { head: [1, 0], armR: { h: [65, 16] }, plankOut: 4, mood: "squint" }),
    f(120, { head: [1, 0], armR: { h: [69, 11] }, plankOut: 12, mood: "squint", brows: "angry" }, { cue: "pull" }),
    f(90, { noPlank: true, armL: { h: [22, 22] }, armR: { h: [56, 20] }, held: { top: [10, 19], bot: [66, 15] }, headDy: -1, mood: "squint", mouth: "grin" }),
    f(170, { noPlank: true, armL: { h: [11, 34] }, held: { top: [8, 3], bot: [12, 50] }, head: [-1, 0], headDy: -1, mood: "proud", mouth: "open", jaw: 2 }, { cue: "show" }),
    f(170, { noPlank: true, armL: { h: [11, 33] }, held: { top: [8, 2], bot: [12, 49] }, head: [-1, 0], headDy: -1, breath: 1, mood: "proud", mouth: "grin" }),
    f(90, { noPlank: true, armL: { h: [19, 36] }, armR: { h: [32, 30] }, held: { top: [4, 46], bot: [44, 18] }, lean: -1, mood: "squint", brows: "angry" }),
    f(150, { noPlank: true, armL: { h: [17, 48] }, armR: { h: [30, 42] }, held: { top: [3, 68], bot: [37, 34] }, lean: -2, head: [-1, 1], sink: 1, mood: "smile", mouth: "grin", front: true }, { cue: "set", shake: [0, 1], specks: puff(4, 74, 0) }),
    f(140, { noPlank: true, armL: { h: [17, 48] }, armR: { h: [30, 42] }, held: { top: [3, 68], bot: [37, 34] }, lean: -2, head: [-1, 1], mood: "proud", mouth: "grin", front: true }, { specks: puff(4, 74, 1) }),
    f(110, { head: [1, 0], armR: { h: [69, 11] }, plankOut: 12, mood: "smile" }, { specks: puff(4, 74, 2) }),
    f(100, { head: [1, 0], armR: { h: [65, 16] }, plankOut: 5 }),
    f(110, { armR: { h: [63, 20] }, plankOut: 0, mood: "proud" }, { cue: "pat" }),
    f(160, { mood: "proud" }),
  ],
};

/** The warning before his ultimate (loop): he bares his buck teeth, licks his lips, clacks his teeth, eyes narrowed and gleeful. */
const HUNGRY: Pose = { mood: "squint", brows: "angry", mouth: "open", lean: -1, head: [-1, 0] };
const gnawWarn: Anim = {
  loop: true,
  frames: [
    f(150, { ...HUNGRY, jaw: 3 }),
    f(150, { ...HUNGRY, jaw: 3, tongue: true, armL: { h: [31, 46] }, armR: { h: [45, 45] } }),
    f(150, { ...HUNGRY, jaw: 2, tongue: true }),
    f(150, { ...HUNGRY, jaw: 3, tongue: true, armL: { h: [31, 46] }, armR: { h: [45, 45] } }),
    f(120, { ...HUNGRY, jaw: 4 }),
    f(110, { ...HUNGRY, mouth: "grin", jaw: 0 }, { cue: "clack", shake: [-1, 0] }),
    f(120, { ...HUNGRY, jaw: 4, armL: { h: [31, 46] }, armR: { h: [45, 45] } }),
    f(110, { ...HUNGRY, mouth: "grin", jaw: 0 }, { cue: "clack", shake: [-1, 0] }),
    f(160, { ...HUNGRY, jaw: 3, tail: -14 }),
    f(180, { ...HUNGRY, jaw: 3, tail: -4 }),
  ],
};

/**
 * Gnaw (his ultimate): he leans in and chomps, jaw open and shut, quick bites (cue `chomp` each), chips and splinters flying
 * from his teeth; then he leans back with a satisfied chew and a little burp of sawdust.
 */
const BITE: Pose = { mood: "squint", brows: "angry", lean: -3, head: [-4, 3], sink: 2, armL: { h: [24, 49] } };
const OPEN: Pose = { ...BITE, mouth: "open", jaw: 5, head: [-4, 2] };
const SHUT: Pose = { ...BITE, mouth: "grin", mood: "shut" };
const MOUTH: Pt = [12, 41];
const sp2 = (t: number, s: number) => splinters(MOUTH[0], MOUTH[1], t, s);
const gnaw: Anim = {
  loop: false,
  frames: [
    f(110, { ...HUNGRY, jaw: 3, tail: -10 }),
    f(130, { ...OPEN, tail: -18 }),
    f(90, { ...SHUT, tail: 0 }, { cue: "chomp", shake: [-1, 1], specks: sp2(0, 1) }),
    f(80, { ...OPEN }, { specks: sp2(1, 1) }),
    f(90, { ...SHUT }, { cue: "chomp", shake: [-1, 1], specks: [...sp2(2, 1), ...sp2(0, 4)] }),
    f(80, { ...OPEN }, { specks: sp2(1, 4) }),
    f(90, { ...SHUT }, { cue: "chomp", shake: [-1, 1], specks: [...sp2(2, 4), ...sp2(0, 7)] }),
    f(80, { ...OPEN }, { specks: sp2(1, 7) }),
    f(100, { ...SHUT }, { cue: "chomp", shake: [-1, 1], specks: [...sp2(2, 7), ...sp2(0, 2)] }),
    f(150, { mood: "proud", mouth: "open", jaw: 1, headDy: -1 }, { specks: sp2(2, 2) }),
    f(140, { mood: "proud", mouth: "smile", headDy: 0 }),
    f(140, { mood: "proud", mouth: "open", jaw: 1, headDy: -1 }),
    f(140, { mood: "proud", mouth: "smile" }),
    f(170, { mood: "blink", mouth: "open", jaw: 2, headDy: -1, breath: 1 }, { cue: "burp", specks: puff(13, 37, 0) }),
    f(150, { mood: "proud", mouth: "grin" }, { specks: puff(13, 37, 1) }),
    f(150, { mood: "proud" }, { specks: puff(13, 37, 2) }),
  ],
};

/** A quick proud nod (a piece he built lands). */
const cheer: Anim = {
  loop: false,
  frames: [
    f(120, { head: [0, 2], mood: "proud", sink: 1 }),
    f(150, { headDy: -2, mood: "proud", mouth: "open", jaw: 2, tail: -18 }, { cue: "cheer" }),
    f(120, { headDy: -1, mood: "proud", mouth: "grin", tail: 0, dust: 0 }),
    f(130, { head: [0, 1], mood: "proud", mouth: "grin", dust: 1 }),
    f(130, { headDy: -1, mood: "proud", mouth: "grin", dust: 2 }),
    f(250, { mood: "smile" }),
  ],
};

/** A big cheer (his queen finished): hammer up, a hop, a tail slap, chips flying. */
const bigCheer: Anim = {
  loop: false,
  frames: [
    f(90, { ...AT_HIP, sink: 2, mood: "wide", brows: "up", mouth: "open", jaw: 2 }),
    f(110, { ...HIGH, armR: { h: [62, 26] }, air: 2, mood: "proud", mouth: "open", jaw: 3, tail: -22 }, { cue: "cheer", specks: confetti(0, 6) }),
    f(110, { ...HIGH, armR: { h: [62, 25] }, air: 3, mood: "proud", mouth: "open", jaw: 4, tail: -24 }, { specks: confetti(1, 8) }),
    f(110, { ...HIGH, armR: { h: [62, 27] }, air: 1, mood: "proud", mouth: "open", jaw: 3, tail: -16 }, { specks: confetti(2, 10) }),
    f(120, { ...HIGH, armR: { h: [62, 29] }, sink: 2, mood: "shut", mouth: "grin", tail: 0, dust: 0 }, { cue: "slap", shake: [0, 2], specks: [...confetti(3, 10), ...feetDust(0)] }),
    f(120, { ...HIGH, armR: { h: [62, 26] }, sink: 0, mood: "proud", mouth: "open", jaw: 3, tail: -18, dust: 1 }, { specks: [...confetti(4, 10), ...feetDust(1)] }),
    f(120, { ...HIGH, armR: { h: [62, 27] }, mood: "proud", mouth: "open", jaw: 2, tail: 0, dust: 0 }, { cue: "slap", specks: confetti(5, 10) }),
    f(140, { ...HIGH, armR: { h: [62, 28] }, mood: "proud", mouth: "grin", dust: 1 }, { specks: confetti(6, 8) }),
    f(110, { ...DRAWN, mood: "proud", mouth: "grin", dust: 2 }, { specks: confetti(7, 5) }),
    f(200, { mood: "proud" }),
  ],
};

export const BOSS_BEAVER: Character = {
  id: "timber",
  name: "Timber",
  w: W,
  h: H,
  foot: [40, GROUND + OY],
  palette: PALETTE,
  halo: "#2e2620",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, scrap: scrapAnim, build, gnawWarn, gnaw, cheer, bigCheer },
};

// ---- His attack on a king (the kit's `kingAttack`): the king to our left (his hammer paw's side, `facesLeft`). He drops
// in hammer high, lands with a thump, hammers the king (overhead whacks and side knocks in turn, chips flying), then
// pulls the plank off his back and bats the king with it, and smashes it down on its head; rests the plank, slides it
// back in its strap, a buck-toothed chitter, and hops off.

/** Room to our left (the king's side) for the hammer's and the plank's reach, and headroom to drop in from. */
const A_REACH = 22;
const A_TOP = 18;
const AW = W + A_REACH;
const AH = H + A_TOP + 2;
/** One of his frames moved into the attack's frame; `air`: his own ground shadow off (the spreading one is drawn instead). */
function toAttack(fr: Frame, ground: readonly Speck[] = [], air = false): Frame {
  const specks = [...(fr.specks ?? []).map(([x, y, k]): Speck => [x + A_REACH, y + A_TOP, k]), ...ground].filter(
    ([x, y]) => x >= 2 && y >= 2 && x <= AW - 3 && y <= AH - 3,
  );
  return { ...fr, layers: fr.layers.filter((l) => !air || l.part !== "shadow").map((l) => ({ ...l, x: l.x + A_REACH, y: l.y + A_TOP })), specks };
}
/** His shadow alone, in the attack's frame. */
const groundAt = (r: number): Speck[] => shadowOnly(r).map(([x, y, k]): Speck => [x + A_REACH, y + A_TOP, k]);

/** A swish of the swing: an arc round (cx, cy) (drawing pixels) from angle `from` to `to` (degrees), solid near its end. */
function swish(cx: number, cy: number, r: number, from: number, to: number): Speck[] {
  const out: Speck[] = [];
  const seen = new Set<string>();
  const n = Math.ceil(Math.abs(to - from) / 2.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ((from + (to - from) * t) * Math.PI) / 180;
    for (const [dr, k] of [[0, "s"], [-1, "S"], [1, "T"]] as const) {
      if (t < 0.45 && (i + (dr + 1)) % 3 !== 0) continue;
      if (dr !== 0 && t < 0.25) continue;
      const x = Math.round(cx + Math.cos(a) * (r + dr));
      const y = Math.round(cy + Math.sin(a) * (r + dr));
      if (seen.has(`${x},${y}`)) continue;
      seen.add(`${x},${y}`);
      out.push(px(x, y, k));
    }
  }
  return out;
}
/** Speed lines streaming back (to our right) from a side hit at (x, y), `rows` of them. */
function streaks(x: number, y: number, rows: readonly number[], len = 16, k = "s"): Speck[] {
  const out: Speck[] = [];
  rows.forEach((dy, j) => {
    for (let d = 0; d < len; d++) {
      if (d > len / 2 && (d + j) % 3) continue;
      out.push(px(x + d, y + dy, d < 3 ? "I" : k));
    }
  });
  return out;
}
/** A burst of impact: a white star and a few chips. */
function bang(x: number, y: number): Speck[] {
  return [px(x, y, "I"), px(x - 1, y, "C"), px(x + 1, y, "C"), px(x, y - 1, "C"), px(x, y + 1, "C"), px(x - 2, y - 2, "I"), px(x + 2, y - 2, "I"), px(x - 2, y + 2, "I"), px(x + 2, y + 2, "I")];
}

const FIERCE: Pose = { mood: "squint", brows: "angry", mouth: "grin" };
const GRUNT: Pose = { mood: "squint", brows: "angry", mouth: "open", jaw: 2 };
/** The overhead whack: the hammer brought down onto the king's head. */
const WHACK: Pose = { ...FIERCE, armL: { h: [9, 38] }, hammer: 165, armR: { h: [60, 36] }, lean: -3, sink: 2, head: [-1, 1], tail: 0 };
const WHACK_AT: Pt = [-6, 48];
/** Wound up for it: the hammer up over his head and back. */
const WIND_UP: Pose = { ...GRUNT, armL: { h: [14, 21] }, hammer: -80, armR: { h: [61, 40] }, lean: 1, headDy: -1, tail: -18 };
/** The side knock: swung across at the king's middle. */
const KNOCK: Pose = { ...FIERCE, armL: { h: [10, 50] }, hammer: 182, armR: { h: [58, 44] }, lean: -3, sink: 4, head: [-2, 1], tail: -4 };
const KNOCK_AT: Pt = [-7, 56];
/** Wound up for it: the hammer pulled back across him. */
const WIND_BACK: Pose = { ...GRUNT, armL: { h: [38, 50] }, hammer: -12, armR: { h: [61, 42] }, lean: 2, sink: 1, head: [1, 0], tail: -16 };

/** The plank: off his back, back over his shoulder like a bat, swung at the king, raised, smashed down on it. */
const PULL: Pose = { ...FIERCE, head: [1, 0], armL: { h: [30, 48] }, armR: { h: [69, 11] }, plankOut: 12, tail: -10 };
const BAT_BACK: Pose = { ...GRUNT, noPlank: true, held: { top: [76, 18], bot: [36, 50] }, armL: { h: [34, 50] }, armR: { h: [40, 48] }, lean: 2, head: [1, 0], tail: -18 };
const BAT: Pose = { ...FIERCE, noPlank: true, held: { top: [-13, 57], bot: [27, 51] }, armL: { h: [21, 53] }, armR: { h: [28, 51] }, lean: -3, sink: 3, head: [-2, 1], tail: 0 };
const BAT_AT: Pt = [-13, 54];
const PLANK_HIGH: Pose = { ...GRUNT, jaw: 3, noPlank: true, held: { top: [54, -10], bot: [16, 26] }, armL: { h: [18, 25] }, armR: { h: [62, 28] }, lean: 1, headDy: -1, tail: -22 };
const SMASH: Pose = { ...FIERCE, mood: "shut", noPlank: true, held: { top: [-12, 55], bot: [22, 39] }, armL: { h: [21, 40] }, armR: { h: [28, 42] }, lean: -3, sink: 4, head: [-2, 2], tail: 0 };
const SMASH_AT: Pt = [-11, 50];
/** The plank rested on his shoulder. */
const RESTED: Pose = { noPlank: true, held: { top: [84, 28], bot: [34, 47] }, armL: { h: [33, 48] }, armR: { h: [60, 34] }, mood: "proud", mouth: "grin", headDy: -1, tail: -12 };

/**
 * His attack on a king, on the shared beats (KING_ATTACK, boss-timing.ts), every frame's time worked out from them so
 * they add up exactly; the king to our left (his hammer paw's side; the board mirrors him when it's to his right).
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [];
  let t = 0;
  const to = (until: number, fr: (ms: number) => Frame) => {
    const ms = Math.round(until - t);
    if (ms <= 0) return;
    frames.push(fr(ms));
    t += ms;
  };
  const he = (p: Pose, extra: Partial<Frame> = {}, ground: readonly Speck[] = [], air = false) => (ms: number) => toAttack(f(ms, p, extra), ground, air);
  const empty = (r: number) => (ms: number): Frame => ({ ms, layers: [], specks: r ? groundAt(r) : [] });

  // The drop: his shadow spreads, then he falls in, hammer up off his belt.
  const D = A.landAt;
  to(D * 0.22, empty(7));
  to(D * 0.43, empty(16));
  to(D * 0.62, he({ ...GRUNT, mood: "wide", jaw: 3, air: 18, ...HIGH, armR: { h: [63, 30] }, tail: -24, hat: [0, -2], hatTilt: -6 }, { cue: "swoosh" }, groundAt(22), true));
  to(D * 0.81, he({ ...GRUNT, jaw: 3, air: 9, ...HIGH, armR: { h: [63, 32] }, tail: -18, hat: [0, -1], hatTilt: -4 }, {}, groundAt(28), true));
  to(D, he({ ...GRUNT, air: 3, armL: { h: [13, 25] }, hammer: -80, armR: { h: [62, 34] }, tail: -12 }, {}, groundAt(32), true));
  // The landing: a squash, a thump, sawdust puffing off his feet; the hammer already up and back.
  to(A.lashAt, he({ ...FIERCE, mood: "shut", sink: 5, spread: 2, armL: { h: [14, 23] }, hammer: -84, armR: { h: [62, 42] }, tail: 0, hat: [0, 1] }, { cue: "thump", shake: [0, 2], specks: [...feetDust(0), ...puff(14, GROUND - 1, 0), ...puff(64, GROUND - 1, 0)] }));

  // Ten hits on the beat: whack, knock, ... (the hammer), then the plank: a bat swing and the smash.
  for (let i = 0; i < A.lashes; i++) {
    const at = A.lashAt + i * A.lashEveryMs;
    const next = at + A.lashEveryMs;
    const last = i === A.lashes - 1;
    const plank = i >= A.lashes - 2;
    const high = plank ? last : i % 2 === 0;
    // The chips of the hit before, still flying.
    const prev = (n: number): Speck[] => {
      if (i === 0) return [];
      const j = i - 1;
      const p = j >= A.lashes - 2 ? BAT_AT : j % 2 === 0 ? WHACK_AT : KNOCK_AT;
      return chips(p[0], p[1], n, j, 7, -1);
    };
    if (!plank) {
      const P = high ? WHACK : KNOCK;
      const hit = high ? WHACK_AT : KNOCK_AT;
      const trail = high ? swish(22.5, 42, 26, -70, -172) : streaks(hit[0] + 7, hit[1], [-3, -1, 1, 3], 18);
      to(at + 90, he(P, { cue: high ? "whack" : "knock", shake: high ? [0, 1] : [-1, 0], specks: [...trail, ...bang(hit[0] - 1, hit[1]), ...chips(hit[0], hit[1], 0, i, 7, -1), ...prev(2)] }));
      if (i === A.lashes - 3) {
        // The hammer goes back on his belt; he pulls the plank off his back, and draws it back like a bat.
        to(at + 130, he(PULL, { cue: "slide", specks: chips(hit[0], hit[1], 1, i, 7, -1) }));
        to(next, he(BAT_BACK, { specks: chips(hit[0], hit[1], 2, i, 7, -1) }));
      } else {
        to(next, he(high ? WIND_BACK : WIND_UP, { specks: chips(hit[0], hit[1], 1, i, 7, -1) }));
      }
    } else if (!last) {
      to(at + 90, he(BAT, { cue: "whack", shake: [-2, 0], specks: [...streaks(BAT_AT[0] + 14, BAT_AT[1], [-4, -2, 0, 2, 4], 22, "C"), ...bang(BAT_AT[0], BAT_AT[1]), ...chips(BAT_AT[0], BAT_AT[1], 0, i, 9, -1), ...prev(2)] }));
      to(next, he(PLANK_HIGH, { specks: chips(BAT_AT[0], BAT_AT[1], 1, i, 9, -1) }));
    } else {
      // The big one: the plank smashed down on the king's head.
      const sm = (n: number) => [...chips(SMASH_AT[0], SMASH_AT[1], n, 3, 9, -1), ...chips(SMASH_AT[0] + 2, SMASH_AT[1], n, 6, 5, 1)];
      to(at + 100, he(SMASH, { cue: "thump", shake: [0, 2], specks: [...swish(22, 46, 35, -100, -196), ...bang(SMASH_AT[0], SMASH_AT[1]), ...sm(0), ...prev(2)] }));
      to(at + 160, he({ ...SMASH, mood: "squint", mouth: "grin" }, { specks: [...sm(1), ...puff(SMASH_AT[0] + 1, SMASH_AT[1] - 1, 1)] }));
      // He rests it on his shoulder, then slides it back into its strap.
      to(A.leaveAt - 70, he(RESTED, { specks: [...sm(2), ...puff(SMASH_AT[0] + 1, SMASH_AT[1] - 1, 2)] }));
      to(A.leaveAt, he({ armR: { h: [68, 12] }, plankOut: 10, mood: "proud", mouth: "grin" }, { cue: "slide" }));
    }
  }

  // His own beat: a buck-toothed grin and a chitter, his shoulders bobbing; then a crouch and a hop off.
  const L = A.ms - A.leaveAt;
  const chit = A.leaveAt + L * 0.5;
  const CH: Pose = { mood: "proud", mouth: "open", armL: { h: [29, 52] }, armR: { h: [47, 52] } };
  to(A.leaveAt + L * 0.125, he({ ...CH, jaw: 3, head: [1, -2], hat: [0, -1], tail: -14 }, { cue: "chitter" }));
  to(A.leaveAt + L * 0.25, he({ ...CH, mouth: "grin", breath: 1, tail: -18 }));
  to(A.leaveAt + L * 0.375, he({ ...CH, jaw: 3, head: [1, -2], hat: [0, -1], tail: -14 }));
  to(chit, he({ ...CH, mood: "wink", mouth: "grin", breath: 1, tail: -6 }));
  to(A.leaveAt + L * 0.65, he({ sink: 4, spread: 1, mood: "proud", mouth: "grin", tail: 0 }));
  to(A.leaveAt + L * 0.775, he({ air: 8, mood: "proud", mouth: "open", jaw: 2, armL: { h: [14, 30] }, armR: { h: [64, 30] }, tail: -18, hat: [0, -1] }, { cue: "hup", specks: feetDust(0) }, groundAt(28), true));
  to(A.leaveAt + L * 0.9, he({ air: 18, mood: "proud", mouth: "grin", armL: { h: [13, 28] }, armR: { h: [65, 28] }, tail: -24, hat: [0, -2], hatTilt: -6 }, { specks: feetDust(1) }, groundAt(20), true));
  to(A.ms - 20, empty(10));
  to(A.ms, empty(0));
  return { loop: false, frames };
})();

/**
 * Timber for his attack on a king (his kit's `kingAttack`): his own parts and palette, in a frame `A_REACH` wider on the
 * left (the king's side: his hammer and plank) and `A_TOP` taller (he drops in). Its `idle`, one still, is for the preview.
 */
export const BOSS_BEAVER_ATTACK: Character = {
  ...BOSS_BEAVER,
  id: "timber-attack",
  name: "Timber (his attack)",
  w: AW,
  h: AH,
  foot: [BOSS_BEAVER.foot[0] + A_REACH, BOSS_BEAVER.foot[1] + A_TOP],
  anims: { idle: { loop: true, frames: [toAttack(f(1000, {}))] }, kingAttack },
};
