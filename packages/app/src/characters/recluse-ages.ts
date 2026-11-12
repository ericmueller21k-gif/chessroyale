/**
 * The Hidden Boss (code id `recluse`) at his younger ages: a MOCKUP for Eric (Nov 12, 2026), registered only for the
 * preview, wired into no match, kit or list (a test checks). Today's sprite (`recluse.ts`) is the fourth and oldest age,
 * unchanged; these three grow into it:
 * - `RECLUSE_CHILD`, about 9: a skinny kid in a 1950s red-and-cream striped tee, cuffed dungarees and canvas sneakers.
 * - `RECLUSE_TEEN`, about 13: a 1950s schoolboy, a maroon V-neck sweater over a white collar, khaki slacks, white socks and
 *   loafers, his hands in his pockets.
 * - `RECLUSE_YOUNG`, about 20: a white shirt, a narrow plain blue tie, charcoal trousers, black shoes.
 * Each keeps today's strong features so all four read as one person growing up: the swept hair parted on our left with a
 * loose lock to the brow, heavy brows, the eyes rolled up at us from under them, the long straight nose, the thin lips in
 * a half-smirk, the narrow chin. Taller, a longer face and longer hair with each age. The same drawing space as today's
 * sprite (the ground at y 128, his middle on x 46) and the same frame, so the ages line up and swap in place.
 * Each has an idle loop and a bust for a phone's bar. `RECLUSE_GROW` plays each step up (a shimmer, a flash, the two
 * silhouettes flickering, the older one in color). `RECLUSE_GHOST` is the cutscene's still and loop: the child as a pale,
 * see-through projection beside today's sprite on his knees.
 * Previews: npm run preview:characters -- <dir> extra=packages/app/src/characters/recluse-ages.ts only=<ids>
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { RECLUSE, RECLUSE_PALETTE, recluseLayers, type Brows, type Eyes, type ReclusePose } from "./recluse.ts";
import { frameKeys, joinParts, lazyAnim, lazyParts, mapFrames, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

type Pt = readonly [number, number];
export type Age = "child" | "teen" | "young";
export const AGES: readonly Age[] = ["child", "teen", "young"];

/** Today's palette, plus the younger ages' clothes. */
export const AGES_PALETTE: Record<string, string> = {
  ...RECLUSE_PALETTE,
  // The child's striped tee: cream (light, shade), red (light, shade).
  I: "#efe7d6",
  S: "#c4b9a4",
  R: "#c4443a",
  P: "#8c2a25",
  // Dungarees, dark to light, and the turned-up cuffs.
  Z: "#1f2f52",
  "%": "#2f4778",
  "&": "#44649e",
  "=": "#7f9dcc",
  // Sneakers' canvas.
  "#": "#3a3550",
  // The 13-year-old's sweater (maroon), dark to light.
  "*": "#4a1820",
  "~": "#73272f",
  "^": "#9c3a40",
  "!": "#b8545a",
  // Khaki slacks, dark to light.
  "<": "#5f4f35",
  ">": "#84704c",
  "?": "#a8936a",
  $: "#c4b085",
  // Charcoal trousers (20), dark to light.
  ":": "#1d1f26",
  ";": "#2c2f38",
  _: "#3e4250",
  "-": "#555a69",
  // Black shoes (20), dark to light.
  ",": "#121217",
  "'": "#26262e",
  "`": "#4a4a57",
};

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
function fill(cv: Canvas, x0: number, y0: number, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
}
function stamp(cv: Canvas, cx0: number, cy0: number, rows: readonly string[], x: number, y: number): void {
  rows.forEach((row, dy) =>
    [...row].forEach((k, dx) => {
      if (k === ".") return;
      const X = x + dx - cx0;
      const Y = y + dy - cy0;
      if (cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
    }),
  );
}
const mirror = (rows: readonly string[]) => rows.map((r) => [...r].reverse().join(""));

// ---- Each age's measures (drawing space, the same as today's sprite: the ground at y 128, his middle on x 46).

interface HeadSpec {
  /** Rows from the top of his hair to his chin. */
  rows: number;
  /** The face's half-width down its length: [row, half-width] (straight between). */
  hw: readonly Pt[];
  /** Where the hair meets the forehead at the face's middle, and how fast it drops to the temples. */
  hairline: number;
  temple: number;
  /** The hair's crown: how far it rises and bulges out to our right (swept across). */
  capRy: number;
  capRx: number;
  /** How far down the sides the hair comes (row), left and right. */
  sideL: number;
  sideR: number;
  brow: number;
  eye: number;
  /** The nose: its bridge's length, then the tip's row. */
  noseTip: number;
  mouth: number;
}
interface BodySpec {
  /** Where the top of his head sits (drawing space y). */
  top: number;
  shoulderY: number;
  /** Half the distance between his shoulder joints. */
  shoulder: number;
  waistY: number;
  waist: number;
  hipY: number;
  knee: number;
  /** Arms: elbow and wrist heights at rest, how far out the elbow and wrist sit. */
  elbowY: number;
  wristY: number;
  armOut: number;
  /** Upper arm, forearm and leg radii. */
  rUp: number;
  rLo: number;
  rLeg: number;
}
const HEAD: Record<Age, HeadSpec> = {
  child: { rows: 22, hw: [[4, 8], [7, 9], [13, 9], [16, 8], [18, 6.5], [20, 4.5], [21, 3]], hairline: 6, temple: 0.08, capRy: 7, capRx: 10.5, sideL: 9, sideR: 8, brow: 8, eye: 10, noseTip: 14, mouth: 17 },
  teen: { rows: 26, hw: [[4, 8.5], [8, 9.5], [15, 9.5], [19, 7.5], [22, 5.5], [24, 3.5], [25, 2.5]], hairline: 6, temple: 0.075, capRy: 7.5, capRx: 11, sideL: 11, sideR: 10, brow: 9, eye: 11, noseTip: 17, mouth: 20 },
  young: { rows: 29, hw: [[4, 9], [8, 10], [16, 10], [20, 8], [23, 6], [25, 4.5], [27, 3], [28, 2]], hairline: 7, temple: 0.07, capRy: 8, capRx: 12, sideL: 12, sideR: 12, brow: 10, eye: 12, noseTip: 19, mouth: 22 },
};
const BODY: Record<Age, BodySpec> = {
  child: { top: 46, shoulderY: 72, shoulder: 7, waistY: 94, waist: 7, hipY: 97, knee: 111, elbowY: 85, wristY: 96, armOut: 1, rUp: 2.2, rLo: 1.6, rLeg: 2.7 },
  teen: { top: 26, shoulderY: 56, shoulder: 9, waistY: 82, waist: 8.5, hipY: 85, knee: 105, elbowY: 70, wristY: 84, armOut: 1.5, rUp: 2.7, rLo: 2, rLeg: 3.5 },
  young: { top: 4, shoulderY: 39, shoulder: 10.5, waistY: 73, waist: 10.5, hipY: 79, knee: 101, elbowY: 61, wristY: 81, armOut: 2.5, rUp: 3.2, rLo: 2.3, rLeg: 4.2 },
};

/** The head's grid: 25 wide, the face's middle (the nose) on x 12, as today's. */
const HW = 25;
const CX = 12;

// ---- The head, one per face (features stamped on a base painted from the measures).

export interface KidFace {
  eyes: Eyes;
  brows: Brows;
  mouth: "stern" | "tight" | "smile" | "open" | "o";
}
const KID_REST: KidFace = { eyes: "ahead", brows: "stern", mouth: "stern" };

function halfWidth(s: HeadSpec, y: number): number {
  const pts = s.hw;
  if (y <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [y1, w1] = pts[i]!;
    const [y0, w0] = pts[i - 1]!;
    if (y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
  }
  return -1;
}

/**
 * The head without features: the face lit from the top left (shade down our right), the ears, then the hair over it,
 * parted on our left and swept across to our right in clumps, a loose lock falling to his brow.
 */
function headBase(age: Age): Canvas {
  const s = HEAD[age];
  const cv = canvas(HW, s.rows);
  const chin = s.rows - 1;
  // The face.
  for (let y = 2; y <= chin; y++) {
    const hw = halfWidth(s, y);
    if (hw < 0) continue;
    const x0 = Math.round(CX - hw);
    const x1 = Math.round(CX + hw);
    for (let x = x0; x <= x1; x++) {
      const t = (x - CX) / Math.max(1, hw);
      let k = t <= 0 ? "d" : t <= 0.5 ? "c" : t <= 0.88 ? "b" : "a";
      if (x === x0 && y > s.eye) k = "c";
      if (y === chin) k = x === x1 ? "a" : "b";
      else if (y === chin - 1 && t > 0.2) k = "b";
      cv[y]![x] = k;
    }
  }
  // Highlights: the forehead and the left cheek.
  const lit = (x: number, y: number) => cv[y]?.[x] === "d" && (cv[y]![x] = "e");
  for (let y = s.hairline; y < s.hairline + 3; y++) for (let x = 4; x < 8; x++) lit(x, y);
  for (const [dx, dy] of [[5, 3], [6, 3], [5, 4], [6, 4], [4, 4]] as const) lit(dx, s.eye + dy);
  // The ears, at the eyes' height: lit on our left, shaded on our right.
  for (let dy = 0; dy < 4; dy++) {
    const hw = halfWidth(s, s.eye + dy);
    const l = Math.round(CX - hw) - 1;
    const r = Math.round(CX + hw) + 1;
    if (dy < 3 || age === "child") {
      cv[s.eye + dy]![l] = dy === 0 || dy === 3 ? "b" : "c";
      cv[s.eye + dy]![r] = dy === 0 || dy === 3 ? "a" : "b";
    }
  }
  // The hair: a crown over the top (swept out to our right), down the sides to the temples, a hairline that rises
  // in the middle; clumps swept from the part across to our right.
  const part = CX - 4;
  const crown = inEllipse(CX + 1, s.capRy + 0.5, s.capRx, s.capRy + 0.5);
  const light = roundLight(CX - 5, 1, 13, 15, 0.3);
  const skin = cv.map((r) => r.map((k) => k !== "."));
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < HW; x++) {
      const side = x < CX ? s.sideL : s.sideR;
      // The hairline: high in the middle, down to the temples, lower on our right where the hair is swept across.
      const hairline = Math.min(side, s.hairline + s.temple * (x - CX) ** 2 + (x > CX ? (x - CX) * 0.22 : 0));
      const hw = halfWidth(s, Math.max(y, 2));
      const nearFace = Math.abs(x - CX) <= hw + 1.5;
      const covered = skin[y]![x] ? y < hairline && (crown(x, y) || y < side) : y < side && (crown(x, y) || (y > s.capRy && nearFace));
      if (!covered) continue;
      // Clumps: bands running down and across to our right from the part, darker in the grooves; darker at the edges.
      const band = (x - part) * 0.6 + y * 0.9;
      const groove = x > part ? band % 3.2 < 0.9 : (part - x + y) % 3 < 0.8;
      let l = light(x, y) - (groove ? 0.26 : 0) - (x > CX + 7 ? 0.1 : 0);
      if (skin[y]![x] && y >= hairline - 1) l -= 0.1;
      cv[y]![x] = ramp("HhjJ", l);
    }
  // The part: a dark line down from the crown on our left.
  for (let y = 0; y < Math.min(4, s.hairline - 1); y++) if (cv[y]![part] !== ".") cv[y]![part] = "H";
  // The loose lock falling from the part towards his brow (longer as he grows).
  stamp(cv, 0, 0, age === "child" ? [".j", "h."] : ["..j", ".hj", "h.."], part + 1, s.hairline - (age === "child" ? 0 : 1));
  return cv;
}

const KID_BROWS: Record<Brows, { l: readonly string[]; r?: readonly string[] }> = {
  stern: { l: ["BBBB.", "...BB"] },
  hard: { l: ["...BB", "BBBBB"] },
  twitch: { l: ["BBBB.", "...BB"], r: [".BBBB", "BB..."] },
  up: { l: [".BBB.", "B...B"] },
  wild: { l: [".BBB.", "B...B"] },
  fury: { l: ["BB...", ".BBBB"] },
};
const KID_EYES: Record<"child" | "grown", Partial<Record<Eyes, { l: readonly string[]; r?: readonly string[] }>>> = {
  // The child's: the same look up from under his brows, the iris tucked under the lid, but softer: no white beneath it.
  child: {
    ahead: { l: ["bxxb", "wxxw", "wxxw", "cbbc"] },
    down: { l: ["bbbb", "bxxb", "wxxw", "cbbc"] },
    readL: { l: ["bxxb", "xxww", "xxww", "cbbc"] },
    readR: { l: ["bxxb", "wwxx", "wwxx", "cbbc"] },
    shut: { l: ["bbbb", "cccc", "xxxx", "cbbc"] },
    wild: { l: ["wxxw", "wxxw", "wxxw", "bwwb"] },
  },
  // From 13 on, today's stare: the white showing under the iris.
  grown: {
    ahead: { l: ["bxxb", "wxxw", "bwwb", "cbbc"] },
    down: { l: ["bbbb", "xxxx", "wxxw", "cbbc"] },
    readL: { l: ["bbbb", "xxxx", "xxww", "cbbc"] },
    readR: { l: ["bbbb", "xxxx", "wwxx", "cbbc"] },
    shut: { l: ["bbbb", "cccc", "xxxx", "cbbc"] },
    hard: { l: ["bxxb", "wxxw", "wwww", "cbbc"] },
    narrow: { l: ["bbbb", "xxxx", "wxxw", "bbbb"] },
    wild: { l: ["wwww", "wwxw", "wwww", "bwwb"], r: ["wwww", "wxww", "wwww", "bwwb"] },
  },
};
/** The mouth: 5 wide for the child, 7 from 13 on; at rest today's half-smirk, the right corner up. */
const KID_MOUTH: Record<KidFace["mouth"], { s: readonly string[]; l: readonly string[] }> = {
  stern: { s: ["....m", "mmmm.", ".bdd."], l: ["......m", "mmmmmm.", ".bddd..", "..bbb.."] },
  tight: { s: [".....", "mmmmm", ".bbb."], l: [".......", "mmmmmmm", ".ddddd.", "..bbb.."] },
  smile: { s: ["m...m", ".mmm.", ".bdd."], l: ["m.....m", ".mmmmm.", "..ddd..", "..bbb.."] },
  open: { s: [".mmm.", "mXXXm", ".mmm."], l: [".mmmmm.", "mXXXXXm", ".mmmmm.", "..bbb.."] },
  o: { s: [".mm..", "mXXm.", ".mm.."], l: ["..mm...", ".mXXm..", "..mm...", "..bbb.."] },
};

function kidHead(age: Age, f: KidFace): Part {
  const s = HEAD[age];
  const cv = headBase(age);
  const put = (rows: readonly string[], x: number, y: number) => stamp(cv, 0, 0, rows, x, y);
  // The nose: long and straight from the brows (shorter and turned up on the child), lit down its bridge.
  const bridge = s.noseTip - s.eye;
  put(["c", ...Array.from({ length: bridge - 1 }, (_, i) => (i < 2 ? "e" : "d"))], CX, s.eye);
  put(["c", ...Array.from({ length: bridge - 1 }, () => "b")], CX + 1, s.eye);
  put(age === "child" ? [".deb", ".bab"] : [".deb.", "bdddb", ".bab."], CX - 2, s.noseTip - 1);
  const child = age === "child";
  const brows = KID_BROWS[f.brows];
  // (The child's brows lighter and softer, the dark of his hair; from 13 on, today's.)
  const bl = child ? brows.l.map((r) => r.replace(/B/g, "H")) : brows.l.map((r) => r + (r.endsWith("B") ? "B" : "."));
  put(bl, child ? 7 : 6, s.brow);
  put(brows.r ? (child ? brows.r.map((r) => r.replace(/B/g, "H")) : brows.r.map((r) => r + ".")) : mirror(bl), CX + 1, s.brow);
  const set = KID_EYES[child ? "child" : "grown"];
  const eyes = set[f.eyes] ?? set.ahead!;
  put(eyes.l, 7, s.eye);
  put(eyes.r ?? eyes.l, CX + 2, s.eye);
  const m = KID_MOUTH[f.mouth];
  put(child ? m.s : m.l, child ? CX - 2 : CX - 3, s.mouth);
  return { grid: toGrid(cv) };
}

// ---- The body.

/**
 * The torso by age: the neck, then the child's striped tee (a crew neck), the 13-year-old's V-neck sweater over a white
 * collar (ribbed at the waist), or the young man's white shirt (an open collar, a belt).
 */
function torso(age: Age): { part: Part; at: Pt } {
  const b = BODY[age];
  const X0 = Math.floor(46 - b.shoulder - 6);
  const Y0 = b.shoulderY - 9;
  const cv = canvas(Math.ceil(2 * b.shoulder) + 14, b.waistY - Y0 + 5);
  const F = (inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string) => fill(cv, X0, Y0, inside, key);
  const sw = b.shoulder;
  const sy = b.shoulderY;
  const neckW = age === "child" ? 2.4 : age === "teen" ? 2.8 : 3.4;
  // The neck: from under the chin to the collar, shaded on our right.
  F(inPoly([[46 - neckW, Y0], [46 + neckW, Y0], [46 + neckW + 0.3, sy], [46 - neckW - 0.3, sy]]), (x, y) => (y < Y0 + 3 || x > 46 + neckW - 1.6 ? "b" : "c"));
  const body = inPoly([[46 - neckW - 1, sy - 3], [46 + neckW + 1, sy - 3], [46 + sw + 1.5, sy - 1.6], [46 + sw + 2.8, sy + 1.6], [46 + sw + 2.2, sy + 8], [46 + b.waist + 0.4, b.waistY], [46 - b.waist - 0.4, b.waistY], [46 - sw - 2.2, sy + 8], [46 - sw - 2.8, sy + 1.6], [46 - sw - 1.5, sy - 1.6]]);
  const light = roundLight(46 - sw * 0.5, sy + 2, sw + 3, (b.waistY - sy) * 0.8, 0.2);
  if (age === "child") {
    // Red stripes across cream, every 4 rows, shaded with the light; a red crew neck.
    F(body, (x, y) => {
      const red = (y - sy) % 4 >= 2;
      return light(x, y) > 0.42 ? (red ? "R" : "I") : red ? "P" : "S";
    });
    F(inPoly([[46 - neckW - 1, sy - 3], [46 + neckW + 1, sy - 3], [46 + neckW + 0.6, sy - 0.6], [46 - neckW - 0.6, sy - 0.6]]), () => "P");
    F(inPoly([[46 - neckW + 0.2, sy - 3], [46 + neckW - 0.2, sy - 3], [46 + neckW - 0.6, sy - 1.4], [46 - neckW + 0.6, sy - 1.4]]), (x) => (x > 46.5 ? "b" : "c"));
  } else if (age === "teen") {
    F(body, (x, y) => (y >= b.waistY - 2 ? ((x - X0) % 2 ? "*" : "~") : ramp("*~^!", light(x, y))));
    // A V-neck down his chest, the white shirt and its collar points in it.
    const vee = inPoly([[46 - neckW - 0.6, sy - 3], [46 + neckW + 0.6, sy - 3], [46, sy + 6]]);
    F(vee, (x) => (x > 46.6 ? "r" : "t"));
    const vEdge = (x: number, y: number) => !vee(x, y) && (vee(x + 1, y) || vee(x - 1, y));
    F((x, y) => body(x, y) && vEdge(x, y), () => "*");
    stamp(cv, X0, Y0, ["tt..", ".tt.", "..t."], 46 - neckW - 1, sy - 3);
    stamp(cv, X0, Y0, ["..rr", ".rr.", ".r.."], 46 + neckW - 2, sy - 3);
    stamp(cv, X0, Y0, ["b", "a"], 46, sy - 3);
  } else {
    F(body, (x, y) => ramp("qrst", light(x, y) - (y > b.waistY - 6 ? 0.12 : 0)));
    const fold = (pts: Pt[], k: string) => pts.forEach(([x, y]) => stamp(cv, X0, Y0, [k], x, y));
    fold([[46 - sw - 0.5, sy + 7], [46 - sw + 0.5, sy + 8], [46 - sw + 1, sy + 9]], "r");
    fold([[46 + sw + 0.5, sy + 6], [46 + sw - 0.5, sy + 7], [46 + sw - 1, sy + 8]], "q");
    fold([[46 - 7, b.waistY - 4], [46 - 6, b.waistY - 3], [46 + 6, b.waistY - 4], [46 + 5, b.waistY - 3]], "r");
    // The collar's two points over his collarbones.
    const cL = inPoly([[46 - neckW - 1.6, sy - 3.6], [46 + 0.4, sy + 0.8], [46 - 1.8, sy + 3.6], [46 - neckW - 2.6, sy + 1]]);
    const cR = inPoly([[46 + neckW + 1.6, sy - 3.6], [46 + neckW + 2.6, sy + 1], [46 + 1.8, sy + 3.6], [46 - 0.4, sy + 0.8]]);
    F(cL, (x, y) => (!cL(x + 1, y + 1) ? "r" : "t"));
    F(cR, (x, y) => (!cR(x - 1, y + 1) ? "q" : "s"));
    // The belt.
    F(inPoly([[46 - b.waist - 0.4, b.waistY - 2], [46 + b.waist + 0.4, b.waistY - 2], [46 + b.waist + 0.4, b.waistY + 1], [46 - b.waist - 0.4, b.waistY + 1]]), (_x, y) => (y < b.waistY - 1 ? "E" : "D"));
    stamp(cv, X0, Y0, ["KWK", "KKK"], 45, b.waistY - 2);
  }
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}

/** The young man's tie: narrow and plain, dark blue; `sway` swings its blade. */
function tie(sway: number): { part: Part; at: Pt } {
  const b = BODY.young;
  const X0 = 40;
  const Y0 = b.shoulderY - 6;
  const cv = canvas(14, b.waistY - Y0);
  const sy = b.shoulderY;
  const knot = inPoly([[44.4, sy - 3], [47.6, sy - 3], [47, sy + 0.6], [45, sy + 0.6]]);
  const blade = inPoly([[45, sy], [47, sy], [48 + sway * 0.4, sy + 14], [48.4 + sway * 0.9, b.waistY - 6], [46 + sway * 1.1, b.waistY - 3], [43.6 + sway * 0.9, b.waistY - 6], [44 + sway * 0.4, sy + 14]]);
  fill(cv, X0, Y0, knot, (x) => (x > 46.4 ? "T" : "U"));
  fill(cv, X0, Y0, blade, (x, y) => (!blade(x + 1, y) ? "T" : "U"));
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function boxOf(pts: readonly Pt[], pad: number): { x0: number; y0: number; w: number; h: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  return { x0, y0, w: Math.ceil(Math.max(...xs)) + pad - x0 + 1, h: Math.ceil(Math.max(...ys)) + pad - y0 + 1 };
}

/** Each age's sleeve: its ramp, where it ends along the arm (0 the shoulder, 1 the elbow, 2 the wrist), its cuff. */
const SLEEVE: Record<Age, { keys: string; until: number; cuff: string; cuffLen: number }> = {
  child: { keys: "PRRI", until: 0.55, cuff: "R", cuffLen: 0.12 },
  teen: { keys: "*~^!", until: 1.82, cuff: "*", cuffLen: 0.18 },
  young: { keys: "qrst", until: 1.82, cuff: "rst", cuffLen: 0.18 },
};

/** An arm from its points: the sleeve, its cuff, the bare forearm; shaded like a cylinder lit from the top left. */
function paintArm(age: Age, sh: Pt, el: Pt, wr: Pt): Part {
  const B = BODY[age];
  const sl = SLEEVE[age];
  const b = boxOf([sh, el, wr], 5);
  const cv = canvas(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      const up = nearest(p, sh, el);
      const lo = nearest(p, el, wr);
      const sUp = up.t;
      const sLo = 1 + lo.t;
      const rr = (sv: number) => (sv < sl.until + sl.cuffLen ? (sv < 1 ? B.rUp : B.rUp - 0.3) : B.rLo - (sv - 1) * 0.3);
      const rUp = rr(sUp);
      const rLo = rr(sLo);
      const inUp = up.d <= rUp;
      const inLo = lo.d <= rLo;
      if (!inUp && !inLo) continue;
      const useLo = inLo && (!inUp || lo.d - rLo < up.d - rUp);
      const s = useLo ? lo : up;
      const sv = useLo ? sLo : sUp;
      const r = useLo ? rLo : rUp;
      const l = 0.6 - 0.5 * (s.nx / r) - 0.4 * (s.ny / r);
      cv[y]![x] = sv < sl.until ? ramp(sl.keys, l - 0.05) : sv < sl.until + sl.cuffLen ? ramp(sl.cuff, l) : ramp("bcd", l);
    }
  return { grid: toGrid(cv) };
}

function paintLimb(pts: readonly Pt[], r: number, r1: number, keys: string, base = 0.62): { cv: Canvas; at: Pt } {
  const b = boxOf(pts, Math.ceil(Math.max(r, r1)) + 1);
  const cv = canvas(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, rr: r };
      pts.slice(1).forEach((q, i) => {
        const n = nearest(p, pts[i]!, q);
        const rr = r + (r1 - r) * ((i + n.t) / (pts.length - 1));
        if (n.d - rr < best.d - best.rr) best = { d: n.d, nx: n.nx, ny: n.ny, rr };
      });
      if (best.d > best.rr) continue;
      cv[y]![x] = ramp(keys, base - 0.45 * (best.nx / best.rr) - 0.3 * (best.ny / best.rr));
    }
  return { cv, at: [b.x0, b.y0] };
}

/** Each age's trousers: the ramp (dark to light), and the hem: the child's turned-up cuffs, the 13-year-old's socks. */
const TROUSERS: Record<Age, string> = { child: "Z%&", teen: "<>?$", young: ":;_-" };

/** His hips and legs for an age; `toe`: one foot's heel lifted (the child scuffing his toe): `l` or `r`. */
function legs(age: Age, splay = 0): { part: Part; at: Pt } {
  const b = BODY[age];
  const X0 = Math.floor(46 - b.waist - 6);
  const Y0 = b.waistY - 4;
  const cv = canvas(Math.ceil(2 * b.waist) + 14, 128 - Y0);
  const keys = TROUSERS[age];
  const w = b.waist;
  const hips = inPoly([[46 - w - 0.4, b.waistY - 1], [46 + w + 0.4, b.waistY - 1], [46 + w + 1, b.hipY + 1], [46 + w - 2, b.hipY + 4], [46, b.hipY + 2], [46 - w + 2, b.hipY + 4], [46 - w - 1, b.hipY + 1]]);
  fill(cv, X0, Y0, hips, (x, y) => ramp(keys, roundLight(46 - w * 0.4, b.waistY, w + 2, 8, 0.1)(x, y)));
  const hx = w * 0.55;
  const legPts = (side: -1 | 1): Pt[] => [[46 + side * hx, b.hipY + 1], [46 + side * (hx + 0.2 + splay * 0.5), b.knee], [46 + side * (hx + 0.3 + splay), 122]];
  for (const side of [-1, 1] as const) {
    const l = paintLimb(legPts(side), b.rLeg, b.rLeg - 0.6, keys, side < 0 ? 0.66 : 0.48);
    l.cv.forEach((row, y) => row.forEach((k, x) => k !== "." && cv[l.at[1] - Y0 + y]?.[l.at[0] - X0 + x] !== undefined && (cv[l.at[1] - Y0 + y]![l.at[0] - X0 + x] = k)));
    const ax = Math.round(46 + side * (hx + 0.3 + splay));
    const half = Math.round(b.rLeg);
    if (age === "child") {
      // The cuffs turned up: a light band of the dungarees' inside, a dark seam above it.
      stamp(cv, X0, Y0, ["Z".repeat(2 * half + 1), "=".repeat(2 * half + 1), "&".repeat(2 * half + 1)], ax - half, 117);
    } else if (age === "teen") {
      // White socks between the hem and the loafers.
      stamp(cv, X0, Y0, ["<".repeat(2 * half + 1), (side < 0 ? "tts" : "ssr").padEnd(2 * half + 1, side < 0 ? "s" : "r")], ax - half, 119);
    } else {
      stamp(cv, X0, Y0, [":".repeat(2 * half + 2)], ax - half - 1, 121);
    }
  }
  // The seam down the middle.
  stamp(cv, X0, Y0, [keys[0]!, keys[0]!, keys[0]!], 46, b.hipY);
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}

/** Each age's shoe (the left: its toe out to our left), 6 rows down to the ground at the most. */
const SHOES: Record<Age, readonly string[]> = {
  // Canvas sneakers: a white rubber toe cap and sole.
  child: ["....##.", "..####.", "tw####.", "ttttttt", "rrrrrrr"],
  // Brown loafers, a strap across the top.
  teen: ["....EE...", "..EFGFE..", ".EFFDFFE.", "EFFFFFFFE", "DDDDDDDDD"],
  // Black dress shoes, a shine on the toe cap.
  young: ["......''...", "...'''`''..", ".'``'''''''", "'''''''''''", ",,,,,,,,,,,"],
};

/** The hands, typed. Each carries its own outline, open at the top so it runs on from the forearm. */
const HANDS: Record<"child" | "young", Record<"rest" | "flex", readonly string[]>> = {
  child: {
    rest: [".kcdk.", "kdcddk", "kdbcdk", ".kcdbk", ".kbcbk", "..kkk."],
    flex: [".kcdk.", "kdcddk", "kdbcdk", ".kbcbk", "..kkk.", "......"],
  },
  young: {
    rest: [".kcddck.", ".kcdddbk", "kddcddbk", "kdbcddbk", ".kkcddbk", "..kbcdbk", "..kbcbbk", "...kbbk.", "....kk.."],
    flex: [".kcddck.", ".kcdddbk", "kddcddbk", "kdbcddbk", ".kkcddbk", "..kbccbk", "...kbbk.", "....kk..", "........"],
  },
};

function shadow(w: number): Part {
  const cv = canvas(w, 3);
  fill(cv, 0, 0, inEllipse(w / 2, 1.5, w / 2, 1.6), () => "Q");
  return { grid: toGrid(cv), outline: false };
}

// ---- Parts (one table for all three ages, so the growing step swaps drawings in one frame).

const { parts: PARTS, add } = lazyParts();
const TORSO = new Map<Age, { part: Part; at: Pt }>();
const torsoOf = (a: Age) => TORSO.get(a) ?? TORSO.set(a, torso(a)).get(a)!;
const LEGS = new Map<string, { part: Part; at: Pt }>();
const legsOf = (a: Age, splay: number) => LEGS.get(`${a}:${splay}`) ?? LEGS.set(`${a}:${splay}`, legs(a, splay)).get(`${a}:${splay}`)!;
const TIES = new Map<number, { part: Part; at: Pt }>();
const tieOf = (s: number) => TIES.get(s) ?? TIES.set(s, tie(s)).get(s)!;
for (const a of AGES) {
  add(`torso:${a}`, () => torsoOf(a).part);
  add(`shoe:${a}`, () => ({ grid: SHOES[a] }));
  add(`shadow:${a}`, () => shadow(a === "child" ? 24 : a === "teen" ? 30 : 36));
}
for (const s of [-1, 0, 1]) add(`ntie:${s}`, () => tieOf(s).part);
for (const k of ["child", "young"] as const) for (const g of ["rest", "flex"] as const) add(`hand:${k}:${g}`, () => ({ grid: HANDS[k][g], outline: false }));
const headName = (a: Age, f: KidFace) => add(`head:${a}:${f.eyes}.${f.brows}.${f.mouth}`, () => kidHead(a, f));
const legsName = (a: Age, splay: number) => add(`legs:${a}:${splay}`, () => legsOf(a, splay).part);
const r2 = (v: number) => Math.round(v * 2) / 2;
function armPart(a: Age, sh: Pt, el: Pt, wr: Pt): { name: string; at: Pt } {
  const q = [sh, el, wr].map((p): Pt => [r2(p[0]), r2(p[1])]) as [Pt, Pt, Pt];
  const name = add(`arm:${a}:${q.map((p) => p.join(",")).join(";")}`, () => paintArm(a, q[0], q[1], q[2]));
  const b = boxOf(q, 5);
  return { name, at: [b.x0, b.y0] };
}

// ---- Poses.

/** The same frame as today's sprite: room above his head, his middle on x 46, the ground at y 128. */
const OX = -14;
const OY = 14;
const W = 64;
const H = OY + 128 + 4;
const HEAD_X = 34;

export interface AgePose {
  face?: Partial<KidFace>;
  /** A breath in: everything above his belt up a pixel. */
  breath?: number;
  /** His weight shifted: everything above his hips sideways (a pixel). */
  shift?: number;
  headDx?: number;
  headDy?: number;
  /** His wrists moved from where they hang (each [dx, dy]): our left, our right. */
  handL?: Pt;
  handR?: Pt;
  /** His fingers curled in a little. */
  flex?: boolean;
  /** One shoe's heel lifted, the toe on the ground (a scuff): which shoe, our left or our right. */
  toe?: "l" | "r";
  /** His whole body up (on his toes, a bounce). */
  rise?: number;
  tie?: number;
  /** Hands in his pockets (the 13-year-old). */
  pockets?: boolean;
}

export function ageLayers(age: Age, p: AgePose): Layer[] {
  const b = BODY[age];
  const at = (part: string, x: number, y: number, flipX = false): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y), ...(flipX ? { flipX } : {}) });
  const rise = p.rise ?? 0;
  const upY = -(p.breath ?? 0) - rise;
  const sx = p.shift ?? 0;
  const face: KidFace = { ...KID_REST, ...p.face };
  const pockets = p.pockets ?? age === "teen";
  const layers: Layer[] = [];
  layers.push(at(`shadow:${age}`, 46 - (age === "child" ? 12 : age === "teen" ? 15 : 18), 126));
  // The shoes: each under its leg's ankle; a scuffing foot tipped up on its toe a pixel.
  const ax = b.waist * 0.55 + 0.3;
  const shoeW = SHOES[age][0]!.length;
  const shoeH = SHOES[age].length;
  const toeL = p.toe === "l" ? 1 : 0;
  const toeR = p.toe === "r" ? 1 : 0;
  layers.push(at(`shoe:${age}`, 46 - ax - shoeW + 3, 128 - shoeH - rise - toeL), at(`shoe:${age}`, 46 + ax - 2, 128 - shoeH - rise - toeR, true));
  const lg = legsOf(age, 0);
  const legLayer = at(legsName(age, 0), lg.at[0], lg.at[1] - rise);
  const t = torsoOf(age);
  const torsoLayer = at(`torso:${age}`, t.at[0] + sx, t.at[1] + upY);
  const sh = (side: -1 | 1): Pt => [46 + side * b.shoulder + sx, b.shoulderY + 1 + upY];
  const armLayers: Layer[] = [];
  const handLayers: Layer[] = [];
  for (const side of [-1, 1] as const) {
    const d = (side < 0 ? p.handL : p.handR) ?? [0, 0];
    let el: Pt;
    let wr: Pt;
    if (pockets) {
      // Elbows out a little, the forearms down into the trousers' pockets at his hips.
      el = [46 + side * (b.shoulder + 2.6) + sx, b.elbowY + upY];
      wr = [46 + side * (b.waist - 1.2) + d[0] * 0.5, b.hipY + 2 - rise + d[1]];
    } else {
      el = [46 + side * (b.shoulder + b.armOut) + sx + d[0] * 0.4, b.elbowY + upY + d[1] * 0.4];
      wr = [46 + side * (b.shoulder + b.armOut + 0.6) + sx + d[0], b.wristY + upY + d[1]];
    }
    const arm = armPart(age, sh(side), el, wr);
    armLayers.push(at(arm.name, arm.at[0], arm.at[1]));
    if (!pockets) {
      const hk = age === "child" ? "child" : "young";
      const grid = HANDS[hk][p.flex ? "flex" : "rest"];
      const hw = grid[0]!.length;
      const off = age === "child" ? 3 : 4;
      handLayers.push(at(`hand:${hk}:${p.flex ? "flex" : "rest"}`, side > 0 ? wr[0] - off : wr[0] - (hw - off), wr[1] - 1, side < 0));
    }
  }
  const head = at(headName(age, face), HEAD_X + sx + (p.headDx ?? 0), b.top + upY + (p.headDy ?? 0));
  if (pockets) {
    // His forearms go into his pockets: drawn behind his hips, the pockets' edges over his wrists.
    layers.push(torsoLayer, ...armLayers, legLayer, head);
  } else {
    layers.push(legLayer, torsoLayer);
    if (age === "young") {
      const ti = tieOf(Math.max(-1, Math.min(1, p.tie ?? 0)));
      layers.push(at(`ntie:${Math.max(-1, Math.min(1, p.tie ?? 0))}`, ti.at[0] + sx, ti.at[1] + upY));
    }
    layers.push(head, ...armLayers, ...handLayers);
  }
  return layers;
}

