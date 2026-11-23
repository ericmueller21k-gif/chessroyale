/**
 * Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/birdie-train/birdie-train.ts at 31a1f329, Nov 23, 2026):
 * every animation as drawn. Changed: the import paths, and its parts and animations made on first use (lazyParts, lazyAnim). The run's
 * report: scripts/boss-art/out/birdie-train/summary.md on that branch.
 */
/**
 * Birdie's train on the board (the attack, Nov 23, Eric's design). Not a boss: board art, like Big Boy's tower. One
 * Character, three animations:
 *  - ride (loop): Birdie's yellow toy diesel seen from above, nose to our right, two squares long and one tall. The
 *    dark roof with the open hatch, Birdie's capped head in it, the hatch lid standing open behind him, the windshield,
 *    the yellow nose hood with its grille and two headlights (on, beams ahead), the thin red stripe along both sides
 *    sweeping round the nose, the wheels and rods turning at the sides, the exhaust stack glowing and puffing smoke
 *    back, the shadow under it a little offset.
 *  - crossing (loop, ~1 s): the railroad-crossing warning in the left square only: a white crossbuck (two crossed
 *    bars, outlined dark) and two red lamps that alternate each frame, the lit one glowing.
 *  - smash (one shot, ~0.4 s): the hit in the left square: a bright flash (cue "smash"), then a burst of dust and
 *    sparks spreading and fading.
 * The colors are the train's and Birdie's own (boss-birdie.ts).
 */
import { canvas, inEllipse, toGrid, type Canvas } from "../paint.ts";
import { lazyAnim, lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1d1411", // outline
  u: "#9a6a08", // the train: yellow, dark to light
  v: "#d49a12",
  y: "#f4c21e",
  Y: "#ffe27a",
  m: "#23232b", // roof: dark grey
  n: "#3b3b46",
  N: "#5a5a68",
  O: "#0f0d12", // inside the hatch
  q: "#cc2a2a", // the red stripe; a lit lamp
  r: "#5a1018", // an unlit lamp
  P: "#ff9a86", // a lit lamp's hot core
  j: "#4a4f5a", // silver: dark, mid, light
  l: "#8d94a1",
  J: "#d3d8e0",
  W: "#fff3b8", // headlights
  w: "#fffaf0", // white
  z: "#24303e", // windows
  Z: "#6d8aa2",
  b: "#5c4638", // Birdie's head: brown, dark to light
  c: "#7c624f",
  d: "#9c8069",
  e: "#bfa58b",
  i: "#e6c6ac",
  x: "#0d0909", // his eye
  s: "#2b1f1b", // the dark spots on his wings
  B: "#3e373c", // beak
  "1": "#0f1328", // his cap: navy, dark to light
  "2": "#1c2850",
  "3": "#2d3f7c",
  "4": "#4a60a8",
  K: "#a87414", // gold band
  L: "#f2c14e",
  G: "#0b0c1066", // the shadow on the floor (see-through)
  g: "#ff4a3ac0", // a lamp's red glow (see-through), and its faint edge
  f: "#ff4a3a68",
  h: "#fff3b870", // a headlight's beam (see-through)
};

type Inside = (x: number, y: number) => boolean;
const E = inEllipse;
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;

/** A part the size of the whole frame (64 x 32), painted in frame pixels; drawn at (0, 0). */
function paint(draw: (cv: Canvas, F: (inside: Inside, key: (x: number, y: number) => string) => void) => void, outline = true): Part {
  const cv = canvas(64, 32);
  const F = (inside: Inside, key: (x: number, y: number) => string) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
  };
  draw(cv, F);
  return { grid: toGrid(cv), outline };
}
const at0 = (part: string, dx = 0, dy = 0): Layer => ({ part, x: dx, y: dy });

// ---- The train from above (frame pixels). The body is y 6..25, the back end at x 3, the nose's tip at x 59.

/** The body's outline from above: a long box, its back corners clipped, the front a round nose. */
const NOSE = E(49.5, 16, 10.5, 10);
const body: Inside = (x, y) => {
  if (x < 3 || x > 59 || y < 6 || y > 25) return false;
  if (x === 3 && (y === 6 || y === 25)) return false;
  return x <= 49 || NOSE(x, y);
};
/** The wheels' middles along each side; they show past the body's sides, 2 pixels each side. */
const WHEELS = [10, 18, 44, 52] as const;

