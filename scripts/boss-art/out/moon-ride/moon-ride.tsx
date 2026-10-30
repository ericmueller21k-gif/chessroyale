import type { RiderDraft, RiderProps } from "../../item-kit.tsx";
import { Region, LINE, lw, darken, lighten } from "../../item-kit.tsx";

const N = 8;
/** The slow float: 0 at frame 0, up 3 at the middle of the loop. */
const bob = (f: number) => -1.5 + 1.5 * Math.cos((2 * Math.PI * f) / N);

/** A little four-point star. */
const star = (x: number, y: number, r: number) => {
  const k = r * 0.3;
  const n = (v: number) => v.toFixed(2);
  return `M ${n(x)} ${n(y - r)} L ${n(x + k)} ${n(y - k)} L ${n(x + r)} ${n(y)} L ${n(x + k)} ${n(y + k)} L ${n(x)} ${n(y + r)} L ${n(x - k)} ${n(y + k)} L ${n(x - r)} ${n(y)} L ${n(x - k)} ${n(y - k)} Z`;
};
const STAR_FILL = "#fff1a8";

function Star({ x, y, r, o = 1 }: { x: number; y: number; r: number; o?: number }) {
  if (r < 0.6) return null;
  return <path d={star(x, y, r)} fill={STAR_FILL} {...LINE} {...lw(1.4)} opacity={o} />;
}

/** Idle twinkles: where they sit and when (phase, in frames) each one blooms. */
const TWINKLES = [
  { x: 4, y: 8, r: 8.5, ph: 0 },
  { x: 95, y: 6, r: 8, ph: 4 },
  { x: 25, y: 1, r: 5.5, ph: 6 },
  { x: 76, y: -1, r: 5.5, ph: 2 },
  { x: 99, y: 38, r: 6, ph: 7 },
  { x: 0, y: 38, r: 6, ph: 3 },
];
/** Trail stars: spawned behind the moon every other frame, left in place in the world as it glides on. */
const TRAIL = [
  { s: 0, y: 40, r: 8 },
  { s: 1, y: 18, r: 6 },
  { s: 2, y: 52, r: 7 },
  { s: 3, y: 28, r: 5.5 },
  { s: 4, y: 46, r: 8 },
  { s: 5, y: 12, r: 6 },
  { s: 6, y: 34, r: 7 },
  { s: 7, y: 56, r: 5.5 },
];

// The crescent lying on its back, horns up.
// Two circles: outer (50, 38) r 44, inner (50, 18) r 42; they meet at the horn tips.
const OUTER = "M 8.4 23.7 A 44 44 0 1 0 91.6 23.7";
const MOON = `${OUTER} A 42 42 0 0 1 8.4 23.7 Z`;
const INNER_HI = "M 14.6 45 A 44.5 44.5 0 0 0 85.4 45";

export const moonRide: RiderDraft = {
  id: "moon-ride",
  name: "Moon's Ride",
  tier: "mythic",
  description: "A sleepy crescent that gives rides on its way to bed. Mind the horns; it never minds anything.",
  frame: [-6, -8, 112, 108],
  idle: { ms: Array(N).fill(230) },
  move: { ms: Array(N).fill(80) },
  pose: (anim, f) => ({
    dx: anim === "move" ? (100 * f) / N : 0,
    dy: 0,
    pawnX: 0,
    pawnY: -14 + bob(f),
    cut: 76,
  }),
  Back: ({ anim, f }: RiderProps) => {
    const b = bob(f);
    const sh = 1 + b / 12; // the shadow shrinks as the moon rises
    return (
      <g>
        <ellipse cx={50} cy={96} rx={30 * sh} ry={3.6 * sh} fill="#1d1d1f" opacity={0.18} />
        {anim === "idle"
          ? TWINKLES.map((t, i) => {
              const a = (f + t.ph) % N; // bloom over 4 frames, rest 4
              const s = a < 4 ? Math.sin((Math.PI * (a + 0.5)) / 4) : 0;
              return <Star key={i} x={t.x} y={t.y + b * 0.4} r={t.r * s} o={0.35 + 0.65 * s} />;
            })
          : TRAIL.map((t, i) => {
              const a = (f - t.s + N) % N; // age in frames
              if (a > 3) return null;
              const x = -1 - (100 / N) * a - 2 * a;
              const s = 1 - a * 0.22;
              return <Star key={i} x={x} y={t.y + a * 1.5} r={t.r * s} o={1 - a * 0.22} />;
            })}
      </g>
    );
  },
  Front: ({ p, f }: RiderProps) => {
    const b = bob(f);
    return (
      <g transform={`translate(0 ${b.toFixed(2)})`}>
        <Region
          p={p}
          name="moon"
          d={[MOON]}
          over={
            <>
              <path d={OUTER} fill="none" stroke={darken(p.hex, 0.24)} {...lw(8)} />
              <path d={INNER_HI} fill="none" stroke={lighten(p.hex, 0.5)} {...lw(3.5)} stroke-linecap="round" />
              <circle cx={17} cy={53} r={2.6} fill={darken(p.hex, 0.16)} />
              <circle cx={84} cy={49} r={2} fill={darken(p.hex, 0.16)} />
            </>
          }
        />
        {/* the sleepy face */}
        <ellipse cx={30} cy={70} rx={4} ry={2.4} fill="#ff8fa3" opacity={0.65} />
        <ellipse cx={70} cy={70} rx={4} ry={2.4} fill="#ff8fa3" opacity={0.65} />
        <path d="M 34.5 65 Q 38.5 69.5 42.5 65" fill="none" {...LINE} {...lw(2.4)} />
        <path d="M 57.5 65 Q 61.5 69.5 65.5 65" fill="none" {...LINE} {...lw(2.4)} />
        <path d="M 46 71.5 Q 50 75.5 54 71.5" fill="none" {...LINE} {...lw(2.4)} />
      </g>
    );
  },
};
