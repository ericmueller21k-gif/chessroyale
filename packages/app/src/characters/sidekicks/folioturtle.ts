/**
 * Folio's shopkeeper (id "sidekick-folio-turtle"), who keeps the shop in the Folded House (out/house-shop-folio): an old,
 * slow, kind origami turtle folded from the same handwritten paper as Folio (its palette, characters/folio.ts). Its shell is
 * faceted (a middle plate and a ring of folded facets, crisp creases, faint blue-black cursive on the lit faces, gilt along
 * its rim); it has a tiny stack of folded pages on its back, tied with a vermilion thread, and small round gilt spectacles.
 * No name: its card reads "Shopkeeper". It isn't a town bot. About the size of the other kids. Three-quarters, facing our
 * right, light from the top left.
 *
 * Rigging: every part is painted from a pose (the body's bob, the head's offset and lift, each leg's hip and foot, the
 * lids, the spectacles' glint, the pages' corner), each part its own outlined layer, back to front; made once per pose.
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/sidekick-folio-turtle/sidekick-folio-turtle.ts at e7e08bcf, Nov 5), its imports moved (the sheet's key `folioturtle`: it can't have a hyphen). The
 * notes: scripts/boss-art/out/shop-folio-nov5.md and intro-folio-nov5.md on that branch.
 */
import type { Anim, Character, Frame, Layer, Part } from "../sprite.ts";
import { PAPER_PALETTE, cv, face, get, inPoly, line, paragraph, put, stamp, type Cv, type Pt } from "../../town/shops/paper-kit.ts";
import { lazyAnim } from "../sprite.ts";

const W = 64;
const H = 64;
const GROUND = 59;

const PARTS: Record<string, Part> = {};
const AT = new Map<string, Pt>();
/** A part painted on a frame-sized canvas, cropped, made once by name. */
function painted(name: string, paint: (c: Cv) => void, outline = true): { name: string; at: Pt } {
  let at = AT.get(name);
  if (!at) {
    const c = cv(W, H);
    paint(c);
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1;
    let y1 = -1;
    c.forEach((row, y) =>
      row.forEach((k, x) => {
        if (k === ".") return;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }),
    );
    if (x1 < 0) {
      PARTS[name] = { grid: ["."], outline: false };
      at = [0, 0];
    } else {
      PARTS[name] = { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline };
      at = [x0, y0];
    }
    AT.set(name, at);
  }
  return { name, at };
}
const add = (p: Pt, d: Pt): Pt => [p[0] + d[0], p[1] + d[1]];

// ---- The parts.

/** A leg: a folded stub from its hip (wide, under the shell's rim) to its foot (a flat toe on the ground): lit outer face, shaded inner face, a crease, a toe. */
function leg(c: Cv, hip: Pt, foot: Pt, far: boolean, toeDir = 1) {
  const [lit, mid, dk] = far ? ["C", "D", "E"] : ["B", "C", "D"];
  const w0 = 4.2;
  const w1 = 3.2;
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const len = Math.hypot(dx, dy) || 1;
  const n: Pt = [-dy / len, dx / len];
  const a: Pt = [hip[0] + n[0] * w0, hip[1] + n[1] * w0];
  const b: Pt = [hip[0] - n[0] * w0, hip[1] - n[1] * w0];
  const cc: Pt = [foot[0] - n[0] * w1, foot[1] - n[1] * w1];
  const d: Pt = [foot[0] + n[0] * w1, foot[1] + n[1] * w1];
  // Two faces split along the leg's middle: the one toward the light lit.
  const m0: Pt = hip;
  const m1: Pt = foot;
  const litFirst = n[0] < 0 || (n[0] === 0 && n[1] < 0);
  face(c, [a, m0, m1, d], litFirst ? mid : lit, { hi: litFirst ? undefined : "A" });
  face(c, [m0, b, cc, m1], litFirst ? lit : mid, { hi: litFirst ? "A" : undefined, lo: dk });
  // The toe: a little flat fold on the ground, pointing the way it walks (or up, waving).
  const tx = foot[0] + toeDir * 2;
  face(c, [[foot[0] - 2, foot[1] - 1], [tx + 2 * toeDir, foot[1]], [foot[0] - 2, foot[1] + 1]], dk);
}

