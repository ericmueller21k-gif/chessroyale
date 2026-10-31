import type { RiderDraft, RiderPose, RiderProps } from "../../item-kit.tsx";
import { Region, LINE, lw } from "../../item-kit.tsx";

const IDLE_N = 12;
const MOVE_N = 8;
const PX = 4; // pawn sits a little right of the middle
const PIVOT: [number, number] = [50 + PX, 80]; // pawn's base when seated

const ink = "#1d1d1f";
const WOOD = "#d4995a";
const WOOD_HI = "#f2cf98";
const WOOD_DK = "#a8703a";
const STRAW = "#ecca7e";
const STRAW_DK = "#b98d3e";
const STEEL = "#c8ced8";
const STEEL_HI = "#f4f6fa";
const STEEL_DK = "#8e96a3";
const PLUM = "#7a3d96";
const CANVAS = "#f0e4c8";
const CANVAS_DK = "#cdbb94";
const PAL = "#a8693a";
const PAL_DK = "#7a4a26";
const RED = "#e0443e";
const YEL = "#f4c430";
const BLU = "#3d7fd9";
const GRN = "#5cc04a";

const mod = (a: number, n: number) => ((a % n) + n) % n;

const mDy = (k: number) => 7 * Math.abs(Math.sin((Math.PI * k) / MOVE_N));
const mTilt = (k: number) => 3.5 * Math.cos((Math.PI * mod(k, MOVE_N)) / MOVE_N);

function poseOf(anim: "idle" | "move", f: number): RiderPose {
  if (anim === "idle") {
    const a = (2 * Math.PI * f) / IDLE_N;
    return { dx: 0, dy: -1.5 + 1.5 * Math.cos(a), pawnX: PX, pawnY: -8, pawnTilt: 1 * Math.sin(a), cut: 68 };
  }
  return { dx: 12.5 * f, dy: mDy(f), pawnX: PX, pawnY: -8, pawnTilt: mTilt(f), cut: 68 };
}

function rot(x: number, y: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const ux = x - PIVOT[0];
  const uy = y - PIVOT[1];
  return [PIVOT[0] + ux * c - uy * s, PIVOT[1] + ux * s + uy * c];
}

const n1 = (v: number) => v.toFixed(1);

/** A teardrop hanging from (x0, y0), length L. */
function dripPath(x0: number, y0: number, L: number) {
  const r = 1.7 + L * 0.17;
  const yb = y0 + L;
  return `M ${n1(x0 - 2.4)} ${n1(y0)} C ${n1(x0 - 1.6)} ${n1(y0 + L * 0.5)} ${n1(x0 - r)} ${n1(yb - r)} ${n1(x0 - r)} ${n1(yb)} A ${n1(r)} ${n1(r)} 0 0 0 ${n1(x0 + r)} ${n1(yb)} C ${n1(x0 + r)} ${n1(yb - r)} ${n1(x0 + 1.6)} ${n1(y0 + L * 0.5)} ${n1(x0 + 2.4)} ${n1(y0)} Z`;
}
function ell(cx: number, cy: number, rx: number, ry: number) {
  return `M ${n1(cx - rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 1 0 ${n1(cx + rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 1 0 ${n1(cx - rx)} ${n1(cy)} Z`;
}

// The hanging drip: its top tucked under the paint's lower edge.
const DRIP_X = -7.5;
const DRIP_Y = 83.5;
const IDLE_DRIP = [2.2, 2.8, 3.4, 4.2, 5.2, 6.4, 9, 0.8, 1, 1.4, 1.7, 2];
const MOVE_DRIP = [4, 7, 0.8, 1.5, 2.2, 2.8, 3.3, 3.7];

/** The paint stroke on the air: where the bristle tips were over the last few frames, seen from frame f. */
function strokeRibbon(f: number, t0: number, t1: number, w0: number) {
  const tip: [number, number] = [-27, 69];
  const pts: [number, number][] = [];
  const ws: number[] = [];
  for (let t = t0; t <= t1 + 1e-6; t += 0.25) {
    const k = f - t;
    const [tx, ty] = rot(tip[0], tip[1], mTilt(k));
    pts.push([12.5 * k - 12.5 * f + tx, mDy(k) - mDy(f) + ty]);
    ws.push(w0 * Math.max(0.15, 1 - (t / 4) * (t / 4)));
  }
  const up: string[] = [];
  const lo: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const h = ws[i] / 2;
    up.push(`${n1(pts[i][0] + nx * h)} ${n1(pts[i][1] + ny * h)}`);
    lo.push(`${n1(pts[i][0] - nx * h)} ${n1(pts[i][1] - ny * h)}`);
  }
  const last = pts[pts.length - 1];
  return `M ${up.join(" L ")} Q ${n1(last[0] - 2)} ${n1(last[1])} ${lo[lo.length - 1]} L ${lo.slice(0, -1).reverse().join(" L ")} Z`;
}

