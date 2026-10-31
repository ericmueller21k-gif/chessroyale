import { Region, LINE, lw, type RiderDraft, type RiderProps } from "../../item-kit.tsx";

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
      <Leg x={26} y={78} a={fb.a} lift={fb.lift} fill={FUR_DARK} len={18} />
      <Leg x={70} y={78} a={ff.a} lift={ff.lift} fill={FUR_DARK} len={18} />
      {/* near legs */}
      <Leg x={33} y={79} a={nb.a} lift={nb.lift} fill={FUR} />
      <Leg x={76} y={79} a={nf.a} lift={nf.lift} fill={FUR} />
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

export const AlfilHowdah: RiderDraft = {
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
};
