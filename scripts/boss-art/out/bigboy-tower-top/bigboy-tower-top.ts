/**
 * Big Boy's toy-block tower, seen from above (Eric, Nov 18: "Number 3 is the way"). A board effect, not a boss: the stack
 * on one square (the frame's middle, x 32..63, y 32..63), one block more each turn up to 10, then it topples.
 *
 * Each block is today's wooden toy block (effects/bigboy.ts) seen from straight above: its top face (beveled rim, light
 * top-left, a colored panel inset, the block's number carved in cream) and a short strip of its front side under it. Each
 * block up is a little bigger and higher up the screen, a little off-center, so the ones under it peek out as strips.
 */
import { canvas, inEllipse, poly, shade, toGrid } from "../../../../packages/app/src/characters/paint.ts";
import { lazyAnim, lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE = {
  k: "#2a1712",
  o: "#f6d08e", // wood: lit edge, face, shaded edge
  O: "#d9a159",
  D: "#a26f33",
  r: "#e2483f", // panels: red, blue, green; each darker (side, inset), and deepest (the carved cut's shadow)
  R: "#a52a26",
  e: "#6a1714",
  u: "#3d7fe0",
  U: "#2554a8",
  v: "#14306a",
  g: "#3cb24c",
  G: "#24782f",
  h: "#134a1c",
  Y: "#fff4d0", // the number and its shade
  y: "#c9b98e",
  F: "#ffffff",
  z: "#00000047", // shadows on the board: core, middle, fringe
  x: "#0000002e",
  w: "#00000017",
  s: "#cfc6b4cc", // dust
  S: "#f3ecdccc",
} as const;

const COLORS = [
  { p: "r", d: "R", c: "e" },
  { p: "u", d: "U", c: "v" },
  { p: "g", d: "G", c: "h" },
] as const;

/** The numbers, 7 x 9 (today's letters' weight) and 3 x 5 for a little block. */
const BIG: Record<string, readonly string[]> = {
  "0": [".#####.", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
  "1": ["...##..", "..###..", ".####..", "...##..", "...##..", "...##..", "...##..", "...##..", ".######"],
  "2": [".#####.", "##...##", ".....##", "....##.", "...##..", "..##...", ".##....", "##.....", "#######"],
  "3": [".#####.", "##...##", ".....##", ".....##", "..####.", ".....##", ".....##", "##...##", ".#####."],
  "4": ["....##.", "...###.", "..####.", ".##.##.", "##..##.", "#######", "....##.", "....##.", "....##."],
  "5": ["#######", "##.....", "##.....", "######.", ".....##", ".....##", ".....##", "##...##", ".#####."],
  "6": [".#####.", "##...##", "##.....", "######.", "##...##", "##...##", "##...##", "##...##", ".#####."],
  "7": ["#######", ".....##", "....##.", "....##.", "...##..", "...##..", "..##...", "..##...", "..##..."],
  "8": [".#####.", "##...##", "##...##", "##...##", ".#####.", "##...##", "##...##", "##...##", ".#####."],
  "9": [".#####.", "##...##", "##...##", "##...##", ".######", ".....##", ".....##", "##...##", ".#####."],
};
const SMALL: Record<string, readonly string[]> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "##."],
};

/**
 * Block n from above: its top face `w` x `h` (outline included; the face's last row is the dark edge to the front), then
 * `F` rows of its front side (a wood rim, its panel color, darker), then the outline.
 */
