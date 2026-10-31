import type { ComponentChildren } from "preact";
import { Region, LINE, lw, darken, type RiderDraft, type RiderProps } from "../../item-kit.tsx";

/* ---------- motion ---------- */
const N = 8;
const TAU = Math.PI * 2;
const CX = 56; // the brush tilts round the seat
const CY = 70;
const idleDy = (f: number) => 2 * Math.sin((TAU * f) / N);
const idleAng = (f: number) => 1.2 * Math.cos((TAU * f) / N);
const moveDy = (t: number) => 3.5 * Math.sin(TAU * t);
const moveAng = (t: number) => 3.5 * Math.cos(TAU * t);

const dyOf = (anim: "idle" | "move", f: number) => (anim === "idle" ? idleDy(f) : moveDy(f / N));
const angOf = (anim: "idle" | "move", f: number) => (anim === "idle" ? idleAng(f) : moveAng(f / N));

/** The bristle tip (-4, 70) turned with the brush. */
/** The brush is drawn a little squat and stretched up to this (chunkier at town size). */
const SY = 1.18;
const TIP_X = -10;
const TIP_Y = 68.6;
const tipAt = (a: number): [number, number] => {
  const r = (a * Math.PI) / 180;
  const rx = TIP_X - CX;
  const ry = (TIP_Y - CY) * SY;
  return [CX + rx * Math.cos(r) - ry * Math.sin(r), CY + rx * Math.sin(r) + ry * Math.cos(r)];
};

/* ---------- a smooth ribbon (a brush stroke) along points with widths ---------- */
type P = [number, number];
const n1 = (v: number) => v.toFixed(1);
function smoothThrough(pts: P[]): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d;
}
function ribbon(pts: P[], w: number[]): string {
  const top: P[] = [];
  const bot: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const nx = -ty;
    const ny = tx;
    top.push([pts[i][0] + (nx * w[i]) / 2, pts[i][1] + (ny * w[i]) / 2]);
    bot.push([pts[i][0] - (nx * w[i]) / 2, pts[i][1] - (ny * w[i]) / 2]);
  }
  const last = pts.length - 1;
  // round-ish caps: a quadratic past each end
  const capEnd = (i: number, j: number): P => {
    const dx = pts[i][0] - pts[j][0];
    const dy = pts[i][1] - pts[j][1];
    const l = Math.hypot(dx, dy) || 1;
    return [pts[i][0] + (dx / l) * w[i] * 0.9, pts[i][1] + (dy / l) * w[i] * 0.9];
  };
  const ce = capEnd(last, last - 1);
  const cs = capEnd(0, 1);
  const rb = [...bot].reverse();
  return (
    `M ${n1(top[0][0])} ${n1(top[0][1])}` +
    smoothThrough(top) +
    ` Q ${n1(ce[0])} ${n1(ce[1])} ${n1(rb[0][0])} ${n1(rb[0][1])}` +
    smoothThrough(rb) +
    ` Q ${n1(cs[0])} ${n1(cs[1])} ${n1(top[0][0])} ${n1(top[0][1])} Z`
  );
}

/* ---------- the brush's fixed parts ---------- */
const WOOD = "#c98d4e";
const WOOD_HI = "#f0c78f";
const WOOD_DK = "#9a6232";
const METAL = "#c4c9d2";
const METAL_HI = "#f2f4f7";
const METAL_DK = "#868d99";
const HAIR = "#2f2b35";
const HAIR_HI = "#6e6878";
const PAD = "#7d3c98";
const PAD_HI = "#a865c4";

const HANDLE =
  "M 35 64.4 C 50 63 62 63 74 64.2 L 103.5 65.6 C 108.5 65.6 111 67.6 111 70 C 111 72.4 108.5 74.4 103.5 74.4 L 74 75.8 C 62 77 50 77 35 75.6 Z";
const FERRULE = "M 22 61.4 Q 21 61.4 21 62.6 L 21 77.4 Q 21 78.6 22 78.6 L 36 76.4 L 36 63.6 Z";
const BRISTLES =
  "M 21 62.2 C 13 59.6 5 59.8 0 62.8 C -4 65 -7.6 67.4 -10 68.6 C -7.4 70.8 -4 73.8 0 76 C 5 79.2 13 80 21 77.8 Z";
