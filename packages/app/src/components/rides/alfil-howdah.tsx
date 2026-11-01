// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/alfil-howdah/alfil-howdah.tsx, Nov 1: the side view, its front and back views, its
// trail mark): only the import lines changed and the `!`s the app's stricter typecheck asks for (noUncheckedIndexedAccess).
// The art's kit there (scripts/boss-art/item-kit.tsx) is a copy of ../item-paint.tsx and ./kit.ts. Notes: docs/areas/shop.md, "Rides".
import type { RiderDraft, RiderProps } from "./kit.ts";
import { Region, LINE, lw } from "../item-paint.tsx";

const FUR = "#8b5a3c";
const FUR_DARK = "#6a4029";
const FUR_LIGHT = "#b0805a";
const IVORY = "#f4ead0";
const PINK = "#e9a2a0";
const GOLD = "#f0c040";
const GOLD_DARK = "#b8862a";
const INK = "#1d1d1f";

const TAU = Math.PI * 2;

/** A tube drawn as a dark wide stroke under a colored one (trunk, tail, posts, tusks). */
function Tube({ d, w, color, line = 3 }: { d: string; w: number; color: string; line?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke={INK} stroke-linecap="round" stroke-linejoin="round" style={`stroke-width: calc(${w}px + var(--sw, 1) * ${line * 2}px)`} />
      <path d={d} fill="none" stroke={color} stroke-width={w} stroke-linecap="round" stroke-linejoin="round" />
    </g>
  );
}

/** A zigzag fur fringe from x0 back to x1 along y (alternating y and y + h). */
function zig(x0: number, x1: number, y: number, h: number, step = 4) {
  let s = "";
  let down = true;
  for (let x = x0 - step; x >= x1; x -= step) {
    s += ` L ${x} ${down ? y + h : y}`;
    down = !down;
  }
  return s;
}

const BODY = `M 12 68 C 10 54 24 46 44 46 C 62 45 78 48 84 57 L 86 80${zig(86, 14, 80, 4)} C 12 78 12 74 12 68 Z`;
const HEAD = "M 74 66 C 68 50 75 36 86 35 L 87 29 L 90 34 L 93 29 L 95 35 C 104 37 110 47 108 60 C 107 69 99 74 90 74 C 83 74 77 71 74 66 Z";

/** One leg hanging from its hip, rotated `a` degrees and lifted `lift`. */
function Leg({ x, y, a, lift, fill, len = 20 }: { x: number; y: number; a: number; lift: number; fill: string; len?: number }) {
  return (
    <g transform={`translate(${x} ${y - lift}) rotate(${a})`}>
      <path d={`M -6.5 -6 L -6.5 ${len - 3} C -6.5 ${len + 1} 6.5 ${len + 1} 6.5 ${len - 3} L 6.5 -6 Z`} fill={fill} {...LINE} />
      <path d={`M -4.5 ${len - 1.5} a 1.6 1.6 0 0 1 3.2 0 M 1.3 ${len - 1.5} a 1.6 1.6 0 0 1 3.2 0`} fill={IVORY} stroke={INK} {...lw(1.2)} />
    </g>
  );
}

function motionOf(anim: "idle" | "move", f: number) {
  const t = f / 8;
  if (anim === "idle") {
    return {
      bob: 1 * Math.sin(TAU * t),
      rock: 0,
      trunkA: 5 * Math.sin(TAU * t),
      curl: 6 * (0.5 - 0.5 * Math.cos(TAU * t)),
      ear: f === 5 ? -24 : f === 6 ? -10 : 0,
      tassel: 10 * Math.sin(TAU * t + 1),
      flag: 6 * Math.sin(TAU * t * 2),
      legs: [0, 0, 0, 0].map(() => ({ a: 0, lift: 0 })),
    };
  }
  // the plod: lateral walk, near-back, near-front, far-back, far-front a quarter apart
  const leg = (off: number) => {
    const ph = t + off;
    return { a: -16 * Math.cos(TAU * ph), lift: Math.max(0, -Math.sin(TAU * ph)) * 4 };
  };
  return {
    bob: 1.3 * Math.cos(TAU * t * 2),
    rock: 2.5 * Math.sin(TAU * t),
    trunkA: 14 * Math.sin(TAU * t + 1),
    curl: 3 + 3 * Math.sin(TAU * t),
    ear: -10 * Math.max(0, Math.sin(TAU * t * 2)),
    tassel: -14 * Math.sin(TAU * t + 0.6),
    flag: 12 * Math.sin(TAU * t * 2),
    legs: [leg(0), leg(0.25), leg(0.5), leg(0.75)],
  };
}