function block(n: number, w: number, h: number, F: number): Part {
  const Wi = w - 2;
  const Hi = h - 2;
  const C = COLORS[(n - 1) % 3]!;
  const cv = canvas(Wi, Hi + 1 + F);
  const rim = Math.max(2, Math.round(Math.min(Wi, Hi) * 0.12));
  for (let y = 0; y < Hi; y++)
    for (let x = 0; x < Wi; x++) {
      const inRim = x < rim || y < rim || x >= Wi - rim || y >= Hi - rim;
      let k: string;
      if (inRim) {
        if (x === 0 || y === 0) k = x === Wi - 1 || y === Hi - 1 ? "O" : "o";
        else if (x === Wi - 1 || y === Hi - 1) k = "D";
        else if ((x === Wi - rim && y >= rim && y < Hi - rim + 1) || (y === Hi - rim && x >= rim && x < Wi - rim + 1)) k = "o";
        else k = "O";
      } else k = x === rim || y === rim ? C.d : C.p;
      cv[y]![x] = k;
    }
  // The number, carved: a cut whose top-left wall is in shadow.
  const pw = Wi - 2 * rim;
  const ph = Hi - 2 * rim;
  const str = String(n);
  let font = BIG;
  let gwid = 7;
  let ght = 9;
  if (str.length * 8 - 1 > pw || ght + 2 > ph) {
    font = SMALL;
    gwid = 3;
    ght = 5;
  }
  const gw = str.length * (gwid + 1) - 1;
  const sc = font === BIG && gw * 2 + 6 <= pw && ght * 2 + 6 <= ph ? 2 : 1;
  const GW = gw * sc;
  const GH = ght * sc;
  const gx = rim + Math.ceil((pw - GW) / 2);
  const gy = rim + Math.ceil((ph - GH) / 2);
  const on = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= GW || y >= GH) return false;
    const ux = Math.floor(x / sc);
    const uy = Math.floor(y / sc);
    const di = Math.floor(ux / (gwid + 1));
    const cx = ux % (gwid + 1);
    if (cx >= gwid) return false;
    return font[str[di]!]![uy]![cx] === "#";
  };
  const isPanel = (k: string | undefined) => k === C.p || k === C.d;
  for (let y = -1; y < GH; y++)
    for (let x = -1; x < GW; x++) if (!on(x, y) && on(x + 1, y + 1) && isPanel(cv[gy + y]?.[gx + x])) cv[gy + y]![gx + x] = C.c;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (on(x, y)) cv[gy + y]![gx + x] = "Y";
  // The edge between the top and the front, then the front.
  for (let x = 0; x < Wi; x++) cv[Hi]![x] = "k";
  for (let i = 0; i < F; i++)
    for (let x = 0; x < Wi; x++) {
      let k: string;
      if (F > 1 && x < 2) k = "O";
      else if (F > 1 && x >= Wi - 2) k = "D";
      else if (F === 1) k = C.d;
      else if (i === 0) k = "O";
      else k = i <= (F - 1) / 2 ? C.p : C.d;
      cv[Hi + 1 + i]![x] = k;
    }
  return { grid: toGrid(cv) };
}

/** The whole tower's shadow on the board for a stack of N, its far end swayed `s` px. */
function towerShadow(N: number, s: number): Part {
  const cv = canvas(96, 96);
  const L = 1 + N * 1.05;
  const dx = L + s;
  const dy = L * 0.85;
  const [x0, x1, y0, y1] = [36, 61, 36, 64];
  poly(cv, [[x0, y0], [x1, y0], [x1 + dx, y0 + dy], [x1 + dx, y1 + dy], [x0 + dx, y1 + dy], [x0, y1]], "z");
  for (const k of N < 3 ? ["x"] : ["x", "w"]) {
    const src = cv.map((r) => [...r]);
    for (let y = 1; y < 95; y++)
      for (let x = 1; x < 95; x++)
        if (src[y]![x] === "." && (src[y - 1]![x] !== "." || src[y + 1]![x] !== "." || src[y]![x - 1] !== "." || src[y]![x + 1] !== ".")) cv[y]![x] = k;
  }
  return { grid: toGrid(cv), outline: false };
}

/** A falling block's shadow, `n` across, chamfered corners. */
function dropShadow(n: number, k: string): Part {
  const cv = canvas(n, n);
  const c = n > 10 ? 2 : 1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.min(x, n - 1 - x) + Math.min(y, n - 1 - y) >= c) cv[y]![x] = k;
  return { grid: toGrid(cv), outline: false };
}

/** A puff of dust, `r` across. */
function dustPuff(r: number, k: "s" | "S"): Part {
  const cv = canvas(2 * r + 1, 2 * r + 1);
  shade(cv, inEllipse(r + 0.5, r + 0.5, r + 0.4, r + 0.4), k === "s" ? "sS" : "S", (x, y) => 0.9 - 0.05 * x - 0.05 * y);
  return { grid: toGrid(cv), outline: false };
}

/** The single block's shadow on its square: a strip down its right side. */
function sitShadow(): Part {
  const cv = canvas(27, 29);
  for (let y = 0; y < 29; y++) for (let x = 0; x < 27; x++) cv[y]![x] = x === 26 || y === 0 ? "x" : "z";
  cv[0]![26] = "w";
  return { grid: toGrid(cv), outline: false };
}