function trainPart(phase: number): Part {
  return paint((cv, F) => {
    // Yellow body: lit along the top and the back, darker along the bottom; the nose hood round, lit at its top left.
    F(body, (x, y) => {
      if (x >= 46) {
        const nx = (x + 0.5 - 50) / 10;
        const ny = (y + 0.5 - 16) / 10;
        return ramp("uvyyY", 0.62 - 0.3 * nx - 0.45 * ny);
      }
      if (y === 6 || x === 3) return "Y";
      if (y >= 24) return "v";
      return "y";
    });
    // The red stripe along both sides, sweeping round the nose's shoulders.
    const outer = E(49.5, 16, 9.5, 9);
    const inner = E(49.5, 16, 8.5, 8);
    F((x, y) => ((y === 7 || y === 24) && x >= 4 && x <= 48) || (x >= 49 && x <= 55 && outer(x, y) && !inner(x, y)), () => "q");
    // The roof: dark grey, lit along its top and back, a seam across.
    const roof: Inside = (x, y) => x >= 6 && x <= 41 && y >= 9 && y <= 22 && !((x === 6 || x === 41) && (y === 9 || y === 22));
    F(roof, (x, y) => (y === 9 || x === 6 ? "N" : y === 22 || x === 41 ? "m" : x === 35 ? "m" : "n"));
    // The open hatch: black, its corners round.
    F((x, y) => x >= 19 && x <= 30 && y >= 10 && y <= 21 && !((x === 19 || x === 30) && (y === 10 || y === 21)), () => "O");
    // The hatch's lid standing open behind it (seen edge-on from above), and its shadow.
    F((x, y) => x === 15 && y >= 10 && y <= 21, () => "J");
    F((x, y) => x === 16 && y >= 10 && y <= 21, () => "l");
    F((x, y) => x === 17 && y >= 11 && y <= 21, () => "m");
    // The exhaust stack at the back of the roof, its vent glowing.
    F(E(10, 16, 2.6, 2.6), () => "j");
    F(E(10, 16, 1.6, 1.6), () => (phase % 2 ? "q" : "r"));
    F((x, y) => x === 9 && y === 14, () => "l");
    // The windshield: two panes on the slope, a post between, a glint across each.
    F((x, y) => x >= 42 && x <= 45 && y >= 9 && y <= 22 && !(x === 45 && (y === 9 || y === 22)), (x, y) => (y === 15 || y === 16 ? "n" : (x + y) % 5 === 0 ? "Z" : "z"));
    // The nose hood's grille: three dark slats.
    F((x, y) => (x === 49 || x === 51 || x === 53) && y >= 13 && y <= 18, () => "u");
    // Headlights on the nose's front.
    for (const cy of [12, 19]) {
      const lamp = [".l.", "lWl", ".l."];
      lamp.forEach((row, j) => [...row].forEach((k, i) => k !== "." && (cv[cy - 1 + j]![56 + i] = k)));
    }
    // The wheels showing past the sides: dark tires, a bright tread mark rolling forward; the rods between each pair go
    // in and out as the cranks turn.
    for (const cx of WHEELS) {
      for (const [y0, y1] of [[4, 5], [26, 27]] as const) {
        for (let x = cx - 2; x <= cx + 1; x++) {
          const mark = (((x - (cx - 2) - phase) % 4) + 4) % 4 === 0;
          const top = y0 === 4;
          cv[y0]![x] = mark ? "J" : top ? "j" : "m";
          cv[y1]![x] = mark ? "l" : top ? "m" : "j";
        }
      }
    }
    for (const [a, b] of [[10, 18], [44, 52]] as const) {
      const up = phase < 2;
      for (let x = a + 1; x <= b - 1; x++) {
        cv[up ? 4 : 5]![x] = x === a + 1 || x === b - 1 ? "l" : "J";
        cv[up ? 26 : 27]![x] = x === a + 1 || x === b - 1 ? "j" : "l";
      }
    }
  });
}

/** The train's shadow on the floor: its whole shape, see-through. */
function shadowPart(): Part {
  const t = trainPart(0).grid;
  return paint((_, F) => F((x, y) => (t[y]?.[x] ?? ".") !== "." || ((t[y - 1]?.[x] ?? ".") !== "." && y < 30), () => "G"), false);
}

/**
 * Birdie in the hatch from above: his long tail out over the roof behind, his back and folded wings (scalloped, pale
 * fringes, dark spots), his round head to the front in his cap (navy crown lit at its top left, the gold band round it,
 * the black brim forward), his eyes at its sides and his beak poking out past the brim.
 */
