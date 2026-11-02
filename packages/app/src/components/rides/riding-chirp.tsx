// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/riding-chirp/riding-chirp.tsx, Nov 1: the side view, its front and back views, its
// trail mark): only the import lines changed and the `!`s the app's stricter typecheck asks for (noUncheckedIndexedAccess).
// The art's kit there (scripts/boss-art/item-kit.tsx) is a copy of ../item-paint.tsx and ./kit.ts. Notes: docs/areas/shop.md, "Rides".
import type { RiderDraft, RiderProps, RiderViewDraft, TrailProps } from "./kit.ts";
import { Region, LINE, lw, darken, lighten, isLight, mirror } from "../item-paint.tsx";

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

const st = (anim: "idle" | "move", f: number): S => (anim === "move" ? MOVE[f % MOVE.length]! : IDLE[f % IDLE.length]!);

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
      <path d={`M ${n1((L.hind[0]![0] * 2 + L.hind[1]![0]) / 3)} ${n1((L.hind[0]![1] * 2 + L.hind[1]![1]) / 3)} l -2.6 -0.6 M ${n1((L.hind[0]![0] + L.hind[1]![0] * 2) / 3)} ${n1((L.hind[0]![1] + L.hind[1]![1] * 2) / 3)} l -2.6 -0.6`} fill="none" stroke={C.ink} stroke-linecap="round" {...lw(1.2)} />
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

/* ---------- the front and back views (end-on), sharing the side's beats ---------- */
const mx = (pts: P[]): P[] => pts.map(([x, y]) => [100 - x, y] as P);
const mp = (q: P): P => [100 - q[0], q[1]];
function tones(hex: string) {
  const dark = !isLight(hex) && (parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)) / 3 < 70;
  return { blanket: dark ? lighten(hex, 0.28) : darken(hex, 0.22), trim: dark ? lighten(hex, 0.6) : lighten(hex, 0.45) };
}
function endBlanket() {
  let d = "M 20 66 Q 18 54 24 51 Q 50 45 76 51 Q 82 54 80 66";
  for (let i = 0; i < 6; i++) {
    const x = 80 - i * 10;
    d += ` Q ${x - 5} 70.5 ${x - 10} 66`;
  }
  return d + " Z";
}
const E_BLANKET = endBlanket();
const E_FLAP_L = "M 20.5 53 L 25.5 53.5 Q 26.5 61 25 66.5 L 21 66.5 Q 19.5 61 20.5 53 Z";
const E_FLAPS = [E_FLAP_L, mirror(E_FLAP_L)];

/** An antenna seen end-on: up, then bowing out (dir -1 to our left, 1 to our right). */
function endAntenna(bx: number, by: number, ang: number, L: number, dir: number, bow: number) {
  const r = (ang * Math.PI) / 180;
  const tx = bx + dir * L * Math.sin(r);
  const ty = by - L * Math.cos(r);
  const cx = bx + dir * L * bow;
  const cy = by - L * 0.7;
  return `M ${n1(bx)} ${n1(by)} Q ${n1(cx)} ${n1(cy)} ${n1(tx)} ${n1(ty)}`;
}

/** A front-view antenna: out sideways first (clear of the pawn), then up and a little out. */
function frontAntenna(bx: number, by: number, ang: number, L: number, dir: number) {
  const r = (ang * Math.PI) / 180;
  const tx = bx + dir * (12 + 0.6 * L * Math.sin(r));
  const ty = by - L * Math.cos(r);
  return `M ${n1(bx)} ${n1(by)} Q ${n1(bx + dir * 18)} ${n1(by - 9)} ${n1(tx)} ${n1(ty)}`;
}