function Back({ p, f, anim }: RiderProps) {
  const ps = poseOf(anim, f);
  const gy = 97 - ps.dy; // the ground, in the group's coordinates
  const lift = ps.dy; // bigger when lower
  const shadow = <ellipse cx={40} cy={gy} rx={50 + lift * 0.8} ry={4.2 + lift * 0.1} fill="#000" opacity={0.2 + lift * 0.012} />;
  if (anim === "idle") {
    return (
      <g>
        {shadow}
        {f === 7 && <Region p={p} name="drop" d={[ell(DRIP_X, 95, 2.9, 3.3)]} line={1.6} />}
        {(f === 8 || f === 9) && (
          <g opacity={f === 8 ? 1 : 0.5}>
            <Region p={p} name="splat" d={[ell(DRIP_X, gy, f === 8 ? 4.6 : 5.4, f === 8 ? 1.4 : 1.1)]} line={1.4} />
          </g>
        )}
      </g>
    );
  }
  // move: the stroke left on the air, and a drop flung off
  const rel = 1.5;
  const relY = DRIP_Y + 10 + mDy(rel);
  const dropAt = (g: number) => {
    const x = DRIP_X + 12.5 * rel + 5 * (g - rel) - 12.5 * g;
    const y = relY + 4.4 * (g - rel) * (g - rel) - mDy(g);
    return [x, y] as [number, number];
  };
  const drop = f >= 2 && f <= 4 ? dropAt(f) : null;
  const splatX = DRIP_X + 12.5 * rel + 5 * (4.6 - rel); // where it lands, in the square's own x
  return (
    <g>
      {shadow}
      <g opacity="0.45">
        <Region p={p} name="strokeTail" d={[strokeRibbon(f, 1.75, 3.6, 15)]} line={2} />
      </g>
      <Region p={p} name="stroke" d={[strokeRibbon(f, 0, 2, 15)]} line={2.2} />
      {drop && (
        <g>
          <Region p={p} name="fly" d={[ell(drop[0], drop[1], 3.8 - (f - 2) * 0.3, 3)]} line={1.6} />
          <path d={`M ${n1(drop[0] - 1.3)} ${n1(drop[1] - 0.9)} l 1 -0.5`} stroke="#fff" opacity="0.7" fill="none" stroke-linecap="round" {...lw(1)} />
        </g>
      )}
      {(f === 5 || f === 6) && (
        <g opacity={f === 5 ? 1 : 0.5}>
          <Region p={p} name="splat" d={[ell(splatX - 12.5 * f, gy, f === 5 ? 4.6 : 5.4, 1.3)]} line={1.4} />
        </g>
      )}
    </g>
  );
}

