import { Region, LINE, lw, darken, type RiderDraft, type RiderProps, type Paint, type RiderViewDraft, type TrailProps } from "../../item-kit.tsx";

// Fixed colors: Birdie's train.
const ROOF = "#34303f";
const ROOF_HI = "#5a546b";
const STRIPE = "#d8343a";
const TRUCK = "#8c929c";
const WHEEL = "#5b606b";
const HUB = "#c9ced6";
const LENS = "#fff7cf";
const GLOW = "#ffe97a";
const PUFF = "#f6f6f4";

const IDLE_N = 12;
const MOVE_N = 10;
const R_WHEEL = 8.5;
// The pivot the body rocks round (the rails, between the trucks).
const PIV: [number, number] = [56, 86];
const PAWN_BASE: [number, number] = [36, 78];

/** Where the move is at frame f (0..1 of the square): a soft start and a soft stop. */
const moveS = (f: number) => {
  const t = f / MOVE_N;
  return t - (0.4 * Math.sin(2 * Math.PI * t)) / (2 * Math.PI);
};

/** The body's bob (dy) and tilt (deg) per frame. */
function bodyRock(anim: "idle" | "move", f: number): { bob: number; tilt: number } {
  if (anim === "idle") {
    const a = (f / IDLE_N) * 2 * Math.PI;
    return { bob: 0.7 * (1 - Math.cos(a)) * 0.5 + 0.35 * (1 - Math.cos(2 * a)) * 0.5, tilt: 0.6 * Math.sin(a) };
  }
  const t = f / MOVE_N;
  return { bob: -0.7 * Math.abs(Math.sin(3 * Math.PI * t)), tilt: -1.6 * Math.sin(2 * Math.PI * t) };
}

function pose(anim: "idle" | "move", f: number) {
  const { bob, tilt } = bodyRock(anim, f);
  const th = (tilt * Math.PI) / 180;
  const ox = PAWN_BASE[0] - PIV[0];
  const oy = PAWN_BASE[1] - PIV[1];
  const x2 = PIV[0] + ox * Math.cos(th) - oy * Math.sin(th);
  const y2 = PIV[1] + ox * Math.sin(th) + oy * Math.cos(th);
  return {
    dx: anim === "move" ? 100 * moveS(f) : 0,
    dy: 0,
    pawnX: -14 + (x2 - PAWN_BASE[0]),
    pawnY: -10 + (y2 - PAWN_BASE[1]) + bob,
    pawnTilt: tilt,
    cut: 66,
  };
}

function wheelAngle(anim: "idle" | "move", f: number) {
  if (anim === "idle") return -40;
  // Two whole turns a square (about the wheel's own roll), so the next move picks up where this one ends.
  return -40 + 720 * moveS(f);
}

function Wheel({ cx, cy, a }: { cx: number; cy: number; a: number }) {
  const r = (a * Math.PI) / 180;
  const cw = (a + 180) * (Math.PI / 180);
  const px = cx + 4 * Math.cos(r);
  const py = cy + 4 * Math.sin(r);
  const wx = cx + 3.6 * Math.cos(cw);
  const wy = cy + 3.6 * Math.sin(cw);
  return (
    <g>
      <circle cx={cx} cy={cy} r={R_WHEEL} fill={WHEEL} {...LINE} {...lw(2.4)} />
      <circle cx={cx} cy={cy} r={5.8} fill="#80858f" />
      {/* counterweight */}
      <circle cx={wx} cy={wy} r={2.8} fill="#41454e" />
      <circle cx={cx} cy={cy} r={1.6} fill={HUB} {...LINE} {...lw(1)} />
      <circle cx={px} cy={py} r={1.8} fill={HUB} {...LINE} {...lw(1)} />
    </g>
  );
}