interface EL {
  front: P[];
  mid: P[];
  hindH: P;
  hindK: P;
  hind: P[];
}
/** Our left-hand legs seen from the front (mirror for the right). */
function legsF(s: S): EL {
  const b = s.b;
  if (s.mode === "kick")
    return { front: [[42, 79], [39, 88], [38, 95], [35, 96.5]], mid: [[30, 78], [26, 86], [25, 93], [22, 94.5]], hindH: [30, 72], hindK: [17, 63], hind: [[17, 63], [12, 87], [9, 90]] };
  if (s.mode === "air")
    return { front: [[42, 79], [37, 86], [38, 91], [41, 92]], mid: [[30, 78], [24, 84], [25, 89], [28, 90]], hindH: [30, 72], hindK: [16, 54], hind: [[16, 54], [11, 79], [14, 83]] };
  if (s.mode === "reach")
    return { front: [[42, 79], [34, 86], [30, 93], [27, 94]], mid: [[30, 78], [22, 85], [19, 92], [16, 93]], hindH: [30, 72], hindK: [16, 54], hind: [[16, 54], [12, 85], [9, 88]] };
  return {
    front: [[42, 79 + b], [36, 85 + b * 0.5], [34, 95], [30, 96]],
    mid: [[30, 78 + b], [24, 84 + b * 0.5], [22, 94], [18, 95]],
    hindH: [30, 72 + b],
    hindK: [16, 52 + b * 0.7],
    hind: [[16, 52 + b * 0.7], [14, 92], [11, 94]],
  };
}
/** Our left-hand legs seen from behind (mirror for the right). */
function legsB(s: S): EL {
  const b = s.b;
  if (s.mode === "kick")
    return { front: [[44, 86], [42, 91], [41, 95], [39, 96]], mid: [[37, 84], [33, 90], [32, 95], [30, 96]], hindH: [33, 78], hindK: [16, 64], hind: [[16, 64], [12, 91], [9, 94]] };
  if (s.mode === "air")
    return { front: [[44, 86], [41, 89], [43, 92], [45, 92.5]], mid: [[37, 84], [32, 88], [34, 92], [37, 93]], hindH: [33, 78], hindK: [15, 54], hind: [[15, 54], [10, 80], [13, 84]] };
  if (s.mode === "reach")
    return { front: [[44, 86], [40, 90], [38, 94], [36, 95]], mid: [[37, 84], [30, 89], [27, 94], [24, 95]], hindH: [33, 78], hindK: [15, 54], hind: [[15, 54], [11, 86], [8, 89]] };
  return {
    front: [[44, 86 + b], [41, 90 + b * 0.5], [40, 95], [38, 95.5]],
    mid: [[37, 84 + b], [31, 89 + b * 0.5], [29, 95], [26, 96]],
    hindH: [33, 78 + b],
    hindK: [15, 50 + b * 0.7],
    hind: [[15, 50 + b * 0.7], [9, 93], [5, 95]],
  };
}
const liftLeg = (pts: P[], lift: number, dir: number): P[] =>
  lift ? pts.map((q, i) => (i === 0 ? q : ([q[0] + dir * lift * 0.25, q[1] - lift * (i === 1 ? 0.8 : 1)] as P))) : pts;

const E_CANTLE_F = "M 29 52 Q 27 42 33 38 Q 50 35 67 38 Q 73 42 71 52 Z";
const E_POMMEL = "M 26 50 Q 38 52 43 46 Q 50 41 57 46 Q 62 52 74 50 Q 77 56 72 60 Q 50 64 28 60 Q 23 56 26 50 Z";
const E_HORN = "M 46.4 42.5 a 3.6 3.2 0 1 0 7.2 0 a 3.6 3.2 0 1 0 -7.2 0 Z";
const E_COLLAR = "M 37.5 79.5 Q 50 87 62.5 79.5 L 63 84 Q 50 91.5 37 84 Z";
const E_CANTLE_B = "M 28 58 Q 26 51 32 47.5 Q 50 44 68 47.5 Q 74 51 72 58 Q 50 61 28 58 Z";