/** The shell's outline (a dome seen from the side), its middle plate, and their facets. */
const SHELL: Pt[] = [[11, 52], [13, 44], [18, 37], [26, 33], [34, 32], [42, 34], [47, 39], [50, 46], [51, 52]];
const APEX: Pt = [31, 42];
function shellPaint(c: Cv, by: number) {
  const O = SHELL.map((p) => add(p, [0, by]));
  const ap = add(APEX, [0, by]);
  const inner = O.map(([x, y]) => [ap[0] + (x - ap[0]) * 0.5, ap[1] + (y - ap[1]) * 0.55] as Pt);
  // The ring of facets between the outline and the plate: each faces a way; the light comes from the top left.
  for (let i = 0; i < O.length - 1; i++) {
    const q: Pt[] = [O[i]!, O[i + 1]!, inner[i + 1]!, inner[i]!];
    const mx = (O[i]![0] + O[i + 1]![0]) / 2 - ap[0];
    const my = (O[i]![1] + O[i + 1]![1]) / 2 - ap[1];
    const lightness = (-mx * 0.6 - my * 1.0) / Math.hypot(mx, my);
    const k = lightness > 0.55 ? "A" : lightness > 0.1 ? "B" : lightness > -0.4 ? "C" : "D";
    face(c, q, k);
  }
  // The plate's underside edge (the shell's bottom between its ends) is the rim.
  face(c, [O[0]!, inner[0]!, inner[inner.length - 1]!, O[O.length - 1]!], "C");
  // The middle plate: lit, a short paragraph of cursive on it.
  face(c, inner, "B", { hi: "A", lo: "C" });
  const ins = inPoly(inner);
  paragraph(c, Math.round(inner[1]![0]) + 2, Math.round(inner[6]![0]) - 1, Math.round(ap[1]) - 2, 3, 3, "i", 17, (x, y) => ins(x, y) && get(c, x, y) === "B");
  // Creases: from the plate's corners to the outline's.
  for (let i = 1; i < O.length - 1; i++) line(c, inner[i]![0], inner[i]![1], O[i]![0], O[i]![1], "D");
  // Cursive on the lit facets too.
  for (let i = 1; i < 4; i++) {
    const m = [(O[i]![0] + inner[i]![0] + O[i + 1]![0] + inner[i + 1]![0]) / 4, (O[i]![1] + inner[i]![1] + O[i + 1]![1] + inner[i + 1]![1]) / 4];
    for (let x = -2; x <= 2; x++) if ((x + i) % 3 !== 0 && get(c, m[0]! + x, m[1]! + (x % 2)) === "A") put(c, m[0]! + x, m[1]! + (x % 2), "K");
  }
  // The rim: a band under the dome, its edge gilt.
  for (let x = 11; x <= 51; x++) {
    put(c, x, 52 + by, x < 13 || x > 49 ? "D" : "C");
    put(c, x, 53 + by, "D");
    if (x > 12 && x < 50) put(c, x, 51 + by, (x * 7) % 23 === 0 ? "H" : "G");
  }
}
/** The tiny stack of folded pages on its back, tied with a vermilion thread; `lift` turns up the top page's corner. */
function pagesPaint(c: Cv, by: number, lift: number) {
  const y = 28 + by;
  face(c, [[25, y + 4], [37, y + 3], [38, y + 6], [26, y + 7]], "B", { lo: "C" });
  face(c, [[26, y + 2], [37, y + 1], [37, y + 4], [26, y + 5]], "A", { lo: "C" });
  face(c, [[25, y], [36, y - 1], [37, y + 2], [25, y + 3]], "A", { lo: "b" });
  if (lift) face(c, [[33, y - 1], [36, y - 1 - lift], [37, y + 1]], "F");
  line(c, 27, y + 1, 33, y, "i");
  line(c, 31, y - 1, 31, y + 7, "v");
  put(c, 31, y + 2, "w");
}
/** The neck and head: a folded wedge, pointed to our right, its top lit; small round gilt spectacles; an old, kind eye. */
function headPaint(c: Cv, hx: number, hy: number, eye: "open" | "blink" | "smile", glint: number) {
  const nb: Pt[] = [[45, 44], [49, 51]];
  const h0: Pt = [48 + hx, 40 + hy];
  // The neck: from under the shell's front to the head, two faces.
  face(c, [nb[0]!, [h0[0] + 1, h0[1] + 1], [h0[0] + 2, h0[1] + 6], nb[1]!], "C", { lo: "D" });
  line(c, nb[0]![0], nb[0]![1] + 1, h0[0] + 1, h0[1] + 3, "B");
  // The head: a long wedge, its top face lit, its jaw face mid, a crease between; the snout's tip at the right.
  const top: Pt[] = [[h0[0], h0[1] + 1], [h0[0] + 3, h0[1] - 4], [h0[0] + 10, h0[1] - 4], [h0[0] + 15, h0[1] + 1], [h0[0] + 1, h0[1] + 4]];
  const jaw: Pt[] = [[h0[0] + 1, h0[1] + 4], [h0[0] + 15, h0[1] + 1], [h0[0] + 12, h0[1] + 6], [h0[0] + 2, h0[1] + 8]];
  face(c, top, "B", { hi: "A" });
  face(c, jaw, "C", { lo: "D" });
  line(c, h0[0] + 2, h0[1] + 4, h0[0] + 14, h0[1] + 1, "D");
  // The mouth: a soft upturned line along the jaw (a kind face).
  put(c, h0[0] + 11, h0[1] + 4, "D");
  put(c, h0[0] + 12, h0[1] + 3, "D");
  put(c, h0[0] + 13, h0[1] + 3, "D");
  // The eye, inside its spectacle: open (a dot under a heavy lid), a blink (a line), a smile (an arc).
  const ex = h0[0] + 8;
  const ey = h0[1] - 1;
  stamp(c, ex - 2, ey - 2, [".ooo.", "o...o", "o...o", ".ooo."]);
  line(c, ex - 3, ey - 1, ex - 6, ey - 1, "g"); // the arm, back to the ear
  if (eye === "open") {
    put(c, ex, ey, "T");
    put(c, ex - 1, ey, "T");
    put(c, ex - 1, ey - 1, "D");
    put(c, ex, ey - 1, "D");
  } else if (eye === "blink") {
    put(c, ex - 1, ey, "D");
    put(c, ex, ey, "D");
  } else {
    put(c, ex - 1, ey, "T");
    put(c, ex, ey - 1, "T");
    put(c, ex + 1, ey, "T");
  }
  // The glint on the glass (it slides across now and then).
  if (glint >= 0) put(c, ex - 1 + glint, ey - 1, "H");
  put(c, ex + 1, ey - 1, "A");
}

