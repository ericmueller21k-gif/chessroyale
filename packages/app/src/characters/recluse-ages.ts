/**
 * The Hidden Boss (code id `recluse`) at his younger ages (Eric liked the mockup, Nov 12, 2026): since Nov 13 his child form's
 * figure in a match (RECLUSE_GROWING and its bust, below; kits.ts RECLUSE_CHILD_KIT), in no character list or BOSS_KITS (a test
 * checks). Today's sprite (`recluse.ts`) is the fourth and oldest age, unchanged; these three grow into it:
 * - `RECLUSE_CHILD`, about 9: a skinny kid in a 1950s red-and-cream striped tee, cuffed dungarees and canvas sneakers.
 * - `RECLUSE_TEEN`, about 13: a 1950s schoolboy, a maroon V-neck sweater over a white collar, khaki slacks, white socks and
 *   loafers, his hands in his pockets.
 * - `RECLUSE_YOUNG`, about 20: a black suit (jacket and trousers) over a white shirt with a narrow black tie, black shoes
 *   (Eric, Nov 12: a black suit instead of the bare white shirt and tie).
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
import { RECLUSE, RECLUSE_BUST, RECLUSE_PALETTE, recluseLayers, type Brows, type Eyes, type Mouth, type ReclusePose } from "./recluse.ts";
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
  // The black suit (20): jacket and trousers, dark to light, the last a cool sheen so the shape reads on a dark ground.
  ":": "#15161c",
  ";": "#22242d",
  _: "#343744",
  "-": "#50566a",
  // Black shoes (20), dark to light.
  ",": "#121217",
  "'": "#26262e",
  "`": "#4a4a57",
};

/** The black suit's ramp (20): the jacket, its sleeves and the trousers. */
const SUIT = ":;_-";
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
  young: { top: 4, shoulderY: 39, shoulder: 10.5, waistY: 73, waist: 10.5, hipY: 79, knee: 101, elbowY: 61, wristY: 81, armOut: 1.5, rUp: 3.2, rLo: 2.3, rLeg: 4.2 },
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
 * collar (ribbed at the waist), or the young man's black suit jacket over a white shirt (lapels, two buttons).
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
    // The black suit jacket, its hem over his hips (a little opening at the front below the button).
    const hem = inPoly([[46 - b.waist - 0.4, b.waistY - 1], [46 + b.waist + 0.4, b.waistY - 1], [46 + b.waist + 1, b.waistY + 4], [46 + 1.2, b.waistY + 4], [46, b.waistY + 2], [46 - 1.2, b.waistY + 4], [46 - b.waist - 1, b.waistY + 4]]);
    const coat = (x: number, y: number) => body(x, y) || hem(x, y);
    F(coat, (x, y) => ramp(SUIT, light(x, y) + 0.08));
    // The shirt in the jacket's opening: a V from his collar down to the button.
    const vy = sy + 15;
    const vee = inPoly([[46 - neckW - 1.6, sy - 3], [46 + neckW + 1.6, sy - 3], [46 + 0.8, vy], [46 - 0.8, vy]]);
    F(vee, (x, y) => ramp("rst", light(x, y) + 0.25));
    // The lapels down each side of the V: a sheen on our left (the light), a shade on our right, a notch near the top.
    const edge = (x: number, y: number) => coat(x, y) && !vee(x, y) && y < vy + 1;
    F((x, y) => edge(x, y) && (vee(x + 1, y) || vee(x + 2, y)) && x < 46, (_x, y) => (y === sy + 2 ? ":" : "-"));
    F((x, y) => edge(x, y) && (vee(x - 1, y) || vee(x - 2, y)) && x >= 46, (_x, y) => (y === sy + 2 ? ":" : "_"));
    // A seam where the lapels meet the jacket, and the jacket's two buttons, the front edge down to the hem.
    stamp(cv, X0, Y0, ["`"], 46, vy + 1);
    stamp(cv, X0, Y0, ["`"], 46, vy + 7);
    stamp(cv, X0, Y0, [":", ":", ":", ":", ":"], 46, vy + 2);
    stamp(cv, X0, Y0, [":", ":", ":", ":", ":"], 46, vy + 8);
    // A breast pocket's line on our right, and the pockets' flaps at his hips.
    stamp(cv, X0, Y0, ["::::"], 46 + 4, sy + 9);
    stamp(cv, X0, Y0, ["-----"], 46 - b.waist + 1, b.waistY);
    stamp(cv, X0, Y0, ["_____"], 46 + b.waist - 5, b.waistY);
    // The shirt collar's two points over his collarbones.
    const cL = inPoly([[46 - neckW - 1.6, sy - 3.6], [46 + 0.4, sy + 0.8], [46 - 1.8, sy + 3.6], [46 - neckW - 2.6, sy + 1]]);
    const cR = inPoly([[46 + neckW + 1.6, sy - 3.6], [46 + neckW + 2.6, sy + 1], [46 + 1.8, sy + 3.6], [46 - 0.4, sy + 0.8]]);
    F(cL, (x, y) => (!cL(x + 1, y + 1) ? "r" : "t"));
    F(cR, (x, y) => (!cR(x - 1, y + 1) ? "q" : "s"));
  }
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}

/** The young man's tie: narrow, plain black with a thin sheen down its left edge, its tip under the jacket's button; `sway` swings its blade. */
function tie(sway: number): { part: Part; at: Pt } {
  const b = BODY.young;
  const X0 = 40;
  const Y0 = b.shoulderY - 6;
  const cv = canvas(14, b.waistY - Y0);
  const sy = b.shoulderY;
  const knot = inPoly([[44.4, sy - 3], [47.6, sy - 3], [47, sy + 0.6], [45, sy + 0.6]]);
  const blade = inPoly([[45.2, sy], [46.8, sy], [47.4 + sway * 0.3, sy + 9], [47.4 + sway * 0.5, sy + 14.5], [44.6 + sway * 0.5, sy + 14.5], [44.6 + sway * 0.3, sy + 9]]);
  fill(cv, X0, Y0, knot, (x) => (x > 46.4 ? "," : "`"));
  fill(cv, X0, Y0, blade, (x, y) => (!blade(x - 1, y) ? "`" : ","));
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
  young: { keys: SUIT, until: 1.82, cuff: "rst", cuffLen: 0.18 },
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
const TROUSERS: Record<Age, string> = { child: "Z%&", teen: "<>?$", young: SUIT };

/**
 * His hips and legs for an age; `toe`: one foot's heel lifted (the child scuffing his toe): `l` or `r`. `crouch`: his knees
 * bent (a landing's buckle): his hips that many pixels lower, his knees pushed out to the sides, his feet where they were.
 */
function legs(age: Age, splay = 0, crouch = 0): { part: Part; at: Pt } {
  const b = BODY[age];
  const X0 = Math.floor(46 - b.waist - 6);
  const Y0 = b.waistY - 4 + crouch;
  const cv = canvas(Math.ceil(2 * b.waist) + 14, 128 - Y0);
  const keys = TROUSERS[age];
  const w = b.waist;
  const c = crouch;
  const hips = inPoly([[46 - w - 0.4, b.waistY - 1 + c], [46 + w + 0.4, b.waistY - 1 + c], [46 + w + 1, b.hipY + 1 + c], [46 + w - 2, b.hipY + 4 + c], [46, b.hipY + 2 + c], [46 - w + 2, b.hipY + 4 + c], [46 - w - 1, b.hipY + 1 + c]]);
  fill(cv, X0, Y0, hips, (x, y) => ramp(keys, roundLight(46 - w * 0.4, b.waistY + c, w + 2, 8, 0.1)(x, y)));
  const hx = w * 0.55;
  const legPts = (side: -1 | 1): Pt[] => [[46 + side * hx, b.hipY + 1 + c], [46 + side * (hx + 0.2 + splay * 0.5 + c * 0.75), b.knee + c * 0.6], [46 + side * (hx + 0.3 + splay), 122]];
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
  stamp(cv, X0, Y0, [keys[0]!, keys[0]!, keys[0]!], 46, b.hipY + c);
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
const legsOf = (a: Age, splay: number, crouch = 0) => LEGS.get(`${a}:${splay}:${crouch}`) ?? LEGS.set(`${a}:${splay}:${crouch}`, legs(a, splay, crouch)).get(`${a}:${splay}:${crouch}`)!;
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
const legsName = (a: Age, splay: number, crouch = 0) => add(`legs:${a}:${splay}${crouch ? `:${crouch}` : ""}`, () => legsOf(a, splay, crouch).part);
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
  /** His knees bent (whole pixels): everything above his knees lower, his feet where they are (a landing's buckle). */
  crouch?: number;
}

export function ageLayers(age: Age, p: AgePose): Layer[] {
  const b = BODY[age];
  const at = (part: string, x: number, y: number, flipX = false): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y), ...(flipX ? { flipX } : {}) });
  const rise = p.rise ?? 0;
  const crouch = p.crouch ?? 0;
  const upY = -(p.breath ?? 0) - rise + crouch;
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
  const lg = legsOf(age, 0, crouch);
  const legLayer = at(legsName(age, 0, crouch), lg.at[0], lg.at[1] - rise);
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