function Back({ p, f, anim }: RiderProps) {
  const m = motionOf(anim, f);
  const [nb, nf, fb, ff] = m.legs;
  const trunk = `M 0 0 C 7 8 9 18 5 ${26 - m.curl} c -2 4 3 7 6 3`;
  const tasselAt = (x: number, y: number, k: string) => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${m.tassel})`}>
      <path d="M 0 0 L 0 3" stroke={INK} {...lw(1.6)} />
      <path d="M 0 2.5 C -2.6 3 -3 8 -2 9 L 2 9 C 3 8 2.6 3 0 2.5 Z" fill={GOLD} stroke={INK} stroke-linejoin="round" {...lw(1.4)} />
    </g>
  );
  return (
    <g transform="translate(-6 0)">
      {/* far legs */}
      <Leg x={26} y={78} a={fb!.a} lift={fb!.lift} fill={FUR_DARK} len={18} />
      <Leg x={70} y={78} a={ff!.a} lift={ff!.lift} fill={FUR_DARK} len={18} />
      {/* near legs */}
      <Leg x={33} y={79} a={nb!.a} lift={nb!.lift} fill={FUR} />
      <Leg x={76} y={79} a={nf!.a} lift={nf!.lift} fill={FUR} />
      <g transform={`translate(0 ${m.bob}) rotate(${m.rock} 50 80)`}>
        {/* tail */}
        <Tube d={`M 14 62 C 8 63 6 ${68 + m.tassel * 0.15} 6 72`} w={3.5} color={FUR_DARK} />
        <path d="M 6 70 l -3 5 3 -1 1 3 2 -4 z" fill={FUR_DARK} {...LINE} {...lw(1.6)} />
        {/* body */}
        <path d={BODY} fill={FUR} {...LINE} />
        <path d="M 20 56 C 26 50 36 48 44 48" fill="none" stroke={FUR_LIGHT} stroke-linecap="round" {...lw(3)} />
        <path d="M 18 74 l 2 -4 2 4 M 80 70 l 2 -4 2 4 M 16 64 l 2 -3 2 3" fill="none" stroke={FUR_DARK} stroke-linecap="round" stroke-linejoin="round" {...lw(1.6)} />
        {/* caparison */}
        <path d="M 16 76 l 2 -4 2 4 M 24 79 l 2 -4 2 4 M 62 79 l 2 -4 2 4 M 74 76 l 2 -4 2 4 M 79 62 l 2 -4 2 4 M 14 60 l 2 -3 2 3" fill="none" stroke={FUR_DARK} stroke-linecap="round" stroke-linejoin="round" {...lw(1.6)} />
        <Region p={p} name="caparison" d={["M 27 50 C 42 48 58 48 73 51 L 74 65 Q 50 73 26 65 Z"]} />
        <path d="M 26 62 Q 50 70 74 62 L 74 66 Q 50 74 26 66 Z" fill={GOLD} {...LINE} {...lw(1.6)} />
        <path d="M 50 53 L 53.5 57 L 50 61 L 46.5 57 Z" fill={GOLD} {...LINE} {...lw(1.6)} />
        <path d="M 50 55.5 L 51.5 57 L 50 58.5 L 48.5 57 Z" fill="#2f5fc0" />
        {tasselAt(26, 66, "t1")}
        {tasselAt(50, 70, "t2")}
        {tasselAt(74, 66, "t3")}
        {/* head */}
        <path d={HEAD} fill={FUR} {...LINE} />
        <path d="M 84 41 C 89 38 97 39 102 43" fill="none" stroke={FUR_LIGHT} stroke-linecap="round" {...lw(2.5)} />
        {/* ear */}
        <g transform={`rotate(${m.ear} 84 47)`}>
          <path d="M 85 45 C 75 42 70 50 71 57 C 72 64 79 67 84 62 Z" fill={FUR} {...LINE} />
          <path d="M 82 49 C 77 48 75 52 75.5 57 C 76 61 80 62 82 59 Z" fill={PINK} />
        </g>
        {/* eye and cheek */}
        <circle cx={97} cy={51} r={3.3} fill={INK} />
        <circle cx={98.2} cy={49.8} r={1.1} fill="#fff" />
        <ellipse cx={99} cy={60} rx={3.4} ry={2} fill={PINK} opacity={0.85} />
        {/* trunk */}
        <g transform={`translate(105 60) rotate(${m.trunkA})`}>
          <Tube d={trunk} w={7.5} color={FUR} />
          <path d={`M 4 9 l 3 -1 M 6 15 l 3 0 M 6 21 l 3 1`} stroke={FUR_DARK} stroke-linecap="round" {...lw(1.2)} />
        </g>
        {/* tusk */}
        <Tube d="M 99 69 C 101 76 109 78 112 71" w={3.4} color={IVORY} line={1.5} />
      </g>
    </g>
  );
}

function Front({ p, f, anim }: RiderProps) {
  const m = motionOf(anim, f);
  return (
    <g transform={`translate(0 ${m.bob}) rotate(${m.rock} 46 80)`}>
      {/* corner posts with finials */}
      <Tube d="M 23 46 L 23 14" w={2.6} color={GOLD} line={1.4} />
      <Tube d="M 77 46 L 77 24" w={2.6} color={GOLD} line={1.4} />
      {/* pennant on the back post */}
      <g transform={`translate(23 10) skewY(${m.flag * 0.5})`}>
        <Region p={p} name="pennant" d={[`M 0 0 L ${-13} ${4 + m.flag * 0.15} L 0 8 Z`]} line={1.8} />
      </g>
      <circle cx={23} cy={10} r={2.6} fill={GOLD} {...LINE} {...lw(1.6)} />
      <path d="M 23 7.4 L 23 4" stroke={INK} {...lw(1.6)} />
      <circle cx={77} cy={21} r={3} fill={GOLD} {...LINE} {...lw(1.6)} />
      <path d="M 75.6 18.6 L 77 14.5 L 78.4 18.6 Z" fill={GOLD} {...LINE} {...lw(1.4)} />
      {/* howdah front wall: gold frame, painted panel */}
      <path d="M 20 40 L 80 40 L 78 55 L 22 55 Z" fill={GOLD} {...LINE} />
      <Region p={p} name="panel" d={["M 25 43.5 L 75 43.5 L 73.8 51.5 L 26.2 51.5 Z"]} line={1.6} />
      <path d="M 50 44.5 L 53.5 47.5 L 50 50.5 L 46.5 47.5 Z" fill={GOLD} stroke={INK} {...lw(1.2)} />
      <path d="M 21 40.5 L 79 40.5" stroke="#fff3c0" stroke-linecap="round" opacity="0.8" {...lw(1.2)} />
      <circle cx={21} cy={40} r={2.4} fill={GOLD} {...LINE} {...lw(1.4)} />
      <circle cx={79} cy={40} r={2.4} fill={GOLD} {...LINE} {...lw(1.4)} />
    </g>
  );
}

/* ---------------- the end-on views (front and back) ---------------- */

const PIVOT_Y = 96;

/** The side's motion, plus a side-to-side roll for the end-on views. */
function endMotion(anim: "idle" | "move", f: number) {
  const m = motionOf(anim, f);
  return { ...m, roll: m.rock * 1.3 };
}

/** A leg seen end-on: a short column with three ivory toenails, lifted (and foreshortened) as it steps. */
function EndLeg({ x, lift, fill }: { x: number; lift: number; fill: string }) {
  const len = 20;
  const s = 1 - lift * 0.03;
  return (
    <g transform={`translate(${x} ${78 - lift}) scale(1 ${s})`}>
      <path d={`M -7 -6 L -7 ${len - 3} C -7 ${len + 1} 7 ${len + 1} 7 ${len - 3} L 7 -6 Z`} fill={fill} {...LINE} />
      <path d={`M -2.8 2 L -2.8 ${len - 6}`} stroke={FUR_DARK} stroke-linecap="round" {...lw(1.4)} />
      <path d={`M -5.4 ${len - 1.5} a 1.6 1.6 0 0 1 3.2 0 M -1.6 ${len - 1.5} a 1.6 1.6 0 0 1 3.2 0 M 2.2 ${len - 1.5} a 1.6 1.6 0 0 1 3.2 0`} fill={IVORY} stroke={INK} {...lw(1.2)} />
    </g>
  );
}

function Tassel({ x, y, a }: { x: number; y: number; a: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <path d="M 0 0 L 0 3" stroke={INK} {...lw(1.6)} />
      <path d="M 0 2.5 C -2.6 3 -3 8 -2 9 L 2 9 C 3 8 2.6 3 0 2.5 Z" fill={GOLD} stroke={INK} stroke-linejoin="round" {...lw(1.4)} />
    </g>
  );
}

/** The howdah's wall nearest the camera: gold frame, painted panel, gold diamond, corner balls (as the side's). */
function EndWall({ p }: { p: RiderProps["p"] }) {
  return (
    <g>
      <path d="M 20 40 L 80 40 L 78 55 L 22 55 Z" fill={GOLD} {...LINE} />
      <Region p={p} name="panel" d={["M 25 43.5 L 75 43.5 L 73.8 51.5 L 26.2 51.5 Z"]} line={1.6} />
      <path d="M 50 44.5 L 53.5 47.5 L 50 50.5 L 46.5 47.5 Z" fill={GOLD} stroke={INK} {...lw(1.2)} />
      <path d="M 21 40.5 L 79 40.5" stroke="#fff3c0" stroke-linecap="round" opacity="0.8" {...lw(1.2)} />
      <circle cx={21} cy={40} r={2.4} fill={GOLD} {...LINE} {...lw(1.4)} />
      <circle cx={79} cy={40} r={2.4} fill={GOLD} {...LINE} {...lw(1.4)} />
    </g>
  );
}

/** The far wall's top rail and the two side rails, seen over the near wall behind the pawn. */
function FarRim() {
  return (
    <g>
      <Tube d="M 21 41 L 24.5 35" w={2.6} color={GOLD} line={1.4} />
      <Tube d="M 79 41 L 75.5 35" w={2.6} color={GOLD} line={1.4} />
      <path d="M 24 32.5 L 76 32.5 L 76 37 L 24 37 Z" fill={GOLD_DARK} {...LINE} {...lw(1.6)} />
    </g>
  );
}

/** A short post with a gold ball and spike (the side's front posts). */
function ShortPost({ x, base, top }: { x: number; base: number; top: number }) {
  return (
    <g>
      <Tube d={`M ${x} ${base} L ${x} ${top + 3}`} w={2.6} color={GOLD} line={1.4} />
      <circle cx={x} cy={top} r={3} fill={GOLD} {...LINE} {...lw(1.6)} />
      <path d={`M ${x - 1.4} ${top - 2.4} L ${x} ${top - 6.5} L ${x + 1.4} ${top - 2.4} Z`} fill={GOLD} {...LINE} {...lw(1.4)} />
    </g>
  );
}

/** A tall post with a gold ball (the side's back posts); `flag` -1 / 1 flies the pennant to that side. */
function TallPost({ x, base, p, flag, m }: { x: number; base: number; p?: RiderProps["p"]; flag?: number; m: ReturnType<typeof motionOf> }) {
  return (
    <g>
      <Tube d={`M ${x} ${base} L ${x} 14`} w={2.6} color={GOLD} line={1.4} />
      {p && flag && (
        <g transform={`translate(${x} 10) scale(${-flag} 1) skewY(${m.flag * 0.5})`}>
          <Region p={p} name="pennant" d={[`M 0 0 L ${-13} ${4 + m.flag * 0.15} L 0 8 Z`]} line={1.8} />
        </g>
      )}
      <circle cx={x} cy={10} r={2.6} fill={GOLD} {...LINE} {...lw(1.6)} />
      <path d={`M ${x} 7.4 L ${x} 4`} stroke={INK} {...lw(1.6)} />
    </g>
  );
}

const zigEnd = (x0: number, x1: number, y: number) => zig(x0, x1, y, 4);
const END_BODY = `M 18 66 C 16 52 30 45 50 45 C 70 45 84 52 82 66 L 82 82${zigEnd(82, 18, 82)} C 18 80 18 74 18 66 Z`;
const CAP_END = "M 15 53 C 28 46 72 46 85 53 L 85 73 Q 80 76 75 73 Q 64 61 50 61 Q 36 61 25 73 Q 20 76 15 73 Z";
const CAP_TRIM = "M 15 70 Q 20 73 25 70 Q 36 58 50 58 Q 64 58 75 70 Q 80 73 85 70 L 85 73.5 Q 80 76.5 75 73.5 Q 64 61.5 50 61.5 Q 36 61.5 25 73.5 Q 20 76.5 15 73.5 Z";

function EndBodyGroup({ m, children }: { m: ReturnType<typeof endMotion>; children: any }) {
  return <g transform={`translate(0 ${m.bob}) rotate(${m.roll} 50 ${PIVOT_Y})`}>{children}</g>;
}

function Caparison({ p, m, dy = 0 }: { p: RiderProps["p"]; m: ReturnType<typeof endMotion>; dy?: number }) {
  return (
    <g transform={`translate(0 ${dy})`}>
      <Region p={p} name="caparison" d={[CAP_END]} />
      <path d={CAP_TRIM} fill={GOLD} {...LINE} {...lw(1.6)} />
      {[22, 78].map((x) => (
        <g key={x}>
          <path d={`M ${x} 59 L ${x + 3.5} 63 L ${x} 67 L ${x - 3.5} 63 Z`} fill={GOLD} {...LINE} {...lw(1.6)} />
          <path d={`M ${x} 61.5 L ${x + 1.5} 63 L ${x} 64.5 L ${x - 1.5} 63 Z`} fill="#2f5fc0" />
        </g>
      ))}
      <Tassel x={15.5} y={74} a={m.tassel} />
      <Tassel x={84.5} y={74} a={m.tassel} />
    </g>
  );
}

/* ----- back view: walking away ----- */

function BackViewBack({ f, anim }: RiderProps) {
  const m = endMotion(anim, f);
  return (
    <EndBodyGroup m={m}>
      {/* ears from behind, out past the rump */}
      <g transform={`rotate(${-m.ear * 0.6} 32 40)`}>
        <path d="M 33 40 C 22 29 6 32 5.5 42 C 5 51 14 56 26 51 Z" fill={FUR} {...LINE} />
        <path d="M 10 44 l 2 -3 2 3" fill="none" stroke={FUR_DARK} stroke-linecap="round" stroke-linejoin="round" {...lw(1.4)} />
      </g>
      <g transform={`rotate(${m.ear * 0.6} 68 40)`}>
        <path d="M 67 40 C 78 29 94 32 94.5 42 C 95 51 86 56 74 51 Z" fill={FUR} {...LINE} />
        <path d="M 86 44 l 2 -3 2 3" fill="none" stroke={FUR_DARK} stroke-linecap="round" stroke-linejoin="round" {...lw(1.4)} />
      </g>
      {/* the top of its head beyond the howdah */}
      <path d="M 29 40 C 29 28 38 23 46 23 L 47 17.5 L 50 21.5 L 53 17.5 L 54 23 C 62 23 71 28 71 40 Z" fill={FUR} {...LINE} />
      <path d="M 34 30 C 37 27 41 25.5 44 25.5 M 56 25.5 C 59 25.5 63 27 66 30" fill="none" stroke={FUR_LIGHT} stroke-linecap="round" {...lw(2)} />
      {/* far (front) posts and the far rim */}
      <ShortPost x={28} base={34} top={20} />
      <ShortPost x={72} base={34} top={20} />
      <FarRim />
    </EndBodyGroup>
  );
}

function BackViewFront({ p, f, anim }: RiderProps) {
  const m = endMotion(anim, f);
  const [nb, , fb] = m.legs;
  const sw = m.tassel * 0.35;
  return (
    <g>
      {/* hind legs: its left (our left), its right */}
      <EndLeg x={34} lift={nb!.lift * 1.6} fill={FUR} />
      <EndLeg x={66} lift={fb!.lift * 1.6} fill={FUR} />
      <EndBodyGroup m={m}>
        {/* round shaggy rump */}
        <path d={END_BODY} fill={FUR} {...LINE} />
        <path d="M 25 56 C 29 50 37 47.5 44 47" fill="none" stroke={FUR_LIGHT} stroke-linecap="round" {...lw(3)} />
        <path d="M 50 64 L 50 80" stroke={FUR_DARK} stroke-linecap="round" {...lw(1.4)} />
        <path d="M 24 78 l 2 -4 2 4 M 72 78 l 2 -4 2 4 M 36 70 l 2 -3 2 3 M 60 70 l 2 -3 2 3" fill="none" stroke={FUR_DARK} stroke-linecap="round" stroke-linejoin="round" {...lw(1.6)} />
        <Caparison p={p} m={m} />
        {/* tufted tail down the middle */}
        <Tube d={`M 50 61 C 50 66 ${50 + sw * 0.5} 70 ${50 + sw} 74`} w={3.5} color={FUR_DARK} />
        <path d={`M ${50 + sw} 72 l -3.5 5 2.5 -0.5 1 3.5 1 -3.5 2.5 0.5 z`} fill={FUR_DARK} {...LINE} {...lw(1.6)} />
        {/* near (back) posts, tall, the pennant on its left one */}
        <TallPost x={23} base={46} p={p} flag={-1} m={m} />
        <TallPost x={77} base={46} m={m} />
        <EndWall p={p} />
      </EndBodyGroup>
    </g>
  );
}

/* ----- front view: walking toward us ----- */

function FrontViewBack({ p, f, anim }: RiderProps) {
  const m = endMotion(anim, f);
  return (
    <EndBodyGroup m={m}>
      {/* far (back) posts, tall: the pennant flies from its left one (our right) */}
      <TallPost x={24.5} base={38} m={m} />
      <TallPost x={75.5} base={38} p={p} flag={1} m={m} />
      <FarRim />
    </EndBodyGroup>
  );
}

const FACE = "M 30 71 C 30 61 37 55 46 55 L 47 49.5 L 50 54 L 53 49.5 L 54 55 C 63 55 70 61 70 71 C 70 81 61 88 50 88 C 39 88 30 81 30 71 Z";

function FrontViewFront({ p, f, anim }: RiderProps) {
  const m = endMotion(anim, f);
  const [, nf, , ff] = m.legs;
  const tr = m.trunkA * 0.6;
  return (
    <g>
      {/* front legs: its right (our left), its left (our right) */}
      <EndLeg x={33} lift={ff!.lift * 1.6} fill={FUR} />
      <EndLeg x={67} lift={nf!.lift * 1.6} fill={FUR} />
      <EndBodyGroup m={m}>
        {/* chest and shoulders */}
        <path d={END_BODY} fill={FUR} {...LINE} />
        <Caparison p={p} m={m} dy={5} />
        {/* near (front) posts and the front wall */}
        <ShortPost x={21} base={46} top={24} />
        <ShortPost x={79} base={46} top={24} />
        <EndWall p={p} />
        {/* ears out to the sides */}
        <g transform={`rotate(${-m.ear * 0.7} 34 60)`}>
          <path d="M 35 60 C 27 49 11 50 10.5 59 C 10 67 20 71 33 69 Z" fill={FUR} {...LINE} />
          <path d="M 32 61 C 26 54 16 55 15 59.5 C 14.5 64 21 67 30 66 Z" fill={PINK} />
        </g>
        <g transform={`rotate(${m.ear * 0.7} 66 60)`}>
          <path d="M 65 60 C 73 49 89 50 89.5 59 C 90 67 80 71 67 69 Z" fill={FUR} {...LINE} />
          <path d="M 68 61 C 74 54 84 55 85 59.5 C 85.5 64 79 67 70 66 Z" fill={PINK} />
        </g>
        {/* big round head */}
        <path d={FACE} fill={FUR} {...LINE} />
        <path d="M 37 61 C 40 58.5 43 57.5 46 57.5 M 54 57.5 C 57 57.5 60 58.5 63 61" fill="none" stroke={FUR_LIGHT} stroke-linecap="round" {...lw(2.5)} />
        <circle cx={42} cy={68.5} r={3.3} fill={INK} />
        <circle cx={43.2} cy={67.3} r={1.1} fill="#fff" />
        <circle cx={58} cy={68.5} r={3.3} fill={INK} />
        <circle cx={59.2} cy={67.3} r={1.1} fill="#fff" />
        <ellipse cx={36} cy={76} rx={3.4} ry={2} fill={PINK} opacity={0.85} />
        <ellipse cx={64} cy={76} rx={3.4} ry={2} fill={PINK} opacity={0.85} />
        {/* small curled tusks */}
        <Tube d="M 44 80 C 41 87 35 88 34 83" w={3.4} color={IVORY} line={1.5} />
        <Tube d="M 56 80 C 59 87 65 88 66 83" w={3.4} color={IVORY} line={1.5} />
        {/* curled trunk hanging down the middle */}
        <g transform={`translate(50 73) rotate(${tr})`}>
          <Tube d={`M 0 0 C 0 7 0.5 13 0 ${18 - m.curl * 0.4} c -0.5 4 4.5 6 6 2`} w={7.5} color={FUR} />
          <path d="M -2 7 l 4 0 M -2 12.5 l 4 0 M -2 18 l 4 0" stroke={FUR_DARK} stroke-linecap="round" {...lw(1.2)} />
        </g>
      </EndBodyGroup>
    </g>
  );
}

function endPose(anim: "idle" | "move", f: number) {
  const m = endMotion(anim, f);
  const r = (m.roll * Math.PI) / 180;
  return {
    dx: 0,
    dy: 0,
    pawnX: (PIVOT_Y - 62) * Math.sin(r),
    pawnY: -26 + m.bob,
    pawnTilt: m.roll,
    cut: 70,
  };
}

/* ---------------- the trail: round mammoth footprints ---------------- */

const PRINT = "#4a2c1a";
const PRINT_RIM = "#2e1a0e";

function Mark({ f, view, n }: { p: any; p2?: any; f: number; view: "side" | "front" | "back"; n: number }) {
  const op = [0.85, 0.5, 0.22][f]! ?? 0;
  const s = [1, 0.97, 0.92][f]! ?? 0.9;
  const side = n % 2 === 0 ? 1 : -1;
  // toes point the way it ran: side +x, back -y (up), front +y (down)
  const rot = view === "side" ? 0 : view === "back" ? -90 : 90;
  const ox = view === "side" ? -2 : side * 6;
  const oy = view === "side" ? side * 3 : 0;
  const sx = view === "side" ? 1 : 0.8;
  return (
    <g opacity={op} transform={`translate(${ox} ${oy}) scale(${s * sx} ${s * 0.62})`}>
      <g transform={`rotate(${rot})`}>
        <ellipse cx={-2} cy={0} rx={12.5} ry={12.5} fill={PRINT} stroke={PRINT_RIM} stroke-width={1.6} />
        <ellipse cx={-4} cy={0} rx={7} ry={8} fill={PRINT_RIM} opacity={0.35} />
        {[-48, -16, 16, 48].map((a) => {
          const r = (a * Math.PI) / 180;
          const x = -2 + 15.5 * Math.cos(r);
          const y = 15.5 * Math.sin(r);
          return <ellipse key={a} cx={x} cy={y} rx={2.6} ry={2.8} fill={PRINT_RIM} transform={`rotate(${a} ${x} ${y})`} />;
        })}
      </g>
    </g>
  );
}

export const AlfilHowdah: RiderDraft = {
  trail: { ms: [240, 230, 230], w: 34, h: 24, Mark },
  id: "alfil-howdah",
  name: "Alfil's Howdah",
  tier: "mythic",
  description: "A baby mammoth with a tiny throne on its back. It plods, you reign, nobody hurries.",
  frame: [0, -9, 112, 109],
  idle: { ms: [220, 220, 220, 220, 220, 220, 220, 220] },
  move: { ms: [110, 110, 110, 110, 110, 110, 110, 110] },
  pose: (anim, f) => {
    const m = motionOf(anim, f);
    const r = (m.rock * Math.PI) / 180;
    const sway = anim === "move" ? 3 * Math.sin(TAU * (f / 8) - 0.8) : 0;
    return {
      dx: anim === "move" ? f * 12.5 : 0,
      dy: 0,
      pawnX: 40 * Math.sin(r),
      pawnY: -26 + m.bob,
      pawnTilt: m.rock + sway,
      cut: 70,
    };
  },
  Back,
  Front,
  views: {
    front: {
      frame: [4, -9, 92, 109],
      idle: { ms: [220, 220, 220, 220, 220, 220, 220, 220] },
      move: { ms: [110, 110, 110, 110, 110, 110, 110, 110] },
      pose: endPose,
      Back: FrontViewBack,
      Front: FrontViewFront,
    },
    back: {
      frame: [4, -9, 92, 109],
      idle: { ms: [220, 220, 220, 220, 220, 220, 220, 220] },
      move: { ms: [110, 110, 110, 110, 110, 110, 110, 110] },
      pose: endPose,
      Back: BackViewBack,
      Front: BackViewFront,
    },
  },
};
