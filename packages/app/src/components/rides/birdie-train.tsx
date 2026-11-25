// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx at e764383d, Nov 23: the side
// view, its front and back views, its trail mark; the redraw from his train, long and low): only the import lines changed (the app's
// kit: ./kit.ts and ../item-paint.tsx), its id ("birdie-train", the item's, as every ride's drawing) and its tier (the art's
// placeholder "legendary": every ride is Mythic). The art's notes are its summaries there. Notes: docs/areas/shop.md, "Rides".
import type { RiderDraft, RiderProps } from "./kit.ts";
import { Region, LINE, lw, darken, type Paint } from "../item-paint.tsx";

// Fixed colors: Birdie's train.
const ROOF = "#2f2b38";
const ROOF_HI = "#57516a";
const STRIPE = "#e0353b";
const TRUCK = "#9097a1";
const TRUCK_DK = "#666c76";
const WHEEL = "#4d525c";
const HUB = "#cfd4dc";
const LENS = "#fff8d2";
const GLOW = "#ffe97a";
const GLASS = "#bfe6f5";
const PUFF = "#f6f6f4";

const IDLE_N = 12;
const MOVE_N = 10;
// The pivot the body rocks round (the rails, between the trucks).
const PIV: [number, number] = [54, 90];
// The pawn's base on the ride at rest (its square's base y 88, lifted by PAWN_Y).
const PAWN_Y = -3;
const PAWN_BASE: [number, number] = [50, 88 + PAWN_Y];

/** Where the move is at frame f (0..1 of the square): a soft start and a soft stop. */
const moveS = (f: number) => {
  const t = f / MOVE_N;
  return t - (0.4 * Math.sin(2 * Math.PI * t)) / (2 * Math.PI);
};

/** The body's bob (dy, down positive) and tilt (deg) per frame. */
function bodyRock(anim: "idle" | "move", f: number): { bob: number; tilt: number } {
  if (anim === "idle") {
    const a = (f / IDLE_N) * 2 * Math.PI;
    return { bob: 0.6 * (1 - Math.cos(a)) * 0.5, tilt: 0.5 * Math.sin(a) };
  }
  const t = f / MOVE_N;
  return { bob: -0.6 * Math.abs(Math.sin(2 * Math.PI * t)), tilt: -1.2 * Math.sin(2 * Math.PI * t) };
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
    pawnX: x2 - PAWN_BASE[0],
    pawnY: PAWN_Y + (y2 - PAWN_BASE[1]) + bob,
    pawnTilt: tilt,
    cut: 70,
  };
}

/** Wheel turn: 4 spokes, so three quarter turns a square keeps the loop seamless and the spokes readable. */
function wheelAngle(anim: "idle" | "move", f: number) {
  if (anim === "idle") return 20;
  return 20 + 270 * moveS(f);
}

function Wheel({ cx, cy, a }: { cx: number; cy: number; a: number }) {
  const r = (a * Math.PI) / 180;
  const sp = [0, 1].map((k) => {
    const t = r + (k * Math.PI) / 2;
    const ddx = 4.6 * Math.cos(t);
    const ddy = 4.6 * Math.sin(t);
    return `M${(cx - ddx).toFixed(2)} ${(cy - ddy).toFixed(2)} L${(cx + ddx).toFixed(2)} ${(cy + ddy).toFixed(2)}`;
  });
  return (
    <g>
      <circle cx={cx} cy={cy} r={6.6} fill={WHEEL} {...LINE} {...lw(2.4)} />
      {sp.map((d) => (
        <path d={d} stroke={HUB} stroke-linecap="round" {...lw(1.6)} />
      ))}
      <circle cx={cx} cy={cy} r={1.8} fill={HUB} {...LINE} {...lw(1)} />
    </g>
  );
}