// ---- His child form in a match (Nov 13; RECLUSE_CHILD): every age in one drawing, so his figure steps up in place.

const WHO: readonly Who[] = ["child", "teen", "young", "today"];
/**
 * The loop his figure rests in at each age (core childAge: 0 about 9, 1 about 13, 2 about 20, 3 his adult look, the adult form's
 * own idle): `idle` is the child's, so his figure is the child wherever nothing else is set.
 */
export const GROWING_LOOPS = ["idle", "age1", "age2", "age3"] as const;
/** The step up to age `to` (1 to 3) from the age before: one-shots, about 1.9 s each (growFrames). */
export const growAnim = (to: number): string => `grow${to}`;
/** Beaten in the child form: from age `from` (0 to 2) straight up to his adult look, the man the next match meets. */
export const growUpAnim = (from: number): string => `up${from}`;

/** The growing one-shots' frames, cut by `crop(age)` (a bust's window); a step's window is the older age's from its flash on. */
function growingAnims(crop: (w: Who) => (f: Frame) => Frame, todayIdle: () => Frame[]): Record<string, Anim> {
  const cut = (from: Who, to: Who) => () => {
    const frames = growFrames(from, to);
    const flash = frames.findIndex((f) => f.cue === "flash");
    return { loop: false, frames: frames.map((f, i) => crop(i < flash ? from : to)(f)) };
  };
  const anims: Record<string, Anim> = {};
  WHO.forEach((w, i) => {
    anims[GROWING_LOOPS[i]!] = lazyAnim(() => ({ loop: true, frames: w === "today" ? todayIdle() : idleFrames(w).map(crop(w)) }));
    if (i > 0) anims[growAnim(i)] = lazyAnim(cut(WHO[i - 1]!, w));
    if (i < 3) anims[growUpAnim(i)] = lazyAnim(cut(w, "today"));
  });
  return anims;
}

/** His figure in his child form: the child, 13, 20 and his adult look, each with its idle, and the steps up between them. */
export const RECLUSE_GROWING: Character = {
  id: "recluse-growing",
  name: "Hidden Boss (child form)",
  w: W,
  h: H,
  foot: [OX + 46, OY + 128],
  palette: AGES_PALETTE,
  halo: "#2a2733",
  parts: PARTS_ALL,
  anims: growingAnims(() => (f) => f, () => [...RECLUSE.anims.idle!.frames]),
};
/** The same in a phone's boss bar: each age's bust (its own window, as RECLUSE_BUST's for his adult look), the same animations. */
export const RECLUSE_GROWING_BUST: Character = {
  id: "recluse-growing-bust",
  name: "Hidden Boss (child form, bust)",
  w: BUST_W,
  h: BUST_H,
  foot: [46 - 21, BUST_H],
  palette: AGES_PALETTE,
  halo: "#2a2733",
  parts: PARTS_ALL,
  anims: growingAnims((w) => bustOf(TOPS[w]), () => [...RECLUSE_BUST.anims.idle!.frames]),
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
function ghostPart(ch: Character, f: Frame, feet: "dissolve" | "faint" = "dissolve"): { part: Part; at: Pt } {
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
      // (`faint`: the cutscene's child, who lands on the board: only his soles thin out, so his shoes still meet it.)
      const fade = feet === "faint" ? (y1 - y < 2 ? 1 : 0) : y1 - y < 4 ? 2 : y1 - y < 10 ? 1 : 0;
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
const kneeling = (eyes: Eyes, breath = 0, dip = 6, mouth: Mouth = "tight"): Layer[] =>
  recluseLayers({ stance: "kneel", dip, breath, face: { eyes, brows: "up", mouth }, hold: { book: "flat", at: [46, 125], loose: true, clutched: false, elbowR: [32, 58], wristR: [38, 78], elbowL: [60, 58], wristL: [55, 78] } });
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

// ---- The child on the floor, playing himself (the Hidden Boss's room, Nov 12: shops/recluse-scene.ts draws him by his board).

/** How far the sitting child is below the standing one: his hips on the floor, his legs crossed in front of him. */
const SIT_DROP = 22;
/** How far a lean forward (toward us, over the board) takes his shoulders and his head down. */
const LEAN_BODY = [0, 2, 5] as const;
const LEAN_HEAD = [0, 3, 8] as const;
/** The sitting child's pose: his lean over the board, the hand out on it (its arm is the scene's), his eyes and mouth. */
export interface SitPose {
  lean: 0 | 1 | 2;
  /** The hand out on the board: our left ("l") or our right ("r"); that arm isn't drawn here (the scene draws it reaching). */
  reach: "" | "l" | "r";
  eyes: "down" | "ahead" | "shut";
  mouth: "stern" | "smile";
}
export const SIT_POSES: readonly SitPose[] = [0, 1, 2].flatMap((lean) =>
  (["", "l", "r"] as const).flatMap((reach) => (["down", "ahead", "shut"] as const).flatMap((eyes) => (["stern", "smile"] as const).map((mouth) => ({ lean: lean as 0 | 1 | 2, reach, eyes, mouth })))),
);
export const sitName = (p: SitPose): string => `sit-${p.lean}-${p.reach || "n"}-${p.eyes}-${p.mouth}`;
/** His shoulder on that side in the drawing's frame pixels (the scene's reaching arm starts there), and his knee's (the hand's rest). */
export function sitShoulder(side: "l" | "r", lean: 0 | 1 | 2): Pt {
  const b = BODY.child;
  return [OX + 46 + (side === "l" ? -1 : 1) * (b.shoulder - 0.5), OY + b.shoulderY + 2 + SIT_DROP + LEAN_BODY[lean]];
}
export const sitKnee = (side: "l" | "r"): Pt => [OX + 46 + (side === "l" ? -1 : 1) * 12, OY + 121];
/** His crossed legs: each thigh out to its knee and the shin back in, the turned-up cuffs and a sneaker's sole showing. */
function lapPart(): { part: Part; at: Pt } {
  const X0 = 46 - 20;
  const Y0 = 112;
  const cv = canvas(40, 129 - Y0);
  for (const side of [-1, 1] as const) {
    const l = paintLimb([[46 + side * 3, 116], [46 + side * 12, 121], [46 - side * 5, 125]], 3, 2.6, TROUSERS.child, side < 0 ? 0.66 : 0.5);
    l.cv.forEach((row, y) => row.forEach((k, x) => k !== "." && cv[l.at[1] - Y0 + y]?.[l.at[0] - X0 + x] !== undefined && (cv[l.at[1] - Y0 + y]![l.at[0] - X0 + x] = k)));
  }
  // The cuffs and the soles where the shins cross: a light band, the sneakers' white rubber under them.
  stamp(cv, X0, Y0, ["Z=&", "=&="], 46 - 9, 124);
  stamp(cv, X0, Y0, ["&=Z", "=&="], 46 + 7, 124);
  stamp(cv, X0, Y0, ["tt", "rr"], 46 - 11, 126);
  stamp(cv, X0, Y0, ["tt", "rr"], 46 + 10, 126);
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}
const LAP = new Map<0, { part: Part; at: Pt }>();
const lapOf = () => LAP.get(0) ?? LAP.set(0, lapPart()).get(0)!;
add("lap:child", () => lapOf().part);
add("shadow:sit", () => shadow(40));
export function sitLayers(p: SitPose): Layer[] {
  const b = BODY.child;
  const at = (part: string, x: number, y: number, flipX = false): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y), ...(flipX ? { flipX } : {}) });
  const D = SIT_DROP;
  const lb = LEAN_BODY[p.lean];
  const layers: Layer[] = [at("shadow:sit", 46 - 20, 126)];
  const lap = lapOf();
  layers.push(at("lap:child", lap.at[0], lap.at[1]));
  const t = torsoOf("child");
  layers.push(at("torso:child", t.at[0], t.at[1] + D + lb));
  layers.push(at(headName("child", { eyes: p.eyes, brows: p.eyes === "ahead" ? "up" : "stern", mouth: p.mouth }), HEAD_X, b.top + D + LEAN_HEAD[p.lean]));
  // His hands on his knees (the one out on the board is the scene's).
  for (const side of [-1, 1] as const) {
    if ((side < 0 && p.reach === "l") || (side > 0 && p.reach === "r")) continue;
    const sh: Pt = [46 + side * b.shoulder, b.shoulderY + 1 + D + lb];
    const wr: Pt = [46 + side * 11, 117];
    const el: Pt = [46 + side * (b.shoulder + 3.5), (sh[1] + wr[1]) / 2 + 1];
    const arm = armPart("child", sh, el, wr);
    layers.push(at(arm.name, arm.at[0], arm.at[1]));
    const hw = HANDS.child.rest[0]!.length;
    layers.push(at("hand:child:rest", side > 0 ? wr[0] - 3 : wr[0] - (hw - 3), wr[1] - 1, side < 0));
  }
  return layers;
}
// ---- On his feet and round the board (Nov 13, Eric: "he'll have to literally like lean onto the board and move a piece. And then he
// like gets up and walks to the other side and places it"): standing and walking facing us or from behind, kneeling up (half way up
// or down), and kneeling back on his heels from behind at White's side of his board, leaning in to play.

