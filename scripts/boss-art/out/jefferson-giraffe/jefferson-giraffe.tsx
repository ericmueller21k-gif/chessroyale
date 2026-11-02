import type { RiderDraft, RiderProps, TrailProps } from "../../item-kit.tsx";
import { Region, LINE, lw, lighten, mirror } from "../../item-kit.tsx";

const COAT = "#f5b83d";
const COAT_FAR = "#d8952c";
const SPOT = "#c96f27";
const SPOT_FAR = "#a95b1f";
const CREAM = "#fbe3ad";
const HOOF = "#6b3a1e";
const HORN = "#8a552a";
const STRAP = "#7a4a24";
const GOLD = "#f6cf4a";
const FL_OUT = "#ea561b";
const FL_MID = "#f8a21f";
const FL_IN = "#ffe36a";
const INK = "#1d1d1f";

const R = Math.PI / 180;
const TAU = Math.PI * 2;
const N_IDLE = 8;
const N_MOVE = 8;
/** The pawn's base on the group (50 + pawnX, 88 + pawnY): the body pitches round it, so the pawn tilts with it. */
const PIVOT: Pt = [44, 68];
const NECK_PIVOT: Pt = [72, 52];
const PAWN_X = -6;
const PAWN_Y = -20;
const SEAT = 46; // the saddle's seat line on the group: the pawn is hidden below it
const LIFT = "translate(0 -4)"; // the body and saddle are drawn 4 lower than they sit

type Pt = [number, number];
const n1 = (n: number) => (Math.round(n * 10) / 10).toString();
const P = (p: Pt) => `${n1(p[0])} ${n1(p[1])}`;
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
const rot = (p: Pt, deg: number, c: Pt): Pt => {
  const s = Math.sin(deg * R);
  const co = Math.cos(deg * R);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * co - y * s, c[1] + x * s + y * co];
};

interface Leg {
  a1: number;
  a2: number;
}
type LegName = "nf" | "ff" | "nh" | "fh";
const HIPS: Record<LegName, Pt> = { ff: [64, 63], fh: [33, 63], nf: [71, 64], nh: [26, 64] };
const L1 = 16.5;
const L2 = 12.5;

function legsAt(anim: "idle" | "move", f: number): Record<LegName, Leg> {
  if (anim === "idle") {
    return { nf: { a1: 3, a2: 0 }, ff: { a1: -5, a2: -3 }, nh: { a1: -8, a2: 5 }, fh: { a1: 5, a2: 1 } };
  }
  const t = (f / N_MOVE) * TAU;
  const front = (tt: number): Leg => {
    const a1 = 40 * Math.cos(tt);
    const fold = 85 * Math.max(0, -Math.sin(tt));
    return { a1, a2: a1 - fold + 10 * Math.max(0, Math.cos(tt)) };
  };
  const hind = (tt: number): Leg => {
    const a1 = -38 * Math.cos(tt);
    const fold = 70 * Math.max(0, Math.sin(tt));
    return { a1, a2: a1 - fold - 6 };
  };
  return { nf: front(t), ff: front(t - 0.7), nh: hind(t), fh: hind(t - 0.7) };
}

function legGeom(hip: Pt, l: Leg) {
  const d1: Pt = [Math.sin(l.a1 * R), Math.cos(l.a1 * R)];
  const d2: Pt = [Math.sin(l.a2 * R), Math.cos(l.a2 * R)];
  const K = add(hip, d1, L1);
  const F = add(K, d2, L2);
  return { d1, d2, K, F };
}

const pitchAt = (anim: "idle" | "move", f: number) => (anim === "idle" ? 0 : 3 * Math.sin((f / N_MOVE) * TAU));
const neckAt = (anim: "idle" | "move", f: number) =>
  anim === "idle" ? 1.6 * Math.sin((f / N_IDLE) * TAU) : 7 * Math.sin((f / N_MOVE) * TAU + 0.4);

/** The lowest hoof's sole on the group, the body pitched. */
function soleAt(anim: "idle" | "move", f: number) {
  const legs = legsAt(anim, f);
  const pitch = pitchAt(anim, f);
  let low = -1e9;
  for (const k of Object.keys(HIPS) as LegName[]) {
    const g = legGeom(HIPS[k], legs[k]);
    const sole = rot(add(g.F, g.d2, 4.5), pitch, PIVOT);
    low = Math.max(low, sole[1]);
  }
  return low;
}
const GROUND = soleAt("idle", 0);

function LegArt({ hip, l, far }: { hip: Pt; l: Leg; far?: boolean }) {
  const { d1, d2, K, F } = legGeom(hip, l);
  const nA: Pt = [d1[1], -d1[0]];
  const nB: Pt = [d2[1], -d2[0]];
  let nK: Pt = [nA[0] + nB[0], nA[1] + nB[1]];
  const m = Math.hypot(nK[0], nK[1]) || 1;
  nK = [nK[0] / m, nK[1] / m];
  const w0 = 4.6;
  const wk = 3.4;
  const w2 = 2.8;
  const d =
    `M ${P(add(hip, nA, w0))} L ${P(add(K, nK, wk))} L ${P(add(F, nB, w2))} ` +
    `A ${w2} ${w2} 0 0 1 ${P(add(F, nB, -w2))} L ${P(add(K, nK, -wk))} L ${P(add(hip, nA, -w0))} ` +
    `A ${w0} ${w0} 0 0 1 ${P(add(hip, nA, w0))} Z`;
  const top = add(F, d2, -1.2);
  const bot = add(F, d2, 3.6);
  const hoof = `M ${P(add(top, nB, 3.3))} L ${P(add(bot, nB, 3.8))} L ${P(add(bot, nB, -3.8))} L ${P(add(top, nB, -3.3))} Z`;
  const spot = add(hip, d1, 7.5);
  return (
    <g>
      <path d={d} fill={far ? COAT_FAR : COAT} {...LINE} />
      <ellipse cx={spot[0]} cy={spot[1]} rx="2.1" ry="2.5" fill={far ? SPOT_FAR : SPOT} />
      <path d={hoof} fill={HOOF} {...LINE} {...lw(2.4)} />
    </g>
  );
}

