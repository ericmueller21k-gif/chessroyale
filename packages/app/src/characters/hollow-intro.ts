/**
 * Hollow's moves for his battle intro (BOSS_HOLLOW_INTRO, id `hollow-intro`), copied as drawn from the art branch `claude/boss-art`
 * (scripts/boss-art/out/boss-hollow/boss-hollow.ts at 3238dbf4, Nov 3; the notes are scripts/boss-art/out/intro-hollow-nov3.md on that
 * branch; Eric approved the intro Nov 3). Only the imports changed: his rig is hollow.ts's (left as it is). A file of its own so the
 * town doesn't build these frames: it loads only when you challenge him (shops/intro.ts, through shops/hollow-intro-art.ts).
 *
 * The art's own header follows.
 *
 * Hollow's battle intro moves (BOSS_HOLLOW_INTRO, id `hollow-intro`; Eric, Nov 3): the darkness ball in his belly powers up
 * and drinks the cave's light. His own drawing is the game's (packages/app/src/characters/hollow.ts, HOLLOW: there is no
 * runner copy of him), so this file adds nothing to it: it builds the new poses from his own rig (`hollowBuild`, the same
 * limbs, head, ruff, band, strand) and adds one new part kind, the ball (`ball:<size>:<phase>:<mode>`), drawn where his
 * void is. Every part he already has is read from HOLLOW.parts, so his old frames are untouched.
 *
 * Same frame as HOLLOW: 104 x 102, foot [50, 96], drawn facing front, light from the top left. His heart (the ball's middle)
 * is at [50, 65] standing, one lower for each pixel of crouch (HOLLOW_INTRO_HEART per frame below).
 *
 * - `charge` (loops): he crouches, his free claw cupped by the ball, and the ball powers up: dark material spirals in from
 *   all round and builds up on it, a ring of it spins round the ball, and the ball is a little bigger than his void
 *   (radius 7 to 7.5; his void is 5.5). Cue `hum` on f0 (each loop: the hum building).
 * - `swell` (once): the ball swells to its drinking size (8 to 10), with a pulse and a judder. Cue `swell` f0.
 * - `drink` (loops): braced wide, claws out low and open, roaring, he shakes with the pull; the ball (10 to 10.5) has a
 *   bright violet edge where the light pours in, warm flecks of it sparking on its rim. Silent: the lights' own cues sound.
 * - `full` (loops): every light gone, he stands up straight in the dark, eyes narrowed to slits; the ball at its biggest
 *   (11 to 11.5), nearly black, throbbing slowly. Cue `hum` f0 (a deep hum, once a loop).
 * - `settle` (once): the ball sinks back into his belly to his own void and he stands for the fight: his idle's first
 *   frame last. Cue `settle` f0.
 * - `idle`: standing (his idle's first frame), for code that needs a still.
 * His own bulbs: lit in every frame, as his idle. Code puts them out with his looks (HOLLOW_LOOKS `bulbs2`, `bulbs1`,
 * `bulbs0`) as the drain reaches him (see the notes, intro-hollow-nov3.md).
 */
import { HOLLOW, HOLLOW_LOOKS, hollowBuild, type HollowPose } from "./hollow.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

type Pt = readonly [number, number];

/** His own palette, and the warm flecks of light landing on the ball as it drinks. */
const IPAL: Record<string, string> = {
  ...HOLLOW.palette,
  a: "#ffcf6a", // light landing on the ball: warm, its hot core
  b: "#fff3c4",
};

/** His eyes flaring, and the void hot (his own, hollow.ts EYES_HOT and VOID_HOT). */
const EYES_HOT = { e: "#fff1a8", E: "#ffffff" };
const VOID_HOT = { u: "#7a4fd0", U: "#c4a2ff", V: "#432470" };
/** The ball nearly black as it hums, full: the violet sunk low. */
const FULL_PAL = { u: "#4a2c86", U: "#8a62e0", V: "#24123f" };

const { parts, add } = lazyParts();
/** One of his own parts, by its name (made by his rig on first use). */
const own = (name: string) => add(name, () => HOLLOW.parts[name]!);

// ---- The ball: his void grown, `R` its radius (the black core inside, spiral arms of violet round it), a tilted ring of
// gathered darkness spinning round it, chunks riding the ring. One canvas size for every size, centred on his heart.