const { parts, add } = lazyParts();
const frontOf = (s: number) => (s <= 33 ? 4 : Math.round(s / 7));
const blockAt = (n: number, w: number, h: number, F: number, X: number, Y: number, extra: Partial<Layer> = {}): Layer => ({
  part: add(`b${n}:${w}x${h}:${F}`, () => block(n, w, h, F)),
  x: X + 1,
  y: Y + 1,
  ...extra,
});
const shadowAt = (N: number, s: number): Layer => ({ part: add(`sh${N}:${s}`, () => towerShadow(N, s)), x: 0, y: 0 });
const dropAt = (n: number, k: string, cx: number, cy: number): Layer => ({ part: add(`ds${n}${k}`, () => dropShadow(n, k)), x: Math.round(cx - n / 2), y: Math.round(cy - n / 2) });
const puff = (r: number, k: "s" | "S", x: number, y: number): Layer => ({ part: add(`puff${r}${k}`, () => dustPuff(r, k)), x, y });

// ---- The stack's geometry.

const SIZES = [26, 27, 27, 28, 28, 29, 30, 30, 31, 32];
/** How far each block's bottom edge sits above the one under it: the strip of the lower block that shows. */
const PEEK = [2, 2, 3, 2, 2, 2, 2, 2, 2];
const JX = [0, 2, -1, 2, -1, -2, 1, -2, 2, 1];
const FRONT = 4;
/** Each block's top face, outer top-left and size, at rest. */
const PLACE = (() => {
  const out: { x: number; y: number; s: number }[] = [];
  let bottom = 63;
  for (let k = 0; k < 10; k++) {
    if (k > 0) bottom -= PEEK[k - 1]!;
    const s = SIZES[k]!;
    out.push({ x: Math.round(48 - s / 2) + JX[k]!, y: bottom - s - FRONT, s });
  }
  return out;
})();

/** The middle of block k's top face (index k-1) at rest, frame px. */
export const TOWER_BLOCKS: [number, number][] = PLACE.map((p) => [p.x + Math.floor(p.s / 2), p.y + Math.floor(p.s / 2)]);
/** The top edge (frame px) of the stack of N (index N-1) at rest. */
export const TOWER_TOPS: number[] = PLACE.map((p) => p.y);

type Off = [number, number];
const rest = (N: number): Off[] => Array.from({ length: N }, (): Off => [0, 0]);

/** The stack of N, block k shifted by offs[k], its shadow's far end by `s`. */
function stack(N: number, offs: Off[] = rest(N), s = 0): Layer[] {
  if (N === 0) return [];
  const out: Layer[] = [shadowAt(N, s)];
  for (let k = 0; k < N; k++) {
    const p = PLACE[k]!;
    out.push(blockAt(k + 1, p.s, p.s, FRONT, p.x + offs[k]![0], p.y + offs[k]![1]));
  }
  return out;
}

/** A glint running along a top face's lit edge (`i` of 3). */
const glint = (X: number, Y: number, i: number): Speck[] => {
  const a = X + 6 + i * 7;
  return [[a, Y + 1, "F"], [a + 1, Y + 1, "F"], [a - 1, Y + 2, "F"], [a, Y + 2, "F"], [a - 2, Y + 3, "F"]];
};

// ---- stand<N>: the stack, alive.

const SWAY: Record<number, { A: number; ms: number; n: number }> = {
  4: { A: 1.4, ms: 220, n: 8 },
  5: { A: 1.8, ms: 200, n: 8 },
  6: { A: 2.2, ms: 190, n: 8 },
  7: { A: 2.6, ms: 170, n: 8 },
  8: { A: 3.0, ms: 160, n: 8 },
  9: { A: 3.4, ms: 150, n: 8 },
  10: { A: 4.8, ms: 120, n: 10 },
};

/** The stack bent so its top is `a` px over (a curve: the base never moves); `p` shapes the bend. */
function bend(N: number, a: number, p = 1.5, dip = false): Off[] {
  return Array.from({ length: N }, (_, k): Off => {
    const t = N === 1 ? 0 : k / (N - 1);
    const d = a * Math.pow(t, p);
    return [Math.round(d), dip ? Math.floor(Math.abs(d) / 4) : 0];
  });
}

