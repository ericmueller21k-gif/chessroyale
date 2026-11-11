/**
 * The kingpin's crew (Eric's design, Nov 10; drawn by hand on the weekly plan usage): five zebras who run "just a bakery".
 * All one zebra (zebra-rig.ts), each dressed his own way so he's known at a glance; the kingpin (boss-zebra) is the sixth.
 * Room scale, 1:1 (37 px a square). Facing our right; mirror any of them to face left. Frame 96 x 104, foot [36, 100].
 *
 * The front room's door guards (they stand, their bread rifles held across the chest):
 * - `npc-zebra-guard-a`: a tweed flat cap, dark shades, a black vest, a toothpick.
 * - `npc-zebra-guard-b`: a baker's paper cap, a black vest under a white apron, a sticking plaster on his muzzle.
 * The back room's table crew (they sit; their rolls lie on the table: ZEBRA_ROLL `table`):
 * - `npc-zebra-crew-c`: the theory nerd: a tall chef's toque, round glasses, a white apron, a pencil behind his ear.
 * - `npc-zebra-crew-d`: a grey fedora, a navy turtleneck, a scar over his eye.
 * - `npc-zebra-crew-e`: a red beanie, a mustard knit sweater vest, a red bow tie.
 *
 * Animations (cues in brackets):
 * - guards: `idle` (= `guard`), `guard` (loops: standing, the roll across the chest, a breath, a blink, a glance; guard A's
 *   toothpick flicks [flick]), `watch` (5 frames, NOT played as an animation: the code shows one by where you are, see
 *   ZEBRA_WATCH_FRAME).
 * - table crew: `idle` (= `sitListen`), `sitTalk` (loops: gestures, mouth going), `sitListen` (loops: arms folded, a nod, a
 *   blink), `sitArgue` (loops: brows down, a jab at the table [tap], a head shake), `sitPuff` (loops: a warm breadstick clamped
 *   like a cigar, a curl of steam), `standUp` (once: up off the seat, the roll picked up off the table, ending in `draw`'s
 *   first frame).
 * - all five: `draw` (once: the roll pulled up from his side, swung round and pointed at you [draw]), `aim` (loops: holding the
 *   point, a squint, a twitch), `lower` (once: relaxes, the roll down, ending pointed at the floor), `puff` (loops: standing,
 *   the roll down at his side in his far hoof, a breadstick in his teeth, a curl of steam [puff]).
 */
import type { Anim, Character, Frame } from "../../characters/sprite.ts";
import { ARMS, breadstick, FOOT, frame, H, PARTS, steam, W, ZEBRA_PALETTE, type Look, type Pose, type Pt } from "./zebra-rig.ts";

export const LOOKS = {
  guardA: { id: "zga", hat: "flat", top: "black", shades: true, toothpick: true, seed: 2 },
  guardB: { id: "zgb", hat: "paper", top: "blackApron", plaster: true, seed: 3 },
  crewC: { id: "zcc", hat: "toque", top: "apron", glasses: true, pencil: true, seed: 4 },
  crewD: { id: "zcd", hat: "fedoraGrey", top: "turtle", scar: true, seed: 5 },
  crewE: { id: "zce", hat: "beanie", top: "mustard", bowtie: true, seed: 6 },
} as const satisfies Record<string, Look>;

// ---- The roll's places (the near hoof from the near shoulder, its angle).

/** Port arms: across the chest, pointing up and forward. */
export const PORT: Pose["gun"] = { deg: -50, at: [3, 13], both: true };
/** At his side, hanging from the near hoof (to be drawn). */
const SIDE: Pose["gun"] = { deg: 78, at: [3, 14], grip: 9 };
/** Pointed at you, level, at the shoulder. */
export const AIM: Pose["gun"] = { deg: 0, at: [4, 2], both: true };
/** Lowered, pointing at the floor in front. */
const DOWN: Pose["gun"] = { deg: 62, at: [3, 12], both: true };
/** Down at his side in the far hoof (his near hoof free). */
const FAR_SIDE: Pose["gun"] = { deg: 112, at: [-2, 14], grip: 9, farHold: true };
const SEAT = 11;

const char = (id: string, name: string, anims: Record<string, Anim>): Character => ({
  id,
  name,
  w: W,
  h: H,
  foot: FOOT,
  palette: ZEBRA_PALETTE,
  halo: "#3a3440",
  parts: PARTS,
  anims,
});

// ---- Shared moves.

