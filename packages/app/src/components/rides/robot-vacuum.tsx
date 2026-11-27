// A crate rider (Nov 27; Eric, Nov 9-10: riders that have nothing to do with the bosses, in the regular crates): drawn here in
// code, the boss rides' kit (./kit.ts). Notes: docs/decisions/2026-11-27-crate-riders.md.
import type { RiderDraft, RiderProps, RiderPose, RiderViewDraft, TrailProps } from "./kit.ts";
import { Region, LINE, lw, darken, lighten } from "../item-paint.tsx";

/* Robo Vac: a round robot vacuum, low and flat, its shell the item's color, the pawn riding on its lid. A light that blinks while
   it waits and stays on while it cleans; a side brush that spins. */

const IDLE_N = 4;
const MOVE_N = 8;
const PAWN_Y = -13;
const CUT = 88;

const BUMPER = "#2b2b30";
const BRUSH = "#3a3a40";

/** A hum: the faintest shiver while it runs. */
const hum = (anim: "idle" | "move", f: number) => (anim === "move" ? (f % 2 ? -0.4 : 0) : 0);

function pose(anim: "idle" | "move", f: number): RiderPose {
  if (anim === "idle") return { dx: 0, dy: 0, pawnX: 0, pawnY: PAWN_Y, cut: CUT };
  return { dx: (100 * f) / MOVE_N, dy: hum(anim, f), pawnX: 0, pawnY: PAWN_Y, cut: CUT };
}

const SHELL = "M 14 82 Q 14 75 24 75 L 76 75 Q 86 75 86 82 L 86 87 Q 86 92 78 92 L 22 92 Q 14 92 14 87 Z";

/** The light on its lid: idle blinks (on, on, off, on), cleaning stays on. */
const lit = (anim: "idle" | "move", f: number) => anim === "move" || f !== 2;

function Brush({ x, a }: { x: number; a: number }) {
  return (
    <g transform={`rotate(${a} ${x} 93)`}>
      <path d={`M ${x - 5} 93 L ${x + 5} 93 M ${x} 90 L ${x} 96`} fill="none" stroke={BRUSH} stroke-linecap="round" {...lw(1.4)} />
    </g>
  );
}

function Back() {
  return null;
}

function Front({ p, anim, f }: RiderProps) {
  const a = anim === "move" ? f * 50 : 0;
  return (
    <g>
      <ellipse cx={50} cy={94.5} rx={8} ry={2} fill={BUMPER} />
      <Region p={p} name="shell" d={[SHELL]} />
      {/* the lid's seam and the bumper round its front (right: it runs right) */}
      <path d="M 18 80 L 82 80" fill="none" stroke={darken(p.hex, 0.35)} stroke-linecap="round" {...lw(1.4)} />
      <path d="M 80 76 Q 87 77 87 84 Q 87 91 80 92" fill="none" stroke={BUMPER} stroke-linecap="round" {...lw(3.4)} />
      <path d={SHELL} fill="none" {...LINE} />
      <circle cx={70} cy={78} r={2} fill={lit(anim, f) ? "#5ce1ff" : "#2c4a57"} {...LINE} {...lw(1.2)} />
      {lit(anim, f) && <circle cx={70} cy={78} r={4} fill="#5ce1ff" opacity={0.3} />}
      <path d="M 24 86 Q 30 89 38 89" fill="none" stroke={lighten(p.hex, 0.5)} stroke-opacity={0.6} stroke-linecap="round" {...lw(1.6)} />
      <Brush x={84} a={a} />
    </g>
  );
}

/* ---- front and back views: the same disc, seen from either end ---- */

function endPose(anim: "idle" | "move", f: number): RiderPose {
  return { dx: 0, dy: hum(anim, f), pawnX: 0, pawnY: PAWN_Y, cut: CUT };
}

function endFront(bumper: boolean) {
  return function EndFront({ p, anim, f }: RiderProps) {
    const a = anim === "move" ? f * 50 : 0;
    return (
      <g>
        <Region p={p} name="shell" d={[SHELL]} />
        <path d="M 18 80 L 82 80" fill="none" stroke={darken(p.hex, 0.35)} stroke-linecap="round" {...lw(1.4)} />
        {/* coming toward you, the bumper is across its face */}
        {bumper && <path d="M 18 85 L 82 85" fill="none" stroke={BUMPER} stroke-linecap="round" {...lw(3.4)} />}
        <path d={SHELL} fill="none" {...LINE} />
        {bumper ? <Brush x={22} a={a} /> : <circle cx={50} cy={78} r={2} fill={lit(anim, f) ? "#5ce1ff" : "#2c4a57"} {...LINE} {...lw(1.2)} />}
        {bumper && <Brush x={78} a={-a} />}
      </g>
    );
  };
}

const endView = (bumper: boolean): RiderViewDraft => ({
  frame: [10, 6, 80, 92],
  idle: { ms: [450, 450, 300, 450] },
  move: { ms: Array(MOVE_N).fill(90) },
  pose: endPose,
  Back,
  Front: endFront(bumper),
});

/* ---- trail: a clean, shiny streak where it went ---- */

function Clean({ f }: TrailProps) {
  const a = [0.55, 0.4, 0.22, 0.08][f] ?? 0;
  return (
    <g>
      <ellipse cx={0} cy={0} rx={13} ry={4} fill="#ffffff" opacity={a} />
      <path d="M 6 -3 L 6 -7 M 4 -5 L 8 -5" fill="none" stroke="#ffffff" stroke-opacity={a * 1.4} stroke-linecap="round" {...lw(1.2)} />
    </g>
  );
}

export const robotVacuum: RiderDraft = {
  id: "robot-vacuum",
  name: "Robo Vac",
  tier: "mythic",
  description: "Cleans the board as it goes. Has mapped every square and still bumps into the king.",
  frame: [8, 4, 84, 94],
  idle: { ms: [450, 450, 300, 450] },
  move: { ms: Array(MOVE_N).fill(90) },
  pose,
  Back,
  Front,
  views: { front: endView(true), back: endView(false) },
  trail: { ms: [160, 150, 150, 140], w: 28, h: 16, Mark: Clean },
};
