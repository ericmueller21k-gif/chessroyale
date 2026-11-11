/**
 * Don Dough (Eric named him Nov 11; working id `zebra`, `boss-zebra`), the kingpin: the zebra who runs "just a bakery" (Eric's design,
 * Nov 10; drawn by hand on the weekly plan usage). A zebra with a big pudgy belly, standing upright as the giraffes do: a
 * charcoal fedora with a red band (his ears up behind it), a burgundy pinstripe vest straining over the belly (gold buttons,
 * little gaps pulled open, his stripes peeking out under its hem), a white waist apron tied under the belly, flour dust on the
 * vest and the hat, a gold pinky ring, one gold tooth. His bread rifle: a long French roll, its crust scored with pale
 * slashes, slung across his back (its end over his far shoulder) until he pulls it, then held two-handed like a rifle.
 *
 * The crew's rig (out/crew-zebra/zebra-rig.ts), the same frame: 96 x 104, foot [36, 100], three-quarters facing our right,
 * light from the top left, room scale 1:1 (37 px a square). He's the same height as his crew (about 69 px to his ear tips),
 * twice as wide at the middle. Not mirrored in battle (he faces the board on our right); mirror him in a room as needed.
 *
 * BOSS_ZEBRA_MUZZLE: per animation, per frame, where a puff leaves the roll's front end (frame px), or null.
 * BOSS_ZEBRA_PORTRAIT: the part of `idle` frame 0 a portrait shows (his head and hat).
 */
import type { Anim, Character, Frame, Speck } from "../../characters/sprite.ts";
import { ARMS, build, crumbFall, doughLump, FOOT, frame, H, hahas, PARTS, puff, stars, W, ZEBRA_PALETTE, type Built, type Look, type Pose, type Pt } from "./zebra-rig.ts";

export const KINGPIN: Look = { id: "zk", hat: "fedora", top: "pin", boss: true, seed: 1 };
const K = KINGPIN;

/** His rest: hooves on the belly, the roll slung on his back. */
const REST: Pose = { armN: ARMS.belly, armF: ARMS.bellyF, slung: true, eyes: "half", mouth: "smirk" };
/** The roll's places (the near hoof from the near shoulder). */
const GRAB: Pose = { armN: [[2, -6], [-2, -12]], armF: ARMS.bellyF, slung: true }; // reaching over his shoulder for it
const OUT: Pose["gun"] = { deg: -78, at: [4, -4], grip: 6, back: true }; // pulled out, pointing up
const SWING: Pose["gun"] = { deg: -30, at: [6, 0], both: true, far: 12 };
const AIM: Pose["gun"] = { deg: -2, at: [4, 1], both: true, far: 13 };
const KICK: Pose["gun"] = { deg: -9, at: [3, 0], both: true, far: 13 };
const HUG: Pose["gun"] = { deg: 28, at: [6, 8], both: true, far: 12 }; // lowered over the belly, laughing
const STOW: Pose["gun"] = { deg: -100, at: [1, -7], grip: 10, back: true }; // going back over his shoulder

/** Where each animation's puffs leave the roll (filled in as the frames are made). */
export const BOSS_ZEBRA_MUZZLE: Record<string, (Pt | null)[]> = {};
const MUZ: Record<string, (Pt | null)[]> = BOSS_ZEBRA_MUZZLE;

type Extra = { specks?: (b: Built) => Speck[]; cue?: string; shake?: readonly [number, number]; pal?: Record<string, string> };
const f = (ms: number, p: Pose, extra: Extra = {}): Frame => frame(K, ms, p, extra);

/** An animation whose frames may fire: `shots` lists, per frame, how many frames ago the last shot left (0 the pop, -1 none). */
function anim(name: string, loop: boolean, frames: { ms: number; p: Pose; x?: Extra; shot?: number[] }[]): Anim {
  // The muzzle at each frame; a puff stays where its shot left the roll (the frame `t` back), not following the roll.
  const at = frames.map(({ p }) => build(K, p).muzzle);
  const n = frames.length;
  MUZ[name] = frames.map(({ shot = [] }, i) => (shot.includes(0) ? at[i]! : null));
  const out = frames.map(({ ms, p, x = {}, shot = [] }, i) => {
    const puffs = (): Speck[] =>
      shot.flatMap((t) => {
        const j = loop ? (i - t + n) % n : i - t;
        const m = (j >= 0 ? at[j] : null) ?? at[i];
        return m ? puff(m, t) : [];
      });
    return frame(K, ms, p, { ...x, specks: (bb) => [...puffs(), ...(x.specks?.(bb) ?? [])] });
  });
  return { loop, frames: out };
}