function Front({ p, f, anim }: RiderProps) {
  const ps = poseOf(anim, f);
  const tilt = ps.pawnTilt ?? 0;
  const L = anim === "idle" ? IDLE_DRIP[f] : MOVE_DRIP[f];
  const sway = anim === "idle" ? 2.5 * Math.sin((2 * Math.PI * (f - 2)) / IDLE_N) : -4 * tilt;
  const dripX = anim === "move" && f === 1 ? DRIP_X - 1.2 : DRIP_X;
  const dab = (cx: number, cy: number, c: string, r = 1.9) => <circle cx={cx} cy={cy} r={r} fill={c} stroke={ink} {...lw(1.2)} />;
  return (
    <g transform={`rotate(${n1(tilt)} ${PIVOT[0]} ${PIVOT[1]})`}>
      {/* the palette, hung as a step */}
      <g transform={`rotate(${n1(sway)} 93 71)`}>
        <path d="M 86 70 L 84.5 80 M 100 70 L 101.5 80" stroke={ink} fill="none" stroke-linecap="round" {...lw(3)} />
        <path d="M 86 70 L 84.5 80 M 100 70 L 101.5 80" stroke={PLUM} fill="none" stroke-linecap="round" {...lw(1.4)} />
        <path d="M 80 83 C 80 78 88.5 77 95 78 C 103 79 106.5 82.5 104.5 86.5 C 102.5 90.5 94 92 88 91 C 82.5 90 80 87 80 83 Z" fill={PAL} {...LINE} />
        <path d="M 83 82.5 C 84 80 88.5 79.6 92 79.7" stroke="#d39a63" fill="none" stroke-linecap="round" {...lw(1.6)} />
        <circle cx={85.6} cy={86} r={1.8} fill={PAL_DK} stroke={ink} {...lw(1.2)} />
        {dab(91.5, 81.6, RED)}
        {dab(97.2, 81.8, YEL)}
        {dab(101.3, 85.2, BLU)}
        {dab(95.2, 87.8, GRN)}
      </g>
      {/* bristles, dipped in paint */}
      <Region p={p} name="drip" d={[dripPath(dripX, DRIP_Y, L)]} line={1.8} />
      <path d="M 8 58.5 C -2 54.5 -16 50.5 -24 54 C -32 58 -32 80 -24 84 C -16 88 -2 83 8 78 Z" fill={STRAW} {...LINE} />
      <path d="M 7 62 L 0 61 M 7 66.5 L 1 66.3 M 7 71 L 1 71.3 M 7 75 L 0 76.2" stroke={STRAW_DK} fill="none" stroke-linecap="round" {...lw(1.3)} />
      <Region
        p={p}
        name="paint"
        d={[
          "M -6 52.6 C -14 50 -22 49.6 -26.5 52.6 C -33 57 -33.5 79.5 -26.5 84.5 C -23 87.2 -19.5 87.6 -17.5 87.4 C -17.8 90.5 -17.6 93 -15.2 93.2 C -12.8 93.3 -13 90.5 -13.4 87 C -11 86.4 -8.5 85.6 -4.5 84.4 C -2 83 -4.6 79.6 -2.4 76.2 C -0.2 72.6 -4.2 69.6 -2 66 C 0 62.4 -4.4 59.6 -2.6 56.2 C -1.8 54.6 -3.6 53.4 -6 52.6 Z",
        ]}
      />
      <path d="M -27.5 61 C -26.5 57 -22 54.2 -15.5 54.2" stroke="#fff" opacity="0.6" fill="none" stroke-linecap="round" {...lw(2.2)} />
      <path d="M -29.6 66.5 L -29.8 70" stroke="#fff" opacity="0.6" fill="none" stroke-linecap="round" {...lw(1.8)} />
      {/* ferrule */}
      <path d="M 6 57.5 L 22 61.2 L 22 74.8 L 6 78.5 Z" fill={STEEL} {...LINE} />
      <path d="M 8.5 60.8 L 20 63.4" stroke={STEEL_HI} fill="none" stroke-linecap="round" {...lw(2)} />
      <path d="M 12.5 59.4 L 12.5 76.6 M 16.5 60.3 L 16.5 75.7" stroke={STEEL_DK} fill="none" stroke-linecap="round" {...lw(1.3)} />
      {/* the seat cushion: a painter's rag, stuffed, resting on the handle */}
      <path d="M 32 56.2 Q 54 53.6 76 56.2 Q 81 56.8 81 61.5 L 81 67 L 27 67 L 27 61.5 Q 27 56.8 32 56.2 Z" fill={CANVAS} {...LINE} />
      <path d="M 31 60.5 Q 32 58.4 36 58 Q 54 56.4 72 58" stroke="#fff" fill="none" stroke-linecap="round" opacity="0.8" {...lw(1.8)} />
      <path d="M 44 61.6 l 2 -2.2 l 2 2.2 l -2 2.2 Z" fill={RED} stroke={ink} {...lw(1.2)} />
      <path d="M 61 62.2 c 0 -1.6 1.4 -2.6 2.4 -3.4 c 1 0.8 2.4 1.8 2.4 3.4 a 2.4 2.4 0 0 1 -4.8 0 Z" fill={BLU} stroke={ink} {...lw(1.2)} />
      <circle cx={53.5} cy={63} r={1.5} fill={YEL} stroke={ink} {...lw(1.1)} />
      {/* handle */}
      <path d="M 21 63 C 28 61.8 34 63 44 63.4 L 104 64.6 C 109 64.7 109 72.4 104 72.4 L 44 72.8 C 34 73 28 74.4 21 73.2 Z" fill={WOOD} {...LINE} />
      <path d="M 25 64.8 C 32 64.2 40 65 101 66.3" stroke={WOOD_HI} fill="none" stroke-linecap="round" {...lw(1.8)} />
      <path d="M 50 71 L 102 70.6" stroke={WOOD_DK} fill="none" stroke-linecap="round" opacity="0.7" {...lw(1.3)} />
      <circle cx={104.2} cy={68.4} r={1.2} fill={ink} />
      {/* cushion ties, round the handle */}
      <path d="M 35 56.4 Q 34 64 35 73.6 M 73 56.4 Q 74 64 73 73.2" stroke={ink} fill="none" stroke-linecap="round" {...lw(4)} />
      <path d="M 35 56.4 Q 34 64 35 73.6 M 73 56.4 Q 74 64 73 73.2" stroke={PLUM} fill="none" stroke-linecap="round" {...lw(2)} />
      {/* palette cord knots */}
      <circle cx={86} cy={69} r={1.8} fill={PLUM} stroke={ink} {...lw(1.2)} />
      <circle cx={100} cy={68.8} r={1.8} fill={PLUM} stroke={ink} {...lw(1.2)} />
    </g>
  );
}

export const SmudgyBrush: RiderDraft = {
  id: "smudgy-brush",
  name: "Brush Ride",
  tier: "mythic",
  description: "Flies like a broom, drips like a brush. Mind the wet paint on the sky.",
  frame: [-34, 8, 144, 92],
  idle: { ms: Array(IDLE_N).fill(180) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: poseOf,
  Back,
  Front,
};
