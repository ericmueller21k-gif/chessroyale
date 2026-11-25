// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/puddles-mower/puddles-mower.tsx, Nov 1: the side view, its front and back views, its
// trail mark): only the import lines changed and the `!`s the app's stricter typecheck asks for (noUncheckedIndexedAccess).
// The art's kit there (scripts/boss-art/item-kit.tsx) is a copy of ../item-paint.tsx and ./kit.ts. Notes: docs/areas/shop.md, "Rides".
import type { RiderDraft, RiderProps, RiderViewDraft } from "./kit.ts";
import type { Paint } from "../item-paint.tsx";
import { Region, LINE, lw } from "../item-paint.tsx";

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
      if (a >= 1) continue; // only the puff at the pipe; the ones left behind are gone
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
  const out: preact.JSX.Element[] = [];
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
  const nod = anim === "idle" ? Math.sin((f / IDLE_N) * Math.PI * 2) * 7 : [-10, -4, 4, 8, 2, -6, -12, -8][f % 8]!;
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
    </g>
  );
}

/* ───────────── Front and back views ───────────── */

const flowerNod = (anim: "idle" | "move", f: number) =>
  anim === "idle" ? Math.sin((f / IDLE_N) * Math.PI * 2) * 7 : [-10, -4, 4, 8, 2, -6, -12, -8][f % 8]!;

/** A tire seen end-on: its tread, notches rolling up (dir 1, going away) or down (dir -1, coming toward us). */
function EndTire({ cx, top, bot, w, rot, dir, hub }: { cx: number; top: number; bot: number; w: number; rot: number; dir: number; hub: number }) {
  const r = (bot - top) / 2;
  const cy = top + r;
  const ticks = [];
  for (let i = 0; i < 10; i++) {
    const a = ((dir * rot + i * 36) * Math.PI) / 180;
    if (Math.cos(a) < 0.2) continue;
    const y = cy - Math.sin(a) * (r - 1.6);
    ticks.push(<path key={i} d={`M${(cx - w / 2 + 2).toFixed(2)} ${y.toFixed(2)} L${(cx + w / 2 - 2).toFixed(2)} ${y.toFixed(2)}`} stroke={TREAD} stroke-linecap="round" {...lw(w > 10 ? 1.8 : 1.4)} />);
  }
  const hx = cx + hub * (w / 2);
  return (
    <g>
      <ellipse cx={hx} cy={cy} rx={w > 10 ? 2.2 : 1.6} ry={r * 0.42} fill={BRASS} stroke={INK} {...lw(1.4)} />
      <rect x={cx - w / 2} y={top} width={w} height={bot - top} rx={w * 0.42} fill={TIRE} {...LINE} />
      {ticks}
      <path d={`M${cx - w / 2 + 1.8} ${cy - r * 0.55} L${cx - w / 2 + 1.8} ${cy + r * 0.2}`} stroke="#6d6b73" opacity="0.8" stroke-linecap="round" {...lw(1)} />
    </g>
  );
}

/** The flower on its stem, seen end-on: (bx, by) where the stem leaves the holder, (hx, hy) the flower's center. */
function EndFlower({ bx, by, hx, hy, rot, leaf }: { bx: number; by: number; hx: number; hy: number; rot: number; leaf: number }) {
  const stem = `M${bx} ${by} Q${(bx + hx) / 2 - leaf * 1.5} ${(by + hy) / 2} ${hx} ${hy + 3}`;
  const lx = bx + (hx - bx) * 0.42;
  const ly = by + (hy - by) * 0.42;
  return (
    <g transform={`rotate(${rot.toFixed(2)} ${bx} ${by})`}>
      <path d={stem} fill="none" stroke={INK} stroke-linecap="round" {...lw(4.2)} />
      <path d={stem} fill="none" stroke={LEAF} stroke-linecap="round" {...lw(1.8)} />
      <path d={`M${lx} ${ly} Q${lx + leaf * 5} ${ly - 4} ${lx + leaf * 7} ${ly - 0.5} Q${lx + leaf * 3.5} ${ly + 3} ${lx} ${ly} Z`} fill={LEAF} stroke={INK} stroke-linejoin="round" {...lw(1.4)} />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={hx} cy={hy - 4.3} rx={2.7} ry={4} fill={PETAL} stroke={INK} {...lw(1.3)} transform={`rotate(${a} ${hx} ${hy})`} />
      ))}
      <circle cx={hx} cy={hy} r={2.6} fill={BRASS} stroke={INK} {...lw(1.3)} />
      <circle cx={hx - 0.7} cy={hy - 0.7} r={0.8} fill="#fff6cf" />
    </g>
  );
}