/** The back of his head: the same head, all hair (swept the other way, as from behind), the ears, the nape under it. */
function kidHeadBack(): Part {
  const s = HEAD.child;
  const cv = headBase("child");
  const light = roundLight(CX + 5, 1, 13, 16, 0.25);
  const nape = s.rows - 4;
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < HW; x++) {
      const k = cv[y]![x]!;
      if (k === ".") continue;
      const hw = halfWidth(s, Math.max(y, 2));
      const ear = y >= s.eye && y < s.eye + 4 && Math.abs(x - CX) > hw;
      if (ear) continue;
      if (y >= nape) {
        // The nape: his neck under the hair's edge, narrower; shaded on our left (the light is behind him now).
        cv[y]![x] = Math.abs(x - CX) > hw - 2 ? "." : x < CX - 1 ? "c" : "b";
        continue;
      }
      // Clumps running down from the crown, darker in the grooves and at the edges.
      const groove = (x * 0.7 + y * 0.35) % 3 < 0.8;
      cv[y]![x] = ramp("HhjJ", light(x, y) - (groove ? 0.22 : 0) - (Math.abs(x - CX) > hw - 1 ? 0.15 : 0) - (y > nape - 3 ? 0.12 : 0));
    }
  return { grid: toGrid(cv.map((r) => [...r].reverse())) };
}
/** A sneaker from behind: its heel, the white rubber under it. */
const SHOE_BACK = ["..###..", ".#####.", "#######", "ttttttt", "rrrrrrr"];
/** His legs kneeling upright (thighs straight down to his knees on the floor): from the front, or from behind with his soles showing. */
function kneelLegs(view: "f" | "b", drop: number): { part: Part; at: Pt } {
  const b = BODY.child;
  const X0 = 46 - 14;
  const Y0 = b.waistY - 4 + drop;
  const cv = canvas(28, 129 - Y0);
  const w = b.waist;
  const keys = TROUSERS.child;
  const top = b.waistY + drop;
  fill(cv, X0, Y0, inPoly([[46 - w - 0.4, top - 1], [46 + w + 0.4, top - 1], [46 + w + 1, top + 4], [46 - w - 1, top + 4]]), (x, y) => ramp(keys, roundLight(46 - w * 0.4, top, w + 2, 8, 0.1)(x, y)));
  for (const side of [-1, 1] as const) {
    const l = paintLimb([[46 + side * w * 0.55, top + 3], [46 + side * (w * 0.55 + 0.4), 125]], b.rLeg, b.rLeg - 0.3, keys, side < 0 ? 0.66 : 0.48);
    l.cv.forEach((row, y) => row.forEach((k, x) => k !== "." && cv[l.at[1] - Y0 + y]?.[l.at[0] - X0 + x] !== undefined && (cv[l.at[1] - Y0 + y]![l.at[0] - X0 + x] = k)));
  }
  if (view === "b") {
    // The soles behind his knees, toes on the floor.
    stamp(cv, X0, Y0, ["#tt#", "rrrr"], 46 - 9, 125);
    stamp(cv, X0, Y0, ["#tt#", "rrrr"], 46 + 6, 125);
  } else stamp(cv, X0, Y0, ["Z".repeat(15)], 46 - 7, 125);
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}
/** Kneeling back on his heels, seen from behind: the seat of his dungarees on his heels, the two soles under it. */
function heelsPart(): { part: Part; at: Pt } {
  const X0 = 46 - 13;
  const Y0 = 106;
  const cv = canvas(26, 129 - Y0);
  fill(cv, X0, Y0, inEllipse(46, 116, 10.5, 8), (x, y) => ramp(TROUSERS.child, roundLight(50, 110, 12, 10, 0.12)(x, y)));
  stamp(cv, X0, Y0, ["Z".repeat(1)], 46, 110);
  stamp(cv, X0, Y0, ["Z", "Z", "Z", "Z"], 46, 113);
  stamp(cv, X0, Y0, [".#tt#", "#ttt#", "rrrrr"], 46 - 9, 123);
  stamp(cv, X0, Y0, ["#tt#.", "#ttt#", "rrrrr"], 46 + 4, 123);
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}
add("head:child:back", kidHeadBack);
add("shoe:child:back", () => ({ grid: SHOE_BACK }));
const KNEEL = new Map<string, { part: Part; at: Pt }>();
const kneelOf = (v: "f" | "b") => KNEEL.get(v) ?? KNEEL.set(v, kneelLegs(v, KNEEL_UP)).get(v)!;
const heelsOf = () => KNEEL.get("heels") ?? KNEEL.set("heels", heelsPart()).get("heels")!;
add("kneel:child:f", () => kneelOf("f").part);
add("kneel:child:b", () => kneelOf("b").part);
add("heels:child", () => heelsOf().part);

/** How far kneeling upright drops him (his thighs straight down, knees on the floor). */
const KNEEL_UP = 15;
/** Leaning in from his heels: his shoulders and head down (away from us), and toward the side he plays on. */
const HEELS_BODY = [0, 1, 2] as const;
const HEELS_HEAD = [0, 2, 4] as const;
const HEELS_SIDE = [0, 1, 2] as const;