/** The dipped part: everything left of a wavy line, clipped to the bristles. */
const TIP = "M 7.5 52 C 5 57 8.5 60.5 6 64.5 C 4 68.5 8 72 5.5 75.5 C 4.5 78.5 6.5 83 7 88 L -16 88 L -16 52 Z";
const SEAT =
  "M 41 65.4 C 41 62.6 43 62 46 62.2 C 55 63 64 63 72 62.2 C 75 62 77 62.6 77 65.4 L 76.6 74.6 C 76.4 77 74.8 77.8 72 77.8 C 64 78.4 55 78.4 46.2 77.8 C 43.4 77.8 41.6 77 41.4 74.6 Z";

function Brush({ p }: RiderProps) {
  const clip = `${p.id}-bristle`;
  return (
    <g>
      {/* handle */}
      <path d={HANDLE} fill={WOOD} {...LINE} />
      <path d="M 79 66.8 L 102 67.8" fill="none" stroke={WOOD_HI} stroke-linecap="round" {...lw(2.2)} />
      <path d="M 38 66.6 L 41 66.4" fill="none" stroke={WOOD_HI} stroke-linecap="round" {...lw(2.2)} />
      <path d="M 84 72.4 L 102 71.8" fill="none" stroke={WOOD_DK} stroke-linecap="round" {...lw(1.3)} />
      {/* bristles: black hair, the tips dipped in the color */}
      <clipPath id={clip}>
        <path d={BRISTLES} />
      </clipPath>
      <path d={BRISTLES} fill={HAIR} />
      <g clip-path={`url(#${clip})`}>
        <path d="M 19 67.4 C 13 66.4 9 66.8 4 68" fill="none" stroke={HAIR_HI} stroke-linecap="round" {...lw(1.2)} />
        <path d="M 19 73.6 C 14 74.6 10 74.4 5 72.6" fill="none" stroke={HAIR_HI} stroke-linecap="round" {...lw(1.2)} />
        <path d="M 17.5 63.6 C 14 62.6 10.5 62.6 7.5 63.4" fill="none" stroke="#a7a1b1" stroke-linecap="round" {...lw(2)} />
        <Region
          p={p}
          name="tips"
          d={[TIP]}
          line={2.4}
          over={
            <>
              <path d="M 3 63.6 C -1 64.6 -4 66.4 -6.6 67.8" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-linecap="round" {...lw(1.6)} />
              <path d="M 3 76 C 0 75.4 -3 73.4 -5.4 71.4" fill="none" stroke="#000" stroke-opacity="0.18" stroke-linecap="round" {...lw(1.4)} />
            </>
          }
        />
      </g>
      <path d={BRISTLES} fill="none" {...LINE} />
      {/* the metal band */}
      <path d={FERRULE} fill={METAL} {...LINE} />
      <path d="M 23.5 64 L 34 65.2" fill="none" stroke={METAL_HI} stroke-linecap="round" {...lw(2.2)} />
      <path d="M 26.5 63 L 26.5 77.2 M 30.5 63.4 L 30.5 76.8" fill="none" stroke={METAL_DK} stroke-linecap="round" {...lw(1.3)} />
      {/* the seat pad (Smudgy's beret plum) */}
      <path d={SEAT} fill={PAD} {...LINE} />
      <path d="M 45 65.6 C 54 66.3 64 66.3 73 65.6" fill="none" stroke={PAD_HI} stroke-linecap="round" stroke-dasharray="2.4 2.6" {...lw(1.4)} />
      <path d="M 45 74.6 C 54 75.3 64 75.3 73 74.6" fill="none" stroke={darken(PAD, 0.3)} stroke-linecap="round" stroke-dasharray="2.4 2.6" {...lw(1.4)} />
    </g>
  );
}

/* ---------- the color it leaves ---------- */
function Stroke({ p, d, opacity, over }: { p: RiderProps["p"]; d: string; opacity?: number; over?: ComponentChildren }) {
  return (
    <g opacity={opacity ?? 1}>
      <Region p={p} name="trail" d={[d]} line={2} over={over} />
    </g>
  );
}
/** A line along the ribbon's middle, shifted `off` units across it. */
function alongLine(pts: P[], off: number, from = 1, to = pts.length - 2): string {
  const q: P[] = [];
  for (let i = from; i <= to; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    q.push([pts[i][0] - ((b[1] - a[1]) / l) * off, pts[i][1] + ((b[0] - a[0]) / l) * off]);
  }
  return `M ${n1(q[0][0])} ${n1(q[0][1])}` + smoothThrough(q);
}