/** A flame pointing up from (0, 0), turned `ang` degrees, `len` long. */
function Flame({ x, y, len, w, ang, k = 0 }: { x: number; y: number; len: number; w: number; ang: number; k?: number }) {
  const h = len;
  const tipX = k;
  const outer = `M ${-w} 0 C ${-w} ${-h * 0.45} ${tipX * 0.4 - w * 0.25} ${-h * 0.62} ${tipX} ${-h} C ${tipX * 0.3 + w * 0.7} ${-h * 0.55} ${w} ${-h * 0.4} ${w} 0 C ${w} ${w * 0.95} ${-w} ${w * 0.95} ${-w} 0 Z`;
  const w2 = w * 0.6;
  const h2 = h * 0.66;
  const mid = `M ${-w2} 0.4 C ${-w2} ${-h2 * 0.45} ${tipX * 0.3} ${-h2 * 0.7} ${tipX * 0.55} ${-h2} C ${w2 * 0.8} ${-h2 * 0.5} ${w2} ${-h2 * 0.35} ${w2} 0.4 C ${w2} ${w2 * 0.9} ${-w2} ${w2 * 0.9} ${-w2} 0.4 Z`;
  const w3 = w * 0.32;
  const h3 = h * 0.34;
  const inner = `M ${-w3} 0.8 C ${-w3} ${-h3 * 0.5} 0 ${-h3 * 0.8} ${tipX * 0.3} ${-h3} C ${w3} ${-h3 * 0.5} ${w3} ${-h3 * 0.3} ${w3} 0.8 C ${w3} ${w3 + 1} ${-w3} ${w3 + 1} ${-w3} 0.8 Z`;
  return (
    <g transform={`translate(${n1(x)} ${n1(y)}) rotate(${n1(ang)})`}>
      <path d={outer} fill={FL_OUT} {...LINE} {...lw(1.6)} />
      <path d={mid} fill={FL_MID} />
      <path d={inner} fill={FL_IN} />
    </g>
  );
}

const flick = (f: number, ph: number) => Math.sin(f * 2.3 + ph);

// The neck's back edge (the mane grows from it).
const NB: [Pt, Pt, Pt, Pt] = [
  [64, 45],
  [69, 28],
  [72, 12],
  [75, -8],
];
const bez = (b: [Pt, Pt, Pt, Pt], t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0],
    u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1],
  ];
};