/** On his feet or his knees: facing us (`f`) or from behind (`b`); standing (a walk step 0 to 3, or none), kneeling up, or back on his heels (behind only). */
export interface PlayPose {
  view: "f" | "b";
  stance: "stand" | "up" | "heels";
  /** Walking: the step (0 to 3); -1 standing still. */
  step: -1 | 0 | 1 | 2 | 3;
  /** On his heels: how far he leans in, and to which side (our left or right), whose arm is out (the scene draws it). */
  lean: 0 | 1 | 2;
  side: "" | "l" | "r";
}
export const PLAY_POSES: readonly PlayPose[] = [
  ...(["f", "b"] as const).flatMap((view) => ([-1, 0, 1, 2, 3] as const).map((step): PlayPose => ({ view, stance: "stand", step, lean: 0, side: "" }))),
  ...(["f", "b"] as const).map((view): PlayPose => ({ view, stance: "up", step: -1, lean: 0, side: "" })),
  ...([0, 1, 2] as const).flatMap((lean) => (["", "l", "r"] as const).map((side): PlayPose => ({ view: "b", stance: "heels", step: -1, lean, side }))),
];
export const playName = (p: PlayPose): string => `play-${p.view}-${p.stance}-${p.step < 0 ? "n" : p.step}-${p.lean}-${p.side || "n"}`;
/** What his upper body sits on: how far down from standing, and sideways. */
function playDrop(p: PlayPose): { drop: number; head: number; sx: number } {
  if (p.stance === "up") return { drop: KNEEL_UP, head: 0, sx: 0 };
  if (p.stance === "heels") {
    const dir = p.side === "l" ? -1 : p.side === "r" ? 1 : 0;
    return { drop: SIT_DROP + HEELS_BODY[p.lean], head: HEELS_HEAD[p.lean] - HEELS_BODY[p.lean], sx: dir * HEELS_SIDE[p.lean] };
  }
  return { drop: p.step === 1 || p.step === 3 ? -1 : 0, head: 0, sx: 0 };
}
/** His shoulder on that side (our left or right) in the drawing's frame pixels: the scene's reaching arm starts there. */
export function playShoulder(p: PlayPose, side: "l" | "r"): Pt {
  const b = BODY.child;
  const d = playDrop(p);
  return [OX + 46 + d.sx + (side === "l" ? -1 : 1) * (b.shoulder - 0.5), OY + b.shoulderY + 2 + d.drop];
}
/** Where a hand rests by his side on his heels (the reach starts and ends there). */
export const heelsHand = (side: "l" | "r"): Pt => [OX + 46 + (side === "l" ? -1 : 1) * 9, OY + 116];
export function playLayers(p: PlayPose): Layer[] {
  const b = BODY.child;
  const at = (part: string, x: number, y: number, flipX = false): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y), ...(flipX ? { flipX } : {}) });
  if (p.view === "f" && p.stance === "stand") {
    // Facing us: today's standing drawing, walking a step at a time (a heel up, a bob, the arms swinging a little).
    const s = p.step;
    return ageLayers("child", {
      rise: s === 1 || s === 3 ? 1 : 0,
      toe: s === 0 ? "l" : s === 2 ? "r" : undefined,
      handL: s === 0 ? [0, -1] : s === 2 ? [0, 1] : [0, 0],
      handR: s === 2 ? [0, -1] : s === 0 ? [0, 1] : [0, 0],
      face: { eyes: "down" },
    });
  }
  const d = playDrop(p);
  const layers: Layer[] = [at(p.stance === "heels" ? "shadow:sit" : "shadow:child", 46 - (p.stance === "heels" ? 20 : 12), 126)];
  if (p.stance === "stand") {
    // From behind: the heels of his sneakers (one lifted as he walks), his legs, as standing.
    const lift = (s: "l" | "r") => (p.step === 0 && s === "l") || (p.step === 2 && s === "r") ? 1 : 0;
    const ax = b.waist * 0.55 + 0.3;
    layers.push(at("shoe:child:back", 46 - ax - 4, 128 - 5 - lift("l") - (d.drop < 0 ? 1 : 0)), at("shoe:child:back", 46 + ax - 3, 128 - 5 - lift("r") - (d.drop < 0 ? 1 : 0)));
    const lg = legsOf("child", 0);
    layers.push(at(legsName("child", 0), lg.at[0], lg.at[1] + d.drop));
  } else if (p.stance === "up") {
    const k = kneelOf(p.view);
    layers.push(at(`kneel:child:${p.view}`, k.at[0], k.at[1]));
  } else {
    const h = heelsOf();
    layers.push(at("heels:child", h.at[0], h.at[1]));
  }
  const t = torsoOf("child");
  layers.push(at("torso:child", t.at[0] + d.sx, t.at[1] + d.drop));
  const head = p.view === "f" ? headName("child", { eyes: "down", brows: "stern", mouth: "stern" }) : "head:child:back";
  // (From behind his head is drawn under his arms, as from the front; on his heels, leaning in, it dips toward the board.)
  layers.push(at(head, HEAD_X + d.sx * 1.5, b.top + d.drop + d.head));
  for (const side of [-1, 1] as const) {
    if ((side < 0 && p.side === "l") || (side > 0 && p.side === "r")) continue;
    const sh: Pt = [46 + d.sx + side * b.shoulder, b.shoulderY + 1 + d.drop];
    const swing = p.stance === "stand" && p.step >= 0 ? ((p.step === 0) === (side < 0) ? -1 : p.step === 2 ? 1 : 0) : 0;
    const wr: Pt = p.stance === "heels" ? [46 + side * 9, 116] : [46 + d.sx + side * (b.shoulder + b.armOut + 0.6), b.wristY + d.drop + swing];
    const el: Pt = p.stance === "heels" ? [46 + d.sx + side * (b.shoulder + 2.5), (sh[1] + wr[1]) / 2] : [46 + d.sx + side * (b.shoulder + b.armOut), b.elbowY + d.drop + swing * 0.4];
    const arm = armPart("child", sh, el, wr);
    layers.push(at(arm.name, arm.at[0], arm.at[1]));
    const hw = HANDS.child.rest[0]!.length;
    layers.push(at("hand:child:rest", side > 0 ? wr[0] - 3 : wr[0] - (hw - 3), wr[1] - 1, side < 0));
  }
  return layers;
}

// ---- From the side (Nov 13, round 3; Eric: "the board should be left and right so you can see him walk on left and right and still
// see the board when he plays, and he should be centered on each side when he plays moves, have him lean in more over the board so the
// arm stretch isn't as obvious"). The board's sides are now left and right of it, so he's seen side on: kneeling back on his heels,
// up on his knees leaning in over the board (five depths, and a dip toward us for the near files), standing, crouching, and a 4-step
// walk. Drawn facing our right; the scene mirrors him for the board's other side. His near arm, out over the board, is the scene's.
// Every part painted from the body's points (a hip, a knee, an ankle, a shoulder, the neck), so a lean is just new angles.