const frame = (age: Age, ms: number, p: AgePose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: ageLayers(age, p), ...extra });

// ---- Idles (loops, silent).

/**
 * The child (4.6 s): he can't keep still. A breath; he looks up at us, then off to our left and our right (taking
 * everything in); he swings his arms a little, rocks up on his toes and back; scuffs a sneaker; a blink; a quick smile.
 */
const CHILD_IDLE: { ms: number; p: AgePose }[] = Array.from({ length: 38 }, (_, i) => {
  const eyes: Eyes = i === 3 || i === 27 ? "shut" : i >= 8 && i < 12 ? "readL" : i >= 12 && i < 16 ? "readR" : i >= 30 && i < 33 ? "down" : "ahead";
  const swing = [0, 1, 2, 1, 0, -1, -2, -1][i % 8]!;
  const swinging = i >= 16 && i < 26;
  const rise = i === 20 || i === 21 || i === 24 ? 1 : 0;
  return {
    ms: 120,
    p: {
      breath: i >= 4 && i < 16 ? 1 : 0,
      rise,
      face: { eyes, brows: i >= 12 && i < 15 ? "up" : "stern", mouth: i >= 34 && i < 37 ? "smile" : "stern" },
      handL: swinging ? [-swing * 0.6, -Math.abs(swing) * 0.5] : [0, 0],
      handR: swinging ? [-swing * 0.6, -Math.abs(swing) * 0.5] : [0, 0],
      shift: i >= 28 && i < 34 ? 1 : 0,
      toe: i >= 29 && i < 33 ? (i % 2 ? "r" : undefined) : undefined,
      flex: i >= 6 && i < 9,
      headDx: i >= 9 && i < 11 ? -1 : i >= 13 && i < 15 ? 1 : 0,
    },
  };
});
/**
 * At 13 (4.8 s): hands in his pockets, weight on one hip then the other; a sideways glance, a brow up, his head
 * tipped; a blink; he scuffs a loafer and looks back up at us with the stare.
 */