function Mane({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const ts = [0.2, 0.38, 0.56, 0.74, 0.9];
  const base = anim === "move" ? -78 : -55;
  return (
    <g>
      {ts.map((t, i) => {
        const [x, y] = bez(NB, t);
        const fl = flick(f, i * 1.7);
        const len = (anim === "move" ? 12.5 : 10) * (1 + 0.16 * fl) * (0.85 + t * 0.25);
        return <Flame key={i} x={x + 2.2} y={y} len={len} w={3.8} ang={base + fl * 6} k={fl * 1.2} />;
      })}
    </g>
  );
}

function Tail({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const sw = anim === "idle" ? Math.sin((f / N_IDLE) * TAU) * 2.5 : Math.sin((f / N_MOVE) * TAU * 2) * 2;
  const end: Pt = anim === "idle" ? [9 + sw, 75] : [3, 62 + sw];
  const ctl: Pt = anim === "idle" ? [11, 62] : [9, 58];
  const d = `M 18 60 Q ${P(ctl)} ${P(end)}`;
  const fl = flick(f, 0.9);
  return (
    <g>
      <path d={d} fill="none" stroke={INK} stroke-linecap="round" {...lw(5.6)} />
      <path d={d} fill="none" stroke={COAT} stroke-linecap="round" {...lw(2.4)} />
      <Flame x={end[0]} y={end[1] + 1} len={(anim === "idle" ? 8 : 9) * (1 + 0.15 * fl)} w={3.2} ang={anim === "idle" ? 180 + sw * 4 : -110 + fl * 5} k={fl} />
    </g>
  );
}

const BODY =
  "M 20 58 C 22 52 34 52 46 51 C 56 50 64 47 70 48 C 80 50 84 58 81 66 C 78 74 70 76 60 75 L 32 75 C 20 75 14 70 15 64 C 15 61 17 59 20 58 Z";
const NECK_FILL = "M 64 45 C 69 28 72 12 75 -8 L 88 -6 C 85 12 84 32 82 54 L 76 60 L 62 52 Z";
const NECK_BACK = "M 64 45 C 69 28 72 12 75 -8";
const NECK_FRONT = "M 88 -6 C 85 12 84 32 82 54";
const HEAD = "M 74 -16 C 74 -24 80 -28 86 -27 C 92 -26 95 -22 95 -17 C 95 -10 90 -6 84 -6 C 78 -6 74 -10 74 -16 Z";
const MUZZLE = "M 87 -15 C 91 -19 100 -18 102 -12.5 C 103.5 -7.5 98 -4 93 -4 C 88 -4 85 -8 87 -15 Z";

function Head({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const idle = anim === "idle";
  const earA = idle ? (f === 2 ? -22 : f === 3 ? 10 : 0) : -14 + 6 * Math.sin((f / N_MOVE) * TAU);
  const blink = idle && f === 5;
  const chew = idle ? (f % 2 === 0 ? 0 : 0.9) : 0;
  const flameAng = idle ? 0 : -38;
  const fa = flick(f, 0.2);
  const fb = flick(f, 2.6);
  return (
    <g>
      {/* far ossicone */}
      <path d="M 78 -23 L 77.4 -31 L 80.6 -31 L 81.6 -23 Z" fill={HORN} {...LINE} {...lw(2)} />
      <circle cx="79" cy="-32.4" r="2.7" fill={HORN} {...LINE} {...lw(2)} />
      <Flame x={79} y={-34} len={8.5 * (1 + 0.18 * fb)} w={2.9} ang={flameAng + fb * 7} k={fb * 1.2} />
      {/* ear */}
      <g transform={`rotate(${earA} 77 -18)`}>
        <path d="M 77.5 -19.5 C 72 -25 66 -25 63.5 -22.5 C 66.5 -18 72 -15.5 77.5 -15.5 Z" fill={COAT} {...LINE} {...lw(2.2)} />
        <path d="M 75 -18.6 C 71 -21.6 68 -21.8 66.6 -21.4 C 68.6 -19 71.5 -17.6 75 -17.4 Z" fill="#f2a08a" />
      </g>
      <path d={HEAD} fill={COAT} {...LINE} />
      <ellipse cx="79.5" cy="-11.5" rx="2.3" ry="2" fill={SPOT} />
      <ellipse cx="90.5" cy="-23.2" rx="1.8" ry="1.4" fill={SPOT} />
      <path d="M 78.5 -23.5 C 81 -25.4 84 -25.8 86 -25.4" fill="none" stroke={lighten(COAT, 0.55)} stroke-linecap="round" {...lw(1.8)} />
      {/* near ossicone */}
      <path d="M 84.6 -24 L 84.2 -32 L 87.6 -32 L 88.2 -24 Z" fill={HORN} {...LINE} {...lw(2)} />
      <circle cx="86" cy="-33.4" r="2.8" fill={HORN} {...LINE} {...lw(2)} />
      <Flame x={86} y={-35} len={9.5 * (1 + 0.18 * fa)} w={3.1} ang={flameAng + fa * 7} k={fa * 1.3} />
      {/* muzzle */}
      <g transform={`translate(0 ${chew * 0.4})`}>
        <path d={MUZZLE} fill={CREAM} {...LINE} {...lw(2.4)} />
        <ellipse cx="99" cy="-13" rx="1.1" ry="0.8" fill={INK} />
        <path d={chew ? "M 92.5 -8.4 Q 96 -6.6 99.6 -8.8" : "M 92 -8.8 Q 96 -5.6 100 -9.2"} fill="none" stroke={INK} stroke-linecap="round" {...lw(1.6)} />
      </g>
      <ellipse cx="87.6" cy="-10.6" rx="2.3" ry="1.4" fill="#f08e74" opacity="0.75" />
      {/* eye */}
      {blink ? (
        <path d="M 80 -17 Q 83.2 -14.6 86.4 -17" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.8)} />
      ) : (
        <g>
          <ellipse cx="83.2" cy="-17" rx="2.7" ry="3.3" fill={INK} />
          <circle cx="84.1" cy="-18.4" r="1.05" fill="#fff" />
          <path d="M 80.2 -20.6 L 79 -21.8" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.4)} />
        </g>
      )}
    </g>
  );
}

const SPOTS_BODY: [number, number, number, number][] = [
  [21, 65.5, 3.2, 2.7],
  [30, 71.4, 3, 2],
  [43, 71.6, 3.2, 2],
  [57, 71.2, 3, 2.1],
  [75, 58.5, 3, 3.6],
  [72.5, 69, 2.6, 2.1],
];
const SPOTS_NECK: [number, number, number, number][] = [
  [72, 44, 3, 3.4],
  [78.5, 33, 3.2, 3],
  [73.5, 25, 2.5, 2.6],
  [80.5, 16, 2.9, 2.6],
  [76.5, 6, 2.5, 2.4],
  [82.5, -1, 2.1, 2],
];

function Back({ anim, f }: RiderProps) {
  const legs = legsAt(anim, f);
  const pitch = pitchAt(anim, f);
  const na = neckAt(anim, f);
  const neckT = `rotate(${n1(na)} ${P(NECK_PIVOT)})`;
  return (
    <g transform={`rotate(${n1(pitch)} ${P(PIVOT)})`}>
      <LegArt hip={HIPS.fh} l={legs.fh} far />
      <LegArt hip={HIPS.ff} l={legs.ff} far />
      <LegArt hip={HIPS.nh} l={legs.nh} />
      <LegArt hip={HIPS.nf} l={legs.nf} />
      <g transform={LIFT}>
        <Tail anim={anim} f={f} />
      </g>
      <g transform={neckT}>
        <Mane anim={anim} f={f} />
      </g>
      <g transform={LIFT}>
        <path d={BODY} fill={COAT} {...LINE} />
        {SPOTS_BODY.map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={SPOT} />
        ))}
        <path d="M 71 51.5 C 76 52.5 79 55.5 80 59" fill="none" stroke={lighten(COAT, 0.55)} stroke-linecap="round" {...lw(1.8)} />
      </g>
      <g transform={neckT}>
        <path d={NECK_FILL} fill={COAT} />
        {SPOTS_NECK.map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={SPOT} />
        ))}
        <path d={NECK_BACK} fill="none" {...LINE} />
        <path d={NECK_FRONT} fill="none" {...LINE} />
        <Head anim={anim} f={f} />
      </g>
    </g>
  );
}