/** How far he leans in, each level: his thighs tipped forward from his knees, his back from upright (degrees), his head bowed. */
export const SIDE_LEANS: readonly { thigh: number; back: number; head: number }[] = [
  { thigh: 0, back: 10, head: 14 },
  { thigh: -4, back: 28, head: 16 },
  { thigh: 2, back: 44, head: 20 },
  { thigh: 10, back: 58, head: 23 },
  { thigh: 18, back: 69, head: 25 },
  { thigh: 26, back: 78, head: 27 },
];
/** A dip toward us (his near shoulder lower, for the board's near files): drawing pixels down, each level. */
const SIDE_DIP = [0, 5, 10, 15] as const;
export interface SidePose {
  /** Back on his heels, up on his knees (leaning), standing or walking, or crouched half way between. */
  stance: "heels" | "knees" | "stand" | "crouch";
  /** Walking (standing): the step, 0 to 3; -1 still. */
  step: -1 | 0 | 1 | 2 | 3;
  /** On his knees: how far in (SIDE_LEANS; 0 is back on his heels). */
  lean: 0 | 1 | 2 | 3 | 4 | 5;
  dip: 0 | 1 | 2 | 3;
  /** His near arm out over the board (the scene draws it); otherwise his hand rests on his thigh. */
  reach: boolean;
  eyes: "down" | "ahead" | "shut";
  mouth: "stern" | "smile";
}
export const sideName = (p: SidePose): string => `side-${p.stance}-${p.step < 0 ? "n" : p.step}-${p.lean}-${p.dip}-${p.reach ? "r" : "n"}-${p.eyes}-${p.mouth}`;
const deg = (d: number) => (d * Math.PI) / 180;
/** His points for a pose (drawing space, facing our right): hip, the two knees and ankles (near, far), shoulder, the neck's top. */
function sideBody(p: SidePose): { hip: Pt; knee: [Pt, Pt]; ankle: [Pt, Pt]; sh: Pt; neck: Pt; head: number; up: number } {
  const TORSO_LEN = 25;
  const NECK = 6;
  if (p.stance === "stand") {
    // Walking: each leg's knee and ankle by the step (0: near foot forward; 2: far foot forward; 1 and 3: passing, the body up a pixel).
    const s = p.step;
    const up = s === 1 || s === 3 ? 1 : 0;
    const hip: Pt = [46, 97 - up];
    const fwd = (lead: boolean): { k: Pt; a: Pt } =>
      s < 0 ? { k: [46.5, 111], a: [46, 124] } : s === 1 || s === 3 ? (lead === (s === 1) ? { k: [48.5, 110], a: [44, 121] } : { k: [46.5, 111 - up], a: [46, 124] }) : lead ? { k: [49, 110], a: [51, 124] } : { k: [44, 111], a: [40.5, 123] };
    const n = fwd(s === 0 || s === 3);
    const f = fwd(s === 2 || s === 1);
    const lean = s < 0 ? 2 : 5;
    const sh: Pt = [hip[0] + TORSO_LEN * Math.sin(deg(lean)), hip[1] - TORSO_LEN * Math.cos(deg(lean))];
    return { hip, knee: [n.k, f.k], ankle: [n.a, f.a], sh, neck: [sh[0] + NECK * Math.sin(deg(lean)), sh[1] - NECK], head: 4, up };
  }
  if (p.stance === "crouch") {
    // Half way between standing and his heels: knees bent forward, his weight over his feet, a lean.
    const hip: Pt = [42, 111];
    const sh: Pt = [hip[0] + TORSO_LEN * Math.sin(deg(24)), hip[1] - TORSO_LEN * Math.cos(deg(24))];
    return { hip, knee: [[54, 113], [53, 112]], ankle: [[45, 125], [44, 125]], sh, neck: [sh[0] + NECK * Math.sin(deg(24)), sh[1] - NECK * Math.cos(deg(24))], head: 16, up: 0 };
  }
  const L = SIDE_LEANS[p.stance === "heels" ? 0 : p.lean]!;
  const knee: Pt = [54, 124];
  // Back on his heels: his seat on his heels, the thighs forward along the floor to his knees; up on his knees: the thighs up from them.
  const hip: Pt = p.stance === "heels" ? [41, 119] : [knee[0] + 14 * Math.sin(deg(L.thigh)), knee[1] - 14 * Math.cos(deg(L.thigh))];
  const dip = SIDE_DIP[p.dip];
  const sh: Pt = [hip[0] + TORSO_LEN * Math.sin(deg(L.back)), hip[1] - TORSO_LEN * Math.cos(deg(L.back)) + dip];
  // (His neck bends up out of a deep lean, so he looks at the board, not into it.)
  const nb = deg(L.back * 0.55 + 4);
  const neck: Pt = [sh[0] + NECK * Math.sin(nb), sh[1] - NECK * Math.cos(nb)];
  return { hip, knee: [knee, [knee[0] - 1, knee[1] - 1]], ankle: [[40, 126], [39, 125]], sh, neck, head: L.head + dip * 1.2, up: 0 };
}
/** His near shoulder in the frame's pixels (facing our right): the scene's arm starts there. */
export function sideShoulder(p: SidePose): Pt {
  const b = sideBody(p);
  return [OX_S + b.sh[0] + 1, OY + b.sh[1] + 1];
}
/** Where his near hand rests in the frame's pixels (on his thigh by the knee): a reach starts and ends there. */
export function sideRest(p: SidePose): Pt {
  const b = sideBody(p);
  const k = b.knee[0];
  if (p.stance === "knees" && p.lean >= 2) {
    // (Leaning in, his arm hangs under his shoulder, the hand just over the floor.)
    return [OX_S + b.sh[0] + 3, OY + Math.min(124, b.sh[1] + 20)];
  }
  return [OX_S + (b.hip[0] + k[0]) / 2 + 3, OY + (b.hip[1] + k[1]) / 2 - 3];
}