// ---- The standard set.

const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const pat = i === 6 || i === 8; // a pat on the belly
    return f(i === 10 ? 110 : 210, {
      ...REST,
      jig: [0, 0, 1, 1, 0, 0, -1, 1, -1, 0, 0, 0][i],
      bob: i === 2 || i === 3 ? 1 : 0,
      armN: pat ? [[7, 6], [11, 9]] : ARMS.belly,
      eyes: i === 10 ? "blink" : i >= 4 && i <= 5 ? "open" : "half",
      mouth: i >= 6 && i <= 8 ? "smile" : "smirk",
    });
  }),
};
const entrance: Anim = {
  loop: false,
  frames: [
    f(110, { ...REST, air: 7, armN: ARMS.up, armF: ARMS.wave, eyes: "wide", mouth: "o", feet: [[-4, 3], [5, 2]] }),
    f(90, { ...REST, air: 2, armN: ARMS.shrug, eyes: "wide", mouth: "o" }),
    f(130, { ...REST, jig: 2, bob: 2, eyes: "shut", mouth: "grit", feet: [[-6, 0], [6, 0]] }, { cue: "thud", shake: [0, 1] }),
    f(110, { ...REST, jig: -1, bob: 1, eyes: "open" }),
    f(110, { ...REST, jig: 1, eyes: "open" }),
    f(160, { ...REST, armN: [[8, -2], [7, -14]], eyes: "half", mouth: "smirk" }),
    f(220, { ...REST, armN: [[8, -2], [7, -16]], hatLift: 2, eyes: "half", mouth: "grin" }, { cue: "tip" }),
    f(160, { ...REST, armN: [[8, -2], [7, -14]], eyes: "half", mouth: "grin" }),
    f(300, { ...REST }),
  ],
};
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(i === 6 ? 120 : 260, {
      ...REST,
      armN: i % 4 === 3 ? [[8, 5], [7, -3]] : ARMS.chin,
      eyes: i === 6 ? "blink" : i < 4 ? "up" : "fwd",
      mouth: i < 4 ? "pout" : "flat",
      brows: i >= 4 ? "one" : undefined,
      hx: i >= 4 ? 1 : 0,
      jig: i % 4 === 2 ? 1 : 0,
    }),
  ),
};
const move: Anim = {
  loop: false,
  frames: [
    f(120, { ...REST, eyes: "fwd" }),
    f(110, { ...REST, armN: ARMS.point, eyes: "fwd", mouth: "smirk", hx: 1 }, { cue: "point" }),
    f(220, { ...REST, armN: [[9, -1], [17, -4]], eyes: "half", mouth: "smirk", hx: 2 }),
    f(160, { ...REST, armN: ARMS.point, eyes: "half", mouth: "smile", hx: 1 }),
    f(160, { ...REST }),
  ],
};
/** Pull the roll, aim, fire once; `after`: what follows the pop. */
const pull = (ms = 110) => [
  { ms, p: { ...GRAB, eyes: "fwd" as const, mouth: "smirk" as const } },
  { ms: 90, p: { gun: OUT, armF: ARMS.bellyF, eyes: "fwd" as const, mouth: "smirk" as const }, x: { cue: "draw" } },
  { ms: 90, p: { gun: SWING, eyes: "mad" as const, mouth: "grin" as const, hx: 1 } },
];
const stow = (ms = 120) => [
  { ms, p: { gun: STOW, armF: ARMS.bellyF, eyes: "half" as const, mouth: "smirk" as const } },
  { ms: 110, p: { ...GRAB, eyes: "half" as const, mouth: "smirk" as const } },
];
const capture = anim("capture", false, [
  ...pull(),
  { ms: 140, p: { gun: AIM, eyes: "mad", mouth: "grit", hx: 1 } },
  { ms: 110, p: { gun: KICK, eyes: "mad", mouth: "grin", dx: -1, jig: 1, hx: 1 }, shot: [0], x: { cue: "pop" } },
  { ms: 110, p: { gun: AIM, eyes: "half", mouth: "grin", hx: 1 }, shot: [1] },
  { ms: 130, p: { gun: AIM, eyes: "half", mouth: "grin" }, shot: [2] },
  { ms: 160, p: { gun: HUG, eyes: "shut", mouth: "laugh", jig: 2 }, shot: [3], x: { specks: (b) => hahas(b.mouth, 0) } },
  ...stow(),
  { ms: 200, p: { ...REST } },
]);
const hurt: Anim = {
  loop: false,
  frames: [
    f(90, { ...REST, hatLift: 4, jig: 2, eyes: "wide", mouth: "o", brows: "up", dx: -2 }, { cue: "hurt", shake: [-1, 0], pal: { c: "#ffffff", C: "#ffffff", d: "#e6e2ee", v: "#c04a5e", V: "#8a2a3a" } }),
    f(90, { ...REST, hatLift: 3, jig: -2, eyes: "wide", mouth: "o", brows: "up", dx: 1 }, { shake: [1, 0] }),
    f(120, { ...REST, hatLift: 2, jig: 1, eyes: "mad", mouth: "grit" }),
    f(200, { ...REST, hatLift: 2, eyes: "mad", mouth: "frown", armN: [[8, -2], [7, -14]] }),
    f(160, { ...REST, eyes: "mad", mouth: "frown", armN: [[8, -2], [7, -14]] }),
    f(200, { ...REST, eyes: "half", mouth: "flat" }),
  ],
};
const check = anim("check", false, [
  ...pull(100),
  { ms: 160, p: { gun: AIM, eyes: "mad", brows: "down", mouth: "flat", hx: 1 }, x: { cue: "cock" } },
  { ms: 220, p: { gun: AIM, eyes: "half", brows: "down", mouth: "smirk", hx: 1 } },
  { ms: 260, p: { gun: AIM, eyes: "half", brows: "one", mouth: "grin", hx: 1 } },
  { ms: 200, p: { gun: AIM, eyes: "mad", brows: "down", mouth: "smirk", hx: 1 } },
  ...stow(),
  { ms: 200, p: { ...REST } },
]);
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(i % 2 ? 150 : 230, { ...REST, hy: -1, jig: i % 2 ? 1 : -1, eyes: i === 5 ? "shut" : "half", brows: "one", mouth: i % 4 === 1 ? "grin" : "smirk" }),
  ),
};
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(120, {
      ...REST,
      armN: ARMS.belly,
      dx: i % 2 ? 1 : 0,
      jig: i % 2 ? 1 : 0,
      eyes: i % 4 < 2 ? "back" : "fwd",
      brows: "up",
      mouth: i % 3 === 0 ? "grit" : "frown",
      sweat: i % 4 < 2 ? 1 : 2,
    }),
  ),
};
const cheer: Anim = {
  loop: false,
  frames: [
    f(120, { ...REST, eyes: "open", mouth: "smile" }),
    f(130, { ...REST, hy: 2, eyes: "shut", mouth: "grin", armN: [[7, 6], [11, 9]], jig: 1 }, { cue: "chuckle" }),
    f(130, { ...REST, eyes: "shut", mouth: "grin", jig: -1 }),
    f(130, { ...REST, hy: 2, eyes: "shut", mouth: "grin", armN: [[7, 6], [11, 9]], jig: 1 }),
    f(200, { ...REST, eyes: "half", mouth: "smirk" }),
  ],
};
const bigCheer = anim("bigCheer", false, [
  ...pull(100),
  { ms: 110, p: { gun: { deg: -84, at: [5, -14], grip: 8, back: true }, armF: ARMS.wave, eyes: "shut", mouth: "laugh", air: 3, feet: [[-5, 2], [5, 3]] }, x: { cue: "laugh" } },
  { ms: 130, p: { gun: { deg: -80, at: [5, -12], grip: 8, back: true }, armF: ARMS.wave, eyes: "shut", mouth: "laugh", jig: 2, bob: 1 }, x: { specks: (b) => hahas(b.mouth, 0) } },
  { ms: 110, p: { gun: { deg: -84, at: [5, -14], grip: 8, back: true }, armF: ARMS.wave, eyes: "shut", mouth: "laugh", air: 3, feet: [[-5, 2], [5, 3]] }, x: { specks: (b) => hahas(b.mouth, 1) } },
  { ms: 130, p: { gun: { deg: -80, at: [5, -12], grip: 8, back: true }, armF: ARMS.wave, eyes: "shut", mouth: "grin", jig: 2, bob: 1 } },
  ...stow(),
  { ms: 200, p: { ...REST } },
]);
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const up = i % 4 < 2;
    return f(140, {
      gun: { deg: up ? -86 : -76, at: up ? [5, -15] : [6, -11], grip: 8, back: true },
      armF: up ? ARMS.wave : [[7, -1], [11, -9]],
      air: up && i % 2 === 0 ? 3 : 0,
      feet: up && i % 2 === 0 ? [[-5, 2], [5, 3]] : [[-5, 0], [5, 0]],
      jig: up ? -1 : 2,
      bob: up ? 0 : 1,
      eyes: "shut",
      mouth: i % 2 ? "grin" : "laugh",
    }, { ...(i === 0 ? { cue: "laugh" } : {}), specks: (b) => [...crumbFall(14, 86, 4, i, 3), ...(i % 2 ? [] : hahas(b.mouth, i))] });
  }),
};
const defeat: Anim = {
  loop: false,
  frames: [
    f(100, { ...REST, slung: false, gun: { deg: -40, at: [6, 0], grip: 6 }, eyes: "wide", mouth: "o", brows: "up", jig: 2, hatAt: [40, 30] }, { cue: "hurt", shake: [-1, 0] }),
    f(110, { slung: false, gun: { deg: 10, at: [9, 6], grip: 6, broken: true }, armF: ARMS.shrug, eyes: "wide", mouth: "o", brows: "up", jig: -1, hatAt: [30, 20] }, { cue: "snap" }),
    f(120, { sit: 11, gun: { deg: 40, at: [10, 9], grip: 10, broken: true }, armF: ARMS.hip, eyes: "dizzy", mouth: "o", jig: -1, hatAt: [20, 40], hatGone: true }, { cue: "thud", shake: [0, 1] }),
    f(150, { sit: 7, gun: { deg: 38, at: [10, 9], grip: 10, broken: true }, armF: ARMS.hip, eyes: "dizzy", mouth: "frown", jig: 1, hatAt: [14, 101] }, { specks: (b) => stars([b.head[0] - 2, b.head[1] - 9], 0) }),
    ...[1, 2, 3, 4].map((t) =>
      f(170, { sit: 7, gun: { deg: 38, at: [10, 9], grip: 10, broken: true }, armF: ARMS.hip, eyes: "dizzy", mouth: "frown", jig: t % 2 ? -1 : 0, hatAt: [14, 101] }, { specks: (b) => stars([b.head[0] - 2, b.head[1] - 9], t) }),
    ),
  ],
};