function standAnim(N: number): Anim {
  const frames: Frame[] = [];
  const top = PLACE[N - 1]!;
  if (N === 1) {
    for (let i = 0; i < 8; i++) {
      const g = i >= 1 && i <= 3;
      frames.push({ ms: g ? 110 : 240, layers: stack(1), ...(g ? { specks: glint(top.x, top.y, i - 1) } : {}) });
    }
  } else if (N <= 3) {
    for (let i = 0; i < 6; i++) {
      const offs = rest(N);
      if (i === 4) offs[N - 1]![0] = 1;
      if (i === 5) offs[N - 1]![0] = -1;
      frames.push({ ms: i >= 4 ? 110 : 240, layers: stack(N, offs) });
    }
  } else {
    const { A, ms, n } = SWAY[N]!;
    for (let i = 0; i < n; i++) {
      const ph = (2 * Math.PI * i) / n;
      const a = A * Math.sin(ph);
      const offs = bend(N, a, N === 10 ? 1.5 + 0.8 * Math.cos(ph) : 1.5, N === 10);
      if (N >= 7 && N <= 9) {
        const mid = Math.floor(N / 2);
        if (i === 3) offs[mid]![0] += 1;
        if (i === 6) offs[mid - 2]![0] -= 1;
      }
      frames.push({ ms, layers: stack(N, offs, Math.round(offs[N - 1]![0] / 2)) });
    }
  }
  return { loop: true, frames };
}

// ---- add<N>: block N plops onto the stack of N-1.

const footDust = (t: number): Layer[] =>
  t > 2
    ? []
    : [
        puff(2 + t, "s", 30 - t * 3, 56 - t * 2),
        puff(2 + t, "S", 58 + t * 3, 56 - t * 2),
        puff(2, "S", 40 - t * 2, 61 + t),
        puff(2, "s", 52 + t * 2, 61 + t),
      ];

function addAnim(N: number): Anim {
  const p = PLACE[N - 1]!;
  const S = p.s;
  const below = N - 1;
  const cx = p.x + S / 2;
  const cy = p.y + S / 2;
  const frames: Frame[] = [];
  const scales = [1.7, 1.4, 1.15];
  const lifts = [6, 4, 2];
  const shadowKeys = ["w", "x", "z"];
  const shadowSizes = [0.45, 0.65, 0.85];
  let prev = Infinity;
  for (let i = 0; i < 3; i++) {
    let Sf = Math.round(S * scales[i]!);
    let lift = lifts[i]!;
    const maxAt = (l: number) => Math.floor(2 * (cy - l - 1));
    if (Sf > maxAt(lift)) lift = Math.max(0, Math.min(lift, Math.floor((2 * (cy - 1) - Sf) / 2)));
    Sf = Math.max(S + 2, Math.min(Sf, maxAt(lift), prev - 3));
    prev = Sf;
    const X = Math.round(cx - Sf / 2);
    const Y = Math.max(1, Math.round(cy - lift - Sf / 2));
    frames.push({
      ms: 40,
      layers: [
        ...stack(below),
        dropAt(Math.round(S * shadowSizes[i]!), shadowKeys[i]!, cx + 3 - i * 0.5, cy + 3 - i * 0.5),
        blockAt(N, Sf, Sf, frontOf(Sf), X, Y),
      ],
    });
  }
  const lower = (d: number): Off[] => rest(below).map((_, k): Off => [k === 0 && below > 1 ? 0 : d, 0]);
  const settled = (offs: Off[]) => stack(N, [...offs, [0, 0]]);
  // The plop: squashed, the stack under it shivering.
  frames.push({
    ms: 80,
    cue: "clack",
    shake: [0, 1],
    layers: [...stack(below, lower(1)).filter((l) => !l.part.startsWith("sh")), shadowAt(N, 0), blockAt(N, S + 2, S - 1, FRONT, p.x - 1, p.y + 1), ...(N === 1 ? footDust(0) : [])].sort(shadowFirst),
  });
  // The bounce: a px bigger, lifted.
  frames.push({
    ms: 70,
    layers: [...stack(below, lower(-1)).filter((l) => !l.part.startsWith("sh")), shadowAt(N, 0), blockAt(N, S + 1, S + 1, FRONT, p.x - 1, p.y - 2), ...(N === 1 ? footDust(1) : [])].sort(shadowFirst),
  });
  frames.push({ ms: 60, layers: [...settled(rest(below)), ...(N === 1 ? footDust(2) : [])] });
  frames.push({ ms: 120, layers: stack(N) });
  return { loop: false, frames };
}
const shadowFirst = (a: Layer, b: Layer) => (a.part.startsWith("sh") ? -1 : 0) - (b.part.startsWith("sh") ? -1 : 0);