function Truck({ x1, x2, a }: { x1: number; x2: number; a: number }) {
  const m = (x1 + x2) / 2;
  return (
    <g>
      <Wheel cx={x1} cy={89} a={a} />
      <Wheel cx={x2} cy={89} a={a} />
      {/* the truck's side frame over the wheels' middles */}
      <path d={`M${x1 - 4} 82 L${x2 + 4} 82 Q${x2 + 7} 82 ${x2 + 7} 85 L${x2 + 4} 87 L${x1 - 4} 87 L${x1 - 7} 85 Q${x1 - 7} 82 ${x1 - 4} 82 Z`} fill={TRUCK} {...LINE} {...lw(2.2)} />
      <path d={`M${m - 3} 83 L${m + 3} 83 L${m + 3} 86 L${m - 3} 86 Z`} fill={TRUCK_DK} />
      <circle cx={x1} cy={89} r={1.8} fill={HUB} {...LINE} {...lw(1)} />
      <circle cx={x2} cy={89} r={1.8} fill={HUB} {...LINE} {...lw(1)} />
    </g>
  );
}

function Puff({ x, y, k, n }: { x: number; y: number; k: number; n: number }) {
  const t = k / Math.max(1, n - 1);
  const s = 3 + t * 3.2;
  const op = 1 - t * 0.85;
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

// The long low body, nose to our right.
const BODY = "M-2 50 L90 50 Q112 50 114 70 L114 76 Q114 80 110 80 L-2 80 Q-6 80 -6 76 L-6 54 Q-6 50 -2 50 Z";
// The flat dark roof, front and back of the open cab (the hatch, x 28-72).
const ROOF_BACK = "M-5 51 L-5 47.5 Q-5 44 -1 44 L29 44 L29 51 Z";
const ROOF_FRONT = "M71 51 L71 44 L88 44 Q99 44 104 51 Z";
// The roof's far rim across the hatch, seen behind the pawn.
const ROOF_FAR = "M27 43 L73 43 L73 48 L27 48 Z";
// Thin red stripe along the body, sweeping up round the nose.
const STRIPE_D = "M-6 64 L96 64 Q104 64 108 59 Q110 56 112.5 60 Q108 68 97 68 L-6 68 Z";

function Body({ p, anim, f }: { p: Paint; anim: "idle" | "move"; f: number }) {
  const glow = anim === "idle" ? 0.4 + 0.3 * Math.sin((f / IDLE_N) * 2 * Math.PI) : 0.75;
  return (
    <g>
      {/* rear buffer */}
      <path d="M-9 70 L-5 70 L-5 77 L-9 77 Z" fill={TRUCK_DK} {...LINE} {...lw(2)} />
      {/* exhaust stack at the back of the roof */}
      <path d="M6 45 L6 38 L13 38 L13 45 Z" fill={ROOF} {...LINE} {...lw(2.2)} />
      <path d="M4.5 38 L14.5 38 L14.5 35 L4.5 35 Z" fill={ROOF} {...LINE} {...lw(2.2)} />
      <Region p={p} name="body" d={[BODY]} />
      {/* the open cab's near rim */}
      <path d="M29 50.5 L71 50.5" stroke="#1d1d1f" stroke-linecap="round" {...lw(3.4)} />
      {/* highlight along the top */}
      <path d="M-1 55 L24 55 M32 55 L86 55" stroke="#fff" stroke-linecap="round" opacity="0.5" {...lw(2.2)} />
      {/* door seam and grille */}
      <path d="M24 56 L24 77" stroke="#1d1d1f" stroke-linecap="round" opacity="0.28" {...lw(1.6)} />
      <path d="M87 71.5 L87 77 M91.5 71.5 L91.5 77 M96 71.5 L96 77 M100.5 71.5 L100.5 77" stroke="#1d1d1f" stroke-linecap="round" opacity="0.5" {...lw(1.8)} />
      {/* red stripe */}
      <path d={STRIPE_D} fill={STRIPE} {...LINE} {...lw(1.6)} />
      {/* headlight on the nose: glow, lens */}
      <circle cx={106} cy={60} r={9} fill={GLOW} opacity={glow * 0.6} />
      <circle cx={106} cy={60} r={4.3} fill={LENS} {...LINE} {...lw(2)} />
      <circle cx={104.8} cy={58.8} r={1.2} fill="#fff" />
      {/* tail lamp */}
      <circle cx={-2.5} cy={58.5} r={2.3} fill="#ff4a40" {...LINE} {...lw(1.4)} />
      {/* the dark roof */}
      <path d={ROOF_BACK} fill={ROOF} {...LINE} {...lw(2.6)} />
      <path d={ROOF_FRONT} fill={ROOF} {...LINE} {...lw(2.6)} />
      <path d="M-1 46.5 L26 46.5 M74 46.5 L88 46.5" stroke={ROOF_HI} stroke-linecap="round" {...lw(1.6)} />
      {/* the sloped windshield at the front of the cab */}
      <path d="M65 45 L60 31 L66 31 L76 45 Z" fill={GLASS} opacity={0.55} />
      <path d="M65 45 L60 31 L66 31 L76 45 Z" fill="none" {...LINE} {...lw(2.4)} />
      <path d="M63.5 34.5 L66.5 41" stroke="#fff" stroke-linecap="round" opacity="0.85" {...lw(1.4)} />
    </g>
  );
}

function rockT(anim: "idle" | "move", f: number) {
  const { bob, tilt } = bodyRock(anim, f);
  return `translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} ${PIV[0]} ${PIV[1]})`;
}

function SideBack({ anim, f }: RiderProps) {
  return (
    <g transform={rockT(anim, f)}>
      <path d={ROOF_FAR} fill={ROOF} {...LINE} {...lw(2.4)} />
      <path d="M28 47 L72 47 L72 52 L28 52 Z" fill="#1d1d1f" />
    </g>
  );
}

function SideFront({ p, anim, f }: RiderProps) {
  const a = wheelAngle(anim, f);
  let puff: [number, number, number, number] | null = null;
  if (anim === "idle" && f >= 6) {
    const k = f - 6;
    puff = [9.5 - k * 0.6, 30 - k * 3, k, 6];
  }
  if (anim === "move" && f <= 4) {
    puff = [9.5 - f * 2.2, 30 - f * 3, f, 5];
  }
  return (
    <g>
      <ellipse cx={54} cy={96} rx={58} ry={2.6} fill="#000" opacity={0.15} />
      <Truck x1={10} x2={27} a={a} />
      <Truck x1={78} x2={95} a={a} />
      <g transform={rockT(anim, f)}>
        <Body p={p} anim={anim} f={f} />
        {puff && <Puff x={puff[0]} y={puff[1]} k={puff[2]} n={puff[3]} />}
      </g>
    </g>
  );
}

// ---------- Front and back views (end-on) ----------

/** End-on views sway round the rails' middle under the pawn. */
const VPIV: [number, number] = [50, 90];

function viewPose(anim: "idle" | "move", f: number) {
  const { bob, tilt } = bodyRock(anim, f);
  const th = (tilt * Math.PI) / 180;
  return {
    dx: 0,
    dy: 0,
    pawnX: 5 * Math.sin(th),
    pawnY: PAWN_Y + (5 - 5 * Math.cos(th)) + bob,
    pawnTilt: tilt,
    cut: 70,
  };
}

function viewT(anim: "idle" | "move", f: number) {
  const { bob, tilt } = bodyRock(anim, f);
  return `translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} ${VPIV[0]} ${VPIV[1]})`;
}

/** Lamp glow: the side's slow idle pulse; on the move it brightens as it gets going and dims as it stops. */
function viewGlow(anim: "idle" | "move", f: number) {
  if (anim === "idle") return 0.4 + 0.3 * Math.sin((f / IDLE_N) * 2 * Math.PI);
  return 0.4 + 0.5 * Math.sin(Math.PI * (f / MOVE_N));
}

/** The stack's puff: k-th step of n, or null. */
function viewPuff(anim: "idle" | "move", f: number): [number, number] | null {
  if (anim === "idle" && f >= 6) return [f - 6, 6];
  if (anim === "move" && f <= 4) return [f, 5];
  return null;
}

/** A wheel seen end-on: a dark tyre with tread marks running down (toward us) or up (away). */
function EndWheel({ cx, a, dir }: { cx: number; a: number; dir: 1 | -1 }) {
  const u = ((((a - 20) / 90) % 1) + 1) % 1;
  const marks: number[] = [];
  for (let k = -2; k < 6; k++) {
    const y = 85 + (k + dir * u) * 3.2;
    if (y > 87.6 && y < 94.4) marks.push(y);
  }
  return (
    <g>
      <rect x={cx - 3.4} y={82.4} width={6.8} height={13.2} rx={2.8} fill={WHEEL} {...LINE} {...lw(2.2)} />
      {marks.map((y) => (
        <path d={`M${(cx - 1.6).toFixed(2)} ${y.toFixed(2)} L${(cx + 1.6).toFixed(2)} ${y.toFixed(2)}`} stroke={HUB} stroke-linecap="round" opacity="0.9" {...lw(1.6)} />
      ))}
    </g>
  );
}

function EndTrucks({ a, dir }: { a: number; dir: 1 | -1 }) {
  return (
    <g>
      <EndWheel cx={28} a={a} dir={dir} />
      <EndWheel cx={72} a={a} dir={dir} />
      <path d="M23 81 L77 81 Q80 81 80 84 L78 87 L22 87 L20 84 Q20 81 23 81 Z" fill={TRUCK} {...LINE} {...lw(2.2)} />
      <path d="M45 82.5 L55 82.5 L55 85.5 L45 85.5 Z" fill={TRUCK_DK} />
      <circle cx={28} cy={84} r={1.8} fill={HUB} {...LINE} {...lw(1)} />
      <circle cx={72} cy={84} r={1.8} fill={HUB} {...LINE} {...lw(1)} />
    </g>
  );
}

function EndShadow({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const { bob } = bodyRock(anim, f);
  return <ellipse cx={50} cy={96} rx={37 + bob * 4} ry={2.6 + bob * 0.4} fill="#000" opacity={0.15 + bob * 0.06} />;
}

// From behind: the cab's back wall, rounded at the top corners.
const BACK_WALL = "M25 50 L75 50 Q83 50 83 58 L83 77 Q83 81 79 81 L21 81 Q17 81 17 77 L17 58 Q17 50 25 50 Z";
// From the front: the rounded nose, its hood curving over.
const NOSE = "M29 49 L71 49 Q83 49 83 61 L83 77 Q83 81 79 81 L21 81 Q17 81 17 77 L17 61 Q17 49 29 49 Z";

function BackBack({ anim, f }: RiderProps) {
  return (
    <g transform={viewT(anim, f)}>
      {/* the roof's top running away from us, past the pawn */}
      <path d="M23 40.5 L77 40.5 Q80 40.5 81 44 L82 49 L18 49 L19 44 Q20 40.5 23 40.5 Z" fill={ROOF} {...LINE} {...lw(2.4)} />
      {/* the open hatch */}
      <path d="M29 42.5 L71 42.5 L71 48 L29 48 Z" fill="#1d1d1f" />
      {/* the windshield at the cab's far end, seen from behind */}
      <path d="M30 43 L34 31 L66 31 L70 43 Z" fill={GLASS} opacity={0.55} />
      <path d="M30 43 L34 31 L66 31 L70 43 Z" fill="none" {...LINE} {...lw(2.4)} />
    </g>
  );
}

function BackFront({ p, anim, f }: RiderProps) {
  const a = wheelAngle(anim, f);
  const glow = viewGlow(anim, f);
  const puff = viewPuff(anim, f);
  return (
    <g>
      <EndShadow anim={anim} f={f} />
      <EndTrucks a={a} dir={-1} />
      <g transform={viewT(anim, f)}>
        {/* rear buffer */}
        <path d="M41 74 L59 74 L59 80.5 L41 80.5 Z" fill={TRUCK_DK} {...LINE} {...lw(2)} />
        <Region p={p} name="body" d={[BACK_WALL]} />
        <path d="M23 54.5 L77 54.5" stroke="#fff" stroke-linecap="round" opacity="0.5" {...lw(2.2)} />
        {/* back door seams */}
        <path d="M41 56 L41 63 M59 56 L59 63" stroke="#1d1d1f" stroke-linecap="round" opacity="0.28" {...lw(1.6)} />
        <path d="M17.6 64 L82.4 64 L82.4 68 L17.6 68 Z" fill={STRIPE} {...LINE} {...lw(1.6)} />
        <path d="M41 74 L59 74 L59 79 L41 79 Z" fill={TRUCK_DK} {...LINE} {...lw(2)} />
        <path d="M43 76.5 L57 76.5" stroke={HUB} stroke-linecap="round" opacity="0.7" {...lw(1.2)} />
        {/* tail lamps, glowing with the headlights */}
        <circle cx={24} cy={58.5} r={5} fill="#ff4a40" opacity={glow * 0.35} />
        <circle cx={76} cy={58.5} r={5} fill="#ff4a40" opacity={glow * 0.35} />
        <circle cx={24} cy={58.5} r={2.6} fill="#ff4a40" {...LINE} {...lw(1.4)} />
        <circle cx={76} cy={58.5} r={2.6} fill="#ff4a40" {...LINE} {...lw(1.4)} />
        <circle cx={23.2} cy={57.7} r={0.8} fill="#fff" opacity="0.8" />
        <circle cx={75.2} cy={57.7} r={0.8} fill="#fff" opacity="0.8" />
        {/* the near roof: the hatch's near rim and the roof's back edge */}
        <path d="M17 52 L17 49.5 Q17 47 20 47 L80 47 Q83 47 83 49.5 L83 52 Z" fill={ROOF} {...LINE} {...lw(2.6)} />
        <path d="M29 47.2 L71 47.2" stroke="#1d1d1f" stroke-linecap="round" {...lw(3.4)} />
        <path d="M21 50 L79 50" stroke={ROOF_HI} stroke-linecap="round" {...lw(1.6)} />
        {/* exhaust stack at the back corner */}
        <path d="M73 48 L73 41 L79 41 L79 48 Z" fill={ROOF} {...LINE} {...lw(2.2)} />
        <path d="M71.5 41 L80.5 41 L80.5 38 L71.5 38 Z" fill={ROOF} {...LINE} {...lw(2.2)} />
        {puff && <Puff x={76 + puff[0] * 0.5} y={33 - puff[0] * 3} k={puff[0]} n={puff[1]} />}
      </g>
    </g>
  );
}

function FrontBack({ anim, f }: RiderProps) {
  const puff = viewPuff(anim, f);
  return (
    <g transform={viewT(anim, f)}>
      {/* the roof's back half, running away behind the pawn */}
      <path d="M24 37 L76 37 Q79 37 80 40 L81 45 L19 45 L20 40 Q21 37 24 37 Z" fill={ROOF} {...LINE} {...lw(2.4)} />
      <path d="M29 39.5 L71 39.5 L71 45 L29 45 Z" fill="#1d1d1f" />
      {/* the exhaust stack at the far corner */}
      <path d="M22 40 L22 34 L28 34 L28 40 Z" fill={ROOF} {...LINE} {...lw(2.2)} />
      <path d="M20.5 34 L29.5 34 L29.5 31 L20.5 31 Z" fill={ROOF} {...LINE} {...lw(2.2)} />
      {puff && <Puff x={25 - puff[0] * 0.5} y={26 - puff[0] * 3} k={puff[0]} n={puff[1]} />}
    </g>
  );
}

function FrontFront({ p, anim, f }: RiderProps) {
  const a = wheelAngle(anim, f);
  const glow = viewGlow(anim, f);
  return (
    <g>
      <EndShadow anim={anim} f={f} />
      <EndTrucks a={a} dir={1} />
      <g transform={viewT(anim, f)}>
        <Region p={p} name="body" d={[NOSE]} />
        <path d="M26 54 Q50 51.5 74 54" fill="none" stroke="#fff" stroke-linecap="round" opacity="0.5" {...lw(2.2)} />
        {/* the red stripe sweeping down the front */}
        <path d="M17.4 64 Q50 77 82.6 64 L82.6 68 Q50 81 17.4 68 Z" fill={STRIPE} {...LINE} {...lw(1.6)} />
        {/* grille */}
        <path d="M44 76.5 L44 79 M48 77 L48 79.5 M52 77 L52 79.5 M56 76.5 L56 79" stroke="#1d1d1f" stroke-linecap="round" opacity="0.5" {...lw(1.6)} />
        {/* two headlights */}
        <circle cx={30} cy={60} r={8.5} fill={GLOW} opacity={glow * 0.6} />
        <circle cx={70} cy={60} r={8.5} fill={GLOW} opacity={glow * 0.6} />
        <circle cx={30} cy={60} r={4.3} fill={LENS} {...LINE} {...lw(2)} />
        <circle cx={70} cy={60} r={4.3} fill={LENS} {...LINE} {...lw(2)} />
        <circle cx={28.8} cy={58.8} r={1.2} fill="#fff" />
        <circle cx={68.8} cy={58.8} r={1.2} fill="#fff" />
        {/* the roof's front over the nose, the hatch's near rim */}
        <path d="M18 51.5 L18 49 Q18 46 22 46 L78 46 Q82 46 82 49 L82 51.5 Z" fill={ROOF} {...LINE} {...lw(2.6)} />
        <path d="M22 49.4 L78 49.4" stroke={ROOF_HI} stroke-linecap="round" {...lw(1.6)} />
        {/* the sloped windshield in front of the pawn */}
        <path d="M30 47 L33 37.5 L67 37.5 L70 47 Z" fill={GLASS} opacity={0.4} />
        <path d="M30 47 L33 37.5 L67 37.5 L70 47 Z" fill="none" {...LINE} {...lw(2.4)} />
        <path d="M35.5 40 L34 45" stroke="#fff" stroke-linecap="round" opacity="0.85" {...lw(1.4)} />
        <path d="M65 40 L64.4 42" stroke="#fff" stroke-linecap="round" opacity="0.6" {...lw(1.2)} />
      </g>
    </g>
  );
}

const endFrame: [number, number, number, number] = [12, 4, 76, 94];

// ---------- Trail: a pair of rail ties left on the ground ----------
const TIE = "#4a3f38";
const TIE_HI = "#8a7a6c";

function TieBar({ x, y, w, h, across }: { x: number; y: number; w: number; h: number; across: boolean }) {
  // across: the bar runs left-right (going up/down); else up-down (going right/left). Its lit edge is on top / left.
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={1.2} fill={TIE} {...LINE} {...lw(1.3)} />
      {across ? (
        <path d={`M${x - w / 2 + 1.6} ${y - h / 2 + 1.2} L${x + w / 2 - 1.6} ${y - h / 2 + 1.2}`} stroke={TIE_HI} stroke-linecap="round" {...lw(1.3)} />
      ) : (
        <path d={`M${x - w / 2 + 1.2} ${y - h / 2 + 1.6} L${x - w / 2 + 1.2} ${y + h / 2 - 1.6}`} stroke={TIE_HI} stroke-linecap="round" {...lw(1.3)} />
      )}
    </g>
  );
}

function TrailMark({ f, view }: { f: number; view: "side" | "front" | "back" }) {
  const s = [1, 0.88, 0.76][f] ?? 0.76;
  const op = [1, 0.55, 0.2][f] ?? 0.2;
  const side = view === "side";
  return (
    <g opacity={op} transform={`scale(${s})`}>
      {side ? (
        <>
          <TieBar x={-7.5} y={0} w={5.5} h={12} across={false} />
          <TieBar x={7.5} y={0} w={5.5} h={12} across={false} />
        </>
      ) : (
        <>
          <TieBar x={0} y={-3.6} w={26} h={4.6} across />
          <TieBar x={0} y={3.6} w={26} h={4.6} across />
        </>
      )}
    </g>
  );
}

export const birdieTrainRide: RiderDraft = {
  id: "birdie-train",
  name: "Birdie's Train",
  tier: "mythic",
  description: "A little yellow diesel that always runs on time. The tracks are imaginary; the punctuality is not.",
  frame: [-10, 8, 126, 90],
  idle: { ms: Array(IDLE_N).fill(150) },
  move: { ms: Array(MOVE_N).fill(65) },
  pose,
  trail: {
    ms: [150, 150, 150],
    w: 30,
    h: 14,
    Mark: ({ f, view }) => <TrailMark f={f} view={view} />,
  },
  Back: SideBack,
  Front: SideFront,
  views: {
    front: {
      frame: endFrame,
      idle: { ms: Array(IDLE_N).fill(150) },
      move: { ms: Array(MOVE_N).fill(65) },
      pose: viewPose,
      Back: FrontBack,
      Front: FrontFront,
    },
    back: {
      frame: endFrame,
      idle: { ms: Array(IDLE_N).fill(150) },
      move: { ms: Array(MOVE_N).fill(65) },
      pose: viewPose,
      Back: BackBack,
      Front: BackFront,
    },
  },
};
