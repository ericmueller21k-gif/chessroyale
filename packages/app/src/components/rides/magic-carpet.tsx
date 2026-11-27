// A crate rider (Nov 27; Eric, Nov 9-10: riders that have nothing to do with the bosses, in the regular crates): drawn here in
// code, the boss rides' kit (./kit.ts). Notes: docs/decisions/2026-11-27-crate-riders.md.
import type { RiderDraft, RiderProps, RiderPose, RiderViewDraft, TrailProps } from "./kit.ts";
import { Region, LINE, lw } from "../item-paint.tsx";

/* The Magic Carpet: a flying rug in the item's color, its border and tassels in the second color, rippling as it floats. */

const TAU = Math.PI * 2;
const IDLE_N = 8;
const MOVE_N = 8;
const PAWN_Y = -9;
const CUT = 88;

/** The float: up and down, slow standing, quicker flying. */
function bob(anim: "idle" | "move", f: number): number {
  const n = anim === "idle" ? IDLE_N : MOVE_N;
  return -1.6 + 1.6 * Math.cos((TAU * f) / n);
}

/** The rug's middle line at x, rippling (the ripple runs back along it, frame by frame). */
const wave = (x: number, ph: number, amp: number) => 82 + amp * Math.sin(x / 14 - ph);

/** The rug from x0 to x1, its top edge a ripple, 7 thick. */
function rug(x0: number, x1: number, ph: number, amp: number): string {
  const top: string[] = [];
  const bot: string[] = [];
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 10) {
    const y = wave(x, ph, amp);
    top.push(`${x.toFixed(1)} ${y.toFixed(2)}`);
    bot.unshift(`${x.toFixed(1)} ${(y + 7).toFixed(2)}`);
  }
  return `M ${top.join(" L ")} L ${bot.join(" L ")} Z`;
}

const phase = (anim: "idle" | "move", f: number) => (TAU * f) / (anim === "idle" ? IDLE_N : MOVE_N);

function pose(anim: "idle" | "move", f: number): RiderPose {
  const ph = phase(anim, f);
  // (The pawn rides the ripple under it.)
  const under = wave(50, ph, anim === "move" ? 2.2 : 1.4) - 82;
  return { dx: anim === "move" ? (100 * f) / MOVE_N : 0, dy: bob(anim, f), pawnX: 0, pawnY: PAWN_Y + under, cut: CUT };
}

function Shadow({ anim, f, rx }: { anim: "idle" | "move"; f: number; rx: number }) {
  const lift = -bob(anim, f);
  const s = 1 - lift * 0.04;
  return <ellipse cx={50} cy={97 + lift} rx={rx * s} ry={2.6 * s} fill="#1d1d1f" opacity={0.25} />;
}

function Back({ anim, f }: RiderProps) {
  return <Shadow anim={anim} f={f} rx={34} />;
}

function Tassels({ x, y, p2hex }: { x: number; y: number; p2hex: string }) {
  return <path d={`M ${x} ${y + 0.5} l -4 1 M ${x} ${y + 2.5} l -4.5 1 M ${x} ${y + 4.5} l -4.5 1 M ${x} ${y + 6.5} l -4 1`} fill="none" stroke={p2hex} stroke-linecap="round" {...lw(1.6)} />;
}

function Front({ p, p2, anim, f }: RiderProps) {
  const ph = phase(anim, f);
  const amp = anim === "move" ? 2.2 : 1.4;
  const d = rug(8, 92, ph, amp);
  const mid: string[] = [];
  for (let x = 10; x <= 90.01; x += 8) mid.push(`${x} ${(wave(x, ph, amp) + 3.5).toFixed(2)}`);
  const y0 = wave(8, ph, amp);
  const y1 = wave(92, ph, amp);
  return (
    <g>
      <Tassels x={8} y={y0} p2hex={p2.hex} />
      <g transform={`translate(${2 * 92} 0) scale(-1 1)`}>
        <Tassels x={92} y={y1} p2hex={p2.hex} />
      </g>
      <Region p={p} name="rug" d={[d]} />
      {/* the woven border down its length, in the second color, and its pattern of diamonds */}
      <path d={`M ${mid.join(" L ")}`} fill="none" stroke={p2.hex} stroke-dasharray="3 3" stroke-linecap="round" {...lw(1.8)} />
      <path d={d} fill="none" {...LINE} {...lw(2.4)} />
    </g>
  );
}

