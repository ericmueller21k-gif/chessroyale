import { Region, LINE, lw, type RiderDraft, type RiderProps, type Paint } from "../../item-kit.tsx";

const INK = "#1d1d1f";
const TIRE = "#2b2a2e";
const TREAD = "#57555c";
const BRASS = "#e2b23e";
const BRASS_D = "#9a6e14";
const SEAT = "#9c7c82";
const BAG = "#d3bd8c";
const BAG_D = "#9c8357";
const LEAF = "#4caf50";
const CLIP = "#a3e35c";
const PETAL = "#f4a3a0";
const STEEL = "#b9bcc4";

const MOVE_N = 8;
const STEP = 100 / MOVE_N;
const IDLE_N = 12;

/** A wheel: tire with tread notches that turn, a brass hub with bolts. */
function Wheel({ cx, cy, r, rot }: { cx: number; cy: number; r: number; rot: number }) {
  const ticks = [];
  for (let i = 0; i < 10; i++) {
    const a = ((rot + i * 36) * Math.PI) / 180;
    const x1 = cx + Math.cos(a) * (r - 0.6);
    const y1 = cy + Math.sin(a) * (r - 0.6);
    const x2 = cx + Math.cos(a) * (r - r * 0.24);
    const y2 = cy + Math.sin(a) * (r - r * 0.24);
    ticks.push(<path key={i} d={`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`} stroke={TREAD} {...lw(r > 10 ? 1.8 : 1.3)} stroke-linecap="round" />);
  }
  const bolts = [];
  for (let i = 0; i < 4; i++) {
    const a = ((rot + i * 90 + 45) * Math.PI) / 180;
    bolts.push(<circle key={i} cx={cx + Math.cos(a) * r * 0.3} cy={cy + Math.sin(a) * r * 0.3} r={r * 0.07} fill={BRASS_D} />);
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={TIRE} {...LINE} />
      {ticks}
      <circle cx={cx} cy={cy} r={r * 0.5} fill={BRASS} stroke={INK} {...lw(r > 10 ? 2 : 1.6)} />
      <circle cx={cx} cy={cy} r={r * 0.18} fill="#f7dc8a" stroke={INK} {...lw(1)} />
      {bolts}
      <path d={`M${cx - r * 0.32} ${cy - r * 0.2} A ${r * 0.38} ${r * 0.38} 0 0 1 ${cx - r * 0.05} ${cy - r * 0.38}`} fill="none" stroke="#fff6cf" opacity="0.8" stroke-linecap="round" {...lw(1.1)} />
    </g>
  );
}

/** A puff of exhaust: grey cloud, fading. */
function Puff({ x, y, r, o }: { x: number; y: number; r: number; o: number }) {
  return (
    <g opacity={o}>
      <circle cx={x} cy={y} r={r} fill="#e9e6ef" stroke={INK} {...lw(1.4)} />
      <circle cx={x + r * 0.7} cy={y - r * 0.35} r={r * 0.7} fill="#e9e6ef" stroke={INK} {...lw(1.4)} />
      <circle cx={x - r * 0.15} cy={y - r * 0.1} r={r * 0.75} fill="#e9e6ef" />
      <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.25} fill="#fff" />
    </g>
  );
}

const dxOf = (anim: "idle" | "move", f: number) => (anim === "move" ? f * STEP : 0);
const chug = (anim: "idle" | "move", f: number) => (anim === "idle" ? (f % 2 === 1 ? -0.8 : 0) : f % 2 === 1 ? -1.2 : 0);

/** Exhaust stack top in the ride's own coordinates. */
const STACK = { x: -4, y: 91 };