// ---- His own moves.

/**
 * breadPop (his battle start, Eric's words): he reaches over his shoulder and pulls out the roll, shoulders it like a rifle,
 * sights down it, "fires" (a little puff of flour and crumbs, cue `pop`), then laughs (cue `laugh`), the belly bouncing, and
 * slings it back. About 2.6 s; it ends on his idle's first frame.
 */
const breadPop = anim("breadPop", false, [
  { ms: 200, p: { ...REST } },
  ...pull(130),
  { ms: 130, p: { gun: AIM, eyes: "fwd", mouth: "smirk", hx: 1 } },
  { ms: 300, p: { gun: AIM, eyes: "mad", mouth: "flat", hx: 2, hy: 1 } },
  { ms: 110, p: { gun: KICK, eyes: "mad", mouth: "o", hx: 1, dx: -1, jig: 1 }, shot: [0], x: { cue: "pop" } },
  { ms: 110, p: { gun: AIM, eyes: "open", mouth: "o", hx: 1 }, shot: [1] },
  { ms: 140, p: { gun: AIM, eyes: "half", mouth: "grin", hx: 1 }, shot: [2] },
  { ms: 130, p: { gun: HUG, eyes: "shut", mouth: "laugh", jig: 2, bob: 1 }, shot: [3], x: { cue: "laugh", specks: (b) => hahas(b.mouth, 0) } },
  { ms: 130, p: { gun: HUG, eyes: "shut", mouth: "laugh", jig: -1, hy: -1 }, x: { specks: (b) => hahas(b.mouth, 1) } },
  { ms: 130, p: { gun: HUG, eyes: "shut", mouth: "laugh", jig: 2, bob: 1 }, x: { specks: (b) => hahas(b.mouth, 0) } },
  { ms: 130, p: { gun: HUG, eyes: "shut", mouth: "laugh", jig: -1, hy: -1 }, x: { specks: (b) => hahas(b.mouth, 1) } },
  { ms: 150, p: { gun: HUG, eyes: "shut", mouth: "grin", jig: 1 } },
  ...stow(),
  { ms: 160, p: { ...REST } },
]);
/**
 * volley (his God King save, Eric's words: "firing off a bunch of shots with this loaf of bread"): a looping rapid fire, the
 * roll kicking up with each shot and coming back, four puffs a loop drifting off, his belly shaking, a mad grin (cue `volley`
 * f0: one rattle of four soft pops a loop). Play `pull`'s frames first if he hasn't the roll out: this loop starts aimed.
 */