function headPart(hd: number): Part {
  const dx = 0;
  return paint((_, F) => {
    F((x, y) => x >= 12 + dx && x <= 19 + dx && (y === 15 || y === 16), (x) => (x <= 12 + dx ? "e" : x === 13 + dx ? "s" : "c"));
    F((x, y) => x >= 15 + dx && x <= 19 + dx && ((y === 14 && x >= 16 + dx) || (y === 17 && x >= 16 + dx)), (_, y) => (y === 14 ? "c" : "b"));
    const bx = 22 + dx;
    const back = E(bx, 16, 4.2, 5);
    F(back, (x, y) => {
      const l = 0.6 - 0.4 * ((x + 0.5 - bx) / 4.2) - 0.45 * ((y + 0.5 - 16) / 5);
      if (y % 3 === 1 && (x + Math.floor(y / 3)) % 3 === 0) return "e";
      return ramp("bcd", l);
    });
    F((x, y) => (x === bx - 1 && y === 13) || (x === bx && y === 18), () => "s");
    const hx = 27 + hd;
    F(E(hx, 16, 3.8, 4.2), (x, y) => ramp("cdei", 0.6 - 0.4 * ((x + 0.5 - hx) / 3.8) - 0.45 * ((y + 0.5 - 16) / 4.2)));
    F((x, y) => x === hx + 2 && (y === 13 || y === 18), () => "x");
    const cx = hx - 0.8;
    F(E(cx, 16, 3, 3.2), (x, y) => (x + y < cx + 16 + 0.5 ? "L" : "K"));
    F(E(cx, 16, 2.2, 2.4), (x, y) => ramp("234", 0.55 - 0.45 * ((x + 0.5 - cx) / 2.2) - 0.5 * ((y + 0.5 - 16) / 2.4)));
    F((x, y) => E(hx + 1.6, 16, 1.8, 2.2)(x, y) && x + 0.5 > hx + 1.4, () => "1");
    F((x, y) => x === hx + 3 && y >= 15 && y <= 16, (_, y) => (y === 15 ? "e" : "B"));
    F((x, y) => x === hx + 4 && y === 16, () => "B");
  });
}

const { parts: PARTS, add: addPart } = lazyParts();
for (const p of [0, 1, 2, 3]) addPart(`train:${p}`, () => trainPart(p));
addPart("shadow", () => shadowPart());
addPart("head", () => headPart(0));
addPart("head:1", () => headPart(1));

/** A round puff of smoke at (x, y), `r` across: pale at its top left, grey at its bottom right; `thin` drops every other pixel. */
function puff(x: number, y: number, r: number, thin = false): Speck[] {
  const out: Speck[] = [];
  const R = Math.ceil(r) + 1;
  const inside = (i: number, j: number) => Math.hypot(i, j) <= r + 0.25;
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      if (!inside(i, j)) continue;
      if (thin && (i + j) % 2 !== 0) continue;
      const k = !inside(i, j - 1) || !inside(i - 1, j) ? "J" : !inside(i, j + 1) || !inside(i + 1, j) ? "j" : "l";
      out.push([Math.round(x + i), Math.round(y + j), k]);
    }
  return out;
}

/** Smoke from the stack, `i` steps on: two puffs drifting back off the roof, growing and thinning. */
function smoke(i: number): Speck[] {
  const out: Speck[] = [];
  for (const a of [i, i + 4]) {
    const r = a < 1 ? 0.6 : Math.min(2.8, 0.9 + a * 0.4);
    out.push(...puff(9 - a * 1.2, 15 - a * 0.7, r, a >= 6));
  }
  return out.filter(([x, y]) => x >= 1 && y >= 1 && x <= 62 && y <= 30);
}

/** The headlights' beams ahead of the nose, short (0) or long (1). */
function beams(long: number): Speck[] {
  const out: Speck[] = [];
  for (const cy of [12, 19]) {
    out.push([60, cy, "W"], [61, cy - 1, "h"], [61, cy, "h"], [61, cy + 1, "h"]);
    if (long) out.push([62, cy - 1, "h"], [62, cy, "h"], [62, cy + 1, "h"]);
  }
  return out;
}

const ride: Anim = lazyAnim(() => ({
  loop: true,
  frames: [0, 1, 2, 3].map((p): Frame => ({
    ms: 105,
    layers: [at0("shadow", 2, 2), at0(`train:${p}`), at0(p === 2 ? "head:1" : "head")],
    specks: [...smoke(p), ...beams(p % 2)],
  })),
}));