/** The head side on, facing our right, bowed `tilt` degrees: painted from its shapes (skull, jaw, nose, ear, hair), the features stamped. */
function sideHead(tilt: number, eyes: SidePose["eyes"], mouth: SidePose["mouth"]): { part: Part; at: Pt } {
  // (Its own space: the skull's middle at the origin, the face toward +u. A box round it, then each pixel's middle turned back into it.)
  const R = 15;
  const cv = canvas(2 * R, 2 * R);
  const a = deg(tilt);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const local = (x: number, y: number): Pt => {
    const dx = x + 0.5 - R;
    const dy = y + 0.5 - R;
    return [dx * ca + dy * sa, -dx * sa + dy * ca];
  };
  const toPx = (u: number, v: number): Pt => [R + u * ca - v * sa, R + u * sa + v * ca];
  const inE = (u: number, v: number, cu: number, cv0: number, ru: number, rv: number) => ((u - cu) / ru) ** 2 + ((v - cv0) / rv) ** 2 <= 1;
  const skull = (u: number, v: number) => inE(u, v, -1, -2, 9, 9.5);
  const face = (u: number, v: number) => u > -2.5 && (inE(u, v, 2.6, 3.6, 6.4, 6.8) || inE(u, v, 4.4, 7.4, 3.9, 2.9));
  const nose = (u: number, v: number) => u >= 7 && v >= -0.5 && v <= 4.6 && u <= 7.4 + (v + 0.5) * 0.62 && !(v > 3.6 && u > 9.4);
  const neck = (u: number, v: number) => u >= -3.6 && u <= 1.8 && v >= 6 && v <= 13;
  const ear = (u: number, v: number) => inE(u, v, -1.4, 2.2, 1.9, 2.6);
  const hairBottom = (u: number) => (u >= 2.6 ? -4.2 : u >= 0.9 ? 0.8 : u >= -3.4 ? -0.9 : 6);
  const hair = (u: number, v: number) => (inE(u, v, -1.4, -2.7, 9.9, 10.2) && v < hairBottom(u) && (u < 7.6 || v < -5.4)) || inE(u, v, 6.4, -6.2, 3.1, 2);
  for (let y = 0; y < 2 * R; y++)
    for (let x = 0; x < 2 * R; x++) {
      const [u, v] = local(x, y);
      const sx = x + 0.5 - R;
      const sy = y + 0.5 - R;
      const l = 0.6 - 0.42 * (sx / 10) - 0.45 * (sy / 11);
      if (hair(u, v)) {
        // (Clumps swept back from his brow, darker in the grooves and at the edges.)
        const groove = (u * 0.55 - v * 0.8 + 30) % 3 < 0.85;
        cv[y]![x] = ramp("HhjJ", l + 0.05 - (groove ? 0.24 : 0) - (inE(u, v, -1.4, -2.7, 8.6, 9) ? 0 : 0.12));
      } else if (ear(u, v) && !face(u, v)) cv[y]![x] = inE(u, v, -1.2, 2.3, 0.9, 1.4) ? "a" : ramp("bcd", l);
      else if (skull(u, v) || face(u, v) || nose(u, v)) cv[y]![x] = ramp("abcde", l + 0.08 + (nose(u, v) && u > 8 ? 0.1 : 0) - (v > 7 && u < 4 ? 0.15 : 0));
      else if (neck(u, v)) cv[y]![x] = ramp("abc", l - 0.05);
    }
  // The features, each at its place turned with the head (stamped upright: a pixel's eye can't be turned).
  const put = (rows: readonly string[], u: number, v: number) => {
    const [x, y] = toPx(u, v);
    stamp(cv, 0, 0, rows, Math.round(x), Math.round(y));
  };
  put(["HHHH"], 4.2, -2.6);
  put(eyes === "shut" ? ["bb", "xx"] : eyes === "down" ? ["bb", "wx"] : ["wx", "wx"], 5, -0.5);
  put(mouth === "smile" ? ["m..", ".mm"] : ["mm"], mouth === "smile" ? 6.6 : 7.6, mouth === "smile" ? 5.6 : 6.6);
  // (The nostril.)
  put(["b"], 8.6, 3.4);
  // Where it joins his neck: the neck's top (0, 11) of its own space.
  const [jx, jy] = toPx(-0.9, 11);
  return { part: { grid: toGrid(cv) }, at: [-jx, -jy] };
}
/** His torso side on, from his hip to his neck: the dungarees' waist, then the striped tee across it, a sleeve's cap at the shoulder. */
function sideTorso(hip: Pt, sh: Pt): { part: Part; at: Pt } {
  const len = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]);
  const ax = (sh[0] - hip[0]) / len;
  const ay = (sh[1] - hip[1]) / len;
  const box = boxOf([hip, sh], 8);
  const cv = canvas(box.w, box.h);
  for (let y = 0; y < box.h; y++)
    for (let x = 0; x < box.w; x++) {
      const px = box.x0 + x + 0.5 - hip[0];
      const py = box.y0 + y + 0.5 - hip[1];
      const t = px * ax + py * ay;
      // (Across: + toward his front, his chest; the back flatter.)
      const d = -px * ay + py * ax;
      const front = -d;
      if (t < -1.5 || t > len + 3) continue;
      const half = t < 5 ? 4.8 : t < len - 4 ? 5.1 + 0.7 * Math.sin(((t - 5) / (len - 9)) * Math.PI) : 4.9 - Math.max(0, t - len) * 0.9;
      const off = t > 9 && t < len - 3 ? 0.6 : 0;
      if (Math.abs(front - off) > half) continue;
      const l = 0.6 - 0.45 * (front > 0 ? -0.2 : 0.3) * (Math.abs(front) / half) - 0.3 * ((y + box.y0 - (hip[1] + sh[1]) / 2) / 14) - 0.25 * (Math.abs(front - off) / half) ** 2;
      if (t < 3) cv[y]![x] = ramp(TROUSERS.child, l - 0.05);
      else {
        const red = Math.floor((len - t) / 2) % 2 === 1;
        cv[y]![x] = l > 0.46 ? (red ? "R" : "I") : red ? "P" : "S";
      }
    }
  return { part: { grid: toGrid(cv) }, at: [box.x0, box.y0] };
}
/** A leg side on: the thigh and shin in dungarees, the cuff turned up, the sneaker (toe forward; on his knees, the sole up behind). */
function sideLeg(hip: Pt, knee: Pt, ankle: Pt, kneeling: boolean, near: boolean): { part: Part; at: Pt } {
  const box = boxOf([hip, knee, ankle], 9);
  const cv = canvas(box.w, box.h);
  const l = paintLimb([hip, knee, ankle], 2.9, 2.3, TROUSERS.child, near ? 0.62 : 0.46);
  l.cv.forEach((row, y) => row.forEach((k, x) => k !== "." && cv[l.at[1] - box.y0 + y]?.[l.at[0] - box.x0 + x] !== undefined && (cv[l.at[1] - box.y0 + y]![l.at[0] - box.x0 + x] = k)));
  const ax = Math.round(ankle[0]);
  const ay = Math.round(ankle[1]);
  if (kneeling) {
    // The foot lying on its top behind him: the canvas, its white toe cap on the floor, the sole up at the back.
    stamp(cv, box.x0, box.y0, ["r###", "rt##", "rrtt"], ax - 6, ay - 2);
  } else {
    // The cuff, then the sneaker, toe forward.
    stamp(cv, box.x0, box.y0, ["Z=&=", "&=&="], ax - 2, ay - 4);
    stamp(cv, box.x0, box.y0, ["..##...", ".######", "######t", "rrrrrrr"], ax - 2, Math.min(ay, 124));
  }
  return { part: { grid: toGrid(cv) }, at: [box.x0, box.y0] };
}
const SIDE = new Map<string, { part: Part; at: Pt }>();
const sidePart = (name: string, make: () => { part: Part; at: Pt }): { name: string; at: Pt } => {
  const n = add(name, () => (SIDE.get(name) ?? SIDE.set(name, make()).get(name)!).part);
  return { name: n, at: (SIDE.get(name) ?? SIDE.set(name, make()).get(name)!).at };
};
const key = (...pts: Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(";");
/** The frame for his side poses: wider (he leans out over the board ahead of him), his foot at x 36. */
const OX_S = -10;
const W_S = 124;
add("shadow:side", () => shadow(30));
export function sideLayers(p: SidePose): Layer[] {
  const b = sideBody(p);
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX_S + Math.round(x), y: OY + Math.round(y) });
  const kneeling = p.stance === "heels" || p.stance === "knees";
  const layers: Layer[] = [at("shadow:side", 46 - 15 + (kneeling ? 1 : 0), 126)];
  const leg = (i: 0 | 1) => sidePart(`sleg:${key(b.hip, b.knee[i], b.ankle[i])}:${kneeling ? 1 : 0}:${i}`, () => sideLeg(b.hip, b.knee[i], b.ankle[i], kneeling, i === 0));
  const arm = (sh: Pt, el: Pt, wr: Pt) => armPart("child", sh, el, wr);
  const hand = (wr: Pt, flex: boolean) => {
    const hw = HANDS.child.rest[0]!.length;
    return at(`hand:child:${flex ? "flex" : "rest"}`, wr[0] - (hw - 3), wr[1] - 1);
  };
  // His far arm (behind him): swinging as he walks, on his far thigh, or leaning in, under his chest, the hand on the floor.
  const swing = p.stance === "stand" && p.step >= 0 ? (p.step === 0 ? 1 : p.step === 2 ? -1 : 0) : 0;
  const farSh: Pt = [b.sh[0] - 1, b.sh[1] - 1];
  let farWr: Pt;
  let farEl: Pt;
  if (p.stance === "knees" && p.lean >= 2) {
    farWr = [farSh[0] - 1, Math.min(124, farSh[1] + 21)];
    farEl = [farSh[0] - 4, (farSh[1] + farWr[1]) / 2];
  } else if (kneeling || p.stance === "crouch") {
    farWr = [(b.hip[0] + b.knee[1][0]) / 2 + 2, (b.hip[1] + b.knee[1][1]) / 2 - 4];
    farEl = [farSh[0] - 2, (farSh[1] + farWr[1]) / 2 + 1];
  } else {
    farWr = [farSh[0] + swing * 4, farSh[1] + 23];
    farEl = [farSh[0] + swing * 2 - 1, farSh[1] + 12];
  }
  const fa = arm(farSh, farEl, farWr);
  layers.push(at(fa.name, fa.at[0], fa.at[1]), hand(farWr, true));
  const fl = leg(1);
  layers.push(at(fl.name, fl.at[0], fl.at[1]));
  const nl = leg(0);
  layers.push(at(nl.name, nl.at[0], nl.at[1]));
  const t = sidePart(`storso:${key(b.hip, b.sh)}`, () => sideTorso(b.hip, b.sh));
  layers.push(at(t.name, t.at[0], t.at[1]));
  const tilt = Math.round(b.head / 2) * 2;
  const h = sidePart(`shead:${tilt}:${p.eyes}:${p.mouth}`, () => sideHead(tilt, p.eyes, p.mouth));
  layers.push(at(h.name, b.neck[0] + h.at[0], b.neck[1] + h.at[1]));
  if (!p.reach) {
    // His near arm: swinging as he walks, or the hand on his thigh (or hanging under him, leaning in).
    const rest = sideRest(p);
    const wr: Pt = p.stance === "stand" ? [b.sh[0] - swing * 4, b.sh[1] + 23] : [rest[0] - OX_S, rest[1] - OY];
    const el: Pt = p.stance === "stand" ? [b.sh[0] - swing * 2 + 0.5, b.sh[1] + 12] : [Math.min(b.sh[0], wr[0]) - 2.5, (b.sh[1] + wr[1]) / 2 + 1];
    const na = arm(b.sh, el, wr);
    layers.push(at(na.name, na.at[0], na.at[1]), hand(wr, p.stance !== "stand"));
  }
  return layers;
}
const SIDE_FACES = [
  ["down", "stern"],
  ["ahead", "stern"],
  ["shut", "stern"],
  ["ahead", "smile"],
  ["down", "smile"],
] as const;
export const SIDE_POSES: readonly SidePose[] = [
  ...([-1, 0, 1, 2, 3] as const).map((step): SidePose => ({ stance: "stand", step, lean: 0, dip: 0, reach: false, eyes: "down", mouth: "stern" })),
  { stance: "crouch", step: -1, lean: 0, dip: 0, reach: false, eyes: "down", mouth: "stern" },
  ...SIDE_FACES.map(([eyes, mouth]): SidePose => ({ stance: "heels", step: -1, lean: 0, dip: 0, reach: false, eyes, mouth })),
  ...([1, 2, 3, 4, 5] as const).flatMap((lean) =>
    ([0, 1, 2, 3] as const).flatMap((dip) => ([false, true] as const).map((reach): SidePose => ({ stance: "knees", step: -1, lean, dip, reach, eyes: "down", mouth: "stern" }))),
  ),
];
/** The child side on: every pose the scene draws him in (one frame each, cue `pose`), and an idle (thinking on his heels, a blink). */
export const RECLUSE_CHILD_SIDE: Character = {
  id: "recluse-child-side",
  name: "Hidden Boss age 9, side on",
  w: W_S,
  h: H,
  foot: [OX_S + 46, OY + 128],
  palette: AGES_PALETTE,
  halo: "#2a2733",
  parts: PARTS_ALL,
  anims: {
    idle: lazyAnim(() => ({ loop: true, frames: Array.from({ length: 10 }, (_, i): Frame => ({ ms: 220, layers: sideLayers({ stance: "heels", step: -1, lean: 0, dip: 0, reach: false, eyes: i === 6 ? "shut" : "down", mouth: "stern" }) })) })),
    ...Object.fromEntries(SIDE_POSES.map((p) => [sideName(p), lazyAnim(() => ({ loop: false, frames: [{ ms: 1000, cue: "pose", layers: sideLayers(p) }] }))])),
  },
};

