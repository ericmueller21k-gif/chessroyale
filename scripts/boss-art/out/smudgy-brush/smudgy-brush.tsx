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

/* ================= front and back views: the brush seen end-on ================= */
const VX = 50;
const VY = 72; // the brush rolls round the seat (the pawn's base)
const rollAt = (t: number) => 3 * Math.cos(TAU * t);
const swayAt = (t: number) => 2 * Math.sin(TAU * t);
const rollOf = (anim: "idle" | "move", f: number) => (anim === "idle" ? idleAng(f) * 0.8 : rollAt(f / N));
const swayOf = (anim: "idle" | "move", f: number) => (anim === "idle" ? 0 : swayAt(f / N));
function rotP(x: number, y: number, deg: number): P {
  const r = (deg * Math.PI) / 180;
  const dx = x - VX;
  const dy = y - VY;
  return [VX + dx * Math.cos(r) - dy * Math.sin(r), VY + dx * Math.sin(r) + dy * Math.cos(r)];
}
const rollT = (deg: number) => `rotate(${deg.toFixed(2)} ${VX} ${VY})`;
function wavyDisk(cx: number, cy: number, r: number, amp: number, waves: number, phase = 0): string {
  let d = "";
  const n = 48;
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n;
    const rr = r + amp * Math.sin(waves * a + phase);
    d += `${i ? " L" : "M"} ${n1(cx + rr * Math.cos(a))} ${n1(cy + rr * Math.sin(a))}`;
  }
  return d + " Z";
}
const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const p0: P = [cx + r * Math.cos((a0 * Math.PI) / 180), cy + r * Math.sin((a0 * Math.PI) / 180)];
  const p1: P = [cx + r * Math.cos((a1 * Math.PI) / 180), cy + r * Math.sin((a1 * Math.PI) / 180)];
  return `M ${n1(p0[0])} ${n1(p0[1])} A ${r} ${r} 0 0 1 ${n1(p1[0])} ${n1(p1[1])}`;
};

function VShadow({ dy }: { dy: number }) {
  return <ellipse cx="50" cy={94 - dy} rx={27 + dy} ry="3.6" fill="#000" opacity="0.18" />;
}

/** The seat pad seen end-on (the same plum, the same stitching). */
const V_PAD =
  "M 24 64.2 C 24 61.6 25.6 60.6 28.4 60.7 C 40 61.5 60 61.5 71.6 60.7 C 74.4 60.6 76 61.6 76 64.2 L 75.6 75.6 C 75.4 78.2 73.8 79.3 71 79.3 C 60 80 40 80 29 79.3 C 26.2 79.3 24.6 78.2 24.4 75.6 Z";
function VPad() {
  return (
    <g>
      <path d={V_PAD} fill={PAD} {...LINE} />
      <path d="M 28.5 65 C 40 65.8 60 65.8 71.5 65" fill="none" stroke={PAD_HI} stroke-linecap="round" stroke-dasharray="2.4 2.6" {...lw(1.4)} />
      <path d="M 28.5 75.4 C 40 76.2 60 76.2 71.5 75.4" fill="none" stroke={darken(PAD, 0.3)} stroke-linecap="round" stroke-dasharray="2.4 2.6" {...lw(1.4)} />
    </g>
  );
}

/* --- back view: the bristle end toward us --- */
const B_BUNDLE_C: P = [50, 79.5];
const B_BUNDLE_R = 13;
const B_TIP_C: P = [50, 83];
const B_BUNDLE = `M ${B_BUNDLE_C[0] - B_BUNDLE_R} ${B_BUNDLE_C[1]} A ${B_BUNDLE_R} ${B_BUNDLE_R} 0 1 0 ${B_BUNDLE_C[0] + B_BUNDLE_R} ${B_BUNDLE_C[1]} A ${B_BUNDLE_R} ${B_BUNDLE_R} 0 1 0 ${B_BUNDLE_C[0] - B_BUNDLE_R} ${B_BUNDLE_C[1]} Z`;
const B_TIP = wavyDisk(B_TIP_C[0], B_TIP_C[1], 7.6, 0.8, 7, 0.4);