interface Pose {
  /** The body's bob (px down). */
  by: number;
  /** The head's offset from rest. */
  hx: number;
  hy: number;
  eye: "open" | "blink" | "smile";
  /** The spectacles' glint: -1 none, 0 to 2 across the glass. */
  glint: number;
  /** Each foot (near front, near back, far front, far back), and the near front's hip when it waves. */
  nf: Pt;
  nb: Pt;
  ff: Pt;
  fb: Pt;
  wave?: Pt;
  /** The top page's corner lifting (0, 1, 2). */
  page: number;
  /** Sitting: tucked down on its plastron. */
  sit?: boolean;
}
const REST: Pose = { by: 0, hx: 0, hy: 0, eye: "open", glint: -1, nf: [47, GROUND], nb: [15, GROUND], ff: [50, GROUND - 1], fb: [20, GROUND - 1], page: 0 };
const k2 = (p: Pt) => `${p[0]},${p[1]}`;

function layers(p: Pose): Layer[] {
  const by = p.by + (p.sit ? 4 : 0);
  const L: Layer[] = [];
  const at = (s: { name: string; at: Pt }): Layer => ({ part: s.name, x: s.at[0], y: s.at[1] });
  const sh = painted(`shadow:${p.sit ? 1 : 0}`, (c) => {
    for (let y = GROUND - 2; y <= GROUND + 2; y++)
      for (let x = 8; x <= 58; x++) {
        const d = ((x + 0.5 - 33) / 25) ** 2 + ((y + 0.5 - GROUND) / 2.6) ** 2;
        if (d <= 1) put(c, x, y, d < 0.5 ? "-" : "+");
      }
  }, false);
  L.push(at(sh));
  // The far legs (behind, in shade), the hips under the rim.
  const hipY = 51 + by;
  L.push(at(painted(`fb:${k2(p.fb)}:${by}`, (c) => leg(c, [22, hipY - 1], p.fb, true))));
  L.push(at(painted(`ff:${k2(p.ff)}:${by}`, (c) => leg(c, [46, hipY - 1], p.ff, true))));
  // The tail: a small folded point at the back.
  L.push(at(painted(`tail:${by}`, (c) => face(c, [[12, 49 + by], [5, 53 + by], [13, 53 + by]], "C", { hi: "B", lo: "D" }))));
  L.push(at(painted(`shell:${by}`, (c) => shellPaint(c, by))));
  L.push(at(painted(`pages:${by}:${p.page}`, (c) => pagesPaint(c, by, p.page))));
  L.push(at(painted(`nb:${k2(p.nb)}:${by}`, (c) => leg(c, [18, hipY], p.nb, false, -1))));
  L.push(at(painted(`head:${p.hx},${p.hy + by}:${p.eye}:${p.glint}`, (c) => headPaint(c, p.hx, p.hy + by, p.eye, p.glint))));
  if (p.wave) L.push(at(painted(`wave:${k2(p.wave)}:${by}`, (c) => leg(c, [44, hipY - 1], p.wave!, false, 1))));
  else L.push(at(painted(`nf:${k2(p.nf)}:${by}`, (c) => leg(c, [44, hipY], p.nf, false))));
  return L;
}
const frame = (ms: number, p: Partial<Pose>, more: Partial<Frame> = {}): Frame => ({ ms, layers: layers({ ...REST, ...p }), ...more });

