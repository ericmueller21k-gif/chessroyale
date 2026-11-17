import { Region, LINE, lw, darken, lighten, isLight, type RiderDraft, type RiderProps, type Paint } from "../../item-kit.tsx";

// The star lies level in its own plane (X right/forward, Z away from us) and is seen from the town's camera, looking
// down on it fairly steeply: Z is squashed by K. Its puffy side drops T below the top face.
const VIS = 50; // how far the rounded tips reach from the middle
const RIK = 0.4; // inner radius / outer (deep notches, long points)
const RTK = 0.12; // tip rounding (fraction of R)
const RNK = 0.05; // notch rounding
const ALPHA = Math.atan2(RIK * Math.sin(Math.PI / 5), 1 - RIK * Math.cos(Math.PI / 5));
const R = VIS / (1 - RTK * (1 / Math.sin(ALPHA) - 1));
const RI = RIK * R;
const ROT = -70; // a point faces down-front (toward the camera), the back point peeks beside the pawn's neck
const K = 0.7; // the camera's squash
const T = 14; // the puffy side's depth
const CX = 47;
const CY = 44; // middle of the top face, at rest
const BASE = 62; // where the pawn's base rests on the top face
const GROUND = 99.5; // the shadow's line

type V2 = [number, number];
const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V2, s: number): V2 => [a[0] * s, a[1] * s];
const unit = (a: V2): V2 => {
  const l = Math.hypot(a[0], a[1]);
  return [a[0] / l, a[1] / l];
};

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
    const rad = (j % 2 ? RNK : RTK) * R;
    const d = rad / Math.tan(g / 2);
    const h = (4 / 3) * Math.tan((Math.PI - g) / 4) * rad;
    const A = add(v, mul(e1, d));
    const B = add(v, mul(e2, d));
    return [A, sub(A, mul(e1, h)), sub(B, mul(e2, h)), B] as V2[];
  });
})();

const n1 = (x: number) => x.toFixed(1);
const cache = new Map<string, string>();
/** The star's outline scaled sc about (ox, oy) in its plane (offsets from the middle), dropped s below the top face. */
function starD(sc: number, s: number, ox = 0, oy = 0): string {
  const key = `${sc.toFixed(3)}:${s}:${ox}:${oy}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pr = (q: V2) => `${n1(CX + ox + (q[0] - ox) * sc)} ${n1(CY + s - (oy + (q[1] - oy) * sc) * K)}`;
  let d = "";
  SEGS.forEach(([A, c1, c2, B], i) => {
    d += `${i ? " L" : "M"} ${pr(A)} C ${pr(c1)} ${pr(c2)} ${pr(B)}`;
  });
  d += " Z";
  cache.set(key, d);
  return d;
}
/** The pillow's profile down its side: a rounded shoulder at the top, bulging, tucked in underneath. */
const profile = (u: number) =>
  u <= 0.35 ? 1 - 0.045 * ((0.35 - u) / 0.35) ** 2 : 1 - 0.09 * ((u - 0.35) / 0.65) ** 2;
const STEPS = Array.from({ length: T * 2 }, (_, i) => (i + 1) / 2); // 0.5 ... T
const TOP = starD(profile(0), 0);
const SIDES = STEPS.map((s) => starD(profile(s / T), s));

/** A shade of the item's color: negative lightens, positive darkens. */
const tone = (hex: string, t: number) => (t < 0 ? lighten(hex, -t) : darken(hex, t));

/** A point in the star's plane at angle (degrees, from its own turn) and radius, on screen. */
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

// The top face's dome: concentric copies shrinking toward a spot a little back and left of the middle, lighter inward.
const DOME = Array.from({ length: 14 }, (_, i) => {
  const k = 1 - (i + 1) * 0.055;
  return { d: starD(profile(0) * k, 0, -6, 6), t: -0.05 - (i + 1) * 0.022 };
});

function Star({ p }: { p: Paint }) {
  const hex = p.hex;
  const light = isLight(hex);
  const nn = parseInt(hex.slice(1), 16);
  const dark = (0.299 * ((nn >> 16) & 255) + 0.587 * ((nn >> 8) & 255) + 0.114 * (nn & 255)) / 255 < 0.25;
  const hl = `${p.id}-star-hl`;
  const shade = `${p.id}-star-sh`;
  const [gx, gy] = at(212, 27);
  return (
    <g>
      <defs>
        <radialGradient id={hl}>
          <stop offset="0" stop-color="#fff" stop-opacity="0.6" />
          <stop offset="0.55" stop-color="#fff" stop-opacity="0.22" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <linearGradient id={shade} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.22" />
        </linearGradient>
      </defs>
      {/* the bold outline round the whole puffy shape */}
      {SIDES.map((d) => (
        <path key={`o${d}`} d={d} fill="none" {...LINE} {...lw(6)} />
      ))}
      <path d={TOP} fill="none" {...LINE} {...lw(6)} />
      <Region
        p={p}
        name="star-side"
        d={SIDES}
        outline={false}
        over={
          <>
            {SIDES.map((d, i) => ({ d, u: STEPS[i] / T }))
              .reverse()
              .map(({ d, u }) => (
                <path key={`s${d}`} d={d} fill={tone(hex, (light ? 0.1 : 0.06) + (light ? 0.42 : 0.5) * u ** 1.25)} />
              ))}
            <rect x={CX - 60} y={CY - 45} width="120" height="100" fill={`url(#${shade})`} />
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
            <path d={TOP} fill={tone(hex, dark ? -0.16 : -0.02)} />
            {DOME.map(({ d, t }) => (
              <path key={`d${d}`} d={d} fill={tone(hex, dark ? t * 1.25 - 0.12 : t)} />
            ))}
            <ellipse cx={CX - 6} cy={CY - 3} rx={30} ry={16} fill={`url(#${hl})`} />
          </>
        }
      />
      <path d={TOP} fill="none" stroke={darken(hex, 0.55)} stroke-linejoin="round" opacity="0.45" {...lw(1.4)} />
      {/* glints: one on the back-left point's shoulder, a dot by it */}
      <ellipse cx={gx} cy={gy} rx={6} ry={2.2} transform={`rotate(-18 ${n1(gx)} ${n1(gy)})`} fill="#fff" opacity="0.85" />
      <circle cx={gx + 8} cy={gy - 3.5} r={1.4} fill="#fff" opacity="0.8" />
    </g>
  );
}