const TEEN_IDLE: { ms: number; p: AgePose }[] = Array.from({ length: 40 }, (_, i) => {
  const eyes: Eyes = i === 5 || i === 33 ? "shut" : i >= 10 && i < 17 ? "readR" : i >= 22 && i < 28 ? "down" : "ahead";
  return {
    ms: 120,
    p: {
      breath: i >= 6 && i < 20 ? 1 : 0,
      shift: i >= 8 && i < 20 ? 1 : i >= 26 && i < 34 ? -1 : 0,
      headDx: i >= 12 && i < 16 ? 1 : 0,
      headDy: i >= 12 && i < 16 ? 1 : 0,
      face: { eyes, brows: i >= 13 && i < 17 ? "twitch" : "stern", mouth: i >= 13 && i < 17 ? "tight" : "stern" },
      toe: i >= 23 && i < 27 && i % 2 ? "l" : undefined,
    },
  };
});
/**
 * At 20 (4.8 s), close to today's: standing still, a slow breath; the stare at us, his eyes drop (to a board) and back;
 * his fingers curl in twice; a blink; once a brow twitches.
 */
const YOUNG_IDLE: { ms: number; p: AgePose }[] = Array.from({ length: 40 }, (_, i) => {
  const eyes: Eyes = i === 5 || i === 34 ? "shut" : i >= 12 && i < 26 ? "down" : "ahead";
  return {
    ms: 120,
    p: {
      breath: i >= 8 && i < 28 ? 1 : 0,
      face: { eyes, brows: i === 30 || i === 31 ? "twitch" : "stern" },
      flex: (i >= 15 && i < 18) || (i >= 22 && i < 25),
      tie: i >= 8 && i < 12 ? 1 : 0,
    },
  };
});
const IDLES: Record<Age, { ms: number; p: AgePose }[]> = { child: CHILD_IDLE, teen: TEEN_IDLE, young: YOUNG_IDLE };
const idleFrames = (a: Age): Frame[] => IDLES[a].map((s) => frame(a, s.ms, s.p));