const volley = anim(
  "volley",
  true,
  Array.from({ length: 8 }, (_, i) => {
    const fire = i % 2 === 0;
    // Each shot's puff drifts on for three frames: the puffs on screen this frame (frames since each of the last two shots).
    const ages = fire ? [0, 2] : [1, 3];
    return {
      ms: fire ? 80 : 70,
      p: { gun: fire ? KICK : AIM, eyes: "mad" as const, mouth: fire ? ("grin" as const) : ("open" as const), hx: 1, dx: fire ? -1 : 0, jig: fire ? 1 : -1, feet: [[-6, 0], [6, 0]] as const },
      shot: ages,
      x: i === 0 ? { cue: "volley" } : {},
    };
  }),
);
/** relax (the back room's talk beat, standing): a calm-down wave of his hoof to his crew, "easy, easy" (cue `relax` f1). */
const relaxFrames = (seated: boolean): Anim => {
  const base: Pose = seated ? { sit: 11, armF: ARMS.bellyF } : { ...REST, armF: ARMS.bellyF };
  return {
    loop: false,
    frames: [
      f(140, { ...base, armN: ARMS.calm, eyes: "open", brows: "up", mouth: "smile" }),
      f(160, { ...base, armN: ARMS.calmLow, eyes: "half", mouth: "smile", hy: 1 }, { cue: "relax" }),
      f(160, { ...base, armN: ARMS.calm, eyes: "half", mouth: "smile" }),
      f(160, { ...base, armN: ARMS.calmLow, eyes: "shut", mouth: "smile", hy: 1 }),
      f(160, { ...base, armN: ARMS.calm, eyes: "half", mouth: "smirk" }),
      f(260, { ...base, armN: ARMS.belly, eyes: "half", mouth: "smirk" }),
    ],
  };
};
const relax = relaxFrames(false);
const sitRelax = relaxFrames(true);