function FrontViewBack({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  return (
    <g transform={`translate(0 ${s.b})`}>
      {/* the back rim of the seat, behind the pawn */}
      <Region p={p} name="cantle" d={[E_CANTLE_F]} line={2.4} />
    </g>
  );
}

function FrontViewFront({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  const L = legsF(s);
  const b = s.b;
  const hy = b + s.rot * 0.35;
  const t = tones(p.hex);
  const lift = s.lift ?? 0;
  return (
    <g>
      {/* hind legs: shins, then the big folded thighs peeking out at the sides */}

      {/* middle legs */}
      <Limb pts={L.mid} fill={C.legFar} w={2.6} />
      <Limb pts={mx(L.mid)} fill={C.legFar} w={2.6} />
      <g transform={`translate(0 ${b})`}>
        {/* body end-on */}
        <ellipse cx="50" cy="70" rx="27" ry="17" fill={C.body} />
        <path d="M 25 75 Q 50 84 75 75 Q 70 86 50 87 Q 30 86 25 75 Z" fill={C.belly} />
        <ellipse cx="50" cy="70" rx="27" ry="17" fill="none" {...LINE} />
        {/* blanket, flaps and the front of the saddle */}
        <Region p={p} name="blanket" d={[E_BLANKET]} fill={t.blanket} over={<path d="M 17 60.5 Q 50 54.5 83 60.5" fill="none" stroke={t.trim} {...lw(2.6)} />} />
        <Region p={p} name="flap" d={E_FLAPS} line={2} />
        <Region p={p} name="saddle" d={[E_POMMEL]} />
        <path d="M 29 56 Q 50 60 71 56" fill="none" stroke={t.trim} stroke-dasharray="2 2" {...lw(1)} />
        <path d="M 29 52 Q 34 53 39 50" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.8)} />
        <Region p={p} name="horn" d={[E_HORN]} line={2} />
      </g>
      {/* front legs, planted */}
      <Limb pts={L.front} fill={C.leg} w={2.6} />
      <Limb pts={liftLeg(mx(L.front), lift, 1)} fill={C.leg} w={2.6} />
      {/* collar on the chest */}
      <g transform={`translate(0 ${b})`}>
        <Region p={p} name="collar" d={[E_COLLAR]} line={1.8} />
      </g>
      {/* head */}
      <g transform={`translate(0 ${hy})`}>
        <ellipse cx="50" cy="68" rx="17" ry="14" fill={C.body} {...LINE} />
        <path d="M 37.5 61 Q 41 55.8 47 55.2" fill="none" stroke={C.bodyHi} stroke-linecap="round" {...lw(2.2)} />
        <path d="M 45.5 77.4 Q 50 76 54.5 77.4 Q 54 82.2 50 82.8 Q 46 82.2 45.5 77.4 Z" fill={C.mouth} {...LINE} {...lw(1.6)} />
        <ellipse cx="37.5" cy="73.5" rx="3.2" ry="1.9" fill={C.blush} opacity="0.6" />
        <ellipse cx="62.5" cy="73.5" rx="3.2" ry="1.9" fill={C.blush} opacity="0.6" />
        {s.blink ? (
          <path d="M 35.5 65 Q 40 69 44.5 65 M 55.5 65 Q 60 69 64.5 65" fill="none" stroke={C.ink} stroke-linecap="round" {...lw(2.4)} />
        ) : (
          <g>
            <ellipse cx="40" cy="65" rx="5.4" ry="6.8" fill={C.eye} stroke={C.ink} {...lw(1.6)} />
            <ellipse cx="60" cy="65" rx="5.4" ry="6.8" fill={C.eye} stroke={C.ink} {...lw(1.6)} />
            <circle cx="41.8" cy="62" r="2.2" fill="#fff" />
            <circle cx="61.8" cy="62" r="2.2" fill="#fff" />
            <circle cx="38.4" cy="68.3" r="1" fill="#fff" />
            <circle cx="58.4" cy="68.3" r="1" fill="#fff" />
          </g>
        )}
        <path d="M 47 73.6 Q 50 76 53 73.6" fill="none" stroke={C.ink} stroke-linecap="round" {...lw(1.4)} />
      </g>
      {/* the bell under his chin */}
      <g transform={`translate(-29.6 ${8.4 + b})`}>
        <path d="M 76.4 79.6 Q 76.4 75.6 79.6 75.6 Q 82.8 75.6 82.8 79.6 L 83.6 82.6 L 75.6 82.6 Z" fill={C.gold} {...LINE} {...lw(1.6)} />
        <circle cx="79.6" cy="83.4" r="1.2" fill={C.ink} />
      </g>
      {/* antennae: the far one on our left, the near one on our right */}
      <Antenna d={frontAntenna(37, 60 + hy, 6 + s.a2 * 0.6, 32, -1)} fill={C.ant} />
      <Antenna d={frontAntenna(63, 60 + hy, 6 + s.a1 * 0.6, 32, 1)} fill={C.ant} />
    </g>
  );
}