// ---- The growing step: a shimmer, a flash, the two silhouettes flickering, the older one in color.

/** Gold motes and little four-point stars rising around him (the spell's colors, `8` pale to `0` ember). */
function shimmer(top: number, i: number, n = 14): Speck[] {
  const out: Speck[] = [];
  for (let k = 0; k < n; k++) {
    const life = (i + k * 3) % 7;
    if (life > 5) continue;
    const x = 46 + (k % 2 ? 1 : -1) * (8 + ((k * 7) % 11)) + Math.round(Math.sin((life + k) * 1.4));
    const y = 126 - ((k * 13) % (128 - top)) - life * 3;
    const key = life < 2 ? "8" : life < 4 ? "9" : "0";
    const X = OX + x;
    const Y = OY + y;
    out.push([X, Y, key]);
    if (k % 3 === 0 && life > 0 && life < 3) out.push([X - 1, Y, key], [X + 1, Y, key], [X, Y - 1, key], [X, Y + 1, key]);
  }
  return out.filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
}
/** The whole figure lit up pale gold (every key; the outline gold), a frame's palette. */
const SILHOUETTE: Record<string, string> = Object.fromEntries(Object.keys(AGES_PALETTE).map((k) => [k, k === "k" ? "#ffc44a" : "#fff3b8"]));
/** Halfway back to color: every key lifted towards gold. */
const HALF_LIT: Record<string, string> = Object.fromEntries(
  Object.entries(AGES_PALETTE).map(([k, c]) => {
    const n = parseInt(c.slice(1, 7), 16);
    const mix = (v: number, to: number) => Math.round(v + (to - v) * 0.55);
    const rgb = [mix((n >> 16) & 255, 255), mix((n >> 8) & 255, 236), mix(n & 255, 170)];
    return [k, `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}${c.slice(7)}`];
  }),
);

