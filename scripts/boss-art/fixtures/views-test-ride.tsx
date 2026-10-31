/**
 * A test fixture, not art: a plain little pony with a side, front and back view, to check the rider harness's
 * three-view renders (item-render.ts, `mode: "rider"`, `view: "all"`) and the contact sheet. Not for the game.
 *   npx tsx scripts/boss-art/item-render.ts '{"draft":"scripts/boss-art/fixtures/views-test-ride.tsx","mode":"rider","view":"all","out":"<dir>"}'
 */
import { LINE, Region, darken, lw, mirror, type RiderDraft, type RiderPose, type RiderProps, type RiderViewDraft } from "../item-kit.tsx";

const COAT = "#c99a6b";
const COAT_D = darken(COAT, 0.25);
const MANE = "#5a3a22";
const HOOF = "#2f2622";

/** One frame: a body bob and the legs' swing (side, degrees) or lift (front and back, units). */
interface St {
  bob: number;
  a: number;
  b: number;
  blink?: boolean;
}
const IDLE: St[] = [{ bob: 0, a: 0, b: 0 }, { bob: 0.8, a: 0, b: 0 }, { bob: 1.2, a: 0, b: 0, blink: true }, { bob: 0.6, a: 0, b: 0 }];
const IDLE_MS = [400, 250, 120, 250];
const MOVE: St[] = [
  { bob: 0, a: 18, b: -18 },
  { bob: -2, a: 8, b: -8 },
  { bob: -3, a: -10, b: 10 },
  { bob: -1, a: -18, b: 18 },
  { bob: -2, a: -6, b: 6 },
  { bob: 0, a: 12, b: -12 },
];
const MOVE_MS = [90, 90, 90, 90, 90, 90];
const st = (anim: "idle" | "move", f: number) => (anim === "idle" ? IDLE : MOVE)[f] ?? IDLE[0]!;

function SideLeg({ x, ang, fill }: { x: number; ang: number; fill: string }) {
  return (
    <g transform={`rotate(${ang} ${x} 72)`}>
      <path d={`M ${x - 4} 70 L ${x + 4} 70 L ${x + 3.5} 92 L ${x - 3.5} 92 Z`} fill={fill} {...LINE} />
      <path d={`M ${x - 4.2} 91 L ${x + 4.2} 91 L ${x + 4.2} 96 L ${x - 4.2} 96 Z`} fill={HOOF} {...LINE} {...lw(2)} />
    </g>
  );
}
/** A leg seen end-on (front or back view): lifted `up` units as it steps. */
function EndLeg({ x, up, fill }: { x: number; up: number; fill: string }) {
  return (
    <g transform={`translate(0 ${-up})`}>
      <path d={`M ${x - 4.5} 74 L ${x + 4.5} 74 L ${x + 4} 92 L ${x - 4} 92 Z`} fill={fill} {...LINE} />
      <path d={`M ${x - 4.6} 91 L ${x + 4.6} 91 L ${x + 4.6} 96 L ${x - 4.6} 96 Z`} fill={HOOF} {...LINE} {...lw(2)} />
    </g>
  );
}
const Eye = ({ x, y, blink }: { x: number; y: number; blink?: boolean }) =>
  blink ? <path d={`M ${x - 2.4} ${y} Q ${x} ${y + 2} ${x + 2.4} ${y}`} fill="none" {...LINE} {...lw(1.6)} /> : <circle cx={x} cy={y} r="2.2" fill="#1d1d1f" />;

