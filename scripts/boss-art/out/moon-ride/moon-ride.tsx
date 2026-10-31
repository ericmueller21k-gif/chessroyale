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

// ---- Front and back views: the moon-board seen end-on, a wide level sliver. ----
type EndView = "front" | "back";
const END_H = 4.4; // half-height of the deck's top surface seen at 30 degrees
const END_B = 90.6; // the belly's lowest point (before LIFT), like the side's 92.5
const ROLL = [0, 0.7, 1.1, 0.6, -0.2, -0.5];
const roll = (anim: string, f: number) => (anim === "idle" ? 0 : ROLL[f % MOVE_N]);
// Dip: nose toward us (front) shows more deck; tail toward us (back) shows less.
const endH = (v: EndView, anim: string, f: number) =>
  anim === "idle" ? END_H : END_H + (v === "front" ? 0.26 : -0.2) * LEAN[f % MOVE_N];
const exf = (anim: string, f: number) => `translate(0 ${off(anim, f) + LIFT}) rotate(${roll(anim, f)} 50 77)`;
const endTop = (h: number) => {
  const c = h * 1.333;
  return `M 6 75.5 C 16 ${75.5 - c} 84 ${75.5 - c} 94 75.5 C 84 ${75.5 + c} 16 ${75.5 + c} 6 75.5 Z`;
};
const endBelly = (h: number) => {
  const c = h * 1.333;
  const b = END_B + (h - END_H) * 0.5;
  return `M 6 75.5 C 16 ${75.5 + c} 84 ${75.5 + c} 94 75.5 C 91 84 72 ${b} 50 ${b} C 28 ${b} 9 84 6 75.5 Z`;
};
const END_STARS: [number, number, number, number][] = [
  [2, 56, 5.5, 0],
  [98, 48, 6, 3],
  [15, 28, 4, 5],
  [86, 22, 4.6, 2],
  [97, 80, 3.6, 6],
];

function EndFace({ p, h }: { p: RiderProps["p"]; h: number }) {
  const dark = !isLight(p.hex);
  const ink = "#3b2a22";
  const edge = "#fff3cf";
  const eye = (x: number) => `M ${x} 83 L ${x + 6.6} 83 A 3.3 3 0 0 1 ${x} 83 Z`;
  const lid = (x: number) => `M ${x - 1} 82.7 L ${x + 7.6} 82.9`;
  const smile = "M 46.8 86.8 Q 50 89.6 53.2 86.8";
  const xs = [34.4, 59];
  return (
    <g transform={`translate(0 ${0.7 + (h - END_H) * 0.7})`}>
      <ellipse cx={28.6} cy={87.2} rx={3.4} ry={1.6} fill="#f49a9a" opacity={0.9} />
      <ellipse cx={71.4} cy={87.2} rx={3.4} ry={1.6} fill="#f49a9a" opacity={0.9} />
      {dark && (
        <g fill="none" stroke={edge} stroke-linecap="round" stroke-linejoin="round" {...lw(3.6)}>
          {xs.map((x) => (
            <path key={`e${x}`} d={eye(x)} />
          ))}
          {xs.map((x) => (
            <path key={`l${x}`} d={lid(x)} />
          ))}
          <path d={smile} />
        </g>
      )}
      {xs.map((x) => (
        <g key={x}>
          <path d={eye(x)} fill={ink} />
          <circle cx={x + 4.8} cy={84.3} r={0.75} fill="#fff" />
          <path d={lid(x)} fill="none" stroke={ink} stroke-linecap="round" {...lw(2)} />
        </g>
      ))}
      <path d={smile} fill="none" stroke={ink} stroke-linecap="round" {...lw(2)} />
    </g>
  );
}

function makeEndBack(v: EndView) {
  return function EndBack({ p, anim, f }: RiderProps) {
    const b = off(anim, f);
    const s = 1 + b * 0.04;
    const h = endH(v, anim, f);
    return (
      <g>
        <ellipse cx={50} cy={98} rx={36 * s} ry={3.2 * s} fill="#000" opacity={0.18} />
        {v === "front" &&
          anim === "move" &&
          [0, 1, 2].map((k) => {
            // sparkles left behind, peeking out above the board's far end
            const a = (f + k * 2) % MOVE_N;
            const sd = k % 2 === 0 ? -1 : 1;
            const x = 50 + sd * (30 - a * 1.6 + k * 2);
            const y = 66 + LIFT + b - a * 3.2 - k;
            return <Star key={k} x={x} y={y} r={4.6 - a * 0.6} o={1 - a / MOVE_N} />;
          })}
        <g transform={exf(anim, f)}>
          <Region
            p={p}
            name="deck"
            d={[endTop(h)]}
            fill={lighten(p.hex, 0.28)}
            over={
              <g>
                <ellipse cx={22} cy={75.4} rx={3} ry={0.8} fill="#000" opacity={0.1} />
                <ellipse cx={79} cy={75} rx={2.4} ry={0.7} fill="#000" opacity={0.1} />
              </g>
            }
            line={2.4}
          />
        </g>
      </g>
    );
  };
}

