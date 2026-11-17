import { Region, LINE, lw, darken, lighten, type RiderDraft, type RiderProps, type Paint } from "../../item-kit.tsx";

// The star: lying level in its own plane (X right, Z away from us), seen from the town's camera (Z squashed by K).
const R = 53; // outer radius
const RI = 0.45 * R; // inner radius (a chunky star)
const ROT = -12; // turned a little so the back point faces back and every point shows round the pawn
const K = 0.55; // the camera's squash
const T = 11; // thickness of the puffy side
const CX = 50;
const CY = 58; // middle of the top face, at rest
const BASE = CY + 4; // where the pawn's base sits
const GROUND = 100; // the shadow's line

type V2 = [number, number];
const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V2, s: number): V2 => [a[0] * s, a[1] * s];
const unit = (a: V2): V2 => {
  const l = Math.hypot(a[0], a[1]);
  return [a[0] / l, a[1] / l];
};

const L = Math.hypot(R - RI * Math.cos(Math.PI / 5), RI * Math.sin(Math.PI / 5));
const D_OUT = 0.28 * L;
const D_IN = 0.2 * L;

/** The rounded star in its plane: per corner, the fillet's start, two controls and end. */
const SEGS = (() => {
  const vs: V2[] = [];
  for (let j = 0; j < 10; j++) {
    const a = (j * Math.PI) / 5 + (ROT * Math.PI) / 180;
    const r = j % 2 ? RI : R;
    vs.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return vs.map((v, j) => {
    const e1 = unit(sub(vs[(j + 9) % 10], v));
    const e2 = unit(sub(vs[(j + 1) % 10], v));
    const g = Math.acos(e1[0] * e2[0] + e1[1] * e2[1]);
    const d = j % 2 ? D_IN : D_OUT;
    const r = d * Math.tan(g / 2);
    const h = (4 / 3) * Math.tan((Math.PI - g) / 4) * r;
    const A = add(v, mul(e1, d));
    const B = add(v, mul(e2, d));
    return [A, sub(A, mul(e1, h)), sub(B, mul(e2, h)), B] as V2[];
  });
})();

const n1 = (x: number) => x.toFixed(1);
const proj = (q: V2, sc: number, s: number): string => `${n1(CX + q[0] * sc)} ${n1(CY + s - q[1] * K * sc)}`;
const cache = new Map<string, string>();
/** The star's outline at scale sc, dropped s below the top face. */
function starD(sc: number, s: number): string {
  const key = `${sc.toFixed(3)}:${s}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let d = "";
  SEGS.forEach(([A, c1, c2, B], i) => {
    d += `${i ? " L" : "M"} ${proj(A, sc, s)} C ${proj(c1, sc, s)} ${proj(c2, sc, s)} ${proj(B, sc, s)}`;
  });
  d += " Z";
  cache.set(key, d);
  return d;
}
/** The pillow's profile: narrow at the top, widest a third of the way down, tucked in underneath. */
const profile = (u: number) => (u <= 0.35 ? 1 - 0.05 * ((0.35 - u) / 0.35) ** 2 : 1 - 0.1 * ((u - 0.35) / 0.65) ** 2);
const STEPS = Array.from({ length: T * 2 + 1 }, (_, i) => i / 2); // 0, 0.5, ... T
const TOP = starD(profile(0), 0);

/** A shade of the item's color: negative lightens, positive darkens. */
const tone = (hex: string, t: number) => (t < 0 ? lighten(hex, -t) : darken(hex, t));

/** A point in the star's plane at angle (degrees) and radius, on screen. */
const at = (deg: number, r: number, s = 0): V2 => {
  const a = ((deg + ROT) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + s - r * Math.sin(a) * K];
};

const IDLE_N = 12;
const MOVE_N = 8;
const bob = (anim: "idle" | "move", f: number) => {
  const n = anim === "idle" ? IDLE_N : MOVE_N;
  return (anim === "idle" ? 1.25 : 1) * (1 - Math.cos((2 * Math.PI * f) / n));
};
const TILT = 3;

function Star({ p }: { p: Paint }) {
  const hex = p.hex;
  const copies = STEPS.map((s) => starD(profile(s / T), s));
  const hl = `${p.id}-star-hl`;
  const far = `${p.id}-star-far`;
  return (
    <g>
      <defs>
        <radialGradient id={hl}>
          <stop offset="0" stop-color="#fff" stop-opacity="0.65" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.28" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <linearGradient id={far} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity="0.35" />
          <stop offset="1" stop-color="#000" stop-opacity="0" />
        </linearGradient>
      </defs>
      {/* the outline round the whole puffy shape */}
      {copies.map((d) => (
        <path key={`o${d}`} d={d} fill="none" {...LINE} {...lw(6)} />
      ))}
      <Region
        p={p}
        name="star-side"
        d={copies}
        outline={false}
        over={
          <>
            {copies
              .map((d, i) => ({ d, u: STEPS[i] / T }))
              .reverse()
              .map(({ d, u }) => (
                <path key={`s${d}`} d={d} fill={tone(hex, -0.1 + 0.55 * u ** 1.3)} />
              ))}
            <rect x="0" y={CY - 30} width="110" height="32" fill={`url(#${far})`} />
          </>
        }
      />
      <Region
        p={p}
        name="star-top"
        d={[TOP]}
        outline={false}
        over={
          <>
            <rect x="0" y="0" width="110" height="110" fill="#fff" opacity="0.14" />
            <path d={TOP} fill="none" stroke={darken(hex, 0.5)} opacity="0.3" {...lw(7)} />
            <ellipse cx={CX + 2} cy={CY + 4} rx={36} ry={14} fill={`url(#${hl})`} />
          </>
        }
      />
      <path d={TOP} fill="none" stroke={darken(hex, 0.6)} stroke-linejoin="round" opacity="0.75" {...lw(1.6)} />
      {/* a glint on the near-back point and one by the near point */}
      <ellipse cx={at(212, 30)[0]} cy={at(212, 30)[1]} rx={5} ry={1.8} transform={`rotate(-14 ${at(212, 30)[0]} ${at(212, 30)[1]})`} fill="#fff" opacity="0.9" />
      <ellipse cx={at(290, 34)[0]} cy={at(290, 34)[1]} rx={2.4} ry={1.2} fill="#fff" opacity="0.85" />
    </g>
  );
}