/* ---- front and back views: the rug end-on, its tassels hanging at the near edge ---- */

function endPose(anim: "idle" | "move", f: number): RiderPose {
  return { dx: 0, dy: bob(anim, f), pawnX: 0, pawnY: PAWN_Y, pawnTilt: anim === "move" ? Math.sin(phase(anim, f)) : 0, cut: CUT };
}

const END = "M 14 81 Q 50 78 86 81 L 86 88 Q 50 85 14 88 Z";

function EndBack({ anim, f }: RiderProps) {
  return <Shadow anim={anim} f={f} rx={30} />;
}

function EndFront({ p, p2, anim, f }: RiderProps) {
  const sway = anim === "move" ? Math.sin(phase(anim, f)) : 0;
  const tassels = [20, 30, 40, 50, 60, 70, 80].map((x) => `M ${x} ${86.6 - Math.abs(x - 50) * 0.04} l ${sway} 4`).join(" ");
  return (
    <g>
      <Region p={p} name="rug" d={[END]} />
      <path d="M 16 84.5 Q 50 81.5 84 84.5" fill="none" stroke={p2.hex} stroke-dasharray="3 3" stroke-linecap="round" {...lw(1.8)} />
      <path d={END} fill="none" {...LINE} {...lw(2.4)} />
      <path d={tassels} fill="none" stroke={p2.hex} stroke-linecap="round" {...lw(1.8)} />
    </g>
  );
}

const endView: RiderViewDraft = {
  frame: [12, 4, 76, 96],
  idle: { ms: Array(IDLE_N).fill(220) },
  move: { ms: Array(MOVE_N).fill(90) },
  pose: endPose,
  Back: EndBack,
  Front: EndFront,
};

/* ---- trail: a few sparkles in the second color ---- */

function Sparkles({ p2, f, n }: TrailProps) {
  const a = [0.95, 0.7, 0.4, 0.15][f] ?? 0;
  const s = [1, 0.85, 0.7, 0.5][f] ?? 0.5;
  const at: [number, number][] = n % 2 ? [[-8, -3], [6, 2], [1, -6]] : [[-4, 3], [8, -4], [-10, -1]];
  return (
    <g fill={p2.hex} opacity={a}>
      {at.map(([x, y], i) => (
        <path key={i} d={`M ${x} ${y - 3 * s} L ${x + 0.8 * s} ${y - 0.8 * s} L ${x + 3 * s} ${y} L ${x + 0.8 * s} ${y + 0.8 * s} L ${x} ${y + 3 * s} L ${x - 0.8 * s} ${y + 0.8 * s} L ${x - 3 * s} ${y} L ${x - 0.8 * s} ${y - 0.8 * s} Z`} />
      ))}
    </g>
  );
}

export const magicCarpet: RiderDraft = {
  id: "magic-carpet",
  name: "Magic Carpet",
  tier: "mythic",
  colors: 2,
  description: "Hand-woven, tassels and all, in two colors. Flies anywhere; still won't let you skip a square.",
  frame: [0, 2, 100, 98],
  idle: { ms: Array(IDLE_N).fill(220) },
  move: { ms: Array(MOVE_N).fill(90) },
  pose,
  Back,
  Front,
  views: { front: endView, back: endView },
  trail: { ms: [160, 150, 150, 140], w: 26, h: 16, Mark: Sparkles },
};
