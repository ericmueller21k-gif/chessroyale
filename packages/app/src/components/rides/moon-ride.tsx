// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/star-ride/star-ride.tsx, Nov 17: Moon's Ride redrawn as a puffy
// rounded star, Eric Nov 16; its side view, front and back views and trail mark; Nov 17 third pass: the pawn sunk into a hollowed-out seat; fourth: no straight edge round it): only the import lines changed, its id kept as
// "moon-ride" (so owners keep it), its name and line kept until Eric picks new ones, and the `!`s the app's stricter typecheck asks for.
// Fifth pass (Nov 17, one layer, here only: how it's composed, not its art): the star, its seat and the fizz are drawn once, behind the
// pawn; the front draws nothing; the pawn is hidden below the seat's lip by the pose's `hide` (docs/decisions/2026-11-17-star-seat-one-layer.md).
// The art's kit there (scripts/boss-art/item-kit.tsx) is a copy of ../item-paint.tsx and ./kit.ts. Notes: docs/areas/shop.md, "Rides".
import type { RiderDraft, RiderProps, RiderViewDraft } from "./kit.ts";
import { Region, LINE, lw, darken, lighten, isLight, type Paint } from "../item-paint.tsx";

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
const GROUND = 99.5; // the shadow's line

// The seat: a round dip scooped out of the middle of the top face (radius in the star's plane), the pawn sunk into it.
const SEAT_R = 24.5;
const CUT = 70; // the pawn's own line below which it's hidden (its lowest third, under the dip's near lip)
const PY = -8.5; // the pawn lowered into the dip: its cut line falls just under the near lip
const PIVOT = 88 + PY; // the pawn's base on screen (the move's tilt turns star and pawn round it)

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
    const e1 = unit(sub(vs[(j + 9) % 10]!, v));
    const e2 = unit(sub(vs[(j + 1) % 10]!, v));
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
    d += `${i ? " L" : "M"} ${pr(A!)} C ${pr(c1!)} ${pr(c2!)} ${pr(B!)}`;
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
const isDark = (hex: string) => {
  const nn = parseInt(hex.slice(1), 16);
  return (0.299 * ((nn >> 16) & 255) + 0.587 * ((nn >> 8) & 255) + 0.114 * (nn & 255)) / 255 < 0.25;
};

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