/** Thinking over the board (his idle when nothing's played): eyes down, a blink, a glance up. */
const SIT_IDLE = (): Frame[] =>
  Array.from({ length: 12 }, (_, i): Frame => ({ ms: 200, layers: sitLayers({ lean: 1, reach: "", eyes: i === 5 ? "shut" : i >= 8 && i < 10 ? "ahead" : "down", mouth: "stern" }) }));
/** The child sitting on the floor: every pose the scene draws him in (one frame each, cue `pose`), and his idle. */
export const RECLUSE_CHILD_SIT: Character = {
  id: "recluse-child-sit",
  name: "Hidden Boss age 9, on the floor",
  w: W,
  h: H,
  foot: [OX + 46, OY + 128],
  palette: AGES_PALETTE,
  halo: "#2a2733",
  parts: PARTS_ALL,
  anims: {
    idle: lazyAnim(() => ({ loop: true, frames: SIT_IDLE() })),
    ...Object.fromEntries(SIT_POSES.map((p) => [sitName(p), lazyAnim(() => ({ loop: false, frames: [{ ms: 1000, cue: "pose", layers: sitLayers(p) }] }))])),
    ...Object.fromEntries(PLAY_POSES.map((p) => [playName(p), lazyAnim(() => ({ loop: false, frames: [{ ms: 1000, cue: "pose", layers: playLayers(p) }] }))])),
  },
};

// ---- The cutscene (a mockup, Nov 12): the ghost child poofs into being above the board, drops, lands, his knees buckle,
// he straightens, and the two talk; then he fades out. One drawing for both, so they line up to the pixel.

/** How far above the ground the child appears (drawing pixels: about a foot and a half at his size, 82 px tall). */
const LIFT = 38;
// (Four more rows under the ground: the ghost's glow at his soles as he lands.)
const CUT_H = H + LIFT + 4;
/** The poof's sparkle: white to pale blue, keys of its own, so the ghost's fade-in doesn't dim it. */
const POOF_PALETTE: Record<string, string> = { Y: "#f4fbff", A: "#bfe2ff", C: "#7fb0e6" };
/** The growing step's motes (`shimmer`: gold `8` to ember `0`) in the poof's colors. */
const TO_POOF: Record<string, string> = { "8": "Y", "9": "A", "0": "C" };
const { parts: CUT_PARTS, add: addCut } = lazyParts();
const CUT_GHOSTS = new Map<string, { part: Part; at: Pt }>();
/** The child as the ghost in pose `p`, `air` pixels above the ground. */
function cutKid(p: AgePose, air = 0): Layer {
  const name = `cg:${JSON.stringify(p)}`;
  let g = CUT_GHOSTS.get(name);
  if (!g) CUT_GHOSTS.set(name, (g = ghostPart(RECLUSE_CHILD, frame("child", 0, p), "faint")));
  const made = g;
  addCut(name, () => made.part);
  return { part: name, x: GHOST_DX + g.at[0], y: LIFT + g.at[1] - air };
}
/** Today's sprite on his knees (as in the ghost loop), moved down below the child's air. */
const kneelAt = (eyes: Eyes, breath = 0, dip = 6, mouth: Mouth = "tight"): Layer[] => kneeling(eyes, breath, dip, mouth).map((l) => ({ ...l, y: l.y + LIFT }));
const inScene = ([x, y]: Speck) => x >= 1 && y >= 1 && x <= SCENE_W - 2 && y <= CUT_H - 2;
/** The child's middle (x) and the ground under him (y), in the scene. */
const KID_X = GHOST_DX + OX + 46;
const GROUND = LIFT + OY + 128;
/** The poof: a ring of sparkle bursting out from the child's middle, step `i` (0 small and white, then wider and bluer). */
function burst(i: number, air: number): Speck[] {
  const cy = GROUND - air - 42;
  const r = 3 + i * 7;
  const key = i < 2 ? "Y" : i < 4 ? "A" : "C";
  const out: Speck[] = [];
  // (The first: a bright star at the middle, its four arms three pixels long.)
  if (i === 0) for (let d = -3; d <= 3; d++) out.push([KID_X + d, cy, "Y"], [KID_X, cy + d, "Y"]);
  for (let k = 0; k < 16; k++) {
    if (i >= 4 && k % 2) continue;
    const a = (k / 16) * Math.PI * 2 + i * 0.13;
    const X = Math.round(KID_X + Math.cos(a) * r);
    const Y = Math.round(cy + Math.sin(a) * r * 1.15);
    out.push([X, Y, key]);
    if (i < 3 && k % 3 === 0) out.push([X - 1, Y, key], [X + 1, Y, key], [X, Y - 1, key], [X, Y + 1, key]);
  }
  return out.filter(inScene);
}
/** The growing step's rising motes around the child, in the poof's colors, `air` pixels up. */
const kidMotes = (i: number, air: number, n = 12): Speck[] => shimmer(BODY.child.top, i, n).map(([x, y, k]): Speck => [x + GHOST_DX, y + LIFT - air, TO_POOF[k] ?? k]).filter(inScene);
/** The dust of his landing: a puff of sparkle out to each side of his shoes, step `i`. */
const landPuff = (i: number): Speck[] =>
  [-1, 1]
    .flatMap((side) => [0, 1, 2].map((k): Speck => [KID_X + side * (9 + i * 3 + k * 2), GROUND - 1 - k - (i > 1 ? 1 : 0), i < 2 ? "Y" : "A"]))
    .filter(inScene);
const ARMS_UP: AgePose = { handL: [-3, -7], handR: [3, -7], face: { eyes: "ahead", brows: "up", mouth: "o" } };

/**
 * The poof (one-shot, about 0.9 s, cue `poof`): a small white flash in the air beside him, a ring of sparkle bursting out
 * as the child fades in inside it (the growing step's motes rising round him), and he hangs there a moment, startled.
 * The man hasn't looked up yet.
 */
const CUT_POOF = (): Frame[] => [
  { ms: 70, layers: kneelAt("down"), specks: burst(0, LIFT), cue: "poof" },
  ...[0.15, 0.3, 0.5, 0.7, 0.85, 1].map(
    (a, i): Frame => ({ ms: 90, layers: [...kneelAt(i < 3 ? "down" : "readR", 0, i < 3 ? 6 : 5), cutKid(ARMS_UP, LIFT)], specks: [...burst(i + 1, LIFT), ...kidMotes(i, LIFT, 8 + i)], pal: faded(a) }),
  ),
  ...[0, 1, 0].map((b, i): Frame => ({ ms: 90, layers: [...kneelAt("readR", 0, 4), cutKid(ARMS_UP, LIFT + b)], specks: kidMotes(6 + i, LIFT, 8 - i * 2) })),
];
/** The drop (one-shot, 0.36 s, cue `drop`): he falls, arms up, faster each frame (gravity), from `LIFT` to the ground. */
const CUT_DROP = (): Frame[] =>
  Array.from({ length: 9 }, (_, k): Frame => {
    const air = Math.round(LIFT * (1 - ((k + 1) / 9) ** 2));
    return { ms: 40, layers: [...kneelAt("readR", 0, 4), cutKid({ ...ARMS_UP, handL: [-3, -8], handR: [3, -8] }, air)], ...(k < 3 ? { specks: kidMotes(9 + k, LIFT, 6 - k * 2) } : {}), ...(k === 0 ? { cue: "drop" } : {}) };
  });