// ---- The crossing warning (left square only, x 0..31).

const LAMPS = [7, 25] as const;
addPart("buck", () => paint((_, F) => {
  const inBox = (x: number, y: number) => x >= 5 && x <= 26 && y >= 5 && y <= 26;
  const a = (x: number, y: number) => Math.abs(x - y) <= 1;
  const b = (x: number, y: number) => Math.abs(x + y - 31) <= 1;
  // White boards, a grey shade along their lower edges (light from the top left).
  F((x, y) => inBox(x, y) && (a(x, y) || b(x, y)), (x, y) => ((a(x, y) && x - y === -1 && !b(x, y)) || (b(x, y) && x + y - 31 === 1 && !a(x, y)) ? "J" : "w"));
}));
for (const [side, cx] of [["L", LAMPS[0]], ["R", LAMPS[1]]] as const) {
  for (const on of [false, true]) {
    addPart(`lamp${side}:${on ? 1 : 0}`, () => paint((_, F) => {
      F(E(cx, 16, 4.4, 4.4), () => "m");
      F(E(cx, 16, 3.4, 3.4), (x, y) => {
        if (!on) return "r";
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 16);
        return d < 1.8 ? "P" : "q";
      });
      if (on) F((x, y) => (x === Math.floor(cx - 2) && y === 14) || (x === Math.floor(cx - 1) && y === 13), () => "w");
    }));
    addPart(`glow${side}`, () => paint((_, F) => F((x, y) => E(cx, 16, 8.6, 8.6)(x, y) && x >= 1 && x <= 30, (x, y) => (E(cx, 16, 6.6, 6.6)(x, y) ? "g" : "f")), false));
  }
}

/** Short bright rays off the lit lamp (up, down and to the outer side, `out` -1 left or 1 right), longer (`long`) on the first flash. */
function rays(cx: number, out: number, long: number): Speck[] {
  const x = Math.floor(cx);
  const s: Speck[] = [];
  const dirs: [number, number][] = [[0, -1], [0, 1], [out, 0], [out, -1], [out, 1]];
  for (const [dx, dy] of dirs) {
    const d = dx && dy ? 6 : 8;
    for (let t = 0; t <= long; t++) {
      const px = x + dx * (d + t);
      const py = 16 + (dy < 0 ? -1 : 0) + dy * (d + t);
      if (px >= 1 && px <= 30 && py >= 1 && py <= 30) s.push([px, py, t ? "q" : "P"]);
    }
  }
  return s;
}

const crossing: Anim = lazyAnim(() => ({
  loop: true,
  frames: Array.from({ length: 6 }, (_, i): Frame => {
    const left = i % 2 === 0;
    return {
      ms: 165,
      layers: [at0(left ? "glowL" : "glowR"), at0("buck"), at0(`lampL:${left ? 1 : 0}`), at0(`lampR:${left ? 0 : 1}`)],
      specks: rays(left ? LAMPS[0] : LAMPS[1], left ? -1 : 1, i < 2 ? 1 : 0),
    };
  }),
}));

// ---- The smash (left square only): a flash, then dust and sparks.

const C = 16;
const polar = (x: number, y: number) => {
  const dx = x + 0.5 - C;
  const dy = y + 0.5 - C;
  return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) };
};

addPart("smash:0", () => paint((_, F) => {
  // A bright star: a round core and eight spikes, the straight ones longer.
  const inside: Inside = (x, y) => {
    const { r, a } = polar(x, y);
    if (r <= 6) return true;
    const k = Math.round(a / (Math.PI / 4));
    const off = Math.abs(a - k * (Math.PI / 4)) * r;
    const len = k % 2 === 0 ? 14 : 10.5;
    return r <= len && off <= 2.4 * (1 - r / len) + 0.5;
  };
  F((x, y) => inside(x, y) && x >= 3 && x <= 28 && y >= 3 && y <= 28, (x, y) => {
    const { r } = polar(x, y);
    return r < 3.6 ? "w" : r < 6.4 ? "W" : r < 9.5 ? "Y" : "y";
  });
}, true));