// ---- tip<N>: the stack collapses, the blocks bursting out from the square.

/** Where block k (0-based) of a stack lies as it tips, `t` of the way (0 at rest, 1 scattered), face-centered. */
function tipped(N: number, k: number, t: number): Layer {
  const p = PLACE[k]!;
  const s = Math.round(p.s + (24 - p.s) * t);
  const F = FRONT;
  // (Fanned out sideways, left and right in turn, a little up or down.)
  const a = (k % 2 ? 0 : Math.PI) + (((k * 0.77 + N * 0.31) % 1.2) - 0.6) * (k % 2 ? 1 : -1);
  const fx = p.x + p.s / 2 + Math.cos(a) * 3.4 * t;
  const fy = p.y + p.s / 2 + Math.sin(a) * 2.4 * t + t * Math.min(1, k * 0.3);
  const kind = k === N - 1 ? (N % 2 ? 0 : 2) : (k * 5 + N) % 4;
  if (t < 0.45) return blockAt(k + 1, s, s, F, Math.round(fx - s / 2), Math.round(fy - s / 2));
  if (kind === 0 || kind === 2) {
    const rot = kind === 0 ? 1 : 3;
    const X = rot === 1 ? fx - F - s / 2 : fx - s / 2;
    return blockAt(k + 1, s, s, F, Math.round(X), Math.round(fy - s / 2), { rot });
  }
  const amp = kind === 1 ? 3 : -3;
  return blockAt(k + 1, s, s, F, Math.round(fx - s / 2 - amp / 2), Math.round(fy - s / 2), {
    wave: { along: "rows", amp, len: 1000, phase: Math.PI / 2, pin: "top" },
  });
}

const baseDust = (t: number): Layer[] =>
  t > 2
    ? []
    : [
        puff(2 + t, "s", 30 - t * 4, 55 - t * 2),
        puff(2 + Math.min(1, t), "S", 58 + t * 4, 56 - t * 2),
        puff(2, "S", 40 - t * 3, 61 + t),
        puff(2, "s", 52 + t * 3, 61 + t),
      ];

function tipAnim(N: number): Anim {
  const frames: Frame[] = [];
  const lurch = Math.min(6, 1 + N * 0.5);
  const offs = bend(N, lurch, 1.4);
  const first = stack(N, offs, Math.round(lurch / 2));
  // (The top block knocked askew as it lurches.)
  const topL = first[first.length - 1]!;
  first[first.length - 1] = { ...topL, x: topL.x - 1, wave: { along: "rows", amp: 2, len: 1000, phase: Math.PI / 2, pin: "top" } };
  frames.push({ ms: 70, cue: "crash", layers: [...first, ...baseDust(0)] });
  const steps: [number, number, number][] = [
    // ms, progress of the top block, of the base
    [80, 0.6, 0.2],
    [80, 1, 0.7],
    [70, 1, 1],
  ];
  steps.forEach(([ms, tTop, tBase], i) => {
    const layers: Layer[] = [];
    const sh = i === 0 ? Math.max(1, Math.round(N / 2)) : i === 1 ? 1 : 0;
    if (sh) layers.push(shadowAt(sh, 0));
    // (Once they're down, any block may land over any other; the top one stays over its neighbours till then.)
    const order = Array.from({ length: N }, (_, k) => k);
    if (i >= 1) order.sort((a, b) => ((a * 7 + 3) % (N + 1)) - ((b * 7 + 3) % (N + 1)));
    for (const k of order) {
      const r = N === 1 ? 0 : k / (N - 1);
      layers.push(tipped(N, k, tBase + (tTop - tBase) * r));
    }
    layers.push(...baseDust(i + 1));
    frames.push({ ms, layers });
  });
  frames.push({ ms: 30, layers: [] });
  return { loop: false, frames };
}

// ---- The single blocks, on their own square (x 32..63, y 32..63).