/**
 * The landing (one-shot, about 1.1 s, cue `land`): his knees buckle under him (he fell from thin air), his arms fly out,
 * a puff of sparkle at his shoes; he wobbles, then straightens up, a little bounce, his arms back down, and looks at the man.
 */
const CUT_LAND = (): Frame[] => {
  const steps: { ms: number; crouch: number; arms: number; headDy?: number; rise?: number; mouth?: KidFace["mouth"]; brows?: Brows }[] = [
    { ms: 50, crouch: 4, arms: 6 },
    { ms: 80, crouch: 6, arms: 7, headDy: 1 },
    { ms: 140, crouch: 6, arms: 6, headDy: 1 },
    { ms: 90, crouch: 5, arms: 4 },
    { ms: 90, crouch: 4, arms: 3 },
    { ms: 90, crouch: 3, arms: 2, mouth: "stern" },
    { ms: 90, crouch: 2, arms: 1, mouth: "stern" },
    { ms: 90, crouch: 1, arms: 1, mouth: "stern" },
    { ms: 110, crouch: 0, arms: 0, rise: 1, mouth: "stern", brows: "stern" },
    { ms: 280, crouch: 0, arms: 0, mouth: "stern", brows: "stern" },
  ];
  return steps.map((s, i): Frame => {
    const p: AgePose = { crouch: s.crouch, rise: s.rise, headDy: s.headDy, handL: [-s.arms, -s.arms], handR: [s.arms, -s.arms], face: { eyes: i < 8 ? "ahead" : "readL", brows: s.brows ?? "up", mouth: s.mouth ?? "o" } };
    return { ms: s.ms, layers: [...kneelAt("readR", 0, i < 2 ? 5 : 4), cutKid(p)], ...(i < 4 ? { specks: landPuff(i) } : {}), ...(i === 0 ? { cue: "land" } : {}) };
  });
};
/** The child's pose in the conversation: his idle (CHILD_IDLE), his eyes on the man except his blinks, his mouth `mouth`. */
const kidTalkPose = (i: number, mouth?: KidFace["mouth"]): AgePose => {
  const s = CHILD_IDLE[i % CHILD_IDLE.length]!.p;
  return { ...s, toe: undefined, face: { ...s.face, eyes: s.face?.eyes === "shut" ? "shut" : "readL", mouth: mouth ?? s.face?.mouth ?? "stern" } };
};
/** The man's eyes in the conversation: on the child, dropping to the floor now and then. */
const manEyes = (i: number): Eyes => (i >= 26 && i < 33 ? "down" : "readR");
/** Mouths while a line types (a word, a word, a gap), the child's and the man's. */
const KID_FLAP: readonly KidFace["mouth"][] = ["o", "stern", "open", "stern", "o", "tight"];
const MAN_FLAP: readonly Mouth[] = ["mumble1", "mumble2", "tight", "mumble3", "mumble1", "tight"];
/**
 * The conversation's loops (about 4.3 s): the man kneels, slumped, breathing slowly, looking up at the child; the child
 * stands on the board, pale and see-through in his soft glow, fidgeting as a child does; motes drift up off him and his
 * glow breathes. `talk`: whose mouth moves (while his line types).
 */
const CUT_TALK = (talk: "kid" | "man" | null): Frame[] =>
  Array.from({ length: 36 }, (_, i): Frame => {
    const eyes = talk === "man" ? (i % 12 < 9 ? "readR" : "down") : manEyes(i);
    return {
      ms: 120,
      layers: [...kneelAt(eyes, i >= 6 && i < 20 ? 1 : 0, eyes === "down" ? 6 : 4, talk === "man" ? MAN_FLAP[i % MAN_FLAP.length] : "tight"), cutKid(kidTalkPose(i, talk === "kid" ? KID_FLAP[i % KID_FLAP.length] : undefined))],
      specks: motes(i).map(([x, y, k]): Speck => [x, y + LIFT, k]).filter(inScene),
      pal: pulse(i),
    };
  });
/** He fades out (one-shot, about 1.4 s, cue `fade`), looking at the man to the last; the man is left alone. */
const CUT_FADE = (): Frame[] =>
  [1, 0.85, 0.7, 0.55, 0.4, 0.28, 0.16, 0.06]
    .map((a, i): Frame => ({ ms: 160, layers: [...kneelAt("readR", 0, 4), cutKid(kidTalkPose(0))], specks: a > 0.5 ? motes(i).map(([x, y, k]): Speck => [x, y + LIFT, k]).filter(inScene) : [], pal: faded(a), ...(i === 0 ? { cue: "fade" } : {}) }))
    .concat([{ ms: 160, layers: kneelAt("readR", 0, 4) }]);
/** The man alone on his knees (a loop, 3.8 s): before the child comes, and after (`after`: still looking where he stood). */
const CUT_ALONE = (after: boolean): Frame[] =>
  Array.from({ length: 16 }, (_, i): Frame => ({ ms: 240, layers: kneelAt(after ? (i < 12 ? "readR" : "down") : i === 9 ? "shut" : "down", i >= 4 && i < 11 ? 1 : 0, after && i < 12 ? 4 : 6) }));

/**
 * The cutscene's figures (a mockup): today's sprite on his knees, and room above and beside him for the ghost child's
 * arrival. Its loops and one-shots, played by `components/RecluseCutscene.tsx` on the times in `RECLUSE_CUTSCENE`.
 */
export const RECLUSE_CUTSCENE: Character = {
  id: "recluse-cutscene",
  name: "Hidden Boss cutscene",
  w: SCENE_W,
  h: CUT_H,
  foot: [OX + 46, GROUND],
  palette: { ...AGES_PALETTE, ...GHOST_PALETTE, ...POOF_PALETTE },
  halo: "#2a2733",
  parts: joinParts(CUT_PARTS, RECLUSE.parts),
  anims: {
    idle: lazyAnim(() => ({ loop: true, frames: CUT_ALONE(false) })),
    poof: lazyAnim(() => ({ loop: false, frames: CUT_POOF() })),
    drop: lazyAnim(() => ({ loop: false, frames: CUT_DROP() })),
    land: lazyAnim(() => ({ loop: false, frames: CUT_LAND() })),
    together: lazyAnim(() => ({ loop: true, frames: CUT_TALK(null) })),
    kidTalk: lazyAnim(() => ({ loop: true, frames: CUT_TALK("kid") })),
    manTalk: lazyAnim(() => ({ loop: true, frames: CUT_TALK("man") })),
    fade: lazyAnim(() => ({ loop: false, frames: CUT_FADE() })),
    alone: lazyAnim(() => ({ loop: true, frames: CUT_ALONE(true) })),
  },
};
/** Where things are in the cutscene's drawing, for its text boxes: each one's middle (x) and the top of his head (y). */
export const CUTSCENE_SPOTS = { kid: { x: KID_X, head: GROUND - 82 }, man: { x: OX + 46, head: GROUND - 64 } } as const;

/** Everything this mockup draws, for the preview and the tests; none of it is in CHARACTERS or any kit. */
export const RECLUSE_AGES_PREVIEW: readonly Character[] = [RECLUSE_GROWING, RECLUSE_GROWING_BUST, RECLUSE_CHILD, RECLUSE_TEEN, RECLUSE_YOUNG, RECLUSE_CHILD_BUST, RECLUSE_TEEN_BUST, RECLUSE_YOUNG_BUST, RECLUSE_GROW, RECLUSE_GHOST, RECLUSE_CHILD_SIT, RECLUSE_CHILD_SIDE, RECLUSE_CUTSCENE];