/** Clippings seen end-on: thrown out to both sides from under the deck, landing low. */
function EndSpray({ f, x0, y0 }: { f: number; x0: number; y0: number }) {
  const out = [];
  for (let b = 0; b < MOVE_N; b++) {
    let a = f - b;
    if (a < 0) a += MOVE_N;
    if (a > 4) continue;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const k = (b * 3 + i + (s > 0 ? 2 : 0)) % 5;
        const vx = s * (4.5 + k * 0.8 + i * 1.6);
        const vy = -(6 + k * 0.9 + i * 2.2);
        const G = 2.8;
        const GROUND = 97;
        const aLand = (-vy + Math.sqrt(vy * vy + 4 * G * (GROUND - y0))) / (2 * G);
        const ae = Math.min(a, aLand);
        const landed = a >= aLand;
        const y = landed ? GROUND : y0 + vy * ae + G * ae * ae;
        const x = 50 + s * x0 + vx * ae;
        const rot = (k * 40 + a * 60) * s;
        out.push(
          <g key={`${b}-${s}-${i}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${landed ? 0 : rot})`} opacity={a >= 4 ? 0.55 : 1}>
            <path d="M-4.4 0.7 Q0 -2.8 4.4 -0.7 Q0 2.4 -4.4 0.7 Z" fill={i % 2 ? "#62c040" : CLIP} stroke={INK} stroke-linejoin="round" {...lw(1.2)} />
          </g>,
        );
      }
    }
  }
  return <g>{out}</g>;
}