function Truck({ x1, x2, a }: { x1: number; x2: number; a: number }) {
  const cy = 89;
  const r = (a * Math.PI) / 180;
  const ddx = 4 * Math.cos(r);
  const ddy = 4 * Math.sin(r);
  return (
    <g>
      <path d={`M${x1 - 10} 81 L${x2 + 10} 81 Q${x2 + 12} 81 ${x2 + 12} 84 L${x2 + 12} 87 Q${x2 + 12} 90 ${x2 + 9} 90 L${x1 - 9} 90 Q${x1 - 12} 90 ${x1 - 12} 87 L${x1 - 12} 84 Q${x1 - 12} 81 ${x1 - 10} 81 Z`} fill={TRUCK} {...LINE} {...lw(2.4)} />
      <path d={`M${(x1 + x2) / 2 - 3} 82 L${(x1 + x2) / 2 + 3} 82 L${(x1 + x2) / 2 + 3} 88 L${(x1 + x2) / 2 - 3} 88 Z`} fill="#6e737d" {...LINE} {...lw(1.4)} />
      <Wheel cx={x1} cy={cy} a={a} />
      <Wheel cx={x2} cy={cy} a={a} />
      {/* side rod */}
      <path d={`M${x1 + ddx} ${cy + ddy} L${x2 + ddx} ${cy + ddy}`} stroke="#1d1d1f" stroke-linecap="round" {...lw(4)} />
      <path d={`M${x1 + ddx} ${cy + ddy} L${x2 + ddx} ${cy + ddy}`} stroke={HUB} stroke-linecap="round" {...lw(1.8)} />
    </g>
  );
}

function Puff({ x, y, k, n }: { x: number; y: number; k: number; n: number }) {
  // k: 0..n-1, rising and fading
  const t = k / Math.max(1, n - 1);
  const s = 4.2 + t * 4;
  const op = 1 - t * 0.8;
  return (
    <g opacity={op}>
      <circle cx={x - s * 0.6} cy={y + s * 0.2} r={s * 0.75} fill={PUFF} {...LINE} {...lw(1.4)} />
      <circle cx={x + s * 0.55} cy={y + s * 0.15} r={s * 0.7} fill={PUFF} {...LINE} {...lw(1.4)} />
      <circle cx={x} cy={y - s * 0.25} r={s} fill={PUFF} {...LINE} {...lw(1.4)} />
      <circle cx={x - s * 0.6} cy={y + s * 0.2} r={s * 0.75 - 0.8} fill={PUFF} />
      <circle cx={x + s * 0.55} cy={y + s * 0.15} r={s * 0.7 - 0.8} fill={PUFF} />
      <circle cx={x - s * 0.25} cy={y - s * 0.45} r={s * 0.35} fill="#fff" />
    </g>
  );
}

const CAB_WALL = "M7 55 L66 55 L66 79 L10 79 Q3 79 3 72 L3 59 Q3 55 7 55 Z";
const HOOD = "M66 42 L88 42 Q111 42 111 65 L111 79 L66 79 Z";
const BACK_POST = "M6 5 L12 5 L12 56 L6 56 Z";
const FRONT_POST = "M58 5 L64 5 L72 43 L66 43 Z";
const FAR_WALL = "M9 50 L61 50 L61 57 L9 57 Z";
const ROOF_D = "M-3 7 Q-3 0 3 -1 Q36 -6 69 -1 Q75 0 75 7 Z";
const STRIPE_D = "M3 64 L91 64 Q106 64 109.5 76 L110 79 L104.5 79 Q101.5 69 90 69 L3 69 Z";

function Body({ p, anim, f }: { p: Paint; anim: "idle" | "move"; f: number }) {
  const glow = anim === "idle" ? 0.35 + 0.25 * Math.sin((f / IDLE_N) * 2 * Math.PI) : 0.55;
  return (
    <g>
      {/* footplate */}
      <path d="M1 77 L113 77 L113 83 L1 83 Z" fill="#3b3f48" {...LINE} {...lw(2.4)} />
      {/* cowcatcher */}
      <path d="M107 81 L116 81 L111 89 L104 89 Z" fill={TRUCK} {...LINE} {...lw(2)} />
      {/* exhaust stack */}
      <path d="M75 43 L75 34 L82 34 L82 43 Z" fill={ROOF} {...LINE} {...lw(2.4)} />
      <path d="M73.5 34 L83.5 34 L83.5 31 L73.5 31 Z" fill={ROOF} {...LINE} {...lw(2.4)} />
      <Region p={p} name="hood" d={[HOOD]} />
      <Region p={p} name="cab" d={[CAB_WALL]} />
      <Region p={p} name="backpost" d={[BACK_POST]} line={2.4} />
      <Region p={p} name="frontpost" d={[FRONT_POST]} line={2.4} />
      {/* glass in the windshield, seen edge-on */}
      <path d="M64.5 8 L70.5 40" stroke="#bfe6f5" stroke-linecap="round" {...lw(1.2)} opacity="0.9" />
      {/* hood side doors */}
      <path d="M80 49 L80 60 M92 49 L92 60" stroke="#1d1d1f" stroke-linecap="round" opacity="0.3" {...lw(1.6)} />
      {/* highlights */}
      <path d="M8 58.5 L62 58.5" stroke="#fff" stroke-linecap="round" opacity="0.5" {...lw(2)} />
      <path d="M70 45.5 L87 45.5 Q100 46 104 52" fill="none" stroke="#fff" stroke-linecap="round" opacity="0.55" {...lw(2)} />
      {/* red stripe */}
      <path d={STRIPE_D} fill={STRIPE} {...LINE} {...lw(1.6)} />
      {/* headlights: glow, lens */}
      <circle cx={103} cy={48} r={8.5} fill={GLOW} opacity={glow * 0.6} />
      <circle cx={111} cy={71} r={7} fill={GLOW} opacity={glow * 0.6} />
      <circle cx={103} cy={48} r={4.4} fill={LENS} {...LINE} {...lw(2.2)} />
      <circle cx={111} cy={71} r={3.5} fill={LENS} {...LINE} {...lw(2)} />
      <circle cx={101.7} cy={46.7} r={1.3} fill="#fff" />
      {/* roof */}
      <path d={ROOF_D} fill={ROOF} {...LINE} />
      <path d="M3 2.5 Q36 -2 69 2.5" fill="none" stroke={ROOF_HI} stroke-linecap="round" {...lw(1.8)} />
    </g>
  );
}