const BW = 48;
const BH = 40;
const BC: Pt = [24, 20];
type Mode = "charge" | "drink" | "full";
function ball(R: number, phase: number, mode: Mode): Part {
  const cv: string[][] = Array.from({ length: BH }, () => Array<string>(BW).fill("."));
  const put = (x: number, y: number, k: string) => {
    if (x >= 0 && y >= 0 && x < BW && y < BH) cv[y]![x] = k;
  };
  const [cx, cy] = BC;
  const core = R * 0.62;
  const turn = (phase / 8) * Math.PI * 2;
  const ringR = R + 5;
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * 1.12;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      // The ring: an ellipse round the ball, its back half hidden behind it.
      const ex = dx / ringR;
      const ey = (y + 0.5 - cy) / (ringR * 0.3);
      const ringD = Math.abs(Math.hypot(ex, ey) - 1);
      if (r <= core) put(x, y, r <= core - 1.4 ? "o" : "O");
      else if (r <= R) {
        // Two spiral arms turning, tighter as the ball grows; the outermost pixel its edge.
        const arm = Math.sin(2 * (a - turn) + r * (6.4 / R));
        const edge = r > R - 1;
        if (mode === "full") put(x, y, edge ? (Math.cos(a * 2 - turn) > 0.2 ? "u" : "V") : arm > 0.7 ? "V" : "O");
        else if (mode === "drink") put(x, y, edge ? (Math.cos(a * 3 + turn) > -0.3 ? "U" : "u") : arm > 0.5 ? "u" : arm > -0.2 ? "V" : "O");
        else put(x, y, edge ? "u" : arm > 0.55 ? "U" : arm > -0.15 ? "V" : "O");
      } else if (ringD < (mode === "full" ? 0.07 : mode === "charge" ? 0.13 : 0.09) && (y + 0.5 > cy || r > R + 2)) {
        const lit = Math.cos(a * 3 - turn * 2);
        put(x, y, mode === "full" ? (lit > 0.6 ? "u" : "V") : lit > 0.3 ? "U" : lit > -0.4 ? "u" : "V");
      }
    }
  // Chunks of darkness riding the ring (in front of the ball on its near half), glints between them.
  const chunks = mode === "full" ? 3 : 5;
  for (let i = 0; i < chunks; i++) {
    const a = turn * 1.5 + (i * 2 * Math.PI) / chunks;
    const px = Math.round(cx - 0.5 + Math.cos(a) * ringR);
    const py = Math.round(cy - 0.5 + Math.sin(a) * ringR * 0.3);
    const behind = Math.sin(a) < 0 && Math.abs(Math.cos(a) * ringR) < R;
    if (behind) continue;
    put(px, py, i % 2 ? "V" : "v");
    put(px + (Math.cos(a) > 0 ? -1 : 1), py, "u");
    if (mode !== "full" && i % 2 === 0) put(px, py - 1, "V");
  }
  for (let i = 0; i < 2; i++) {
    const a = -turn * 1.2 + i * Math.PI + 0.6;
    const px = Math.round(cx - 0.5 + Math.cos(a) * ringR);
    const py = Math.round(cy - 0.5 + Math.sin(a) * ringR * 0.3);
    if (Math.sin(a) < 0 && Math.abs(Math.cos(a) * ringR) < R) continue;
    put(px, py, mode === "full" ? "U" : "x");
  }
  return { grid: cv.map((r) => r.join("")), outline: false };
}
const ballPart = (R: number, phase: number, mode: Mode) => {
  const p = ((Math.round(phase) % 8) + 8) % 8;
  return add(`ball:${R}:${p}:${mode}`, () => ball(R, p, mode));
};

// ---- Building a frame: his rig, the ball in place of his void, specks on top.

/** His heart on the frame for a pose (the ball's middle). */
const heartOf = (p: HollowPose): Pt => hollowBuild(p).heart;
interface IntroPose extends HollowPose {
  /** The ball instead of his void: its radius and look (none: his own void). */
  ball?: { R: number; mode: Mode };
}
function frame(ms: number, p: IntroPose, extra: Partial<Frame> = {}): Frame {
  const built = hollowBuild(p);
  const layers: Layer[] = built.layers.map((l) => {
    if (p.ball && l.part.startsWith("void:")) {
      const [hx, hy] = built.heart;
      return { part: ballPart(p.ball.R, p.phase ?? 0, p.ball.mode), x: hx - BC[0], y: hy - BC[1] };
    }
    return { ...l, part: own(l.part) };
  });
  return { ms, layers, ...extra };
}

// ---- Specks: the dark material gathering, the light landing.

/**
 * Dark material spiralling in from all round to the ball (`t` frames in, looping every 8): three streams winding in, each a
 * chain of violet specks, a bright chunk at its head and its tail thinning out far away; loose bits drifting in between.
 * `far` the streams' outer end, `near` where they reach the ball's ring.
 */