/** Puffs seen end-on: from the pipe at (x, y), rising and drifting by `drift` a frame. */
function EndPuffs({ anim, f, x, y, drift }: { anim: "idle" | "move"; f: number; x: number; y: number; drift: number }) {
  const puffs = [];
  if (anim === "idle") {
    const a = f - 5;
    if (a >= 0 && a < 5) puffs.push({ x: x + a * drift, y: y - 2 - a * 4.2, r: 3 + a, o: 1 - a * 0.18 });
  } else {
    for (const b of [0, 4]) {
      let a = f - b;
      if (a < 0) a += MOVE_N;
      if (a >= 4) continue;
      puffs.push({ x: x + a * drift * 1.3, y: y - 2 - a * 3.6, r: 3.2 + a * 1.3, o: 1 - a * 0.2 });
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

const endPose = (anim: "idle" | "move", f: number) => ({
  dx: 0,
  dy: chug(anim, f),
  pawnX: 0,
  pawnY: -17 + (chug(anim, f) !== 0 ? 0.5 : 0),
  pawnTilt: anim === "move" ? [0, 1, 0, -1][f % 4]! : 0,
  cut: 70,
});

const fenderCap = (cx: number, top: number, bot: number) =>
  `M${cx - 8.5} ${bot - 1.5} Q${cx - 8.5} ${bot} ${cx - 7} ${bot} L${cx + 7} ${bot} Q${cx + 8.5} ${bot} ${cx + 8.5} ${bot - 1.5} L${cx + 8.5} ${top + 7} A 8.5 7 0 0 0 ${cx - 8.5} ${top + 7} Z`;

/** Back view, behind the pawn: nothing shows past the pawn from here but the hood's far edge under it. */
function BackViewBack(_props: RiderProps) {
  return <g />;
}

/** Back view, in front of the pawn: cushion, seat back and flower, rear panel, big wheels, bag, pipe. */
function BackViewFront({ p, anim, f }: RiderProps) {
  const rot = anim === "move" ? f * 45 : 0;
  const nod = flowerNod(anim, f);
  return (
    <g>
      {anim === "move" && (
        <g>
          <clipPath id="pm-back-hidden">
            <rect x={6.3} y={67.3} width={17.4} height={33.4} rx={7.6} />
            <rect x={76.3} y={67.3} width={17.4} height={33.4} rx={7.6} />
            <rect x={19.4} y={53.4} width={61.2} height={37.2} rx={6.4} />
            <rect x={6.3} y={62} width={19.6} height={18.6} />
            <rect x={74.1} y={62} width={19.6} height={18.6} />
          </clipPath>
          {/* only the bits hidden under the tires remain: nothing shows */}
          <g clip-path="url(#pm-back-hidden)">
            <EndSpray f={f} x0={32} y0={90} />
          </g>
        </g>
      )}
      {/* seat cushion */}
      <path d="M27 60 L27 56 Q27 50.5 33 50.5 L67 50.5 Q73 50.5 73 56 L73 60 Z" fill={SEAT} {...LINE} />
      {/* seat back */}
      <path d="M39.5 54 L38.5 40 Q38.5 34.5 44 34.5 L56 34.5 Q61.5 34.5 61.5 40 L60.5 54 Z" fill={SEAT} {...LINE} />
      <path d="M41.8 42 Q42 38.2 45.2 38.2" fill="none" stroke="#e3c6c4" stroke-linecap="round" {...lw(1.8)} />
      {/* flower in its brass holder */}
      <EndFlower bx={58.5} by={43} hx={68} hy={17} rot={nod * 0.4} leaf={1} />
      <path d="M55.5 41 L61 41 L60.3 47.5 L56.2 47.5 Z" fill={BRASS} stroke={INK} stroke-linejoin="round" {...lw(1.6)} />
      {/* rear panel */}
      <Region
        p={p}
        name="body"
        d={["M22 62 Q22 56 28 56 L72 56 Q78 56 78 62 L78 84 Q78 88 74 88 L26 88 Q22 88 22 84 Z"]}
        over={
          <g>
            <path d="M20 54 L80 54 L80 61 L20 61 Z" fill="#fff" opacity="0.22" />
            <path d="M20 82 L80 82 L80 90 L20 90 Z" fill="#000" opacity="0.16" />
          </g>
        }
      />
      {/* big back wheels and their fenders */}
      <EndTire cx={15} top={70} bot={98} w={12} rot={rot} dir={1} hub={-1} />
      <EndTire cx={85} top={70} bot={98} w={12} rot={rot} dir={1} hub={1} />
      <Region
        p={p}
        name="fender"
        d={[fenderCap(15, 62, 77), fenderCap(85, 62, 77)]}
        line={2.4}
        over={<path d="M9 65.5 Q10 63.5 13 63.5 M79 65.5 Q80 63.5 83 63.5" fill="none" stroke="#fff" opacity="0.45" stroke-linecap="round" {...lw(1.6)} />}
      />
      {/* bag frame and grass bag */}
      <path d="M33 50 Q33 47 36 47 L64 47 Q67 47 67 50 L67 88.5 L33 88.5 Z" fill={STEEL} {...LINE} {...lw(2)} />
      <path d="M35.5 54 Q35.5 50 40 50 L60 50 Q64.5 50 64.5 54 L65.5 83 Q65.5 87.5 61 87.5 L39 87.5 Q34.5 87.5 34.5 83 Z" fill={BAG} {...LINE} />
      <path d="M35 66 Q50 69.5 65 66 M34.8 76 Q50 79.5 65.2 76 M50 50.5 L50 87" fill="none" stroke={BAG_D} stroke-linecap="round" {...lw(1.5)} />
      <path d="M38.2 60 Q38 54 42.5 53.5" fill="none" stroke="#fff4d8" stroke-linecap="round" opacity="0.9" {...lw(1.6)} />
      {/* exhaust pipe, end-on under the bag */}
      <circle cx={42} cy={91.5} r={3.6} fill={STEEL} stroke={INK} {...lw(2)} />
      <circle cx={42} cy={91.5} r={1.9} fill="#3a3c44" />
      <path d="M39.6 89.8 Q40.4 88.8 41.6 88.6" fill="none" stroke="#fff" opacity="0.8" stroke-linecap="round" {...lw(0.9)} />
      <EndPuffs anim={anim} f={f} x={41} y={89} drift={-1.2} />
    </g>
  );
}

/** Front view, behind the pawn: the seat back and the flower over it, a puff rising beyond. */
function FrontViewBack({ anim, f }: RiderProps) {
  const nod = flowerNod(anim, f);
  return (
    <g>
      <EndPuffs anim={anim} f={f} x={82} y={66} drift={1.1} />
      <EndFlower bx={38} by={36} hx={30} hy={15} rot={-nod * 0.4} leaf={-1} />
      <path d="M35 52 L34 29 Q34 23 40 23 L60 23 Q66 23 66 29 L65 52 Z" fill={SEAT} {...LINE} />
      <path d="M37.3 30 Q37.6 26.4 41 26.4" fill="none" stroke="#e3c6c4" stroke-linecap="round" {...lw(1.8)} />
    </g>
  );
}

/** Front view, in front of the pawn: back wheels beyond, cushion, body, deck, hood with grille and headlight, small front wheels, steering wheel. */
function FrontViewFront({ p, anim, f }: RiderProps) {
  const rot = anim === "move" ? f * 45 : 0;
  return (
    <g>
      {anim === "move" && (
        <g>
          <clipPath id="pm-front-hidden">
            <rect x={7.5} y={65.5} width={15} height={31} rx={6.5} />
            <rect x={77.5} y={65.5} width={15} height={31} rx={6.5} />
            <rect x={20.5} y={82.5} width={11} height={17} rx={4.9} />
            <rect x={68.5} y={82.5} width={11} height={17} rx={4.9} />
          </clipPath>
          <g clip-path="url(#pm-front-hidden)">
            <EndSpray f={f} x0={32} y0={89} />
          </g>
        </g>
      )}
      {/* big back wheels beyond, with their fenders */}
      <EndTire cx={15} top={67} bot={95} w={12} rot={rot} dir={-1} hub={-1} />
      <EndTire cx={85} top={67} bot={95} w={12} rot={rot} dir={-1} hub={1} />
      <Region
        p={p}
        name="fender"
        d={[fenderCap(15, 59, 74), fenderCap(85, 59, 74)]}
        line={2.4}
        over={<path d="M9 62.5 Q10 60.5 13 60.5 M79 62.5 Q80 60.5 83 60.5" fill="none" stroke="#fff" opacity="0.45" stroke-linecap="round" {...lw(1.6)} />}
      />
      {/* seat cushion (hides the pawn's lower part) */}
      <path d="M28 58 L28 56 Q28 50 35 50 L65 50 Q72 50 72 56 L72 58 Z" fill={SEAT} {...LINE} />
      <path d="M34 53.2 L66 53.2" stroke="#e3c6c4" stroke-linecap="round" {...lw(1.8)} />
      {/* body */}
      <Region
        p={p}
        name="body"
        d={["M22 62 Q22 56 28 56 L72 56 Q78 56 78 62 L78 82 Q78 86 74 86 L26 86 Q22 86 22 82 Z"]}
        over={
          <g>
            <path d="M26 59.5 L74 59.5" stroke="#fff" opacity="0.35" stroke-linecap="round" {...lw(2.4)} />
            <path d="M20 80 L80 80 L80 88 L20 88 Z" fill="#000" opacity="0.16" />
          </g>
        }
      />
      {/* mower deck */}
      <path d="M24 85 L76 85 L74 94 L26 94 Z" fill="#4a4c55" {...LINE} {...lw(2.2)} />
      {/* hood */}
      <Region
        p={p}
        name="hood"
        d={["M32 85 L32 68 Q32 59.5 41 59.5 L59 59.5 Q68 59.5 68 68 L68 85 Q68 89 64 89 L36 89 Q32 89 32 85 Z"]}
        over={
          <g>
            <path d="M30 83 L70 83 L70 91 L30 91 Z" fill="#000" opacity="0.16" />
            <path d="M38 63 Q50 61.6 62 63" fill="none" stroke="#fff" opacity="0.4" stroke-linecap="round" {...lw(2.4)} />
          </g>
        }
      />
      {/* grille vents */}
      <path d="M41.5 74 L41.5 81 M45.8 74 L45.8 81 M50 74 L50 81 M54.2 74 L54.2 81 M58.5 74 L58.5 81" stroke={INK} stroke-linecap="round" {...lw(1.8)} />
      {/* headlight */}
      <ellipse cx={50} cy={68} rx={5.6} ry={3.4} fill="#fff3b0" stroke={INK} {...lw(1.8)} />
      <path d="M46.8 67.2 Q47.6 65.9 49.4 65.8" fill="none" stroke="#fff" stroke-linecap="round" {...lw(1.1)} />
      {/* small front wheels */}
      <EndTire cx={26} top={84} bot={98} w={8} rot={rot * 1.5} dir={-1} hub={-1} />
      <EndTire cx={74} top={84} bot={98} w={8} rot={rot * 1.5} dir={-1} hub={1} />
      {/* steering column and wheel */}
      <path d="M50 60 L50 46" stroke={INK} stroke-linecap="round" {...lw(5)} />
      <path d="M50 60 L50 46" stroke={STEEL} stroke-linecap="round" {...lw(2)} />
      <ellipse cx={50} cy={45} rx={9} ry={3.4} fill="none" stroke={INK} {...lw(5.6)} />
      <ellipse cx={50} cy={45} rx={9} ry={3.4} fill="none" stroke="#3e3c44" {...lw(2.4)} />
      <circle cx={50} cy={45} r={1.8} fill={BRASS} stroke={INK} {...lw(1.2)} />
    </g>
  );
}

const frontView: RiderViewDraft = {
  frame: [0, 2, 100, 97],
  idle: { ms: Array(IDLE_N).fill(110) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: endPose,
  Back: FrontViewBack,
  Front: FrontViewFront,
};

const backView: RiderViewDraft = {
  frame: [0, 2, 100, 97],
  idle: { ms: Array(IDLE_N).fill(110) },
  move: { ms: Array(MOVE_N).fill(70) },
  pose: endPose,
  Back: BackViewBack,
  Front: BackViewFront,
};

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
  views: { front: frontView, back: backView },
  trail: { ms: [180, 180, 170, 170], w: 38, h: 28, Mark: ClippingsMark },
};

/* ───────────── Trail: a strip of fresh-cut clippings ───────────── */

// u: along the run (-1..1), v: across (-1..1), a: blade tilt off the run line (deg), c: color, k: fade order (lower stays longer)
const BLADES = [
  { u: -0.92, v: 0.2, a: 14, c: 0, k: 0.15 },
  { u: -0.75, v: -0.55, a: -22, c: 1, k: 0.7 },
  { u: -0.6, v: 0.6, a: 30, c: 2, k: 0.45 },
  { u: -0.45, v: -0.1, a: -8, c: 0, k: 0.9 },
  { u: -0.3, v: 0.75, a: -35, c: 1, k: 0.3 },
  { u: -0.15, v: -0.7, a: 18, c: 0, k: 0.6 },
  { u: 0, v: 0.15, a: 40, c: 1, k: 0.05 },
  { u: 0.12, v: -0.35, a: -16, c: 2, k: 0.8 },
  { u: 0.28, v: 0.55, a: 10, c: 0, k: 0.5 },
  { u: 0.42, v: -0.8, a: -40, c: 1, k: 0.25 },
  { u: 0.55, v: 0.05, a: 24, c: 0, k: 0.95 },
  { u: 0.7, v: 0.7, a: -12, c: 2, k: 0.65 },
  { u: 0.82, v: -0.45, a: 32, c: 1, k: 0.35 },
  { u: 0.95, v: 0.3, a: -26, c: 0, k: 0.75 },
];
const BLADE_COLORS = [CLIP, "#62c040", "#2f8a34"];

function ClippingsMark({ f, view, n }: { p: Paint; p2?: Paint; f: number; view: "side" | "front" | "back"; n: number }) {
  const keep = [1, 0.7, 0.42, 0.18][f]! ?? 0;
  const op = [1, 0.9, 0.7, 0.4][f]! ?? 0;
  const spread = [1, 1.08, 1.2, 1.32][f]! ?? 1.3;
  const flip = n % 2 ? -1 : 1;
  const side = view === "side";
  return (
    <g opacity={op}>
      {BLADES.filter((b) => b.k < keep).map((b, i) => {
        const v = b.v * flip * spread;
        const x = side ? b.u * 15 : v * 6;
        const y = side ? v * 4.2 : b.u * 11.5;
        const ang = (side ? 0 : 90) + b.a * flip;
        const s = side ? 1 : 0.85;
        return (
          <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang}) scale(${s} ${s})`}>
            <path d="M-4.4 0.7 Q0 -2.4 4.4 -0.6 Q0 2.1 -4.4 0.7 Z" fill={BLADE_COLORS[b.c]!} stroke="#1f4a17" stroke-linejoin="round" {...lw(0.7)} />
          </g>
        );
      })}
    </g>
  );
}

export type { Paint };