function BackViewBack({ anim, f }: RiderProps) {
  const s = st(anim, f);
  const b = s.b;
  return (
    <g>
      {/* antennae rising behind the pawn: the near one on our left */}
      <Antenna d={endAntenna(45, 47 + b, 22 + s.a1 * 0.6, 38, -1, 0.42)} fill={C.ant} />
      <Antenna d={endAntenna(55, 47 + b, 22 + s.a2 * 0.6, 38, 1, 0.42)} fill={C.ant} />
    </g>
  );
}

function BackViewFront({ p, anim, f }: RiderProps) {
  const s = st(anim, f);
  const L = legsB(s);
  const b = s.b;
  const rb = b - s.rot * 0.35;
  const sb = b - s.rot * 0.15;
  const t = tones(p.hex);
  const lift = s.lift ?? 0;
  return (
    <g>
      {/* the far front legs and the middle legs under him */}
      <Limb pts={liftLeg(L.front, lift, -1)} fill={C.legFar} w={2.4} />
      <Limb pts={mx(L.front)} fill={C.legFar} w={2.4} />
      <Limb pts={L.mid} fill={C.legFar} w={2.6} />
      <Limb pts={mx(L.mid)} fill={C.legFar} w={2.6} />
      {/* hind shins, behind the thighs */}
      <Limb pts={L.hind} fill={C.leg} w={2.4} />
      <Limb pts={mx(L.hind)} fill={C.leg} w={2.4} />
      <g transform={`translate(0 ${rb})`}>
        {/* the rump end-on */}
        <ellipse cx="50" cy="70" rx="26" ry="18" fill={C.body} />
        <path d="M 24.5 75 Q 50 84 75.5 75 Q 71 87 50 88 Q 29 87 24.5 75 Z" fill={C.belly} />
        <path d="M 31 82 Q 50 88.5 69 82 M 37 85.5 Q 50 89 63 85.5" fill="none" stroke={darken(C.body, 0.35)} stroke-linecap="round" {...lw(1.4)} />
        <ellipse cx="50" cy="70" rx="26" ry="18" fill="none" {...LINE} />
        {/* the folded wings meeting down his back */}
        <path d="M 50 56 Q 35 56 29 62 Q 36 75 50 81 Z" fill={C.wing} {...LINE} {...lw(2)} />
        <path d="M 50 56 Q 65 56 71 62 Q 64 75 50 81 Z" fill={C.wing} {...LINE} {...lw(2)} />
        <path d="M 33 63 Q 39 71 47 76" fill="none" stroke={darken(C.wing, 0.3)} stroke-linecap="round" {...lw(1.1)} />
        <path d="M 67 63 Q 61 71 53 76" fill="none" stroke={darken(C.wing, 0.3)} stroke-linecap="round" {...lw(1.1)} />
      </g>
      <g transform={`translate(0 ${sb})`}>
        {/* blanket, flaps and the back of the saddle */}
        <Region p={p} name="blanket" d={[E_BLANKET]} fill={t.blanket} over={<path d="M 17 60.5 Q 50 54.5 83 60.5" fill="none" stroke={t.trim} {...lw(2.6)} />} />
        <Region p={p} name="flap" d={E_FLAPS} line={2} />
        <Region p={p} name="saddle" d={[E_CANTLE_B]} />
        <path d="M 32 54.5 Q 50 57.5 68 54.5" fill="none" stroke={t.trim} stroke-dasharray="2 2" {...lw(1)} />
        <path d="M 30 55 Q 29.5 51.5 33 49.5" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.8)} />
      </g>
      {/* the big striped jumping thighs, folded up at his sides */}
      <Femur H={[L.hindH[0], L.hindH[1] - b + rb]} K={L.hindK} r1={7} r2={3} fill={C.leg} mark={darken("#c4d65c", 0.3)} />
      <Femur H={mp([L.hindH[0], L.hindH[1] - b + rb])} K={mp(L.hindK)} r1={7} r2={3} fill={C.leg} mark={darken("#c4d65c", 0.3)} />
    </g>
  );
}