function guardAnim(look: Look): Anim {
  const pick = !!look.toothpick;
  return {
    loop: true,
    frames: Array.from({ length: 10 }, (_, i) =>
      frame(look, i === 4 ? 110 : i === 7 ? 140 : 220, {
        gun: PORT,
        bob: i % 5 === 2 || i % 5 === 3 ? 1 : 0,
        eyes: i === 4 ? "blink" : i >= 7 && i <= 8 ? "back" : "open",
        hx: i >= 7 && i <= 8 ? -1 : 0,
        mouth: "flat",
        brows: "down",
        pick: pick && i === 6 ? 1 : pick && i === 7 ? 0.5 : 0,
      }, pick && i === 6 ? { cue: "flick" } : {}),
    ),
  };
}
/** The guard's look by where you are: far behind him (0) to far ahead (4). */
function watchAnim(look: Look): Anim {
  const step: Pose[] = [
    { eyes: "back", hx: -2, hy: 0 },
    { eyes: "back", hx: -1 },
    { eyes: "open" },
    { eyes: "fwd", hx: 1 },
    { eyes: "fwd", hx: 2, hy: 1 },
  ];
  return { loop: false, frames: step.map((s) => frame(look, 200, { gun: PORT, brows: "down", mouth: "flat", ...s })) };
}
/** Stood, the roll at his side; pulled up, swung round and pointed (cue `draw` as it swings). Ends on `aim`'s first frame. */
function drawAnim(look: Look, from: Pose["gun"] = SIDE): Anim {
  const f = (ms: number, p: Pose, cue?: string) => frame(look, ms, { brows: "down", mouth: "flat", ...p }, cue ? { cue } : {});
  return {
    loop: false,
    frames: [
      f(140, { gun: from, eyes: "fwd" }),
      f(90, { gun: { deg: 40, at: [6, 9], grip: 4 }, eyes: "fwd", bob: 1 }, "draw"),
      f(80, { gun: { deg: 8, at: [6, 4], both: true }, eyes: "mad", feet: [[-5, 0], [5, 0]] }),
      f(90, { gun: { ...AIM!, at: [5, 2] }, eyes: "mad", feet: [[-5, 0], [5, 0]], mouth: "grit" }),
      f(200, { gun: AIM, eyes: "mad", feet: [[-5, 0], [5, 0]], mouth: "grit", hx: 1 }),
    ],
  };
}
function aimAnim(look: Look): Anim {
  return {
    loop: true,
    frames: Array.from({ length: 8 }, (_, i) =>
      frame(look, i === 5 ? 120 : 200, {
        gun: { ...AIM!, at: [4, 2 + (i % 4 === 2 ? 1 : 0)] },
        eyes: i === 5 ? "blink" : "mad",
        mouth: i === 3 ? "grit" : "flat",
        feet: [[-5, 0], [5, 0]],
        hx: 1,
        bob: i % 4 === 2 ? 1 : 0,
      }),
    ),
  };
}
function lowerAnim(look: Look): Anim {
  const f = (ms: number, p: Pose) => frame(look, ms, { feet: [[-5, 0], [5, 0]], ...p });
  return {
    loop: false,
    frames: [
      f(160, { gun: AIM, eyes: "open", mouth: "flat", hx: 1 }),
      f(120, { gun: { deg: 25, at: [4, 6], both: true }, eyes: "open", mouth: "flat" }),
      f(120, { gun: { deg: 50, at: [3, 10], both: true }, eyes: "blink", mouth: "flat", bob: 1 }),
      f(260, { gun: DOWN, eyes: "open", mouth: "smile", feet: [[-4, 0], [4, 0]] }),
    ],
  };
}
/** The breadstick, steaming: in his teeth for the loop; `seated` for the table crew. */
function puffAnim(look: Look, seated: boolean): Anim {
  const base: Pose = seated ? { sit: SEAT, armF: ARMS.fold, armN: ARMS.foldN } : { gun: FAR_SIDE, armN: ARMS.hangN };
  return {
    loop: true,
    frames: Array.from({ length: 10 }, (_, i) => {
      const draw = i === 2 || i === 3; // a draw on it: eyes half shut, a little bob
      const p: Pose = { ...base, eyes: draw ? "half" : i === 8 ? "blink" : "open", mouth: "flat", bob: draw ? 1 : 0, hy: draw ? -1 : 0 };
      return frame(look, i === 3 ? 260 : 190, p, {
        ...(i === 4 ? { cue: "puff" } : {}),
        specks: (b) => {
          const st = breadstick(b.mouth, draw ? 0.6 : 0);
          return [...st.specks, ...steam(st.tip, i - 4), ...(i === 0 ? steam(st.tip, 5) : [])];
        },
      });
    }),
  };
}

// ---- The guards.

function guard(look: Look, id: string, name: string): Character {
  const g = guardAnim(look);
  return char(id, name, { idle: g, guard: g, watch: watchAnim(look), draw: drawAnim(look, PORT), aim: aimAnim(look), lower: lowerAnim(look), puff: puffAnim(look, false) });
}
export const NPC_ZEBRA_GUARD_A = guard(LOOKS.guardA, "npc-zebra-guard-a", "The bakery's door guard (flat cap)");
export const NPC_ZEBRA_GUARD_B = guard(LOOKS.guardB, "npc-zebra-guard-b", "The bakery's door guard (paper cap)");

// ---- The table crew.