// ---- Side: facing right.
function SideBack({ anim, f }: RiderProps) {
  const s = st(anim, f);
  return (
    <g>
      <SideLeg x={34} ang={s.b} fill={COAT_D} />
      <SideLeg x={66} ang={s.a} fill={COAT_D} />
    </g>
  );
}
function SideFront({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  return (
    <g>
      <SideLeg x={30} ang={s.a} fill={COAT} />
      <SideLeg x={70} ang={s.b} fill={COAT} />
      <g transform={`translate(0 ${s.bob})`}>
        <path d="M 18 62 Q 6 66 10 80" fill="none" stroke={MANE} stroke-linecap="round" {...lw(5)} />
        <ellipse cx="50" cy="68" rx="34" ry="15" fill={COAT} {...LINE} />
        <path d="M 74 60 L 84 42 L 94 46 L 84 66 Z" fill={COAT} {...LINE} />
        <ellipse cx="91" cy="46" rx="10" ry="7" fill={COAT} {...LINE} />
        <path d="M 80 40 Q 76 50 78 60" fill="none" stroke={MANE} stroke-linecap="round" {...lw(4)} />
        <Eye x={90} y={43} blink={s.blink} />
        <Region p={p} name="blanket" d={["M 28 56 Q 50 50 72 56 L 70 72 Q 50 76 30 72 Z"]} />
      </g>
    </g>
  );
}

// ---- Front: coming toward us. Behind the pawn, the top of its back; in front, its head, chest and front legs.
function FrontBack({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  return (
    <g transform={`translate(0 ${s.bob})`}>
      <ellipse cx="50" cy="60" rx="22" ry="8" fill={COAT_D} {...LINE} />
      <Region p={p} name="back-blanket" d={["M 31 58 Q 50 52 69 58 L 69 62 Q 50 66 31 62 Z"]} line={2} />
    </g>
  );
}
function FrontFront({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  const lift = (x: number) => (anim === "move" ? Math.max(0, x / 3) : 0);
  return (
    <g>
      <EndLeg x={38} up={lift(s.a)} fill={COAT} />
      <EndLeg x={62} up={lift(s.b)} fill={COAT} />
      <g transform={`translate(0 ${s.bob})`}>
        <ellipse cx="50" cy="74" rx="24" ry="12" fill={COAT} {...LINE} />
        <Region p={p} name="flaps" d={["M 24 62 L 34 62 L 34 78 L 24 76 Z", mirror("M 24 62 L 34 62 L 34 78 L 24 76 Z")]} line={2} />
        <path d="M 42 52 L 38 44 L 45 48 Z M 58 52 L 62 44 L 55 48 Z" fill={COAT} {...LINE} {...lw(2)} />
        <ellipse cx="50" cy="62" rx="11" ry="12" fill={COAT} {...LINE} />
        <path d="M 44 51 Q 50 47 56 51 Q 50 55 44 51 Z" fill={MANE} {...LINE} {...lw(1.6)} />
        <ellipse cx="50" cy="69" rx="7" ry="5" fill={darken(COAT, 0.12)} {...LINE} {...lw(1.6)} />
        <Eye x={45} y={60} blink={s.blink} />
        <Eye x={55} y={60} blink={s.blink} />
      </g>
    </g>
  );
}

// ---- Back: going away. Behind the pawn, its ears and the top of its head; in front, its rump, tail and hind legs.
function BackBack({ anim, f }: RiderProps) {
  const s = st(anim, f);
  return (
    <g transform={`translate(0 ${s.bob})`}>
      <ellipse cx="50" cy="52" rx="14" ry="8" fill={COAT_D} {...LINE} />
      <path d="M 38 50 L 28 38 L 40 44 Z M 62 50 L 72 38 L 60 44 Z" fill={COAT_D} {...LINE} {...lw(2)} />
    </g>
  );
}
function BackFront({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  const lift = (x: number) => (anim === "move" ? Math.max(0, x / 3) : 0);
  return (
    <g>
      <EndLeg x={38} up={lift(s.b)} fill={COAT} />
      <EndLeg x={62} up={lift(s.a)} fill={COAT} />
      <g transform={`translate(0 ${s.bob})`}>
        <ellipse cx="50" cy="72" rx="25" ry="15" fill={COAT} {...LINE} />
        <Region p={p} name="cantle" d={["M 30 60 Q 50 66 70 60 L 70 66 Q 50 72 30 66 Z"]} line={2} />
        <path d={`M 50 68 Q ${50 + s.a / 4} 80 ${50 + s.a / 3} 90`} fill="none" stroke={MANE} stroke-linecap="round" {...lw(5)} />
      </g>
    </g>
  );
}

const pose = (anim: "idle" | "move", f: number, travel: boolean): RiderPose => {
  const s = st(anim, f);
  const n = MOVE.length - 1;
  return { dx: travel && anim === "move" ? (f / n) * 100 : 0, dy: 0, pawnX: 0, pawnY: -18 + s.bob, cut: 68 };
};
const view = (Back: RiderViewDraft["Back"], Front: RiderViewDraft["Front"], frame: [number, number, number, number]): RiderViewDraft => ({
  frame,
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: (anim, f) => pose(anim, f, false),
  Back,
  Front,
});

export const viewsTestRide: RiderDraft = {
  id: "views-test-ride",
  name: "Views Test Pony",
  tier: "mythic",
  description: "A fixture for the three-view renders.",
  frame: [6, 2, 98, 96],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: (anim, f) => pose(anim, f, true),
  Back: SideBack,
  Front: SideFront,
  views: {
    front: view(FrontBack, FrontFront, [24, 2, 52, 96]),
    back: view(BackBack, BackFront, [24, 2, 52, 96]),
  },
};
