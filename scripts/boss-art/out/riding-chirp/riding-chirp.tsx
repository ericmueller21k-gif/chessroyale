import type { RiderDraft, RiderProps } from "../../item-kit.tsx";
import { Region, LINE, lw, darken, lighten, isLight } from "../../item-kit.tsx";

/* Chirp's fixed colors */
const C = {
  body: "#68bb3e",
  bodyHi: "#8fd45a",
  belly: "#bcd95e",
  back: "#3f8f2c",
  wing: "#4c9a33",
  leg: "#c4d65c",
  legFar: "#8aa83a",
  ant: "#4d6d1f",
  antFar: "#3c5418",
  eye: "#22252a",
  mouth: "#dccf62",
  blush: "#f39ab0",
  gold: "#f2c14e",
  ink: "#1d1d1f",
};

type Mode = "stand" | "kick" | "air" | "reach";
interface S {
  b: number;
  rot: number;
  mode: Mode;
  a1: number;
  a2: number;
  blink?: boolean;
  lift?: number;
}

const IDLE: S[] = [
  { b: 0, rot: 0, mode: "stand", a1: 24, a2: 16 },
  { b: 0.6, rot: 0, mode: "stand", a1: 24, a2: 16 },
  { b: 1.2, rot: 0, mode: "stand", a1: 31, a2: 18 },
  { b: 1.2, rot: 0, mode: "stand", a1: 24, a2: 16 },
  { b: 0.6, rot: 0, mode: "stand", a1: 24, a2: 23 },
  { b: 0, rot: 0, mode: "stand", a1: 24, a2: 16 },
  { b: 0, rot: 0, mode: "stand", a1: 24, a2: 16, blink: true },
  { b: 0.3, rot: 0, mode: "stand", a1: 25, a2: 16, lift: 4 },
  { b: 0.6, rot: 0, mode: "stand", a1: 25, a2: 17, lift: 5 },
  { b: 0.3, rot: 0, mode: "stand", a1: 24, a2: 16, lift: 1.5 },
];
const IDLE_MS = [260, 220, 120, 220, 150, 260, 110, 200, 220, 180];

interface M extends S {
  dx: number;
  dy: number;
  extra: number;
  tilt: number;
}
const MOVE: M[] = [
  { dx: 0, dy: 0, b: 3, rot: 0, mode: "stand", a1: 20, a2: 13, extra: 0.5, tilt: 0 },
  { dx: 0, dy: 0, b: 6.5, rot: 2, mode: "stand", a1: 12, a2: 6, extra: 1.5, tilt: 1 },
  { dx: 14, dy: -12, b: 0, rot: -12, mode: "kick", a1: -2, a2: -8, extra: 3, tilt: -7 },
  { dx: 36, dy: -24, b: 0, rot: -6, mode: "air", a1: 4, a2: -2, extra: 1, tilt: -5 },
  { dx: 56, dy: -27, b: 0, rot: 0, mode: "air", a1: 14, a2: 8, extra: -2, tilt: 0 },
  { dx: 76, dy: -18, b: 0, rot: 8, mode: "reach", a1: 30, a2: 22, extra: -2.5, tilt: 5 },
  { dx: 94, dy: -5, b: 0, rot: 5, mode: "reach", a1: 36, a2: 28, extra: -1, tilt: 4 },
  { dx: 100, dy: 0, b: 5, rot: 0, mode: "stand", a1: 34, a2: 26, extra: 2, tilt: 2 },
];
const MOVE_MS = [90, 100, 70, 70, 70, 70, 60, 120];

const st = (anim: "idle" | "move", f: number): S => (anim === "move" ? MOVE[f % MOVE.length] : IDLE[f % IDLE.length]);

type P = [number, number];
const n1 = (v: number) => v.toFixed(1);
const poly = (pts: P[]) => "M" + pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join(" L");

/** A thin leg: a dark line under a colored one (an outlined stick). */
function Limb({ pts, fill, w }: { pts: P[]; fill: string; w: number }) {
  const d = poly(pts);
  return (
    <g>
      <path d={d} fill="none" stroke={C.ink} stroke-linecap="round" stroke-linejoin="round" {...lw(w + 3)} />
      <path d={d} fill="none" stroke={fill} stroke-linecap="round" stroke-linejoin="round" {...lw(w)} />
    </g>
  );
}

