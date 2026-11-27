// A crate rider (Nov 27; Eric, Nov 9-10: riders that have nothing to do with the bosses, in the regular crates): drawn here in
// code, the boss rides' kit (./kit.ts). Notes: docs/decisions/2026-11-27-crate-riders.md.
import type { RiderDraft, RiderProps, RiderPose, RiderViewDraft, TrailProps } from "./kit.ts";
import { Region, LINE, lw } from "../item-paint.tsx";

/* The Skateboard: a deck in the item's color, kicked up at both ends, black grip tape, cream wheels. The pawn leans into it. */

const IDLE_N = 4;
const MOVE_N = 8;
const PAWN_Y = -4;
const CUT = 88;

const GRIP = "#2b2b30";
const TRUCK = "#9aa0a8";
const WHEEL = "#f3e9c6";

function pose(anim: "idle" | "move", f: number): RiderPose {
  if (anim === "idle") return { dx: 0, dy: 0, pawnX: 0, pawnY: PAWN_Y, pawnTilt: f === 2 ? 1.5 : 0, cut: CUT };
  // (Leaning into the push, a little roll over the cracks.)
  return { dx: (100 * f) / MOVE_N, dy: f % 4 === 1 ? -0.6 : 0, pawnX: 1, pawnY: PAWN_Y, pawnTilt: 5, cut: CUT };
}

const DECK = "M 6 79 Q 9 84 18 84 L 82 84 Q 91 84 94 79 L 97 80.5 Q 94 90 82 90 L 18 90 Q 6 90 3 80.5 Z";

function Wheel({ x, a }: { x: number; a: number }) {
  const r = (a * Math.PI) / 180;
  return (
    <g>
      <circle cx={x} cy={94} r={3.4} fill={WHEEL} {...LINE} {...lw(2)} />
      <circle cx={x + 1.6 * Math.cos(r)} cy={94 + 1.6 * Math.sin(r)} r={0.8} fill="#8a7f5f" />
    </g>
  );
}

function Back() {
  return null;
}

function Front({ p, anim, f }: RiderProps) {
  const a = anim === "move" ? f * 60 : 0;
  return (
    <g>
      <path d="M 20 90 L 30 90 L 27.5 92.5 L 22.5 92.5 Z M 70 90 L 80 90 L 77.5 92.5 L 72.5 92.5 Z" fill={TRUCK} {...LINE} {...lw(1.6)} />
      <Wheel x={25} a={a} />
      <Wheel x={75} a={a + 90} />
      <Region p={p} name="deck" d={[DECK]} />
      <path d="M 8 82.5 Q 11 85 18 85 L 82 85 Q 89 85 92 82.5" fill="none" stroke={GRIP} stroke-linecap="round" {...lw(1.2)} />
      <path d={DECK} fill="none" {...LINE} {...lw(2.4)} />
    </g>
  );
}

/* ---- front and back views: the board end-on ---- */

function endPose(anim: "idle" | "move", f: number): RiderPose {
  return { dx: 0, dy: anim === "move" && f % 4 === 1 ? -0.6 : 0, pawnX: 0, pawnY: PAWN_Y, pawnTilt: anim === "move" ? (f < 4 ? 1.5 : -1.5) : 0, cut: CUT };
}

const END_DECK = "M 32 83 Q 50 82 68 83 L 69 89 Q 50 90.5 31 89 Z";

function EndFront({ p }: RiderProps) {
  return (
    <g>
      <path d="M 36 89 L 64 89 L 62 91.5 L 38 91.5 Z" fill={TRUCK} {...LINE} {...lw(1.6)} />
      <rect x={30} y={90} width={6} height={7.5} rx={2.4} fill={WHEEL} {...LINE} {...lw(2)} />
      <rect x={64} y={90} width={6} height={7.5} rx={2.4} fill={WHEEL} {...LINE} {...lw(2)} />
      <Region p={p} name="deck" d={[END_DECK]} />
      <path d="M 34 84 Q 50 83 66 84" fill="none" stroke={GRIP} stroke-linecap="round" {...lw(1.2)} />
      <path d={END_DECK} fill="none" {...LINE} {...lw(2.4)} />
    </g>
  );
}

const endView: RiderViewDraft = {
  frame: [22, 6, 56, 93],
  idle: { ms: [600, 600, 250, 600] },
  move: { ms: Array(MOVE_N).fill(90) },
  pose: endPose,
  Back,
  Front: EndFront,
};

/* ---- trail: two little scuffs ---- */

function Scuff({ f }: TrailProps) {
  const a = [0.45, 0.3, 0.18, 0.06][f] ?? 0;
  return <path d="M -10 -2 L -2 -2 M 3 2 L 11 2" fill="none" stroke="#3a3a40" stroke-opacity={a} stroke-linecap="round" {...lw(1.4)} />;
}

export const skateboard: RiderDraft = {
  id: "skateboard",
  name: "Skateboard",
  tier: "mythic",
  description: "Kickflips not included. The pawn insists it can ollie a bishop.",
  frame: [2, 6, 96, 93],
  idle: { ms: [600, 600, 250, 600] },
  move: { ms: Array(MOVE_N).fill(90) },
  pose,
  Back,
  Front,
  views: { front: endView, back: endView },
  trail: { ms: [160, 150, 150, 140], w: 26, h: 10, Mark: Scuff },
};