function BristleEnd({ p }: { p: RiderProps["p"] }) {
  const clip = `${p.id}-vbundle`;
  const hairs: string[] = [];
  for (let i = 0; i < 9; i++) {
    const a = ((i + 0.5) * TAU) / 9 + 0.2;
    hairs.push(
      `M ${n1(B_TIP_C[0] + 9 * Math.cos(a))} ${n1(B_TIP_C[1] + 9 * Math.sin(a))} L ${n1(B_TIP_C[0] + 16 * Math.cos(a))} ${n1(B_TIP_C[1] + 16 * Math.sin(a))}`,
    );
  }
  return (
    <g>
      {/* the silver band, its top showing over the tuft */}
      <circle cx="50" cy="73.5" r="12" fill={METAL} {...LINE} />
      <path d={arcPath(50, 76.4, 12.4, 224, 316)} fill="none" stroke={METAL_DK} stroke-linecap="round" {...lw(1.3)} />
      <path d={arcPath(50, 73.5, 10, 214, 248)} fill="none" stroke={METAL_HI} stroke-linecap="round" {...lw(2)} />
      {/* the black tuft, its dipped tips at the middle */}
      <clipPath id={clip}>
        <path d={B_BUNDLE} />
      </clipPath>
      <path d={B_BUNDLE} fill={HAIR} />
      <g clip-path={`url(#${clip})`}>
        <path d={hairs.join(" ")} fill="none" stroke={HAIR_HI} stroke-linecap="round" {...lw(1.2)} />
        <path d={arcPath(50, 79.5, 10.6, 196, 246)} fill="none" stroke="#a7a1b1" stroke-linecap="round" {...lw(2)} />
      </g>
      <path d={B_BUNDLE} fill="none" {...LINE} />
      <Region
        p={p}
        name="tips"
        d={[B_TIP]}
        line={2.4}
        over={
          <>
            <path d={arcPath(50, 83, 4.8, 200, 255)} fill="none" stroke="#fff" stroke-opacity="0.6" stroke-linecap="round" {...lw(1.6)} />
            <path d={arcPath(50, 83, 5.4, 20, 110)} fill="none" stroke="#000" stroke-opacity="0.18" stroke-linecap="round" {...lw(1.4)} />
          </>
        }
      />
    </g>
  );
}

/* --- front view: the handle end toward us, the bristles beyond --- */
/** The far tuft, splayed: its dark middle behind the pawn, its dipped ends out to the left and right. */
const F_TUFT = "M 13 50.5 C 22 42 38 39.5 50 39.5 C 62 39.5 78 42 87 50.5 C 78 59 62 61.5 50 61.5 C 38 61.5 22 59 13 50.5 Z";
const F_TIP_L = "M 26.5 30 C 23.5 36 27.5 40 25 44.5 C 23 48.5 27 52.5 24.5 56.5 C 23 60.5 25.5 64 26 70 L 0 70 L 0 30 Z";
const mirrorX = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${100 - Number(x)} ${y}`);
const F_TUFT_TIP = [F_TIP_L, mirrorX(F_TIP_L)];
function FarTuft({ p }: { p: RiderProps["p"] }) {
  const clip = `${p.id}-vtuft`;
  return (
    <g>
      <clipPath id={clip}>
        <path d={F_TUFT} />
      </clipPath>
      <path d={F_TUFT} fill={HAIR} />
      <g clip-path={`url(#${clip})`}>
        <path d="M 46 47.5 C 40 47 35 47.6 30 49 M 54 47.5 C 60 47 65 47.6 70 49 M 46 54.5 C 40 55 35 54.4 31 52.6 M 54 54.5 C 60 55 65 54.4 69 52.6" fill="none" stroke={HAIR_HI} stroke-linecap="round" {...lw(1.2)} />
        <path d="M 46 43 C 41 43 37 43.6 33.5 44.6" fill="none" stroke="#a7a1b1" stroke-linecap="round" {...lw(2)} />
        <Region
          p={p}
          name="tips"
          d={F_TUFT_TIP}
          line={2.4}
          over={
            <>
              <path d="M 28.5 45.4 C 25 46.6 22.4 48 20.6 49.6 M 71.5 45.4 C 75 46.6 77.6 48 79.4 49.6" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-linecap="round" {...lw(1.6)} />
              <path d="M 28 56 C 25 55 22.6 53.6 21 51.6 M 72 56 C 75 55 77.4 53.6 79 51.6" fill="none" stroke="#000" stroke-opacity="0.18" stroke-linecap="round" {...lw(1.4)} />
            </>
          }
        />
      </g>
      <path d={F_TUFT} fill="none" {...LINE} />
      {/* the silver band (mostly behind the pawn) */}
      <path d="M 39 56.5 Q 39 55 40.5 55 L 59.5 55 Q 61 55 61 56.5 L 61 63 L 39 63 Z" fill={METAL} {...LINE} />
    </g>
  );
}
function NearHandle() {
  return (
    <g>
      <ellipse cx="50" cy="68.4" rx="7.4" ry="3" fill={darken(PAD, 0.45)} />
      <path d="M 43.4 68.4 C 43.4 66.6 56.6 66.6 56.6 68.4 L 56.2 84 L 43.8 84 Z" fill={WOOD} {...LINE} />
      <path d="M 46.6 70.6 L 46.6 80.5" fill="none" stroke={WOOD_HI} stroke-linecap="round" {...lw(2.2)} />
      <path d="M 54 72 L 54 80" fill="none" stroke={WOOD_DK} stroke-linecap="round" {...lw(1.3)} />
      <ellipse cx="50" cy="84" rx="6.4" ry="5.6" fill={WOOD} {...LINE} />
      <ellipse cx="50" cy="84.2" rx="3.4" ry="2.8" fill="none" stroke={WOOD_DK} {...lw(1.3)} />
      <path d={arcPath(50, 84, 4.6, 200, 250)} fill="none" stroke={WOOD_HI} stroke-linecap="round" {...lw(1.6)} />
    </g>
  );
}

