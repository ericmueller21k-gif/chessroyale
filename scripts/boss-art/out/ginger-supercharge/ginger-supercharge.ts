/**
 * Ginger's Super Freeze (id `ginger-supercharge`; Eric, Nov 18): his all-out charge-up and the blast that starts the
 * expanding ice block. Built on his own rig (gingerbread.ts: `gingerLayers`), as ginger-intro.ts is: nothing of his
 * drawing changes; poses are GingerPose numbers, and the orb, frost and bolt are specks on top. Same frame and foot as
 * GINGERBREAD (84 x 93, foot [43, 88]), facing front, the cane in his right hand (on our left), light from the top left.
 *
 * The game plays the intro's `charge` (ginger-intro.ts), then `superCharge` (loop) for a cycle or two, then `superBlast`.
 *
 * - `superCharge` (loop, 8 frames x 110 ms, 0.88 s): feet wide, a deep crouch, the cane held up before him glowing hot
 *   ice-blue, a fist clenched out beside it, eyes icy; a pulsing ball of ice light in the hook (white core, pale blue, a
 *   dark blue rim), two rings of frost spiralling in to it, sparkles, a shiver. No cue.
 * - `superBlast` (once, 8 frames, 670 ms): a last flare overhead, the cane swung down and pointed at the board to our right,
 *   a little down; the ice bolt leaves its end (cue `blast` f2, shake [-1, 0]; the game's bolt flies on from
 *   SUPER_BLAST_FROM), a recoil, the glow fading, a fierce laugh; it ends on his idle's first frame.
 * - `idle`: his idle's first frame.
 */
import { caneTip, GINGERBREAD, gingerLayers, type GingerPose } from "../../../../packages/app/src/characters/gingerbread.ts";
import { lazyAnim, type Anim, type Character, type Frame, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

type Pt = readonly [number, number];
const OX = 14; // his drawing space on his frame (gingerbread.ts)
const OY = 30;
const f = (ms: number, p: GingerPose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: gingerLayers(p), ...extra });

// His own glow colors (gingerbread.ts).
const ICY_EYES = { e: "#9ff0ff", E: "#ffffff" };
const GLOW_HALF = { v: "#dff6ff", V: "#9fd8f5" };
const GLOW_PULSE = { s: "#7fe0ff", S: "#2f9be0", v: "#f0fdff", V: "#b5ecff" };
const GLOW_BRIGHT = { s: "#b5f0ff", S: "#5cc8ff", v: "#ffffff", V: "#dff6ff" };
/** His icing frosted over as the cold peaks. */
const FROSTED = { w: "#ffffff", W: "#e6f8ff" };

const sparkle = (x: number, y: number, big = false): Speck[] => [
  [x, y, "F"],
  [x - 1, y, "I"],
  [x + 1, y, "I"],
  [x, y - 1, "I"],
  [x, y + 1, "I"],
  ...(big ? ([[x - 2, y, "f"], [x + 2, y, "f"], [x, y - 2, "f"], [x, y + 2, "f"]] as Speck[]) : []),
];

/** The orb's centre (frame px) on the cane "raise": in the hook's curl, nudged up, `down` px lower (crouch + bob). */
const hookAt = (down: number): Pt => [OX + 11, OY + 2 + down];

/**
 * Frost streaming in to a point: `n` streaks on a ring of radius r (turned `turn`, 0-1), each a bright head and a
 * tail curling back out behind it, so they spiral in.
 */
const inflow = ([x, y]: Pt, r: number, turn: number, n = 8): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const a = (i / n + turn) * Math.PI * 2;
    const pt = (aa: number, rr: number): [number, number] => [Math.round(x + Math.cos(aa) * rr), Math.round(y + Math.sin(aa) * rr * 0.85)];
    const [hx, hy] = pt(a, r);
    const tail = pt(a - 0.22, r + 2.2);
    const tail2 = pt(a - 0.42, r + 4.2);
    if (i % 4 === 0) return [...sparkle(hx, hy), [tail[0], tail[1], "I"], [tail2[0], tail2[1], "J"]];
    return [[hx, hy, "F"], [tail[0], tail[1], i % 2 ? "i" : "I"], [tail2[0], tail2[1], "J"]];
  }).flat();