const BLANKET = "M 18 51 C 30 49 56 46 69 46 C 70.8 52 70.8 57.5 69.6 63.5 C 52 66 34 66 19.4 64.5 C 17 59.5 17 55 18 51 Z";
const SADDLE =
  "M 20 44 C 22 40.5 26.5 41 27 45 C 30 50 54 50 59 46 C 61 43 64 41 67 42 C 69.5 43 69 46.5 67 49 C 64 55 56 56.5 44 56.5 C 32 56.5 24 55.5 21 51.5 C 19 49 19 46 20 44 Z";

function Front({ anim, f, p }: RiderProps) {
  const pitch = pitchAt(anim, f);
  return (
    <g transform={`rotate(${n1(pitch)} ${P(PIVOT)}) ${LIFT}`}>
      <path d="M 46 56 L 52 56 L 52.6 75.6 L 46.6 75.6 Z" fill={STRAP} {...LINE} {...lw(2.2)} />
      <Region
        p={p}
        name="blanket"
        d={[BLANKET]}
        fill={lighten(p.hex, 0.28)}
        over={
          <g>
            <path d="M 10 59.6 L 80 57.6 L 80 72 L 10 72 Z" fill={p.fill} />
            <path d="M 10 59.6 L 80 57.6" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.4)} />
          </g>
        }
      />
      <circle cx="25" cy="62.2" r="1.4" fill={GOLD} stroke={INK} {...lw(1)} />
      <circle cx="40" cy="62" r="1.4" fill={GOLD} stroke={INK} {...lw(1)} />
      <circle cx="62" cy="61.4" r="1.4" fill={GOLD} stroke={INK} {...lw(1)} />
      <Region p={p} name="saddle" d={[SADDLE]} />
      <path d="M 29 52.5 C 36 54.4 52 54.4 60 51.2" fill="none" stroke={lighten(p.hex, 0.45)} stroke-linecap="round" opacity="0.8" {...lw(1.6)} />
      <circle cx="66" cy="43.6" r="1.3" fill={GOLD} stroke={INK} {...lw(0.9)} />
    </g>
  );
}

// ───────────── Front and back views (end-on) ─────────────

type View = "front" | "back";
type Anim = "idle" | "move";
/** Where each leg stands across the picture, seen from each end. */
const SX: Record<View, Record<LegName, number>> = {
  back: { nh: 61, fh: 39, nf: 55.5, ff: 44.5 },
  front: { nf: 39, ff: 61, nh: 44.5, fh: 55.5 },
};
const isFore = (k: LegName) => k === "nf" || k === "ff";
const isNearEnd = (v: View, k: LegName) => (v === "back" ? !isFore(k) : isFore(k));
const LEG_ORDER: Record<View, LegName[]> = { back: ["nf", "ff"], front: ["nh", "fh"] };
const LEG_NEAR: Record<View, LegName[]> = { back: ["nh", "fh"], front: ["nf", "ff"] };

/** One leg seen end-on: the side's angles, flattened (a leg reaching toward us sits a little lower). */
function endLeg(view: View, k: LegName, anim: Anim, f: number) {
  const l = legsAt(anim, f)[k];
  const pitch = pitchAt(anim, f);
  const s = view === "back" ? -1 : 1;
  const near = isNearEnd(view, k);
  const hy = (near ? 64 : 61) + (isFore(k) ? 0.4 : -0.25) * pitch;
  const x = SX[view][k];
  const v1 = Math.cos(l.a1 * R) + s * Math.sin(l.a1 * R) * 0.2;
  const v2 = Math.max(0.3, Math.cos(l.a2 * R) + s * Math.sin(l.a2 * R) * 0.2);
  const ky = hy + L1 * v1;
  const fy = ky + L2 * v2;
  const hoof = 4.8 * Math.max(0.5, v2);
  return { x, hy, ky, fy, hoof, near, sole: fy - 1.2 + hoof + (near ? 0 : 3) };
}
function endSoleAt(view: View, anim: Anim, f: number) {
  let low = -1e9;
  for (const k of Object.keys(HIPS) as LegName[]) low = Math.max(low, endLeg(view, k, anim, f).sole);
  return low;
}

function EndLegArt({ view, k, anim, f }: { view: View; k: LegName; anim: Anim; f: number }) {
  const g = endLeg(view, k, anim, f);
  const { x, hy, ky, fy } = g;
  const w0 = 4.8;
  const wk = 3.5;
  const w2 = 2.9;
  const d =
    `M ${n1(x - w0)} ${n1(hy)} L ${n1(x - wk)} ${n1(ky)} L ${n1(x - w2)} ${n1(fy)} L ${n1(x + w2)} ${n1(fy)} ` +
    `L ${n1(x + wk)} ${n1(ky)} L ${n1(x + w0)} ${n1(hy)} A ${w0} ${w0} 0 0 0 ${n1(x - w0)} ${n1(hy)} Z`;
  const top = fy - 1.2;
  const bot = top + g.hoof;
  const hoof = `M ${n1(x - 3.3)} ${n1(top)} L ${n1(x - 3.8)} ${n1(bot)} L ${n1(x + 3.8)} ${n1(bot)} L ${n1(x + 3.3)} ${n1(top)} Z`;
  const far = !g.near;
  return (
    <g>
      <path d={d} fill={far ? COAT_FAR : COAT} {...LINE} />
      <ellipse cx={x + (x < 50 ? -0.6 : 0.6)} cy={ky - 3.2} rx="2" ry="2.3" fill={far ? SPOT_FAR : SPOT} />
      <path d={hoof} fill={HOOF} {...LINE} {...lw(2.4)} />
    </g>
  );
}