/** The older drawing's layers: one of the new ages, or today's sprite (his rest, the book at his side). */
type Who = Age | "today";
const layersOf = (w: Who, p: AgePose = {}): Layer[] => (w === "today" ? recluseLayers({ breath: p.breath, face: { eyes: "ahead" } } as ReclusePose) : ageLayers(w, p));
const TOPS: Record<Who, number> = { child: BODY.child.top, teen: BODY.teen.top, young: BODY.young.top, today: 1 };

/**
 * One step up (one-shot, about 1.9 s): he stands (cue `shimmer`: motes rise around him), lights up pale gold (cue
 * `flash`), his drawing and the older one flicker faster and faster as silhouettes, then the older one holds, fades
 * from gold to color (cue `grown`) as the last motes rise, and stands at rest.
 */
function growFrames(from: Who, to: Who): Frame[] {
  const top = Math.min(TOPS[from], TOPS[to]);
  const f = (ms: number, w: Who, extra: Partial<Frame> = {}, p: AgePose = {}): Frame => ({ ms, layers: layersOf(w, p), ...extra });
  const out: Frame[] = [f(220, from)];
  for (let i = 0; i < 4; i++) out.push(f(90, from, { specks: shimmer(TOPS[from], i, 8 + i * 2), ...(i === 0 ? { cue: "shimmer" } : {}) }));
  out.push(f(70, from, { pal: HALF_LIT, specks: shimmer(TOPS[from], 4, 16) }));
  out.push(f(110, from, { pal: SILHOUETTE, cue: "flash", specks: shimmer(top, 5, 16) }));
  // The flicker: young, old, young, old... quicker each time.
  [110, 100, 90, 80, 70, 60, 55, 50, 50, 50].forEach((ms, i) => out.push(f(ms, i % 2 ? from : to, { pal: SILHOUETTE, specks: shimmer(top, 6 + i, 16) })));
  out.push(f(160, to, { pal: SILHOUETTE, specks: shimmer(top, 16, 18), shake: [0, -1] }));
  out.push(f(110, to, { pal: HALF_LIT, cue: "grown", specks: shimmer(TOPS[to], 17, 12) }));
  for (let i = 0; i < 3; i++) out.push(f(100, to, { specks: shimmer(TOPS[to], 18 + i, 8 - i * 2) }));
  out.push(f(300, to));
  return out;
}