/**
 * A ball of ice light, radius r round (cx, cy): a white core high on the left, pale blue, a dark blue rim, and four
 * glinting rays (turned by `phase`).
 */
const orb = ([cx, cy]: Pt, r: number, phase = 0): Speck[] => {
  const out: Speck[] = [];
  const R = Math.ceil(r) + 1;
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) {
        // A dithered halo of frost light just outside the rim.
        if (d < 1 + 1.6 / r && (x + y) % 2 === 0) out.push([cx + x, cy + y, "f"]);
        continue;
      }
      const core = Math.hypot(x + r * 0.22, y + r * 0.22) / r;
      const k = d > 0.8 ? "J" : core < 0.38 ? "F" : d > 0.55 ? "I" : "i";
      out.push([cx + x, cy + y, k]);
    }
  const ray = Math.round(r) + 2;
  const dirs: Pt[] = phase % 2 ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const len = phase % 2 ? 2 : 3;
  for (const [dx, dy] of dirs) {
    const s = phase % 2 ? Math.round(ray * 0.75) : ray;
    for (let t = 0; t < len; t++) out.push([cx + dx * (s + t), cy + dy * (s + t), t === 0 ? "F" : t === 1 ? "i" : "f"]);
  }
  return out;
};

// ---- superCharge.

const CHARGE: GingerPose = { cane: "raise", feet: "wide", free: "out", glow: true, mood: "angry" };
const CROUCH = [2, 2, 3, 3, 2, 3, 3, 2] as const;
const ORB_R = [5.6, 6.2, 6.8, 6.2, 6.8, 7.4, 6.8, 6.2] as const;
const MOOD = ["shout", "shout", "shout", "angry", "shout", "shout", "angry", "angry"] as const;
const SHAKE: (readonly [number, number] | undefined)[] = [undefined, undefined, [1, 0], undefined, undefined, [-1, 0], [1, 0], undefined];
/** Sparkles winking round the orb, a different pair each frame. */
const WINKS: readonly Pt[] = [[-9, -6], [8, -9], [10, 4], [-8, 7], [3, -12], [-12, -1], [11, -3], [-4, 10]];

const chargeFrame = (i: number, ms = 110): Frame => {
  const crouch = CROUCH[i]!;
  const hook = hookAt(crouch);
  const t = i / 8;
  const swirl = [0, 1].flatMap((k) => {
    const u = (t + k / 2) % 1;
    return inflow(hook, 18 - 10 * u, u * 0.5 + k * 0.19, k ? 5 : 7);
  });
  const w1 = WINKS[i]!;
  const w2 = WINKS[(i + 3) % 8]!;
  return f(
    ms,
    { ...CHARGE, crouch, mood: MOOD[i], headDy: i === 3 || i === 7 ? -1 : 0 },
    {
      pal: i % 2 ? { ...GLOW_BRIGHT, ...ICY_EYES, ...FROSTED } : { ...GLOW_PULSE, ...ICY_EYES },
      shake: SHAKE[i] as [number, number] | undefined,
      specks: [...swirl, ...sparkle(hook[0] + w1[0], hook[1] + w1[1], i % 2 === 0), ...sparkle(hook[0] + w2[0], hook[1] + w2[1]), ...orb(hook, ORB_R[i]!, i)],
    },
  );
};

const superCharge: Anim = lazyAnim(() => ({ loop: true, frames: Array.from({ length: 8 }, (_, i) => chargeFrame(i)) }));

// ---- superBlast.