function endPose(view: View) {
  return (anim: Anim, f: number) => {
    if (anim === "idle") return { dx: 0, dy: 0, pawnX: 0, pawnY: PAWN_Y, cut: SEAT - PAWN_Y };
    const t = (f / N_MOVE) * TAU;
    const air = 3 * Math.max(0, Math.cos(t)) ** 2;
    const dy = endSoleAt(view, "idle", 0) - endSoleAt(view, anim, f) - air;
    const lift = 1.8 * Math.max(0, Math.cos(t - 0.8));
    const pawnY = PAWN_Y - lift;
    return { dx: 0, dy, pawnX: 0, pawnY, pawnTilt: 1.4 * Math.sin(t) * (view === "back" ? 1 : -1), cut: SEAT - pawnY };
  };
}

const earAt = (anim: Anim, f: number) =>
  anim === "idle" ? (f === 2 ? -22 : f === 3 ? 10 : 0) : -14 + 6 * Math.sin((f / N_MOVE) * TAU);

/** A horn flame for the end views: in the move it leans back (foreshortened) and splays out. */
function hornFlame(anim: Anim, f: number, side: -1 | 1, x: number, y: number, ph: number, base: number) {
  const fl = flick(f, ph);
  const idle = anim === "idle";
  return (
    <Flame
      x={x}
      y={y}
      len={base * (idle ? 1 : 0.85) * (1 + 0.18 * fl)}
      w={idle ? 3 : 3.3}
      ang={side * (idle ? 7 : 18) + fl * 7}
      k={fl * 1.2}
    />
  );
}

const END_BLANKET = "M 27 52 C 27 44 37 40.5 50 40.5 C 63 40.5 73 44 73 52 L 73.5 62.5 C 62 65 38 65 26.5 62.5 Z";
const END_SADDLE = "M 31.5 46.5 C 31.5 41 39 38.5 50 38.5 C 61 38.5 68.5 41 68.5 46.5 C 68.5 51 65 53.5 60 53.5 L 40 53.5 C 35 53.5 31.5 51 31.5 46.5 Z";

function EndTack({ p }: { p: RiderProps["p"] }) {
  return (
    <g>
      <Region
        p={p}
        name="blanket"
        d={[END_BLANKET]}
        fill={lighten(p.hex, 0.28)}
        over={
          <g>
            <path d="M 15 57.6 C 35 60 65 60 85 57.6 L 85 72 L 15 72 Z" fill={p.fill} />
            <path d="M 15 57.6 C 35 60 65 60 85 57.6" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.4)} />
          </g>
        }
      />
      <circle cx="30.2" cy="61.3" r="1.4" fill={GOLD} stroke={INK} {...lw(1)} />
      <circle cx="69.8" cy="61.3" r="1.4" fill={GOLD} stroke={INK} {...lw(1)} />
      <Region p={p} name="saddle" d={[END_SADDLE]} />
      <path d="M 35.5 49.6 C 42 51.4 58 51.4 64.5 49.6" fill="none" stroke={lighten(p.hex, 0.45)} stroke-linecap="round" opacity="0.8" {...lw(1.6)} />
      <circle cx="50" cy="41.6" r="1.3" fill={GOLD} stroke={INK} {...lw(0.9)} />
    </g>
  );
}

// ── Back view: rump and tail toward us, the neck and head beyond the pawn ──

const B_NECK = "M 44.5 -12 C 44 4 42.5 24 41 42 L 59 42 C 57.5 24 56 4 55.5 -12 Z";
const B_HEAD = "M 39.5 -16.5 C 39.5 -23 44 -27 50 -27 C 56 -27 60.5 -23 60.5 -16.5 C 60.5 -10.5 56 -6.5 50 -6.5 C 44 -6.5 39.5 -10.5 39.5 -16.5 Z";
const B_EAR = "M 41 -18 C 36 -22.5 30.5 -23 28 -21 C 30.5 -17 35 -14.5 41 -14.5 Z";
const B_HORN = "M 44 -24 L 43.2 -32 L 46.4 -32.4 L 47.6 -24.6 Z";
const B_RUMP =
  "M 50 53.5 C 45 50.5 37 51 35.5 58 C 34 65 34.5 74 38.5 77.5 L 61.5 77.5 C 65.5 74 66 65 64.5 58 C 63 51 55 50.5 50 53.5 Z";

