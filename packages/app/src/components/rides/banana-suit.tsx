// The Banana Suit (Nov 10; the brief's mockup v3 on claude/director-notes: notes/assets/banana-suit-mockup-v3.html), the first
// outfit (crates.ts, slot `outfit`). Drawn with the rides' kit (./kit.ts): an outfit is drawn the way a ride is, the pawn between
// its Back and its Front, so every place that draws a rider draws it (docs/decisions/2026-11-10-outfit-slot.md). The pawn's own
// head shows in the face hole (everything below it is hidden: the pose's `cut`), and an eyewear item over it (core: `shownLook`).
// The peel takes the item's color; the stem, the face hole, the limbs, the gloves and the shoes are fixed.
import type { ComponentChildren } from "preact";
import type { RiderDraft, RiderPose, RiderProps, RiderViewDraft } from "./kit.ts";
import { LINE, Region, darken, lighten, lw, type Paint } from "../item-paint.tsx";

const INK = "#1d1d1f";
const STEM = "#7a5524";
const TIP = "#6b4a1f";
const RIM = "#6b4a1f";
const HOLE = "#8a6a3c";
const SOLE = "#c9ced6";

/** The peel (front and side alike), on the pawn's square: its top near y 3, its tip at y 76, the face hole round (50, 28). */
const PEEL = "M 48 4 C 30 14 26 48 38 70 C 42 77 56 78 60 71 C 72 50 72 18 56 5 C 54 3 50 3 48 4 Z";
const STEM_D = "M 49.5 6 C 48.5 0 52 -4 58 -5 L 59.5 -1.5 C 55 -1 54 2 54.5 6 Z";
const TIP_D = "M 44 73 C 47 80 55 80 58 73 C 55 76.5 47 76.5 44 73 Z";
/** The face hole: where the pawn's head shows, front and side (toward the front). */
const HOLE_AT = { front: [50, 28], side: [57, 28] } as const;
/** The body leans this much (degrees, round its middle) as it runs side-on. */
const LEAN = 10;
const MID: [number, number] = [50, 50];

/** A point turned `deg` round `c`. */
const turn = ([x, y]: readonly [number, number], deg: number, c = MID): [number, number] => {
  const a = (deg * Math.PI) / 180;
  const dx = x - c[0];
  const dy = y - c[1];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The suit itself: the peel (painted), its ridges and light, the stem, the tip and (front or side) the face hole. */
function Suit({ p, hole }: { p: Paint; hole: "front" | "side" | null }) {
  const ridge = darken(p.hex, 0.2);
  const over = (
    <>
      <path d="M 44 8 C 33 28 33 56 45 75" fill="none" stroke={ridge} stroke-width="2.6" stroke-linecap="round" />
      <path d="M 57 8 C 67 28 67 56 56 75" fill="none" stroke={ridge} stroke-width="2.2" stroke-linecap="round" />
      <path d="M 36 24 C 33 40 34 54 38.5 64" fill="none" stroke={lighten(p.hex, 0.6)} stroke-width="2.4" stroke-linecap="round" opacity="0.8" />
    </>
  );
  const [hx, hy] = hole ? HOLE_AT[hole] : [0, 0];
  return (
    <g>
      <path d={STEM_D} fill={STEM} {...LINE} {...lw(2)} />
      <Region p={p} name="peel" d={[PEEL]} over={over} line={2.6} />
      <path d={TIP_D} fill={TIP} {...LINE} {...lw(1.6)} />
      {hole && (
        <>
          <ellipse cx={hx} cy={hy} rx={hole === "front" ? 12.8 : 11.2} ry={14} fill={RIM} {...LINE} {...lw(2.2)} />
          <circle cx={hx} cy={hy} r={9.8} fill={HOLE} />
        </>
      )}
      {!hole && <path d="M 50 8 C 49 30 49 54 50.5 74" fill="none" stroke={darken(p.hex, 0.3)} stroke-width="1.4" stroke-linecap="round" opacity="0.7" />}
    </g>
  );
}

/** A limb: a thin black line through its joints. */
const limb = (pts: readonly (readonly [number, number])[], w = 2.2) => (
  <path d={`M ${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(" L ")}`} fill="none" stroke={INK} stroke-linecap="round" stroke-linejoin="round" {...lw(w)} />
);

/** A big white cartoon glove, open (standing), its wrist at (x, y). `flip`: the right hand. */
function Glove({ x, y, rot = 0, flip = false }: { x: number; y: number; rot?: number; flip?: boolean }) {
  const k = 0.38;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)}) rotate(${rot}) scale(${flip ? -k : k} ${k})`}>
      <path d="M -13 -6 C -17 -14 -10 -20 -4 -16 C -3 -23 5 -23 6 -16 C 9 -21 16 -18 14 -11 C 19 -12 21 -5 16 -1 C 17 6 10 13 1 13 C -9 13 -16 6 -13 -6 Z" transform="translate(0 10)" fill="#fff" stroke={INK} stroke-linejoin="round" {...lw(1.7 / k)} />
      <path d="M -4 -16 L -3 -6 M 6 -16 L 5 -6 M 14 -11 L 11 -3" transform="translate(0 10)" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.1 / k)} />
    </g>
  );
}

/** A glove balled into a fist (running), centered on (x, y). */
function Fist({ x, y }: { x: number; y: number }) {
  const k = 0.36;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)}) scale(${k})`}>
      <path d="M -11 -8 C -11 -15 11 -15 11 -8 C 14 -4 14 6 9 9 C 3 13 -6 13 -10 8 C -14 4 -14 -3 -11 -8 Z" fill="#fff" stroke={INK} stroke-linejoin="round" {...lw(1.7 / k)} />
      <path d="M -6 -11 L -6 -3 M 0 -12 L 0 -3 M 6 -11 L 6 -3" fill="none" stroke={INK} stroke-linecap="round" {...lw(1 / k)} />
    </g>
  );
}