/* --- the color it leaves, seen end-on --- */
function EndTrail({ p, f, view }: { p: RiderProps["p"]; f: number; view: "front" | "back" }) {
  const t = f / N;
  const back = view === "back";
  const L = 27;
  const steps = 9;
  const tip: P = back ? B_TIP_C : [50, 34];
  const dir = back ? 1 : -1; // back: the trail comes toward us (down); front: it runs away (up)
  const k = back ? 0.4 : 0.62;
  const gain = back ? 3.2 : 4.5; // swung a little wide so it reads as a stroke, not a drip
  const cur = rotP(tip[0], tip[1], rollAt(t));
  const pts: P[] = [];
  const w: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = -4 + ((L + 4) * i) / steps;
    const tau = Math.max(0, s) / 100;
    const tp = t - tau;
    const past = rotP(tip[0], tip[1], rollAt(tp));
    const x = cur[0] + gain * (past[0] - cur[0] + swayAt(tp) - swayAt(t));
    const y = past[1] + dir * k * s + moveDy(tp) - moveDy(t);
    pts.push([x, y]);
    const u = Math.max(0, s) / L;
    w.push((back ? 7.4 * (1 + 0.3 * u) : 7.4 * (1 - 0.3 * u)) * (1 - 0.35 * u * u) + 0.6 * Math.sin(u * 10));
  }
  const streaks = (
    <>
      <path d={alongLine(pts, -2, 2, steps - 1)} fill="none" stroke="#000" stroke-opacity="0.22" stroke-linecap="round" {...lw(1.3)} />
      <path d={alongLine(pts, 2.2, 1, steps - 3)} fill="none" stroke="#fff" stroke-opacity="0.5" stroke-linecap="round" {...lw(1.4)} />
    </>
  );
  const id = `${p.id}-vtrail-${view}`;
  const y0 = pts[0][1];
  const y1 = pts[pts.length - 1][1];
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1={y0 - dir * 4} x2="0" y2={y1 - dir * 2}>
          <stop offset="0" stop-color="#fff" />
          <stop offset="0.55" stop-color="#fff" stop-opacity="0.9" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <mask id={id} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
          <rect x="-10" y="-10" width="120" height="120" fill={`url(#${id}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <Stroke p={p} d={ribbon(pts, w)} over={streaks} />
      </g>
    </g>
  );
}

/** Front view: the broad stroke the splayed tuft leaves, running away up behind the pawn (its edges show past it). */
function FrontTrail({ p, f }: { p: RiderProps["p"]; f: number }) {
  const t = f / N;
  const steps = 8;
  const L = 22;
  const left: P[] = [];
  const right: P[] = [];
  const mid: P[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = (L * i) / steps;
    const tp = t - s / 100;
    const u = s / L;
    // the stroke bends with where the brush was: its sway and roll, and the swoop's dip
    const cx = 50 + 2.2 * (swayAt(tp) - swayAt(t)) + 0.9 * (rollAt(tp) - rollAt(t));
    const cy = 50 - 0.6 * s + moveDy(tp) - moveDy(t);
    const hw = 29.5 * (1 - 0.34 * u) + 0.6 * Math.sin(u * 9);
    mid.push([cx, cy]);
    left.push([cx - hw, cy]);
    right.push([cx + hw, cy]);
  }
  const lt = left[steps];
  const rt = right[steps];
  const top = mid[steps];
  const d =
    `M ${n1(left[0][0])} ${n1(left[0][1])}` +
    smoothThrough(left) +
    ` C ${n1(lt[0])} ${n1(lt[1] - 5)} ${n1(top[0] - 8)} ${n1(top[1] - 4)} ${n1(top[0])} ${n1(top[1] - 4)}` +
    ` C ${n1(top[0] + 8)} ${n1(top[1] - 4)} ${n1(rt[0])} ${n1(rt[1] - 5)} ${n1(rt[0])} ${n1(rt[1])}` +
    smoothThrough([...right].reverse()) +
    " Z";
  const edge = (side: P[], off: number) => {
    const q = side.slice(1, steps).map(([x, y]): P => [x + off, y]);
    return `M ${n1(q[0][0])} ${n1(q[0][1])}` + smoothThrough(q);
  };
  const streaks = (
    <>
      <path d={edge(left, 3) + " " + edge(right, -5)} fill="none" stroke="#000" stroke-opacity="0.2" stroke-linecap="round" {...lw(1.3)} />
      <path d={edge(left, 6.5) + " " + edge(right, -2.6)} fill="none" stroke="#fff" stroke-opacity="0.5" stroke-linecap="round" {...lw(1.4)} />
    </>
  );
  const id = `${p.id}-vtrail-front`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="46" x2="0" y2={top[1] - 4}>
          <stop offset="0" stop-color="#fff" />
          <stop offset="0.45" stop-color="#fff" stop-opacity="0.85" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <mask id={id} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
          <rect x="-10" y="-10" width="120" height="120" fill={`url(#${id}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <Stroke p={p} d={d} over={streaks} />
      </g>
    </g>
  );
}