function BackViewBack({ anim, f }: RiderProps) {
  const idle = anim === "idle";
  const na = neckAt(anim, f);
  const pitch = pitchAt(anim, f);
  const sway = idle ? na * 1.2 : 0;
  const ear = earAt(anim, f);
  const ys = [-2, 6, 14, 22];
  return (
    <g transform={`translate(0 ${n1(na * 0.35 + pitch * 0.4)}) rotate(${n1(sway)} 50 40)`}>
      <path d={B_NECK} fill={COAT} {...LINE} />
      <ellipse cx="52.6" cy="-2.5" rx="2.3" ry="2.5" fill={SPOT} />
      <ellipse cx="45.8" cy="26" rx="2.4" ry="2.6" fill={SPOT} />
      {ys.map((y, i) => {
        const sg = i % 2 === 0 ? -1 : 1;
        const fl = flick(f, i * 1.7);
        const len = (idle ? 10.5 : 12.5) * (1 + 0.16 * fl) * (1.05 - i * 0.04);
        return <Flame key={i} x={50 + sg * 3.4} y={y} len={len} w={3.7} ang={sg * (idle ? 52 : 68) + fl * 6} k={fl * 1.2 * sg} />;
      })}
      <g transform={`rotate(${n1(-ear)} 40.5 -16.5)`}>
        <path d={B_EAR} fill={COAT} {...LINE} {...lw(2.2)} />
      </g>
      <g transform={`rotate(${n1(ear)} 59.5 -16.5)`}>
        <path d={mirror(B_EAR)} fill={COAT} {...LINE} {...lw(2.2)} />
      </g>
      <path d={B_HORN} fill={HORN} {...LINE} {...lw(2)} />
      <path d={mirror(B_HORN)} fill={HORN} {...LINE} {...lw(2)} />
      <path d={B_HEAD} fill={COAT} {...LINE} />
      <ellipse cx="45.5" cy="-12.5" rx="2.3" ry="2" fill={SPOT} />
      <ellipse cx="55.2" cy="-20.6" rx="1.8" ry="1.4" fill={SPOT} />
      <path d="M 43.5 -23.4 C 45.5 -25.1 48 -25.5 50 -25.3" fill="none" stroke={lighten(COAT, 0.55)} stroke-linecap="round" {...lw(1.8)} />
      <circle cx="44.7" cy="-33.4" r="2.7" fill={HORN} {...LINE} {...lw(2)} />
      <circle cx="55.3" cy="-33.4" r="2.7" fill={HORN} {...LINE} {...lw(2)} />
      {hornFlame(anim, f, -1, 44.6, -35, 2.6, 9)}
      {hornFlame(anim, f, 1, 55.4, -35, 0.2, 9)}
    </g>
  );
}

function BackTail({ anim, f }: { anim: Anim; f: number }) {
  const idle = anim === "idle";
  const sw = idle ? Math.sin((f / N_IDLE) * TAU) * 2.5 : Math.sin((f / N_MOVE) * TAU * 2) * 2;
  const end: Pt = idle ? [50 + sw, 71] : [50 + sw * 1.5, 63];
  const ctl: Pt = idle ? [50 + sw * 0.2, 64] : [50, 60];
  const d = `M 50 55 Q ${P(ctl)} ${P(end)}`;
  const fl = flick(f, 0.9);
  return (
    <g>
      <path d={d} fill="none" stroke={INK} stroke-linecap="round" {...lw(5.6)} />
      <path d={d} fill="none" stroke={COAT} stroke-linecap="round" {...lw(2.4)} />
      <Flame
        x={end[0]}
        y={end[1] + 1}
        len={(idle ? 8 : 7) * (1 + 0.15 * fl)}
        w={idle ? 3.2 : 3.6}
        ang={idle ? 180 + sw * 4 : 180 + fl * 10}
        k={fl}
      />
    </g>
  );
}

function BackViewFront({ anim, f, p }: RiderProps) {
  const pitch = pitchAt(anim, f);
  return (
    <g>
      {LEG_ORDER.back.map((k) => (
        <EndLegArt key={k} view="back" k={k} anim={anim} f={f} />
      ))}
      {LEG_NEAR.back.map((k) => (
        <EndLegArt key={k} view="back" k={k} anim={anim} f={f} />
      ))}
      <EndTack p={p} />
      <g transform={`translate(0 ${n1(-0.3 * pitch)})`}>
        <path d={B_RUMP} fill={COAT} {...LINE} />
        <ellipse cx="40.5" cy="62" rx="2.8" ry="3" fill={SPOT} />
        <ellipse cx="59.5" cy="60" rx="2.6" ry="2.4" fill={SPOT} />
        <ellipse cx="44" cy="72.5" rx="2.8" ry="2" fill={SPOT} />
        <ellipse cx="58" cy="71" rx="2.4" ry="2.2" fill={SPOT} />
        <path d="M 38.6 57.5 C 39.6 55 42 53.6 45 53.7" fill="none" stroke={lighten(COAT, 0.55)} stroke-linecap="round" {...lw(1.8)} />
        <BackTail anim={anim} f={f} />
      </g>
    </g>
  );
}

// ── Front view: nothing of it shows behind the pawn ──

function FrontViewBack(_: RiderProps) {
  return <g />;
}

// ── Front view (long neck): the neck rises up the middle in front of the pawn, the head high above it ──

const G_CHEST = "M 39 52 C 44 49 56 49 61 52 C 66 57 67 69 61.5 77.5 L 38.5 77.5 C 33 69 34 57 39 52 Z";
const G_HEAD = "M 39.5 -18 C 39.5 -24.5 44 -28 50 -28 C 56 -28 60.5 -24.5 60.5 -18 C 60.5 -12 57.5 -8.5 50 -8.5 C 42.5 -8.5 39.5 -12 39.5 -18 Z";
const G_MUZZLE = "M 42.5 -8 C 42.5 -12.6 45.8 -14.4 50 -14.4 C 54.2 -14.4 57.5 -12.6 57.5 -8 C 57.5 -3.6 54.4 -1.6 50 -1.6 C 45.6 -1.6 42.5 -3.6 42.5 -8 Z";
const G_EAR_IN = "M 39 -17.4 C 35.5 -20.4 32 -20.8 30.4 -20.3 C 32.4 -17.7 35.5 -16.1 39 -15.9 Z";