// ---------------------------------------------------------------------------------------------------------------
// The seat, shared by every view: an ellipse (cx, cy, rx, ry) on the top face.
const ellD = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${n1(cx - rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 1 0 ${n1(cx + rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 1 0 ${n1(cx - rx)} ${n1(cy)} Z`;
/** The near half of the rim, left to right under the middle. */
const nearArc = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${n1(cx - rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 0 0 ${n1(cx + rx)} ${n1(cy)}`;
/** The far half of the rim, left to right over the middle. */
const farArc = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${n1(cx - rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 0 1 ${n1(cx + rx)} ${n1(cy)}`;
/**
 * Where the rider is hidden (the pose's `hide`; Nov 17, one layer: nothing of the star is drawn over the pawn). Inside the dip, below
 * the near lip's arc, so the pawn sinks behind the lip's line (SeatLip, drawn behind it). The pawn's base and most skins (a suit, a
 * coat, the chimney) are wider than the dip at the ride's size, so beside it the edge is a soft shoulder: it leaves the arc smoothly
 * (same tangent) partway up each side and sweeps outward and gently down (as the fourth pass's front copy's edge did), and below it
 * all is hidden. `tf` places a point of the seat as this frame draws it (its bob, and in the side view's move its tilt); `rot` that tilt.
 */
const LIP_IN = 0.5; // the edge sits this far inside the lip line's middle: a little more than half the line shows under the pawn
const LIP_T0 = (30 * Math.PI) / 180; // where the shoulder leaves the near arc (0 = the dip's side, 90 = its bottom)
const SH_OUT = 64; // the shoulder's far end, out from the dip's middle...
const SH_DROP = 21; // ...and this far below the rim's middle line
const pt = (q: V2) => `${n1(q[0])} ${n1(q[1])}`;
const hideD = (cx: number, cy: number, rx: number, ry: number, tf: (q: V2) => V2, rot: number) => {
  const r = rx - LIP_IN;
  const q = ry - LIP_IN;
  /** One side's shoulder (s = -1 left, 1 right), from its far end in to the arc: far end, two controls, on the arc. */
  const shoulder = (s: number): V2[] => {
    const p0: V2 = [cx + s * r * Math.cos(LIP_T0), cy + q * Math.sin(LIP_T0)];
    const tan = unit([s * r * Math.sin(LIP_T0), -q * Math.cos(LIP_T0)]); // along the arc, outward and up
    const e: V2 = [cx + s * SH_OUT, cy + SH_DROP];
    return [e, add(e, [-s * 21, -7.5]), add(p0, mul(tan, 6.5)), p0].map(tf);
  };
  const [eL, aL, bL, pL] = shoulder(-1);
  const [eR, aR, bR, pR] = shoulder(1);
  return (
    `M ${pt(tf([cx - 130, 200]))} L ${pt(tf([cx - 130, cy + 48]))} L ${pt(eL!)} C ${pt(aL!)} ${pt(bL!)} ${pt(pL!)}` +
    ` A ${n1(r)} ${n1(q)} ${rot} 0 0 ${pt(pR!)} C ${pt(bR!)} ${pt(aR!)} ${pt(eR!)} L ${pt(tf([cx + 130, cy + 48]))} L ${pt(tf([cx + 130, 200]))} Z`
  );
};

/** The dip's inside and far rim (behind the pawn): the far inner wall lit, the floor, the near wall in the lip's shade. */
function SeatInside({ p, cx, cy, rx, ry }: { p: Paint; cx: number; cy: number; rx: number; ry: number }) {
  const hex = p.hex;
  const dk = isDark(hex) ? -0.22 : 0;
  const lt = isLight(hex) ? 0.06 : 0;
  const E = ellD(cx, cy, rx, ry);
  const ry2 = ry * 0.82;
  return (
    <g>
      {/* a soft light rim round the far side: the lip's rounded top catching the light */}
      <path d={farArc(cx, cy, rx + 2.6, ry + 2.2)} fill="none" stroke="#fff" stroke-linecap="round" opacity="0.3" {...lw(2.6)} />
      <Region
        p={p}
        name="star-seat"
        d={[E]}
        outline={false}
        over={
          <>
            <path d={E} fill={tone(hex, 0.36 + dk + lt)} />
            {/* the pawn's own shade on the floor round it */}
            <ellipse cx={cx} cy={cy + ry * 0.15} rx={rx * 0.8} ry={ry * 0.75} fill={tone(hex, 0.55 + dk * 0.6)} opacity="0.6" />
            {/* the far inner wall, facing us, lit: the crescent under the far rim */}
            <path d={`${E} ${ellD(cx, cy + ry * 0.42, rx * 1.04, ry2)}`} fill-rule="evenodd" fill={tone(hex, 0.04 + dk * 0.9 + lt)} />
            <path d={`${E} ${ellD(cx, cy + ry * 0.22, rx * 1.02, ry * 0.92)}`} fill-rule="evenodd" fill={tone(hex, -0.06 + dk * 0.8)} opacity="0.55" />
            {/* the near wall in the lip's shade */}
            <path d={`${E} ${ellD(cx, cy - ry * 0.3, rx * 1.02, ry)}`} fill-rule="evenodd" fill={tone(hex, 0.55 + dk * 0.5)} />
          </>
        }
      />
      <path d={E} fill="none" stroke={darken(hex, 0.6)} stroke-linejoin="round" opacity="0.7" {...lw(1.8)} />
    </g>
  );
}

/** The dip's near lip, behind the pawn (the rider is hidden below its line: `hideD`): its bold edge, its rounded top catching the light just below. */
function SeatLip({ p, cx, cy, rx, ry }: { p: Paint; cx: number; cy: number; rx: number; ry: number }) {
  return (
    <g>
      <path d={nearArc(cx, cy + 2.4, rx * 0.86, ry)} fill="none" stroke="#fff" stroke-linecap="round" opacity={isDark(p.hex) ? 0.5 : 0.42} {...lw(2.2)} />
      <path d={nearArc(cx, cy, rx, ry)} fill="none" {...LINE} {...lw(2.6)} />
    </g>
  );
}

function Star({ p }: { p: Paint }) {
  const hex = p.hex;
  const light = isLight(hex);
  const dark = isDark(hex);
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
            {SIDES.map((d, i) => ({ d, u: STEPS[i]! / T }))
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

const SEAT_SIDE = { cx: CX, cy: CY, rx: SEAT_R, ry: SEAT_R * K };
const sideGroup = (anim: "idle" | "move", f: number) =>
  `translate(0 ${n1(-bob(anim, f))}) rotate(${anim === "move" ? TILT : 0} ${CX} ${PIVOT})`;

/** The side view's `hide`: the seat as this frame draws it (sideGroup: bobbed, and tilted round the pawn's base in the move). */
function hideSide(anim: "idle" | "move", f: number): string {
  const b = bob(anim, f);
  const t = anim === "move" ? TILT : 0;
  const c = Math.cos((t * Math.PI) / 180);
  const sn = Math.sin((t * Math.PI) / 180);
  const tf = (q: V2): V2 => {
    const x = q[0] - CX;
    const y = q[1] - PIVOT;
    return [CX + x * c - y * sn, PIVOT + x * sn + y * c - b];
  };
  const s = SEAT_SIDE;
  return hideD(s.cx, s.cy, s.rx, s.ry, tf, t);
}

function Back({ p, f, anim }: RiderProps) {
  const b = bob(anim, f);
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
      <g transform={sideGroup(anim, f)}>
        <Star p={p} />
        <SeatInside p={p} {...SEAT_SIDE} />
        <SeatLip p={p} {...SEAT_SIDE} />
        <SideFizz f={f} anim={anim} />
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

/** The move's fizz from the back point (behind the pawn, like the point). */
function SideFizz({ f, anim }: { f: number; anim: "idle" | "move" }) {
  if (anim !== "move") return null;
  const [ox, oy] = at(216, VIS - 3, T * 0.35);
  return (
    <g>
      {(
        <>
          {SPARKS.map((sp, i) => {
            const age = (f - sp.born + MOVE_N) % MOVE_N;
            if (age > 2) return null;
            const dist = 4 + age * 5.5;
            const x = ox + sp.dx * dist;
            const y = oy + sp.dy * dist;
            const r = sp.r * 2.4 * (1.1 - age * 0.28);
            return (
              <g key={i} opacity={[1, 0.9, 0.55][age]}>
                <path d={sparkD(x, y, r)} fill={sp.c} stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.1)} />
              </g>
            );
          })}
          {/* the fizz's hot spot at the point */}
          <circle cx={ox} cy={oy} r={f % 2 ? 3.6 : 4.4} fill="#ffe9a0" opacity="0.55" />
          <circle cx={ox} cy={oy} r={f % 2 ? 2 : 2.6} fill="#fffbe6" />
        </>
      )}
    </g>
  );
}

/**
 * In front of the pawn: nothing (Nov 17, one layer). The star, its seat's lip and the fizz are all drawn behind; the rider is hidden
 * below the lip by the pose's `hide`, so no edge of the star ever lands on the pawn or its items.
 */
const Front = (_: RiderProps) => null;

// ---------------------------------------------------------------------------------------------------------------
// Front and back views: the same star, turned so a point faces the camera (straight down the picture), centered on
// x 50. In the move it dips toward the way it goes: the plane pitches a few degrees round the pawn's seat, so the face
// squashes a little more (going away, far side down) or a little less (coming toward us, near side down).
const VROT = -90;
const K_AWAY = 0.66; // back view, moving
const K_TOWARD = 0.745; // front view, moving

const segsFor = (rot: number) => {
  const vs: V2[] = [];
  for (let j = 0; j < 10; j++) {
    const a = (j * Math.PI) / 5 + (rot * Math.PI) / 180;
    const r = j % 2 ? RI : R;
    vs.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return vs.map((v, j) => {
    const e1 = unit(sub(vs[(j + 9) % 10]!, v));
    const e2 = unit(sub(vs[(j + 1) % 10]!, v));
    const g = Math.acos(e1[0] * e2[0] + e1[1] * e2[1]);
    const rad = (j % 2 ? RNK : RTK) * R;
    const d = rad / Math.tan(g / 2);
    const h = (4 / 3) * Math.tan((Math.PI - g) / 4) * rad;
    const A = add(v, mul(e1, d));
    const B = add(v, mul(e2, d));
    return [A, sub(A, mul(e1, h)), sub(B, mul(e2, h)), B] as V2[];
  });
};
const VSEGS = segsFor(VROT);

function starDV(sc: number, s: number, ox: number, oy: number, k: number, cy: number): string {
  const pr = (q: V2) => `${n1(50 + ox + (q[0] - ox) * sc)} ${n1(cy + s - (oy + (q[1] - oy) * sc) * k)}`;
  let d = "";
  VSEGS.forEach(([A, c1, c2, B], i) => {
    d += `${i ? " L" : "M"} ${pr(A!)} C ${pr(c1!)} ${pr(c2!)} ${pr(B!)}`;
  });
  return d + " Z";
}

interface Geo {
  k: number;
  cy: number;
  tf: number;
  top: string;
  sides: string[];
  dome: { d: string; t: number }[];
}
const geoCache = new Map<number, Geo>();
/** The turned star's paths at squash k, pitching round its middle (the seat, where the pawn sits) so the pawn stays put. */
function geo(k: number): Geo {
  const hit = geoCache.get(k);
  if (hit) return hit;
  const cy = CY;
  const tf = Math.sqrt(1 - k * k) / Math.sqrt(1 - K * K);
  const g: Geo = {
    k,
    cy,
    tf,
    top: starDV(profile(0), 0, 0, 0, k, cy),
    sides: STEPS.map((s) => starDV(profile(s / T), s * tf, 0, 0, k, cy)),
    dome: Array.from({ length: 14 }, (_, i) => {
      const kk = 1 - (i + 1) * 0.055;
      return { d: starDV(profile(0) * kk, 0, -6, 6, k, cy), t: -0.05 - (i + 1) * 0.022 };
    }),
  };
  geoCache.set(k, g);
  return g;
}
/** A point in the plane at an absolute angle (degrees) and radius, on screen, for the turned star. */
const atV = (deg: number, r: number, s: number, g: Geo): V2 => {
  const a = (deg * Math.PI) / 180;
  return [50 + r * Math.cos(a), g.cy + s - r * Math.sin(a) * g.k];
};
const seatV = (g: Geo) => ({ cx: 50, cy: g.cy, rx: SEAT_R, ry: SEAT_R * g.k });

function StarV({ p, g }: { p: Paint; g: Geo }) {
  const hex = p.hex;
  const light = isLight(hex);
  const dark = isDark(hex);
  const hl = `${p.id}-vstar-hl`;
  const shade = `${p.id}-vstar-sh`;
  // the glint where the side's sits in the picture: the back-left, lit from the upper left
  const [gx, gy] = atV(142, 27, 0, g);
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
      {g.sides.map((d) => (
        <path key={`o${d}`} d={d} fill="none" {...LINE} {...lw(6)} />
      ))}
      <path d={g.top} fill="none" {...LINE} {...lw(6)} />
      <Region
        p={p}
        name="star-side"
        d={g.sides}
        outline={false}
        over={
          <>
            {g.sides
              .map((d, i) => ({ d, u: STEPS[i]! / T }))
              .reverse()
              .map(({ d, u }) => (
                <path key={`s${d}`} d={d} fill={tone(hex, (light ? 0.1 : 0.06) + (light ? 0.42 : 0.5) * u ** 1.25)} />
              ))}
            <rect x={50 - 60} y={g.cy - 45} width="120" height="100" fill={`url(#${shade})`} />
          </>
        }
      />
      <Region
        p={p}
        name="star-top"
        d={[g.top]}
        outline={false}
        over={
          <>
            <path d={g.top} fill={tone(hex, dark ? -0.16 : -0.02)} />
            {g.dome.map(({ d, t }) => (
              <path key={`d${d}`} d={d} fill={tone(hex, dark ? t * 1.25 - 0.12 : t)} />
            ))}
            <ellipse cx={44} cy={g.cy - 3} rx={30} ry={(16 * g.k) / K} fill={`url(#${hl})`} />
          </>
        }
      />
      <path d={g.top} fill="none" stroke={darken(hex, 0.55)} stroke-linejoin="round" opacity="0.45" {...lw(1.4)} />
      <ellipse cx={gx} cy={gy} rx={6} ry={2.2} transform={`rotate(-18 ${n1(gx)} ${n1(gy)})`} fill="#fff" opacity="0.85" />
      <circle cx={gx + 8} cy={gy - 3.5} r={1.4} fill="#fff" opacity="0.8" />
    </g>
  );
}

/** One spark of the fizz at its age (0 fresh to 2 fading), flying from (ox, oy) along (dx, dy). */
function fizzSpark(key: number, ox: number, oy: number, dx: number, dy: number, age: number, c: string, r0: number, scale: number) {
  const dist = 3 + age * 4.5;
  const r = r0 * scale * (1.1 - age * 0.28);
  return (
    <g key={key} opacity={[1, 0.9, 0.55][age]}>
      <path d={sparkD(ox + dx * dist, oy + dy * dist, r)} fill={c} stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.1)} />
    </g>
  );
}

const geoFor = (view: "front" | "back", anim: "idle" | "move") => geo(anim === "move" ? (view === "front" ? K_TOWARD : K_AWAY) : K);

function viewBack(view: "front" | "back") {
  return function ViewBack({ p, f, anim }: RiderProps) {
    const b = bob(anim, f);
    const g = geoFor(view, anim);
    const rx = 34 - b * 1.6;
    const sh = `${p.id}-vstar-shadow`;
    // front view, moving: the fizz from the two far points, beside the pawn (it may hide some of it); back view (moving away), from
    // the near point, under the pawn's hidden part (all behind it: Nov 17, one layer)
    let fizz = null;
    if (view === "back" && anim === "move") {
      const [ox, oy] = atV(-90, VIS - 4, T * 0.4 * g.tf, g);
      fizz = (
        <>
          {SPARKS.map((sp, i) => {
            const age = (f - sp.born + MOVE_N) % MOVE_N;
            if (age > 2) return null;
            const dy = 0.45 + (0.4 * (-sp.dx - 0.55)) / 0.45;
            return fizzSpark(i, ox, oy, sp.dy * 1.1, dy, age, sp.c, sp.r, 1.9);
          })}
          <circle cx={ox} cy={oy} r={f % 2 ? 3.4 : 4.2} fill="#ffe9a0" opacity="0.55" />
          <circle cx={ox} cy={oy} r={f % 2 ? 1.9 : 2.5} fill="#fffbe6" />
        </>
      );
    }
    if (view === "front" && anim === "move") {
      const tips = [atV(54, VIS - 4, 0, g), atV(126, VIS - 4, 0, g)];
      fizz = (
        <>
          {SPARKS.map((s, i) => {
            const age = (f - s.born + MOVE_N) % MOVE_N;
            if (age > 2) return null;
            const side = i % 2 ? -1 : 1;
            const [ox, oy] = tips[i % 2]!;
            return fizzSpark(i, ox, oy, side * -s.dx * 0.8, -0.5 + s.dy * 0.5, age, s.c, s.r, 2.0);
          })}
          {tips.map(([ox, oy], i) => {
            const hot = f % 2 === i;
            return (
              <g key={`h${i}`}>
                <circle cx={ox} cy={oy} r={hot ? 3.8 : 2.8} fill="#ffe9a0" opacity="0.55" />
                <circle cx={ox} cy={oy} r={hot ? 2.2 : 1.5} fill="#fffbe6" />
              </g>
            );
          })}
        </>
      );
    }
    return (
      <g>
        <defs>
          <radialGradient id={sh}>
            <stop offset="0" stop-color="#1d1d1f" stop-opacity="0.5" />
            <stop offset="0.6" stop-color="#1d1d1f" stop-opacity="0.32" />
            <stop offset="1" stop-color="#1d1d1f" stop-opacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={50} cy={GROUND} rx={rx} ry={4.5 - b * 0.25} fill={`url(#${sh})`} />
        <g transform={`translate(0 ${n1(-b)})`}>
          <StarV p={p} g={g} />
          <SeatInside p={p} {...seatV(g)} />
          <SeatLip p={p} {...seatV(g)} />
          {fizz}
        </g>
      </g>
    );
  };
}

const viewPose = (view: "front" | "back") => (anim: "idle" | "move", f: number) => {
  const b = bob(anim, f);
  const s = seatV(geoFor(view, anim));
  return {
    dx: 0,
    dy: 0,
    pawnX: 0,
    pawnY: PY - b,
    pawnTilt: 0,
    cut: CUT,
    hide: hideD(s.cx, s.cy, s.rx, s.ry, (q) => [q[0], q[1] - b], 0),
  };
};

const frontView: RiderViewDraft = {
  idle: { ms: Array(IDLE_N).fill(170) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: viewPose("front"),
  Back: viewBack("front"),
  Front,
};
const backView: RiderViewDraft = {
  idle: { ms: Array(IDLE_N).fill(170) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: viewPose("back"),
  Back: viewBack("back"),
  Front,
};

export const moonRide: RiderDraft = {
  id: "moon-ride",
  name: "Moon's Ride",
  tier: "mythic",
  description: "A sleepy crescent that gives rides on its way to bed. Mind the horns; it never minds anything.",
  frame: [-4, 4, 106, 102],
  idle: { ms: Array(IDLE_N).fill(170) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: (anim, f) => ({
    dx: anim === "move" ? (100 * f) / MOVE_N : 0,
    dy: 0,
    pawnX: CX - 50,
    pawnY: PY - bob(anim, f),
    pawnTilt: anim === "move" ? TILT : 0,
    cut: CUT,
    hide: hideSide(anim, f),
  }),
  Back,
  Front,
  views: { front: frontView, back: backView },
  trail: { ms: [160, 150, 150, 140], w: 30, h: 18, Mark: TrailMark },
};

// The trail: a little cluster of sparks dropped from the fizz, lying flat on the floor (squashed), fading out.
const T_STARS = [
  { x: -7, y: -1, r: 6.2, c: "#ffe28a" },
  { x: 4.5, y: 4, r: 5, c: "#ffffff" },
  { x: 9, y: -5.5, r: 4.2, c: "#ffd45c" },
];
const T_SPECKS = [
  { x: -12, y: 6.5 },
  { x: 0, y: -7 },
  { x: 12.5, y: 5.5 },
];

function TrailMark({ f, n }: { f: number; n: number }) {
  if (f >= 3) return null;
  const m = n % 2 ? -1 : 1;
  const sc = f === 0 ? 1 : 0.7;
  return (
    <g transform="scale(1 0.72)" opacity={[1, 0.85, 0.6][f]}>
      {T_SPECKS.map((s, i) => (
        <circle key={`k${i}`} cx={s.x * m} cy={s.y} r={f === 2 ? 2 : 1.7} fill="#ffe9a0" stroke="#1d1d1f" {...lw(0.8)} />
      ))}
      {f < 2 &&
        T_STARS.map((s, i) => (
          <path key={`s${i}`} d={sparkD(s.x * m, s.y, s.r * sc)} fill={s.c} stroke="#1d1d1f" stroke-linejoin="round" {...lw(1)} />
        ))}
      {f === 0 && (
        <g stroke="#ffffff" stroke-linecap="round" {...lw(1)}>
          <path d={`M ${-7 * m - 6.5} -1 L ${-7 * m - 3.5} -1 M ${-7 * m - 5} -2.5 L ${-7 * m - 5} 0.5`} />
          <circle cx={-7 * m} cy={-1} r={1.1} fill="#ffffff" stroke="none" />
        </g>
      )}
    </g>
  );
}