function rockT(anim: "idle" | "move", f: number) {
  const { bob, tilt } = bodyRock(anim, f);
  return `translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} ${PIV[0]} ${PIV[1]})`;
}

function SideBack({ p, anim, f }: RiderProps) {
  return (
    <g transform={rockT(anim, f)}>
      <Region p={p} name="farwall" d={[FAR_WALL]} fill={darken(p.hex, 0.3)} line={2.4} />
    </g>
  );
}

function SideFront({ p, anim, f }: RiderProps) {
  const a = wheelAngle(anim, f);
  let puff: [number, number, number, number] | null = null;
  if (anim === "idle" && f >= 6) {
    const k = f - 6;
    puff = [79 - k * 0.8, 26 - k * 3.6, k, 6];
  }
  if (anim === "move" && f <= 4) {
    puff = [79 - f * 3.5, 26 - f * 3.6, f, 5];
  }
  return (
    <g>
      <Truck x1={19} x2={38} a={a} />
      <Truck x1={77} x2={96} a={a} />
      <g transform={rockT(anim, f)}>
        <Body p={p} anim={anim} f={f} />
        {puff && <Puff x={puff[0]} y={puff[1]} k={puff[2]} n={puff[3]} />}
      </g>
    </g>
  );
}

// ---------- Front and back views (end-on) ----------

// The pivot the body sways round, end-on (between the rails).
const E_PIV: [number, number] = [50, 88];

/** End-on: the side's bob, and its rock turned into a small side-to-side roll. */
function endRock(anim: "idle" | "move", f: number) {
  const { bob, tilt } = bodyRock(anim, f);
  return { bob, roll: anim === "move" ? tilt * 0.8 : tilt };
}

function endPose(anim: "idle" | "move", f: number) {
  const { bob, roll } = endRock(anim, f);
  const th = (roll * Math.PI) / 180;
  // the pawn's base (50, 78) turned round the pivot with the body
  const x2 = E_PIV[0] + 10 * Math.sin(th);
  const y2 = E_PIV[1] - 10 * Math.cos(th);
  return { dx: 0, dy: 0, pawnX: x2 - 50, pawnY: -10 + (y2 - 78) + bob, pawnTilt: roll, cut: 66 };
}

function endT(anim: "idle" | "move", f: number) {
  const { bob, roll } = endRock(anim, f);
  return `translate(0 ${bob.toFixed(2)}) rotate(${roll.toFixed(2)} ${E_PIV[0]} ${E_PIV[1]})`;
}

function lampGlow(anim: "idle" | "move", f: number) {
  return anim === "idle" ? 0.35 + 0.25 * Math.sin((f / IDLE_N) * 2 * Math.PI) : 0.5 + 0.3 * Math.sin((f / MOVE_N) * 2 * Math.PI);
}