/** The big jumping thigh: thick at the hip, tapering to the knee, with its herringbone marks. */
function Femur({ H, K, r1, r2, fill, mark }: { H: P; K: P; r1: number; r2: number; fill: string; mark: string }) {
  const dx = K[0] - H[0];
  const dy = K[1] - H[1];
  const L = Math.hypot(dx, dy);
  const u: P = [dx / L, dy / L];
  const n: P = [-u[1], u[0]];
  const at = (p: P, s: number, t = 0): string => `${n1(p[0] + n[0] * s + u[0] * t)} ${n1(p[1] + n[1] * s + u[1] * t)}`;
  const mid: P = [H[0] + dx * 0.4, H[1] + dy * 0.4];
  const d = `M ${at(H, r1)} Q ${at(mid, r1 * 1.12)} ${at(K, r2)} A ${r2} ${r2} 0 0 0 ${at(K, -r2)} Q ${at(mid, -r1 * 1.12)} ${at(H, -r1)} A ${r1} ${r1} 0 0 0 ${at(H, r1)} Z`;
  const marks = [0.3, 0.5, 0.7].map((t) => {
    const c: P = [H[0] + dx * t, H[1] + dy * t];
    const r = (r1 + (r2 - r1) * t) * 0.55;
    return `M ${at(c, r, -3)} L ${at(c, 0)} L ${at(c, -r, -3)}`;
  });
  return (
    <g>
      <path d={d} fill={fill} {...LINE} />
      <path d={marks.join(" ")} fill="none" stroke={mark} stroke-linecap="round" stroke-linejoin="round" {...lw(1.3)} />
    </g>
  );
}

interface Legs {
  front: P[];
  mid: P[];
  hindH: P;
  hindK: P;
  hind: P[];
}
function legs(s: S): Legs {
  const b = s.b;
  if (s.mode === "kick")
    return {
      front: [[76, 77], [80, 86], [73, 93], [68, 95]],
      mid: [[60, 80], [53, 88], [46, 93], [41, 94]],
      hindH: [36, 73],
      hindK: [10, 64],
      hind: [[10, 64], [-12, 87], [-19, 90]],
    };
  if (s.mode === "air")
    return {
      front: [[76, 77], [84, 85], [86, 90], [90, 91]],
      mid: [[60, 80], [55, 88], [58, 92], [62, 93]],
      hindH: [36, 73],
      hindK: [8, 54],
      hind: [[8, 54], [3, 80], [9, 84]],
    };
  if (s.mode === "reach")
    return {
      front: [[76, 77], [88, 84], [94, 92], [99, 93]],
      mid: [[60, 80], [60, 88], [66, 94], [71, 95]],
      hindH: [36, 73],
      hindK: [8, 54],
      hind: [[8, 54], [12, 86], [18, 89]],
    };
  const lift = s.lift ?? 0;
  return {
    front: [[76, 77 + b], [84 + lift * 0.3, 85 + b * 0.5 - lift * 0.8], [82 + lift * 0.4, 95 - lift], [87 + lift * 0.4, 96 - lift]],
    mid: [[60, 80 + b], [54, 87 + b * 0.5], [58, 95], [63, 96]],
    hindH: [36, 73 + b],
    hindK: [8 - b * 0.5, 50 + b * 0.7],
    hind: [[8 - b * 0.5, 50 + b * 0.7], [16, 94], [24, 96]],
  };
}
const shift = (pts: P[], x: number, y: number): P[] => pts.map(([a, c]) => [a + x, c + y] as P);

function antenna(bx: number, by: number, a: number, L: number) {
  const r = (a * Math.PI) / 180;
  const tx = bx + L * Math.sin(r);
  const ty = by - L * Math.cos(r);
  const cx = bx + L * 0.35 * Math.sin(r) - 5;
  const cy = by - L * 0.6 * Math.cos(r);
  return `M ${n1(bx)} ${n1(by)} Q ${n1(cx)} ${n1(cy)} ${n1(tx)} ${n1(ty)}`;
}
function Antenna({ d, fill }: { d: string; fill: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke={C.ink} stroke-linecap="round" {...lw(4.6)} />
      <path d={d} fill="none" stroke={fill} stroke-linecap="round" {...lw(2)} />
    </g>
  );
}

const rotT = (s: S) => `rotate(${s.rot} 50 72)`;