const sitF = (look: Look, ms: number, p: Pose, extra: Parameters<typeof frame>[3] = {}): Frame => frame(look, ms, { sit: SEAT, armF: ARMS.fold, armN: ARMS.foldN, ...p }, extra);
/** Talking: gestures with the near hoof, the mouth going. */
function sitTalkAnim(look: Look, seed: number): Anim {
  const arms: (readonly [Pt, Pt])[] = [ARMS.open, ARMS.shrug, ARMS.open, ARMS.point, ARMS.calmLow, ARMS.open];
  return {
    loop: true,
    frames: Array.from({ length: 12 }, (_, i) =>
      sitF(look, 160, {
        armN: arms[(i + seed) % arms.length]!,
        armF: i % 6 < 3 ? ARMS.fold : ARMS.hip,
        mouth: i % 2 ? "open" : i % 4 === 0 ? "flat" : "smile",
        eyes: i === 9 ? "blink" : i % 6 === 4 ? "up" : "fwd",
        brows: i % 6 === 3 ? "up" : undefined,
        hx: i % 6 === 3 ? 1 : 0,
        hy: i % 4 === 1 ? 1 : 0,
      }),
    ),
  };
}
function sitListenAnim(look: Look): Anim {
  return {
    loop: true,
    frames: Array.from({ length: 10 }, (_, i) =>
      sitF(look, i === 6 ? 110 : 230, {
        mouth: i >= 3 && i <= 4 ? "smile" : "flat",
        eyes: i === 6 ? "blink" : i === 8 ? "back" : "fwd",
        hy: i === 3 ? 2 : i === 4 ? 1 : 0, // a nod
        bob: i % 5 === 2 ? 1 : 0,
      }),
    ),
  };
}
/** Arguing: brows down, a jab at the table (cue `tap`), a head shake, "no, no, the knight goes to f3". */
function sitArgueAnim(look: Look): Anim {
  const f = (ms: number, p: Pose, cue?: string) => sitF(look, ms, { brows: "down", eyes: "mad", ...p }, cue ? { cue } : {});
  return {
    loop: true,
    frames: [
      f(170, { armN: ARMS.pokeUp, mouth: "open", hx: 1 }),
      f(110, { armN: ARMS.poke, mouth: "grit", hx: 2, hy: 1 }, "tap"),
      f(150, { armN: ARMS.pokeUp, mouth: "open", hx: 1 }),
      f(110, { armN: ARMS.poke, mouth: "open", hx: 2, hy: 1 }, "tap"),
      f(170, { armN: ARMS.open, mouth: "frown", hx: 0 }),
      f(140, { armN: ARMS.open, mouth: "frown", hx: -1 }),
      f(140, { armN: ARMS.open, mouth: "frown", hx: 1 }),
      f(140, { armN: ARMS.open, mouth: "frown", hx: -1 }),
      f(200, { armN: ARMS.shrug, armF: ARMS.hip, mouth: "open", brows: "up", eyes: "fwd" }),
      f(200, { armN: ARMS.shrug, armF: ARMS.hip, mouth: "pout", brows: "up", eyes: "up" }),
    ],
  };
}
/** Up off the seat: a lean forward, hoof to the table for the roll, up on his feet; ends on `draw`'s first frame. */
function standUpAnim(look: Look): Anim {
  return {
    loop: false,
    frames: [
      sitF(look, 120, { eyes: "wide", brows: "up", mouth: "o" }),
      sitF(look, 110, { armN: ARMS.poke, hx: 2, hy: 1, eyes: "fwd", brows: "down" }),
      frame(look, 100, { sit: 5, gun: { deg: 35, at: [8, 8], grip: 8 }, feet: [[-2, 0], [2, 0]], eyes: "fwd", brows: "down", hy: 1 }),
      frame(look, 140, { gun: SIDE, eyes: "fwd", brows: "down", mouth: "flat" }),
    ],
  };
}
function tableCrew(look: Look, id: string, name: string, seed: number): Character {
  const listen = sitListenAnim(look);
  return char(id, name, {
    idle: listen,
    sitTalk: sitTalkAnim(look, seed),
    sitListen: listen,
    sitArgue: sitArgueAnim(look),
    sitPuff: puffAnim(look, true),
    standUp: standUpAnim(look),
    draw: drawAnim(look),
    aim: aimAnim(look),
    lower: lowerAnim(look),
    puff: puffAnim(look, false),
  });
}
export const NPC_ZEBRA_CREW_C = tableCrew(LOOKS.crewC, "npc-zebra-crew-c", "The bakery's table crew (toque, glasses)", 0);
export const NPC_ZEBRA_CREW_D = tableCrew(LOOKS.crewD, "npc-zebra-crew-d", "The bakery's table crew (grey fedora)", 2);
export const NPC_ZEBRA_CREW_E = tableCrew(LOOKS.crewE, "npc-zebra-crew-e", "The bakery's table crew (beanie, bow tie)", 4);

/**
 * The guard's `watch`: which frame to show for where you are. `dx` is your x minus his, in squares, as he faces (negate it
 * for a mirrored guard): far behind him (-3 or more) frame 0, behind 1, level with him 2, ahead 3, far ahead (3 or more) 4.
 */
export function ZEBRA_WATCH_FRAME(dx: number): number {
  return Math.max(0, Math.min(4, 2 + Math.round(dx / 1.5)));
}