/** The idle wisp curling up out of the tips, placed for each end-on view. */
function EndWisp({ p, f, view }: { p: RiderProps["p"]; f: number; view: "front" | "back" }) {
  const wf = WISP_FRAMES[f % N];
  if (!wf) return null;
  const map = (q: P): P => (view === "back" ? [q[0] + 57, q[1] + 14.6] : [10 - q[0], q[1] - 19.4]);
  const pts = WISP.slice(wf[0], wf[1] + 1).map(map);
  return (
    <g transform={`translate(0 ${wf[2]})`}>
      <Stroke p={p} d={ribbon(pts, WISP_W.slice(wf[0], wf[1] + 1))} opacity={wf[3]} />
    </g>
  );
}

const endPose = (anim: "idle" | "move", f: number): RiderPose => ({
  dx: swayOf(anim, f),
  dy: dyOf(anim, f),
  pawnX: 0,
  pawnY: -16,
  pawnTilt: rollOf(anim, f) * 0.8,
  cut: 84,
});

const backView = {
  frame: [20, 2, 60, 96] as [number, number, number, number],
  idle: { ms: Array(N).fill(230) },
  move: { ms: Array(N).fill(70) },
  pose: endPose,
  Back: ({ anim, f }: RiderProps) => {
    const a = rollOf(anim, f);
    return (
      <g>
        <VShadow dy={dyOf(anim, f)} />
        {/* the handle running away from us, behind the pawn */}
        <g transform={rollT(a)}>
          <path d="M 44 66 L 45.4 46 C 45.6 42.4 54.4 42.4 54.6 46 L 56 66 Z" fill={WOOD} {...LINE} />
        </g>
      </g>
    );
  },
  Front: ({ p, anim, f }: RiderProps) => {
    const a = rollOf(anim, f);
    return (
      <g>
        <g transform={rollT(a)}>
          <VPad />
          <BristleEnd p={p} />
          {anim === "idle" && <EndWisp p={p} f={f} view="back" />}
        </g>
        {anim === "move" && <EndTrail p={p} f={f} view="back" />}
      </g>
    );
  },
};

const frontView = {
  frame: [20, 2, 60, 96] as [number, number, number, number],
  idle: { ms: Array(N).fill(230) },
  move: { ms: Array(N).fill(70) },
  pose: endPose,
  Back: ({ p, anim, f }: RiderProps) => {
    const a = rollOf(anim, f);
    return (
      <g>
        <VShadow dy={dyOf(anim, f)} />
        {anim === "move" && <FrontTrail p={p} f={f} />}
        <g transform={rollT(a)}>
          {anim === "idle" && <EndWisp p={p} f={f} view="front" />}
          <FarTuft p={p} />
        </g>
      </g>
    );
  },
  Front: ({ anim, f }: RiderProps) => {
    const a = rollOf(anim, f);
    return (
      <g transform={rollT(a)}>
        <VPad />
        <NearHandle />
      </g>
    );
  },
};

type RiderPose = ReturnType<RiderDraft["pose"]>;

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
  views: { front: frontView, back: backView },
};