/** A big white cartoon shoe, its ankle at (x, y), toe to the right (`flip`: to the left), turned `rot` round the ankle. */
function Shoe({ x, y, rot = 0, flip = false, k = 0.42 }: { x: number; y: number; rot?: number; flip?: boolean; k?: number }) {
  return (
    <g transform={`translate(${r2(x)} ${r2(y)}) rotate(${rot}) scale(${flip ? -k : k} ${k}) translate(-2 10)`}>
      <path d="M -14 -7 C -14 -14 -4 -15 2 -11 C 10 -10 20 -7 21 1 C 22 7 16 9 8 9 L -12 9 C -18 9 -19 2 -14 -7 Z" fill="#fff" stroke={INK} stroke-linejoin="round" {...lw(1.7 / k)} />
      <path d="M -15 4 L 20 4" stroke={SOLE} stroke-linecap="round" {...lw(1.1 / k)} />
      <path d="M 2 -9 C 4 -4 7 -3 10 -4" fill="none" stroke={INK} stroke-linecap="round" {...lw(1 / k)} />
    </g>
  );
}

// ---------------- Standing, facing us (every view's idle): a slow two-frame bounce ----------------

/** Idle frame 0: knees bent, the suit a little lower, arms a touch out. Frame 1: up a little, legs straight, arms in. */
const IDLE = [
  { dip: 2.5, knee: 3.5, hand: 4 },
  { dip: 0, knee: 0.8, hand: 0 },
] as const;
const IDLE_MS = [650, 650];

/** The legs and shoes standing (the ground at y 98), the suit `dip` lower, knees out by `knee`. */
const standingLegs = (dip: number, knee: number) => (
  <g>
    <path d={`M 44 ${72 + dip} C ${41 - knee} ${80 + dip / 2} ${43} 86 42.5 91`} fill="none" stroke={INK} stroke-linecap="round" {...lw(2.2)} />
    <path d={`M 56 ${72 + dip} C ${59 + knee} ${80 + dip / 2} ${57} 86 57.5 91`} fill="none" stroke={INK} stroke-linecap="round" {...lw(2.2)} />
    <Shoe x={42.5} y={90} flip />
    <Shoe x={57.5} y={90} />
  </g>
);

/** The arms down its sides, gloves open, `hand` out from the body. */
const standingArms = (dip: number, hand: number) => (
  <g>
    {limb([[32, 46 + dip], [28 - hand / 2, 54 + dip], [26 - hand, 61 + dip]])}
    {limb([[68, 46 + dip], [72 + hand / 2, 54 + dip], [74 + hand, 61 + dip]])}
    <Glove x={26 - hand} y={61 + dip} rot={10 + hand * 2} />
    <Glove x={74 + hand} y={61 + dip} rot={-10 - hand * 2} flip />
  </g>
);

