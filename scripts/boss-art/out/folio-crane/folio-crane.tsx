import { Region, LINE, lw, darken, lighten, isLight, type RiderDraft, type RiderProps, type Paint } from "../../item-kit.tsx";

type P = [number, number];
const n = (v: number) => (Math.round(v * 10) / 10).toString();
const poly = (pts: P[]) => "M " + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L ") + " Z";
const open = (pts: P[]) => "M " + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L ");
const mix = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** A point in the triangle a, b, c: s along a→b, t along a→c. */
const bary = (a: P, b: P, c: P, s: number, t: number): P => [
  a[0] + s * (b[0] - a[0]) + t * (c[0] - a[0]),
  a[1] + s * (b[1] - a[1]) + t * (c[1] - a[1]),
];
const rot = (q: P, o: P, deg: number): P => {
  const r = (deg * Math.PI) / 180;
  const x = q[0] - o[0];
  const y = q[1] - o[1];
  return [o[0] + x * Math.cos(r) - y * Math.sin(r), o[1] + x * Math.sin(r) + y * Math.cos(r)];
};
/** A handwriting squiggle from a to b. */
function wave(a: P, b: P, amp = 1.1, k = 4): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  let d = `M ${n(a[0])} ${n(a[1])}`;
  for (let i = 0; i < k; i++) {
    const m = mix(a, b, (i + 0.5) / k);
    const s = i % 2 ? -1 : 1;
    const e = mix(a, b, (i + 1) / k);
    d += ` Q ${n(m[0] + nx * amp * s * 2)} ${n(m[1] + ny * amp * s * 2)} ${n(e[0])} ${n(e[1])}`;
  }
  return d;
}

function tones(p: Paint) {
  const light = isLight(p.hex);
  return {
    lit: p.fill,
    mid: darken(p.hex, 0.15),
    deep: darken(p.hex, 0.3),
    crease: darken(p.hex, 0.5),
    hi: lighten(p.hex, 0.65),
    ink: light ? "#6e80ab" : lighten(p.hex, 0.42),
  };
}

// ---- motion -------------------------------------------------------------
const IDLE_MS = [220, 220, 220, 220, 220, 220, 220, 220];
const MOVE_MS = [75, 75, 75, 75, 75, 75, 75, 75];
const IDLE_DY = [0, -0.8, -1.6, -2, -1.6, -0.8, 0, 0.4];
const IDLE_W = [0, -0.02, -0.04, -0.05, -0.03, 0, 0.03, 0.02];
const IDLE_HEAD = [0, 0, 0, 0, 12, 22, 10, 0];
const MOVE_DX = [0, 11, 23, 36, 50, 64, 77, 89];
const MOVE_DY = [0, -2, -5, -6, -5, -3, -1, 0];
const MOVE_W = [0, 0.45, 0.95, 1, 0.65, 0.25, -0.04, 0];
const MOVE_HEAD = [0, -3, -6, -6, -4, -2, 0, 0];
const MOVE_TILT = [0, -2, -4, -3, -1, 1, 1, 0];

function state(anim: "idle" | "move", f: number) {
  const i = anim === "idle" ? f % 8 : f % 8;
  return anim === "idle"
    ? { dx: 0, dy: IDLE_DY[i], w: IDLE_W[i], head: IDLE_HEAD[i], tilt: 0 }
    : { dx: MOVE_DX[i], dy: MOVE_DY[i], w: MOVE_W[i], head: MOVE_HEAD[i], tilt: MOVE_TILT[i] };
}

// ---- geometry -----------------------------------------------------------
const NEAR_R1: P = [17, 62];
const NEAR_R2: P = [52, 60];
const NEAR_UP: P = [13, 0];
const NEAR_DOWN: P = [2, 84];
const FAR_R1: P = [40, 60];
const FAR_R2: P = [74, 58];
const FAR_UP: P = [68, -2];
const FAR_DOWN: P = [52, 84];

/** One wing: two faces split by a center crease, handwriting on top. */
function Wing({ p, name, r1, r2, tip, far, seal }: { p: Paint; name: string; r1: P; r2: P; tip: P; far?: boolean; seal?: boolean }) {
  const t = tones(p);
  const m = mix(r1, r2, 0.42);
  const inks = [0.14, 0.3, 0.46, 0.62]
    .map((tt, i) => wave(bary(r1, r2, tip, 0.1 + i * 0.02, tt), bary(r1, r2, tip, 0.86 - tt - 0.04, tt), 0.9, 4))
    .join(" ");
  const inkG = <path d={inks} fill="none" stroke={t.ink} stroke-linecap="round" opacity={far ? 0.55 : 0.8} {...lw(1.1)} />;
  const s0 = bary(r1, r2, tip, 0.52, 0.12);
  return (
    <g>
      <Region p={p} name={`${name}-back`} d={[poly([r1, m, tip])]} fill={far ? t.mid : t.lit} outline={false} over={inkG} />
      <Region p={p} name={`${name}-fold`} d={[poly([m, r2, tip])]} fill={far ? t.deep : t.mid} outline={false} over={inkG} />
      <path d={open([m, tip])} fill="none" stroke={t.crease} {...lw(1.4)} />
      {!far && <path d={open([mix(r1, tip, 0.12), mix(r1, tip, 0.85)].map((q) => [q[0] + 1.8, q[1]] as P))} fill="none" stroke={t.hi} stroke-linecap="round" {...lw(1.5)} />}
      <path d={poly([r1, r2, tip])} fill="none" {...LINE} />
      {seal && (
        <g transform={`translate(${n(s0[0])} ${n(s0[1])}) rotate(-10)`}>
          <rect x={-3.6} y={-3.6} width={7.2} height={7.2} rx={1.2} fill="#d8432f" {...LINE} {...lw(1.6)} />
          <circle cx={0} cy={-1.1} r={1.1} fill="#fbe9dc" />
          <rect x={-1.8} y={0.6} width={3.6} height={1.3} rx={0.5} fill="#fbe9dc" />
        </g>
      )}
    </g>
  );
}