// ---- The characters.

const BUST_W = 50;
const BUST_H = 70;
/** A bust's window on drawing space: from above his hair down past his chest (the same size for each age). */
const bustOf = (top: number) => {
  const x0 = 21;
  const y0 = top - 11;
  return (f: Frame): Frame => {
    const dx = -OX - x0;
    const dy = -OY - y0;
    return { ...f, layers: f.layers.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })), ...(f.specks ? { specks: f.specks.map(([x, y, k]): Speck => [x + dx, y + dy, k]).filter(([x, y]) => x >= 1 && y >= 1 && x <= BUST_W - 2 && y <= BUST_H - 2) } : {}) };
  };
};

const NAMES: Record<Age, string> = { child: "Hidden Boss age 9", teen: "Hidden Boss age 13", young: "Hidden Boss age 20" };
/** A one-shot for each age besides the idle (the test kit wants one with a cue): the step up from the age before. */
const animsOf = (a: Age): Record<string, Anim> => ({
  idle: lazyAnim(() => ({ loop: true, frames: idleFrames(a) })),
  grow: lazyAnim(() => ({ loop: false, frames: a === "child" ? growFrames("child", "child") : growFrames(a === "teen" ? "child" : "teen", a) })),
});
const PARTS_ALL = joinParts(PARTS, RECLUSE.parts);
const ageChar = (a: Age): Character => ({ id: `recluse-${a}`, name: NAMES[a], w: W, h: H, foot: [OX + 46, OY + 128], palette: AGES_PALETTE, halo: "#2a2733", parts: PARTS_ALL, anims: animsOf(a) });
const ageBust = (a: Age): Character => ({
  id: `recluse-${a}-bust`,
  name: `${NAMES[a]} (bust)`,
  w: BUST_W,
  h: BUST_H,
  foot: [46 - 21, BUST_H],
  palette: AGES_PALETTE,
  halo: "#2a2733",
  parts: PARTS_ALL,
  anims: mapFrames(animsOf(a), bustOf(BODY[a].top)),
});