function Back({ anim, f }: RiderProps) {
  const s = st(anim, f);
  const L = legs(s);
  return (
    <g transform={rotT(s)}>
      <Antenna d={antenna(87, 50 + s.b, s.a2, 32)} fill={C.antFar} />
      <Limb pts={shift(L.hind, 6, -2)} fill={C.legFar} w={2.4} />
      <Femur H={[L.hindH[0] + 6, L.hindH[1] - 2]} K={[L.hindK[0] + 6, L.hindK[1] - 2]} r1={6} r2={2.6} fill={C.legFar} mark={darken("#8aa83a", 0.3)} />
      <Limb pts={shift(L.front, 6, -2)} fill={C.legFar} w={2.6} />
      <Limb pts={shift(L.mid, 6, -2)} fill={C.legFar} w={2.6} />
    </g>
  );
}

const BODY = "M 80 57 C 66 52 40 53 24 57 C 12 60 3 64 2 71 C 2 77 10 80 20 81 C 40 86 64 87 80 82 Z";
const BELLY = "M 4 77 C 8 80 14 81 20 81 C 40 86 64 87 80 82 L 80 76 C 62 80 34 79 4 73 Z";
const HEAD = "M 78 52 C 84 45 98 46 102 55 C 105 63 103 72 97 76 C 90 79 80 77 77 70 C 75 64 75 57 78 52 Z";

function blanketPath() {
  let d = "M 19 52 Q 48 47 79 52 L 79 67";
  const w = (79 - 19) / 7;
  for (let i = 0; i < 7; i++) {
    const x = 79 - i * w;
    d += ` Q ${n1(x - w / 2)} 72.5 ${n1(x - w)} 67`;
  }
  return d + " Z";
}
const BLANKET = blanketPath();
const SADDLE = "M 21 37 Q 17 46 24 57 Q 50 61 76 57 Q 82 48 77 40 Q 72 40 69 46 Q 50 51 31 46 Q 28 39 21 37 Z";
const HORN = "M 72 39.5 a 3.6 3.2 0 1 0 7.2 0 a 3.6 3.2 0 1 0 -7.2 0 Z";
const FLAP = "M 37 55 L 61 55 Q 62 64 58 67 L 40 67 Q 36 64 37 55 Z";
const COLLAR = "M 75.5 56.5 Q 78.5 55.5 81.5 56.5 L 82.5 77.5 Q 79.5 78.5 76.5 77.5 Z";