function Back({ p, f, anim }: RiderProps) {
  const b = bob(anim, f);
  const tilt = anim === "move" ? TILT : 0;
  const rx = 33 - b * 1.6;
  return (
    <g>
      {/* the soft shadow on the ground (it stays put) */}
      <ellipse cx={CX} cy={GROUND} rx={rx + 5} ry={5.5} fill="#1d1d1f" opacity={0.12} />
      <ellipse cx={CX} cy={GROUND} rx={rx} ry={4.2} fill="#1d1d1f" opacity={0.15} />
      <ellipse cx={CX} cy={GROUND} rx={rx - 9} ry={3} fill="#1d1d1f" opacity={0.16 - b * 0.02} />
      <g transform={`translate(0 ${n1(-b)}) rotate(${tilt} ${CX} ${CY})`}>
        <Star p={p} />
      </g>
    </g>
  );
}

/** A tiny five-pointed spark. */
function sparkD(x: number, y: number, r: number): string {
  let d = "";
  for (let j = 0; j < 10; j++) {
    const a = -Math.PI / 2 + (j * Math.PI) / 5;
    const rr = j % 2 ? r * 0.5 : r;
    d += `${j ? "L" : "M"} ${n1(x + rr * Math.cos(a))} ${n1(y + rr * Math.sin(a))} `;
  }
  return d + "Z";
}

// The sparkler fizz: each spark is born at a frame, pops out of the back point and fades in three frames.
const SPARKS = [
  { born: 0, dx: -1, dy: -0.35, c: "#fff3b8", r: 3.4 },
  { born: 1, dx: -0.8, dy: 0.5, c: "#ffffff", r: 2.6 },
  { born: 2, dx: -1, dy: 0.1, c: "#ffe28a", r: 3.0 },
  { born: 3, dx: -0.6, dy: -0.8, c: "#ffffff", r: 2.4 },
  { born: 4, dx: -1, dy: 0.35, c: "#fff3b8", r: 3.4 },
  { born: 5, dx: -0.9, dy: -0.3, c: "#ffffff", r: 2.6 },
  { born: 6, dx: -0.95, dy: -0.05, c: "#ffe28a", r: 3.0 },
  { born: 7, dx: -0.7, dy: 0.75, c: "#ffffff", r: 2.4 },
];

function Front({ f, anim }: RiderProps) {
  if (anim !== "move") return null;
  const b = bob(anim, f);
  const [ox, oy] = at(216, R * 0.84, T * 0.35);
  return (
    <g transform={`translate(0 ${n1(-b)}) rotate(${TILT} ${CX} ${CY})`}>
      {SPARKS.map((s, i) => {
        const age = (f - s.born + MOVE_N) % MOVE_N;
        if (age > 2) return null;
        const dist = 5 + age * 6.5;
        const x = ox + s.dx * dist;
        const y = oy + s.dy * dist;
        const r = s.r * 2.1 * (1.1 - age * 0.28);
        return (
          <g key={i} opacity={[1, 0.9, 0.55][age]}>
            <path d={sparkD(x, y, r)} fill={s.c} stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.1)} />
          </g>
        );
      })}
      {/* the fizz's hot spot at the point */}
      <circle cx={ox - 1} cy={oy} r={f % 2 ? 3.6 : 4.4} fill="#ffe9a0" opacity="0.55" />
      <circle cx={ox - 1} cy={oy} r={f % 2 ? 2 : 2.6} fill="#fffbe6" />
    </g>
  );
}

export const starRide: RiderDraft = {
  id: "star-ride",
  name: "Moon's Ride",
  tier: "mythic",
  description: "A whole star to sit on. Wishes not included; parking is a nightmare.",
  frame: [1, -7, 103, 110],
  idle: { ms: Array(IDLE_N).fill(140) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: (anim, f) => ({
    dx: anim === "move" ? (100 * f) / MOVE_N : 0,
    dy: 0,
    pawnX: 0,
    pawnY: BASE - 88 - bob(anim, f),
    pawnTilt: anim === "move" ? TILT : 0,
    cut: 92,
  }),
  Back,
  Front,
};