const SIT_X = 35;
const SIT_Y = 33;
const sitShadowAt = (): Layer => ({ part: add("sitsh", sitShadow), x: 37, y: 35 });
const sitLayers = (n: number): Layer[] => [sitShadowAt(), blockAt(n, 26, 26, FRONT, SIT_X, SIT_Y)];
const squareDust = (t: number): Layer[] =>
  t > 2
    ? []
    : [
        puff(3 - (t === 2 ? 1 : 0), "s", 32, 55 - t * 2),
        puff(3 - (t === 2 ? 1 : 0), "S", t === 2 ? 59 : 57, 55 - t * 2),
        puff(2, "S", 36 + t, 59),
        puff(2, "s", 54 - t, 59),
      ];

function sitAnim(n: number): Anim {
  return {
    loop: true,
    frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: i < 3 ? 90 : 300, layers: sitLayers(n), ...(i < 3 ? { specks: glint(SIT_X, SIT_Y, i) } : {}) })),
  };
}
function landAnim(n: number): Anim {
  return {
    loop: false,
    frames: [
      { ms: 50, layers: [dropAt(12, "w", 50, 50), blockAt(n, 30, 30, 1, 33, 32)] },
      { ms: 50, layers: [dropAt(18, "x", 49, 49), blockAt(n, 28, 28, 3, 34, 32)] },
      { ms: 70, cue: "clack", shake: [0, 1], layers: [sitShadowAt(), blockAt(n, 28, 25, FRONT, 34, 34), ...squareDust(0)] },
      { ms: 70, layers: [sitShadowAt(), blockAt(n, 27, 27, FRONT, 34, 32), ...squareDust(1)] },
      { ms: 60, layers: [...sitLayers(n), ...squareDust(2)] },
      { ms: 100, layers: sitLayers(n) },
    ],
  };
}
function poofAnim(n: number): Anim {
  const ring = (t: number): Layer[] => {
    const r = t <= 1 ? 3 : t === 2 ? 2 : 1;
    const d = 11 + t * 1.5;
    return [
      [-1, -1, "s"], [1, -1, "S"], [-1, 1, "S"], [1, 1, "s"], [0, 1.2, "S"],
    ].map(([ux, uy, k]) => {
      const x = Math.max(32, Math.min(63 - 2 * r, Math.round(48 + (ux as number) * d - r)));
      const y = Math.max(32, Math.min(63 - 2 * r, Math.round(48 + (uy as number) * d * 0.8 - r)));
      return puff(r, k as "s" | "S", x, y);
    });
  };
  return {
    loop: false,
    frames: [
      { ms: 70, cue: "poof", layers: [blockAt(n, 20, 20, 3, 38, 36), ...ring(0)] },
      { ms: 70, layers: [blockAt(n, 13, 13, 2, 41, 40), ...ring(1)] },
      { ms: 80, layers: ring(2) },
      { ms: 80, layers: ring(3) },
      { ms: 40, layers: [] },
    ],
  };
}
function flyAnim(n: number): Anim {
  const s = 22;
  const F = 3;
  const H = s + F + 1;
  return {
    loop: true,
    frames: ([0, 1, 2, 3] as const).map((rot): Frame => {
      const [bw, bh] = rot % 2 ? [H, s] : [s, H];
      return { ms: 70, layers: [blockAt(n, s, s, F, Math.round(48 - bw / 2), Math.round(48 - bh / 2), { rot })] };
    }),
  };
}

const anims: Record<string, Anim> = {};
for (let n = 1; n <= 10; n++) {
  anims[`stand${n}`] = lazyAnim(() => standAnim(n));
  anims[`add${n}`] = lazyAnim(() => addAnim(n));
  if (n >= 2) anims[`tip${n}`] = lazyAnim(() => tipAnim(n));
  anims[`sit${n}`] = lazyAnim(() => sitAnim(n));
  anims[`land${n}`] = lazyAnim(() => landAnim(n));
  anims[`poof${n}`] = lazyAnim(() => poofAnim(n));
  anims[`fly${n}`] = lazyAnim(() => flyAnim(n));
}
anims.idle = anims.stand7!;

export const TOY_TOWER: Character = {
  id: "bigboy-tower-top",
  name: "Big Boy's toy-block tower, from above",
  w: 96,
  h: 96,
  foot: [48, 63],
  palette: PALETTE,
  parts,
  anims,
};