function Back({ p, f, anim }: RiderProps) {
  const b = bob(anim, f);
  const tilt = anim === "move" ? TILT : 0;
  const rx = 34 - b * 1.6;
  const sh = `${p.id}-star-shadow`;
  return (
    <g>
      <defs>
        <radialGradient id={sh}>
          <stop offset="0" stop-color="#1d1d1f" stop-opacity="0.5" />
          <stop offset="0.6" stop-color="#1d1d1f" stop-opacity="0.32" />
          <stop offset="1" stop-color="#1d1d1f" stop-opacity="0" />
        </radialGradient>
      </defs>
      {/* the soft shadow on the ground (it stays put, shrinking as the star rises) */}
      <ellipse cx={CX + 3} cy={GROUND} rx={rx} ry={4.5 - b * 0.25} fill={`url(#${sh})`} />
      <g transform={`translate(0 ${n1(-b)}) rotate(${tilt} 50 ${BASE})`}>
        <Star p={p} />
        {/* where the pawn sits, a soft dip */}
        <ellipse cx={50} cy={BASE - 1} rx={27} ry={4} fill={darken(p.hex, 0.6)} opacity="0.22" />
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
  { born: 0, dx: -1, dy: -0.45, c: "#fff3b8", r: 3.4 },
  { born: 1, dx: -0.8, dy: 0.45, c: "#ffffff", r: 2.6 },
  { born: 2, dx: -1, dy: 0.05, c: "#ffe28a", r: 3.0 },
  { born: 3, dx: -0.55, dy: -0.85, c: "#ffffff", r: 2.4 },
  { born: 4, dx: -1, dy: 0.35, c: "#fff3b8", r: 3.4 },
  { born: 5, dx: -0.9, dy: -0.35, c: "#ffffff", r: 2.6 },
  { born: 6, dx: -0.95, dy: -0.05, c: "#ffe28a", r: 3.0 },
  { born: 7, dx: -0.65, dy: 0.75, c: "#ffffff", r: 2.4 },
];

function Front({ f, anim }: RiderProps) {
  if (anim !== "move") return null;
  const b = bob(anim, f);
  const [ox, oy] = at(216, VIS - 3, T * 0.35);
  return (
    <g transform={`translate(0 ${n1(-b)}) rotate(${TILT} 50 ${BASE})`}>
      {SPARKS.map((s, i) => {
        const age = (f - s.born + MOVE_N) % MOVE_N;
        if (age > 2) return null;
        const dist = 4 + age * 5.5;
        const x = ox + s.dx * dist;
        const y = oy + s.dy * dist;
        const r = s.r * 2.4 * (1.1 - age * 0.28);
        return (
          <g key={i} opacity={[1, 0.9, 0.55][age]}>
            <path d={sparkD(x, y, r)} fill={s.c} stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.1)} />
          </g>
        );
      })}
      {/* the fizz's hot spot at the point */}
      <circle cx={ox} cy={oy} r={f % 2 ? 3.6 : 4.4} fill="#ffe9a0" opacity="0.55" />
      <circle cx={ox} cy={oy} r={f % 2 ? 2 : 2.6} fill="#fffbe6" />
    </g>
  );
}

export const starRide: RiderDraft = {
  id: "star-ride",
  name: "Moon's Ride",
  tier: "mythic",
  description: "A whole star to sit on. Wishes not included; parking is a nightmare.",
  frame: [-2, -9, 104, 114],
  idle: { ms: Array(IDLE_N).fill(170) },
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