const material = ([x, y]: Pt, t: number, streams = 3, far = 24, near = 9): Speck[] => {
  const out: Speck[] = [];
  const turn = (t / 8) * Math.PI * 2;
  for (let s = 0; s < streams; s++) {
    for (let j = 0; j < 12; j++) {
      const u = j / 11; // 0 at the head (by the ball), 1 at the tail (far out)
      const r = near + (far - near) * u;
      const a = turn + (s * 2 * Math.PI) / streams + u * 2.6;
      const px = Math.round(x - 0.5 + Math.cos(a) * r);
      const py = Math.round(y - 0.5 + Math.sin(a) * r * 0.75);
      if (u > 0.55 && (j + t) % 2) continue; // the tail breaks up
      const k = j === 0 ? "x" : j < 6 ? "U" : "u";
      out.push([px, py, k]);
      if (j < 8) out.push([px, py + 1, j < 4 ? "U" : "u"]);
    }
  }
  // Loose bits drifting in between the streams.
  for (let i = 0; i < 6; i++) {
    const u = ((t / 8 + i / 6) % 1 + 1) % 1;
    const r = far + 2 - (far - near) * u;
    const a = -turn * 0.5 + i * 1.9 + u * 2;
    out.push([Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.75), i % 2 ? "U" : "u"]);
  }
  return out;
};
/** Warm flecks of light sparking on the ball's rim where it lands (`t` the frame, `R` the ball's radius). */
const flecks = ([x, y]: Pt, t: number, R: number): Speck[] =>
  [0, 1, 2].flatMap((i): Speck[] => {
    const a = t * 2.1 + i * 2.3;
    const px = Math.round(x - 0.5 + Math.cos(a) * (R + 0.5));
    const py = Math.round(y - 0.5 + Math.sin(a) * (R + 0.5) * 0.9);
    return i === t % 3 ? [[px, py, "b"], [px + 1, py, "a"], [px - 1, py, "a"], [px, py - 1, "a"]] : [[px, py, "a"]];
  });
/** A hum round the full ball: a ring of faint violet dots, shimmering. */
const humRing = ([x, y]: Pt, t: number, R: number): Speck[] =>
  Array.from({ length: 12 }, (_, i): Speck | null => {
    if ((i + t) % 3 !== 0) return null;
    const a = (i / 12) * Math.PI * 2 + t * 0.2;
    return [Math.round(x - 0.5 + Math.cos(a) * (R + 3)), Math.round(y - 0.5 + Math.sin(a) * (R + 3) * 0.85), "v"];
  }).filter((s): s is Speck => !!s);

// ---- His moves.

/** Powering up: crouched, his free claw cupped by the ball, the strand held low; the ball spinning fast (two phases a frame). */
const CHARGE_P = (i: number): IntroPose => ({
  crouch: 1 + (i % 4 === 2 ? 1 : 0),
  feet: "wide",
  reach: i % 2 ? [15, 34] : [16, 33],
  arm: "low",
  mood: i % 4 === 3 ? "roar" : "grim",
  phase: i * 2,
  sway: [0, 1, 1, 0, -1, -1, 0, 0][i]!,
  ball: { R: i % 2 ? 7.5 : 7, mode: "charge" },
});
const charge: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const p = CHARGE_P(i);
    return frame(100, p, { cue: i === 0 ? "hum" : undefined, pal: i % 4 === 3 ? { ...EYES_HOT, ...VOID_HOT } : i % 2 ? VOID_HOT : undefined, specks: material(heartOf(p), i) });
  }),
};

/** The swell: a pulse, the ball growing 8, 9, 10; a judder. */
const swell: Anim = {
  loop: false,
  frames: [8, 9, 10, 10].map((R, i) => {
    const p: IntroPose = { crouch: 2 - (i >> 1), feet: "wide", free: i < 2 ? "wind" : "out", arm: "low", mood: i === 2 ? "roar" : "grim", phase: 2 * i, ball: { R, mode: i < 3 ? "charge" : "drink" } };
    return frame(i === 3 ? 140 : 110, p, { cue: i === 0 ? "swell" : undefined, shake: i === 1 ? [1, 0] : i === 2 ? [-1, 0] : undefined, pal: i === 2 ? { ...EYES_HOT, ...VOID_HOT } : VOID_HOT, specks: i < 2 ? material(heartOf(p), i * 3, 3, 16, R + 2) : [] });
  }),
};