function Back({ p, anim, f }: RiderProps) {
  const s = state(anim, f);
  const lift = -s.dy;
  return (
    <g>
      <ellipse cx={50} cy={98 + lift} rx={28 - lift * 0.9} ry={3.2 - lift * 0.08} fill="#000" opacity={0.2 - lift * 0.012} />
      <Wing p={p} name="farwing" r1={FAR_R1} r2={FAR_R2} tip={mix(FAR_UP, FAR_DOWN, s.w)} far />
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  const s = state(anim, f);
  const t = tones(p);
  // tail
  const tb1: P = [22, 62];
  const tb2: P = [28, 81];
  const ttip: P = [-8, 49];
  const tm = mix(tb1, tb2, 0.5);
  // neck
  const nb1: P = [62, 80];
  const nb2: P = [84, 62];
  const ntop2: P = [93, 23];
  const ntop: P = [87, 21];
  const nm = mix(nb1, nb2, 0.5);
  const ntm = mix(ntop, ntop2, 0.5);
  // head, dipping round the neck's top
  const hp: P = [90, 22];
  const h1 = rot([84, 25], hp, s.head);
  const h2 = rot([91, 13], hp, s.head);
  const htip = rot([107, 29], hp, s.head);
  const hmid = rot([90, 22], hp, s.head);
  const eye = rot([93.5, 19.8], hp, s.head);
  // body
  const TL: P = [15, 61];
  const TR: P = [82, 57];
  const BR: P = [67, 80];
  const BOT: P = [50, 95];
  const BL: P = [30, 80];
  const M: P = [47, 59];
  const bodyInk = [wave([22, 66], [42, 65], 0.9, 4), wave([28, 73], [44, 72], 0.9, 3), wave([54, 66], [72, 64], 0.9, 4), wave([54, 73], [64, 72], 0.9, 3)].join(" ");
  const inkB = <path d={bodyInk} fill="none" stroke={t.ink} stroke-linecap="round" opacity={0.75} {...lw(1.1)} />;
  return (
    <g>
      {/* tail */}
      <Region p={p} name="tail-top" d={[poly([tb1, ttip, tm])]} fill={t.lit} outline={false} />
      <Region p={p} name="tail-under" d={[poly([tm, ttip, tb2])]} fill={t.mid} outline={false} />
      <path d={open([tm, ttip])} fill="none" stroke={t.crease} {...lw(1.3)} />
      <path d={poly([tb1, ttip, tb2])} fill="none" {...LINE} />
      {/* neck */}
      <Region p={p} name="neck-lit" d={[poly([nb1, ntop, ntm, nm])]} fill={t.lit} outline={false} />
      <Region p={p} name="neck-shade" d={[poly([nm, ntm, ntop2, nb2])]} fill={t.mid} outline={false} />
      <path d={open([nm, ntm])} fill="none" stroke={t.crease} {...lw(1.3)} />
      <path d={poly([nb1, ntop, ntop2, nb2])} fill="none" {...LINE} />
      {/* head */}
      <Region p={p} name="head-top" d={[poly([hmid, h2, htip])]} fill={t.lit} outline={false} />
      <Region p={p} name="head-chin" d={[poly([h1, hmid, htip])]} fill={t.mid} outline={false} />
      <path d={open([hmid, htip])} fill="none" stroke={t.crease} {...lw(1.2)} />
      <path d={poly([h1, h2, htip])} fill="none" {...LINE} />
      <circle cx={n(eye[0])} cy={n(eye[1])} r={1.5} fill="#1d1d1f" />
      {/* body */}
      <Region p={p} name="body-lit" d={[poly([TL, M, BOT, BL])]} fill={t.lit} outline={false} over={inkB} />
      <Region p={p} name="body-shaded" d={[poly([M, TR, BR, BOT])]} fill={t.mid} outline={false} over={inkB} />
      <path d={open([M, BOT])} fill="none" stroke={t.crease} {...lw(1.4)} />
      <path d={open([BL, [40, 78], BOT])} fill="none" stroke={t.crease} {...lw(1.1)} opacity={0.7} />
      <path d={open([[20, 62.5], [44, 61]])} fill="none" stroke={t.hi} stroke-linecap="round" {...lw(1.5)} />
      <path d={poly([TL, TR, BR, BOT, BL])} fill="none" {...LINE} />
      {/* near wing */}
      <Wing p={p} name="nearwing" r1={NEAR_R1} r2={NEAR_R2} tip={mix(NEAR_UP, NEAR_DOWN, s.w)} seal />
    </g>
  );
}

export const folioCrane: RiderDraft = {
  id: "folio-crane",
  name: "Paper Crane",
  tier: "mythic",
  description: "Folded from a page of someone's very serious notes. Flies fine, as long as nobody tries to read it.",
  frame: [-8, -9, 114, 110],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: (anim, f) => {
    const s = state(anim, f);
    return { dx: s.dx, dy: s.dy, pawnX: 2, pawnY: -10, pawnTilt: s.tilt, cut: 72 };
  },
  Back,
  Front,
};