/** The ground shadow: shrinks a little as the body rises. */
function Shadow({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const { bob } = endRock(anim, f);
  const k = 1 + bob * 0.06;
  return <ellipse cx={50} cy={97} rx={37 * k} ry={3.4 * k} fill="#000" opacity={0.2} />;
}

/** A wheel seen edge-on: its tread ticks roll past, the crank pin on its outer face rises and falls. */
function EndWheel({ x, a, out }: { x: number; a: number; out: number }) {
  const ticks = [0, 90, 180, 270]
    .map((k) => ((a + k) * Math.PI) / 180)
    .filter((t) => Math.cos(t) > 0.15)
    .map((t) => 89 + 7 * Math.sin(t));
  const r = (a * Math.PI) / 180;
  const py = 89 + 4 * Math.sin(r);
  return (
    <g>
      <rect x={x - 3.8} y={80.5} width={7.6} height={17} rx={3.2} fill={WHEEL} {...LINE} {...lw(2.4)} />
      {ticks.map((y) => (
        <path d={`M${x - 2} ${y.toFixed(2)} L${x + 2} ${y.toFixed(2)}`} stroke="#9aa0aa" stroke-linecap="round" {...lw(1.4)} />
      ))}
      <circle cx={x + out * 4.4} cy={py} r={1.9} fill={HUB} {...LINE} {...lw(1)} />
    </g>
  );
}

function EndTrucks({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const a = wheelAngle(anim, f);
  return (
    <g>
      <path d="M24 82 L76 82 Q79 82 79 85 L79 87 Q79 90 76 90 L24 90 Q21 90 21 87 L21 85 Q21 82 24 82 Z" fill={TRUCK} {...LINE} {...lw(2.4)} />
      <path d="M30 83.5 L36 83.5 L36 88.5 L30 88.5 Z M64 83.5 L70 83.5 L70 88.5 L64 88.5 Z" fill="#6e737d" {...LINE} {...lw(1.4)} />
      <EndWheel x={17} a={a} out={-1} />
      <EndWheel x={83} a={a} out={1} />
    </g>
  );
}

const E_ROOF = "M11 7 Q11 0 17 -1 Q50 -8 83 -1 Q89 0 89 7 Z";
const E_FOOT = "M13 77 L87 77 L87 83 L13 83 Z";

function Roof() {
  return (
    <g>
      <path d={E_ROOF} fill={ROOF} {...LINE} />
      <path d="M17 2.5 Q50 -3.5 83 2.5" fill="none" stroke={ROOF_HI} stroke-linecap="round" {...lw(1.8)} />
    </g>
  );
}

/** The puff from the stack, seen end-on: it rises and drifts off to one side. */
function endPuff(anim: "idle" | "move", f: number, x0: number, y0: number): [number, number, number, number] | null {
  if (anim === "idle" && f >= 6) {
    const k = f - 6;
    return [x0 + k * 2.6, y0 - k * 3.4, k, 6];
  }
  if (anim === "move" && f <= 4) return [x0 + f * 3.6, y0 - f * 3.6, f, 5];
  return null;
}

// --- back view: the cab's back wall, the pawn seen from behind in the open cab ---
const B_WALL = "M22 55 L78 55 Q82 55 82 59 L82 72 Q82 79 75 79 L25 79 Q18 79 18 72 L18 59 Q18 55 22 55 Z";
const B_POSTS = ["M18 5 L24 5 L24 56 L18 56 Z", "M76 5 L82 5 L82 56 L76 56 Z"];
const B_FPOSTS = ["M22 6 L27 6 L27 42 L22 42 Z", "M73 6 L78 6 L78 42 L73 42 Z"];
const B_FAR = "M24 41 L76 41 L76 50 L24 50 Z";

function BackBack({ p, anim, f }: RiderProps) {
  const puff = endPuff(anim, f, 57, 29);
  return (
    <g>
      <Shadow anim={anim} f={f} />
      <g transform={endT(anim, f)}>
        {/* the cab floor, seen from above */}
        <path d="M21 49 L79 49 L79 57 L21 57 Z" fill="#2a2730" {...LINE} {...lw(2)} />
        {/* the windshield beyond, and the cab's front wall inside */}
        <path d="M27 7 L73 7 L73 42 L27 42 Z" fill="#bfe6f5" opacity={0.18} />
        <path d="M31 11 L36 8 M66 38 L71 34" stroke="#fff" stroke-linecap="round" opacity={0.6} {...lw(1.4)} />
        <Region p={p} name="farwall" d={[B_FAR]} fill={darken(p.hex, 0.3)} line={2.4} />
        <Region p={p} name="frontpost" d={B_FPOSTS} fill={darken(p.hex, 0.12)} line={2.2} />
        {puff && <Puff x={puff[0]} y={puff[1]} k={puff[2]} n={puff[3]} />}
      </g>
    </g>
  );
}

function BackFront({ p, anim, f }: RiderProps) {
  const g = lampGlow(anim, f);
  return (
    <g>
      <EndTrucks anim={anim} f={f} />
      <g transform={endT(anim, f)}>
        <path d={E_FOOT} fill="#3b3f48" {...LINE} {...lw(2.4)} />
        {/* coupler */}
        <path d="M45 80 L55 80 L55 87 L45 87 Z" fill={TRUCK} {...LINE} {...lw(2)} />
        <Region p={p} name="cab" d={[B_WALL]} />
        <Region p={p} name="backpost" d={B_POSTS} line={2.4} />
        {/* highlights: the wall's top edge */}
        <path d="M26 58.5 L74 58.5" stroke="#fff" stroke-linecap="round" opacity="0.5" {...lw(2)} />
        {/* red stripe round the back */}
        <path d="M18 64 L82 64 L82 69 L18 69 Z" fill={STRIPE} {...LINE} {...lw(1.6)} />
        {/* tail lamps */}
        <circle cx={27} cy={73.5} r={5.5} fill="#ff6b5e" opacity={g * 0.55} />
        <circle cx={73} cy={73.5} r={5.5} fill="#ff6b5e" opacity={g * 0.55} />
        <circle cx={27} cy={73.5} r={2.8} fill="#ff3b36" {...LINE} {...lw(1.8)} />
        <circle cx={73} cy={73.5} r={2.8} fill="#ff3b36" {...LINE} {...lw(1.8)} />
        <circle cx={26.2} cy={72.7} r={0.9} fill="#ffd0c8" />
        <circle cx={72.2} cy={72.7} r={0.9} fill="#ffd0c8" />
        <Roof />
      </g>
    </g>
  );
}

// --- front view: the nose with its lamps, the pawn behind the windshield ---
const F_CAB = "M18 41 L82 41 L82 72 Q82 79 75 79 L25 79 Q18 79 18 72 Z";
const F_POSTS = ["M18 5 L25 5 L25 42 L18 42 Z", "M75 5 L82 5 L82 42 L75 42 Z"];
const F_BPOSTS = ["M25 4 L29 4 L29 44 L25 44 Z", "M71 4 L75 4 L75 44 L71 44 Z"];
const F_HOOD = "M24 79 L24 52 Q24 44 32 44 L68 44 Q76 44 76 52 L76 79 Z";
const F_STRIPE = "M18 63 L26 63 Q34 63 40 69.5 Q44 73.5 50 73.5 Q56 73.5 60 69.5 Q66 63 74 63 L82 63 L82 68 L75 68 Q69 68 64 74 Q59 79 50 79 Q41 79 36 74 Q31 68 25 68 L18 68 Z";

function FrontBack({ p, anim, f }: RiderProps) {
  return (
    <g>
      <Shadow anim={anim} f={f} />
      <g transform={endT(anim, f)}>
        <Region p={p} name="backpost" d={F_BPOSTS} fill={darken(p.hex, 0.25)} line={2} />
      </g>
    </g>
  );
}

function FrontFront({ p, anim, f }: RiderProps) {
  const g = lampGlow(anim, f);
  const puff = endPuff(anim, f, 59, 31);
  return (
    <g>
      <EndTrucks anim={anim} f={f} />
      <g transform={endT(anim, f)}>
        <path d={E_FOOT} fill="#3b3f48" {...LINE} {...lw(2.4)} />
        {/* cowcatcher */}
        <path d="M31 81 L69 81 L65 91 L35 91 Z" fill={TRUCK} {...LINE} {...lw(2)} />
        <path d="M40 82.5 L40.5 89.5 M50 82.5 L50 89.5 M60 82.5 L59.5 89.5" stroke="#1d1d1f" stroke-linecap="round" opacity="0.45" {...lw(1.4)} />
        <Region p={p} name="cab" d={[F_CAB]} />
        {/* windshield glass */}
        <path d="M25 6 L75 6 L75 41 L25 41 Z" fill="#bfe6f5" opacity={0.14} />
        <path d="M28.5 13 L34 7.5 M66 39 L72 33" stroke="#fff" stroke-linecap="round" opacity={0.7} {...lw(1.4)} />
        <Region p={p} name="frontpost" d={F_POSTS} line={2.4} />
        {/* exhaust stack on the hood */}
        <path d="M46.5 45 L46.5 36 L53.5 36 L53.5 45 Z" fill={ROOF} {...LINE} {...lw(2.4)} />
        <path d="M45 36 L55 36 L55 33 L45 33 Z" fill={ROOF} {...LINE} {...lw(2.4)} />
        <Region p={p} name="hood" d={[F_HOOD]} />
        {/* highlights */}
        <path d="M30 48 L58 48" stroke="#fff" stroke-linecap="round" opacity="0.55" {...lw(2)} />
        <path d="M20.5 45 L20.5 60" stroke="#fff" stroke-linecap="round" opacity="0.4" {...lw(1.6)} />
        {/* red stripe sweeping down the nose */}
        <path d={F_STRIPE} fill={STRIPE} {...LINE} {...lw(1.6)} />
        {/* headlights: glow, lens */}
        <circle cx={50} cy={55} r={10} fill={GLOW} opacity={g * 0.6} />
        <circle cx={50} cy={66} r={7.5} fill={GLOW} opacity={g * 0.6} />
        <circle cx={50} cy={55} r={5.2} fill={LENS} {...LINE} {...lw(2.2)} />
        <circle cx={50} cy={66} r={3.6} fill={LENS} {...LINE} {...lw(2)} />
        <circle cx={48.4} cy={53.4} r={1.5} fill="#fff" />
        <Roof />
        {puff && <Puff x={puff[0]} y={puff[1]} k={puff[2]} n={puff[3]} />}
      </g>
    </g>
  );
}

const E_FRAME: [number, number, number, number] = [6, -10, 88, 110];

const frontView: RiderViewDraft = {
  frame: E_FRAME,
  idle: { ms: Array(IDLE_N).fill(150) },
  move: { ms: Array(MOVE_N).fill(65) },
  pose: endPose,
  Back: FrontBack,
  Front: FrontFront,
};

const backView: RiderViewDraft = {
  frame: E_FRAME,
  idle: { ms: Array(IDLE_N).fill(150) },
  move: { ms: Array(MOVE_N).fill(65) },
  pose: endPose,
  Back: BackBack,
  Front: BackFront,
};

export const birdieTrainRide: RiderDraft = {
  id: "birdie-train-ride",
  name: "Birdie's Train",
  tier: "legendary",
  description: "A little yellow diesel that runs on time, mostly. The whistle is sold separately, thank goodness.",
  frame: [-4, -10, 122, 110],
  idle: { ms: Array(IDLE_N).fill(150) },
  move: { ms: Array(MOVE_N).fill(65) },
  pose,
  Back: SideBack,
  Front: SideFront,
  views: { front: frontView, back: backView },
  trail: { ms: [150, 150, 150], w: 30, h: 24, Mark: TieMark },
};

// ---------- Trail mark: a pair of rail ties left on the square ----------
const TIE = "#4a3f3a";
const TIE_HI = "#8a7b70";

function TieMark({ f, view }: TrailProps) {
  const op = [1, 0.6, 0.28][f] ?? 0;
  const s = [1, 0.92, 0.84][f] ?? 0.8;
  // Side: ties stand across the path (upright on screen, flattened); up/down: they lie sideways-on.
  const across = view === "side";
  const tw = across ? 5.5 : 26;
  const th = across ? 19 : 5;
  const bars = across ? [[-7, 0], [7, 0]] : [[0, -5], [0, 5]];
  return (
    <g opacity={op} transform={`scale(${s})`}>
      {bars.map(([cx, cy]) => (
        <g>
          <rect x={cx - tw / 2} y={cy - th / 2} width={tw} height={th} rx={1.2} fill={TIE} {...LINE} {...lw(1.2)} />
          {across ? (
            <path d={`M${cx - tw / 2 + 1.3} ${cy - th / 2 + 1.6} L${cx - tw / 2 + 1.3} ${cy + th / 2 - 1.6}`} stroke={TIE_HI} stroke-linecap="round" {...lw(1.3)} />
          ) : (
            <path d={`M${cx - tw / 2 + 1.6} ${cy - th / 2 + 1.3} L${cx + tw / 2 - 1.6} ${cy - th / 2 + 1.3}`} stroke={TIE_HI} stroke-linecap="round" {...lw(1.3)} />
          )}
        </g>
      ))}
    </g>
  );
}