export const RECLUSE_CHILD = ageChar("child");
export const RECLUSE_TEEN = ageChar("teen");
export const RECLUSE_YOUNG = ageChar("young");
export const RECLUSE_CHILD_BUST = ageBust("child");
export const RECLUSE_TEEN_BUST = ageBust("teen");
export const RECLUSE_YOUNG_BUST = ageBust("young");

/** The growing steps, each a one-shot: child to 13, 13 to 20, 20 to today's sprite; `all`: the three in a row. */
export const RECLUSE_GROW: Character = {
  id: "recluse-grow",
  name: "Hidden Boss growing up",
  w: W,
  h: H,
  foot: [OX + 46, OY + 128],
  palette: AGES_PALETTE,
  halo: "#2a2733",
  parts: PARTS_ALL,
  anims: {
    idle: lazyAnim(() => ({ loop: true, frames: idleFrames("child") })),
    grow1: lazyAnim(() => ({ loop: false, frames: growFrames("child", "teen") })),
    grow2: lazyAnim(() => ({ loop: false, frames: growFrames("teen", "young") })),
    grow3: lazyAnim(() => ({ loop: false, frames: growFrames("young", "today") })),
    all: lazyAnim(() => ({
      loop: false,
      frames: [...idleFrames("child").slice(0, 12), ...growFrames("child", "teen"), ...idleFrames("teen").slice(0, 10), ...growFrames("teen", "young"), ...idleFrames("young").slice(0, 10), ...growFrames("young", "today")],
    })),
  },
};

// ---- The ghost of the child (the cutscene after his adult form is beaten), beside today's sprite on his knees.