/**
 * drop (Rising Dough): he dips a hoof into his apron pocket, comes up with a lump of raw dough, gives it a little toss in his
 * hoof, winds back and lobs it out to our right toward the board (cue `drop` f5, as it leaves his hoof), a smug look after it.
 * The lump leaves the frame's right side at about (90, 34) on f7; the board then plays ZEBRA_DOUGH `land` on its square.
 */
const drop: Anim = {
  loop: false,
  frames: [
    f(140, { ...REST, eyes: "open" }),
    f(150, { ...REST, armN: [[5, 12], [9, 21]], eyes: "fwd", hy: 1, mouth: "pout" }),
    f(150, { ...REST, armN: [[8, 6], [12, 2]], eyes: "half", mouth: "smirk" }, { specks: (b) => doughLump([b.hoofN[0] + 1, b.hoofN[1] - 3]) }),
    f(110, { ...REST, armN: [[8, 4], [12, -3]], eyes: "half", mouth: "smirk" }, { specks: (b) => doughLump([b.hoofN[0] + 1, b.hoofN[1] - 8], 1) }),
    f(150, { ...REST, armN: [[2, -4], [-3, -11]], eyes: "fwd", mouth: "grin", hx: -1 }, { specks: (b) => doughLump([b.hoofN[0], b.hoofN[1] - 3]) }),
    f(80, { ...REST, armN: [[9, -3], [16, -8]], eyes: "fwd", mouth: "open", hx: 1 }, { cue: "drop", specks: (b) => doughLump([b.hoofN[0] + 6, b.hoofN[1] - 4], 1) }),
    f(80, { ...REST, armN: [[9, 0], [16, 3]], eyes: "fwd", mouth: "grin", hx: 1 }, { specks: () => doughLump([76, 30], 0) }),
    f(80, { ...REST, armN: [[9, 2], [15, 6]], eyes: "half", mouth: "grin", hx: 1 }, { specks: () => doughLump([89, 34], 1) }),
    f(260, { ...REST, eyes: "half", mouth: "smirk", brows: "one" }),
  ],
};

