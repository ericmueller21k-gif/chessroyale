// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/folio-crane/folio-crane.tsx, Nov 1: the side view, its front and back views, its
// trail mark): only the import lines changed and the `!`s the app's stricter typecheck asks for (noUncheckedIndexedAccess).
// The art's kit there (scripts/boss-art/item-kit.tsx) is a copy of ../item-paint.tsx and ./kit.ts. Notes: docs/areas/shop.md, "Rides".
import type { RiderDraft, RiderProps, TrailProps } from "./kit.ts";
import type { Paint } from "../item-paint.tsx";
import { Region, LINE, lw, darken, lighten, isLight } from "../item-paint.tsx";

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
    ? { dx: 0, dy: IDLE_DY[i]!, w: IDLE_W[i]!, head: IDLE_HEAD[i]!, tilt: 0 }
    : { dx: MOVE_DX[i]!, dy: MOVE_DY[i]!, w: MOVE_W[i]!, head: MOVE_HEAD[i]!, tilt: MOVE_TILT[i]! };
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

// ---- front and back views -------------------------------------------------
/** The left wing's tip, end-on: an arc from raised (w 0) out and down to hanging (w 1). */
function endTip(w: number): P {
  const A: P = [6, 0];
  const C: P = [-12, 30];
  const D: P = [2, 82];
  const u = 1 - w;
  return [u * u * A[0] + 2 * u * w * C[0] + w * w * D[0], u * u * A[1] + 2 * u * w * C[1] + w * w * D[1]];
}
const flipX = (q: P): P => [100 - q[0], q[1]];
/** q moved d units toward o. */
const toward = (q: P, o: P, d: number): P => {
  const L = Math.hypot(o[0] - q[0], o[1] - q[1]) || 1;
  return [q[0] + ((o[0] - q[0]) / L) * d, q[1] + ((o[1] - q[1]) / L) * d];
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** The left wing's root, end-on: it turns as the wing sweeps down so the wing keeps its breadth. */
const endR1 = (w: number) => mix([28.5, 65], [34, 74], clamp01(w));
const endR2 = (w: number) => mix([46, 46], [40, 52], clamp01(w));

/** One wing seen end-on: its outer face and inner face split by the center crease. */
function EndWing({ p, name, r1, r2, tip, dark, seal, hi }: { p: Paint; name: string; r1: P; r2: P; tip: P; dark?: boolean; seal?: boolean; hi?: boolean }) {
  const t = tones(p);
  const m = mix(r1, r2, 0.42);
  const inks = [0.2, 0.36, 0.52, 0.68]
    .map((tt, i) => wave(bary(r1, r2, tip, 0.1 + i * 0.02, tt), bary(r1, r2, tip, 0.86 - tt - 0.04, tt), 0.8, 3))
    .join(" ");
  const inkG = <path d={inks} fill="none" stroke={t.ink} stroke-linecap="round" opacity={dark ? 0.6 : 0.8} {...lw(1.1)} />;
  const s0 = bary(r1, r2, tip, 0.5, 0.26);
  const ang = (Math.atan2(tip[1] - r1[1], tip[0] - r1[0]) * 180) / Math.PI;
  const sr = tip[0] > 50 ? ang + 60 : ang + 120;
  return (
    <g>
      <Region p={p} name={`${name}-back`} d={[poly([r1, m, tip])]} fill={dark ? t.mid : t.lit} outline={false} over={inkG} />
      <Region p={p} name={`${name}-fold`} d={[poly([m, r2, tip])]} fill={dark ? t.deep : t.mid} outline={false} over={inkG} />
      <path d={open([m, tip])} fill="none" stroke={t.crease} {...lw(1.4)} />
      {hi && <path d={open([0.3, 0.86].map((k) => toward(mix(r1, tip, k), mix(m, tip, k), 1.7)))} fill="none" stroke={t.hi} stroke-linecap="round" {...lw(1.5)} />}
      <path d={poly([r1, r2, tip])} fill="none" {...LINE} />
      {seal && (
        <g transform={`translate(${n(s0[0])} ${n(s0[1])}) rotate(${n(sr * 0 - 10)})`}>
          <rect x={-3.6} y={-3.6} width={7.2} height={7.2} rx={1.2} fill="#d8432f" {...LINE} {...lw(1.6)} />
          <circle cx={0} cy={-1.1} r={1.1} fill="#fbe9dc" />
          <rect x={-1.8} y={0.6} width={3.6} height={1.3} rx={0.5} fill="#fbe9dc" />
        </g>
      )}
    </g>
  );
}

function EndShadow({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const s = state(anim, f);
  const lift = -s.dy;
  return <ellipse cx={50} cy={98 + lift} rx={22 - lift * 0.8} ry={3.2 - lift * 0.08} fill="#000" opacity={0.2 - lift * 0.012} />;
}

/** The body seen end-on: a folded keel, lit on the left. */
function EndBody({ p }: { p: Paint }) {
  const t = tones(p);
  const L: P = [23, 59];
  const R: P = [77, 59];
  const C: P = [50, 61.5];
  const SL: P = [33, 81];
  const SR: P = [67, 81];
  const B: P = [50, 95];
  const ink = [wave([27, 65], [44, 65.5], 0.9, 4), wave([33, 73], [45, 73], 0.9, 3), wave([56, 65.5], [73, 65], 0.9, 4), wave([55, 73], [67, 73], 0.9, 3)].join(" ");
  const inkB = <path d={ink} fill="none" stroke={t.ink} stroke-linecap="round" opacity={0.75} {...lw(1.1)} />;
  return (
    <g>
      <Region p={p} name="body-lit" d={[poly([L, C, B, SL])]} fill={t.lit} outline={false} over={inkB} />
      <Region p={p} name="body-shaded" d={[poly([C, R, SR, B])]} fill={t.mid} outline={false} over={inkB} />
      <path d={open([C, B])} fill="none" stroke={t.crease} {...lw(1.4)} />
      <path d={open([SL, [42, 85], B])} fill="none" stroke={t.crease} {...lw(1.1)} opacity={0.7} />
      <path d={open([[26, 60.6], [46, 62]])} fill="none" stroke={t.hi} stroke-linecap="round" {...lw(1.5)} />
      <path d={poly([L, C, R, SR, B, SL])} fill="none" {...LINE} />
    </g>
  );
}

function BackViewBack({ p, anim, f }: RiderProps) {
  const s = state(anim, f);
  const t = tones(p);
  const hd = s.head * 0.2;
  // neck and head peeking past the pawn's right
  const nb1: P = [54, 52];
  const nb2: P = [60, 52];
  const nt1: P = [60, 25 + hd * 0.4];
  const nt2: P = [67, 26.5 + hd * 0.4];
  const nm = mix(nb1, nb2, 0.5);
  const ntm = mix(nt1, nt2, 0.5);
  const h1: P = [59.5, 28 + hd];
  const h2: P = [63.5, 15.5 + hd];
  const htip: P = [74.5, 12 + hd * 1.3];
  const hmid: P = [65, 22.5 + hd];
  const tip = endTip(s.w);
  return (
    <g>
      <EndShadow anim={anim} f={f} />
      <Region p={p} name="neck-lit" d={[poly([nb1, nt1, ntm, nm])]} fill={t.lit} outline={false} />
      <Region p={p} name="neck-shade" d={[poly([nm, ntm, nt2, nb2])]} fill={t.mid} outline={false} />
      <path d={open([nm, ntm])} fill="none" stroke={t.crease} {...lw(1.3)} />
      <path d={poly([nb1, nt1, nt2, nb2])} fill="none" {...LINE} />
      <Region p={p} name="head-top" d={[poly([h1, h2, htip, hmid])]} fill={t.lit} outline={false} />
      <Region p={p} name="head-chin" d={[poly([h1, hmid, htip])]} fill={t.mid} outline={false} />
      <path d={open([hmid, htip])} fill="none" stroke={t.crease} {...lw(1.2)} />
      <path d={poly([h1, h2, htip])} fill="none" {...LINE} />
      <EndWing p={p} name="nearwing" r1={endR1(s.w)} r2={endR2(s.w)} tip={tip} hi />
      <EndWing p={p} name="farwing" r1={flipX(endR1(s.w))} r2={flipX(endR2(s.w))} tip={flipX(tip)} dark />
    </g>
  );
}

function BackViewFront({ p }: RiderProps) {
  const t = tones(p);
  // the folded tail, pointing at us
  const tt: P = [50, 54];
  const tl: P = [43.5, 67];
  const tr: P = [56.5, 67];
  const tb: P = [50, 82];
  return (
    <g>
      <EndBody p={p} />
      <Region p={p} name="tail-top" d={[poly([tt, tl, tb])]} fill={t.lit} outline={false} />
      <Region p={p} name="tail-under" d={[poly([tt, tr, tb])]} fill={t.mid} outline={false} />
      <path d={open([tt, tb])} fill="none" stroke={t.crease} {...lw(1.3)} />
      <path d={open([[46.5, 60], [44.8, 66]])} fill="none" stroke={t.hi} stroke-linecap="round" {...lw(1.3)} />
      <path d={poly([tt, tl, tb, tr])} fill="none" {...LINE} />
    </g>
  );
}

function FrontViewBack({ p, anim, f }: RiderProps) {
  const s = state(anim, f);
  const tip = endTip(s.w);
  return (
    <g>
      <EndShadow anim={anim} f={f} />
      <EndWing p={p} name="farwing" r1={endR1(s.w)} r2={endR2(s.w)} tip={tip} hi />
      <EndWing p={p} name="nearwing" r1={flipX(endR1(s.w))} r2={flipX(endR2(s.w))} tip={flipX(tip)} dark seal />
    </g>
  );
}

function FrontViewFront({ p, anim, f }: RiderProps) {
  const s = state(anim, f);
  const t = tones(p);
  const hd = s.head * 0.18;
  // neck rising toward us from the chest
  const nb1: P = [43.5, 76];
  const nb2: P = [56.5, 76];
  const nt1: P = [47, 46 + hd * 0.5];
  const nt2: P = [53, 46 + hd * 0.5];
  const nbm = mix(nb1, nb2, 0.5);
  const ntm = mix(nt1, nt2, 0.5);
  // head: crown on top, the beak folding down toward us
  const hT: P = [50, 33 + hd];
  const hL: P = [38.5, 43.5 + hd];
  const hR: P = [61.5, 43.5 + hd];
  const hB: P = [50, 57 + hd * 1.3];
  return (
    <g>
      <EndBody p={p} />
      <Region p={p} name="neck-lit" d={[poly([nb1, nt1, ntm, nbm])]} fill={t.lit} outline={false} />
      <Region p={p} name="neck-shade" d={[poly([nbm, ntm, nt2, nb2])]} fill={t.mid} outline={false} />
      <path d={open([nbm, ntm])} fill="none" stroke={t.crease} {...lw(1.3)} />
      <path d={open([[46, 72], [48.2, 50]])} fill="none" stroke={t.hi} stroke-linecap="round" {...lw(1.3)} />
      <path d={poly([nb1, nt1, nt2, nb2])} fill="none" {...LINE} />
      <Region p={p} name="head-top" d={[poly([hL, hT, hR])]} fill={t.lit} outline={false} />
      <Region p={p} name="head-chin" d={[poly([hL, hR, hB])]} fill={t.mid} outline={false} />
      <path d={open([mix(hL, hR, 0.5), hB])} fill="none" stroke={t.crease} {...lw(1.2)} />
      <path d={poly([hL, hT, hR, hB])} fill="none" {...LINE} />
      <path d={open([hL, hR])} fill="none" stroke="#1d1d1f" {...lw(1.6)} />
      <circle cx={44.6} cy={n(40.6 + hd)} r={1.9} fill="#1d1d1f" />
      <circle cx={55.4} cy={n(40.6 + hd)} r={1.9} fill="#1d1d1f" />
    </g>
  );
}

// ---- trail: a few folded-paper scraps --------------------------------------
const SCRAP_OP = [1, 0.72, 0.45, 0.18];
const SCRAP_SPREAD = [0, 0.3, 1.2, 1.8];
const SCRAP_SIZE = [1, 1, 0.9, 0.75];
function PaperScraps({ p, f, n: k }: TrailProps) {
  const i = Math.max(0, Math.min(3, f));
  const sp = SCRAP_SPREAD[i]!;
  const sz = SCRAP_SIZE[i]!;
  const flip = k % 2 ? -1 : 1;
  const piece = (pts: P[], c: P, dir: P, spin: number) => {
    const o: P = [c[0] + dir[0] * sp, c[1] + dir[1] * sp];
    return poly(pts.map((q) => rot([o[0] + (q[0] - c[0]) * sz, o[1] + (q[1] - c[1]) * sz], o, spin * sp)));
  };
  const A = piece([[-9, -2.5], [-2.5, -4.5], [-5, 3]], [-5.5, -1.3], [-1, -0.3], -8);
  const Aink = piece([[-7.6, -1.6], [-4, -2.6]], [-5.5, -1.3], [-1, -0.3], -8).replace(/ Z$/, "");
  const B = piece([[0, 1.8], [8.5, -1.2], [9.2, 0.4], [0.8, 3.6]], [4.6, 1.2], [1, 0.4], 10);
  const C = piece([[1.5, -5], [6.5, -4.6], [3, -1.6]], [3.7, -3.7], [0.4, -0.6], 14);
  return (
    <g transform={`scale(${flip} 1)`} opacity={SCRAP_OP[i]!}>
      <path d={A} fill="#fbf5e6" {...LINE} {...lw(0.9)} />
      <path d={Aink} fill="none" stroke="#6e80ab" stroke-linecap="round" {...lw(0.8)} />
      <path d={B} fill="#f4ebd3" {...LINE} {...lw(0.9)} />
      <path d={C} fill={p.hex} {...LINE} {...lw(0.9)} />
    </g>
  );
}

const endPose = (anim: "idle" | "move", f: number) => {
  const s = state(anim, f);
  return { dx: 0, dy: s.dy, pawnX: 0, pawnY: -10, pawnTilt: 0, cut: 72 };
};

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
  trail: { ms: [160, 160, 170, 160], w: 24, h: 14, Mark: PaperScraps },
  views: {
    front: { frame: [-8, -9, 116, 110], idle: { ms: IDLE_MS }, move: { ms: MOVE_MS }, pose: endPose, Back: FrontViewBack, Front: FrontViewFront },
    back: { frame: [-8, -9, 116, 110], idle: { ms: IDLE_MS }, move: { ms: MOVE_MS }, pose: endPose, Back: BackViewBack, Front: BackViewFront },
  },
};