/** The ghost's keys: its outline, a pale ramp (dark to light), the glow (outer, inner), a bright mote. All see-through. */
const GHOST_PALETTE: Record<string, string> = {
  g: "#7fb0e6b0",
  f: "#9cc4ee90",
  i: "#b8d8f5a0",
  n: "#d4e8faa8",
  p: "#f0f8ffb8",
  u: "#a8d4ff26",
  v: "#bfe2ff4a",
  z: "#f4fbff",
};
const lum = (c: string) => {
  const n = parseInt(c.slice(1, 7), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.55 + (n & 255) * 0.15) / 255;
};
/** A drawing turned into the ghost: each key to the pale ramp by its brightness, the outline and halo to the glow, two soft rings. */
function ghostPart(ch: Character, f: Frame): { part: Part; at: Pt } {
  const keys = frameKeys(ch, f);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  keys.forEach((row, y) => row.forEach((k, x) => k && ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)))));
  const pad = 2;
  const cv = canvas(x1 - x0 + 1 + pad * 2, y1 - y0 + 1 + pad * 2);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const k = keys[y]![x];
      if (!k || k === "Q") continue;
      // (His feet dissolve: the last rows thin out to the faint glow, a projection that doesn't quite reach the ground.)
      const fade = y1 - y < 4 ? 2 : y1 - y < 10 ? 1 : 0;
      cv[y - y0 + pad]![x - x0 + pad] = fade === 2 ? ((x + y) % 2 ? "v" : "u") : fade === 1 && (x + y) % 2 ? "v" : k === "k" ? "g" : k === "@" ? "v" : ramp("finp", lum(AGES_PALETTE[k]!) * 1.25 + 0.05);
    }
  // The soft glow: two rings outside the silhouette.
  for (const key of ["v", "u"]) {
    const src = cv.map((r) => [...r]);
    for (let y = 0; y < cv.length; y++)
      for (let x = 0; x < cv[0]!.length; x++)
        if (src[y]![x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (src[y + dy!]?.[x + dx!] ?? ".") !== ".")) cv[y]![x] = key;
  }
  return { part: { grid: toGrid(cv), outline: false }, at: [x0 - pad, y0 - pad] };
}

const GHOST_DX = 40;
const SCENE_W = W + GHOST_DX;
const { parts: GHOST_PARTS, add: addGhost } = lazyParts();
const GHOSTS = new Map<string, { part: Part; at: Pt }>();
const ghostLayer = (i: number, bob: number, look: Eyes): Layer => {
  const s = CHILD_IDLE[i % CHILD_IDLE.length]!;
  const name = `ghost:${i % CHILD_IDLE.length}:${look}`;
  let g = GHOSTS.get(name);
  if (!g) {
    g = ghostPart(RECLUSE_CHILD, frame("child", 0, { ...s.p, face: { ...s.p.face, eyes: s.p.face?.eyes === "shut" ? "shut" : look, mouth: "stern" }, toe: undefined, rise: 0 }));
    GHOSTS.set(name, g);
  }
  const made = g;
  addGhost(name, () => made.part);
  return { part: name, x: GHOST_DX + g.at[0], y: g.at[1] - 4 - bob };
};
/** Today's sprite on his knees, the book flat on the ground before him, his eyes down or turned to the child. */
const kneeling = (eyes: Eyes, breath = 0, dip = 6): Layer[] =>
  recluseLayers({ stance: "kneel", dip, breath, face: { eyes, brows: "up", mouth: "tight" }, hold: { book: "flat", at: [46, 125], loose: true, clutched: false, elbowR: [32, 58], wristR: [38, 78], elbowL: [60, 58], wristL: [55, 78] } });
/** Motes drifting up off the ghost. */
const motes = (i: number): Speck[] =>
  Array.from({ length: 6 }, (_, k): Speck => {
    const life = (i + k * 4) % 12;
    return [GHOST_DX + 26 + ((k * 5) % 14) + (life % 4 === 0 ? 1 : 0), 130 - ((k * 11) % 40) - life * 3, life < 6 ? "z" : "v"];
  }).filter(([x, y]) => x >= 1 && y >= 1 && x <= SCENE_W - 2);
/** The ghost's glow breathing: the outer ring fainter and stronger, a frame's palette. */
const pulse = (i: number): Record<string, string> => ({ u: ["#a8d4ff1c", "#a8d4ff26", "#a8d4ff34", "#a8d4ff26"][i % 4]!, v: ["#bfe2ff40", "#bfe2ff4a", "#bfe2ff58", "#bfe2ff4a"][i % 4]! });
/** The ghost faded to `a` (0 to 1) of its strength: every ghost key's alpha scaled. */
const faded = (a: number): Record<string, string> =>
  Object.fromEntries(Object.entries(GHOST_PALETTE).map(([k, c]) => [k, c.slice(0, 7) + Math.round((c.length > 7 ? parseInt(c.slice(7), 16) : 255) * a).toString(16).padStart(2, "0")]));

/**
 * The loop (about 4.3 s): he kneels, slumped, breathing slowly; he lifts his eyes to the child beside him and lets them
 * fall again. The child, pale and see-through in a soft glow, floats a few pixels off the ground, bobbing; looks at him,
 * blinks, fidgets as a child does; motes drift up off him and his glow breathes.
 */
const GHOST_LOOP = (): Frame[] =>
  Array.from({ length: 36 }, (_, i) => {
    const bob = [0, 0, 1, 1, 2, 2, 1, 1][Math.floor(i / 2) % 8]!;
    const eyes: Eyes = i >= 10 && i < 24 ? "readR" : "down";
    return { ms: 120, layers: [...kneeling(eyes, i >= 6 && i < 20 ? 1 : 0, i >= 10 && i < 24 ? 4 : 6), ghostLayer(i, bob, "readL")], specks: motes(i), pal: pulse(i) };
  });
/** The ghost appears (one-shot, cue `appear`): faint, then stronger over a second; and fades out (cue `fade`). */
const GHOST_IN = (): Frame[] => [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((a, i) => ({ ms: 150, layers: [...kneeling("down"), ghostLayer(i, 0, "readL")], specks: a > 0.5 ? motes(i) : [], pal: faded(a), ...(i === 0 ? { cue: "appear" } : {}) }));
const GHOST_OUT = (): Frame[] => [1, 0.8, 0.6, 0.4, 0.25, 0.1].map((a, i): Frame => ({ ms: 160, layers: [...kneeling("readR", 0, 4), ghostLayer(i, 1, "readL")], specks: a > 0.5 ? motes(i) : [], pal: faded(a), ...(i === 0 ? { cue: "fade" } : {}) })).concat([{ ms: 400, layers: kneeling("readR", 0, 4) }]);

export const RECLUSE_GHOST: Character = {
  id: "recluse-ghost",
  name: "Hidden Boss ghost child",
  w: SCENE_W,
  h: H,
  foot: [OX + 46, OY + 128],
  palette: { ...AGES_PALETTE, ...GHOST_PALETTE },
  halo: "#2a2733",
  parts: joinParts(GHOST_PARTS, RECLUSE.parts),
  anims: {
    idle: lazyAnim(() => ({ loop: true, frames: GHOST_LOOP() })),
    still: lazyAnim(() => ({ loop: false, frames: [{ ...GHOST_LOOP()[12]!, ms: 1000, cue: "still" }] })),
    appear: lazyAnim(() => ({ loop: false, frames: GHOST_IN() })),
    fade: lazyAnim(() => ({ loop: false, frames: GHOST_OUT() })),
  },
};

/** Everything this mockup draws, for the preview and the tests; none of it is in CHARACTERS or any kit. */
export const RECLUSE_AGES_PREVIEW: readonly Character[] = [RECLUSE_CHILD, RECLUSE_TEEN, RECLUSE_YOUNG, RECLUSE_CHILD_BUST, RECLUSE_TEEN_BUST, RECLUSE_YOUNG_BUST, RECLUSE_GROW, RECLUSE_GHOST];