/**
 * goldPlate (his ultimate, Gold Plate, Eric Nov 11): a baker's golden glaze. He brings out a little pot of gold glaze against his
 * belly, stirs it with a pastry brush, humming, eyes shut (cue `stir` f2), lifts the brush dripping gold and admires it, then brushes
 * three broad strokes out at the board, gold glitter flying (cue `gild` f8, as the board's GOLD_FX `gild` starts), then a
 * proud chef's kiss: hoof to his lips (cue `kiss` f12) and flung open with a sparkle. 4.2 s; it ends on his idle's first frame.
 * Then `goldBrag` while the piece shines and he says his line (the whole moment: zebra-nov10.md, "Gold Plate").
 */
const pot = (): Speck[] => {
  // A white glaze bowl held against his belly front, brimming with gold glaze, a shine on it; outlined.
  const out: Speck[] = [];
  const [x, y] = [50, 68];
  const half = [5, 5, 4.5, 4, 3];
  for (let j = -1; j <= 5; j++)
    for (let i = -6; i <= 6; i++) {
      const w = j < 0 ? 4 : half[j] ?? -1;
      const ww = j < 0 ? 4 : half[j - 1] ?? 3;
      if (Math.abs(i) <= w && j >= 0 && j <= 4) out.push([x + i, y + j, j === 0 ? (i === -2 ? "h" : i > 2 ? "G" : "g") : i < -1 ? "C" : i > 2 ? "A" : "a"]);
      else if (j === -1 ? Math.abs(i) <= 4 : Math.abs(i) <= Math.max(w, ww) + 1 && Math.abs(i) > w) out.push([x + i, y + j, "k"]);
      else if (j === 5 && Math.abs(i) <= 3) out.push([x + i, y + j, "k"]);
    }
  out.push([x - 1, y - 2, "g"], [x + 1, y - 2, "g"]);
  return out;
};
/** The pastry brush in his near hoof: a short wooden handle back from the hoof, gold-wet bristles out ahead (dx, dy: its point). */
const brush = (h: Pt, dx: number, dy: number, wet = true): Speck[] => {
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  const out: Speck[] = [];
  for (let i = -3; i <= 0; i++) out.push([Math.round(h[0] + ux * i), Math.round(h[1] + uy * i), "8"]);
  for (let i = 2; i <= 7; i++)
    for (let w = -1; w <= 1; w++) {
      const k = i === 2 ? "k" : wet ? (i === 7 ? "h" : w > 0 ? "G" : "g") : w > 0 ? "^" : "~";
      out.push([Math.round(h[0] + ux * i - uy * w), Math.round(h[1] + uy * i + ux * w), k]);
    }
  return out;
};
/** Glitter flung off the brush ahead of it, `t` frames on. */
const fling = (h: Pt, t: number): Speck[] =>
  [0, 1, 2, 3, 4, 5].map((n): Speck => [Math.round(h[0] + 9 + n * 2.6 + t * 2), Math.round(h[1] - 3 + ((n * 5) % 7) - t), n % 3 === 0 ? "*" : n % 3 === 1 ? "g" : "h"]);