function StandBack({ p, f, hole }: { p: Paint; f: number; hole: "front" | null }) {
  const s = IDLE[f % 2]!;
  return (
    <g>
      {standingLegs(s.dip, s.knee)}
      <g transform={`translate(0 ${s.dip})`}>
        <Suit p={p} hole={hole} />
      </g>
    </g>
  );
}
const StandFront = ({ f }: { f: number }) => standingArms(IDLE[f % 2]!.dip, IDLE[f % 2]!.hand);

/** The pawn's head in the face hole (front), or hidden whole (back: cut 0). */
const facePose = (dip: number, hidden: boolean): RiderPose => ({ dx: 0, dy: 0, pawnX: HOLE_AT.front[0] - 50, pawnY: HOLE_AT.front[1] - 29 + dip, cut: hidden ? 0 : 36.5 });

// ---------------- Running side-on (facing right): a real sprint, four frames ----------------

type Pt = readonly [number, number];
/** One sprint frame: the body's bob (negative is up); each leg (hip, knee, ankle, the shoe's turn) and arm (shoulder, elbow, fist). */
interface Stride {
  bob: number;
  near: { knee: Pt; ankle: Pt; shoe: number };
  far: { knee: Pt; ankle: Pt; shoe: number };
  nearArm: { elbow: Pt; fist: Pt };
  farArm: { elbow: Pt; fist: Pt };
}
const FORWARD = { knee: [57, 78], ankle: [56, 92], shoe: 0 } as const;
const KICKED = { knee: [36, 80], ankle: [27, 75], shoe: -60 } as const;
const PLANTED = { knee: [48, 81], ankle: [46, 92], shoe: 0 } as const;
const THROUGH = { knee: [56, 76], ankle: [49, 85], shoe: 20 } as const;
const PUMP_UP = { elbow: [60, 55], fist: [66, 48] } as const;
const PUMP_BACK = { elbow: [42, 55], fist: [35, 50] } as const;
const PASS_FWD = { elbow: [56, 58], fist: [62, 56] } as const;
const PASS_BACK = { elbow: [47, 58], fist: [41, 56] } as const;
const SPRINT: readonly Stride[] = [
  // Stride: the near knee forward, the back foot up; arms the other way.
  { bob: 0, near: FORWARD, far: KICKED, nearArm: PUMP_BACK, farArm: PUMP_UP },
  // Passing: the far knee comes through high (the body at its highest).
  { bob: -3, near: PLANTED, far: THROUGH, nearArm: PASS_BACK, farArm: PASS_FWD },
  // The other stride.
  { bob: 0, near: KICKED, far: FORWARD, nearArm: PUMP_UP, farArm: PUMP_BACK },
  // Passing the other way: the near knee through.
  { bob: -3, near: THROUGH, far: PLANTED, nearArm: PASS_FWD, farArm: PASS_BACK },
];
const RUN_MS = [95, 95, 95, 95];
/** Its hip and shoulder as it leans (side-on), before the bob. */
const HIP = turn([48, 70], LEAN);
const SHOULDER = turn([51, 45], LEAN);
const HOLE_SIDE = turn(HOLE_AT.side, LEAN);

const runLeg = (bob: number, l: Stride["near"], w: number) => (
  <g>
    {limb([[HIP[0], HIP[1] + bob], [l.knee[0], l.knee[1] + bob], [l.ankle[0], l.ankle[1] + (l.shoe === 0 ? 0 : bob)]], w)}
    <Shoe x={l.ankle[0]} y={l.ankle[1] + (l.shoe === 0 ? 0 : bob)} rot={l.shoe} />
  </g>
);
const runArm = (bob: number, a: Stride["nearArm"], w: number) => (
  <g>
    {limb([[SHOULDER[0], SHOULDER[1] + bob], [a.elbow[0], a.elbow[1] + bob], [a.fist[0], a.fist[1] + bob]], w)}
    <Fist x={a.fist[0]} y={a.fist[1] + bob} />
  </g>
);

// ---------------- Running toward us or away (front and back views): knees up in turn, fists pumping ----------------