function makeEndFront(v: EndView) {
  return function EndFront({ p, anim, f }: RiderProps) {
    const b = off(anim, f);
    const h = endH(v, anim, f);
    const belly = endBelly(h);
    const c = h * 1.333;
    return (
      <g>
        <g transform={exf(anim, f)}>
          <Region
            p={p}
            name="moon"
            d={[belly]}
            over={
              <g>
                <path d={belly} fill="#000" opacity={0.2} />
                <path d={belly} transform="translate(0 -4.5)" fill={p.fill} />
                <path
                  d={`M 11 77.4 C 20 ${76.9 + c} 80 ${76.9 + c} 89 77.4`}
                  fill="none"
                  stroke="#fff"
                  opacity={0.5}
                  stroke-linecap="round"
                  {...lw(1.8)}
                />
                {v === "back" ? (
                  <g>
                    <ellipse cx={34} cy={84.5} rx={4} ry={1.8} fill="#000" opacity={0.1} />
                    <ellipse cx={60} cy={87.6} rx={2.6} ry={1.2} fill="#000" opacity={0.1} />
                    <ellipse cx={20} cy={80.6} rx={2.2} ry={1} fill="#000" opacity={0.1} />
                    <ellipse cx={70} cy={82.4} rx={1.8} ry={0.9} fill="#000" opacity={0.09} />
                  </g>
                ) : (
                  <g>
                    <ellipse cx={19} cy={80.6} rx={2.2} ry={1} fill="#000" opacity={0.1} />
                    <ellipse cx={81} cy={80.8} rx={1.8} ry={0.9} fill="#000" opacity={0.09} />
                  </g>
                )}
              </g>
            }
          />
          {v === "front" && <EndFace p={p} h={h} />}
        </g>
        {anim === "idle" &&
          END_STARS.map(([x, y, r, ph], i) => {
            const t = TW[(f + ph) % TW.length];
            return <Star key={i} x={x} y={y} r={r * (0.4 + 0.6 * t)} o={t} />;
          })}
        {v === "back" &&
          anim === "move" &&
          [0, 1, 2].map((k) => {
            // sparkles trailing toward us: dropping and spreading off the near end, shrinking
            const a = (f + k * 2) % MOVE_N;
            const sd = k % 2 === 0 ? -1 : 1;
            const x = 50 + sd * (41 + a * 2.4 + k * 1.5);
            const y = 77 + LIFT + b + a * 2.4 - k;
            return <Star key={k} x={x} y={y} r={4 - a * 0.5} o={1 - a / MOVE_N} />;
          })}
        {anim === "move" && (
          <g opacity={0.7}>
            {v === "back" ? (
              <g>
                <circle cx={36 - ((f * 3) % 9)} cy={86 + LIFT + ((f * 2) % 6)} r={0.9} fill="#fff4b8" />
                <circle cx={64 + ((f * 4 + 4) % 12)} cy={85 + LIFT + ((f * 3 + 2) % 7)} r={0.9} fill="#fff4b8" />
              </g>
            ) : (
              <g>
                <circle cx={22 + ((f * 2) % 6)} cy={64 + LIFT - ((f * 3) % 9)} r={0.9} fill="#fff4b8" />
                <circle cx={78 - ((f * 2 + 3) % 6)} cy={62 + LIFT - ((f * 3 + 4) % 9)} r={0.9} fill="#fff4b8" />
              </g>
            )}
          </g>
        )}
      </g>
    );
  };
}

function endView(v: EndView) {
  return {
    frame: [-2, 0, 104, 100] as [number, number, number, number],
    idle: { ms: [260, 260, 260, 260, 260, 260, 260, 260] },
    move: { ms: [100, 100, 100, 100, 100, 100] },
    pose: (anim: "idle" | "move", f: number) => ({
      dx: 0,
      dy: 0,
      pawnX: 0,
      pawnY: SEAT + off(anim, f),
      pawnTilt: roll(anim, f),
      cut: 88,
    }),
    Back: makeEndBack(v),
    Front: makeEndFront(v),
  };
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
  views: { front: endView("front"), back: endView("back") },
};