const goldPlate: Anim = {
  loop: false,
  frames: [
    f(300, { ...REST, eyes: "fwd", mouth: "smirk", brows: "one" }),
    f(280, { ...REST, armN: [[6, 8], [9, 9]], eyes: "half", mouth: "smirk", hy: 1 }, { specks: (b) => [...pot(), ...brush(b.hoofN, 1, 2, false)] }),
    // The build-up he enjoys: stirring the glaze, humming, eyes shut.
    f(300, { ...REST, armN: [[6, 8], [8, 8]], eyes: "half", mouth: "smile", hy: 1 }, { cue: "stir", specks: (b) => [...pot(), ...brush(b.hoofN, 1, 2)] }),
    f(300, { ...REST, armN: [[6, 8], [11, 9]], eyes: "shut", mouth: "smile", hy: 1 }, { specks: (b) => [...pot(), ...brush(b.hoofN, -1, 2)] }),
    f(300, { ...REST, armN: [[6, 8], [8, 8]], eyes: "half", mouth: "smile", hy: 1 }, { specks: (b) => [...pot(), ...brush(b.hoofN, 1, 2)] }),
    f(300, { ...REST, armN: [[6, 8], [11, 9]], eyes: "shut", mouth: "o", hy: 1 }, { specks: (b) => [...pot(), ...brush(b.hoofN, -1, 2)] }),
    // Up comes the brush, dripping gold; he admires it by his nose.
    f(300, { ...REST, armN: [[7, 3], [11, 0]], eyes: "open", mouth: "grin" }, { specks: (b) => [...pot(), ...brush(b.hoofN, 2, -3), [b.hoofN[0] + 2, b.hoofN[1] + 3, "g"], [b.hoofN[0] + 2, b.hoofN[1] + 5, "G"]] }),
    f(400, { ...REST, armN: [[8, 1], [10, -6]], eyes: "shut", mouth: "smile", hy: -1 }, { specks: (b) => [...pot(), ...brush(b.hoofN, 2, -3), [b.hoofN[0] + 6, b.hoofN[1] - 7, "*"]] }),
    // Three broad strokes out at the board (the board's gilding starts here).
    f(120, { ...REST, armN: [[9, -1], [16, -6]], eyes: "fwd", mouth: "grin", hx: 1 }, { cue: "gild", specks: (b) => [...pot(), ...brush(b.hoofN, 3, 1), ...fling(b.hoofN, 0)] }),
    f(120, { ...REST, armN: [[9, 3], [17, 4]], eyes: "fwd", mouth: "open", hx: 1 }, { specks: (b) => [...pot(), ...brush(b.hoofN, 3, -1), ...fling(b.hoofN, 1)] }),
    f(120, { ...REST, armN: [[9, -1], [16, -7]], eyes: "half", mouth: "grin", hx: 1 }, { specks: (b) => [...pot(), ...brush(b.hoofN, 3, 1), ...fling(b.hoofN, 2)] }),
    f(260, { ...REST, armN: [[7, 4], [10, 2]], eyes: "half", mouth: "smirk" }, { specks: () => pot() }),
    // The chef's kiss.
    f(380, { ...REST, armN: ARMS.mouth, eyes: "shut", mouth: "o", hy: -1 }, { cue: "kiss" }),
    f(420, { ...REST, armN: ARMS.open, eyes: "shut", mouth: "smile", hy: -2, hx: -1 }, { specks: (b) => [[b.hoofN[0] + 4, b.hoofN[1] - 3, "*"], [b.hoofN[0] + 5, b.hoofN[1] - 3, "g"], [b.hoofN[0] + 3, b.hoofN[1] - 3, "g"], [b.hoofN[0] + 4, b.hoofN[1] - 4, "g"], [b.hoofN[0] + 4, b.hoofN[1] - 2, "g"]] }),
    f(300, { ...REST, eyes: "half", mouth: "smirk", brows: "one" }),
  ],
};
/**
 * goldBrag (loops, 8 frames, 1.6 s): after the gilding, while the piece shines and he says his line (your pawns are worthless
 * against it): chin up, talking, a hoof pointing down at the board (your pawns), then patting his belly, a smug chuckle.
 */
const goldBrag: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(200, {
      ...REST,
      armN: i < 4 ? (i % 2 ? [[9, 5], [16, 9]] : [[9, 4], [16, 7]]) : i % 2 ? [[7, 6], [11, 9]] : ARMS.belly,
      eyes: i < 4 ? "half" : i === 6 ? "shut" : "half",
      brows: "one",
      mouth: i % 2 ? "open" : i < 4 ? "grin" : "smirk",
      hy: -1,
      hx: i < 4 ? 1 : 0,
      jig: i >= 4 ? (i % 2 ? 1 : -1) : 0,
    }),
  ),
};