const CAST: GingerPose = { crouch: 2, feet: "wide", cane: "thrust", free: "up", glow: true, mood: "shout" };
const castTip = caneTip(CAST);
/** The cane's slope pointing at the board: right, a little down. */
const SLOPE = 0.28;
/** His ice bolt, slanted down along the cane: a bright shard, tip at (x, y), a trail of frost behind. */
const shard = (x: number, y: number, trail = 3): Speck[] => {
  const out: Speck[] = [];
  const rows = [
    "........fii....",
    "....JJIiiFF....",
    "kJJIIiiFFFFFF..",
    "kJIIiiFFFFFFFFF",
    "kJJIIiiFFFFFF..",
    "....JJIiiFF....",
    "........fii....",
  ];
  rows.forEach((row, r) =>
    [...row].forEach((k, c) => {
      if (k === ".") return;
      const back = row.length - 1 - c;
      out.push([x - back, y - 3 + r - Math.round(back * SLOPE), k]);
    }),
  );
  for (let t = 1; t <= trail; t++) {
    const back = 15 + t * 3;
    out.push([x - back, y - Math.round(back * SLOPE) + (t % 2 ? -1 : 1), t === 1 ? "i" : t === 2 ? "I" : "f"]);
  }
  return out;
};
/** Where the bolt's tip is in the cue frame, frame px: the game's bolt flies on from here. */
export const SUPER_BLAST_FROM: [number, number] = [castTip[0] + 19, castTip[1] + 5];
/** After the cue the game's bolt flies on: here only its wake, frost puffs along its path from the cane, fading. */
const wake = (t: number): Speck[] =>
  [3, 7, 11, 15, 19].flatMap((s, i): Speck[] => {
    if (t > 0 && i % 2 === 0) return [];
    const x = castTip[0] + s;
    const y = castTip[1] + Math.round(s * SLOPE) + (i % 2 ? -1 : 1);
    return t === 0 && i === 4 ? sparkle(x, y) : [[x, y, i % 2 ? "i" : "F"], [x + 1, y, t ? "f" : "I"]];
  });

const SWING_TIP = ((t) => [t[0] + 1, t[1]] as Pt)(caneTip({ crouch: 3, feet: "wide", cane: "aim" }));
/** The swing's swoosh: a band of ice light along a curve from a to b (through c), brightest at its head (b). */
const swoosh = (a: Pt, c: Pt, b: Pt): Speck[] => {
  const out: Speck[] = [];
  for (let s = 0; s <= 30; s++) {
    const t = s / 30;
    const x = Math.round((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]);
    const y = Math.round((1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]);
    if (t < 0.25 && s % 2) continue;
    out.push([x - 2, y - 1, "f"], [x - 1, y, t > 0.5 ? "I" : "f"], [x, y, t > 0.6 ? "F" : t > 0.3 ? "i" : "I"], [x + 1, y + 1, t > 0.6 ? "i" : "J"]);
  }
  return out;
};

const superBlast: Anim = lazyAnim(() => {
  const idle0 = GINGERBREAD.anims.idle!.frames[0]!;
  return {
    loop: false,
    frames: [
      // The last flare: still held up, the orb at its fullest, the last of the frost sucked in.
      f(90, { ...CHARGE, crouch: 3, mood: "shout", headDy: -1 }, { pal: { ...GLOW_BRIGHT, ...ICY_EYES, ...FROSTED }, specks: [...inflow(hookAt(3), 9, 0.3, 6), ...orb(hookAt(3), 8, 1)] }),
      // Swung down and forward: a swoosh of ice light along the swing, the orb's light gone to the cane's end.
      f(70, { crouch: 3, feet: "wide", cane: "aim", free: "out", glow: true, mood: "shout" }, {
        pal: { ...GLOW_BRIGHT, ...ICY_EYES },
        specks: [...swoosh(hookAt(3), [OX + 16, OY + 46], SWING_TIP), ...orb(SWING_TIP, 3.6, 0)],
      }),
      // The bolt leaves.
      f(90, CAST, { cue: "blast", shake: [-1, 0], pal: { ...GLOW_BRIGHT, ...ICY_EYES, ...FROSTED }, specks: [...orb([castTip[0] + 1, castTip[1]], 2.6, 1), ...shard(...SUPER_BLAST_FROM, 1)] }),
      f(80, { ...CAST, dx: -1, crouch: 3 }, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: [...sparkle(castTip[0], castTip[1] + 1), ...wake(0)] }),
      f(80, { ...CAST, dx: -1, mood: "laugh" }, { pal: GLOW_PULSE, specks: wake(1) }),
      f(90, { ...CAST, glow: true, mood: "laugh", crouch: 1, headDy: -1 }, { pal: GLOW_HALF }),
      f(90, { crouch: 1, cane: "lift", mood: "laugh", free: "up" }),
      { ...idle0, ms: 100 },
    ],
  };
});

export const GINGER_SUPER: Character = {
  ...GINGERBREAD,
  id: "ginger-supercharge",
  name: "Ginger (Super Freeze)",
  anims: {
    superCharge,
    superBlast,
    idle: lazyAnim(() => ({ loop: true, frames: [GINGERBREAD.anims.idle!.frames[0]!] })),
  },
};