function Front({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  const L = legs(s);
  const b = s.b;
  const dark = !isLight(p.hex) && (parseInt(p.hex.slice(1, 3), 16) + parseInt(p.hex.slice(3, 5), 16) + parseInt(p.hex.slice(5, 7), 16)) / 3 < 70;
  const blanketFill = dark ? lighten(p.hex, 0.28) : darken(p.hex, 0.22);
  const trim = dark ? lighten(p.hex, 0.6) : lighten(p.hex, 0.45);
  return (
    <g transform={rotT(s)}>
      {/* near front and middle legs, under the body */}
      <Limb pts={L.front} fill={C.leg} w={2.6} />
      <Limb pts={L.mid} fill={C.leg} w={2.6} />
      <g transform={`translate(0 ${b})`}>
        {/* body */}
        <path d={BODY} fill={C.body} />
        <path d={BELLY} fill={C.belly} />
        <path d="M 6 69 Q 9 63.5 18 61" fill="none" stroke={C.bodyHi} stroke-linecap="round" {...lw(2.4)} />
        <path d={BODY} fill="none" {...LINE} />
        <path d="M 11 77.5 Q 9 73 10 68 M 17 79 Q 15 74 16 69" fill="none" stroke={darken(C.body, 0.35)} stroke-linecap="round" {...lw(1.4)} />
        {/* folded wing, its tip past the blanket */}
        <path d="M 70 57 C 50 53 22 57 4 65 C 12 67 34 65 70 62 Z" fill={C.wing} {...LINE} {...lw(2)} />
        {/* the plate behind the head */}
        <path d="M 68 56 Q 76 53 82 57 L 82 75 Q 75 77 68 73 Z" fill={C.back} {...LINE} {...lw(2)} />
        {/* collar and its bell */}
        <Region p={p} name="collar" d={[COLLAR]} line={1.8} />
        <path d="M 76.4 79.6 Q 76.4 75.6 79.6 75.6 Q 82.8 75.6 82.8 79.6 L 83.6 82.6 L 75.6 82.6 Z" fill={C.gold} {...LINE} {...lw(1.6)} />
        <circle cx="79.6" cy="83.4" r="1.2" fill={C.ink} />
        {/* blanket, flap and saddle: the painted parts */}
        <Region
          p={p}
          name="blanket"
          d={[BLANKET]}
          fill={blanketFill}
          over={<path d="M 12 64 Q 48 60.5 84 64" fill="none" stroke={trim} {...lw(2.6)} />}
        />
        <Region p={p} name="flap" d={[FLAP]} line={2.2} />
        <path d="M 40 58 L 58 58 Q 59 63 56.5 64.8 L 41.5 64.8 Q 39 63 40 58" fill="none" stroke={trim} stroke-dasharray="2 2" {...lw(1)} />
        <Region p={p} name="saddle" d={[SADDLE]} />
        <Region p={p} name="horn" d={[HORN]} line={2} />
        <path d="M 23 41 Q 21 47 25 53" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.8)} />
        <path d="M 31 52.5 Q 50 56.5 70 52.5" fill="none" stroke={trim} stroke-dasharray="2 2" {...lw(1)} />
      </g>
      {/* the near jumping leg, over the blanket */}
      <Limb pts={L.hind} fill={C.leg} w={2.4} />
      <path d={`M ${n1((L.hind[0][0] * 2 + L.hind[1][0]) / 3)} ${n1((L.hind[0][1] * 2 + L.hind[1][1]) / 3)} l -2.6 -0.6 M ${n1((L.hind[0][0] + L.hind[1][0] * 2) / 3)} ${n1((L.hind[0][1] + L.hind[1][1] * 2) / 3)} l -2.6 -0.6`} fill="none" stroke={C.ink} stroke-linecap="round" {...lw(1.2)} />
      <Femur H={L.hindH} K={L.hindK} r1={5.6} r2={2.6} fill={C.leg} mark={darken("#c4d65c", 0.3)} />
      {/* head */}
      <g transform={`translate(0 ${b})`}>
        <path d={HEAD} fill={C.body} {...LINE} />
        <path d="M 82 53 Q 88 48.5 95 50" fill="none" stroke={C.bodyHi} stroke-linecap="round" {...lw(2.2)} />
        <path d="M 97.5 72 Q 104.5 72.5 102.5 78.5 Q 98 79.5 95.5 76 Z" fill={C.mouth} {...LINE} {...lw(1.8)} />
        <ellipse cx="85" cy="68.5" rx="3.4" ry="2" fill={C.blush} opacity="0.6" />
        {s.blink ? (
          <path d="M 87 59.5 Q 92 64 97 59.5" fill="none" stroke={C.ink} stroke-linecap="round" {...lw(2.4)} />
        ) : (
          <g>
            <ellipse cx="92" cy="59" rx="5.6" ry="7" fill={C.eye} stroke={C.ink} {...lw(1.6)} />
            <circle cx="94" cy="56" r="2.3" fill="#fff" />
            <circle cx="90.3" cy="62.4" r="1.1" fill="#fff" />
          </g>
        )}
        <path d="M 89.5 71 Q 92.5 73.6 95.5 72" fill="none" stroke={C.ink} stroke-linecap="round" {...lw(1.4)} />
      </g>
      <Antenna d={antenna(91, 50 + b, s.a1, 34)} fill={C.ant} />
    </g>
  );
}

export const RidingChirp: RiderDraft = {
  id: "riding-chirp",
  name: "Riding Chirp",
  tier: "mythic",
  description: "Chirp, Chub's trusty grasshopper. Goes one square per hop, and chirps about it the whole way.",
  frame: [-6, 0, 112, 100],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: (anim, f) => {
    if (anim === "move") {
      const m = MOVE[f % MOVE.length];
      return { dx: m.dx, dy: m.dy, pawnX: 0, pawnY: -16 + m.b + m.extra, pawnTilt: m.tilt, cut: 69 - m.extra };
    }
    const s = IDLE[f % IDLE.length];
    return { dx: 0, dy: 0, pawnX: 0, pawnY: -16 + s.b, pawnTilt: 0, cut: 69 };
  },
  Back,
  Front,
};