/** Each frame: how high each knee is (0 down), and which fist is up (1: ours left, -1: ours right, 0: both at the middle). */
const END_RUN = [
  { bob: 0, left: 5, right: 0, arm: 1 },
  { bob: -2.5, left: 0, right: 0, arm: 0 },
  { bob: 0, left: 0, right: 5, arm: -1 },
  { bob: -2.5, left: 0, right: 0, arm: 0 },
] as const;

const endLegs = (f: number) => {
  const r = END_RUN[f % 4]!;
  const leg = (hx: number, sx: number, up: number, flip: boolean) => (
    <g>
      {limb([[hx, 72 + r.bob], [hx + (flip ? -1 : 1) * (up ? 2 : 1), 82 + r.bob - up], [sx, 91 - up * 1.2]])}
      <Shoe x={sx} y={90 - up * 1.2} flip={flip} k={up ? 0.45 : 0.42} />
    </g>
  );
  return (
    <g>
      {leg(44, 42.5, r.left, true)}
      {leg(56, 57.5, r.right, false)}
    </g>
  );
};
const endArms = (f: number) => {
  const r = END_RUN[f % 4]!;
  const arm = (sx: number, out: number, up: number) => {
    const ey = 56 + r.bob - up * 2;
    const fy = 60 + r.bob - up * 9;
    return (
      <g>
        {limb([[sx, 46 + r.bob], [sx + out * 5, ey], [sx + out * 3, fy]])}
        <Fist x={sx + out * 3} y={fy} />
      </g>
    );
  };
  return (
    <g>
      {arm(32, -1, r.arm === 1 ? 1 : r.arm === 0 ? 0.4 : 0)}
      {arm(68, 1, r.arm === -1 ? 1 : r.arm === 0 ? 0.4 : 0)}
    </g>
  );
};

function endView(view: "front" | "back"): RiderViewDraft {
  const hidden = view === "back";
  return {
    frame: [14, -6, 72, 105],
    idle: { ms: IDLE_MS },
    move: { ms: RUN_MS },
    pose(anim, f) {
      return anim === "move" ? facePose(END_RUN[f % 4]!.bob, hidden) : facePose(IDLE[f % 2]!.dip, hidden);
    },
    Back({ p, f, anim }: RiderProps) {
      if (anim === "idle") return <StandBack p={p} f={f} hole={hidden ? null : "front"} />;
      const bob = END_RUN[f % 4]!.bob;
      return (
        <g>
          {endLegs(f)}
          <g transform={`translate(0 ${bob})`}>
            <Suit p={p} hole={hidden ? null : "front"} />
          </g>
        </g>
      );
    },
    Front({ f, anim }: RiderProps): ComponentChildren {
      return anim === "idle" ? <StandFront f={f} /> : endArms(f);
    },
  };
}

export const bananaSuit: RiderDraft = {
  id: "banana-suit",
  name: "Banana Suit",
  tier: "epic",
  description: "Fully committed to the bit. Opponents keep slipping up.",
  frame: [14, -6, 72, 105],
  idle: { ms: IDLE_MS },
  move: { ms: RUN_MS },
  pose(anim, f) {
    if (anim === "idle") return facePose(IDLE[f % 2]!.dip, false);
    const bob = SPRINT[f % 4]!.bob;
    return { dx: (f % 4) * 25, dy: 0, pawnX: r2(HOLE_SIDE[0] - 50), pawnY: r2(HOLE_SIDE[1] - 29 + bob), cut: 36.5 };
  },
  Back({ p, f, anim }: RiderProps) {
    if (anim === "idle") return <StandBack p={p} f={f} hole="front" />;
    const s = SPRINT[f % 4]!;
    return (
      <g>
        {runArm(s.bob, s.farArm, 2)}
        {runLeg(s.bob, s.far, 2)}
        <g transform={`translate(0 ${s.bob}) rotate(${LEAN} ${MID[0]} ${MID[1]})`}>
          <Suit p={p} hole="side" />
        </g>
      </g>
    );
  },
  Front({ f, anim }: RiderProps) {
    if (anim === "idle") return <StandFront f={f} />;
    const s = SPRINT[f % 4]!;
    return (
      <g>
        {runLeg(s.bob, s.near, 2.3)}
        {runArm(s.bob, s.nearArm, 2.3)}
      </g>
    );
  },
  views: { front: endView("front"), back: endView("back") },
};