function GiraffeFront({ anim, f, p }: RiderProps) {
  const idle = anim === "idle";
  const pitch = pitchAt(anim, f);
  const na = neckAt(anim, f);
  const sway = idle ? na * 1.2 : 0;
  const hy = na * 0.4 + pitch * 0.45;
  const ear = earAt(anim, f);
  const blink = idle && f === 5;
  const chew = idle ? (f % 2 === 0 ? 0 : 0.9) : 0;
  const cy = 0.45 * pitch;
  const T = -9 + hy;
  const neckL = `M 46 ${n1(T)} C 45.8 ${n1(T + 24)} 44.8 34 43.6 45 Q 42.8 ${n1(51 + cy)} 39.6 ${n1(54 + cy)}`;
  const neckR = `M 54 ${n1(T)} C 54.2 ${n1(T + 24)} 55.2 34 56.4 45 Q 57.2 ${n1(51 + cy)} 60.4 ${n1(54 + cy)}`;
  const neckFill = `${neckL} L 60.4 ${n1(56 + cy)} L 60.4 ${n1(54 + cy)} Q 57.2 ${n1(51 + cy)} 56.4 45 C 55.2 34 54.2 ${n1(T + 24)} 54 ${n1(T)} Z`;
  const ys = [4, 13, 22, 31];
  return (
    <g>
      {LEG_ORDER.front.map((k) => (
        <EndLegArt key={k} view="front" k={k} anim={anim} f={f} />
      ))}
      <EndTack p={p} />
      {LEG_NEAR.front.map((k) => (
        <EndLegArt key={k} view="front" k={k} anim={anim} f={f} />
      ))}
      <g transform={`translate(0 ${n1(cy)})`}>
        <path d={G_CHEST} fill={COAT} {...LINE} />
        <ellipse cx="39.6" cy="61" rx="2.6" ry="2.6" fill={SPOT} />
        <ellipse cx="60" cy="60" rx="2.4" ry="3" fill={SPOT} />
        <ellipse cx="53" cy="70" rx="3" ry="2" fill={SPOT} />
        <ellipse cx="43.5" cy="71.5" rx="2.5" ry="1.9" fill={SPOT} />
        <ellipse cx="49" cy="59.5" rx="2.2" ry="2" fill={SPOT} />
      </g>
      <g transform={`rotate(${n1(sway)} 50 50)`}>
        {ys.map((y, i) => {
          const sg = i % 2 === 0 ? -1 : 1;
          const fl = flick(f, i * 1.7);
          const len = (idle ? 11 : 13) * (1 + 0.16 * fl) * (1.05 - i * 0.05);
          const yy = y + hy * (1 - (y + 9) / 55);
          return <Flame key={i} x={50 + sg * 3.6} y={yy} len={len} w={3.6} ang={sg * (idle ? 52 : 66) + fl * 6} k={fl * 1.2 * sg} />;
        })}
        <path d={neckFill} fill={COAT} />
        <ellipse cx="52.2" cy={n1(2 + hy * 0.8)} rx="2.1" ry="2.4" fill={SPOT} />
        <ellipse cx="47.6" cy={n1(15 + hy * 0.55)} rx="2" ry="2.5" fill={SPOT} />
        <ellipse cx="52.4" cy={n1(28 + hy * 0.3)} rx="2.2" ry="2.5" fill={SPOT} />
        <ellipse cx="47.4" cy="40" rx="2.3" ry="2.4" fill={SPOT} />
        <path d={`M 47.6 ${n1(T + 6)} C 47.4 ${n1(T + 16)} 47.1 ${n1(T + 22)} 46.8 ${n1(T + 28)}`} fill="none" stroke={lighten(COAT, 0.55)} stroke-linecap="round" {...lw(1.6)} />
        <path d={neckL} fill="none" {...LINE} />
        <path d={neckR} fill="none" {...LINE} />
        <g transform={`translate(0 ${n1(hy)})`}>
          <g transform={`rotate(${n1(-ear)} 40.5 -16.5)`}>
            <path d={B_EAR} fill={COAT} {...LINE} {...lw(2.2)} />
            <path d={G_EAR_IN} fill="#f2a08a" />
          </g>
          <g transform={`rotate(${n1(ear)} 59.5 -16.5)`}>
            <path d={mirror(B_EAR)} fill={COAT} {...LINE} {...lw(2.2)} />
            <path d={mirror(G_EAR_IN)} fill="#f2a08a" />
          </g>
          <path d={B_HORN} fill={HORN} {...LINE} {...lw(2)} />
          <path d={mirror(B_HORN)} fill={HORN} {...LINE} {...lw(2)} />
          <path d={G_HEAD} fill={COAT} {...LINE} />
          <ellipse cx="50" cy="-24.6" rx="2" ry="1.4" fill={SPOT} />
          <ellipse cx="41.8" cy="-13.4" rx="1.4" ry="1.8" fill={SPOT} />
          <path d="M 42.4 -23 C 43.8 -25 45.8 -26.2 47.6 -26.6" fill="none" stroke={lighten(COAT, 0.55)} stroke-linecap="round" {...lw(1.8)} />
          <circle cx="44.7" cy="-33.4" r="2.7" fill={HORN} {...LINE} {...lw(2)} />
          <circle cx="55.3" cy="-33.4" r="2.7" fill={HORN} {...LINE} {...lw(2)} />
          {hornFlame(anim, f, -1, 44.6, -35, 2.6, 9)}
          {hornFlame(anim, f, 1, 55.4, -35, 0.2, 9)}
          <ellipse cx="41.6" cy="-12.2" rx="2.3" ry="1.4" fill="#f08e74" opacity="0.75" />
          <ellipse cx="58.4" cy="-12.2" rx="2.3" ry="1.4" fill="#f08e74" opacity="0.75" />
          <g transform={`translate(0 ${chew * 0.4})`}>
            <path d={G_MUZZLE} fill={CREAM} {...LINE} {...lw(2.4)} />
            <ellipse cx="47.2" cy="-10" rx="1.1" ry="0.8" fill={INK} />
            <ellipse cx="52.8" cy="-10" rx="1.1" ry="0.8" fill={INK} />
            <path
              d={chew ? "M 46.2 -5.6 Q 50 -3.6 54 -6" : "M 45.6 -6.2 Q 50 -2.6 54.6 -6.8"}
              fill="none"
              stroke={INK}
              stroke-linecap="round"
              {...lw(1.6)}
            />
          </g>
          {blink ? (
            <g>
              <path d="M 41.8 -19 Q 44.6 -16.6 47.4 -19" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.8)} />
              <path d="M 52.6 -19 Q 55.4 -16.6 58.2 -19" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.8)} />
            </g>
          ) : (
            <g>
              <ellipse cx="44.6" cy="-19" rx="2.6" ry="3.2" fill={INK} />
              <circle cx="45.5" cy="-20.4" r="1" fill="#fff" />
              <path d="M 42 -21.8 L 40.7 -22.9" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.4)} />
              <ellipse cx="55.4" cy="-19" rx="2.6" ry="3.2" fill={INK} />
              <circle cx="56.3" cy="-20.4" r="1" fill="#fff" />
              <path d="M 58 -21.8 L 59.3 -22.9" fill="none" stroke={INK} stroke-linecap="round" {...lw(1.4)} />
            </g>
          )}
        </g>
      </g>
    </g>
  );
}

