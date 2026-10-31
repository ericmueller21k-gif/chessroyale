import { Region, LINE, lw, darken, lighten, isLight } from "../../item-kit.tsx";
import type { RiderDraft, RiderProps } from "../../item-kit.tsx";

// The deck's near edge sits at y ~77; the pawn's base (y 88 of its square) rests there.
const SEAT = -18;
// Idle float: the moon (and its pawn) bob; the shadow stays on the ground.
const BOB = [0, -1, -2, -2.6, -2.6, -2, -1, -0.2];
// Move: a glide, nose dipping a touch then levelling.
const MOVE_N = 6;
const LEAN = [1, 3, 4.5, 4, 2.6, 1.4];
const MOVE_BOB = [0, 0.6, 1, 0.6, 0, -0.4];

const TOP = "M -10 76 C 6 72 92 71.4 110 75.6 C 92 77.6 8 77.6 -10 76 Z";
const SIDE = "M -10 76 C 8 77.6 92 77.6 110 75.6 C 103 78.5 100 92.5 64 92.5 C 28 92.5 2 81 -10 76 Z";

function star(cx: number, cy: number, r: number) {
  const k = r * 0.2;
  return `M ${cx} ${cy - r} Q ${cx + k} ${cy - k} ${cx + r} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + r} Q ${cx - k} ${cy + k} ${cx - r} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

function Star({ x, y, r, o = 1 }: { x: number; y: number; r: number; o?: number }) {
  if (r <= 0.4 || o <= 0.05) return null;
  return <path d={star(x, y, r)} fill="#fff4b8" opacity={o} {...LINE} {...lw(1.4)} />;
}

const off = (anim: string, f: number) => (anim === "idle" ? BOB[f % BOB.length] : MOVE_BOB[f % MOVE_N]);
const tilt = (anim: string, f: number) => (anim === "idle" ? 0 : LEAN[f % MOVE_N]);
const LIFT = -7;
const xf = (anim: string, f: number) => `translate(0 ${off(anim, f) + LIFT}) rotate(${tilt(anim, f)} 50 77)`;

function Back({ p, anim, f }: RiderProps) {
  const b = off(anim, f);
  // shadow shrinks as the moon rises
  const s = 1 + b * 0.04;
  return (
    <g>
      <ellipse cx={50} cy={98} rx={44 * s} ry={3.2 * s} fill="#000" opacity={0.18} />
      <g transform={xf(anim, f)}>
        <Region
          p={p}
          name="deck"
          d={[TOP]}
          fill={lighten(p.hex, 0.28)}
          over={
            <g>
              <ellipse cx={20} cy={74.2} rx={3.2} ry={0.9} fill="#000" opacity={0.1} />
              <ellipse cx={86} cy={73.6} rx={2.6} ry={0.8} fill="#000" opacity={0.1} />
            </g>
          }
          line={2.4}
        />
      </g>
    </g>
  );
}

const STARS: [number, number, number, number][] = [
  // x, y, size, phase
  [-5, 56, 5.5, 0],
  [104, 48, 6, 3],
  [14, 30, 4, 5],
  [88, 22, 4.6, 2],
  [108, 80, 3.6, 6],
];
const TW = [0, 0.5, 1, 0.75, 0.4, 0.15, 0, 0];

function Face({ p }: { p: RiderProps["p"] }) {
  const dark = !isLight(p.hex);
  const ink = "#3b2a22";
  const eye = "M 66 81 L 75 81 A 4.5 4 0 0 1 66 81 Z";
  const lid = "M 64.6 80.6 L 76.4 81";
  const smile = "M 79.5 86.4 Q 83 89.6 86.5 86";
  const edge = "#fff3cf";
  return (
    <g>
      <ellipse cx={69} cy={87.6} rx={3.8} ry={1.9} fill="#f49a9a" opacity={0.9} />
      {dark && (
        <g fill="none" stroke={edge} stroke-linecap="round" stroke-linejoin="round" {...lw(3.6)}>
          <path d={eye} />
          <path d={lid} />
          <path d={smile} />
        </g>
      )}
      <path d={eye} fill={ink} />
      <circle cx={72.4} cy={82.6} r={0.9} fill="#fff" />
      <path d={lid} fill="none" stroke={ink} stroke-linecap="round" {...lw(2)} />
      <path d={smile} fill="none" stroke={ink} stroke-linecap="round" {...lw(2)} />
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  return (
    <g>
      <g transform={xf(anim, f)}>
        <Region
          p={p}
          name="moon"
          d={[SIDE]}
          over={
            <g>
              <path d={SIDE} fill="#000" opacity={0.2} />
              <path d={SIDE} transform="translate(0 -4.5)" fill={p.fill} />
              <path d="M -2 77.6 C 20 79.6 80 79.6 102 76.8" fill="none" stroke="#fff" opacity={0.5} stroke-linecap="round" {...lw(1.8)} />
              <ellipse cx={28} cy={85} rx={4} ry={1.8} fill="#000" opacity={0.1} />
              <ellipse cx={50} cy={88} rx={2.6} ry={1.2} fill="#000" opacity={0.1} />
              <ellipse cx={10} cy={81} rx={2.2} ry={1} fill="#000" opacity={0.1} />
              <ellipse cx={40} cy={82} rx={1.8} ry={0.9} fill="#000" opacity={0.09} />
            </g>
          }
        />
        <Face p={p} />
      </g>
      {anim === "idle" &&
        STARS.map(([x, y, r, ph], i) => {
          const t = TW[(f + ph) % TW.length];
          return <Star key={i} x={x} y={y} r={r * (0.4 + 0.6 * t)} o={t} />;
        })}
      {anim === "move" &&
        [0, 1, 2].map((k) => {
          const a = (f + k * 2) % MOVE_N; // age of this sparkle
          const x = -9 - a * 3.4;
          const y = 77 + LIFT + [0, -3, 2, -2, 3, 0][(k * 2 + a) % 6] + off(anim, f);
          return <Star key={k} x={x} y={y} r={5.4 - a * 0.75} o={1 - a / MOVE_N} />;
        })}
      {anim === "move" && (
        <g transform={xf(anim, f)} fill="none" stroke="#fff4b8" stroke-linecap="round">
          <path d={`M -13 ${76.5 + (f % 2) * 0.5} L ${-24 - (f % 3) * 1.5} ${76.5 + (f % 2) * 0.5}`} opacity={0.55} {...lw(1.6)} />
          <path d={`M -3 ${80.5 - (f % 2) * 0.5} L ${-14 - ((f + 1) % 3) * 1.5} ${80.5 - (f % 2) * 0.5}`} opacity={0.4} {...lw(1.3)} />
        </g>
      )}
      {anim === "move" && (
        <g opacity={0.7}>
          <circle cx={-14 - ((f * 3) % 9)} cy={81 + LIFT} r={1} fill="#fff4b8" />
          <circle cx={-11 - ((f * 4 + 4) % 12)} cy={72 + LIFT} r={0.9} fill="#fff4b8" />
        </g>
      )}
    </g>
  );
}

export const moonRide: RiderDraft = {
  id: "moon-ride",
  name: "Moon's Ride",
  tier: "mythic",
  description: "Moo's best friend, laid flat and floating. It naps on the job, but it's never once missed a square.",
  frame: [-12, 4, 125, 97],
  idle: { ms: [260, 260, 260, 260, 260, 260, 260, 260] },
  move: { ms: [100, 100, 100, 100, 100, 100] },
  pose: (anim, f) => ({
    dx: anim === "move" ? (f * 100) / MOVE_N : 0,
    dy: 0,
    pawnX: 0,
    pawnY: SEAT + off(anim, f),
    pawnTilt: tilt(anim, f),
    cut: 88,
  }),
  Back,
  Front,
};