function Exhaust({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const puffs = [];
  if (anim === "idle") {
    // one puff every loop, born at frame 5
    const a = f - 5;
    if (a >= 0 && a < 5) puffs.push({ x: STACK.x - 1 - a * 0.9, y: STACK.y - 3 - a * 4.2, r: 3 + a * 1, o: 1 - a * 0.18 });
  } else {
    // a chug at frames 0 and 4, left behind in the world as the mower drives on
    for (const b of [0, 4]) {
      let a = f - b;
      if (a < 0) a += MOVE_N;
      if (a >= 4) continue;
      const born = b > f ? b - MOVE_N : b;
      const wx = STACK.x - 2 + born * STEP - a * 1.5;
      puffs.push({ x: wx - f * STEP, y: STACK.y - 3 - a * 4, r: 3.2 + a * 1.3, o: 1 - a * 0.2 });
    }
  }
  return (
    <g>
      {puffs.map((q, i) => (
        <Puff key={i} {...q} />
      ))}
    </g>
  );
}

/** Grass clippings: sprayed from the deck chute, up and back, settling on the ground (world-fixed). */
const SPRAY = [
  { vx: -5, vy: -19, rot: 20 },
  { vx: -8, vy: -16, rot: -35 },
  { vx: -2.5, vy: -21, rot: 70 },
  { vx: -10, vy: -13, rot: 120 },
];
function Clippings({ f }: { f: number }) {
  const out = [];
  for (let b = 0; b < MOVE_N; b++) {
    let a = f - b;
    if (a < 0) a += MOVE_N;
    if (a > 6) continue;
    const born = b > f ? b - MOVE_N : b;
    SPRAY.forEach((s, i) => {
      const k = (b * 3 + i) % 5;
      const vx = s.vx - k * 0.8;
      const vy = s.vy + k * 0.8;
      const G = 4.4;
      const GROUND = 97;
      // when it lands (frames after birth), from 94 + vy a + G a^2 = GROUND
      const aLand = (-vy + Math.sqrt(vy * vy + 4 * G * (GROUND - 94))) / (2 * G);
      const ae = Math.min(a, aLand);
      const landed = a >= aLand;
      const y = landed ? GROUND : 94 + vy * ae + G * ae * ae;
      const x = 17 + born * STEP + (vx + STEP) * ae - f * STEP;
      const rot = s.rot + a * 55 * (i % 2 ? -1 : 1);
      const o = landed && a >= 5 ? 0.6 : 1;
      out.push(
        <g key={`${b}-${i}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${landed ? 0 : rot})`} opacity={o}>
          <path d="M-4.8 0.8 Q0 -3 4.8 -0.8 Q0 2.6 -4.8 0.8 Z" fill={i % 2 ? "#62c040" : CLIP} stroke={INK} stroke-linejoin="round" {...lw(1.2)} />
        </g>,
      );
    });
  }
  return <g>{out}</g>;
}

function Back({ anim, f }: RiderProps) {
  const nod = anim === "idle" ? Math.sin((f / IDLE_N) * Math.PI * 2) * 7 : [-10, -4, 4, 8, 2, -6, -12, -8][f % 8];
  return (
    <g>
      {/* grass catcher bag */}
      <path d="M13 50 L1 52 Q-5 53 -5.5 60 L-4.5 82 Q-4 87 1.5 87 L13 87 Z" fill={BAG} {...LINE} />
      <path d="M-4.6 66 Q4 69 12.5 66 M-4.2 76 Q4 79 12.5 76 M3.5 52 L4 87" fill="none" stroke={BAG_D} stroke-linecap="round" {...lw(1.5)} />
      <path d="M-2.5 58 Q-2.6 54 1.5 54" fill="none" stroke="#fff4d8" stroke-linecap="round" opacity="0.9" {...lw(1.6)} />
      <path d="M12 49 L16 49 L16 88 L12 88 Z" fill={STEEL} {...LINE} {...lw(2)} />
      {/* exhaust pipe under the bag */}
      <path d="M16 88.5 L-1 88.5 Q-3 88.5 -3 90.5 L-3 93.5 L16 93.5 Z" fill={STEEL} {...LINE} {...lw(2)} />
      <ellipse cx={-3} cy={91} rx={1.4} ry={2.5} fill="#3a3c44" stroke={INK} {...lw(1.4)} />
      <path d="M1 90 L12 90" stroke="#fff" opacity="0.7" stroke-linecap="round" {...lw(1)} />
      <Exhaust anim={anim} f={f} />
      {/* seat back */}
      <path d="M14 59 L11 33 Q11 25 19 25 L25 25 Q32 25 32 33 L31 59 Z" fill={SEAT} {...LINE} />
      <path d="M15 33 Q15.5 28.5 19 28.5" fill="none" stroke="#e3c6c4" stroke-linecap="round" {...lw(1.8)} />
      {/* flower in a brass holder on the seat back */}
      <g transform={`rotate(${nod.toFixed(2)} 13 40)`}>
        <path d="M13 40 Q10 30 9 20" fill="none" stroke={INK} stroke-linecap="round" {...lw(4.2)} />
        <path d="M13 40 Q10 30 9 20" fill="none" stroke={LEAF} stroke-linecap="round" {...lw(1.8)} />
        <path d="M10.6 31 Q5 28 3.5 31.5 Q7 34.5 10.6 31 Z" fill={LEAF} stroke={INK} stroke-linejoin="round" {...lw(1.4)} />
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={9} cy={15.2} rx={2.7} ry={4} fill={PETAL} stroke={INK} {...lw(1.3)} transform={`rotate(${a} 9 19.5)`} />
        ))}
        <circle cx={9} cy={19.5} r={2.6} fill={BRASS} stroke={INK} {...lw(1.3)} />
        <circle cx={8.3} cy={18.8} r={0.8} fill="#fff6cf" />
      </g>
      <path d="M10 38 L16 38 L15.2 45 L10.8 45 Z" fill={BRASS} stroke={INK} stroke-linejoin="round" {...lw(1.6)} />
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  const rot = anim === "move" ? f * 45 : 0;
  const hl = <path d="M16 61.5 L60 61.5" stroke="#fff" opacity="0.35" stroke-linecap="round" {...lw(2.4)} />;
  return (
    <g>
      {/* mower deck */}
      <path d="M42 85 L82 85 L80 94 L46 94 Z" fill="#4a4c55" {...LINE} {...lw(2.2)} />
      <path d="M44 90 L50 94 L42 94 Z" fill="#3a3c44" stroke={INK} {...lw(1.4)} stroke-linejoin="round" />
      {/* body */}
      <Region p={p} name="body" d={["M10 64 Q10 58 17 58 L66 58 L68 88 L13 88 Q10 88 10 84 Z"]} over={hl} />
      {/* hood */}
      <Region
        p={p}
        name="hood"
        d={["M62 88 L62 67 Q62 60 70 60 L90 61.5 Q101 63 101.5 74 L101.5 84 Q101.5 88 97.5 88 Z"]}
        over={
          <g>
            <path d="M62 82 L102 82 L102 90 L62 90 Z" fill="#000" opacity="0.16" />
            <path d="M68 64.5 L88 65.5" stroke="#fff" opacity="0.4" stroke-linecap="round" {...lw(2.4)} />
          </g>
        }
      />
      {/* grille vents */}
      <path d="M90 71 L90 79 M94 71 L94 79" stroke={INK} stroke-linecap="round" {...lw(1.8)} />
      {/* headlight */}
      <path d="M98 66 Q103.5 66 103.5 71 Q103.5 75 98.5 75 Z" fill="#fff3b0" stroke={INK} stroke-linejoin="round" {...lw(1.8)} />
      {/* rear fender */}
      <Region p={p} name="fender" d={["M10 84 A22 22 0 0 1 54 84 L49 84 A17 17 0 0 0 15 84 Z"]} line={2.4} />
      {/* wheels */}
      <Wheel cx={32} cy={84} r={14} rot={rot} />
      <Wheel cx={85} cy={91} r={7} rot={rot * 1.5} />
      {/* seat cushion (hides the pawn's lower part) */}
      <path d="M17 58 Q17 51.5 24 51.5 L63 51.5 Q69 51.5 69 57 L69 59 L17 59 Z" fill={SEAT} {...LINE} />
      <path d="M23 54.6 L60 54.6" stroke="#e3c6c4" stroke-linecap="round" {...lw(1.8)} />
      {/* steering column and wheel */}
      <path d="M73 61 L69 46" stroke={INK} stroke-linecap="round" {...lw(5)} />
      <path d="M73 61 L69 46" stroke={STEEL} stroke-linecap="round" {...lw(2)} />
      <g transform="rotate(-18 69 46)">
        <ellipse cx={69} cy={46} rx={9} ry={3.2} fill="none" stroke={INK} {...lw(5.6)} />
        <ellipse cx={69} cy={46} rx={9} ry={3.2} fill="none" stroke="#3e3c44" {...lw(2.4)} />
        <circle cx={69} cy={46} r={1.8} fill={BRASS} stroke={INK} {...lw(1.2)} />
      </g>
      {anim === "move" && <Clippings f={f} />}
    </g>
  );
}

export const puddlesMower: RiderDraft = {
  id: "puddles-mower",
  name: "Puddles's Mower",
  tier: "mythic",
  description: "Top speed: a brisk stroll. Puddles insists that's plenty for the lawn and for the war.",
  frame: [-8, 4, 113, 96],
  idle: { ms: Array(IDLE_N).fill(110) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: (anim, f) => ({
    dx: dxOf(anim, f),
    dy: chug(anim, f),
    pawnX: -6,
    pawnY: -17 + (chug(anim, f) !== 0 ? 0.5 : 0),
    pawnTilt: anim === "move" ? -2 : 0,
    cut: 70,
  }),
  Back,
  Front,
};

export type { Paint };