// ───────────── Trail: a pair of cloven hoofprints ─────────────

const PRINT = "#5a3218";
const PRINT_LINE = "#2e180a";
const PRINT_RIM = "#d9b07a";
/** One toe of a cloven print, pointing +x (the way it ran), the upper half; the lower is its mirror in y. */
const TOE = "M -3 -0.5 C -3.4 -2.6 -1.2 -3.4 0.6 -3 C 2 -2.6 3 -1.6 3.4 -0.6 Z";
const TOE_LO = "M -3 0.5 C -3.4 2.6 -1.2 3.4 0.6 3 C 2 2.6 3 1.6 3.4 0.6 Z";

function CloveHoof({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d={TOE} fill="none" stroke={PRINT_RIM} stroke-linejoin="round" {...lw(2.4)} opacity="0.7" />
      <path d={TOE_LO} fill="none" stroke={PRINT_RIM} stroke-linejoin="round" {...lw(2.4)} opacity="0.7" />
      <path d={TOE} fill={PRINT} stroke={PRINT_LINE} stroke-linejoin="round" {...lw(1)} />
      <path d={TOE_LO} fill={PRINT} stroke={PRINT_LINE} stroke-linejoin="round" {...lw(1)} />
    </g>
  );
}

function HoofMark({ f, view, n }: TrailProps) {
  const s = n % 2 === 0 ? -1 : 1;
  const ang = view === "back" ? -90 : view === "front" ? 90 : 0;
  const op = [1, 0.6, 0.28][f] ?? 0.28;
  const k = 1.5 * ([1, 0.97, 0.92][f] ?? 0.92);
  return (
    <g opacity={op} transform="scale(1 0.9)">
      <g transform={`rotate(${ang})`}>
        <CloveHoof x={5.5} y={3.2 * s} k={k} />
        <CloveHoof x={-5.5} y={-3.2 * s} k={k} />
      </g>
    </g>
  );
}

const END_ANIMS = { idle: { ms: Array(N_IDLE).fill(170) }, move: { ms: Array(N_MOVE).fill(65) } };

export const rider: RiderDraft = {
  id: "jefferson-giraffe",
  name: "Giraffe Gallop",
  tier: "mythic",
  description: "A young giraffe with a hot head, a hotter mane and no idea what a speed limit is. Mind the horns: they're lit.",
  frame: [-4, -44, 110, 144],
  idle: { ms: Array(N_IDLE).fill(170) },
  move: { ms: Array(N_MOVE).fill(65) },
  pose: (anim, f) => {
    if (anim === "idle") return { dx: 0, dy: 0, pawnX: PAWN_X, pawnY: PAWN_Y, cut: SEAT - PAWN_Y };
    const t = (f / N_MOVE) * TAU;
    const air = 3 * Math.max(0, Math.cos(t)) ** 2;
    const dy = GROUND - soleAt(anim, f) - air;
    const lift = 1.8 * Math.max(0, Math.cos(t - 0.8));
    const pawnY = PAWN_Y - lift;
    return { dx: (f * 100) / N_MOVE, dy, pawnX: PAWN_X, pawnY, pawnTilt: pitchAt(anim, f) * 0.8, cut: SEAT - pawnY };
  },
  Back,
  Front,
  trail: { ms: [200, 200, 200], w: 26, h: 26, Mark: HoofMark },
  views: {
    back: { ...END_ANIMS, pose: endPose("back"), Back: BackViewBack, Front: BackViewFront },
    front: { ...END_ANIMS, pose: endPose("front"), Back: FrontViewBack, Front: GiraffeFront },
  },
};