// ---- At the back room's table (seated on a chair 11 px up; his roll lies on the table: ZEBRA_ROLL `table`).

const SIT: Pose = { sit: 11, armN: ARMS.belly, armF: ARMS.bellyF, eyes: "half", mouth: "smirk" };
/** Talking: gesturing, then poking the table twice (cue `tap`), "rook b1 takes, check". */
const sitTalk: Anim = {
  loop: true,
  frames: [
    f(160, { ...SIT, armN: ARMS.open, mouth: "open", eyes: "fwd" }),
    f(160, { ...SIT, armN: ARMS.shrug, mouth: "smile", eyes: "fwd" }),
    f(160, { ...SIT, armN: ARMS.open, mouth: "open", eyes: "half" }),
    f(140, { ...SIT, armN: ARMS.pokeUp, mouth: "open", hx: 1 }),
    f(110, { ...SIT, armN: ARMS.poke, mouth: "grit", hx: 2, hy: 1, jig: 1 }, { cue: "tap" }),
    f(140, { ...SIT, armN: ARMS.pokeUp, mouth: "open", hx: 1 }),
    f(110, { ...SIT, armN: ARMS.poke, mouth: "open", hx: 2, hy: 1, jig: 1 }, { cue: "tap" }),
    f(200, { ...SIT, armN: ARMS.open, mouth: "smirk", brows: "one" }),
    f(160, { ...SIT, armN: ARMS.calmLow, mouth: "open", eyes: "fwd" }),
    f(200, { ...SIT, armN: ARMS.calmLow, mouth: "smile", eyes: "blink" }),
  ],
};
const sitListen: Anim = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) =>
    f(i === 6 ? 110 : 240, { ...SIT, eyes: i === 6 ? "blink" : i >= 2 && i <= 4 ? "fwd" : "half", hy: i === 3 ? 2 : i === 4 ? 1 : 0, jig: i % 5 === 2 ? 1 : 0, mouth: i === 8 ? "pout" : "smirk", brows: i >= 7 ? "one" : undefined }),
  ),
};
/** He's always right: chin up, eyes shut, a hoof raised and wagged, "no, no, no" (cue `tsk` f1). */
const sitScoff: Anim = {
  loop: true,
  frames: [
    f(160, { ...SIT, armN: ARMS.finger, eyes: "half", mouth: "smirk", brows: "one", hy: -1 }),
    f(140, { ...SIT, armN: [[8, 1], [12, -11]], eyes: "shut", mouth: "smirk", hy: -2, hx: -1 }, { cue: "tsk" }),
    f(140, { ...SIT, armN: ARMS.finger, eyes: "shut", mouth: "smirk", hy: -2, hx: -1 }),
    f(140, { ...SIT, armN: [[8, 1], [12, -11]], eyes: "shut", mouth: "smirk", hy: -2, hx: -1 }),
    f(160, { ...SIT, armN: ARMS.finger, eyes: "shut", mouth: "pout", hy: -2, hx: -1 }),
    f(260, { ...SIT, armN: ARMS.open, eyes: "half", mouth: "smirk", brows: "one", hy: -1 }),
    f(200, { ...SIT, armN: ARMS.open, eyes: "half", mouth: "open", brows: "one" }),
    f(200, { ...SIT, armN: ARMS.belly, eyes: "half", mouth: "smirk", jig: 1 }),
  ],
};

export const BOSS_ZEBRA: Character = {
  id: "boss-zebra",
  name: "Don Dough",
  w: W,
  h: H,
  foot: FOOT,
  palette: ZEBRA_PALETTE,
  halo: "#3a3440",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, cheer, bigCheer, victory, defeat, breadPop, volley, relax, drop, goldPlate, goldBrag, sitTalk, sitListen, sitScoff, sitRelax },
};
/** The part of `idle` frame 0 a portrait shows (his head, ears and fedora), in frame px. */
export const BOSS_ZEBRA_PORTRAIT = { x: 22, y: 22, w: 40, h: 36 } as const;