const WISP: P[] = [
  [-7, 68.4],
  [-8.8, 66.4],
  [-8.8, 62.8],
  [-8, 59.6],
  [-5.2, 57.2],
  [-4.4, 53.4],
];
const WISP_W = [6, 5.6, 4.8, 4, 3, 2];
// per idle frame: [from, to] point indexes, lift, opacity (null: none)
const WISP_FRAMES: ([number, number, number, number] | null)[] = [
  null,
  null,
  [0, 2, 0, 1],
  [0, 3, 0, 1],
  [0, 5, 0, 0.95],
  [1, 5, -2, 0.7],
  [2, 5, -4, 0.4],
  null,
];

function Trail({ p, f }: { p: RiderProps["p"]; f: number }) {
  const t = f / N;
  const L = 27;
  const pts: P[] = [];
  const w: number[] = [];
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const s = -5 + ((L + 5) * i) / steps; // starts under the tips
    const tau = Math.max(0, s) / 100;
    const tp = t - tau;
    const [tx, ty] = tipAt(moveAng(tp));
    const x = (s < 0 ? -s : 0) + tx - 100 * tau;
    const y = ty + moveDy(tp) - moveDy(t);
    pts.push([x, y]);
    const u = Math.max(0, s) / L;
    w.push(8.6 * (1 - 0.35 * u * u) + 0.7 * Math.sin(u * 10));
  }
  const streaks = (
    <>
      <path d={alongLine(pts, -2.2, 2, steps - 1)} fill="none" stroke="#000" stroke-opacity="0.22" stroke-linecap="round" {...lw(1.3)} />
      <path d={alongLine(pts, 1.4, 3, steps - 2)} fill="none" stroke="#000" stroke-opacity="0.16" stroke-linecap="round" {...lw(1.1)} />
      <path d={alongLine(pts, 2.6, 1, steps - 3)} fill="none" stroke="#fff" stroke-opacity="0.5" stroke-linecap="round" {...lw(1.4)} />
    </>
  );
  const id = `${p.id}-trailfade`;
  const x0 = pts[0][0];
  const x1 = pts[pts.length - 1][0];
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1={x0 - 6} y1="0" x2={x1 - 3} y2="0">
          <stop offset="0" stop-color="#fff" />
          <stop offset="0.55" stop-color="#fff" stop-opacity="0.9" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <mask id={id} maskUnits="userSpaceOnUse" x="-60" y="30" width="120" height="80">
          <rect x="-60" y="30" width="120" height="80" fill={`url(#${id}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <Stroke p={p} d={ribbon(pts, w)} over={streaks} />
      </g>
    </g>
  );
}

function Shadow({ dy }: { dy: number }) {
  return <ellipse cx="54" cy={94 - dy} rx={40 + dy * 1.5} ry="3.6" fill="#000" opacity="0.18" />;
}

function Back(props: RiderProps) {
  const { p, f, anim } = props;
  const dy = dyOf(anim, f);
  const a = angOf(anim, f);
  const wf = anim === "idle" ? WISP_FRAMES[f % N] : null;
  return (
    <g>
      <Shadow dy={dy} />
      {anim === "move" && <Trail p={p} f={f} />}
      {wf && (
        <g transform={`rotate(${a.toFixed(2)} ${CX} ${CY}) translate(0 ${wf[2]})`}>
          <Stroke p={p} d={ribbon(WISP.slice(wf[0], wf[1] + 1), WISP_W.slice(wf[0], wf[1] + 1))} opacity={wf[3]} />
        </g>
      )}
    </g>
  );
}

function Front(props: RiderProps) {
  const a = angOf(props.anim, props.f);
  return (
    <g transform={`rotate(${a.toFixed(2)} ${CX} ${CY}) translate(0 ${CY}) scale(1 ${SY}) translate(0 ${-CY})`}>
      <Brush {...props} />
    </g>
  );
}

export const smudgyBrush: RiderDraft = {
  id: "smudgy-brush",
  name: "Brush Ride",
  tier: "mythic",
  description: "Smudgy's spare brush. It flies fine; it just won't stop signing its work in the air.",
  frame: [-13, 2, 127, 96],
  idle: { ms: Array(N).fill(230) },
  move: { ms: Array(N).fill(70) },
  pose: (anim, f) => {
    const a = angOf(anim, f);
    return {
      dx: anim === "move" ? (100 * f) / N : 0,
      dy: dyOf(anim, f),
      pawnX: 8,
      pawnY: -16,
      pawnTilt: anim === "move" ? a * 0.8 + 2 : a * 0.8,
      cut: 84,
    };
  },
  Back,
  Front,
};