// ---- The animations.

/** Idle (loop, 12 x 200 ms): slow breaths (the shell rises a pixel and settles), the head nods once, a slow blink, the spectacles glint, the top page's corner lifts in a draught. */
const idle: Anim = lazyAnim(() => ({
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    frame(200, {
      by: i >= 3 && i <= 6 ? -1 : 0,
      hy: i === 7 || i === 8 ? 1 : 0,
      hx: i === 7 || i === 8 ? 1 : 0,
      eye: i === 10 ? "blink" : "open",
      glint: i >= 2 && i <= 4 ? i - 2 : -1,
      page: i === 5 ? 1 : i === 6 ? 2 : i === 7 ? 1 : 0,
    }),
  ),
}));

/** Walk (loop, 8 x 150 ms, slow): legs in diagonal pairs (near front with far back), each lifting and reaching; the body sways a pixel; the head bobs forward with each step. */
const WALK: readonly Partial<Pose>[] = [
  { nf: [50, GROUND], fb: [22, GROUND - 1], nb: [13, GROUND], ff: [48, GROUND - 1], by: 0, hx: 1 },
  { nf: [49, GROUND - 2], fb: [21, GROUND - 3], nb: [14, GROUND], ff: [49, GROUND - 1], by: -1, hx: 1 },
  { nf: [47, GROUND - 2], fb: [19, GROUND - 3], nb: [15, GROUND], ff: [51, GROUND - 1], by: -1, hx: 0 },
  { nf: [46, GROUND], fb: [18, GROUND - 1], nb: [17, GROUND], ff: [52, GROUND - 1], by: 0, hx: 0 },
  { nf: [46, GROUND], fb: [18, GROUND - 1], nb: [18, GROUND - 2], ff: [51, GROUND - 3], by: 0, hx: 1 },
  { nf: [47, GROUND], fb: [19, GROUND - 1], nb: [17, GROUND - 2], ff: [50, GROUND - 3], by: -1, hx: 1 },
  { nf: [48, GROUND], fb: [20, GROUND - 1], nb: [15, GROUND - 2], ff: [49, GROUND - 3], by: -1, hx: 0 },
  { nf: [49, GROUND], fb: [21, GROUND - 1], nb: [14, GROUND], ff: [48, GROUND - 1], by: 0, hx: 0 },
];
const walk: Anim = lazyAnim(() => ({ loop: true, frames: WALK.map((p, i) => frame(150, p, i === 0 || i === 4 ? { cue: "step" } : {})) }));

/** Sit (loop, 10 x 240 ms; at a table): settled down on its plastron, legs tucked as stubs, head raised to the board; it breathes, peers over its spectacles (a glint), nods, blinks. */
const SIT: Partial<Pose> = { sit: true, nf: [49, GROUND], nb: [13, GROUND], ff: [52, GROUND - 1], fb: [18, GROUND - 1] };
const sit: Anim = lazyAnim(() => ({
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) =>
    frame(240, {
      ...SIT,
      hy: i === 5 || i === 6 ? -2 : i === 8 ? 0 : -1,
      hx: i === 5 || i === 6 ? 1 : 0,
      by: i >= 2 && i <= 3 ? -1 : 0,
      eye: i === 8 ? "blink" : "open",
      glint: i === 5 ? 0 : i === 6 ? 1 : -1,
    }),
  ),
}));

/** Wave (once, 10 frames, about 1.9 s): it lifts its near front leg, slowly, and waves it twice, smiling, then sets it down. */
const WAVES: readonly Pt[] = [[50, 56], [52, 50], [53, 44], [50, 42], [55, 44], [50, 42], [55, 44], [52, 51]];
const wave: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    ...WAVES.map((w, i) => frame(i === 0 ? 220 : 170, { wave: w, eye: i === 0 ? "open" : "smile", hy: -1, hx: 1, glint: i === 2 ? 1 : -1, by: i % 2 ? -1 : 0 })),
    frame(200, { eye: "smile", hy: -1 }),
    frame(300, { eye: "open" }),
  ],
}));

export const sidekickFolioTurtle: Character = {
  id: "sidekick-folio-turtle",
  name: "Shopkeeper",
  w: W,
  h: H,
  foot: [33, GROUND],
  palette: PAPER_PALETTE,
  halo: "#3b3530",
  parts: PARTS,
  anims: { idle, walk, sit, wave },
};