/** Dust blobs round the middle at `dist`, `r` across, `n` of them turned `turn`; plus a middle blob `mid` across. */
function dust(dist: number, r: number, n: number, turn: number, mid: number, grey: boolean, gaps = false, thin = false): Part {
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (gaps && i % 2) continue;
    const a = turn + (i * 2 * Math.PI) / n;
    blobs.push([C + Math.cos(a) * dist, C + Math.sin(a) * dist * 0.9, r * (i % 3 === 1 ? 0.8 : 1)]);
  }
  if (mid > 0) blobs.push([C, C, mid]);
  const inside: Inside = (x, y) => blobs.some(([bx, by, br]) => Math.hypot(x + 0.5 - bx, y + 0.5 - by) <= br);
  return paint((_, F) =>
    F(
      (x, y) => inside(x, y) && x >= 2 && x <= 29 && y >= 2 && y <= 29 && !(thin && (x + y) % 2),
      (x, y) => {
        const lit = !inside(x, y - 1) || !inside(x - 1, y);
        const dark = !inside(x, y + 1) || !inside(x + 1, y);
        if (grey) return lit ? "J" : dark ? "j" : "l";
        return lit ? "i" : dark ? "d" : "e";
      },
    ),
    thin ? false : true,
  );
}
addPart("smash:1", () => dust(6, 3.8, 7, 0.3, 4.6, false));
addPart("smash:2", () => dust(8.8, 3.8, 8, 0.1, 2.6, false));
addPart("smash:3", () => dust(10.8, 3.2, 9, 0.25, 0, false, false));
addPart("smash:4", () => dust(12, 2.4, 9, 0.4, 0, false, true, true));

/** Sparks flying out from the middle: short streaks at `dist`, `len` long. */
function sparks(dist: number, len: number, keys: string, n = 6, turn = 0.5): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const a = turn + (i * 2 * Math.PI) / n + (i % 2) * 0.25;
    for (let s = 0; s < len; s++) {
      const d = dist + s;
      const x = Math.round(C - 0.5 + Math.cos(a) * d);
      const y = Math.round(C - 0.5 + Math.sin(a) * d);
      if (x >= 1 && y >= 1 && x <= 30 && y <= 30) out.push([x, y, keys[Math.min(keys.length - 1, s)]!]);
    }
  }
  return out;
}

const smash: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    { ms: 60, cue: "smash", layers: [at0("smash:0")] },
    { ms: 80, layers: [at0("smash:1")], specks: [...sparks(10, 4, "wyvu", 8), [C - 1, C - 1, "w"], [C, C - 1, "W"], [C - 1, C, "W"]] },
    { ms: 90, layers: [at0("smash:2")], specks: sparks(12, 3, "Wyv", 8, 0.7) },
    { ms: 100, layers: [at0("smash:3")], specks: sparks(14, 1, "v", 6, 0.9) },
    { ms: 90, layers: [at0("smash:4")] },
  ],
}));

export const BIRDIE_TRAIN: Character = {
  id: "birdie-train",
  name: "Birdie's train",
  w: 64,
  h: 32,
  foot: [32, 31],
  palette: PALETTE,
  halo: "#3a3026",
  parts: PARTS,
  anims: { ride, crossing, smash },
};

// ---- The game's pieces of it (characters/effects.ts, power-art.ts).

/**
 * One square's effect from the art's left square (its crossing and its smash are drawn there, the right half empty): the frame cut to
 * that square (32 x 32, SQUARE), so the shared board canvas draws it on its square alone.
 */
const leftSquare = (id: string, anims: Record<string, Anim>): Character => ({ ...BIRDIE_TRAIN, id, w: 32, h: 32, foot: [16, 31], anims });

/**
 * The crossing on each square of the warned line: `on` (its first two frames, the bell's `ding` on the first) as it lights, then the
 * art's `crossing` loop for as long as the warning stands, its lamps swapping.
 */
export const BIRDIE_CROSSING = leftSquare("birdie-crossing", {
  on: lazyAnim(() => ({ loop: false, frames: [{ ...crossing.frames[0]!, cue: "ding" }, crossing.frames[1]!] })),
  crossing,
  // (Gone as the train passes or the warning ends: an empty frame.)
  off: lazyAnim(() => ({ loop: false, frames: [{ ms: 60, layers: [] }] })),
});

/** The train's smash on the piece it reaches: the art's `smash` (its `smash` cue on the flash), on the piece's square. */
export const BIRDIE_SMASH = leftSquare("birdie-smash", {
  // (The art's, then an empty frame: gone once it has played.)
  smash: lazyAnim(() => ({ loop: false, frames: [...smash.frames, { ms: 40, layers: [] }] })),
});