/** Drinking the light: braced wide, claws out low and open, roaring; he shakes with the pull. */
const DRINK_P = (i: number): IntroPose => ({
  crouch: 2,
  feet: "wide",
  free: "out",
  arm: "low",
  mood: "roar",
  headDy: i % 4 === 1 ? -1 : 0,
  phase: i,
  bob: i % 2,
  sway: i % 2 ? 1 : -1,
  ball: { R: i % 4 < 2 ? 10 : 10.5, mode: "drink" },
});
const drink: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const p = DRINK_P(i);
    const [hx, hy] = heartOf(p);
    return frame(100, p, { shake: i % 2 ? [1, 0] : [0, 0], pal: i % 2 ? EYES_HOT : { ...EYES_HOT, ...VOID_HOT }, specks: flecks([hx, hy], i, p.ball!.R) });
  }),
};

/** Full: standing tall in the dark, eyes slits, the ball at its biggest, nearly black, throbbing slowly. */
const FULL_P = (i: number): IntroPose => ({
  feet: "wide",
  free: "out",
  arm: "low",
  mood: "dark",
  bob: [0, 0, 0, 1, 1, 1, 0, 0][i]!,
  phase: Math.floor(i / 2),
  ball: { R: i < 4 ? 11.5 : 11, mode: "full" },
});
const full: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const p = FULL_P(i);
    return frame(120, p, { cue: i === 0 ? "hum" : undefined, pal: FULL_PAL, specks: humRing(heartOf(p), i, p.ball!.R) });
  }),
};

/** Settle: the ball sinks back into him, to his own void; he stands, his idle's first frame last. */
const settle: Anim = {
  loop: false,
  frames: [
    frame(110, { feet: "wide", free: "out", arm: "low", mood: "dark", phase: 0, crouch: 1, ball: { R: 9.5, mode: "full" } }, { cue: "settle", pal: FULL_PAL }),
    frame(100, { feet: "wide", free: "hang", arm: "low", mood: "dark", phase: 1, crouch: 1, ball: { R: 7.5, mode: "charge" } }, { pal: FULL_PAL }),
    frame(100, { free: "hang", arm: "hold", mood: "grim", phase: 2, ball: { R: 6, mode: "charge" } }),
    frame(110, { free: "hang", mood: "grim", phase: 3, size: 1 }),
    frame(140, { mood: "sneer", phase: 4 }),
    frame(300, { phase: 0 }),
  ],
};

const idle: Anim = { loop: true, frames: [frame(1000, { phase: 0 })] };

/**
 * Hollow for his battle intro: his own drawing, parts and palette (plus the light landing on the ball), in his own frame
 * (104 x 102, foot [50, 96]), facing front. His looks (`bulbs2`... `bulbs0`) and his battle lights' swap as HOLLOW's.
 */
export const BOSS_HOLLOW_INTRO: Character = {
  id: "hollow-intro",
  name: "Hollow (his intro)",
  w: HOLLOW.w,
  h: HOLLOW.h,
  foot: HOLLOW.foot,
  palette: IPAL,
  halo: HOLLOW.halo,
  looks: HOLLOW_LOOKS,
  swap: HOLLOW.swap,
  parts,
  anims: { charge, swell, drink, full, settle, idle },
};

/**
 * The ball's middle on each frame of each move (frame pixels): where the light's motes fly to. (Standing it is HOLLOW_HEART,
 * [50, 65]; each pixel of crouch or bob lowers it one.)
 */
export const HOLLOW_INTRO_HEART: Readonly<Record<string, readonly Pt[]>> = {
  charge: Array.from({ length: 8 }, (_, i) => heartOf(CHARGE_P(i))),
  swell: [2, 2, 1, 1].map((c) => heartOf({ crouch: c })),
  drink: Array.from({ length: 8 }, (_, i) => heartOf(DRINK_P(i))),
  full: Array.from({ length: 8 }, (_, i) => heartOf(FULL_P(i))),
  settle: [1, 1, 0, 0, 0, 0].map((c) => heartOf({ crouch: c })),
  idle: [heartOf({})],
};
/** The ball's radius on each frame of each move (0: his own void, radius 5.5): how far out the motes vanish into it. */
export const HOLLOW_INTRO_BALL_R: Readonly<Record<string, readonly number[]>> = {
  charge: Array.from({ length: 8 }, (_, i) => CHARGE_P(i).ball!.R),
  swell: [8, 9, 10, 10],
  drink: Array.from({ length: 8 }, (_, i) => DRINK_P(i).ball!.R),
  full: Array.from({ length: 8 }, (_, i) => FULL_P(i).ball!.R),
  settle: [9.5, 7.5, 6, 0, 0, 0],
  idle: [0],
};