const endPose = (anim: "idle" | "move", f: number) => {
  if (anim === "move") {
    const m = MOVE[f % MOVE.length]!;
    return { dx: 0, dy: m.dy, pawnX: 0, pawnY: -16 + m.b + m.extra, pawnTilt: 0, cut: 69 - m.extra };
  }
  const s = IDLE[f % IDLE.length]!;
  return { dx: 0, dy: 0, pawnX: 0, pawnY: -16 + s.b, pawnTilt: 0, cut: 69 };
};

const FRONT_VIEW: RiderViewDraft = {
  frame: [2, 0, 96, 100],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: endPose,
  Back: FrontViewBack,
  Front: FrontViewFront,
};
const BACK_VIEW: RiderViewDraft = {
  frame: [0, 0, 100, 100],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: endPose,
  Back: BackViewBack,
  Front: BackViewFront,
};

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
      const m = MOVE[f % MOVE.length]!;
      return { dx: m.dx, dy: m.dy, pawnX: 0, pawnY: -16 + m.b + m.extra, pawnTilt: m.tilt, cut: 69 - m.extra };
    }
    const s = IDLE[f % IDLE.length]!;
    return { dx: 0, dy: 0, pawnX: 0, pawnY: -16 + s.b, pawnTilt: 0, cut: 69 };
  },
  Back,
  Front,
  views: { front: FRONT_VIEW, back: BACK_VIEW },
  trail: {
    ms: [160, 150, 150, 140],
    w: 24,
    h: 22,
    Mark: ChirpPrints,
  },
};

/* ---------- the trail: Chirp's little three-toed footprints, a pair on each square ---------- */
const SOIL = "#3b3a1a";
const SOIL_RIM = "#8c8a52";
/** One print pointing along +x: a round heel pad and three toes fanning forward. */
function printD(x: number, y: number) {
  const toes = [
    [5.2, -2.6],
    [6.2, 0],
    [5.2, 2.6],
  ]
    .map(([tx, ty]) => `M ${n1(x + 1.2)} ${n1(y)} L ${n1(x + tx!)} ${n1(y + ty!)}`)
    .join(" ");
  return { heel: [x - 0.6, y] as P, toes };
}
function ChirpPrints({ f, view, n }: TrailProps) {
  const op = [0.95, 0.68, 0.4, 0.16][Math.min(f, 3)]!;
  const k = [1.2, 1.16, 1.12, 1.06][Math.min(f, 3)]!;
  const side = n % 2 === 0 ? -1 : 1;
  const prints = [printD(-3.2 + (side < 0 ? 1.6 : 0), -3.4 + side * 1.6), printD(-3.2 + (side > 0 ? 1.6 : 0), 3.4 + side * 1.6)];
  const rot = view === "back" ? -90 : view === "front" ? 90 : 0;
  const body = (stroke: string, w: number, fill: string) =>
    prints.map((q, i) => (
      <g key={i}>
        <path d={q.toes} fill="none" stroke={stroke} stroke-linecap="round" {...lw(w)} />
        <ellipse cx={q.heel[0]} cy={q.heel[1]} rx={2.2 + (w - 2) * 0.5} ry={1.8 + (w - 2) * 0.5} fill={fill} />
      </g>
    ));
  return (
    <g opacity={op} transform={`scale(${k} ${(k * 0.9).toFixed(3)}) rotate(${rot})`}>
      {body(SOIL_RIM, 3.4, SOIL_RIM)}
      {body(SOIL, 2, SOIL)}
    </g>
  );
}
